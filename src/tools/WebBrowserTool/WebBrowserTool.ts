/**
 * WebBrowserTool — the GakrCLI-facing tool definition.
 *
 * LAYER 2 — GakrCLI-SPECIFIC. This is the ONLY file in this directory that
 * imports from GakrCLI's src/Tool.ts. Everything else (types.ts,
 * browserServer.ts, browserEngine.ts, recording.ts, eventStorage.ts,
 * refManager.ts, asyncMutex.ts) is framework-agnostic and portable as-is.
 *
 * Written against the VERIFIED real src/Tool.ts (fetched directly from the
 * GakrCLI repo), not the earlier inferred conventions. Notably:
 *   - `description(input, options)` is async and takes an options bag.
 *   - `call(args, context, canUseTool, parentMessage, onProgress?)` returns
 *     `Promise<ToolResult<Output>>`, where `ToolResult<T> = { data: T;
 *     newMessages?; contextModifier?; mcpMeta? }` — there is NO `content`
 *     field on ToolResult (this is what BUG 4 got wrong).
 *   - `mapToolResultToToolResultBlockParam(content: Output, toolUseID)`
 *     receives the tool's `Output` type (i.e. the `data` from `call()`),
 *     NOT a raw content-blocks array — it's this function's job to turn
 *     `Output` into the actual `ToolResultBlockParam`. So `Output` here
 *     carries the pre-computed content blocks, and
 *     `mapToolResultToToolResultBlockParam` just assembles them.
 *   - `userFacingName`, `isConcurrencySafe`, `renderToolUseMessage` all take
 *     `input` (renderToolUseMessage also takes an options bag).
 *
 * Ported from definition.py (874 lines): the 14 action schemas, the
 * BROWSER_*_DESCRIPTION prompt strings (copied verbatim into types.ts),
 * and the BrowserToolSet -> single discriminated-union tool mapping
 * (GakrCLI's convention favors one tool with an `action` field over 14
 * separate ToolDefinitions).
 *
 * RECONCILIATION NOTE ON `inputSchema`: earlier guidance said the existing
 * WebBrowserTool.ts wraps its schema in `lazySchema()`. I couldn't fetch
 * `src/utils/lazySchema.ts` to confirm its return type lines up with
 * `Tool<Input>`'s `readonly inputSchema: Input` field (a plain
 * `z.ZodType<...>`), so this version assigns the zod schema directly, which
 * is guaranteed to satisfy that field. If the real repo's convention truly
 * requires `lazySchema(() => inputSchema)`, swap the one line marked below.
 */

import type { ToolResultBlockParam } from '@anthropic-ai/sdk/resources/index.mjs';
import type { CanUseToolFn } from 'src/hooks/useCanUseTool.js';
import type {
  ToolCallProgress,
  ToolPermissionContext,
  ToolProgressData,
  Tools,
  ToolResult,
  ToolUseContext,
  ValidationResult,
} from 'src/Tool.js';
import { buildTool } from 'src/Tool.js';
import type { AssistantMessage } from 'src/types/message.js';
import { lazySchema } from 'src/utils/lazySchema.js';
import { getInitialSettings } from 'src/utils/settings/settings.js';
import { z } from 'zod/v4';

import { BrowserToolExecutor } from './browserEngine.js';
import { renderToolResultMessage, extractSearchText } from './UI.js';
import {
  BROWSER_CLICK_DESCRIPTION,
  BROWSER_CLOSE_ALL_TABS_DESCRIPTION,
  BROWSER_CLOSE_TAB_DESCRIPTION,
  BROWSER_GET_CONTENT_DESCRIPTION,
  BROWSER_GET_STATE_DESCRIPTION,
  BROWSER_GET_STORAGE_DESCRIPTION,
  BROWSER_GO_BACK_DESCRIPTION,
  BROWSER_LIST_TABS_DESCRIPTION,
  BROWSER_NAVIGATE_DESCRIPTION,
  BROWSER_PRESS_KEY_DESCRIPTION,
  BROWSER_REFRESH_DESCRIPTION,
  BROWSER_SCROLL_DESCRIPTION,
  BROWSER_SCROLL_TO_TEXT_DESCRIPTION,
  BROWSER_EVALUATE_DESCRIPTION,
  BROWSER_FIND_ELEMENTS_DESCRIPTION,
  BROWSER_SEARCH_PAGE_DESCRIPTION,
  BROWSER_SEND_KEYS_DESCRIPTION,
  BROWSER_SCREENSHOT_DESCRIPTION,
  BROWSER_DROPDOWN_OPTIONS_DESCRIPTION,
  BROWSER_SELECT_DROPDOWN_DESCRIPTION,
  BROWSER_UPLOAD_FILE_DESCRIPTION,
  BROWSER_SEARCH_GOOGLE_DESCRIPTION,
  BROWSER_SAVE_AS_PDF_DESCRIPTION,
  BROWSER_SET_STORAGE_DESCRIPTION,
  BROWSER_START_RECORDING_DESCRIPTION,
  BROWSER_STOP_RECORDING_DESCRIPTION,
  BROWSER_SWITCH_TAB_DESCRIPTION,
  BROWSER_TYPE_DESCRIPTION,
  BROWSER_WAIT_DESCRIPTION,
  BROWSER_WAIT_FOR_ELEMENT_DESCRIPTION,
  BrowserActionFlatSchema,
  parseBrowserAction,
  type BrowserAction,
  type LLMContentBlock,
} from './types.js';

const TOOL_NAME = 'WebBrowser';

/**
 * CODE-REUSE CLEANUP (round 7): this used to be a hand-duplicated copy of
 * every action's zod shape, kept manually in sync with types.ts's
 * `BrowserActionSchema` — the exact kind of drift risk that bit this
 * project once already (this file's schema didn't get the `refresh`/`wait`/
 * `press_key` actions added to it in the same pass as types.ts, for a few
 * rounds). types.ts remains the single place that defines the 30 action
 * shapes — including the `looseBoolean`/`looseNumber`/`looseObject` coercion
 * that fixes log.md's issue #1 (the XML tool-call harness stringifying
 * non-string params) and the `selector` field on click/type.
 *
 * SCHEMA FIX: the tool advertises `BrowserActionFlatSchema` (a flat
 * `z.strictObject`), not `BrowserActionSchema` (a `z.discriminatedUnion`).
 * A union at the root of a tool's input schema serializes to `{anyOf: [...]}`
 * with no top-level `properties`, and OpenAI-compatible providers reject or
 * ignore a root-level combinator in function parameters: a gateway that
 * compiles the schema into a constrained decoding grammar sees an object with
 * zero declared fields, so the model emits `{}` and validation dies with
 * "No matching discriminator" before Chromium is ever launched. Providers that
 * forward `anyOf` verbatim happened to work, which is why this only surfaced
 * after switching model mid-session. Strict per-action validation is preserved
 * in `validateInput` and `call` via `parseBrowserAction`. LSPTool splits its
 * schema the same way, for the same reason.
 */
const inputSchema = lazySchema(() => BrowserActionFlatSchema);

type InputSchema = ReturnType<typeof inputSchema>;
export type WebBrowserInput = z.infer<InputSchema>;

const outputSchema = lazySchema(() => z.object({
  observationText: z.string(),
  isError: z.boolean(),
  contentBlocks: z.array(z.union([
    z.object({ type: z.literal('text'), text: z.string() }),
    z.object({ type: z.literal('image'), source: z.object({ type: z.literal('base64'), media_type: z.string(), data: z.string() }) }),
  ])),
}));
type OutputSchema = ReturnType<typeof outputSchema>;

/**
 * `Output` returned by `call()`'s `data` field and consumed by
 * `mapToolResultToToolResultBlockParam`. Carries both the plain-text
 * observation (for summaries, logs, isResultTruncated, etc.) and the
 * pre-computed content blocks (text + optional screenshot image) that
 * become the actual tool_result content.
 */
export interface WebBrowserOutput {
  observationText: string;
  isError: boolean;
  contentBlocks: Array<
    | { type: 'text'; text: string }
    | { type: 'image'; source: { type: 'base64'; media_type: string; data: string } }
  >;
}

// ISSUE 9 (RULE 9): `wait` is read-only; `refresh`/`press_key` are not.
// close_all_tabs is destructive (closes pages) — not read-only.
// wait_for_element (new action) only polls/observes — read-only, same as wait.
const READ_ONLY_ACTIONS = new Set([
  'get_state',
  'get_content',
  'list_tabs',
  'get_storage',
  'wait',
  'wait_for_element',
  'read_console_messages',
  'read_network_requests',
]);

/** Combined prompt: one entry per action, using the verbatim Python descriptions
 * plus the non-OpenHands operations added in later rounds. */
function buildPrompt(): string {
  return [
    '# WebBrowser',
    '',
    'Interact with a real Chromium browser: navigate, click, type, read page state and',
    'content, manage tabs, storage, and session recording. Every call takes an `action`',
    "field selecting one of the 30 operations below; only that action's parameters apply.",
    '',
    '## navigate',
    BROWSER_NAVIGATE_DESCRIPTION,
    '## click',
    BROWSER_CLICK_DESCRIPTION,
    '## type',
    BROWSER_TYPE_DESCRIPTION,
    '## get_state',
    BROWSER_GET_STATE_DESCRIPTION,
    '## get_content',
    BROWSER_GET_CONTENT_DESCRIPTION,
    '## scroll',
    BROWSER_SCROLL_DESCRIPTION,
    '## scroll_to_text',
    BROWSER_SCROLL_TO_TEXT_DESCRIPTION,
    '## evaluate',
    BROWSER_EVALUATE_DESCRIPTION,
    '## find_elements',
    BROWSER_FIND_ELEMENTS_DESCRIPTION,
    '## search_page',
    BROWSER_SEARCH_PAGE_DESCRIPTION,
    '## send_keys',
    BROWSER_SEND_KEYS_DESCRIPTION,
    '## screenshot',
    BROWSER_SCREENSHOT_DESCRIPTION,
    '## dropdown_options',
    BROWSER_DROPDOWN_OPTIONS_DESCRIPTION,
    '## select_dropdown',
    BROWSER_SELECT_DROPDOWN_DESCRIPTION,
    '## upload_file',
    BROWSER_UPLOAD_FILE_DESCRIPTION,
    '## search_google',
    BROWSER_SEARCH_GOOGLE_DESCRIPTION,
    '## save_as_pdf',
    BROWSER_SAVE_AS_PDF_DESCRIPTION,
    '## go_back',
    BROWSER_GO_BACK_DESCRIPTION,
    '## list_tabs',
    BROWSER_LIST_TABS_DESCRIPTION,
    '## switch_tab',
    BROWSER_SWITCH_TAB_DESCRIPTION,
    '## close_tab',
    BROWSER_CLOSE_TAB_DESCRIPTION,
    '## close_all_tabs',
    BROWSER_CLOSE_ALL_TABS_DESCRIPTION,
    '## get_storage',
    BROWSER_GET_STORAGE_DESCRIPTION,
    '## set_storage',
    BROWSER_SET_STORAGE_DESCRIPTION,
    '## start_recording',
    BROWSER_START_RECORDING_DESCRIPTION,
    '## stop_recording',
    BROWSER_STOP_RECORDING_DESCRIPTION,
    '## refresh',
    BROWSER_REFRESH_DESCRIPTION,
    '## wait',
    BROWSER_WAIT_DESCRIPTION,
    '## press_key',
    BROWSER_PRESS_KEY_DESCRIPTION,
    '## wait_for_element',
    BROWSER_WAIT_FOR_ELEMENT_DESCRIPTION,
  ].join('\n');
}

/**
 * Narrow GakrCLI's flat `action`-tagged input into the engine's strict
 * BrowserAction shape, applying that action's own defaults and coercion.
 *
 * No longer an identity function: the provider-facing schema is flat (see the
 * SCHEMA FIX note on `inputSchema`), so the per-action variant has to be
 * applied here. Throws on mismatch — `validateInput` runs first in the normal
 * tool path and reports the same failure to the model with a precise message,
 * so reaching this throw means a caller bypassed validation (e.g. a direct
 * `call()`), and failing loudly beats handing the engine an unvalidated action.
 */
function toBrowserAction(input: WebBrowserInput): BrowserAction {
  const parsed = parseBrowserAction(input);
  if (!parsed.success) {
    throw new Error(parsed.message);
  }
  return parsed.action;
}

/**
 * Human-readable one-liner for a completed action.
 *
 * Switches on `action.action` rather than a separately-passed `action` string:
 * narrowing off the discriminant is what makes the per-variant field reads
 * (`action.url`, `action.selector`, ...) type-safe, and it also removes the
 * possibility of the label disagreeing with the action it describes.
 */
export function shortActionResult(action: BrowserAction): string {
  switch (action.action) {
    case 'navigate':
      return `Navigated to ${action.url}`;
    case 'click':
      return action.selector ? `Clicked ${action.selector}` : `Clicked element [${action.index}]`;
    case 'type':
      return action.selector ? `Typed into ${action.selector}` : `Typed into element [${action.index}]`;
    case 'get_state':
      return 'Page state read';
    case 'get_content':
      return 'Page content read';
    case 'scroll':
      return `Scrolled ${action.direction ?? 'down'}`;
    case 'scroll_to_text':
      return `Scrolled to text '${action.text}'`;
    case 'evaluate':
      return `Evaluated JS expression`;
    case 'find_elements':
      return `Found elements matching ${action.selector}`;
    case 'search_page':
      return `Searched page for ${action.pattern}`;
    case 'send_keys':
      return `Sent keys ${action.keys}`;
    case 'screenshot':
      return action.file_name ? `Saved screenshot to ${action.file_name}` : 'Captured screenshot';
    case 'dropdown_options':
      return `Listed dropdown options for [${action.index}]`;
    case 'select_dropdown':
      return `Selected dropdown option '${action.text}' for [${action.index}]`;
    case 'upload_file':
      return `Uploaded file to [${action.index}]`;
    case 'search_google':
      return `Searched Google for '${action.query}'`;
    case 'save_as_pdf':
      return action.file_name ? `Saved PDF to ${action.file_name}` : 'Saved page as PDF';
    case 'go_back':
      return 'Went back';
    case 'list_tabs':
      return 'Tabs listed';
    case 'switch_tab':
      return `Switched to tab ${action.tab_id}`;
    case 'close_tab':
      return `Closed tab ${action.tab_id}`;
    case 'close_all_tabs':
      return 'All tabs closed';
    case 'get_storage':
      return 'Browser storage read';
    case 'set_storage':
      return 'Browser storage set';
    case 'start_recording':
      return 'Recording started';
    case 'stop_recording':
      return 'Recording stopped';
    case 'refresh':
      return 'Page refreshed';
    case 'wait':
      return `Waited ${action.ms}ms`;
    case 'press_key':
      return `Pressed key ${action.key}`;
    case 'wait_for_element':
      return `Waited for "${action.selector}" (${action.state})`;
    case 'read_console_messages':
      return action.only_errors
        ? 'Read error console messages'
        : action.level === 'all'
          ? `Read console messages (tail=${action.tail})`
          : `Read ${action.level}-level console messages (tail=${action.tail})`;
    case 'read_network_requests':
      return action.failed_only
        ? 'Read failed network requests'
        : `Read network requests (tail=${action.tail})`;
    case 'fill_form':
      return `Filled ${action.fields.length} form field${action.fields.length === 1 ? '' : 's'}`;
    case 'resize_window':
      return `Resized viewport to ${action.width}x${action.height}`;
    default:
      return 'Browser action completed';
  }
}

// Parse lastOperation from live state to extract URL for display (switch_tab/close_tab include URL after tab_id)
export function parseLastOperationForDisplay(raw?: string): { verb: string; summary: string } | null {
  if (!raw) return null;
  const parts = raw.split(' ');
  const action = parts[0];
  if (action === 'switch_tab' || action === 'close_tab') {
    // Format: "switch_tab <tab_id> <url>" or "close_tab <tab_id> <url>"
    const url = parts.slice(2).join(' ');
    const verb = action.toUpperCase().replace('_', ' ');
    return { verb, summary: `to ${url}` };
  }
  return null;
}

function toContentBlocks(blocks: LLMContentBlock[]): WebBrowserOutput['contentBlocks'] {
  return blocks.map((block) => {
    if (block.type === 'text') {
      return { type: 'text' as const, text: block.text };
    }
    // image_urls[0] is a data: URL ("data:<mime>;base64,<data>"); split it
    // back apart since tool_result image blocks want media_type + raw
    // base64 data as separate fields.
    const dataUrl = block.image_urls[0];
    const mediaType = dataUrl.slice(5, dataUrl.indexOf(';'));
    const data = dataUrl.slice(dataUrl.indexOf(',') + 1);
    return { type: 'image' as const, source: { type: 'base64' as const, media_type: mediaType, data } };
  });
}

export const WebBrowserTool = buildTool({
  name: TOOL_NAME,
  searchHint: 'browser navigate click type screenshot scroll tabs storage recording',
  maxResultSizeChars: 50_000,

  get inputSchema(): InputSchema {
    return inputSchema();
  },

  get outputSchema(): OutputSchema {
    return outputSchema();
  },

  /**
   * Strict per-action validation. `inputSchema` is deliberately flat so the
   * provider-facing JSON Schema has real top-level `properties` (see the
   * SCHEMA FIX note above), which means it only proves `action` is one of the
   * 18 names — every action-specific requirement is enforced here, against
   * that action's own variant, and reported with the offending field named
   * rather than as an opaque union failure.
   */
  async validateInput(input: WebBrowserInput): Promise<ValidationResult> {
    const parsed = parseBrowserAction(input);
    if (!parsed.success) {
      return { result: false, message: parsed.message, errorCode: 1 };
    }
    return { result: true };
  },

  async description(
    _input: WebBrowserInput,
    _options: { isNonInteractiveSession: boolean; toolPermissionContext: ToolPermissionContext; tools: Tools },
  ) {
    return 'Interact with a real, stateful Chromium browser session (navigate, click, type, read content, manage tabs/storage/recording).';
  },

  async prompt(_options: {
    getToolPermissionContext: () => Promise<ToolPermissionContext>;
    tools: Tools;
    agents: unknown[];
    allowedAgentTypes?: string[];
  }) {
    return buildPrompt();
  },

  isConcurrencySafe(_input: WebBrowserInput) {
    // The browser is a single stateful session; concurrent calls could race
    // on navigation/tab state, so this mirrors browser_use's single-executor model.
    return false;
  },

  isReadOnly(input: WebBrowserInput) {
    return READ_ONLY_ACTIONS.has(input.action);
  },

  userFacingName(_input: Partial<WebBrowserInput> | undefined) {
    return 'Browser';
  },

  renderToolUseMessage(
    input: Partial<WebBrowserInput>,
    _options: { theme: unknown; verbose: boolean; commands?: unknown[] },
  ) {
    switch (input.action) {
      case 'navigate':
        return `Navigating to ${input.url}${input.new_tab ? ' (new tab)' : ''}`;
      case 'click':
        return input.selector ? `Clicking element (${input.selector})` : `Clicking element [${input.index}]`;
      case 'type':
        return input.selector ? `Typing into element (${input.selector})` : `Typing into element [${input.index}]`;
      case 'get_state':
        return 'Reading page state';
      case 'get_content':
        return 'Reading page content';
      case 'scroll':
        return `Scrolling ${input.direction ?? 'down'}`;
      case 'scroll_to_text':
        return `Scrolling to text '${input.text}'`;
      case 'evaluate':
        return `Evaluating JS expression`;
      case 'find_elements':
        return `Finding elements (${input.selector})`;
      case 'search_page':
        return `Searching page for '${input.pattern}'`;
      case 'send_keys':
        return `Sending keys ${input.keys}`;
      case 'screenshot':
        return input.file_name ? `Saving screenshot to ${input.file_name}` : 'Taking screenshot';
      case 'dropdown_options':
        return `Listing dropdown options for [${input.index}]`;
      case 'select_dropdown':
        return `Selecting dropdown option '${input.text}' for [${input.index}]`;
      case 'upload_file':
        return `Uploading file to [${input.index}]`;
      case 'search_google':
        return `Searching Google for '${input.query}'`;
      case 'save_as_pdf':
        return input.file_name ? `Saving PDF to ${input.file_name}` : 'Saving page as PDF';
      case 'go_back':
        return 'Going back';
      case 'list_tabs':
        return 'Listing tabs';
      case 'switch_tab':
        return `Switching to tab ${input.tab_id}`;
      case 'close_tab':
        return `Closing tab ${input.tab_id}`;
      case 'close_all_tabs':
        return 'Closing all tabs';
      case 'get_storage':
        return 'Reading browser storage';
      case 'set_storage':
        return 'Setting browser storage';
      case 'start_recording':
        return 'Starting session recording';
      case 'stop_recording':
        return 'Stopping session recording';
      case 'refresh':
        return 'Refreshing page';
      case 'wait':
        return `Waiting ${input.ms}ms`;
      case 'press_key':
        return `Pressing key ${input.key}`;
      case 'wait_for_element':
        return `Waiting for element (${input.selector})`;
      case 'read_console_messages':
        return input.only_errors
          ? 'Reading error console messages'
          : input.level === 'all'
            ? 'Reading console messages'
            : `Reading ${input.level}-level console messages`;
      case 'read_network_requests':
        return input.failed_only
          ? 'Reading failed network requests'
          : input.url_pattern
            ? `Reading network requests matching '${input.url_pattern}'`
            : 'Reading network requests';
      case 'fill_form':
        return `Filling ${input.fields?.length ?? 0} form field${(input.fields?.length ?? 0) === 1 ? '' : 's'}`;
      case 'resize_window':
        return `Resizing viewport to ${input.width}x${input.height}`;
      default:
        return 'Browser action';
    }
  },

  renderToolResultMessage,
  extractSearchText,

  toAutoClassifierInput(input: WebBrowserInput) {
    // Browser actions are security-relevant (navigation, form fill, storage
    // read/write) — surface a compact representation for the auto-mode
    // classifier rather than the TOOL_DEFAULTS empty-string default.
    switch (input.action) {
      case 'navigate':
        return `navigate: ${input.url}`;
      case 'set_storage':
        return 'set_storage';
      case 'type':
        return input.selector ? `type into (${input.selector})` : `type into [${input.index}]`;
      case 'scroll_to_text':
        return `scroll_to_text: ${input.text}`;
      case 'evaluate':
        return 'evaluate';
      case 'find_elements':
        return `find_elements: ${input.selector}`;
      case 'search_page':
        return `search_page: ${input.pattern}`;
      case 'send_keys':
        return `send_keys: ${input.keys}`;
      case 'screenshot':
        return input.file_name ? `screenshot: ${input.file_name}` : 'screenshot';
      case 'dropdown_options':
        return `dropdown_options: [${input.index}]`;
      case 'select_dropdown':
        return `select_dropdown: [${input.index}] '${input.text}'`;
      case 'upload_file':
        return `upload_file: [${input.index}] ${input.path}`;
      case 'search_google':
        return `search_google: ${input.query}`;
      case 'save_as_pdf':
        return `save_as_pdf${input.file_name ? `: ${input.file_name}` : ''}`;
      case 'wait_for_element':
        return `wait_for_element: ${input.selector}`;
      case 'read_console_messages':
        return input.only_errors
          ? 'read_console_messages: errors only'
          : `read_console_messages: level=${input.level ?? 'all'}`;
      case 'read_network_requests':
        return input.failed_only
          ? 'read_network_requests: failed only'
          : input.url_pattern
            ? `read_network_requests: url~'${input.url_pattern}'`
            : 'read_network_requests';
      case 'fill_form':
        return `fill_form: ${input.fields?.length ?? 0} field${(input.fields?.length ?? 0) === 1 ? '' : 's'}`;
      case 'resize_window':
        return `resize_window: ${input.width}x${input.height}`;
      default:
        return `${input.action}`;
    }
  },

  mapToolResultToToolResultBlockParam(content: WebBrowserOutput, toolUseID: string): ToolResultBlockParam {
    const statusLine = content.isError
      ? `WebBrowser error: ${content.observationText}`
      : content.observationText;
    const terminalBlock = statusLine.length > 120 ? `${statusLine.slice(0, 117)}...` : statusLine;
    const blocks = [{ type: 'text' as const, text: terminalBlock }, ...content.contentBlocks];
    return {
      tool_use_id: toolUseID,
      type: 'tool_result',
      content: JSON.stringify(blocks),
      is_error: content.isError,
    };
  },

  async call(
    input: WebBrowserInput,
    _context: ToolUseContext,
    _canUseTool: CanUseToolFn,
    _parentMessage: AssistantMessage,
    _onProgress?: ToolCallProgress<ToolProgressData>,
  ): Promise<ToolResult<WebBrowserOutput>> {
    const action = toBrowserAction(input);
    // Read `webBrowser.headless` from settings once per call. Passing
    // `headless: undefined` lets BrowserToolExecutor's constructor default
    // (`?? true`) win, so the absence of a setting keeps today's behavior.
    const headlessFromSettings = getInitialSettings().webBrowser?.headless;
    const executor = await BrowserToolExecutor.getShared(
      headlessFromSettings === undefined ? undefined : { headless: headlessFromSettings },
    );
    const signal = _context.abortController?.signal;
    const observation = await executor.call(action, signal);

    // BUG 4 FIX: ToolResult<T> = { data: T; newMessages?; contextModifier?;
    // mcpMeta? } — there is no `content` field, and the previous
    // `...({ content } as any)` spread was an unsafe no-op that didn't
    // actually reach anything (content flows through
    // mapToolResultToToolResultBlockParam, not through ToolResult itself).
    // The content blocks are now carried inside `data` so
    // mapToolResultToToolResultBlockParam can assemble the real
    // ToolResultBlockParam from them.
    // Recording start/stop return rich, live-state-accurate status strings
    // (e.g. "Recording started", "Recording stopped. Captured 25 events…").
    // For those, the server text IS the canonical outcome; emitting the
    // static `shortActionResult(action)` label in addition would produce a
    // confusing dual-message like "start_recording → Recording started"
    // followed by the same line, or worse, by an error line. Use the server
    // text directly for these and keep the static label for everything else.
    const serverTextIsCanonical =
      action.action === 'start_recording' || action.action === 'stop_recording';
    const resultText = observation.is_error
      ? observation.text
      : serverTextIsCanonical
        ? observation.text
        : `${action.action} → ${shortActionResult(action)}`;
    const contentBlocks = toContentBlocks(observation.toLLMContent());
    const terminalBlocks = contentBlocks.some(b => b.type === 'text' && b.text === observation.text)
      ? [{ type: 'text' as const, text: resultText }, ...contentBlocks]
      : [{ type: 'text' as const, text: resultText }, ...contentBlocks.filter(b => b.type !== 'text' || b.text !== observation.text)];
    return {
      data: {
        observationText: observation.text,
        isError: observation.is_error,
        contentBlocks: terminalBlocks,
      },
    };
  },
});
