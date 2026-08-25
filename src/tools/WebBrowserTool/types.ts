/**
 * Shared types for the browser tool engine.
 *
 * LAYER 1 — GakrCLI-AGNOSTIC. This file depends only on `zod` and Node stdlib.
 * Ported from openhands/tools/browser_use/definition.py (Action/Observation
 * schemas) and impl.py (constants).
 */

import path from 'node:path';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { z } from 'zod/v4';

// ============================================================
// Constants (ported from definition.py / impl.py)
// ============================================================

/** Directory where browser session recordings are saved. */
export const BROWSER_RECORDING_OUTPUT_DIR = path.join('.agent_tmp', 'browser_observations');

/** Default per-action timeout, in seconds (impl.py DEFAULT_BROWSER_ACTION_TIMEOUT_SECONDS). */
export const DEFAULT_BROWSER_ACTION_TIMEOUT_SECONDS = 300;

/** After this many consecutive timeout failures, reset the browser session. */
export const MAX_CONSECUTIVE_FAILURES = 3;

/** Shorter timeout used on the last retry before a reset would trigger. */
export const DEGRADED_TIMEOUT_SECONDS = 30;

/** Mapping of base64 prefixes to MIME types for image detection. */
const BASE64_IMAGE_PREFIXES: Record<string, string> = {
  '/9j/': 'image/jpeg',
  iVBORw0KGgo: 'image/png',
  R0lGODlh: 'image/gif',
  UklGR: 'image/webp',
};

export function detectImageMimeType(base64Data: string): string {
  for (const [prefix, mimeType] of Object.entries(BASE64_IMAGE_PREFIXES)) {
    if (base64Data.startsWith(prefix)) return mimeType;
  }
  return 'image/png';
}

// ============================================================
// Content blocks (LLM-facing) — mirrors openhands TextContent/ImageContent
// ============================================================

export interface TextContent {
  type: 'text';
  text: string;
}

export interface ImageContent {
  type: 'image';
  /** data: URL form, e.g. "data:image/png;base64,...." */
  image_urls: string[];
}

export type LLMContentBlock = TextContent | ImageContent;

// ============================================================
// BrowserObservation (ported from definition.py BrowserObservation)
// ============================================================

const ERROR_MESSAGE_HEADER = 'Error while executing browser action:';

/**
 * Default max chars kept inline before truncation-with-save-to-disk kicks in.
 * Mirrors openhands.sdk.utils.DEFAULT_TEXT_CONTENT_LIMIT's role here; the
 * exact numeric value isn't exposed by the ported source, so a conservative
 * default is used. Override via BrowserObservation.textContentLimit if needed.
 */
const DEFAULT_TEXT_CONTENT_LIMIT = 50000;

function maybeTruncate(
  content: string,
  truncateAfter: number,
  saveDir: string | null,
  toolPrefix: string,
): string {
  if (content.length <= truncateAfter) return content;

  let savedNote = '';
  if (saveDir) {
    try {
      fs.mkdirSync(saveDir, { recursive: true });
      const hash = crypto.createHash('sha256').update(content).digest('hex').slice(0, 8);
      const filename = `${toolPrefix}_output_${hash}.txt`;
      const filePath = path.join(saveDir, filename);
      if (!fs.existsSync(filePath)) {
        fs.writeFileSync(filePath, content);
      }
      savedNote = `\n\n[Full output saved to: ${filePath}]`;
    } catch {
      // Non-fatal: fall through with the truncated text only.
      savedNote = '';
    }
  }

  return `${content.slice(0, truncateAfter)}\n\n... (truncated, ${content.length} total chars)${savedNote}`;
}

export interface BrowserObservationOpts {
  screenshotData?: string | null;
  fullOutputSaveDir?: string | null;
}

/**
 * BrowserObservation — ported field-for-field from definition.py.
 * Use `BrowserObservation.fromText(...)` as the constructor of record
 * (matches the Python classmethod usage throughout impl.py/browserEngine.ts).
 */
export class BrowserObservation {
  readonly text: string;
  readonly is_error: boolean;
  readonly screenshot_data: string | null;
  readonly full_output_save_dir: string | null;

  private constructor(
    text: string,
    isError: boolean,
    screenshotData: string | null,
    fullOutputSaveDir: string | null,
  ) {
    this.text = text;
    this.is_error = isError;
    this.screenshot_data = screenshotData;
    this.full_output_save_dir = fullOutputSaveDir;
  }

  static fromText(text: string, isError: boolean, opts: BrowserObservationOpts = {}): BrowserObservation {
    return new BrowserObservation(
      text,
      isError,
      opts.screenshotData ?? null,
      opts.fullOutputSaveDir ?? null,
    );
  }

  /** Ported from definition.py's `_save_screenshot`. */
  private saveScreenshot(base64Data: string, saveDir: string): string | null {
    try {
      fs.mkdirSync(saveDir, { recursive: true });
      const mimeType = detectImageMimeType(base64Data);
      let ext = mimeType.split('/')[1];
      if (ext === 'jpeg') ext = 'jpg';

      const contentHash = crypto.createHash('sha256').update(base64Data, 'utf-8').digest('hex').slice(0, 8);
      const filename = `browser_screenshot_${contentHash}.${ext}`;
      const filePath = path.join(saveDir, filename);

      if (!fs.existsSync(filePath)) {
        fs.writeFileSync(filePath, Buffer.from(base64Data, 'base64'));
      }
      return filePath;
    } catch {
      return null;
    }
  }

  /** Ported from definition.py's `to_llm_content` property. */
  toLLMContent(): LLMContentBlock[] {
    const llmContent: LLMContentBlock[] = [];

    if (this.is_error) {
      llmContent.push({ type: 'text', text: ERROR_MESSAGE_HEADER });
    }

    if (this.text) {
      llmContent.push({
        type: 'text',
        text: maybeTruncate(this.text, DEFAULT_TEXT_CONTENT_LIMIT, this.full_output_save_dir, 'browser'),
      });
    }

    if (this.screenshot_data) {
      const mimeType = detectImageMimeType(this.screenshot_data);

      if (this.full_output_save_dir) {
        const savedPath = this.saveScreenshot(this.screenshot_data, this.full_output_save_dir);
        if (savedPath) {
          llmContent.push({ type: 'text', text: `Screenshot saved to: ${savedPath}` });
        }
      }

      const dataUrl = `data:${mimeType};base64,${this.screenshot_data}`;
      llmContent.push({ type: 'image', image_urls: [dataUrl] });
    }

    return llmContent;
  }
}

// ============================================================
// BrowserConfig
// ============================================================

export interface BrowserProxyConfig {
  /** e.g. "http://proxy.internal:8080" — passed straight through to Playwright/Chromium. */
  server: string;
  username?: string;
  password?: string;
  /** Comma-separated hosts to bypass the proxy for (Playwright's `bypass` option). */
  bypass?: string;
}

export interface BrowserConfig {
  headless: boolean;
  allowed_domains: string[];
  executable_path?: string;
  chromium_sandbox: boolean;
  session_timeout_minutes: number;
  action_timeout_seconds: number;
  inject_scripts: string[] | null;
  /**
   * Outbound proxy for the Chromium process's network traffic. Needed in
   * sandboxed/containerized environments where the CLI's own shell has
   * internet access (via HTTP_PROXY/HTTPS_PROXY env vars a normal `curl`
   * picks up automatically) but a spawned Chromium subprocess does NOT
   * inherit that automatically — Chromium ignores proxy env vars unless
   * explicitly told. See browserEngine.ts's `resolveProxyFromEnv()` for the
   * env-var fallback used when this isn't set explicitly.
   */
  proxy?: BrowserProxyConfig | null;
}

// ============================================================
// Live browser state — consumed by WebBrowserPanel.tsx for a persistent
// status display, distinct from BrowserObservation (which is the per-call
// result the LLM sees). Kept intentionally cheap: URL/title/tabs/recording
// status are updated after every state-changing operation; screenshots are
// NOT auto-captured (expensive) and only populate lastScreenshot after an
// explicit BrowserToolExecutor.captureScreenshot() call.
// ============================================================

export interface BrowserTabState {
  tabId: string;
  title: string;
  url: string;
}

export interface BrowserLiveState {
  /** False until a browser session has actually been launched. */
  isInitialized: boolean;
  currentUrl: string | null;
  currentTitle: string | null;
  tabs: BrowserTabState[];
  isRecording: boolean;
  recordingEventCount: number;
  /** base64 PNG, only set after an explicit captureScreenshot() call. */
  lastScreenshot: string | null;
  /** epoch ms of the last state update. */
  lastUpdated: number;
  /** Most recent operation error, if any (cleared on the next successful op). */
  lastError: string | null;
  /** Short label of the most recent operation, e.g. "navigate https://…". */
  lastOperation: string | null;
  /** True while a navigate/refresh/goBack is in flight (drives the panel's loading indicator). */
  isLoading: boolean;
  /**
   * Coarse classification of lastError, if it looks connectivity-related
   * (DNS, connection refused/timed out, proxy, TLS, offline). Null for
   * non-network errors or when there's no error. See
   * `classifyNetworkError()` in browserServer.ts.
   */
  lastErrorCategory: BrowserErrorCategory | null;
  /**
   * HTTP status of the current page's main-frame response, captured from
   * Playwright's `goto()`/`reload()` return value. Null for same-document
   * navigations, local `file://`/`about:` pages, or before any navigation
   * has completed.
   */
  httpStatus: number | null;
  httpStatusText: string | null;
  /**
   * Best-effort heuristic: the page's title matched a common CAPTCHA/bot-
   * challenge pattern (Cloudflare, reCAPTCHA, hCaptcha, Turnstile, generic
   * "verify you are human" wording). This is NOT reliable detection — many
   * challenge pages don't set a distinctive title, and this can false-
   * positive on legitimate pages that happen to mention those words. Treat
   * it as a hint for the panel, never as something the tool acts on
   * automatically.
   */
  possibleCaptcha: boolean;
  /**
   * Set for one state update when a click/navigate caused the browser to
   * open a brand-new tab that the tool auto-focused (mirrors a real
   * browser switching to a newly opened tab). Cleared on the next
   * unrelated state update. Lets the panel/caller surface "opened in a
   * new tab" distinctly from an ordinary same-tab navigation — this was
   * the literal ambiguity reported in testing ("sometimes a new tab
   * opens, sometimes the existing tab's URL changes").
   */
  autoSwitchedToNewTab: boolean;
  /**
   * Short (≤300 char) plain-text excerpt of the page body, captured
   * opportunistically on navigate/refresh/go_back only (NOT on every
   * action — an innerText() read on every click/scroll would add cost for
   * little benefit, since the visible page usually doesn't change enough
   * between clicks to be worth re-previewing). Null until the first
   * successful navigation, and left stale (not cleared) on non-navigation
   * actions or on error, matching how httpStatus behaves.
   */
  contentPreview: string | null;
}

export type BrowserErrorCategory =
  | 'offline'
  | 'dns'
  | 'connection_refused'
  | 'timeout'
  | 'proxy'
  | 'tls'
  | 'blocked_by_allowlist'
  | 'other';

export const EMPTY_BROWSER_LIVE_STATE: BrowserLiveState = {
  isInitialized: false,
  currentUrl: null,
  currentTitle: null,
  tabs: [],
  isRecording: false,
  recordingEventCount: 0,
  lastScreenshot: null,
  lastUpdated: 0,
  lastError: null,
  lastOperation: null,
  isLoading: false,
  lastErrorCategory: null,
  httpStatus: null,
  httpStatusText: null,
  possibleCaptcha: false,
  autoSwitchedToNewTab: false,
  contentPreview: null,
};

// ============================================================
// Action zod schemas (ported field-for-field from definition.py)
// ============================================================

/**
 * LOG.MD ISSUE #1 FIX (HIGH priority): the tool-call harness that wraps
 * this tool serializes non-string parameters (booleans, numbers, objects)
 * to JSON/stringified form before they reach the tool, so e.g.
 * `new_tab: true` arrives as the STRING `"true"`, `storage_state: {...}`
 * arrives as a JSON string, and plain zod validation rejects all of them
 * with `InputValidationError: ... expected as 'boolean' but provided as
 * 'string'`. This was reported as breaking `set_storage` entirely, and —
 * separately in the same log — silently breaking `navigate`'s `new_tab`
 * param, which combined with the close_tab last-tab guard created an
 * unrecoverable deadlock (couldn't open a second tab, couldn't close the
 * only one). Root-caused to the SAME coercion gap in both cases.
 *
 * Fix: preprocess string-typed input for boolean/number/object fields
 * before validation, accepting the harness's stringified form while still
 * rejecting genuinely wrong types. This is the "contained fix in
 * WebBrowserTool.ts" the log itself proposed — applied here in types.ts
 * instead so BOTH WebBrowserTool.ts's LLM-facing schema and any other
 * caller of BrowserActionSchema get the same tolerance from one place
 * (see also the WebBrowserTool.ts dedup note below Action schemas).
 */
function looseBoolean(defaultValue?: boolean) {
  const schema = z.preprocess((v) => {
    if (typeof v !== 'string') return v;
    const trimmed = v.trim().toLowerCase();
    if (trimmed === 'true') return true;
    if (trimmed === 'false') return false;
    try {
      const parsed = JSON.parse(v);
      return typeof parsed === 'boolean' ? parsed : v;
    } catch {
      return v;
    }
  }, z.boolean());
  return defaultValue === undefined ? schema : schema.default(defaultValue);
}

/**
 * BUGFIX (reported at runtime): `z.preprocess(fn, schema)` in zod v4
 * returns a ZodPipe/effects wrapper, NOT the inner schema's type — so
 * ZodNumber-only methods like `.int()`/`.min()`/`.max()` don't exist on
 * whatever `looseNumber()` returns and calling them throws
 * `TypeError: looseNumber(...).int is not a function` at MODULE LOAD TIME
 * (schema construction, not even at validation time). Generic ZodType
 * methods (`.optional()`, `.default()`, `.describe()`) ARE present on the
 * wrapper and chain fine — only the ZodNumber-specific refinements break.
 * Fix: build the fully-constrained number schema FIRST, then wrap that in
 * preprocess, instead of wrapping a bare `z.number()` and trying to add
 * constraints after.
 */
function looseNumber<T extends z.ZodNumber>(inner: T = z.number() as T) {
  return z.preprocess((v) => {
    if (typeof v !== 'string') return v;
    const trimmed = v.trim();
    if (trimmed === '') return v;
    const n = Number(trimmed);
    return Number.isNaN(n) ? v : n;
  }, inner);
}

function looseObject<T extends z.ZodTypeAny>(schema: T) {
  return z.preprocess((v) => {
    if (typeof v !== 'string') return v;
    try {
      return JSON.parse(v);
    } catch {
      return v;
    }
  }, schema);
}

export const BrowserNavigateActionSchema = z.strictObject({
  action: z.literal('navigate'),
  url: z.string().describe('The URL to navigate to'),
  new_tab: looseBoolean(false).describe('Whether to open in a new tab. Default: False'),
});

export const BrowserClickActionSchema = z.strictObject({
  action: z.literal('click'),
  index: looseNumber(z.number().int().min(0))
    .optional()
    .describe(
      'The index of the element to click (from browser_get_state). Ignored if `selector` is provided.',
    ),
  // LOG.MD ISSUE #3 FIX (LOW priority): the occurrence-index from
  // get_state is fragile — any DOM change between get_state and click
  // silently invalidates it, and hand-counting occurrences on
  // element-dense pages is error-prone. `selector` lets the caller target
  // an element directly via CSS/ARIA selector instead, bypassing the
  // index entirely. `index` remains supported for backward compatibility
  // and stays the default path when both are omitted... one of the two
  // is required (enforced in browserServer.ts, not the schema, since zod
  // discriminated unions don't cleanly express "at least one of").
  selector: z.string().optional().describe('CSS selector to click directly, bypassing the element index.'),
  new_tab: looseBoolean(false).describe('Whether to open any resulting navigation in a new tab. Default: False'),
});

export const BrowserTypeActionSchema = z.strictObject({
  action: z.literal('type'),
  index: looseNumber(z.number().int().min(0))
    .optional()
    .describe('The index of the input element (from browser_get_state). Ignored if `selector` is provided.'),
  selector: z.string().optional().describe('CSS selector to type into directly, bypassing the element index.'),
  text: z.string().describe('The text to type'),
});

export const BrowserGetStateActionSchema = z.strictObject({
  action: z.literal('get_state'),
  include_screenshot: looseBoolean(false).describe(
    'Whether to include a screenshot of the current page. Default: False',
  ),
});

export const BrowserGetContentActionSchema = z.strictObject({
  action: z.literal('get_content'),
  extract_links: looseBoolean(false).describe('Whether to include links in the content (default: False)'),
  start_from_char: looseNumber(z.number().int().min(0))
    .default(0)
    .describe('Character index to start from in the page content (default: 0)'),
});

export const BrowserScrollActionSchema = z.strictObject({
  action: z.literal('scroll'),
  direction: z
    .enum(['up', 'down'])
    .default('down')
    .describe("Direction to scroll. Options: 'up', 'down'. Default: 'down'"),
});

export const BrowserGoBackActionSchema = z.strictObject({
  action: z.literal('go_back'),
});

export const BrowserListTabsActionSchema = z.strictObject({
  action: z.literal('list_tabs'),
});

export const BrowserSwitchTabActionSchema = z.strictObject({
  action: z.literal('switch_tab'),
  tab_id: z.string().describe('4 Character Tab ID of the tab to switch to (from browser_list_tabs)'),
});

export const BrowserCloseTabActionSchema = z.strictObject({
  action: z.literal('close_tab'),
  tab_id: z.string().describe('4 Character Tab ID of the tab to close (from browser_list_tabs)'),
});

export const BrowserCloseAllTabsActionSchema = z.strictObject({
  action: z.literal('close_all_tabs'),
});

export const BrowserGetStorageActionSchema = z.strictObject({
  action: z.literal('get_storage'),
});

export const StorageStateSchema = z.object({
  cookies: z.array(z.any()),
  origins: z.array(z.any()),
});

export const BrowserSetStorageActionSchema = z.strictObject({
  action: z.literal('set_storage'),
  storage_state: looseObject(StorageStateSchema).describe(
    "Storage state dictionary containing 'cookies' and 'origins' (from browser_get_storage)",
  ),
});

export const BrowserStartRecordingActionSchema = z.strictObject({
  action: z.literal('start_recording'),
});

export const BrowserStopRecordingActionSchema = z.strictObject({
  action: z.literal('stop_recording'),
});

// ISSUE 8/9/10: three new actions, all handled via plain Playwright.
export const BrowserRefreshActionSchema = z.strictObject({
  action: z.literal('refresh'),
});

export const BrowserWaitActionSchema = z.strictObject({
  action: z.literal('wait'),
  ms: looseNumber(z.number().int().min(100).max(30000)).describe('Milliseconds to wait (100-30000)'),
});

export const BrowserPressKeyActionSchema = z.strictObject({
  action: z.literal('press_key'),
  key: z.string().describe('The key to press (e.g. "Enter", "Escape", "Tab", "ArrowDown")'),
});

export const BrowserActionSchema = z.discriminatedUnion('action', [
  BrowserNavigateActionSchema,
  BrowserClickActionSchema,
  BrowserTypeActionSchema,
  BrowserGetStateActionSchema,
  BrowserGetContentActionSchema,
  BrowserScrollActionSchema,
  BrowserGoBackActionSchema,
  BrowserListTabsActionSchema,
  BrowserSwitchTabActionSchema,
  BrowserCloseTabActionSchema,
  BrowserCloseAllTabsActionSchema,
  BrowserGetStorageActionSchema,
  BrowserSetStorageActionSchema,
  BrowserStartRecordingActionSchema,
  BrowserStopRecordingActionSchema,
  BrowserRefreshActionSchema,
  BrowserWaitActionSchema,
  BrowserPressKeyActionSchema,
]);

export type BrowserAction = z.infer<typeof BrowserActionSchema>;

/**
 * Per-action lookup used to produce a targeted validation error instead of the
 * discriminated union's opaque one. A union-level failure reports
 * `invalid_union` with an empty `errors` array and `path: ['action']`, which
 * tells the model nothing about which field it actually got wrong; re-parsing
 * against the single variant the `action` selects yields the real message.
 *
 * The `satisfies` clause is the drift guard: adding a variant to
 * BrowserActionSchema without registering it here is a compile error, so this
 * map and the union cannot silently diverge.
 */
export const BROWSER_ACTION_SCHEMA_BY_NAME = {
  navigate: BrowserNavigateActionSchema,
  click: BrowserClickActionSchema,
  type: BrowserTypeActionSchema,
  get_state: BrowserGetStateActionSchema,
  get_content: BrowserGetContentActionSchema,
  scroll: BrowserScrollActionSchema,
  go_back: BrowserGoBackActionSchema,
  list_tabs: BrowserListTabsActionSchema,
  switch_tab: BrowserSwitchTabActionSchema,
  close_tab: BrowserCloseTabActionSchema,
  close_all_tabs: BrowserCloseAllTabsActionSchema,
  get_storage: BrowserGetStorageActionSchema,
  set_storage: BrowserSetStorageActionSchema,
  start_recording: BrowserStartRecordingActionSchema,
  stop_recording: BrowserStopRecordingActionSchema,
  refresh: BrowserRefreshActionSchema,
  wait: BrowserWaitActionSchema,
  press_key: BrowserPressKeyActionSchema,
} satisfies Record<BrowserAction['action'], z.ZodTypeAny>;

/**
 * The 18 action names, in schema order. The cast is sound because the
 * `satisfies` clause above proves the keys are exactly `BrowserAction['action']`.
 */
export const BROWSER_ACTION_NAMES = Object.keys(
  BROWSER_ACTION_SCHEMA_BY_NAME,
) as [BrowserAction['action'], ...BrowserAction['action'][]];

/**
 * PROVIDER-FACING input schema — flat, single `z.strictObject`.
 *
 * Why this exists alongside BrowserActionSchema: zod serializes a top-level
 * `z.discriminatedUnion` to `{anyOf: [...]}` with no top-level `properties`.
 * OpenAI-compatible providers reject or ignore a root-level combinator in
 * function parameters — a gateway that compiles the schema into a constrained
 * decoding grammar sees an object with ZERO declared fields and emits `{}`,
 * which then fails union validation with "No matching discriminator". That is
 * why the tool worked on one provider (which passed `anyOf` through) and broke
 * on every provider switched to afterwards.
 *
 * So the model is shown one flat object whose `action` enumerates all 18
 * operations and whose remaining fields are optional and documented with the
 * action they belong to, while BrowserActionSchema still does the real,
 * strict per-action validation in the tool's `validateInput`/`call`. This
 * mirrors LSPTool, which solves the identical problem the same way.
 *
 * Fields are optional and carry NO defaults: a default here would materialize
 * a key on actions whose variant is a `strictObject` that does not declare it,
 * and the per-action re-parse would then reject it as unknown. Defaults stay
 * on the variants, where they are action-scoped. The `loose*` wrappers are
 * reused so a harness that stringifies parameters is tolerated identically on
 * both paths.
 */
export const BrowserActionFlatSchema = z.strictObject({
  action: z
    .enum(BROWSER_ACTION_NAMES)
    .describe('The browser operation to perform. Required on every call.'),
  url: z.string().optional().describe('[navigate] The URL to navigate to.'),
  new_tab: looseBoolean()
    .optional()
    .describe('[navigate, click] Open in / open resulting navigation in a new tab. Default: false.'),
  index: looseNumber(z.number().int().min(0))
    .optional()
    .describe('[click, type] Index of the element from get_state. Ignored if `selector` is given.'),
  selector: z
    .string()
    .optional()
    .describe('[click, type] CSS selector to target directly, bypassing the element index.'),
  text: z.string().optional().describe('[type] The text to type.'),
  include_screenshot: looseBoolean()
    .optional()
    .describe('[get_state] Include a screenshot of the current page. Default: false.'),
  extract_links: looseBoolean()
    .optional()
    .describe('[get_content] Include links in the extracted content. Default: false.'),
  start_from_char: looseNumber(z.number().int().min(0))
    .optional()
    .describe('[get_content] Character index to start from in the page content. Default: 0.'),
  direction: z
    .enum(['up', 'down'])
    .optional()
    .describe("[scroll] Direction to scroll: 'up' or 'down'. Default: 'down'."),
  tab_id: z
    .string()
    .optional()
    .describe('[switch_tab, close_tab] 4-character tab ID from list_tabs.'),
  storage_state: looseObject(StorageStateSchema)
    .optional()
    .describe("[set_storage] Storage state with 'cookies' and 'origins', from get_storage."),
  ms: looseNumber(z.number().int().min(100).max(30000))
    .optional()
    .describe('[wait] Milliseconds to wait (100-30000).'),
  key: z
    .string()
    .optional()
    .describe('[press_key] Key to press, e.g. "Enter", "Escape", "Tab", "ArrowDown".'),
});

export type BrowserActionFlat = z.infer<typeof BrowserActionFlatSchema>;

export type BrowserActionParseResult =
  | { success: true; action: BrowserAction }
  | { success: false; message: string };

/**
 * Narrow a flat provider-facing input into the strict per-action shape.
 *
 * This is where the real validation happens: the flat schema above only proves
 * `action` is one of the 18 names, so every action-specific requirement is
 * checked here against that action's own variant. Used by both the tool's
 * `validateInput` (to report a precise error to the model) and `call` (to get
 * the narrowed action, with that variant's defaults and coercion applied).
 */
export function parseBrowserAction(
  input: BrowserActionFlat,
): BrowserActionParseResult {
  // Fields the model omitted are present-but-undefined after the flat parse.
  // The variants are strictObject, so an undefined-valued key for a field that
  // action doesn't declare would be rejected as unknown — drop them first.
  const present: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input)) {
    if (value !== undefined) present[key] = value;
  }

  const variant = BROWSER_ACTION_SCHEMA_BY_NAME[
    input.action
  ] as unknown as z.ZodObject<z.ZodRawShape>;
  const parsed = variant.safeParse(present);
  if (!parsed.success) {
    const detail = parsed.error.issues
      .map(issue => {
        const field = issue.path.join('.');
        return field ? `${field}: ${issue.message}` : issue.message;
      })
      .join('; ');
    const allowed = Object.keys(variant.shape).join(', ');
    return {
      success: false,
      message: `Invalid parameters for action "${input.action}": ${detail}. Parameters accepted by this action: ${allowed}.`,
    };
  }
  return { success: true, action: parsed.data as BrowserAction };
}

export type BrowserNavigateAction = z.infer<typeof BrowserNavigateActionSchema>;
export type BrowserClickAction = z.infer<typeof BrowserClickActionSchema>;
export type BrowserTypeAction = z.infer<typeof BrowserTypeActionSchema>;
export type BrowserGetStateAction = z.infer<typeof BrowserGetStateActionSchema>;
export type BrowserGetContentAction = z.infer<typeof BrowserGetContentActionSchema>;
export type BrowserScrollAction = z.infer<typeof BrowserScrollActionSchema>;
export type BrowserGoBackAction = z.infer<typeof BrowserGoBackActionSchema>;
export type BrowserListTabsAction = z.infer<typeof BrowserListTabsActionSchema>;
export type BrowserSwitchTabAction = z.infer<typeof BrowserSwitchTabActionSchema>;
export type BrowserCloseTabAction = z.infer<typeof BrowserCloseTabActionSchema>;
export type BrowserCloseAllTabsAction = z.infer<typeof BrowserCloseAllTabsActionSchema>;
export type BrowserGetStorageAction = z.infer<typeof BrowserGetStorageActionSchema>;
export type BrowserSetStorageAction = z.infer<typeof BrowserSetStorageActionSchema>;
export type BrowserStartRecordingAction = z.infer<typeof BrowserStartRecordingActionSchema>;
export type BrowserStopRecordingAction = z.infer<typeof BrowserStopRecordingActionSchema>;
export type BrowserRefreshAction = z.infer<typeof BrowserRefreshActionSchema>;
export type BrowserWaitAction = z.infer<typeof BrowserWaitActionSchema>;
export type BrowserPressKeyAction = z.infer<typeof BrowserPressKeyActionSchema>;

// ============================================================
// Tool prompt descriptions — copied VERBATIM from definition.py's
// BROWSER_*_DESCRIPTION constants (Task 15 requirement).
// ============================================================

export const BROWSER_NAVIGATE_DESCRIPTION = `Navigate to a URL in the browser.

This tool allows you to navigate to any web page. You can optionally open the URL in a new tab.

Parameters:
- url: The URL to navigate to (required)
- new_tab: Whether to open in a new tab (optional, default: False)

Examples:
- Navigate to Google: url="https://www.google.com"
- Open GitHub in new tab: url="https://github.com", new_tab=True
`;

export const BROWSER_CLICK_DESCRIPTION = `Click an element on the page by its index or a CSS selector.

Use this tool to click on interactive elements like buttons, links, or form controls.
The index comes from the browser_get_state tool output.

Note: if the clicked element opens a new tab (e.g. a target="_blank" link), the
browser automatically switches focus to that new tab, just like a real browser —
the result message will say so. The previous tab is not closed; switch back to it
with browser_switch_tab if needed.

Parameters:
- index: The index of the element to click (from browser_get_state). Ignored if selector is given.
- selector: A standard CSS selector (e.g. "input[name='q']", "#submit-button", ".search-btn") to
  click directly instead of an index — more robust when the page has changed since the last
  browser_get_state call, or on element-dense pages where counting the right occurrence by hand
  is error-prone. Provide either index or selector (selector takes priority if both are given).
  Do NOT put a get_state ref (the "e46"/"f1e46" you see in [ref=e46] tags) in brackets like
  "[ref=e46]" — that is not valid CSS and will time out. Use the numeric index instead for refs.
- new_tab: Whether to open any resulting navigation in a new tab (optional)

Important: Only use indices that appear in your current browser_get_state output —
if the page may have changed since then, prefer selector or call browser_get_state again.
`;

export const BROWSER_TYPE_DESCRIPTION = `Type text into an input field by its index or a CSS selector.

Use this tool to enter text into form fields, search boxes, or other text input elements.
The index comes from the browser_get_state tool output.

Parameters:
- index: The index of the input element (from browser_get_state). Ignored if selector is given.
- selector: A standard CSS selector (e.g. "input[name='q']", "textarea[aria-label='Search']") to
  type into directly instead of an index — see browser_click's selector parameter for when this
  is preferable. Provide either index or selector. Do NOT put a get_state ref in brackets like
  "[ref=e46]" — use the numeric index instead for refs.
- text: The text to type

Important: Only use indices that appear in your current browser_get_state output —
if the page may have changed since then, prefer selector or call browser_get_state again.
`;

export const BROWSER_GET_STATE_DESCRIPTION = `Get the current state of the page including all interactive elements.

Returns the page's accessibility tree as YAML, with every element tagged
"[index=N]" — N is EXACTLY the number to pass as browser_click's or
browser_type's \`index\` parameter for that element. Do not count elements
yourself or use any other number from the output; use the "[index=N]" value
verbatim. Example output:
  - generic [index=0]:
    - heading "Welcome" [index=1]
    - textbox "Name" [index=2]
    - button "Submit" [index=3]
Here, browser_click with index=3 clicks the Submit button.

Call this frequently — indices are only valid until the next get_state call
or the next navigation/click/type that changes the page (they are NOT
stable element IDs; they're recomputed fresh every time this is called).

Parameters:
- include_screenshot: Whether to include a screenshot (optional, default: False)
`;

export const BROWSER_GET_CONTENT_DESCRIPTION = `Extract the main content of the current page in clean markdown format. It has been filtered to remove noise and advertising content.

If the content was truncated and you need more information, use start_from_char parameter to continue from where truncation occurred.
`;

export const BROWSER_SCROLL_DESCRIPTION = `Scroll the page up or down.

Use this tool to scroll through page content when elements are not visible or when you need
to see more content.

Parameters:
- direction: Direction to scroll - "up" or "down" (optional, default: "down")
`;

export const BROWSER_GO_BACK_DESCRIPTION = `Go back to the previous page in browser history.

Use this tool to navigate back to the previously visited page, similar to clicking the 
browser's back button.
`;

export const BROWSER_LIST_TABS_DESCRIPTION = `List all open browser tabs.

This tool shows all currently open tabs with their IDs, titles, and URLs. Use the tab IDs
with browser_switch_tab or browser_close_tab.
`;

export const BROWSER_SWITCH_TAB_DESCRIPTION = `Switch to a different browser tab.

Use this tool to switch between open tabs. Get the tab_id from browser_list_tabs.

Parameters:
- tab_id: 4 Character Tab ID of the tab to switch to
`;

export const BROWSER_CLOSE_TAB_DESCRIPTION = `Close a specific browser tab.

Use this tool to close tabs you no longer need. Get the tab_id from browser_list_tabs.
Can close the last remaining tab — this leaves zero tabs open, which is a normal,
recoverable state: browser_navigate will open a fresh tab automatically the next
time it's called.

Parameters:
- tab_id: 4 Character Tab ID of the tab to close
`;

export const BROWSER_CLOSE_ALL_TABS_DESCRIPTION = `Close every open tab, leaving zero tabs open.

Use this tool when you want a clean slate — for test teardown, or recovering from a
confusing multi-tab state. Closes ALL tabs unconditionally, including the last one,
and does NOT open a replacement blank tab — the session is left with zero tabs open.
This is a normal, recoverable state: the next browser_navigate call opens a fresh
tab automatically.
`;

export const BROWSER_GET_STORAGE_DESCRIPTION = `Get browser storage data including cookies,
local storage, and session storage.

This tool extracts all cookies and storage data from the current browser session.
Useful for debugging, session management, or extracting authentication tokens.
`;

export const BROWSER_SET_STORAGE_DESCRIPTION = `Set browser storage data including cookies,
local storage, and session storage.

This tool allows you to restore or set the browser's storage state. You can use the
output from browser_get_storage to restore a previous session.

Parameters:
- storage_state: A dictionary containing 'cookies' and 'origins'.
  - cookies: List of cookie objects
  - origins: List of origin objects containing 'localStorage' and 'sessionStorage'
`;

export const BROWSER_START_RECORDING_DESCRIPTION = `Start recording the browser session.

This tool starts recording all browser interactions using rrweb. The recording
captures DOM mutations, mouse movements, clicks, scrolls, and other user interactions.

Output Location: ${BROWSER_RECORDING_OUTPUT_DIR}/recording-<timestamp>/
Format: Recording events are saved as numbered JSON files (1.json, 2.json, etc.)
containing rrweb event arrays. Events are flushed every 5 seconds or when they
exceed 1 MB. These files can be replayed using rrweb-player.

Call browser_stop_recording to stop recording and save any remaining events.

Note: Recording persists across page navigations - the recording will automatically
restart on new pages.
`;

export const BROWSER_STOP_RECORDING_DESCRIPTION = `Stop recording the browser session.

This tool stops the current recording session and saves any remaining events to disk.

Output Location: ${BROWSER_RECORDING_OUTPUT_DIR}/recording-<timestamp>/
Format: Events are saved as numbered JSON files (1.json, 2.json, etc.) containing
rrweb event arrays. These files can be replayed using rrweb-player to visualize
the recorded session.

Returns a summary message with the total event count, file count, and save directory.
`;

// ISSUE 8/9/10: descriptions for the three new actions (not present in the
// original OpenHands browser_use — added as common browser operations an
// agent needs).

export const BROWSER_REFRESH_DESCRIPTION = `Refresh/reload the current page.

Use this tool to reload the current page content, similar to pressing F5 or Ctrl+R.
Useful after making changes on a page or when content appears stale.
`;

export const BROWSER_WAIT_DESCRIPTION = `Wait for a specified duration.

Use this tool when you need to wait for page content to load or for a
short delay before the next action.

Parameters:
- ms: Milliseconds to wait (100-30000, max 30 seconds)
`;

export const BROWSER_PRESS_KEY_DESCRIPTION = `Press a keyboard key.

Use this tool to press keys like Enter, Escape, Tab, Arrow keys, etc.
Not tied to a specific element — presses on the currently focused element.

Parameters:
- key: The key to press (e.g. "Enter", "Escape", "Tab", "ArrowDown")
`;
