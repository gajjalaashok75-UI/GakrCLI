/**
 * BrowserServer — 100% Playwright wrapper (Stagehand fully removed).
 *
 * LAYER 1 — GakrCLI-AGNOSTIC. Ported from server.py (340 lines), with every
 * `browser_use` call replaced per the architecture decision:
 *   - navigate/back/scroll/tabs/storage      -> Playwright directly
 *   - click/type/get_state                   -> a DOM-tree/highlight-index
 *                                                system + page.locator('xpath=...') — NO LLM
 *   - get_content                            -> single-pass in-browser markdown-ish
 *                                                extraction — NO LLM
 *   - recording/set_storage DOMStorage       -> CDP directly (same commands as Python)
 *
 * ARCHITECTURE CHANGE (earlier revision): @browserbase/stagehand is REMOVED.
 *
 * ARCHITECTURE CHANGE (this revision): click/type/get_state moved OFF
 * Playwright's `page.ariaSnapshot({ mode: 'ai' })` + `aria-ref=` locators
 * and ONTO a ported version of browser-use's interactive-element DOM tree
 * (see domTreeScript.ts/domService.ts/domTypes.ts) + `page.locator('xpath=...')`.
 * Both approaches are zero-LLM and deterministic; the DOM-tree system was
 * chosen for richer per-element data (bounding boxes, visibility/viewport
 * flags, stable xpath) in a single `page.evaluate()` round trip, and for
 * highlight-overlay screenshots. The `index` numbering the LLM sees/uses in
 * click/type is unchanged in spirit (small integers from the latest
 * get_state); only what backs an index changed, from an aria-ref lookup to
 * a `SelectorMap` (`Record<number, DOMElementNode>`) lookup. `find_elements`
 * (general CSS querying, not tied to interactivity) and the `selector`
 * (CSS) bypass path on click/type are unaffected by this change.
 *
 * ROUND 7 — resolved real-world testing findings from log.md:
 *   - Issue #1 (HIGH): boolean/number/object params arriving as JSON-
 *     stringified strings from the tool-call harness, breaking
 *     `set_storage` entirely and `navigate`'s `new_tab` silently. Fixed at
 *     the schema level in types.ts (`looseBoolean`/`looseNumber`/
 *     `looseObject`), not here — but it's what made `new_tab` usable again,
 *     which is what unblocks the tab-management fixes below.
 *   - "click sometimes opens a new tab, sometimes changes the existing
 *     tab" (reported as confusing/inconsistent): this is normal Chromium
 *     behavior depending on the clicked element's `target` attribute — but
 *     the tool wasn't tracking it, so a `target="_blank"` link would open a
 *     real new tab while the tool's internal `this.page` stayed pointed at
 *     the OLD tab, silently going stale. Fixed: `initBrowserSession()`'s
 *     `context.on('page', ...)` handler now auto-adopts any newly created
 *     page as the active `this.page` (mirroring how a real browser focuses
 *     a newly opened tab) and marks `autoSwitchedToNewTab` in live state so
 *     callers can tell which case happened instead of guessing.
 *   - `close_tab`'s last-tab guard + `new_tab` being broken combined into
 *     an unrecoverable deadlock (can't open a 2nd tab, can't close the
 *     only one). `new_tab` now works (see above); added `closeAllTabs()`
 *     as an explicit, unconditional escape hatch regardless.
 *   - Issue #3 (LOW): occurrence-index fragility on element-dense pages.
 *     `click()`/`typeText()` now accept an optional `selector` (CSS) that
 *     bypasses the index entirely.
 *   - `start_recording`'s opaque `unexpected_response` — see recording.ts's
 *     own round-6 fix (surfaces the real CDN/network failure reason now).
 *
 * The `_get_content` truncation logic (30000 char limit, paragraph/sentence
 * break detection, <url>/<content>/<content_stats>/<webpage_content> tags)
 * is ported EXACTLY, since the LLM parses those tags.
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { chromium, type Browser, type BrowserContext, type Page, type Response } from 'playwright';
import { RecordingSession } from './recording.js';
import { DomService } from './domService.js';
import { detectPaginationButtons, type DOMElementNode, type SelectorMap } from './domTypes.js';
import { errorMessage } from '../../utils/errors.js';
import {
  BROWSER_RECORDING_OUTPUT_DIR,
  EMPTY_BROWSER_LIVE_STATE,
  type BrowserConfig,
  type BrowserErrorCategory,
  type BrowserLiveState,
  type BrowserTabState,
  buildScrollToTextExpression,
  MAX_SCROLL_TEXT_QUERY_CHARS,
  type ScrollToTextPageResult,
} from './types.js';

const logger = {
  debug: (...args: unknown[]) => { if (process.env.DEBUG) console.debug('[browserServer]', ...args); },
};

const MAX_CHAR_LIMIT = 30000;
const TRUNCATE_PARAGRAPH_LOOKBACK_CHARS = 500;
const TRUNCATE_SENTENCE_LOOKBACK_CHARS = 200;
const CAPTURE_PREVIEW_MAX_CHARS = 300;

// How long to wait for an element locator before giving up. Playwright's
// default is 30s; a stale index (page changed since the last get_state)
// otherwise hangs the tool for half a minute. The self-healing retry in
// click/typeText rebuilds the DOM tree and retries once before surfacing
// the timeout.
const ELEMENT_TIMEOUT_MS = 10000;

const MAX_ARTIFACT_NAME_LENGTH = 200;

const PAPER_SIZES: Record<string, { width: number; height: number }> = {
  letter: { width: 8.5, height: 11 },
  a4: { width: 8.27, height: 11.69 },
  legal: { width: 8.5, height: 14 },
  a3: { width: 11.69, height: 16.54 },
  tabloid: { width: 11, height: 17 },
};

let outputDirReady = false;
const ensureOutputDir = (): void => {
  if (outputDirReady) return;
  try {
    fs.mkdirSync(BROWSER_RECORDING_OUTPUT_DIR, { recursive: true });
    outputDirReady = true;
  } catch {
    // Try again on the next call; mkdir failure is non-fatal here.
  }
};

/**
 * Classifies a Playwright/Chromium error message into a coarse network
 * error category, with a short human-readable hint appended to the
 * original message. Chromium's `net::ERR_*` codes are stable and
 * well-documented, so pattern-matching on them reliably tells "this site
 * doesn't exist" apart from "you have no internet" apart from "our own
 * allowed_domains config blocked this on purpose" — three very different
 * situations that otherwise all just look like "navigation failed".
 *
 * Exported so WebBrowserTool.ts/tests/other callers can reuse the same
 * classification instead of re-deriving it from error text themselves.
 */
export function classifyNetworkError(rawMessage: string): {
  category: BrowserErrorCategory;
  hint: string | null;
} {
  const msg = rawMessage.toLowerCase();

  // Our OWN allowed_domains route.abort('blockedbyclient') from
  // initBrowserSession — must be checked first, since it shares the same
  // Chromium error code as ad-blocker-style extensions and would otherwise
  // be misreported as a connectivity problem.
  if (msg.includes('err_blocked_by_client')) {
    return {
      category: 'blocked_by_allowlist',
      hint: 'This request was blocked by this session\'s allowed_domains configuration, not a network problem.',
    };
  }

  if (msg.includes('err_internet_disconnected') || msg.includes('err_network_access_denied')) {
    return {
      category: 'offline',
      hint:
        'Chromium reports no network connectivity at all. If this runs in a sandbox/' +
        'container, outbound network access may be disabled for this process even ' +
        'though the host machine has internet — check the sandbox/container\'s egress ' +
        'policy rather than the browser tool itself.',
    };
  }

  if (
    msg.includes('err_name_not_resolved') ||
    msg.includes('err_address_unreachable') ||
    msg.includes('enotfound')
  ) {
    return {
      category: 'dns',
      hint:
        'DNS resolution failed for this host. If other network calls on this machine work ' +
        'but the browser tool doesn\'t, the Chromium subprocess may be running with a ' +
        'different (or missing) DNS/resolv.conf than your shell.',
    };
  }

  if (
    msg.includes('err_connection_refused') ||
    msg.includes('err_connection_reset') ||
    msg.includes('err_connection_closed') ||
    msg.includes('econnrefused')
  ) {
    return {
      category: 'connection_refused',
      hint: 'The target host actively refused or reset the connection — this is usually the destination server, not local network config.',
    };
  }

  if (
    msg.includes('err_connection_timed_out') ||
    msg.includes('err_timed_out') ||
    msg.includes('timeout') // Playwright's own "Timeout Nms exceeded" wording for goto/locator waits
  ) {
    return {
      category: 'timeout',
      hint:
        'The connection attempt timed out. In a sandboxed environment this often means ' +
        'outbound traffic is being silently dropped (no response) rather than actively ' +
        'refused — a common sign of a firewall/egress-allowlist blocking the destination.',
    };
  }

  if (
    msg.includes('err_proxy_connection_failed') ||
    msg.includes('err_tunnel_connection_failed') ||
    msg.includes('err_proxy_certificate_invalid')
  ) {
    return {
      category: 'proxy',
      hint:
        'The configured proxy could not be reached or refused the tunnel. If ' +
        'HTTP_PROXY/HTTPS_PROXY env vars are set, confirm the proxy config passed to ' +
        'BrowserConfig.proxy (or those env vars) is reachable from this process.',
    };
  }

  if (
    msg.includes('err_cert_') ||
    msg.includes('err_ssl_protocol_error') ||
    msg.includes('err_ssl_version_or_cipher_mismatch')
  ) {
    return {
      category: 'tls',
      hint:
        'A TLS/certificate error occurred — often caused by a corporate/proxy TLS-inspection ' +
        'certificate that Chromium\'s trust store doesn\'t have, common in locked-down networks.',
    };
  }

  return { category: 'other', hint: null };
}

/**
 * Best-effort CAPTCHA/bot-challenge heuristic based on the page title.
 * Deliberately conservative (title-only, not full page content — checking
 * content would mean an extra `page.content()`/`page.innerText()` call on
 * every single state refresh, which is too expensive to do unconditionally).
 * This WILL miss challenge pages with a generic title, and could in theory
 * false-positive on a legitimate page that happens to use one of these
 * phrases in its title. Treat as a hint for the panel only — never
 * something the tool acts on automatically (per the panel design brief:
 * "the user cannot interact with the panel").
 */
const CAPTCHA_TITLE_PATTERNS = [
  /just a moment/i, // Cloudflare's interstitial title
  /checking your browser/i,
  /attention required.*cloudflare/i,
  /cloudflare.*challenge/i,
  /verify you are human/i,
  /are you a robot/i,
  /recaptcha/i,
  /hcaptcha/i,
  /turnstile/i,
  /security check/i,
  /human verification/i,
];

export function detectPossibleCaptcha(title: string | null): boolean {
  if (!title) return false;
  return CAPTCHA_TITLE_PATTERNS.some((re) => re.test(title));
}

interface RefreshLiveStateOptions {
  errorText?: string | null;
  lastOperation?: string | null;
  isLoading?: boolean;
  httpStatus?: number | null;
  httpStatusText?: string | null;
  /**
   * `true` to mark a new-tab-auto-switch event, `false` to clear the flag,
   * `undefined` to leave the previous value alone. The tri-state prevents
   * callers that don't know about the flag (every refresh except the
   * context-'page' handler that sets it) from silently clobbering it to
   * false, which used to force every caller that cared to read-modify-write
   * the live state around their own refresh.
   */
  autoSwitchedToNewTab?: boolean | null;
  contentPreview?: string | null;
}

/** Best-effort plain-text excerpt for the panel's preview row. Never throws. */
async function capturePreview(page: Page): Promise<string | null> {
  try {
    const text = (await page.innerText('body')).trim().replace(/\s+/g, ' ');
    if (!text) return null;
    return text.length > CAPTURE_PREVIEW_MAX_CHARS
      ? `${text.slice(0, CAPTURE_PREVIEW_MAX_CHARS - 1)}…`
      : text;
  } catch {
    return null;
  }
}

// ── Headless / headed launch resolution ──────────────────────────────────
//
// Ported semantics (simplified — no multi-profile/extension support, which
// is out of scope for a tool executor) from browser-use-main's
// `src/browser/profile.ts`: headless and headed mode want fundamentally
// different things from Chromium.
//   - headless: true  — no real window exists, so the VIEWPORT drives page
//     dimensions. Playwright's own default (1280x720 fixed viewport) is
//     kept for backward compatibility unless `window_size` overrides it.
//     Extra flags harden it against the two most common "works on my
//     machine, not in headless" classes of bug: automation-detection
//     (`--disable-blink-features=AutomationControlled`) and background-tab
//     throttling changing timer/animation behavior versus a real session.
//   - headless: false — a REAL OS window is what should exist ("spawn the
//     real Chrome tab"), so `viewport: null` on the context tells
//     Playwright NOT to force a fixed device-metrics viewport — the page
//     is sized by the actual window instead, exactly like a normal browser
//     tab a person opened by hand. `--window-size`/`--window-position` set
//     that real window's geometry.
//
// This was previously UNTESTED per the person's own report ("i never tried
// headless false") — `newContext()` took no viewport override at all, so
// headed mode got Playwright's fixed 1280x720 viewport-in-a-window rather
// than a real, naturally-sized tab, and there was no up-front check for
// the single most common way headed mode fails in a server/container
// environment: no display server. `isDisplayAvailable()` + the launch-time
// check below turn that failure from an opaque Chromium crash several
// seconds into launch into an immediate, actionable error.

const DEFAULT_HEADLESS_VIEWPORT = { width: 1280, height: 720 } as const;
const DEFAULT_HEADED_WINDOW_SIZE = { width: 1280, height: 1024 } as const;

/** Extra headless-only args: avoid the most common automation-detection + background-throttling classes of "headless behaves differently" bugs. */
const HEADLESS_HARDENING_ARGS = [
  '--disable-blink-features=AutomationControlled',
  '--disable-background-timer-throttling',
  '--disable-backgrounding-occluded-windows',
  '--disable-renderer-backgrounding',
  '--mute-audio',
] as const;

/**
 * True when a display server is (or should be) available for a REAL,
 * visible Chromium window. macOS/Windows always have one; on Linux this
 * checks the env vars every windowing stack (X11 or Wayland) sets when a
 * session is present — the same signal tools like `xvfb-run` exist to
 * provide when there isn't a real one.
 */
export function isDisplayAvailable(env: NodeJS.ProcessEnv = process.env, platform: NodeJS.Platform = os.platform()): boolean {
  if (platform !== 'linux') return true;
  return Boolean(env.DISPLAY || env.WAYLAND_DISPLAY);
}

export interface ResolvedLaunchConfig {
  headless: boolean;
  args: string[];
  /** `null` for headed mode — see the section header above for why. */
  viewport: { width: number; height: number } | null;
}

/**
 * Pure function (no browser, no I/O) so it's cheaply unit-testable:
 * given the requested config, what should we actually pass to
 * `chromium.launch()`/`browser.newContext()`? Kept separate from
 * `initBrowserSession()` so headless/headed behavior can be verified
 * without spinning up a real Chromium process.
 */
export function resolveLaunchConfig(config: Pick<BrowserConfig, 'headless' | 'window_size' | 'window_position'>, isRoot: boolean): ResolvedLaunchConfig {
  const args: string[] = [];
  if (isRoot) args.push('--no-sandbox');
  args.push('--disable-dev-shm-usage');

  if (config.headless) {
    args.push(...HEADLESS_HARDENING_ARGS);
    const viewport = config.window_size ?? DEFAULT_HEADLESS_VIEWPORT;
    return { headless: true, args, viewport };
  }

  const windowSize = config.window_size ?? DEFAULT_HEADED_WINDOW_SIZE;
  args.push(`--window-size=${windowSize.width},${windowSize.height}`);
  if (config.window_position) {
    args.push(`--window-position=${config.window_position.x},${config.window_position.y}`);
  }
  // viewport: null is the whole point of headed mode here — it tells
  // Playwright to let the real OS window's client area drive page
  // dimensions instead of emulating a fixed device-metrics viewport
  // inside it, i.e. behave like an actual browser tab, not a headless
  // session wearing a window as a costume.
  return { headless: false, args, viewport: null };
}

export class BrowserServer {
  private browser: Browser | null = null;
  private context: BrowserContext | null = null;
  private page: Page | null = null;
  private injectScriptsList: string[] = [];
  private recordingSession: RecordingSession | null = null;
  private domSelectorMap: SelectorMap = {};
  /** True when the last DOM tree build hit its safety budget (very large/complex page). */
  private domTreeTruncated = false;

  /** Drop the current index->element mapping (called on navigation/tab-switch, same trigger as the old aria-ref snapshot clear). */
  private clearElementIndex(): void {
    this.domSelectorMap = {};
    this.domTreeTruncated = false;
  }

  // ── Live state (for WebBrowserPanel.tsx) ──
  private liveState: BrowserLiveState = { ...EMPTY_BROWSER_LIVE_STATE };
  // Plain Map instead of node:events' EventEmitter: a panel that
  // mounts/unmounts repeatedly over a long CLI session would otherwise risk
  // hitting EventEmitter's default max-listener warning (10) with nothing
  // actually leaking — a Map of subscribers has no such cap and makes the
  // add/remove lifecycle explicit.
  private liveStateSubscribers = new Map<number, (state: BrowserLiveState) => void>();
  private nextSubscriberId = 0;

  getLiveState(): BrowserLiveState {
    return this.liveState;
  }

  /** Subscribe to live-state changes. Returns an unsubscribe function. */
  onLiveStateChange(listener: (state: BrowserLiveState) => void): () => void {
    const id = this.nextSubscriberId++;
    this.liveStateSubscribers.set(id, listener);
    return () => {
      this.liveStateSubscribers.delete(id);
    };
  }

  private emitLiveState(): void {
    for (const listener of this.liveStateSubscribers.values()) {
      try {
        listener(this.liveState);
      } catch (e) {
        // One bad listener must not break the loop (and the rest of
        // refreshLiveState) — log and continue. Mirrors the safety net in
        // BrowserToolExecutor.notifySharedChange.
        logger.debug(`live-state listener threw: ${e}`);
      }
    }
  }

  /**
   * Refresh the cached live-state snapshot from the current page/tabs/
   * recording session and notify subscribers. Cheap (no screenshot) —
   * called after every state-changing operation. Never throws: a failure
   * here must not interrupt the calling operation.
   */
  private async refreshLiveState(opts: RefreshLiveStateOptions = {}): Promise<void> {
    const {
      errorText = null,
      lastOperation = null,
      isLoading = false,
      httpStatus = null,
      httpStatusText = null,
      autoSwitchedToNewTab = null,
      contentPreview = null,
    } = opts;
    const errorCategory = errorText ? classifyNetworkError(errorText).category : null;
    // Tri-state: null = preserve previous, true = set, false = clear.
    const nextAutoSwitched =
      autoSwitchedToNewTab === null
        ? this.liveState.autoSwitchedToNewTab
        : autoSwitchedToNewTab;

    try {
      if (!this.page || this.page.isClosed()) {
        // ROUND 8 FIX: this branch previously spread `...this.liveState`
        // without clearing `tabs`/`httpStatus`/`contentPreview`/etc. — after
        // close_all_tabs (or closing the literal last tab), the panel would
        // keep showing the now-closed tabs and stale status/preview from
        // before the browser went tab-less. `this.context` may still have
        // OTHER open pages even when `this.page` itself is null/closed (a
        // stale `this.page` reference specifically), so read the tab list
        // from the context when possible rather than always assuming zero.
        const tabs = this.context
          ? await Promise.all(
              this.context.pages().map(async (p) => ({
                tabId: this.tabId(p),
                title: await p.title().catch(() => ''),
                url: p.url(),
              })),
            )
          : [];
        this.liveState = {
          ...this.liveState,
          isInitialized: this.browser !== null,
          currentUrl: null,
          currentTitle: null,
          tabs,
          lastUpdated: Date.now(),
          lastError: errorText ?? this.liveState.lastError,
          lastOperation: lastOperation ?? this.liveState.lastOperation,
          isLoading,
          lastErrorCategory: errorText ? errorCategory : this.liveState.lastErrorCategory,
          autoSwitchedToNewTab: nextAutoSwitched,
          httpStatus: null,
          httpStatusText: null,
          possibleCaptcha: false,
          contentPreview: null,
        };
        this.emitLiveState();
        return;
      }

      const pages = this.page.context().pages();
      const tabs: BrowserTabState[] = await Promise.all(
        pages.map(async (p) => ({
          tabId: this.tabId(p),
          title: await p.title().catch(() => ''),
          url: p.url(),
        })),
      );
      const currentTitle = await this.page.title().catch(() => null);

      this.liveState = {
        isInitialized: true,
        currentUrl: this.page.url(),
        currentTitle,
        tabs,
        isRecording: this.isRecording,
        recordingEventCount: this.recordingSession?.totalEvents ?? 0,
        lastScreenshot: this.liveState.lastScreenshot,
        lastUpdated: Date.now(),
        lastError: errorText,
        lastOperation: lastOperation ?? this.liveState.lastOperation,
        isLoading,
        lastErrorCategory: errorCategory,
        // Preserve the previous httpStatus/httpStatusText/contentPreview
        // when this refresh wasn't itself a navigation (e.g. click/scroll/
        // get_state) — only navigate()/refresh()/goBack() pass a fresh
        // value; other ops don't know it and shouldn't blank it out.
        httpStatus: httpStatus !== null ? httpStatus : this.liveState.httpStatus,
        httpStatusText: httpStatusText !== null ? httpStatusText : this.liveState.httpStatusText,
        possibleCaptcha: detectPossibleCaptcha(currentTitle),
        autoSwitchedToNewTab: nextAutoSwitched,
        contentPreview: contentPreview !== null ? contentPreview : this.liveState.contentPreview,
      };
      this.emitLiveState();
    } catch (e) {
      logger.debug(`Live state refresh skipped: ${e}`);
    }
  }

  /**
   * Mark the panel's loading indicator on immediately (synchronous, no
   * async page reads) so navigation feels responsive even before the first
   * `refreshLiveState()` after the operation completes. Also clears any
   * stale HTTP status/captcha flag from the PREVIOUS page so the panel
   * doesn't show last page's status while the next one is still loading.
   */
  private setLoading(isLoading: boolean): void {
    this.liveState = {
      ...this.liveState,
      isLoading,
      ...(isLoading ? { httpStatus: null, httpStatusText: null, possibleCaptcha: false, contentPreview: null } : {}),
    };
    this.emitLiveState();
  }

  /**
   * On-demand screenshot capture for the panel. Not called automatically
   * (screenshots are comparatively expensive) — the UI layer decides when
   * to request one (e.g. on an idle timer or a manual refresh action).
   */
  async captureScreenshot(): Promise<string | null> {
    if (!this.page || this.page.isClosed()) return null;
    try {
      const buf = await this.page.screenshot({ type: 'png' });
      const data = buf.toString('base64');
      this.liveState = { ...this.liveState, lastScreenshot: data, lastUpdated: Date.now() };
      this.emitLiveState();
      return data;
    } catch (e) {
      logger.debug(`Screenshot capture failed: ${e}`);
      return null;
    }
  }

  // ── Session lifecycle (raw Playwright — no Stagehand) ──

  async initBrowserSession(config: BrowserConfig): Promise<void> {
    const isRoot = typeof process.getuid === 'function' && process.getuid() === 0;

    // HEADLESS/HEADED HARDENING: headless: false without a display server
    // used to fail several seconds into `chromium.launch()` with an opaque
    // Chromium-internal error (or, in some container setups, hang). Check
    // up front and fail fast with something actionable instead.
    if (!config.headless && !isDisplayAvailable()) {
      throw new Error(
        'headless: false requires a display server, and none was detected ' +
          '(no DISPLAY or WAYLAND_DISPLAY env var). Either set headless: true, ' +
          'or run this process under a virtual display, e.g. `xvfb-run -a <command>`.',
      );
    }

    const launchConfig = resolveLaunchConfig(config, isRoot);

    this.browser = await chromium.launch({
      headless: launchConfig.headless,
      executablePath: config.executable_path,
      args: launchConfig.args,
      // Chromium does NOT automatically read HTTP_PROXY/HTTPS_PROXY env vars
      // the way `curl`/most CLI tools do — it must be told explicitly. This
      // is the single most common reason "my shell has internet but the
      // browser tool doesn't" in a sandboxed/containerized environment: the
      // sandbox's egress path is a proxy that curl (via env var support in
      // libcurl) uses transparently, but a spawned Chromium subprocess
      // doesn't. See browserEngine.ts's `resolveProxyFromEnv()`.
      proxy: config.proxy
        ? { server: config.proxy.server, username: config.proxy.username, password: config.proxy.password, bypass: config.proxy.bypass }
        : undefined,
    });

    // `viewport: null` (headed mode) tells Playwright to size the page from
    // the real OS window instead of emulating a fixed device-metrics
    // viewport — see resolveLaunchConfig()'s doc comment.
    this.context = await this.browser.newContext({ viewport: launchConfig.viewport });

    // ISSUE 7 (carried over) + ROUND 7 new-tab tracking: the context-level
    // 'page' event fires for EVERY new page in this context — our own
    // intentional `context.newPage()` calls (navigate ..., newTab=true),
    // AND any page the site itself opens (target="_blank" links,
    // window.open(), form target=_blank submits). Previously only the
    // dialog/pageerror handlers were attached here; now we ALSO auto-focus
    // the new page as `this.page`, mirroring how a real browser switches
    // focus to a newly opened tab. This directly fixes the "sometimes a
    // click opens a new tab and the tool goes stale, sometimes it doesn't"
    // ambiguity from testing — the tool now always knows which happened
    // and which tab is "active", instead of silently continuing to operate
    // on a tab the user/agent can no longer see the point of.
    this.context.on('page', (page) => {
      page.on('dialog', async (dialog) => {
        logger.debug(`Auto-dismissing ${dialog.type()} dialog: ${dialog.message()}`);
        try {
          await dialog.dismiss();
        } catch (e) {
          logger.debug(`Dialog dismiss failed: ${e}`);
        }
      });
      page.on('pageerror', (error) => {
        logger.debug(`Page error: ${error.message}`);
      });

      if (page !== this.page) {
        this.page = page;
        this.clearElementIndex();
        // ROUND 10 FIX: previously passed lastOperation: 'new tab opened',
        // whose first word ("new") isn't a real action verb — the panel's
        // "Last Action: X()" formatting turned this into the nonsensical
        // "Last Action: new()" (confirmed in a screenshot). The
        // `autoSwitchedToNewTab` flag already communicates this event via
        // its own dedicated banner row — omitting lastOperation here lets
        // it correctly fall through to preserving whatever the REAL last
        // action was (e.g. "click [3]"), which is both more accurate and
        // avoids the double-signaling of the same event two different ways.
        //
        // Fire-and-forget: this handler can't be async (Playwright's 'page'
        // event doesn't await listeners), and a failure here must not
        // crash anything — refreshLiveState already swallows its own errors.
        void this.refreshLiveState({ autoSwitchedToNewTab: true });
      }
    });

    // BUG 2 FIX: allowed_domains was stored on BrowserConfig but never
    // enforced — a security gap where the tool claimed domain restriction
    // without applying it. Route-block anything outside the allowlist.
    if (config.allowed_domains && config.allowed_domains.length > 0) {
      const allowed = config.allowed_domains.map((d) => d.toLowerCase());
      await this.context.route('**/*', (route) => {
        const url = route.request().url();
        let hostname: string;
        try {
          hostname = new URL(url).hostname.toLowerCase();
        } catch {
          return route.abort();
        }
        const isAllowed = allowed.some((d) => hostname === d || hostname.endsWith(`.${d}`));
        if (isAllowed) return route.continue();
        return route.abort('blockedbyclient');
      });
    }

    this.page = await this.context.newPage();

    await this.refreshLiveState({ lastOperation: 'init' });
  }

  get isRecording(): boolean {
    return this.recordingSession !== null && this.recordingSession.isActive;
  }

  /**
   * Public accessor for the current page's URL, or null when no page is
   * open. BUG FIX: browserEngine.ts previously reached into `this.server.page`
   * directly (`this.server?.page?.url()`) — `page` is `private`, so that
   * compiled only because this project's Bun-based build transpiles
   * TypeScript without type-checking it; a real `tsc --noEmit` (as run by
   * this change's test harness) rejects it outright. This accessor is the
   * fix.
   */
  getCurrentUrl(): string | null {
    return this.page && !this.page.isClosed() ? this.page.url() : null;
  }

  private requirePage(): Page {
    if (!this.page) {
      // ROUND 8 FIX: distinguish "browser never launched" from "browser is
      // running but every tab was explicitly closed" (now reachable via
      // close_all_tabs / close_tab, see below) — the old single message
      // ("not initialized") was misleading for the latter, very recoverable
      // case.
      if (this.context) {
        throw new Error('No tabs are currently open. Call browser_navigate to open a new tab.');
      }
      throw new Error('Browser session not initialized');
    }
    // ISSUE 5 FIX: `this.page` can remain set to a page that was closed
    // (user closed the tab, browser crashed) — calling methods on it then
    // throws confusing raw Playwright errors instead of a clear message.
    if (this.page.isClosed()) {
      throw new Error('Browser page has been closed. Call browser_navigate to open a new page.');
    }
    return this.page;
  }

  /** Extract an httpStatus/httpStatusText pair from a goto()/reload() Response, if any. */
  private responseStatusFields(response: Response | null): { httpStatus: number | null; httpStatusText: string | null } {
    if (!response) return { httpStatus: null, httpStatusText: null };
    return { httpStatus: response.status(), httpStatusText: response.statusText() || null };
  }

  /** Throw a standard DOMException when the caller's AbortSignal has already fired. */
  private assertNotAborted(signal?: AbortSignal): void {
    if (signal?.aborted) {
      throw new DOMException('The operation was aborted.', 'AbortError');
    }
  }

  /** Bounded integer clamp with a fallback. Returns an integer in [min, max], defaulting to `fallback` for NaN/0. */
  private clampInt(value: number, min: number, max: number, fallback: number): number {
    const n = Math.trunc(value || fallback);
    return Math.max(min, Math.min(max, n));
  }

  /** Sanitize a user-supplied filename and ensure the requested extension is present. */
  private sanitizeFileName(input: string, extension: '.' | '.png' | '.pdf'): string {
    const safe = String(input ?? '').trim().replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, MAX_ARTIFACT_NAME_LENGTH);
    const stripped = safe.replace(/\.(png|pdf)$/i, '');
    return `${stripped}${extension}`;
  }

  /** Write an in-memory artifact (PNG/PDF) to the configured output directory. */
  private saveArtifact(buf: Buffer, requestedName: string, extension: '.png' | '.pdf'): string {
    ensureOutputDir();
    const safeName = this.sanitizeFileName(requestedName, extension);
    const filePath = path.join(BROWSER_RECORDING_OUTPUT_DIR, safeName);
    fs.writeFileSync(filePath, buf);
    return filePath;
  }

  // ── Navigation (Playwright direct) ──

  async navigate(url: string, newTab: boolean, signal?: AbortSignal): Promise<string> {
    this.assertNotAborted(signal);

    // BUG FIX: this guard used to run unconditionally before checking
    // whether a new page was even needed, so navigate() on an already-open
    // page refused to run if `this.context` was ever unset/lost for any
    // reason — even though a plain `page.goto()` on an existing page never
    // touches `this.context` at all. Scope the check to the ONE branch that
    // actually calls `this.context.newPage()`.
    //
    // ROUND 8 FIX: previously this branch only handled `newTab: true`, and
    // fell through to `requirePage()` otherwise — which THROWS if zero tabs
    // are open (now a normal, reachable state after close_all_tabs/
    // close_tab; see those methods). navigate() should always be able to
    // recover from a zero-tab state by opening a fresh page, exactly like
    // opening a new tab in a real browser when none exist yet.
    if (newTab || !this.page || this.page.isClosed()) {
      if (!this.context) throw new Error('Browser session not initialized');
      this.page = await this.context.newPage();
      // A fresh (blank) page shares no DOM with the previous one, so any
      // element index from the old DOM tree is meaningless.
      this.clearElementIndex();
    }
    const page = this.requirePage();
    this.setLoading(true);
    // ISSUE 6 FIX: page.goto() can throw (DNS failure, connection refused,
    // invalid URL, timeout) — wrap so the caller gets a clear message
    // instead of a raw Playwright error.
    try {
      const response = await page.goto(url, { waitUntil: 'domcontentloaded' });
      // New document: the element index from the previous page's DOM tree
      // no longer applies, so clear it. Click/type then fail fast with
      // "call browser_get_state first" instead of hunting stale indices.
      this.clearElementIndex();
      const { httpStatus, httpStatusText } = this.responseStatusFields(response);
      const contentPreview = await capturePreview(page);
      // refreshLiveState preserves the previous autoSwitchedToNewTab when
      // the caller doesn't override it — see RefreshLiveStateOptions. So we
      // no longer read it out and pass it back in: if the context-'page'
      // handler already set it (e.g. newTab navigation), this refresh keeps
      // it; otherwise it stays whatever it was before.
      await this.refreshLiveState({
        lastOperation: `navigate ${url}`,
        httpStatus,
        httpStatusText,
        contentPreview,
      });
      const statusNote = httpStatus !== null ? ` (${httpStatus}${httpStatusText ? ` ${httpStatusText}` : ''})` : '';
      return `Navigated to ${page.url()}${statusNote}`;
    } catch (e) {
      const message = errorMessage(e);
      const { hint } = classifyNetworkError(message);
      const fullMessage = hint ? `${message}\nHint: ${hint}` : message;
      await this.refreshLiveState({ errorText: fullMessage, lastOperation: `navigate ${url}` });
      return `Error navigating to ${url}: ${fullMessage}`;
    }
  }

  async goBack(signal?: AbortSignal): Promise<string> {
    this.assertNotAborted(signal);
    const page = this.requirePage();
    this.setLoading(true);
    try {
      const response = await page.goBack();
      // goBack can land on a different document, so stored refs may not
      // apply to the new one.
      this.clearElementIndex();
      const { httpStatus, httpStatusText } = this.responseStatusFields(response);
      const contentPreview = await capturePreview(page);
      await this.refreshLiveState({ lastOperation: 'go_back', httpStatus, httpStatusText, contentPreview });
      return `Navigated back to ${page.url()}`;
    } catch (e) {
      const message = errorMessage(e);
      const { hint } = classifyNetworkError(message);
      const fullMessage = hint ? `${message}\nHint: ${hint}` : message;
      await this.refreshLiveState({ errorText: fullMessage, lastOperation: 'go_back' });
      return `Error going back: ${fullMessage}`;
    }
  }

  // ISSUE 8: refresh/reload the current page (Playwright direct).
  async refresh(signal?: AbortSignal): Promise<string> {
    this.assertNotAborted(signal);
    const page = this.requirePage();
    this.setLoading(true);
    try {
      const response = await page.reload({ waitUntil: 'domcontentloaded' });
      // Reload produces a fresh document; refs captured before the reload
      // no longer apply.
      this.clearElementIndex();
      const { httpStatus, httpStatusText } = this.responseStatusFields(response);
      const contentPreview = await capturePreview(page);
      await this.refreshLiveState({ lastOperation: 'refresh', httpStatus, httpStatusText, contentPreview });
      return `Refreshed ${page.url()}`;
    } catch (e) {
      const message = errorMessage(e);
      const { hint } = classifyNetworkError(message);
      const fullMessage = hint ? `${message}\nHint: ${hint}` : message;
      await this.refreshLiveState({ errorText: fullMessage, lastOperation: 'refresh' });
      return `Error refreshing page: ${fullMessage}`;
    }
  }

  // ISSUE 9: wait for a fixed duration (Playwright direct).
  async wait(ms: number, signal?: AbortSignal): Promise<string> {
    this.assertNotAborted(signal);
    const page = this.requirePage();
    await page.waitForTimeout(ms);
    await this.refreshLiveState({ lastOperation: `wait ${ms}ms` });
    return `Waited ${ms}ms`;
  }

  // ISSUE 10: press a keyboard key not tied to a specific element (Playwright direct).
  async pressKey(key: string, signal?: AbortSignal): Promise<string> {
    this.assertNotAborted(signal);
    const page = this.requirePage();
    try {
      await page.keyboard.press(key);
      // A key press (e.g. Enter submitting a form) can trigger navigation.
      await this.refreshLiveState({ lastOperation: `press_key ${key}` });
      return `Pressed ${key}`;
    } catch (e) {
      return `Error pressing key ${key}: ${errorMessage(e)}`;
    }
  }

  /**
   * NEW ACTION: wait for a selector to reach a given state, instead of
   * polling with fixed `wait` calls. Zero LLM, single Playwright call
   * (`locator.waitFor()` already does the polling internally) — this is
   * strictly cheaper than the alternative pattern of `wait` + `get_state`
   * in a loop, and returns the moment the condition is met rather than
   * always burning the full duration.
   */
  async waitForElement(
    selector: string,
    state: 'visible' | 'hidden' | 'attached' | 'detached' = 'visible',
    timeoutMs: number = 10000,
    signal?: AbortSignal,
  ): Promise<string> {
    this.assertNotAborted(signal);
    const boundedSelector = String(selector ?? '').trim().slice(0, 2048);
    if (!boundedSelector) {
      return 'Error: Selector must not be empty.';
    }
    const boundedTimeout = this.clampInt(timeoutMs, 100, 60000, 10000);
    const page = this.requirePage();
    try {
      await page.locator(boundedSelector).first().waitFor({ state, timeout: boundedTimeout });
      await this.refreshLiveState({ lastOperation: `wait_for_element "${boundedSelector}" (${state})` });
      return `Element "${boundedSelector}" reached state "${state}"`;
    } catch (e) {
      const message = errorMessage(e);
      const hint = message.toLowerCase().includes('timeout')
        ? `\nHint: the element never reached "${state}" within ${boundedTimeout}ms. Double-check the selector with find_elements, or increase timeout_ms.`
        : '';
      return `Error waiting for "${boundedSelector}" to be "${state}": ${message}${hint}`;
    }
  }

  async sendKeys(keys: string, signal?: AbortSignal): Promise<string> {
    this.assertNotAborted(signal);
    const page = this.requirePage();
    const keyboard = page?.keyboard;
    if (!keyboard) {
      return 'Error: Keyboard input is not available on the current page.';
    }
    const bounded = String(keys ?? '');
    if (!bounded) {
      return 'Error: Keys must not be empty.';
    }
    try {
      await keyboard.press(bounded);
    } catch (e) {
      // Fallback: if the key combo/name is unrecognized, press each character
      // individually so sequences of plain text still work.
      const message = errorMessage(e);
      if (message.toLowerCase().includes('unknown key')) {
        try {
          for (const ch of bounded) {
            await keyboard.press(ch);
          }
        } catch (e2) {
          return `Error sending keys ${bounded}: ${e2 instanceof Error ? e2.message : String(e2)}`;
        }
      } else {
        return `Error sending keys ${bounded}: ${message}`;
      }
    }
    await this.refreshLiveState({ lastOperation: `send_keys ${bounded}` });
    return `Sent keys ${bounded}`;
  }

  async takeScreenshot(fileName?: string, signal?: AbortSignal): Promise<string> {
    this.assertNotAborted(signal);
    const page = this.page;
    if (!page || page.isClosed()) {
      return 'Error: No active page available for screenshot.';
    }
    try {
      const buf = await page.screenshot({ type: 'png' });
      const data = buf.toString('base64');
      if (fileName) {
        const filePath = this.saveArtifact(buf, fileName, '.png');
        await this.refreshLiveState({ lastOperation: `screenshot ${path.basename(filePath)}` });
        return `Saved screenshot to ${filePath}`;
      }
      this.liveState = { ...this.liveState, lastScreenshot: data };
      this.emitLiveState();
      await this.refreshLiveState({ lastOperation: 'screenshot' });
      return `data:image/png;base64,${data}`;
    } catch (e) {
      return `Error taking screenshot: ${errorMessage(e)}`;
    }
  }

  async getDropdownOptions(index: number, signal?: AbortSignal): Promise<string> {
    this.assertNotAborted(signal);
    const page = this.requirePage();
    const target = this.resolveTarget(page, index, undefined);
    if (target.kind === 'error') return target.message;
    try {
      const optionsJson = await (target.kind === 'selector'
        ? target.locator
        : this.locatorForNode(page, target.node)
      ).evaluate((el: HTMLElement) => {
        if (el.tagName === 'SELECT') {
          const opts = Array.from((el as HTMLSelectElement).options);
          return JSON.stringify(
            opts.map((o, i) => ({
              index: i,
              value: o.value,
              text: o.textContent?.trim() ?? '',
              selected: o.selected,
              disabled: o.disabled,
            })),
          );
        }
        const items = Array.from(
          el.querySelectorAll('[role="option"], [role="menuitem"]'),
        );
        return JSON.stringify(
          items.map((item, i) => ({
            index: i,
            value: item.getAttribute('data-value') ?? item.getAttribute('value') ?? '',
            text: (item.textContent ?? '').trim().slice(0, 200),
            selected: item.getAttribute('aria-selected') === 'true',
            disabled: item.getAttribute('aria-disabled') === 'true',
          })),
        );
      });
      const options = JSON.parse(optionsJson as string) as Array<{ index: number; value: string; text: string; selected: boolean; disabled: boolean }>;
      if (options.length === 0) {
        return 'Error: No dropdown options found for this element';
      }
      const lines = options.map((o) => `[${o.index}] value="${o.value}" text="${o.text}"${o.selected ? ' (selected)' : ''}${o.disabled ? ' (disabled)' : ''}`);
      await this.refreshLiveState({ lastOperation: `dropdown_options [${index}]` });
      return `${options.length} option(s):\n${lines.join('\n')}`;
    } catch (e) {
      return `Error getting dropdown options: ${errorMessage(e)}`;
    }
  }

  async selectDropdown(index: number, text: string, signal?: AbortSignal): Promise<string> {
    this.assertNotAborted(signal);
    const boundedText = String(text ?? '').trim();
    if (!boundedText) {
      return 'Error: Option text must not be empty.';
    }
    const page = this.requirePage();
    const target = this.resolveTarget(page, index, undefined);
    if (target.kind === 'error') return target.message;
    try {
      const locator = target.kind === 'selector'
        ? target.locator
        : this.locatorForNode(page, target.node);
      const matched = await locator.evaluate(
        (el: HTMLElement, t: string) => {
          if (el.tagName === 'SELECT') {
            const sel = el as HTMLSelectElement;
            for (const opt of Array.from(sel.options)) {
              if (
                opt.value === t ||
                (opt.textContent ?? '').trim() === t
              ) {
                sel.value = opt.value;
                sel.dispatchEvent(new Event('change', { bubbles: true }));
                sel.dispatchEvent(new Event('input', { bubbles: true }));
                return { found: true, value: opt.value, text: (opt.textContent ?? '').trim() };
              }
            }
            return { found: false };
          }
          const items = Array.from(
            el.querySelectorAll('[role="option"], [role="menuitem"]'),
          );
          for (const item of items) {
            const itemText = (item.textContent ?? '').trim();
            const itemValue = item.getAttribute('data-value') ?? item.getAttribute('value') ?? '';
            if (itemText === t || itemValue === t) {
              (item as HTMLElement).click();
              return { found: true, value: itemValue, text: itemText };
            }
          }
          return { found: false };
        },
        boundedText,
      );
      if (!matched || !(matched as { found: boolean }).found) {
        return `Error: Option '${boundedText}' not found in dropdown`;
      }
      const m = matched as { value: string; text: string };
      await this.refreshLiveState({ lastOperation: `select_dropdown [${index}] ${boundedText}` });
      return `Selected '${m.text}' (value="${m.value}")`;
    } catch (e) {
      return `Error selecting dropdown option: ${errorMessage(e)}`;
    }
  }

  async uploadFile(index: number, filePath: string, signal?: AbortSignal): Promise<string> {
    this.assertNotAborted(signal);
    const boundedPath = String(filePath ?? '').trim();
    if (!boundedPath) {
      return 'Error: File path must not be empty.';
    }
    // BUG FIX: this used to resolve the element (index/selector) BEFORE
    // checking the file existed locally, so a nonexistent file combined
    // with an as-yet-unresolved index surfaced "Invalid element index"
    // instead of the more fundamental, purely-local "File not found" —
    // and it did so only after already touching the DOM for no reason.
    // File existence is a cheap, page-independent check; do it first.
    if (!fs.existsSync(boundedPath)) {
      return `Error: File not found at ${boundedPath}`;
    }
    const page = this.requirePage();
    const target = this.resolveTarget(page, index, undefined);
    if (target.kind === 'error') return target.message;
    try {
      const locator = target.kind === 'selector' ? target.locator : this.locatorForNode(page, target.node);
      await locator.setInputFiles(boundedPath);
      const fileName = path.basename(boundedPath);
      await this.refreshLiveState({ lastOperation: `upload_file [${index}] ${fileName}` });
      return `Uploaded file '${fileName}' to [${index}]`;
    } catch (e) {
      // The fs.existsSync check above already catches the "file not found"
      // case up front; Playwright errors here are genuine upload failures.
      return `Error uploading file: ${errorMessage(e)}`;
    }
  }

  async searchGoogle(query: string, signal?: AbortSignal): Promise<string> {
    this.assertNotAborted(signal);
    const bounded = String(query ?? '').trim();
    if (!bounded) {
      return 'Error: Search query must not be empty.';
    }
    const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(bounded)}&udm=14`;
    return this.navigate(searchUrl, false);
  }

  async saveAsPdf(
    fileName?: string,
    printBackground = true,
    landscape = false,
    scale = 1.0,
    paperFormat = 'Letter',
    signal?: AbortSignal,
  ): Promise<string> {
    this.assertNotAborted(signal);
    const page = this.page;
    if (!page || page.isClosed()) {
      return 'Error: No active page available for save_as_pdf.';
    }
    const paperKey = String(paperFormat ?? 'Letter').toLowerCase();
    const paperSize = PAPER_SIZES[paperKey] ?? PAPER_SIZES.letter;
    try {
      const pdfBuf = await page.pdf({
        printBackground,
        landscape,
        scale: Math.max(0.1, Math.min(2.0, scale)),
        width: `${paperSize.width}in`,
        height: `${paperSize.height}in`,
        preferCSSPageSize: true,
      });
      let requestedName = String(fileName ?? '').trim();
      if (!requestedName) {
        try {
          requestedName = (await page.title()).replace(/[^\w\s-]+/g, '').trim().slice(0, 50) || 'page';
        } catch {
          requestedName = 'page';
        }
      }
      const filePath = this.saveArtifact(pdfBuf, requestedName, '.pdf');
      await this.refreshLiveState({ lastOperation: `save_as_pdf ${path.basename(filePath)}` });
      return `Saved PDF to ${filePath}`;
    } catch (e) {
      return `Error saving PDF: ${errorMessage(e)}`;
    }
  }

  // ── Click / Type (DOM-tree/highlight-index locators — deterministic, no LLM) ──

  /** Rebuild the interactive-element index from the CURRENT DOM. */
  private async refreshDomTree(
    page: Page,
    opts: { highlightElements?: boolean; focusElement?: number } = {},
  ): Promise<import('./domTypes.js').DOMState> {
    const { state, metadata } = await new DomService(page).getClickableElements({
      highlightElements: opts.highlightElements ?? false,
      focusElement: opts.focusElement ?? -1,
    });
    this.domSelectorMap = state.selector_map;
    this.domTreeTruncated = metadata.truncated;
    return state;
  }

  /**
   * REFRESH-STATE GLITCH FIX (carried over from the aria-ref system this
   * replaced): an element's xpath is stable for THAT element, but the
   * element an `index` points at is only as fresh as the last get_state —
   * anything that changes the DOM (a re-render, a toast disappearing) can
   * shift which element index K now refers to, even though the page didn't
   * navigate. When the first attempt fails, rebuild the DOM tree and re-run
   * the action at the same index. Returns true when the retry succeeded;
   * the caller reports the original error if not.
   */
  private async retryWithFreshIndex(
    page: Page,
    index: number,
    act: (freshNode: DOMElementNode) => Promise<unknown>,
  ): Promise<boolean> {
    try {
      await this.refreshDomTree(page);
      const freshNode = this.domSelectorMap[index];
      if (!freshNode) return false;
      await act(freshNode);
      return true;
    } catch {
      return false;
    }
  }

  private locatorForNode(page: Page, node: DOMElementNode): ReturnType<Page['locator']> {
    return page.locator(`xpath=${node.xpath}`);
  }

  /**
   * get_state's clickable-elements output shows each element as `[N]<tag
   * ...`, so a model that means "the element at index N" naturally
   * sometimes passes `selector: "[N]"` or `selector: "N"` instead of
   * `index: N`. Left alone, Playwright treats `[N]` as a (never-matching)
   * CSS attribute selector, and that guess times out silently for
   * `ELEMENT_TIMEOUT_MS` with no useful signal why — redirect it to the
   * index path instead, since it can be resolved with no ambiguity.
   *
   * A selector shaped like the OLD `[ref=eN]`/`aria-ref=eN` format (from
   * before this tool moved off Playwright's ariaSnapshot onto the DOM-tree
   * index) can no longer resolve to anything — fail fast with a clear
   * message instead of a bogus CSS-selector timeout.
   */
  private interpretSelector(
    selector: string,
  ): { kind: 'index'; index: number } | { kind: 'legacy-ref' } | { kind: 'css'; selector: string } {
    const trimmed = selector.trim();
    const indexLike = trimmed.match(/^\[?(\d+)\]?$/);
    if (indexLike) return { kind: 'index', index: Number(indexLike[1]) };
    const legacyRef = trimmed.match(/^\[?(?:aria-)?ref=(?:f\d+)?e\d+\]?$/i);
    if (legacyRef) return { kind: 'legacy-ref' };
    return { kind: 'css', selector: trimmed };
  }

  private resolveTarget(
    page: Page,
    index: number | undefined,
    rawSelector: string | undefined,
  ):
    | { kind: 'selector'; locator: ReturnType<Page['locator']>; label: string }
    | { kind: 'index'; node: DOMElementNode; index: number; label: string }
    | { kind: 'error'; message: string } {
    if (rawSelector) {
      const interpreted = this.interpretSelector(rawSelector);
      if (interpreted.kind === 'legacy-ref') {
        return {
          kind: 'error',
          message: `Error: "${rawSelector}" looks like a ref from an older version of this tool. Call browser_get_state again and use its \`index\` field instead.`,
        };
      }
      if (interpreted.kind === 'index') {
        const node = this.domSelectorMap[interpreted.index];
        if (!node) {
          return { kind: 'error', message: `Error: Invalid element index ${interpreted.index}. Call browser_get_state first.` };
        }
        return { kind: 'index', node, index: interpreted.index, label: `[${interpreted.index}]` };
      }
      return { kind: 'selector', locator: page.locator(interpreted.selector), label: `selector "${interpreted.selector}"` };
    }
    if (index === undefined) {
      return { kind: 'error', message: 'Error: Either `index` or `selector` must be provided.' };
    }
    const node = this.domSelectorMap[index];
    if (!node) {
      return { kind: 'error', message: `Error: Invalid element index ${index}. Call browser_get_state first.` };
    }
    return { kind: 'index', node, index, label: `[${index}]` };
  }

  async click(
    index: number | undefined,
    newTab: boolean,
    selector?: string,
    coordinateX?: number,
    coordinateY?: number,
    signal?: AbortSignal,
  ): Promise<string> {
    this.assertNotAborted(signal);
    const page = this.requirePage();

    // TASK 7: coordinate-based click fallback. When both coordinates are
    // provided and neither index nor selector is given, click at the
    // absolute page position via page.mouse.click(). Useful for canvases,
    // images, or any element not reachable via the element index/selector.
    const hasCoords = coordinateX !== undefined && coordinateY !== undefined;
    if (hasCoords && index === undefined && !selector) {
      if (!page.mouse?.click) {
        return 'Error: Unable to perform coordinate click on the current page.';
      }
      try {
        await page.mouse.click(coordinateX, coordinateY);
        await this.refreshLiveState({ lastOperation: `click coordinates (${coordinateX}, ${coordinateY})` });
        return `Clicked at coordinates (${coordinateX}, ${coordinateY})`;
      } catch (e) {
        const message = errorMessage(e);
        return `Error clicking at coordinates (${coordinateX}, ${coordinateY}): ${message}`;
      }
    }

    // If only one of coordinate_x/coordinate_y is provided, treat it as
    // a misuse rather than silently falling through to element-based click.
    if ((coordinateX !== undefined) !== (coordinateY !== undefined)) {
      return 'Error: Both coordinate_x and coordinate_y must be provided together.';
    }

    const target = this.resolveTarget(page, index, selector);
    if (target.kind === 'error') return target.message;

    if (newTab) {
      const locatorForHref = target.kind === 'selector' ? target.locator : this.locatorForNode(page, target.node);
      const href = await locatorForHref
        .first()
        .evaluate((el: any) => el.href)
        .catch(() => null);
      if (href) return this.navigate(href, true);
    }

    if (target.kind === 'selector') {
      try {
        await target.locator.click({ timeout: ELEMENT_TIMEOUT_MS });
      } catch (e) {
        const message = errorMessage(e);
        await this.refreshLiveState({ errorText: `click: ${message}`, lastOperation: `click ${target.label}` });
        return `Error clicking ${target.label}: ${message}`;
      }
      // The new-tab note reads the live state set by the context-'page'
      // handler (if any) BEFORE the refresh — the refresh itself
      // preserves that value rather than clobbering it.
      const newTabNote = this.liveState.autoSwitchedToNewTab ? ' — opened in a new tab, now active' : '';
      await this.refreshLiveState({ lastOperation: `click ${target.label}` });
      return `Clicked ${target.label}${newTabNote}`;
    }

    // index path — carries the stale-index self-healing retry. Use
    // `target.index` (not the outer `index` param) below: a `selector`
    // that turned out to be index-shaped (e.g. "[3]") resolves through
    // `target.index` while the outer `index` param stays `undefined`.
    const resolvedIndex = target.index;
    try {
      await this.locatorForNode(page, target.node).click({ timeout: ELEMENT_TIMEOUT_MS });
    } catch (e) {
      const staleMessage = errorMessage(e);
      if (await this.retryWithFreshIndex(page, resolvedIndex, (freshNode) => this.locatorForNode(page, freshNode).click({ timeout: ELEMENT_TIMEOUT_MS }))) {
        await this.refreshLiveState({ lastOperation: `click [${resolvedIndex}]` });
        return `Clicked [${resolvedIndex}] [retried after state refresh]`;
      }
      const hint = staleMessage.toLowerCase().includes('timeout')
        ? '\nHint: this index may be stale (the page changed since the last browser_get_state). Call browser_get_state again for a fresh index, then retry.'
        : '';
      await this.refreshLiveState({ errorText: `click: ${staleMessage}`, lastOperation: `click [${resolvedIndex}]` });
      return `Error clicking [${resolvedIndex}]: ${staleMessage}${hint}`;
    }

    // Click can trigger navigation, so refresh the live-state snapshot
    // (url/title/tabs) regardless of success/failure. If it opened a new
    // tab, the context-level 'page' handler's fire-and-forget
    // refreshLiveState() may ALREADY have run and set
    // `autoSwitchedToNewTab` — refreshLiveState preserves that value
    // (see RefreshLiveStateOptions) so we just read it once for the
    // return-text annotation. NOTE: this is inherently racy — the event
    // handler's async update might not have landed yet when we read it
    // here, in which case THIS call's return text won't mention the new
    // tab even though it happened. The panel doesn't have this problem
    // (it's driven by the live subscription, which will pick up the event
    // handler's update whenever it actually lands), so this is a
    // best-effort improvement to the return message, not a guarantee.
    const newTabNote = this.liveState.autoSwitchedToNewTab ? ' — opened in a new tab, now active' : '';
    await this.refreshLiveState({ lastOperation: `click [${resolvedIndex}]` });
    return `Clicked [${resolvedIndex}]${newTabNote}`;
  }

  async typeText(index: number | undefined, text: string, selector?: string, signal?: AbortSignal): Promise<string> {
    this.assertNotAborted(signal);
    const page = this.requirePage();
    const target = this.resolveTarget(page, index, selector);
    if (target.kind === 'error') return target.message;

    if (target.kind === 'selector') {
      try {
        await target.locator.fill(text, { timeout: ELEMENT_TIMEOUT_MS });
        await this.refreshLiveState({ lastOperation: `type ${target.label}` });
        return `Typed "${text}" into ${target.label}`;
      } catch (e) {
        const message = errorMessage(e);
        return `Error typing into ${target.label}: ${message}`;
      }
    }

    // index path — carries the stale-index self-healing retry. Use
    // `target.index` (not the outer `index` param) below — see click()'s
    // identical comment for why.
    const resolvedIndex = target.index;
    try {
      await this.locatorForNode(page, target.node).fill(text, { timeout: ELEMENT_TIMEOUT_MS });
      await this.refreshLiveState({ lastOperation: `type [${resolvedIndex}]` });
      return `Typed "${text}" into [${resolvedIndex}]`;
    } catch (e) {
      const staleMessage = errorMessage(e);
      if (await this.retryWithFreshIndex(page, resolvedIndex, (freshNode) => this.locatorForNode(page, freshNode).fill(text, { timeout: ELEMENT_TIMEOUT_MS }))) {
        await this.refreshLiveState({ lastOperation: `type [${resolvedIndex}]` });
        return `Typed "${text}" into [${resolvedIndex}] [retried after state refresh]`;
      }
      const hint = staleMessage.toLowerCase().includes('timeout')
        ? '\nHint: this index may be stale (the page changed since the last browser_get_state). Call browser_get_state again for a fresh index, then retry.'
        : '';
      return `Error typing into [${resolvedIndex}]: ${staleMessage}${hint}`;
    }
  }

  // ── Get State (DOM-tree/highlight-index system — deterministic, no LLM) ──

  private async getScrollMetadata(
    page: Page,
  ): Promise<{ pixelsAbove: number; pixelsBelow: number; viewportWidth: number; viewportHeight: number }> {
    try {
      const raw = await page.evaluate(() => ({
        scrollY: window.scrollY,
        viewportWidth: window.innerWidth,
        viewportHeight: window.innerHeight,
        scrollHeight: document.documentElement.scrollHeight,
      }));
      return {
        pixelsAbove: Math.round(raw.scrollY),
        pixelsBelow: Math.max(0, Math.round(raw.scrollHeight - raw.scrollY - raw.viewportHeight)),
        viewportWidth: Math.round(raw.viewportWidth),
        viewportHeight: Math.round(raw.viewportHeight),
      };
    } catch {
      return { pixelsAbove: 0, pixelsBelow: 0, viewportWidth: 0, viewportHeight: 0 };
    }
  }

  async getBrowserState(includeScreenshot: boolean, signal?: AbortSignal): Promise<string> {
    this.assertNotAborted(signal);
    const page = this.requirePage();

    // Only draw highlight overlays when we're about to screenshot them —
    // no reason to touch the page's DOM (even transiently, even just to
    // add/remove an overlay container) on a text-only get_state call.
    // Run the cheap evaluates in parallel with the DOM-tree build so their
    // wall-clock cost overlaps with it instead of being sequenced behind it.
    const [domState, scrollMeta, tabCount] = await Promise.all([
      this.refreshDomTree(page, { highlightElements: includeScreenshot }),
      this.getScrollMetadata(page),
      Promise.resolve(page.context().pages().length),
    ]);
    const elements = domState.llm_representation();
    const pagination = detectPaginationButtons(this.domSelectorMap);

    await this.refreshLiveState({ lastOperation: 'get_state' });

    // Additive envelope: `elements`/`url` are unchanged from the previous
    // aria-ref-based format, so existing callers that only read those two
    // fields see no change. `tabs_count`/`scroll`/`truncated*`/`pagination`
    // are new, cheap (one extra evaluate + a pure scan of the already-built
    // selector map — no additional page round trip) context that used to
    // require a separate list_tabs/scroll_to_text/find_elements call.
    const envelope: Record<string, unknown> = {
      elements,
      url: page.url(),
      tabs_count: tabCount,
      scroll: {
        pixels_above: scrollMeta.pixelsAbove,
        pixels_below: scrollMeta.pixelsBelow,
        viewport: `${scrollMeta.viewportWidth}x${scrollMeta.viewportHeight}`,
      },
    };
    if (this.domTreeTruncated) {
      envelope.truncated = true;
      envelope.truncated_note = 'This page is very large — the element list may be incomplete. Consider scrolling or narrowing your search with find_elements.';
    }
    if (pagination.length) {
      envelope.pagination = pagination.map((b) => ({ index: b.index, type: b.button_type, text: b.text, disabled: b.is_disabled }));
    }

    if (includeScreenshot) {
      try {
        const screenshot = await page.screenshot({ type: 'png' });
        envelope.screenshot = screenshot.toString('base64');
      } finally {
        // Highlight overlays are only useful for the screenshot we just
        // took — leave the live page as we found it.
        await new DomService(page).removeHighlights();
      }
    }
    return JSON.stringify(envelope, null, 2);
  }

  // ── Get Content (single-pass in-browser markdown-ish extraction — no LLM — + EXACT truncation logic from server.py) ──

  /**
   * Structure-aware content extraction: headings become `#`..`######`, list
   * items become `- `, links become `[text](href)`, code/pre become
   * fenced/backtick spans — evaluated in ONE page round trip (same
   * single-call philosophy as findElements/searchPage/the DOM tree
   * builder), with no new dependency (a `turndown`-based conversion was
   * considered — browser-use's own `markdown-extractor.ts` uses it — but
   * pulling in an HTML-to-markdown library is a bigger footprint change
   * than this tool's existing dependency-free, in-browser style, so this
   * ships a compact purpose-built walker instead). Replaces the previous
   * flat `page.innerText('body')` call; the extraction result flows into
   * the SAME truncation/stats/link-stripping pipeline below, unchanged.
   */
  private async extractMarkdownContent(page: Page): Promise<string> {
    return page.evaluate(() => {
      const SKIP_TAGS = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEMPLATE', 'SVG']);
      const BLOCK_TAGS = new Set([
        'P', 'DIV', 'SECTION', 'ARTICLE', 'HEADER', 'FOOTER', 'MAIN', 'ASIDE',
        'UL', 'OL', 'TABLE', 'TR', 'FORM', 'FIELDSET', 'BLOCKQUOTE', 'FIGURE',
        'HR', 'ADDRESS',
      ]);
      const HEADING_LEVEL: Record<string, number> = { H1: 1, H2: 2, H3: 3, H4: 4, H5: 5, H6: 6 };

      const isHidden = (el: Element): boolean => {
        if (!(el instanceof HTMLElement)) return false;
        if (el.hidden) return true;
        if (el.getAttribute('aria-hidden') === 'true') return true;
        const style = window.getComputedStyle(el);
        return style.display === 'none' || style.visibility === 'hidden';
      };

      const out: string[] = [];
      let lastWasBreak = true;
      const emit = (text: string) => {
        if (!text) return;
        out.push(text);
        lastWasBreak = /\n$/.test(text);
      };
      const breakParagraph = () => {
        if (!lastWasBreak) emit('\n\n');
      };

      const walk = (node: Node) => {
        if (node.nodeType === Node.TEXT_NODE) {
          const text = (node.textContent ?? '').replace(/\s+/g, ' ');
          if (text.trim()) emit(text);
          return;
        }
        if (node.nodeType !== Node.ELEMENT_NODE) return;
        const el = node as Element;
        if (SKIP_TAGS.has(el.tagName) || isHidden(el)) return;

        if (el.tagName === 'BR') {
          emit('\n');
          return;
        }
        if (HEADING_LEVEL[el.tagName]) {
          breakParagraph();
          emit(`${'#'.repeat(HEADING_LEVEL[el.tagName])} ${(el.textContent ?? '').trim()}`);
          emit('\n\n');
          lastWasBreak = true;
          return;
        }
        if (el.tagName === 'LI') {
          breakParagraph();
          emit('- ');
          for (const child of Array.from(el.childNodes)) walk(child);
          emit('\n');
          return;
        }
        if (el.tagName === 'A' && el.hasAttribute('href')) {
          const text = (el.textContent ?? '').trim();
          const href = el.getAttribute('href') ?? '';
          if (text && href && !href.startsWith('javascript:')) {
            emit(`[${text}](${href})`);
          } else if (text) {
            emit(text);
          }
          return;
        }
        if (el.tagName === 'PRE') {
          breakParagraph();
          emit('```\n' + (el.textContent ?? '').replace(/\s+$/, '') + '\n```');
          emit('\n\n');
          lastWasBreak = true;
          return;
        }
        if (el.tagName === 'CODE' && el.parentElement?.tagName !== 'PRE') {
          emit('`' + (el.textContent ?? '').trim() + '`');
          return;
        }
        if (el.tagName === 'IMG') {
          const alt = el.getAttribute('alt');
          if (alt) emit(`[image: ${alt}]`);
          return;
        }

        if (BLOCK_TAGS.has(el.tagName)) breakParagraph();
        for (const child of Array.from(el.childNodes)) walk(child);
        if (BLOCK_TAGS.has(el.tagName)) breakParagraph();
      };

      walk(document.body);
      return out
        .join('')
        .replace(/[ \t]+\n/g, '\n')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
    });
  }

  async getContent(extractLinks: boolean, startFromChar: number, signal?: AbortSignal): Promise<string> {
    this.assertNotAborted(signal);
    const page = this.requirePage();
    await this.refreshLiveState({ lastOperation: 'get_content' });

    let content: string;
    try {
      content = await this.extractMarkdownContent(page);
    } catch (e) {
      return `Could not extract content from page: ${errorMessage(e)}`;
    }

    // ENHANCEMENT 3: an empty page would otherwise flow through as a
    // content_stats block full of zeros.
    if (!content || content.trim().length === 0) {
      return `<url>\n${page.url()}\n</url>\n<content>\n<content_stats>\nNo content could be extracted from this page.\n</content_stats>\n</content>`;
    }

    const originalHtmlLength = (await page.content()).length;
    const initialMarkdownLength = content.length;

    // BUG 3 FIX (carried over): when extractLinks is false, strip markdown
    // links. Applied right after extraction, before start_from_char/
    // truncation, so pagination offsets are computed against the already-
    // filtered content.
    let charsFiltered = 0;
    if (!extractLinks) {
      const beforeLen = content.length;
      content = content.replace(/\[([^\]]*)\]\([^)]*\)/g, '$1');
      charsFiltered = beforeLen - content.length;
    }

    if (startFromChar > 0) {
      if (startFromChar >= content.length) {
        return `start_from_char (${startFromChar}) exceeds content length (${content.length}). Content has ${initialMarkdownLength} characters after filtering.`;
      }
      content = content.slice(startFromChar);
    }

    let truncated = false;
    let nextStart = 0;
    let truncateAt = MAX_CHAR_LIMIT;

    if (content.length > MAX_CHAR_LIMIT) {
      // Look for a paragraph break in the last TRUNCATE_PARAGRAPH_LOOKBACK_CHARS
      // of the limit window, then fall back to a sentence break in the last
      // TRUNCATE_SENTENCE_LOOKBACK_CHARS, matching the Python server.
      const paragraphWindowStart = Math.max(0, MAX_CHAR_LIMIT - TRUNCATE_PARAGRAPH_LOOKBACK_CHARS);
      const paragraphBreak = content.lastIndexOf('\n\n', MAX_CHAR_LIMIT);
      if (paragraphBreak >= paragraphWindowStart && paragraphBreak < MAX_CHAR_LIMIT) {
        truncateAt = paragraphBreak;
      } else {
        const sentenceWindowStart = Math.max(0, MAX_CHAR_LIMIT - TRUNCATE_SENTENCE_LOOKBACK_CHARS);
        const sentenceBreak = content.lastIndexOf('.', MAX_CHAR_LIMIT);
        if (sentenceBreak >= sentenceWindowStart && sentenceBreak < MAX_CHAR_LIMIT) {
          truncateAt = sentenceBreak + 1;
        }
      }
      content = content.slice(0, truncateAt);
      truncated = true;
      nextStart = (startFromChar || 0) + truncateAt;
    }

    const finalFilteredLength = content.length;
    let statsSummary =
      `Content processed: ${originalHtmlLength.toLocaleString()} HTML chars → ` +
      `${initialMarkdownLength.toLocaleString()} initial markdown → ` +
      `${finalFilteredLength.toLocaleString()} filtered markdown`;
    if (startFromChar > 0) statsSummary += ` (started from char ${startFromChar.toLocaleString()})`;
    if (truncated) {
      statsSummary += ` → ${content.length.toLocaleString()} final chars (truncated, use start_from_char=${nextStart} to continue)`;
    } else if (charsFiltered > 0) {
      statsSummary += ` (filtered ${charsFiltered.toLocaleString()} chars of noise)`;
    }

    const currentUrl = page.url();

    return `<url>\n${currentUrl}\n</url>\n<content>\n<content_stats>\n${statsSummary}\n</content_stats>\n\n<webpage_content>\n${content}\n</webpage_content>\n</content>`;
  }

  // ── Scroll (Playwright direct) ──

  async scroll(direction: 'up' | 'down', signal?: AbortSignal): Promise<string> {
    this.assertNotAborted(signal);
    const page = this.requirePage();
    await page.evaluate((dir: 'up' | 'down') => {
      window.scrollBy(0, dir === 'down' ? window.innerHeight : -window.innerHeight);
    }, direction);
    await this.refreshLiveState({ lastOperation: `scroll ${direction}` });
    return `Scrolled ${direction}`;
  }

  async scrollToText(text: string, direction: 'up' | 'down', signal?: AbortSignal): Promise<string> {
    this.assertNotAborted(signal);
    const page = this.requirePage();
    if (!page.evaluate) {
      return 'Error: Unable to access page for scrolling.';
    }
    const boundedText = String(text).slice(0, MAX_SCROLL_TEXT_QUERY_CHARS);
    if (!boundedText) {
      return 'Error: Text to scroll to must not be empty.';
    }
    try {
      const rawResult = await page.evaluate(buildScrollToTextExpression(boundedText, direction));
      const result: ScrollToTextPageResult =
        rawResult && typeof rawResult === 'object'
          ? (rawResult as ScrollToTextPageResult)
          : { found: rawResult === true, truncated: false, visitedNodes: 0, scannedChars: 0 };
      if (!result.found) {
        const suffix = result.truncated ? ' before the bounded page scan reached its safety limit' : '';
        return `Error: Text '${boundedText}' not found on page${suffix}`;
      }
      await this.refreshLiveState({ lastOperation: `scroll_to_text ${boundedText}` });
      return `Scrolled to text '${boundedText}'`;
    } catch (e) {
      const message = errorMessage(e);
      return `Error scrolling to text: ${message}`;
    }
  }

  async evaluate(code: string, signal?: AbortSignal): Promise<string> {
    this.assertNotAborted(signal);
    const page = this.requirePage();
    if (!page.evaluate) {
      return 'Error: Unable to access page for evaluate.';
    }
    const trimmed = String(code ?? '').trim();
    if (!trimmed) {
      return 'Error: Code to evaluate must not be empty.';
    }
    const MAX_RESULT_CHARS = 20_000;
    try {
      const rawResult = await page.evaluate((src: string) => {
        try {
          // eslint-disable-next-line no-eval
          return { ok: true, value: (0, eval)(src) };
        } catch (err) {
          return { ok: false, error: err instanceof Error ? err.message : String(err) };
        }
      }, code);
      if (rawResult && typeof rawResult === 'object' && 'ok' in rawResult) {
        const r = rawResult as { ok: boolean; value?: unknown; error?: string };
        if (!r.ok) {
          return `Error evaluating code: ${r.error ?? 'unknown error'}`;
        }
        let serialized: string;
        if (r.value === undefined) serialized = 'undefined';
        else if (typeof r.value === 'string') serialized = r.value;
        else {
          try {
            serialized = JSON.stringify(r.value);
          } catch {
            serialized = '[Unserializable value]';
          }
        }
        if (serialized.length > MAX_RESULT_CHARS) {
          serialized = `${serialized.slice(0, MAX_RESULT_CHARS)}\n... (truncated, ${serialized.length} total chars)`;
        }
        await this.refreshLiveState({ lastOperation: 'evaluate' });
        return serialized;
      }
      return `Error: Unexpected evaluate result shape`;
    } catch (e) {
      const message = errorMessage(e);
      return `Error evaluating code: ${message}`;
    }
  }

  async findElements(
    selector: string,
    attributes?: string[],
    maxResults: number = 50,
    includeText: boolean = true,
    signal?: AbortSignal,
  ): Promise<string> {
    this.assertNotAborted(signal);
    const page = this.requirePage();
    // BUG FIX: this used to check `!page.evaluate` before validating that
    // `selector` was non-empty, so an empty-selector call surfaced the
    // generic "unable to access page" message instead of the specific,
    // actionable "selector must not be empty" — validate the cheap,
    // page-independent input first.
    const boundedSelector = String(selector ?? '').slice(0, 2048);
    if (!boundedSelector) {
      return 'Error: Selector must not be empty.';
    }
    if (!page.evaluate) {
      return 'Error: Unable to access page for find_elements.';
    }
    const boundedMax = this.clampInt(maxResults, 1, 100, 50);
    const attrAllow = attributes && attributes.length > 0 ? new Set(attributes) : null;
    try {
      // Single round-trip: count + per-node extraction + slice in one evaluate.
      // Each node is visited once with the work it actually needs; attribute
      // filter is applied at construction so we never ship unfiltered attrs
      // back to Node.
      const payload = await page.evaluate(
        ({ sel, max, wantText, allowAttrs }) => {
          const allow = allowAttrs && allowAttrs.length > 0 ? new Set(allowAttrs) : null;
          const all = document.querySelectorAll(sel);
          const total = all.length;
          const nodes = Array.from(all).slice(0, max);
          const elements = nodes.map((node, i) => {
            const tag = node.tagName.toLowerCase();
            const text = node.children.length === 0 ? (node.textContent ?? '').trim() : '';
            const attrs: Record<string, string> = {};
            for (const attr of Array.from(node.attributes)) {
              if (!allow || allow.has(attr.name)) {
                attrs[attr.name] = attr.value;
              }
            }
            return {
              index: i,
              tag,
              ...(wantText ? { text: text.slice(0, 500) } : {}),
              attributes: attrs,
            };
          });
          return { total, truncated: total > max, elements };
        },
        { sel: boundedSelector, max: boundedMax, wantText: includeText, allowAttrs: attrAllow ? Array.from(attrAllow) : null },
      );
      const result = { total: payload.total, returned: payload.elements.length, truncated: payload.truncated, elements: payload.elements };
      await this.refreshLiveState({ lastOperation: `find_elements ${boundedSelector}` });
      return JSON.stringify(result, null, 2);
    } catch (e) {
      const message = errorMessage(e);
      return `Error finding elements: ${message}`;
    }
  }

  async searchPage(
    pattern: string,
    regex: boolean = false,
    caseSensitive: boolean = false,
    contextChars: number = 150,
    cssScope?: string,
    maxResults: number = 25,
    signal?: AbortSignal,
  ): Promise<string> {
    this.assertNotAborted(signal);
    const page = this.requirePage();
    if (!page.evaluate) {
      return 'Error: Unable to access page for search_page.';
    }
    const boundedPattern = String(pattern ?? '').slice(0, 1000);
    if (!boundedPattern) {
      return 'Error: Pattern must not be empty.';
    }
    const boundedMax = this.clampInt(maxResults, 1, 100, 25);
    const boundedContext = this.clampInt(contextChars, 0, 2000, 150);
    try {
      const rawResult = await page.evaluate(
        ({ pat, isRegex, caseSens, ctx, scope, max }) => {
          const skippedTags = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEMPLATE']);
          const root = scope ? document.querySelector(scope) : document.body;
          if (scope && !root) return { error: `CSS scope not found: ${scope}`, matches: [] };
          if (!root) return { error: 'No document body', matches: [] };
          type Hit = { index: number; length: number };
          let findHits: (text: string) => Hit[];
          if (isRegex) {
            let re: RegExp;
            try {
              re = new RegExp(pat, caseSens ? 'g' : 'gi');
            } catch (e) {
              return { error: `Invalid regex: ${String(e).slice(0, 500)}`, matches: [] };
            }
            // matchAll on a fresh RegExp per call avoids lastIndex state from
            // shared global regexes.
            findHits = (text) => {
              const out: Hit[] = [];
              for (const m of text.matchAll(re)) {
                if (m.index === undefined) continue;
                out.push({ index: m.index, length: m[0].length });
              }
              return out;
            };
          } else {
            const needle = caseSens ? pat : pat.toLowerCase();
            const matchLen = pat.length;
            findHits = (text) => {
              const hay = caseSens ? text : text.toLowerCase();
              const out: Hit[] = [];
              let idx = hay.indexOf(needle);
              while (idx >= 0) {
                out.push({ index: idx, length: matchLen });
                idx = hay.indexOf(needle, idx + matchLen);
              }
              return out;
            };
          }
          const isVisible = (n: Node): boolean => {
            const el = n.parentElement;
            if (!el) return true;
            return el.offsetParent !== null || getComputedStyle(el).visibility !== 'hidden';
          };
          const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
            acceptNode: (n) => (isVisible(n) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT),
          });
          const matches: Array<{ context: string; offset: number }> = [];
          let node = walker.nextNode();
          while (node && matches.length < max) {
            const parent = node.parentElement;
            if (parent && !skippedTags.has(parent.tagName)) {
              const text = node.nodeValue ?? '';
              for (const hit of findHits(text)) {
                if (matches.length >= max) break;
                const start = Math.max(0, hit.index - ctx);
                const end = Math.min(text.length, hit.index + hit.length + ctx);
                matches.push({ context: text.slice(start, end), offset: hit.index });
              }
            }
            node = walker.nextNode();
          }
          return { matches };
        },
        { pat: boundedPattern, isRegex: regex, caseSens: caseSensitive, ctx: boundedContext, scope: cssScope ?? null, max: boundedMax },
      );
      if (rawResult && typeof rawResult === 'object' && 'error' in rawResult && (rawResult as { error: string }).error) {
        return `Error searching page: ${(rawResult as { error: string }).error}`;
      }
      const matches = (rawResult as { matches: Array<{ context: string; offset: number }> })?.matches ?? [];
      if (matches.length === 0) {
        return `No matches found for pattern '${boundedPattern}'`;
      }
      const lines = matches.map((m, i) => `[${i}] ...${m.context}...`);
      await this.refreshLiveState({ lastOperation: `search_page ${boundedPattern}` });
      return `${matches.length} match(es):\n${lines.join('\n')}`;
    } catch (e) {
      const message = errorMessage(e);
      return `Error searching page: ${message}`;
    }
  }

  // ── Tab management (Playwright direct) ──

  /** Deterministic 4-char tab id derived from Playwright's internal page GUID when available. */
  private tabId(page: Page): string {
    const guid = (page as any)._guid as string | undefined;
    const seed = guid ?? page.url();
    let hash = 0;
    for (let i = 0; i < seed.length; i++) {
      hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
    }
    return hash.toString(16).padStart(4, '0').slice(0, 4);
  }

  async listTabs(signal?: AbortSignal): Promise<string> {
    this.assertNotAborted(signal);
    const pages = this.requirePage().context().pages();
    // BUG 1 FIX: second field was `p.url()` twice; should be the page title.
    // Format: tabId | title | url (matches the OpenHands pattern).
    const rows = await Promise.all(
      pages.map(async (p) => {
        const title = await p.title().catch(() => '');
        return `${this.tabId(p)} | ${title} | ${p.url()}`;
      }),
    );
    await this.refreshLiveState({ lastOperation: 'list_tabs' });
    return `Open tabs:\n${rows.join('\n')}`;
  }

  async switchTab(tabId: string, signal?: AbortSignal): Promise<string> {
    this.assertNotAborted(signal);
    const pages = this.requirePage().context().pages();
    const target = pages.find((p) => this.tabId(p) === tabId);
    if (!target) return `Error: Tab ${tabId} not found`;
    const targetUrl = target.url();
    this.page = target;
    await target.bringToFront();
    await this.refreshLiveState({ lastOperation: `switch_tab ${tabId} ${targetUrl}` });
    return `Switched to tab ${tabId}`;
  }

  async closeTab(tabId: string, signal?: AbortSignal): Promise<string> {
    this.assertNotAborted(signal);
    const pages = this.requirePage().context().pages();
    const target = pages.find((p) => this.tabId(p) === tabId);
    if (!target) return `Error: Tab ${tabId} not found`;
    const targetUrl = target.url();
    // ROUND 8 FIX: previously refused to close the last remaining tab.
    // Now that navigate()/requirePage() both handle a genuine zero-tab
    // state gracefully (see round 8 fixes above), there's no correctness
    // reason left to forbid it — closing the last tab now really does
    // leave zero tabs open, same as close_all_tabs, and the next
    // browser_navigate call recovers cleanly either way.
    await target.close();
    if (this.page === target) {
      const remaining = pages.filter((p) => p !== target);
      this.page = remaining[0] ?? null;
      if (!this.page) this.clearElementIndex();
    }
    await this.refreshLiveState({ lastOperation: `close_tab ${tabId} ${targetUrl}` });
    const remainingCount = pages.length - 1;
    return remainingCount === 0
      ? `Closed tab ${tabId}. No tabs remain open — call browser_navigate to open a new one.`
      : `Closed tab ${tabId}`;
  }

  /**
   * LOG.MD (round 7) deadlock fix, refined in round 8: closes every page in
   * the context UNCONDITIONALLY, including the last one, leaving ZERO tabs
   * open (previously auto-reopened one blank tab, which the round 8 E2E
   * report flagged as unwanted — "remaining zero tabs" was the explicit
   * ask). Safe now that navigate()/requirePage() both handle a zero-tab
   * state as a normal, recoverable condition rather than an error.
   */
  async closeAllTabs(signal?: AbortSignal): Promise<string> {
    this.assertNotAborted(signal);
    if (!this.context) return 'Error: No browser session active';
    const pages = this.context.pages();
    const count = pages.length;
    for (const p of pages) {
      await p.close().catch(() => {});
    }
    this.page = null;
    this.clearElementIndex();
    await this.refreshLiveState({ lastOperation: 'close_all_tabs' });
    return `Closed ${count} tab(s). No tabs remain open — call browser_navigate to open a new one.`;
  }

  // ── Storage (Playwright + CDP — ported EXACTLY from server.py) ──

  async getStorage(signal?: AbortSignal): Promise<string> {
    this.assertNotAborted(signal);
    try {
      const context = this.requirePage().context();
      const storageState = await context.storageState();
      await this.refreshLiveState({ lastOperation: 'get_storage' });
      return JSON.stringify(storageState, null, 2);
    } catch (e) {
      return `Error getting storage state: ${e}`;
    }
  }

  async setStorage(storageState: { cookies: any[]; origins: any[] }, signal?: AbortSignal): Promise<string> {
    this.assertNotAborted(signal);
    try {
      const page = this.requirePage();
      const context = page.context();

      const cookies = storageState.cookies ?? [];
      if (cookies.length) {
        await context.addCookies(cookies);
      }

      const origins = storageState.origins ?? [];
      if (origins.length) {
        const cdp = await context.newCDPSession(page);
        await cdp.send('DOMStorage.enable');

        try {
          for (const originData of origins) {
            const origin = originData.origin;
            if (!origin) continue;

            for (const item of originData.localStorage ?? []) {
              const key = item.key ?? item.name;
              if (!key) continue;
              await cdp.send('DOMStorage.setDOMStorageItem', {
                storageId: { securityOrigin: origin, isLocalStorage: true },
                key,
                value: item.value,
              });
            }

            for (const item of originData.sessionStorage ?? []) {
              const key = item.key ?? item.name;
              if (!key) continue;
              await cdp.send('DOMStorage.setDOMStorageItem', {
                storageId: { securityOrigin: origin, isLocalStorage: false },
                key,
                value: item.value,
              });
            }
          }
        } finally {
          await cdp.send('DOMStorage.disable');
        }
      }

      await this.refreshLiveState({ lastOperation: 'set_storage' });
      return 'Storage set successfully';
    } catch (e) {
      return `Error setting storage state: ${e}`;
    }
  }

  // ── Recording (delegates to RecordingSession) ──

  async startRecording(outputDir?: string, signal?: AbortSignal): Promise<string> {
    this.assertNotAborted(signal);
    if (!this.page) return 'Error: No browser session active';
    this.recordingSession = new RecordingSession(outputDir ?? null);
    const result = await this.recordingSession.start(this.page);
    await this.refreshLiveState({ lastOperation: 'start_recording' });
    return result;
  }

  async stopRecording(signal?: AbortSignal): Promise<string> {
    this.assertNotAborted(signal);
    if (!this.page) return 'Error: No browser session active';
    if (!this.recordingSession || !this.recordingSession.isActive) {
      return 'Error: Not recording. Call browser_start_recording first.';
    }
    const result = await this.recordingSession.stop(this.page);
    this.recordingSession.reset();
    this.recordingSession = null;
    await this.refreshLiveState({ lastOperation: 'stop_recording' });
    return result;
  }

  async flushRecordingEvents(): Promise<number> {
    if (!this.page || !this.recordingSession) return 0;
    return this.recordingSession.flushEvents(this.page);
  }

  async restartRecordingOnNewPage(): Promise<void> {
    if (!this.page || !this.recordingSession) return;
    await this.recordingSession.restartOnNewPage(this.page);
  }

  async cleanupRecording(): Promise<void> {
    if (!this.recordingSession) return;
    try {
      if (this.recordingSession.isActive && this.page) {
        await this.recordingSession.stop(this.page);
      } else {
        this.recordingSession.reset();
      }
    } catch (e) {
      // Non-fatal, matches Python's `logger.debug(...)` on recording cleanup.
    }
    this.recordingSession = null;
  }

  // ── Script injection (ported from server.py _inject_scripts_to_session) ──

  setInjectScripts(scripts: string[]): void {
    this.injectScriptsList = scripts;
  }

  async injectScriptsToSession(): Promise<void> {
    if (!this.page || !this.injectScriptsList.length) return;
    try {
      const cdp = await this.page.context().newCDPSession(this.page);
      for (const script of this.injectScriptsList) {
        await cdp.send('Page.addScriptToEvaluateOnNewDocument', { source: script, runImmediately: true });
      }
    } catch {
      // Matches Python's `logger.warning(...)` — script injection is best-effort.
    }
  }

  // ── Lifecycle ──

  async closeBrowser(): Promise<string> {
    await this.cleanupRecording();
    if (this.page) {
      await this.page.close().catch(() => {});
      this.page = null;
    }
    if (this.context) {
      await this.context.close().catch(() => {});
      this.context = null;
    }
    if (this.browser) {
      await this.browser.close().catch(() => {});
      this.browser = null;
    }
    this.liveState = { ...EMPTY_BROWSER_LIVE_STATE };
    this.emitLiveState();
    return 'Browser closed';
  }
}
