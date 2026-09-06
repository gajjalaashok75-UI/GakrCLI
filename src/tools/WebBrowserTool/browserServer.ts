/**
 * BrowserServer — 100% Playwright wrapper (Stagehand fully removed).
 *
 * LAYER 1 — GakrCLI-AGNOSTIC. Ported from server.py (340 lines), with every
 * `browser_use` call replaced per the architecture decision:
 *   - navigate/back/scroll/tabs/storage      -> Playwright directly
 *   - click/type/get_state                   -> Playwright's ariaSnapshot({mode:'ai'})
 *                                                + page.locator('aria-ref=...') — NO LLM
 *   - get_content                            -> page.innerText('body') — NO LLM
 *   - recording/set_storage DOMStorage       -> CDP directly (same commands as Python)
 *
 * ARCHITECTURE CHANGE (earlier revision): @browserbase/stagehand is REMOVED.
 * Playwright's own `page.ariaSnapshot({ mode: 'ai' })` generates an
 * accessibility-tree-with-refs output deterministically, with zero LLM
 * involvement — the same approach Microsoft's official Playwright MCP
 * server uses. Refs look like `[ref=e3]` (main frame) or `[ref=f1e3]`
 * (element 3 inside iframe 1) and resolve back to a Locator via
 * `page.locator('aria-ref=e3')`.
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
import path from 'node:path';
import { chromium, type Browser, type BrowserContext, type Page, type Response } from 'playwright';
import { RecordingSession } from './recording.js';
import { RefManager } from './refManager.js';
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

// How long to wait for an aria-ref locator before giving up. Playwright's
// default is 30s; a stale ref (page changed since the last get_state)
// otherwise hangs the tool for half a minute. The self-healing retry in
// click/typeText re-snapshots the current DOM and retries once before
// surfacing the timeout.
const ARIA_REF_TIMEOUT_MS = 10000;

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
  autoSwitchedToNewTab?: boolean;
  contentPreview?: string | null;
}

/** Best-effort ≤300-char plain-text excerpt for the panel's preview row. Never throws. */
async function capturePreview(page: Page): Promise<string | null> {
  try {
    const text = (await page.innerText('body')).trim().replace(/\s+/g, ' ');
    if (!text) return null;
    return text.length > 300 ? `${text.slice(0, 299)}…` : text;
  } catch {
    return null;
  }
}

export class BrowserServer {
  private browser: Browser | null = null;
  private context: BrowserContext | null = null;
  private page: Page | null = null;
  private injectScriptsList: string[] = [];
  private recordingSession: RecordingSession | null = null;
  private refManager = new RefManager();

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
      listener(this.liveState);
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
      autoSwitchedToNewTab = false,
      contentPreview = null,
    } = opts;
    const errorCategory = errorText ? classifyNetworkError(errorText).category : null;

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
          autoSwitchedToNewTab,
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
        autoSwitchedToNewTab,
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

    this.browser = await chromium.launch({
      headless: config.headless,
      executablePath: config.executable_path,
      args: [...(isRoot ? ['--no-sandbox'] : []), '--disable-dev-shm-usage'],
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

    this.context = await this.browser.newContext();

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
        this.refManager.clear();
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

  /** Narrow an unknown caught value to a printable message, matching the existing repo convention. */
  private errMessage(e: unknown): string {
    return e instanceof Error ? e.message : String(e);
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
    if (!this.context) throw new Error('Browser session not initialized');

    // ROUND 8 FIX: previously this branch only handled `newTab: true`, and
    // fell through to `requirePage()` otherwise — which THROWS if zero tabs
    // are open (now a normal, reachable state after close_all_tabs/
    // close_tab; see those methods). navigate() should always be able to
    // recover from a zero-tab state by opening a fresh page, exactly like
    // opening a new tab in a real browser when none exist yet.
    if (newTab || !this.page || this.page.isClosed()) {
      this.page = await this.context.newPage();
      // A fresh (blank) page shares no DOM with the previous one, so any
      // refs from the old snapshot are meaningless.
      this.refManager.clear();
    }
    const page = this.requirePage();
    this.setLoading(true);
    // ISSUE 6 FIX: page.goto() can throw (DNS failure, connection refused,
    // invalid URL, timeout) — wrap so the caller gets a clear message
    // instead of a raw Playwright error.
    try {
      const response = await page.goto(url, { waitUntil: 'domcontentloaded' });
      // New document: refs from the previous page's snapshot no longer
      // apply, so clear them. Click/type then fail fast with "call
      // browser_get_state first" instead of hunting stale refs.
      this.refManager.clear();
      const { httpStatus, httpStatusText } = this.responseStatusFields(response);
      const contentPreview = await capturePreview(page);
      // See click()'s identical comment: preserve autoSwitchedToNewTab
      // rather than letting this call's default (false) clobber whatever
      // the context 'page' handler may have already set (relevant for
      // `newTab: true` navigations, which also fire that event).
      const wasAutoSwitched = this.liveState.autoSwitchedToNewTab;
      await this.refreshLiveState({
        lastOperation: `navigate ${url}`,
        httpStatus,
        httpStatusText,
        contentPreview,
        autoSwitchedToNewTab: wasAutoSwitched,
      });
      const statusNote = httpStatus !== null ? ` (${httpStatus}${httpStatusText ? ` ${httpStatusText}` : ''})` : '';
      return `Navigated to ${page.url()}${statusNote}`;
    } catch (e) {
      const message = this.errMessage(e);
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
      this.refManager.clear();
      const { httpStatus, httpStatusText } = this.responseStatusFields(response);
      const contentPreview = await capturePreview(page);
      await this.refreshLiveState({ lastOperation: 'go_back', httpStatus, httpStatusText, contentPreview });
      return `Navigated back to ${page.url()}`;
    } catch (e) {
      const message = this.errMessage(e);
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
      this.refManager.clear();
      const { httpStatus, httpStatusText } = this.responseStatusFields(response);
      const contentPreview = await capturePreview(page);
      await this.refreshLiveState({ lastOperation: 'refresh', httpStatus, httpStatusText, contentPreview });
      return `Refreshed ${page.url()}`;
    } catch (e) {
      const message = this.errMessage(e);
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
      return `Error pressing key ${key}: ${this.errMessage(e)}`;
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
      const message = this.errMessage(e);
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
      return `Error taking screenshot: ${this.errMessage(e)}`;
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
        : page.locator(`aria-ref=${target.ref}`)
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
      return `Error getting dropdown options: ${this.errMessage(e)}`;
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
        : page.locator(`aria-ref=${target.ref}`);
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
      return `Error selecting dropdown option: ${this.errMessage(e)}`;
    }
  }

  async uploadFile(index: number, filePath: string, signal?: AbortSignal): Promise<string> {
    this.assertNotAborted(signal);
    const boundedPath = String(filePath ?? '').trim();
    if (!boundedPath) {
      return 'Error: File path must not be empty.';
    }
    const page = this.requirePage();
    const target = this.resolveTarget(page, index, undefined);
    if (target.kind === 'error') return target.message;
    try {
      const locator = target.kind === 'selector'
        ? target.locator
        : page.locator(`aria-ref=${target.ref}`);
      await locator.setInputFiles(boundedPath);
      const fileName = path.basename(boundedPath);
      await this.refreshLiveState({ lastOperation: `upload_file [${index}] ${fileName}` });
      return `Uploaded file '${fileName}' to [${index}]`;
    } catch (e) {
      const message = this.errMessage(e);
      if (/ENOENT|no such file|not found/i.test(message)) {
        return `Error: File not found at ${boundedPath}`;
      }
      return `Error uploading file: ${message}`;
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
      return `Error saving PDF: ${this.errMessage(e)}`;
    }
  }

  // ── Click / Type (Playwright aria-ref locators — deterministic, no LLM) ──

  /** Re-capture the aria snapshot from the CURRENT DOM and refill the ref manager. */
  private async refreshAriaSnapshot(page: Page): Promise<string> {
    const ariaSnapshot = await page.ariaSnapshot({ mode: 'ai' });
    this.refManager.setSnapshot(ariaSnapshot);
    return ariaSnapshot;
  }

  /**
   * REFRESH-STATE GLITCH FIX: Playwright's ariaSnapshot refs are not stable
   * across calls — the log showed an eN -> f1eN renumber on the same page —
   * so the stored ref for an index can go stale even though the element
   * still exists at that index. When the first attempt fails, re-snapshot
   * the current DOM and re-run the action at the same index. Returns true
   * when the retry succeeded; the caller reports the original error if not.
   */
  private async retryWithFreshRef(
    page: Page,
    index: number,
    act: (freshRef: string) => Promise<unknown>,
  ): Promise<boolean> {
    try {
      await this.refreshAriaSnapshot(page);
      const freshRef = this.refManager.getRefByIndex(index);
      if (!freshRef) return false;
      await act(freshRef);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * LOG.MD ISSUE #3 FIX: resolve a click/type target either by `selector`
   * (CSS, resolved directly via `page.locator()` — immune to occurrence-
   * index drift) or by `index` (the existing aria-ref system). `selector`
   * takes priority when both are given. Returns either a ready-to-use
   * Locator (selector path — index-retry logic doesn't apply, since a CSS
   * selector doesn't go stale the way a snapshot-order index does) or the
   * resolved index+ref pair (index path, so the caller can still do the
   * stale-ref retry dance).
   */
  /**
   * LOG.MD (round 8 E2E report) FIX: `page.locator('[aria-ref=f1e46]')` is a
   * plain CSS ATTRIBUTE selector (looks for a literal DOM attribute named
   * `aria-ref`) — NOT Playwright's special `aria-ref=` locator ENGINE
   * syntax, which requires no brackets (`page.locator('aria-ref=f1e46')`).
   * An agent naturally guesses the bracketed CSS-attribute form when handed
   * a `selector` param and a `[ref=e46]`-looking value from get_state's
   * output, and that guess times out with no useful signal why. Normalize
   * common wrong-but-understandable forms (`[ref=e46]`, `[aria-ref=e46]`,
   * `ref=e46`) into the correct engine syntax rather than let them silently
   * fail as a bogus CSS selector for 10 seconds.
   */
  private normalizeSelector(selector: string): { selector: string; wasRefLike: boolean } {
    const match = selector.trim().match(/^\[?(?:aria-)?ref=((?:f\d+)?e\d+)\]?$/i);
    return match ? { selector: `aria-ref=${match[1]}`, wasRefLike: true } : { selector, wasRefLike: false };
  }

  private resolveTarget(
    page: Page,
    index: number | undefined,
    rawSelector: string | undefined,
  ):
    | { kind: 'selector'; locator: ReturnType<Page['locator']>; label: string; wasRefLike: boolean }
    | { kind: 'index'; ref: string; label: string }
    | { kind: 'error'; message: string } {
    if (rawSelector) {
      const { selector, wasRefLike } = this.normalizeSelector(rawSelector);
      return { kind: 'selector', locator: page.locator(selector), label: `selector "${selector}"`, wasRefLike };
    }
    if (index === undefined) {
      return { kind: 'error', message: 'Error: Either `index` or `selector` must be provided.' };
    }
    const ref = this.refManager.getRefByIndex(index);
    if (!ref) {
      return { kind: 'error', message: `Error: Invalid element index ${index}. Call browser_get_state first.` };
    }
    return { kind: 'index', ref, label: `[${index}] (ref=${ref})` };
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
    // images, or any element not reachable via aria-ref/selector.
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
        const message = this.errMessage(e);
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
      const locatorForHref = target.kind === 'selector' ? target.locator : page.locator(`aria-ref=${target.ref}`);
      const href = await locatorForHref
        .first()
        .evaluate((el: any) => el.href)
        .catch(() => null);
      if (href) return this.navigate(href, true);
    }

    if (target.kind === 'selector') {
      try {
        await target.locator.click({ timeout: ARIA_REF_TIMEOUT_MS });
      } catch (e) {
        const message = this.errMessage(e);
        const hint =
          message.toLowerCase().includes('timeout') && target.wasRefLike
            ? '\nHint: this ref may be stale (the page changed since the last browser_get_state). Call browser_get_state again for fresh refs, then retry with the new index.'
            : '';
        await this.refreshLiveState({ errorText: `click: ${message}`, lastOperation: `click ${target.label}` });
        return `Error clicking ${target.label}: ${message}${hint}`;
      }
      const wasAutoSwitched = this.liveState.autoSwitchedToNewTab;
      await this.refreshLiveState({ lastOperation: `click ${target.label}`, autoSwitchedToNewTab: wasAutoSwitched });
      const newTabNote = wasAutoSwitched ? ' — opened in a new tab, now active' : '';
      return `Clicked ${target.label}${newTabNote}`;
    }

    // index path — carries the stale-ref self-healing retry.
    let ref = target.ref;
    try {
      await page.locator(`aria-ref=${ref}`).click({ timeout: ARIA_REF_TIMEOUT_MS });
    } catch (e) {
      const staleMessage = this.errMessage(e);
      if (
        index !== undefined &&
        (await this.retryWithFreshRef(page, index, (freshRef) => {
          ref = freshRef;
          return page.locator(`aria-ref=${freshRef}`).click({ timeout: ARIA_REF_TIMEOUT_MS });
        }))
      ) {
        await this.refreshLiveState({ lastOperation: `click [${index}]` });
        return `Clicked [${index}] (ref=${ref}) [retried after state refresh]`;
      }
      await this.refreshLiveState({ errorText: `click: ${staleMessage}`, lastOperation: `click [${index}]` });
      return `Error clicking [${index}] (ref=${ref}): ${staleMessage}`;
    }

    // Click can trigger navigation, so refresh the live-state snapshot
    // (url/title/tabs) regardless of success/failure. If it opened a new
    // tab, the context-level 'page' handler's fire-and-forget
    // refreshLiveState() may ALREADY have run and set
    // `autoSwitchedToNewTab` — capture that BEFORE our own refresh call so
    // we don't immediately clobber it back to false (refreshLiveState()'s
    // options default `autoSwitchedToNewTab` to false, same as any other
    // "not a new-tab event" call). NOTE: this is inherently racy — the
    // event handler's async update might not have landed yet when we read
    // it here, in which case THIS call's return text won't mention the new
    // tab even though it happened. The panel doesn't have this problem
    // (it's driven by the live subscription, which will pick up the
    // event handler's update whenever it actually lands), so this is a
    // best-effort improvement to the return message, not a guarantee.
    const wasAutoSwitched = this.liveState.autoSwitchedToNewTab;
    await this.refreshLiveState({ lastOperation: `click [${index}]`, autoSwitchedToNewTab: wasAutoSwitched });
    const newTabNote = wasAutoSwitched ? ' — opened in a new tab, now active' : '';
    return `Clicked [${index}] (ref=${ref})${newTabNote}`;
  }

  async typeText(index: number | undefined, text: string, selector?: string, signal?: AbortSignal): Promise<string> {
    this.assertNotAborted(signal);
    const page = this.requirePage();
    const target = this.resolveTarget(page, index, selector);
    if (target.kind === 'error') return target.message;

    if (target.kind === 'selector') {
      try {
        await target.locator.fill(text, { timeout: ARIA_REF_TIMEOUT_MS });
        await this.refreshLiveState({ lastOperation: `type ${target.label}` });
        return `Typed "${text}" into ${target.label}`;
      } catch (e) {
        const message = this.errMessage(e);
        const hint =
          message.toLowerCase().includes('timeout') && target.wasRefLike
            ? '\nHint: this ref may be stale (the page changed since the last browser_get_state). Call browser_get_state again for fresh refs, then retry with the new index.'
            : '';
        return `Error typing into ${target.label}: ${message}${hint}`;
      }
    }

    // index path — carries the stale-ref self-healing retry.
    let ref = target.ref;
    try {
      await page.locator(`aria-ref=${ref}`).fill(text, { timeout: ARIA_REF_TIMEOUT_MS });
      await this.refreshLiveState({ lastOperation: `type [${index}]` });
      return `Typed "${text}" into [${index}] (ref=${ref})`;
    } catch (e) {
      const staleMessage = this.errMessage(e);
      if (
        index !== undefined &&
        (await this.retryWithFreshRef(page, index, (freshRef) => {
          ref = freshRef;
          return page.locator(`aria-ref=${freshRef}`).fill(text, { timeout: ARIA_REF_TIMEOUT_MS });
        }))
      ) {
        await this.refreshLiveState({ lastOperation: `type [${index}]` });
        return `Typed "${text}" into [${index}] (ref=${ref}) [retried after state refresh]`;
      }
      return `Error typing into [${index}] (ref=${ref}): ${staleMessage}`;
    }
  }

  // ── Get State (Playwright ariaSnapshot({ mode: 'ai' }) — deterministic, no LLM) ──

  async getBrowserState(includeScreenshot: boolean, signal?: AbortSignal): Promise<string> {
    this.assertNotAborted(signal);
    const page = this.requirePage();
    // Generates YAML like:
    //   - generic [ref=e1]:
    //     - heading "Welcome" [ref=e2]
    //     - button "Login" [ref=e3]
    // `mode: 'ai'` is what produces the [ref=eN] tags; requires Playwright >=1.50.
    await this.refreshAriaSnapshot(page);
    // ROUND 9 FIX: return the [index=K]-annotated version (K matching
    // exactly what click()/type() expect), not the raw [ref=eN] snapshot —
    // see RefManager.getAnnotatedSnapshotText()'s doc comment for why this
    // was a real, reproduced bug (index vs. ref confusion causing type()
    // to land on the wrong element).
    const annotatedSnapshot = this.refManager.getAnnotatedSnapshotText();
    await this.refreshLiveState({ lastOperation: 'get_state' });

    if (includeScreenshot) {
      const screenshot = await page.screenshot({ type: 'png' });
      const screenshotData = screenshot.toString('base64');
      return JSON.stringify({ elements: annotatedSnapshot, screenshot: screenshotData, url: page.url() }, null, 2);
    }
    return JSON.stringify({ elements: annotatedSnapshot, url: page.url() }, null, 2);
  }

  // ── Get Content (page.innerText — no LLM — + EXACT truncation logic from server.py) ──

  async getContent(extractLinks: boolean, startFromChar: number, signal?: AbortSignal): Promise<string> {
    this.assertNotAborted(signal);
    const page = this.requirePage();
    await this.refreshLiveState({ lastOperation: 'get_content' });

    let content: string;
    try {
      content = await page.innerText('body');
    } catch (e) {
      return `Could not extract content from page: ${this.errMessage(e)}`;
    }

    // ENHANCEMENT 3: an empty page would otherwise flow through as a
    // content_stats block full of zeros.
    if (!content || content.trim().length === 0) {
      return `<url>\n${page.url()}\n</url>\n<content>\n<content_stats>\nNo content could be extracted from this page.\n</content_stats>\n</content>`;
    }

    const originalHtmlLength = (await page.content()).length;
    const initialMarkdownLength = content.length;

    // BUG 3 FIX (carried over): when extractLinks is false, strip markdown
    // links (this project's convention treats the extracted text as
    // markdown-flavored even though it now comes from innerText()). Applied
    // right after extraction, before start_from_char/truncation, so
    // pagination offsets are computed against the already-filtered content.
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
      // Look for a paragraph break in the last 500 chars of the limit window.
      const windowStart = Math.max(0, MAX_CHAR_LIMIT - 500);
      const paragraphBreak = content.lastIndexOf('\n\n', MAX_CHAR_LIMIT);
      if (paragraphBreak >= windowStart && paragraphBreak < MAX_CHAR_LIMIT) {
        truncateAt = paragraphBreak;
      } else {
        // Fall back to a sentence break in the last 200 chars of the limit window.
        const sentenceWindowStart = Math.max(0, MAX_CHAR_LIMIT - 200);
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
      const message = this.errMessage(e);
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
      const message = this.errMessage(e);
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
    if (!page.evaluate) {
      return 'Error: Unable to access page for find_elements.';
    }
    const boundedSelector = String(selector ?? '').slice(0, 2048);
    if (!boundedSelector) {
      return 'Error: Selector must not be empty.';
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
      const message = this.errMessage(e);
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
      const message = this.errMessage(e);
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
      if (!this.page) this.refManager.clear();
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
    this.refManager.clear();
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
