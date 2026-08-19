/**
 * WebBrowserPanel - a live BROWSER MONITOR (not an interactive browser) for
 * the WebBrowserTool's session. Rendered by src/screens/REPL.tsx behind
 * feature('WEB_BROWSER_TOOL'):
 *
 *   const WebBrowserPanelModule = feature('WEB_BROWSER_TOOL')
 *     ? require('../tools/WebBrowserTool/WebBrowserPanel.js') as typeof import(...)
 *     : null;
 *
 * ROUND 8 - hand-drawn border layout matching the provided mockup (title
 * embedded in the top border line, horizontal divider rules between
 * sections). Per the explicit ask, the OUTER frame (top/bottom/side walls)
 * uses HEAVY Unicode box-drawing characters (bold) and the INNER divider
 * rules use LIGHT box-drawing characters (dim) - a real line-weight
 * difference, not just color. Ink has no built-in support for a title
 * embedded in a border line or for mid-box divider rules, so this whole
 * frame is hand-drawn rather than using Box's borderStyle prop (see the
 * layout-math note on ContentRow below).
 *
 * The active tab's URL is wrapped in an OSC 8 terminal hyperlink escape so
 * ctrl+click (most modern terminal emulators) opens it directly. See
 * hyperlink()'s doc comment for the one real risk this carries and how the
 * layout math avoids it.
 *
 * Round 7's design-brief-driven state machine (loading/ready/network_error/
 * captcha/http_error/redirect/local_file) and its "never display: buttons,
 * console logs, DOM dumps, action history" constraint both carry over
 * unchanged - only the frame rendering changed this round. Also added: a
 * 'no_tabs' state, now reachable since close_all_tabs / closing the last
 * tab via close_tab can leave zero tabs open (round 8 fix).
 *
 * Conventions relied on (verified against the real REPL.tsx/theme.ts):
 * Box/Text from '../../ink.js' (GakrCLI's own Ink wrapper), color takes
 * semantic theme keys ("error", "brand", "text" confirmed in REPL.tsx;
 * "warning"/"success"/"subtle" assumed as standard theme siblings).
 * borderColor/borderStyle are NOT used this round since the frame is
 * hand-drawn - only color/bold/dimColor on plain Text.
 */

import { Box, Text } from '../../ink.js';
import * as React from 'react';
import { useEffect, useState } from 'react';

import { BrowserToolExecutor } from './browserEngine.js';
import { EMPTY_BROWSER_LIVE_STATE, type BrowserErrorCategory, type BrowserLiveState, type BrowserTabState } from './types.js';

// Heavy (thick) box-drawing set for the OUTER frame.
const HEAVY = { tl: '\u250F', tr: '\u2513', bl: '\u2517', br: '\u251B', h: '\u2501', v: '\u2503' };
// Light (thin) box-drawing set for INNER divider rules.
const LIGHT = { lt: '\u251C', rt: '\u2524', h: '\u2500' };

const SPINNER_FRAMES = ['\u25D0', '\u25D3', '\u25D1', '\u25D2'];
const SPINNER_INTERVAL_MS = 120;

const MAX_VISIBLE_TABS = 5;
const MAX_TAB_TITLE_LEN = 22;
const PREVIEW_MAX_LINES = 2;

/**
 * Target total box width (outer frame chars included). Responsive to the
 * real terminal width when available, clamped to a sane range so it never
 * looks absurd on a very narrow or very wide terminal; falls back to 80
 * (the mockup's own approximate width) when `columns` isn't reported
 * (e.g. non-TTY output). Computed once per render - not reactive to a live
 * terminal resize, an acceptable trade-off given the panel already
 * re-renders on every browser state change.
 */
function computeBoxWidth(): number {
  const terminalWidth = process.stdout && process.stdout.columns ? process.stdout.columns : 80;
  return Math.max(60, Math.min(terminalWidth - 2, 100));
}

/**
 * Best-effort visible-column-width estimate. Plain ASCII counts as 1;
 * common emoji ranges count as 2 (most terminals render them double-wide);
 * zero-width joiners/variation selectors count as 0; the heavy/light
 * box-drawing characters used by this file count as 1 (they are narrow in
 * essentially every terminal font). This is NOT a fully correct Unicode
 * East Asian Width implementation (that needs a real wcwidth table this
 * project doesn't currently depend on) - it's a pragmatic approximation.
 * NOT independently verified against a real terminal from this sandbox -
 * if border alignment looks off with a particular terminal/font, this is
 * the function to adjust first.
 */
function displayWidth(str: string): number {
  let width = 0;
  for (const ch of str) {
    const code = ch.codePointAt(0) ?? 0;
    if (code === 0x200d || (code >= 0xfe00 && code <= 0xfe0f)) {
      continue; // zero-width joiner / variation selectors
    }
    if ((code >= 0x1f300 && code <= 0x1faff) || (code >= 0x2600 && code <= 0x27bf)) {
      width += 2;
    } else {
      width += 1;
    }
  }
  return width;
}

/** Truncate with an ellipsis, based on displayWidth (not .length). */
function truncate(text: string, maxWidth: number): string {
  if (displayWidth(text) <= maxWidth) return text;
  if (maxWidth <= 1) return '\u2026';
  let out = '';
  let w = 0;
  for (const ch of text) {
    const chWidth = displayWidth(ch);
    if (w + chWidth > maxWidth - 1) break;
    out += ch;
    w += chWidth;
  }
  return `${out}\u2026`;
}

/**
 * Wraps `label` in an OSC 8 terminal hyperlink escape pointing at `url`, so
 * ctrl+click (most modern terminal emulators) opens it directly - this was
 * an explicit ask: "the active tab url need to navigatable or clickable".
 *
 * RISK, stated plainly: some terminals'/libraries' string-width
 * measurement doesn't correctly account for OSC 8 escape sequences (unlike
 * standard SGR color codes, which are widely handled), which COULD cause
 * Ink to mis-measure this Text node's width if it were placed inside an
 * auto-sized flex layout. This panel avoids that risk structurally: all
 * padding math in this file is computed from the PLAIN label text via
 * displayWidth() BEFORE wrapping in this hyperlink escape - the escaped
 * string is only substituted in as the final rendered content, never used
 * as an input to any width calculation. Not independently verified in a
 * real terminal from this sandbox; if ctrl+click doesn't work in your
 * terminal or introduces visible artifacts, that's a terminal-support gap,
 * not a broken build - output degrades to the plain label verbatim when
 * `process.stdout.isTTY` is false (e.g. logs/CI/piped output).
 */
function hyperlink(url: string, label: string): string {
  if (!process.stdout || !process.stdout.isTTY) return label;
  return `\u001B]8;;${url}\u0007${label}\u001B]8;;\u0007`;
}

interface ParsedUrl {
  isSecure: boolean;
  isLocal: boolean;
  isFile: boolean;
  isBlank: boolean;
  hostname: string;
  pathAndQuery: string;
  display: string;
}

/** Break a URL into address-bar parts. Never throws - falls back to the raw string. */
function parseUrl(url: string | null): ParsedUrl | null {
  if (!url) return null;
  try {
    const u = new URL(url);
    const isFile = u.protocol === 'file:';
    const isBlank = u.protocol === 'about:';
    // ROUND 10 FIX (real-world rendering bug): "about:", "data:", and
    // "javascript:" are OPAQUE-PATH URLs in WHATWG URL parsing - their
    // `pathname` has no leading "/" the way http(s)/file URLs do. The old
    // `hostname + pathAndQuery` concatenation assumed a leading separator
    // always existed, so "about:blank" (hostname="", protocol="about:" ->
    // hostname fallback "about", pathname="blank") rendered as the
    // unreadable "aboutblank" with no separator at all. These schemes now
    // just show the raw URL verbatim, same as the existing file: handling.
    const isOpaquePath = isBlank || u.protocol === 'data:' || u.protocol === 'javascript:';
    const hostname = u.hostname || (isFile || isOpaquePath ? '' : u.protocol.replace(':', ''));
    const isLocal = hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]' || isFile || isBlank;
    const pathAndQuery = u.pathname === '/' ? '' : u.pathname + u.search;
    return {
      isSecure: u.protocol === 'https:',
      isLocal,
      isFile,
      isBlank,
      hostname: hostname + (u.port ? `:${u.port}` : ''),
      pathAndQuery,
      display: isFile || isOpaquePath ? url : hostname + (u.port ? `:${u.port}` : '') + pathAndQuery,
    };
  } catch {
    return { isSecure: false, isLocal: false, isFile: false, isBlank: false, hostname: url, pathAndQuery: '', display: url };
  }
}

const ERROR_CATEGORY_LABELS: Record<BrowserErrorCategory, { label: string; severity: 'error' | 'warning' }> = {
  offline: { label: 'Network Error', severity: 'error' },
  dns: { label: 'DNS Failure', severity: 'error' },
  connection_refused: { label: 'Connection Refused', severity: 'error' },
  timeout: { label: 'Connection Timeout', severity: 'error' },
  proxy: { label: 'Proxy Error', severity: 'error' },
  tls: { label: 'TLS/Cert Error', severity: 'error' },
  blocked_by_allowlist: { label: 'Blocked (allowlist)', severity: 'warning' },
  other: { label: 'Error', severity: 'error' },
};

/**
 * Derives the panel's overall "browser state" from live state - this one
 * value drives the border title, the status badge, the context message,
 * and the colors, so all pieces always agree with each other instead of
 * being computed independently and risking drift.
 */
type PanelState =
  | { kind: 'no_tabs' }
  | { kind: 'loading' }
  | { kind: 'network_error'; category: BrowserErrorCategory; message: string }
  | { kind: 'captcha' }
  | { kind: 'http_error'; status: number; statusText: string | null }
  | { kind: 'redirect'; status: number }
  | { kind: 'local_file' }
  | { kind: 'ready'; status: number | null; statusText: string | null };

function derivePanelState(state: BrowserLiveState, parsed: ParsedUrl | null): PanelState {
  // ROUND 8: zero tabs is now a normal, reachable state (close_all_tabs /
  // closing the last tab via close_tab) rather than an error.
  if (state.tabs.length === 0) return { kind: 'no_tabs' };
  if (state.isLoading) return { kind: 'loading' };
  if (state.lastError) {
    const category = state.lastErrorCategory ?? 'other';
    const [message] = state.lastError.split('\n');
    return { kind: 'network_error', category, message };
  }
  if (state.possibleCaptcha) return { kind: 'captcha' };
  if (parsed?.isLocal) return { kind: 'local_file' };
  if (state.httpStatus !== null) {
    if (state.httpStatus >= 400) return { kind: 'http_error', status: state.httpStatus, statusText: state.httpStatusText };
    if (state.httpStatus >= 300) return { kind: 'redirect', status: state.httpStatus };
  }
  return { kind: 'ready', status: state.httpStatus, statusText: state.httpStatusText };
}

/** Border title + accent color, per the mockup's per-state examples. */
function borderChrome(panelState: PanelState): { title: string; color: string } {
  switch (panelState.kind) {
    case 'network_error':
      return { title: 'Browser Error', color: 'error' };
    case 'captcha':
      return { title: 'Browser Attention Required', color: 'warning' };
    case 'http_error':
      return { title: 'Browser', color: 'warning' };
    default:
      return { title: 'Browser', color: 'brand' };
  }
}

/** Context Message row - one short human-readable sentence per state. */
function contextMessage(panelState: PanelState): string {
  switch (panelState.kind) {
    case 'no_tabs':
      return 'No tabs open. Call browser_navigate to open one.';
    case 'loading':
      return 'Loading page content...';
    case 'network_error':
      return 'Unable to connect to website.';
    case 'captcha':
      return 'Human verification detected.';
    case 'http_error':
      if (panelState.status === 404) return 'Requested page not found.';
      if (panelState.status === 403) return 'Access forbidden.';
      if (panelState.status === 429) return 'Rate limit exceeded.';
      if (panelState.status >= 500) return 'Server returned an internal error.';
      return `Server returned HTTP ${panelState.status}.`;
    case 'redirect':
      return 'Following redirect...';
    case 'local_file':
      return 'Local content loaded - not browsing the internet.';
    case 'ready':
      return 'Page loaded successfully.';
  }
}

/** Plain-text label for the status badge (used for both rendering and width math). */
function statusBadgeText(panelState: PanelState): string {
  switch (panelState.kind) {
    case 'no_tabs':
      return '';
    case 'loading':
      return 'Loading...';
    case 'network_error':
      return ERROR_CATEGORY_LABELS[panelState.category].label;
    case 'captcha':
      return 'Verification Required';
    case 'http_error':
      return `${panelState.status} ${panelState.statusText || (panelState.status === 404 ? 'Not Found' : '')}`.trim();
    case 'redirect':
      return `${panelState.status} Redirect`;
    case 'local_file':
      return 'Local File';
    case 'ready':
      return panelState.status ? `${panelState.status} ${panelState.statusText || 'Loaded'}` : 'Ready';
  }
}

function statusBadgeColor(panelState: PanelState): string | undefined {
  switch (panelState.kind) {
    case 'loading':
      return 'brand';
    case 'network_error':
      return 'error';
    case 'captcha':
      return 'warning';
    case 'http_error':
      return panelState.status >= 500 ? 'error' : 'warning';
    case 'redirect':
      return 'brand';
    case 'local_file':
      return 'subtle';
    case 'ready':
      return 'success';
    default:
      return undefined;
  }
}

/** Cycling spinner, only ticking while `active` (no idle CPU cost). */
function useSpinnerFrame(active: boolean): string {
  const [frame, setFrame] = useState(0);
  useEffect(() => {
    if (!active) return;
    const timer = setInterval(() => setFrame((f) => (f + 1) % SPINNER_FRAMES.length), SPINNER_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [active]);
  return SPINNER_FRAMES[frame];
}

// ============================================================
// Hand-drawn frame primitives
// ============================================================

/** Heavy (thick) top border with the title embedded, e.g. a line that reads "Browser" inline. */
function TopBorder({ title, color, width }: { title: string; color: string; width: number }) {
  const prefix = `${HEAVY.tl}${HEAVY.h} ${title} `;
  const fillLen = Math.max(1, width - displayWidth(prefix) - 1);
  return (
    <Text bold color={color}>
      {prefix}
      {HEAVY.h.repeat(fillLen)}
      {HEAVY.tr}
    </Text>
  );
}

/** Heavy (thick) bottom border, plain. */
function BottomBorder({ color, width }: { color: string; width: number }) {
  return (
    <Text bold color={color}>
      {HEAVY.bl}
      {HEAVY.h.repeat(Math.max(0, width - 2))}
      {HEAVY.br}
    </Text>
  );
}

/** Light (thin), dim horizontal divider between sections. */
/**
 * ROUND 9 FIX (real-world rendering feedback): previously rendered with
 * `dimColor` alone, no explicit `color` — which lets the terminal/Ink fall
 * back to some default dim (often a generic gray) rather than a genuinely
 * DIMMED VERSION OF THE SAME ACCENT COLOR the outer frame uses. The ask
 * was explicit: outer bright, inner the SAME color but dim — not a
 * different color entirely. Passing `color={accentColor}` alongside
 * `dimColor` tells Ink to dim THAT specific color rather than substitute
 * an unrelated default.
 */
function Divider({ width, accentColor }: { width: number; accentColor: string }) {
  return (
    <Text color={accentColor} dimColor>
      {LIGHT.lt}
      {LIGHT.h.repeat(Math.max(0, width - 2))}
      {LIGHT.rt}
    </Text>
  );
}

/**
 * One content row: heavy side walls (bold, accent color) framing
 * `children`, right-padded to `width` using `plainText` for the width
 * calculation (see the module doc comment on why width math is always
 * done against plain text, never against already-styled/escaped strings).
 */
function ContentRow({
  children,
  plainText,
  width,
  accentColor,
}: {
  children: React.ReactNode;
  plainText: string;
  width: number;
  accentColor: string;
}) {
  const innerWidth = width - 4; // left wall + space + space + right wall
  const padLen = Math.max(0, innerWidth - displayWidth(plainText));
  return (
    <Box>
      <Text bold color={accentColor}>
        {HEAVY.v}{' '}
      </Text>
      {children}
      <Text>{' '.repeat(padLen)}</Text>
      <Text bold color={accentColor}>
        {' '}
        {HEAVY.v}
      </Text>
    </Box>
  );
}

// ============================================================
// Section content builders - each returns { node, plainText } so
// ContentRow can right-pad correctly regardless of how many separately
// colored segments are inside.
// ============================================================

function buildTabsRow(tabs: BrowserTabState[], currentUrl: string | null): { node: React.ReactNode; plainText: string } {
  if (tabs.length === 0) {
    return { node: <Text dimColor>No tabs open</Text>, plainText: 'No tabs open' };
  }

  const visible = tabs.slice(0, MAX_VISIBLE_TABS);
  const overflow = tabs.length - visible.length;
  const activeIndex = Math.max(0, tabs.findIndex((t) => t.url === currentUrl));
  const countLabel = tabs.length > 1 ? `${activeIndex + 1}/${tabs.length} Tabs` : '';

  const tabTexts = visible.map((tab) => ({
    label: truncate(tab.title || tab.url, MAX_TAB_TITLE_LEN),
    isActive: tab.url === currentUrl,
  }));

  const dot = (active: boolean) => (active ? '\u25CF' : '\u25CB');
  const leftPlain = tabTexts.map((t) => `${dot(t.isActive)} ${t.label}`).join('   ') + (overflow > 0 ? `   +${overflow} more` : '');
  const plainText = countLabel ? `${leftPlain}   ${countLabel}` : leftPlain;

  const node = (
    <Box justifyContent="space-between" width="100%">
      <Box>
        {tabTexts.map((t, i) => (
          <Text key={i} color={t.isActive ? 'brand' : undefined} dimColor={!t.isActive} bold={t.isActive}>
            {i > 0 ? '   ' : ''}
            {dot(t.isActive)} {t.label}
          </Text>
        ))}
        {overflow > 0 && <Text dimColor>   +{overflow} more</Text>}
      </Box>
      {countLabel && <Text dimColor>{countLabel}</Text>}
    </Box>
  );

  return { node, plainText };
}

function statusIcon(state: BrowserLiveState, parsed: ParsedUrl | null): string {
  if (state.isLoading) return SPINNER_FRAMES[0];
  if (parsed?.isFile) return '\uD83D\uDCC4'; // page icon
  if (parsed?.isLocal) return '\u2302'; // house icon
  if (parsed?.isSecure) return '\uD83D\uDD12'; // lock icon
  return '\u26A0'; // warning icon
}

function buildUrlPlainText(state: BrowserLiveState, parsed: ParsedUrl | null, panelState: PanelState, urlLabel: string): string {
  const icon = statusIcon(state, parsed);
  const badgeText = statusBadgeText(panelState);
  return `${icon} ${urlLabel}${badgeText ? `  ${badgeText}` : ''}`;
}

function UrlRowNode({
  state,
  parsed,
  panelState,
  urlLabel,
}: {
  state: BrowserLiveState;
  parsed: ParsedUrl | null;
  panelState: PanelState;
  urlLabel: string;
}) {
  const spinnerFrame = useSpinnerFrame(state.isLoading);
  const iconColor = state.isLoading ? 'brand' : parsed?.isFile ? 'subtle' : parsed?.isLocal ? undefined : parsed?.isSecure ? 'success' : 'warning';
  const badgeText = statusBadgeText(panelState);
  const badgeColor = statusBadgeColor(panelState);
  const icon = statusIcon(state, parsed);

  // ROUND 8: the active tab's URL is ctrl+clickable (OSC 8 hyperlink) -
  // see hyperlink()'s doc comment for how this stays safe w.r.t. layout math.
  const linkedLabel = state.currentUrl ? hyperlink(state.currentUrl, urlLabel) : urlLabel;

  return (
    <Box justifyContent="space-between" width="100%">
      <Box>
        <Text color={iconColor} dimColor={Boolean(parsed?.isLocal) && !state.isLoading}>
          {state.isLoading ? spinnerFrame : icon}{' '}
        </Text>
        <Text dimColor={Boolean(parsed?.isLocal)} color={parsed?.isLocal ? undefined : 'brand'}>
          {linkedLabel}
        </Text>
      </Box>
      {badgeText && (
        <Text color={badgeColor} bold={panelState.kind !== 'ready'}>
          {badgeText}
        </Text>
      )}
    </Box>
  );
}

function buildPreviewLines(text: string, lineWidth: number): string[] {
  const lines: string[] = [];
  let rest = text;
  while (rest.length > 0 && lines.length < PREVIEW_MAX_LINES) {
    if (displayWidth(rest) <= lineWidth) {
      lines.push(rest);
      break;
    }
    let cut = rest.lastIndexOf(' ', lineWidth);
    if (cut <= 0) cut = lineWidth;
    lines.push(rest.slice(0, cut));
    rest = rest.slice(cut).trimStart();
  }
  if (rest.length > 0 && lines.length === PREVIEW_MAX_LINES) {
    lines[lines.length - 1] = truncate(lines[lines.length - 1], lineWidth);
  }
  return lines;
}

export function WebBrowserPanel(): React.ReactNode {
  const [state, setState] = useState<BrowserLiveState>(EMPTY_BROWSER_LIVE_STATE);

  useEffect(() => {
    let unsubscribe: (() => void) | null = null;
    let pollTimer: ReturnType<typeof setInterval> | null = null;

    function attach(executor: BrowserToolExecutor) {
      setState(executor.getLiveState());
      unsubscribe = executor.onLiveStateChange(setState);
      if (pollTimer) {
        clearInterval(pollTimer);
        pollTimer = null;
      }
    }

    const existing = BrowserToolExecutor.getSharedIfExists();
    if (existing) {
      attach(existing);
    } else {
      // The shared executor is created lazily on the WebBrowserTool's first
      // call, which can happen well after this panel mounts. Poll for it to
      // appear rather than requiring a screen remount to pick it up.
      pollTimer = setInterval(() => {
        const executor = BrowserToolExecutor.getSharedIfExists();
        if (executor) attach(executor);
      }, 1000);
    }

    return () => {
      if (unsubscribe) unsubscribe();
      if (pollTimer) clearInterval(pollTimer);
    };
  }, []);

  // Matches the original stub's behavior when the tool has never been used
  // at all this session (distinct from "zero tabs but browser alive" - see
  // PanelState's 'no_tabs' kind - which DOES render the panel).
  if (!state.isInitialized) return null;

  const width = computeBoxWidth();
  const innerWidth = width - 4;
  const parsed = parseUrl(state.currentUrl);
  const panelState = derivePanelState(state, parsed);
  const { title: borderTitle, color: accentColor } = borderChrome(panelState);

  const tabsRow = buildTabsRow(state.tabs, state.currentUrl);
  const urlLabel = parsed ? truncate(parsed.display, Math.max(20, innerWidth - 24)) : 'about:blank';
  const urlPlainText = buildUrlPlainText(state, parsed, panelState, urlLabel);

  const titleText = truncate(state.currentTitle || '(untitled)', innerWidth);
  const contextText = contextMessage(panelState);
  const previewLines = panelState.kind === 'ready' && state.contentPreview ? buildPreviewLines(state.contentPreview, innerWidth) : [];
  const lastActionVerb = state.lastOperation ? state.lastOperation.split(' ')[0] || state.lastOperation : null;

  return (
    <Box flexDirection="column">
      <TopBorder title={borderTitle} color={accentColor} width={width} />

      <ContentRow plainText={tabsRow.plainText} width={width} accentColor={accentColor}>
        {tabsRow.node}
      </ContentRow>

      <Divider width={width} accentColor={accentColor} />

      <ContentRow plainText={urlPlainText} width={width} accentColor={accentColor}>
        <UrlRowNode state={state} parsed={parsed} panelState={panelState} urlLabel={urlLabel} />
      </ContentRow>

      <Divider width={width} accentColor={accentColor} />

      {/* Per design: don't show the title until the page has actually loaded, and not when there are no tabs. */}
      {panelState.kind !== 'loading' && panelState.kind !== 'no_tabs' && (
        <ContentRow plainText={titleText} width={width} accentColor={accentColor}>
          <Text color="text">{titleText}</Text>
        </ContentRow>
      )}

      <ContentRow plainText={contextText} width={width} accentColor={accentColor}>
        <Text
          dimColor={panelState.kind !== 'network_error' && panelState.kind !== 'captcha'}
          color={panelState.kind === 'network_error' ? 'error' : panelState.kind === 'captcha' ? 'warning' : undefined}
        >
          {contextText}
        </Text>
      </ContentRow>

      {previewLines.map((line, i) => (
        <ContentRow key={i} plainText={line} width={width} accentColor={accentColor}>
          <Text dimColor>{line}</Text>
        </ContentRow>
      ))}

      {state.autoSwitchedToNewTab && (
        <ContentRow plainText="-> New tab opened and focused" width={width} accentColor={accentColor}>
          <Text color="brand">-&gt; New tab opened and focused</Text>
        </ContentRow>
      )}

      {state.isRecording && (
        <ContentRow
          plainText={`REC${state.recordingEventCount > 0 ? ` (${state.recordingEventCount})` : ''}`}
          width={width}
          accentColor={accentColor}
        >
          <Text color="error" bold>
            {'\u25CF'} REC{state.recordingEventCount > 0 ? ` (${state.recordingEventCount})` : ''}
          </Text>
        </ContentRow>
      )}

      {lastActionVerb && (
        <>
          <Divider width={width} accentColor={accentColor} />
          <ContentRow plainText={`Last Action: ${lastActionVerb}()`} width={width} accentColor={accentColor}>
            <Text dimColor>Last Action: {lastActionVerb}()</Text>
          </ContentRow>
        </>
      )}

      <BottomBorder color={accentColor} width={width} />
    </Box>
  );
}
