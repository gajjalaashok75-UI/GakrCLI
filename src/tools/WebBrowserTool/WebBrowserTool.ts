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
  ToolInputJSONSchema,
  ToolPermissionContext,
  ToolProgressData,
  Tools,
  ToolResult,
  ToolUseContext,
} from 'src/Tool.js';
import { buildTool } from 'src/Tool.js';
import type { AssistantMessage } from 'src/types/message.js';
import { lazySchema } from 'src/utils/lazySchema.js';
import { zodToJsonSchema } from 'src/utils/zodToJsonSchema.js';
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
  BROWSER_SET_STORAGE_DESCRIPTION,
  BROWSER_START_RECORDING_DESCRIPTION,
  BROWSER_STOP_RECORDING_DESCRIPTION,
  BROWSER_SWITCH_TAB_DESCRIPTION,
  BROWSER_TYPE_DESCRIPTION,
  BROWSER_WAIT_DESCRIPTION,
  BrowserActionSchema,
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
 * rounds). Reusing `BrowserActionSchema` directly means there is now
 * exactly ONE place that defines the 18 action shapes — including the
 * `looseBoolean`/`looseNumber`/`looseObject` coercion that fixes log.md's
 * issue #1 (the XML tool-call harness stringifying non-string params) and
 * the new `selector` field on click/type — and both the engine layer and
 * this GakrCLI-facing tool automatically stay in sync with it.
 */
const inputSchema = lazySchema(() => BrowserActionSchema);

type InputSchema = ReturnType<typeof inputSchema>;
export type WebBrowserInput = z.infer<InputSchema>;

// zod v4 serializes a top-level z.discriminatedUnion as {anyOf} with no
// top-level `type`, which model providers reject ("schema must be a JSON
// Schema of 'type: "object"'"). All working tools serialize their
// z.object/strictObject inputSchema to a top-level `type: 'object'`. We keep
// the discriminated union for strict per-action validation (toolExecution.ts
// parses via tool.inputSchema) but expose an inputJSONSchema whose top level
// is `type: 'object'` so the provider-facing schema matches the convention.
const inputJSONSchema: ToolInputJSONSchema = {
  ...zodToJsonSchema(inputSchema()),
  type: 'object',
};

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
const READ_ONLY_ACTIONS = new Set(['get_state', 'get_content', 'list_tabs', 'get_storage', 'wait']);

/** Combined prompt: one entry per action, using the verbatim Python descriptions
 * plus the non-OpenHands operations added in later rounds. */
function buildPrompt(): string {
  return [
    '# WebBrowser',
    '',
    'Interact with a real Chromium browser: navigate, click, type, read page state and',
    'content, manage tabs, storage, and session recording. Every call takes an `action`',
    "field selecting one of the 18 operations below; only that action's parameters apply.",
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
  ].join('\n');
}

/** Map GakrCLI's flat `action`-tagged input into the engine's BrowserAction shape. */
function toBrowserAction(input: WebBrowserInput): BrowserAction {
  // CODE-REUSE CLEANUP (round 7): now a true identity function — both
  // types are literally `z.infer<typeof BrowserActionSchema>` since
  // WebBrowserTool.ts's inputSchema reuses BrowserActionSchema directly
  // rather than a hand-duplicated copy. Kept as a named function (instead
  // of inlining `input` at each call site) so `call()` reads the same way
  // regardless of whether this ever needs to diverge again in the future.
  return input;
}

export function shortActionResult(action: string, input: WebBrowserInput): string {
  switch (action) {
    case 'navigate':
      return `Navigated to ${input.url}`;
    case 'click':
      return input.selector ? `Clicked ${input.selector}` : `Clicked element [${input.index}]`;
    case 'type':
      return input.selector ? `Typed into ${input.selector}` : `Typed into element [${input.index}]`;
    case 'get_state':
      return 'Page state read';
    case 'get_content':
      return 'Page content read';
    case 'scroll':
      return `Scrolled ${input.direction ?? 'down'}`;
    case 'go_back':
      return 'Went back';
    case 'list_tabs':
      return 'Tabs listed';
    case 'switch_tab':
      return `Switched to tab ${input.tab_id}`;
    case 'close_tab':
      return `Closed tab ${input.tab_id}`;
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
      return `Waited ${input.ms}ms`;
    case 'press_key':
      return `Pressed key ${input.key}`;
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

  inputJSONSchema,

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
      case 'close_all_tabs':
        return 'Closing all tabs';
      case 'refresh':
        return 'Refreshing page';
      case 'wait':
        return `Waiting ${input.ms}ms`;
      case 'press_key':
        return `Pressing key ${input.key}`;
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
    const executor = await BrowserToolExecutor.getShared();
    const observation = await executor.call(action);

    // BUG 4 FIX: ToolResult<T> = { data: T; newMessages?; contextModifier?;
    // mcpMeta? } — there is no `content` field, and the previous
    // `...({ content } as any)` spread was an unsafe no-op that didn't
    // actually reach anything (content flows through
    // mapToolResultToToolResultBlockParam, not through ToolResult itself).
    // The content blocks are now carried inside `data` so
    // mapToolResultToToolResultBlockParam can assemble the real
    // ToolResultBlockParam from them.
    const resultText = observation.is_error
      ? observation.text
      : `${input.action} → ${shortActionResult(input.action, input as WebBrowserInput)}`;
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
