/**
 * WebBrowserPanel - a live BROWSER MONITOR (not an interactive browser) for
 * the WebBrowserTool's session. Rendered by src/screens/REPL.tsx behind
 * feature('WEB_BROWSER_TOOL'):
 *
 *   const WebBrowserPanelModule = feature('WEB_BROWSER_TOOL')
 *     ? require('../tools/WebBrowserTool/WebBrowserPanel.js') as typeof import(...)
 *     : null;
 *
 * ROUND 8+ - Professional UI/UX improvements:
 * - Active tab: accent + bold + ●, Inactive: dim + ○
 * - Tab count: " │ N Tabs" right-aligned
 * - URL + status grouped with icons (🔒 URL  🟢 200 OK)
 * - Content hierarchy: title(accent), status(state color), preview(dim)
 * - Footer: "Last Action" label
 * - Tab overflow: "○ A ○ B ○ C ... (+5)"
 * - Empty state: "🌐 No active tabs"
 * - Error UX: dedicated messages with 🟢🟡🔴 icons
 * - Runtime metadata: dim gray
 * - Header: "🌐 Browser"
 * - URL clickable via OSC 8 hyperlink
 * - Color hierarchy verified
 */

import { Box, Text } from '../../ink.js';
import { shortActionResult, parseLastOperationForDisplay } from './WebBrowserTool.js';
import type { BrowserAction } from './types.js';
import * as React from 'react';
import { useEffect, useState, useMemo, useCallback, useRef } from 'react';

import { BrowserToolExecutor } from './browserEngine.js';
export { BrowserToolExecutor };
import { EMPTY_BROWSER_LIVE_STATE, type BrowserErrorCategory, type BrowserLiveState, type BrowserTabState } from './types.js';
import { resolveLogoSpinnerColors } from '../../components/StartupScreen.palettes.js';
import { getGlobalConfig } from '../../utils/config.js';
import type { Color } from '../../ink/styles.js';

// Heavy (thick) box-drawing set for the OUTER frame.
const HEAVY = { tl: '\u250F', tr: '\u2513', bl: '\u2517', br: '\u251B', h: '\u2501', v: '\u2503' };
// Light (thin) box-drawing set for INNER divider rules.
const LIGHT = { lt: '\u251C', rt: '\u2524', h: '\u2500' };

const SPINNER_FRAMES = ['\u25D0', '\u25D3', '\u25D1', '\u25D2'];
const SPINNER_INTERVAL_MS = 120;

const MAX_VISIBLE_TABS = 5;
const MAX_TAB_TITLE_LEN = 16;
const MIN_TAB_TITLE_LEN = 6;
const PREVIEW_MAX_LINES = 2;
const CONTENT_PADDING = 2;
const MAX_CONTENT_LINES = 8;

function computeBoxWidth(): number {
  const terminalWidth = process.stdout && process.stdout.columns ? process.stdout.columns : 80;
  return Math.max(60, Math.min(terminalWidth - 2, 140));
}

// HTTP status class colors
const HTTP_CLASS_COLORS = {
  success: 'success',      // 2xx - Green
  redirect: 'warning',     // 3xx - Yellow
  client_error: 'error',   // 4xx - Red
  server_error: 'error',   // 5xx - Red
};

const STATUS_LABELS: Record<number, string> = {
  200: 'OK', 201: 'Created', 204: 'No Content',
  301: 'Moved Permanently', 302: 'Found', 304: 'Not Modified',
  400: 'Bad Request', 401: 'Unauthorized', 403: 'Forbidden',
  404: 'Not Found', 429: 'Rate Limited',
  500: 'Server Error', 502: 'Bad Gateway', 503: 'Service Unavailable',
};

// Status icons for quick scanning
const STATUS_ICONS = {
  success: '\uD83D\uDFE2',       // 🟢
  redirect: '\uD83D\uDFE1',      // 🟡
  client_error: '\uD83D\uDD34',   // 🔴
  server_error: '\uD83D\uDD34',   // 🔴
  warning: '\uD83D\uDFE1',       // 🟡
  loading: '\uD83D\uDFE3',       // 🔵
  local: '\uD83D\uDCC4',         // 📄
  secure: '\uD83D\uDD12',        // 🔒
  insecure: '\u26A0',            // ⚠
  captcha: '\u26A0\uFE0F',       // ⚠️
  browser: '\uD83C\uDF10',       // 🌐
  tab_count: '\u2502',           // │
};

function getHttpStatusClass(status: number): 'success' | 'redirect' | 'client_error' | 'server_error' {
  if (status >= 200 && status < 300) return 'success';
  if (status >= 300 && status < 400) return 'redirect';
  if (status >= 400 && status < 500) return 'client_error';
  return 'server_error';
}

/**
 * Strip ANSI escape sequences from a string for accurate width calculation.
 */
function stripAnsi(str: string): string {
  return str.replace(/\u001B\[[0-9;]*m/g, '')
    .replace(/\u001B\]8;;[^\u0007]*\u0007/g, '')
    .replace(/\u001B\]8;;\u0007/g, '');
}

/**
 * Best-effort visible-column-width estimate using stripped text.
 * Plain ASCII counts as 1; common emoji ranges count as 2 (most terminals render them double-wide);
 * zero-width joiners/variation selectors count as 0; the heavy/light
 * box-drawing characters used by this file count as 1.
 */
function displayWidth(str: string): number {
  const clean = stripAnsi(str);
  let width = 0;
  for (const ch of clean) {
    const code = ch.codePointAt(0) ?? 0;
    if (code === 0x200d || (code >= 0xfe00 && code <= 0xfe0f)) continue;
    if ((code >= 0x1f300 && code <= 0x1faff) || (code >= 0x2600 && code <= 0x27bf)) width += 2;
    else width += 1;
  }
  return width;
}

/** Truncate with an ellipsis, based on displayWidth (not .length). */
function truncate(text: string, maxWidth: number): string {
  if (displayWidth(text) <= maxWidth) return text;
  if (maxWidth <= 1) return '\u2026';
  let out = '', w = 0;
  for (const ch of text) {
    const cw = displayWidth(ch);
    if (w + cw > maxWidth - 1) break;
    out += ch; w += cw;
  }
  return `${out}\u2026`;
}

/**
 * Wraps `label` in an OSC 8 terminal hyperlink escape pointing at `url`.
 * Width math is ALWAYS done against plain label text BEFORE wrapping.
 * Adds underline for visual clickability indication.
 */
function hyperlink(url: string, label: string): string {
  if (!process.stdout || !process.stdout.isTTY) return label;
  // OSC 8: \e]8;;{url}\e\{label}\e]8;;\e\
  // Underline (4) + OSC 8 for clear clickable indication
  return `\u001B[4m\u001B]8;;${url}\u0007${label}\u001B]8;;\u0007\u001B[24m`;
}

/**
 * Normalize tab title to short, consistent form.
 */
function normalizeTabTitle(title: string, url: string): string {
  if (!title || title.trim() === '') {
    try { return new URL(url).hostname.replace('www.', ''); } catch { return 'New Tab'; }
  }
  let n = title
    .replace(/\s*[-|]\s*(BBC|News|Reuters|Guardian|AP|Associated Press|Breaking|Latest|Home).*$/i, '')
    .replace(/\s*[-|]\s*.*$/i, '')
    .trim();
  if (n.length < 3 || /^(home|index|main|default)$/i.test(n)) {
    try { n = new URL(url).hostname.replace('www.', ''); } catch {}
  }
  return n;
}

/**
 * Check if a tab is a placeholder (about:blank) that should be hidden from UI.
 */
function isPlaceholderTab(tab: BrowserTabState): boolean {
  if (!tab.url) return true;
  try {
    const u = new URL(tab.url);
    return u.protocol === 'about:' && (u.hostname === 'blank' || u.href === 'about:blank');
  } catch { return false; }
}

/**
 * Filter out placeholder tabs for UI display.
 */
function getVisibleTabs(tabs: BrowserTabState[]): BrowserTabState[] {
  return tabs.filter(t => !isPlaceholderTab(t));
}

interface ParsedUrl {
  isSecure: boolean; isLocal: boolean; isFile: boolean; isBlank: boolean;
  hostname: string; pathAndQuery: string; display: string;
}

function parseUrl(url: string | null): ParsedUrl | null {
  if (!url) return null;
  try {
    const u = new URL(url);
    const isFile = u.protocol === 'file:';
    const isBlank = u.protocol === 'about:';
    const isOpaque = isBlank || u.protocol === 'data:' || u.protocol === 'javascript:';
    const hostname = u.hostname || (isFile || isOpaque ? '' : u.protocol.replace(':', ''));
    const isLocal = hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]' || isFile || isBlank;
    const pathAndQuery = u.pathname === '/' ? '' : u.pathname + u.search;
    return {
      isSecure: u.protocol === 'https:', isLocal, isFile, isBlank,
      hostname: hostname + (u.port ? `:${u.port}` : ''),
      pathAndQuery,
      display: isFile || isOpaque ? url : hostname + (u.port ? `:${u.port}` : '') + pathAndQuery,
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
  const visibleTabs = getVisibleTabs(state.tabs);
  if (visibleTabs.length === 0) return { kind: 'no_tabs' };
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

function borderChrome(panelState: PanelState): { title: string; color: Color } {
  const logoColor = getGlobalConfig()?.logoColor ?? 'aurora';
  const accentColor: Color = resolveLogoSpinnerColors(logoColor).accent;
  switch (panelState.kind) {
    case 'network_error': return { title: '\uD83C\uDF10 Browser Error', color: accentColor };
    case 'captcha': return { title: '\uD83C\uDF10 Browser Attention Required', color: accentColor };
    case 'http_error': return { title: '\uD83C\uDF10 Browser', color: accentColor };
    default: return { title: '\uD83C\uDF10 Browser', color: accentColor };
  }
}

// Parse last action - defined outside component to avoid re-creation on every render
function parseLastAction(raw?: string) {
  if (!raw) return null;
  const kw = raw.split(' ')[0], rest = raw.split(' ', 2)[1] ?? '';
  const acts = ['navigate','click','type','get_state','get_content','scroll','go_back','list_tabs','switch_tab','close_tab','close_all_tabs','get_storage','set_storage','start_recording','stop_recording','refresh','wait','press_key'];
  if (!acts.includes(kw)) return null;
  if (kw === 'navigate') return { action: 'navigate', url: rest, new_tab: false };
  if (kw === 'click') return { action: 'click', selector: rest, index: undefined, new_tab: false };
  if (kw === 'type') return { action: 'type', text: rest, selector: undefined, index: undefined, new_tab: false };
  if (kw === 'scroll') return { action: 'scroll', direction: rest, index: undefined, new_tab: false };
  if (kw === 'switch_tab') {
    const parts = raw.split(' ');
    return { action: 'switch_tab', tab_id: parts[1], url: parts.slice(2).join(' '), index: undefined, new_tab: false };
  }
  if (kw === 'close_tab') {
    const parts = raw.split(' ');
    return { action: 'close_tab', tab_id: parts[1], url: parts.slice(2).join(' '), index: undefined, new_tab: false };
  }
  if (kw === 'wait') return { action: 'wait', ms: Number(rest), selector: undefined, index: undefined, new_tab: false };
  if (kw === 'press_key') return { action: 'press_key', key: rest, selector: undefined, index: undefined, new_tab: false };
  if (kw === 'get_state') return { action: 'get_state', include_screenshot: false, selector: undefined, index: undefined, new_tab: false };
  if (kw === 'get_content') return { action: 'get_content', extract_links: false, start_from_char: 0, selector: undefined, index: undefined, new_tab: false };
  if (kw === 'list_tabs') return { action: 'list_tabs', selector: undefined, index: undefined, new_tab: false };
  if (kw === 'close_all_tabs') return { action: 'close_all_tabs', selector: undefined, index: undefined, new_tab: false };
  if (kw === 'get_storage') return { action: 'get_storage', selector: undefined, index: undefined, new_tab: false };
  if (kw === 'start_recording') return { action: 'start_recording', selector: undefined, index: undefined, new_tab: false };
  if (kw === 'stop_recording') return { action: 'stop_recording', selector: undefined, index: undefined, new_tab: false };
  if (kw === 'refresh') return { action: 'refresh', selector: undefined, index: undefined, new_tab: false };
  return { action: 'navigate', url: kw, new_tab: false };
}

function contextMessage(panelState: PanelState): string {
  switch (panelState.kind) {
    case 'no_tabs': return 'No active tabs. Use navigate(url) to open a page.';
    case 'loading': return 'Loading page content...';
    case 'network_error': return 'Unable to connect to website.';
    case 'captcha': return 'Human verification required.';
    case 'http_error':
      if (panelState.status === 404) return 'Requested page not found.';
      if (panelState.status === 403) return 'Access forbidden.';
      if (panelState.status === 429) return 'Rate limit exceeded.';
      if (panelState.status >= 500) return 'Server returned an internal error.';
      return `Server returned HTTP ${panelState.status}.`;
    case 'redirect': return 'Following redirect...';
    case 'local_file': return 'Local content loaded.';
    case 'ready': return 'Page loaded successfully.';
  }
}

function getErrorInfo(panelState: PanelState): { icon: string; title: string; desc: string; color: string } {
  switch (panelState.kind) {
    case 'http_error': {
      const cls = getHttpStatusClass(panelState.status);
      const label = STATUS_LABELS[panelState.status] || 'Error';
      return { icon: STATUS_ICONS[cls], title: `HTTP ${panelState.status} ${label}`, desc: contextMessage(panelState), color: HTTP_CLASS_COLORS[cls] };
    }
    case 'network_error': {
      const cat = ERROR_CATEGORY_LABELS[panelState.category];
      return { icon: STATUS_ICONS.client_error, title: cat.label, desc: panelState.message, color: 'error' };
    }
    case 'captcha': return { icon: STATUS_ICONS.captcha, title: 'Human Verification Required', desc: 'Site requested CAPTCHA validation.', color: 'warning' };
    case 'redirect': {
      const label = STATUS_LABELS[panelState.status] || 'Redirect';
      return { icon: STATUS_ICONS.redirect, title: `HTTP ${panelState.status} ${label}`, desc: 'Following redirect...', color: 'warning' };
    }
    case 'local_file': return { icon: STATUS_ICONS.local, title: 'Local File', desc: 'Not browsing the internet.', color: 'subtle' };
    case 'loading': return { icon: STATUS_ICONS.loading, title: 'Loading...', desc: 'Loading page content...', color: 'brand' };
    case 'ready':
      if (panelState.status) {
        const cls = getHttpStatusClass(panelState.status);
        const label = STATUS_LABELS[panelState.status] || 'OK';
        return { icon: STATUS_ICONS[cls], title: `${panelState.status} ${label}`, desc: 'Page loaded successfully.', color: HTTP_CLASS_COLORS[cls] };
      }
      return { icon: STATUS_ICONS.success, title: 'Ready', desc: 'Page loaded successfully.', color: 'success' };
    default: return { icon: '', title: '', desc: '', color: 'dim' };
  }
}

function useSpinnerFrame(active: boolean): string {
  const [frame, setFrame] = useState(0);
  const activeRef = useRef(active);
  activeRef.current = active;

  useEffect(() => {
    const timer = setInterval(() => {
      if (activeRef.current) setFrame((f) => (f + 1) % SPINNER_FRAMES.length);
    }, SPINNER_INTERVAL_MS);
    return () => clearInterval(timer);
  }, []);
  return SPINNER_FRAMES[frame];
}

// ============================================================
// Hand-drawn frame primitives
// ============================================================

/** Heavy (thick) top border with the title embedded. */
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
 * calculation.
 * Renders as a single Text element to ensure perfect border alignment.
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
  const safeContent = displayWidth(plainText) <= innerWidth ? plainText : truncate(plainText, innerWidth);
  const padLen = Math.max(0, innerWidth - displayWidth(safeContent));
  const fullLine = `${HEAVY.v} ${safeContent}${' '.repeat(padLen)} ${HEAVY.v}`;

  return (
    <Text bold color={accentColor}>
      {fullLine}
    </Text>
  );
}

// ============================================================
// Section content builders
// ============================================================

/**
 * Build tab bar with:
 * - Active: accent + bold + ●
 * - Inactive: dim + ○
 * - Overflow: "○ A ○ B ○ C ... (+5)"
 * - Tab count: " │ N Tabs" right-aligned
 */
function buildTabsRow(tabs: BrowserTabState[], currentUrl: string | null, innerWidth: number): { plainText: string } {
  const visibleTabs = getVisibleTabs(tabs);

  if (visibleTabs.length === 0) {
    return { plainText: '\uD83C\uDF10 No active tabs' };
  }

  const activeIndex = visibleTabs.findIndex(t => t.url === currentUrl);
  const displayTabs: BrowserTabState[] = [];
  let overflow = 0;

  if (visibleTabs.length <= MAX_VISIBLE_TABS) {
    displayTabs.push(...visibleTabs);
  } else {
    if (activeIndex >= 0 && activeIndex < visibleTabs.length) {
      const rem = MAX_VISIBLE_TABS - 1;
      const before = Math.min(activeIndex, Math.floor(rem / 2));
      const after = Math.min(visibleTabs.length - activeIndex - 1, rem - before);
      displayTabs.push(...visibleTabs.slice(activeIndex - before, activeIndex + after + 1));
      overflow = visibleTabs.length - displayTabs.length;
    } else {
      displayTabs.push(...visibleTabs.slice(0, MAX_VISIBLE_TABS));
      overflow = visibleTabs.length - MAX_VISIBLE_TABS;
    }
  }

  const tabLabels = displayTabs.map(tab => ({
    label: truncate(normalizeTabTitle(tab.title || tab.url, tab.url), MAX_TAB_TITLE_LEN),
    isActive: tab.url === currentUrl,
  }));

  // Build tab segments: active gets ●, inactive gets ○
  let tabSegment = tabLabels.map((t, i) => {
    const dot = t.isActive ? '\u25CF' : '\u25CB'; // ● ○
    return `${dot} ${t.label}`;
  }).join('  ');

  if (overflow > 0) {
    tabSegment += `  ... (+${overflow})`;
  }

  // Tab count: " │ N Tabs" right-aligned
  const countStr = ` ${STATUS_ICONS.tab_count} ${visibleTabs.length} Tab${visibleTabs.length !== 1 ? 's' : ''}`;
  const countWidth = displayWidth(countStr);
  const availableWidth = innerWidth - countWidth;

  if (displayWidth(tabSegment) > availableWidth) {
    tabSegment = truncate(tabSegment, availableWidth);
  }

  const plainText = tabSegment + countStr;

  return { plainText };
}

function getUrlIcon(state: BrowserLiveState, parsed: ParsedUrl | null, panelState: PanelState): { icon: string; color: string } {
  if (state.isLoading) return { icon: STATUS_ICONS.loading, color: 'brand' };
  if (parsed?.isFile) return { icon: STATUS_ICONS.local, color: 'subtle' };
  if (parsed?.isLocal) return { icon: STATUS_ICONS.insecure, color: 'warning' };
  if (parsed?.isSecure) return { icon: STATUS_ICONS.secure, color: 'success' };

  // Fallback based on panel state
  if (panelState.kind === 'captcha') return { icon: STATUS_ICONS.captcha, color: 'warning' };
  if (panelState.kind === 'network_error') return { icon: STATUS_ICONS.client_error, color: 'error' };
  if (panelState.kind === 'http_error') return { icon: STATUS_ICONS.client_error, color: 'error' };
  if (panelState.kind === 'redirect') return { icon: STATUS_ICONS.redirect, color: 'warning' };
  return { icon: STATUS_ICONS.insecure, color: 'warning' };
}

/**
 * Build URL bar: "🔒 apnews.com    🟢 200 OK" (grouped with status icon)
 * URL is clickable via OSC 8 hyperlink
 */
function buildUrlRow(state: BrowserLiveState, parsed: ParsedUrl | null, panelState: PanelState, urlLabel: string, innerWidth: number): { plainText: string } {
  const errorInfo = getErrorInfo(panelState);
  const urlIcon = getUrlIcon(state, parsed, panelState);

  const badgeText = errorInfo.title;
  const iconSpace = `${urlIcon.icon} `;
  const badgeSpace = `  ${errorInfo.icon} ${badgeText}`;
  const reserved = innerWidth - displayWidth(iconSpace) - displayWidth(badgeSpace) - 2;
  const safeUrl = displayWidth(urlLabel) <= reserved ? urlLabel : truncate(urlLabel, Math.max(MIN_TAB_TITLE_LEN, reserved));

  // URL with OSC 8 hyperlink for clickable
  const linkedUrl = state.currentUrl ? hyperlink(state.currentUrl, safeUrl) : safeUrl;
  const urlPart = `${iconSpace}${linkedUrl}`;
  const pad = Math.max(2, innerWidth - displayWidth(`${iconSpace}${safeUrl}`) - displayWidth(badgeSpace));

  const plainText = `${iconSpace}${safeUrl}${' '.repeat(pad)}${badgeSpace}`;

  return { plainText };
}

function wrapText(text: string, lineWidth: number): string[] {
  const lines: string[] = []; const words = text.split(/\s+/); let cur = '';
  for (const w of words) {
    const test = cur ? `${cur} ${w}` : w;
    if (displayWidth(test) <= lineWidth) cur = test;
    else { if (cur) lines.push(cur); if (displayWidth(w) > lineWidth) { lines.push(truncate(w, lineWidth)); cur = ''; } else cur = w; }
  } if (cur) lines.push(cur); return lines;
}

function buildContentSummary(content: string): string[] {
  const lines = content.split('\n').map(l => l.trim()).filter(l => l.length > 0);
  const out: string[] = [];
  for (const l of lines) {
    if (l.length > 200 || l.length < 10) continue;
    if (/^(skip|menu|navigation|subscribe|sign in|log in|cookie|privacy|terms|search)/i.test(l)) continue;
    out.push(l); if (out.length >= 5) break;
  }
  return out.length > 0 ? out : [content.slice(0, 400)];
}

function getContentLineColor(panelState: PanelState, lineIndex: number, isTitle: boolean): string {
  if (isTitle) return 'accent';
  // Status line (first non-title line)
  if (lineIndex === (panelState.kind === 'no_tabs' ? 0 : 1)) {
    switch (panelState.kind) {
      case 'ready': return 'success';
      case 'loading': return 'brand';
      case 'captcha': return 'warning';
      case 'http_error': case 'network_error': return 'error';
      case 'redirect': return 'warning';
      case 'local_file': return 'subtle';
      default: return 'dim';
    }
  }
  return 'dim';
}

function buildContentLines(state: BrowserLiveState, panelState: PanelState, innerWidth: number): { text: string; isTitle: boolean }[] {
  const cw = innerWidth - CONTENT_PADDING * 2;
  const out: { text: string; isTitle: boolean }[] = [];

  if (panelState.kind === 'no_tabs') {
    return [
      { text: 'No active tabs.', isTitle: false },
      { text: 'Use navigate(url) to open a page.', isTitle: false }
    ];
  }

  let lineIdx = 0;
  if (state.currentTitle) {
    out.push(...wrapText(state.currentTitle, cw).map(t => ({ text: t, isTitle: true })));
    lineIdx++;
  }

  // Status message with error info
  const err = getErrorInfo(panelState);
  const statusLine = `${err.icon} ${err.title}`;
  out.push(...wrapText(statusLine, cw).map((t, i) => ({ text: t, isTitle: i === 0 })));
  lineIdx++;

  if (panelState.kind === 'ready' && state.contentPreview) {
    for (const l of buildContentSummary(state.contentPreview)) {
      out.push(...wrapText(l, cw).map(t => ({ text: t, isTitle: false })));
    }
  }

  if (out.length === 0) out.push({ text: ' ', isTitle: false });

  if (out.length > MAX_CONTENT_LINES) {
    out.length = MAX_CONTENT_LINES - 1;
    out.push({ text: '\u2026 more content available (use get_content)', isTitle: false });
  }

  return out;
}

// ============================================================
// MAIN COMPONENT
// ============================================================

export function WebBrowserPanel(): React.ReactNode {
  const [state, setState] = useState<BrowserLiveState>(EMPTY_BROWSER_LIVE_STATE);

  // Memoize width computation - only changes on terminal resize
  const [width, setWidth] = useState(() => computeBoxWidth());
  useEffect(() => {
    const handler = () => setWidth(computeBoxWidth());
    process.stdout?.on('resize', handler);
    // Braced so the cleanup returns void: `off()` returns the stream itself,
    // which React would otherwise reject as a destructor.
    return () => {
      process.stdout?.off('resize', handler);
    };
  }, []);

  useEffect(() => {
    let unsub: (() => void) | null = null;
    let poll: ReturnType<typeof setInterval> | null = null;
    let retries = 0;
    const MAX_RETRIES = 30; // 30 seconds max

    const attach = (ex: BrowserToolExecutor) => {
      setState(ex.getLiveState());
      unsub = ex.onLiveStateChange(setState);
      if (poll) { clearInterval(poll); poll = null; }
    };

    const existing = BrowserToolExecutor.getSharedIfExists();
    if (existing) {
      attach(existing);
    } else {
      poll = setInterval(() => {
        const ex = BrowserToolExecutor.getSharedIfExists();
        if (ex) {
          attach(ex);
        } else if (++retries >= MAX_RETRIES) {
          clearInterval(poll!);
        }
      }, 1000);
    }

    return () => {
      if (unsub) unsub();
      if (poll) clearInterval(poll);
    };
  }, []);

  const innerWidth = width - 4;
  const parsed = parseUrl(state.currentUrl);
  const panelState = derivePanelState(state, parsed);
  const { title: borderTitle, color: accentColor } = borderChrome(panelState);

  // Memoize expensive computations
  const tabsRow = useMemo(() => buildTabsRow(state.tabs, state.currentUrl, innerWidth), [state.tabs, state.currentUrl, innerWidth]);
  const urlLabel = useMemo(() => parsed ? truncate(parsed.display, Math.max(20, innerWidth - 20)) : 'about:blank', [parsed, innerWidth]);
  const urlRow = useMemo(() => buildUrlRow(state, parsed, panelState, urlLabel, innerWidth), [state, parsed, panelState, urlLabel, innerWidth]);
  const contentLines = useMemo(() => buildContentLines(state, panelState, innerWidth), [state, panelState, innerWidth]);

  // Memoize error info and url icon for URL row rendering
  const errorInfo = useMemo(() => getErrorInfo(panelState), [panelState]);
  const urlIcon = useMemo(() => getUrlIcon(state, parsed, panelState), [state, parsed, panelState]);

  // Parse last action (memoized callback outside component)
  const lastRaw = state.lastOperation ?? undefined;
  const parsedAct = useMemo(() => parseLastAction(lastRaw), [lastRaw]);
  const parsedOp = useMemo(() => parseLastOperationForDisplay(lastRaw), [lastRaw]);
  const verb = parsedAct ? parsedAct.action.toUpperCase() : null;
  // parseLastAction reconstructs a display shape from the logged operation
  // string, so it is narrowed rather than validated here — the panel only ever
  // reads it to build a label.
  const summary = parsedAct ? shortActionResult(parsedAct as BrowserAction) : null;
  // For switch_tab/close_tab, use the URL from parseLastOperationForDisplay
  const displaySummary = parsedOp ? `${parsedOp.verb} \u2192 ${parsedOp.summary}` : (verb ? `${verb} \u2192 ${summary}` : null);
  const footerText = displaySummary ? truncate(`Last Action: ${displaySummary}`, innerWidth) : null;

  const autoSwitch = state.autoSwitchedToNewTab ? truncate('\u2192 New tab opened and focused', innerWidth) : null;
  const recording = state.isRecording ? truncate(`REC${state.recordingEventCount > 0 ? ` (${state.recordingEventCount})` : ''}`, innerWidth) : null;

  if (!state.isInitialized) return null;

  return (
    <Box flexDirection="column" width="100%">
      {/* Header: 🌐 Browser */}
      <TopBorder title={borderTitle} color={accentColor} width={width} />

      {/* Tabs: active accent+bold, inactive dim, count right-aligned */}
      <Divider width={width} accentColor={accentColor} />
      <ContentRow plainText={tabsRow.plainText} width={width} accentColor={accentColor}>
        {tabsRow.plainText === '\uD83C\uDF10 No active tabs' ? (
          <Text dimColor>\uD83C\uDF10 No active tabs</Text>
        ) : (
          <>
            {state.tabs
              .filter(t => !isPlaceholderTab(t))
              .slice(0, MAX_VISIBLE_TABS)
              .map((tab, idx) => {
                const isActive = tab.url === state.currentUrl;
                const label = truncate(normalizeTabTitle(tab.title || tab.url, tab.url), MAX_TAB_TITLE_LEN);
                return (
                  <Text key={idx} color={isActive ? 'accent' : undefined} dimColor={!isActive} bold={isActive}>
                    {idx > 0 ? '  ' : ''}
                    {isActive ? '\u25CF' : '\u25CB'} {label}
                  </Text>
                );
              })}
            {state.tabs.filter(t => !isPlaceholderTab(t)).length > MAX_VISIBLE_TABS && (
              <Text dimColor>  ... (+{state.tabs.filter(t => !isPlaceholderTab(t)).length - MAX_VISIBLE_TABS})</Text>
            )}
            <Text dimColor>
              {` ${STATUS_ICONS.tab_count} ${state.tabs.filter(t => !isPlaceholderTab(t)).length} Tab${state.tabs.filter(t => !isPlaceholderTab(t)).length !== 1 ? 's' : ''}`}
            </Text>
          </>
        )}
      </ContentRow>
      <Divider width={width} accentColor={accentColor} />

      {/* URL + status grouped with icons: 🔒 URL  🟢 200 OK */}
      <ContentRow plainText={urlRow.plainText} width={width} accentColor={accentColor}>
        <Text color={state.isLoading ? 'brand' : urlIcon.color} dimColor={Boolean(parsed?.isLocal) && !state.isLoading}>
          {state.isLoading ? SPINNER_FRAMES[0] : urlIcon.icon}{' '}
        </Text>
        <Text dimColor={Boolean(parsed?.isLocal)} color={parsed?.isLocal ? undefined : 'accent'}>
          {state.currentUrl ? hyperlink(state.currentUrl, truncate(urlLabel, Math.max(MIN_TAB_TITLE_LEN, innerWidth - displayWidth(urlRow.plainText) - 10))) : urlLabel}
        </Text>
        <Text color={errorInfo.color} bold={panelState.kind !== 'ready' && panelState.kind !== 'local_file'}>
          {errorInfo.icon} {errorInfo.title}
        </Text>
      </ContentRow>
      <Divider width={width} accentColor={accentColor} />

      {/* Content: title(accent), status(state color), preview(dim) */}
      {contentLines.map((line, i) =>
        <ContentRow key={i} plainText={line.text} width={width} accentColor={accentColor}>
          <Text color={getContentLineColor(panelState, i, line.isTitle)}>
            {line.text}
          </Text>
        </ContentRow>
      )}

      {autoSwitch && (
        <ContentRow plainText={autoSwitch} width={width} accentColor={accentColor}>
          <Text color="accent">{autoSwitch}</Text>
        </ContentRow>
      )}

      {recording && (
        <ContentRow plainText={recording} width={width} accentColor={accentColor}>
          <Text color="accent" bold>\u25CF {recording.replace(/^REC\s*/, '')}</Text>
        </ContentRow>
      )}

      {/* Footer: "Last Action" label */}
      {footerText && (
        <>
          <Divider width={width} accentColor={accentColor} />
          <ContentRow plainText={footerText} width={width} accentColor={accentColor}>
            <Text color="accent">{footerText}</Text>
          </ContentRow>
        </>
      )}

      <BottomBorder color={accentColor} width={width} />
    </Box>
  );
}