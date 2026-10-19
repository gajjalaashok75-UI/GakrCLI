/**
 * Drives the GakrCLI agent for one side-panel session.
 *
 * The side panel speaks `RealtimeEvent` (a Chrome-extension contract), while
 * the agent speaks `SDKMessage`. This module owns that translation: it runs
 * `query()` from the SDK, converts each SDK message into an `AgentMessage`,
 * and fans the result out to every SSE listener watching the session.
 *
 * Keeping the conversion here means the HTTP layer never has to know what an
 * Anthropic content block is.
 */

import { randomUUID } from 'crypto'
import { TOOL_NAMES } from '@gakr-gakr/mcp-chrome-shared'
import type { ContentBlockParam } from '@anthropic-ai/sdk/resources/messages.mjs'
import { createSdkMcpServer } from '../../../entrypoints/sdk/index.js'
import { query, type Query } from '../../../entrypoints/sdk/query.js'
import type { SDKMessage, SDKUserMessage } from '../../../entrypoints/sdk/shared.js'
import {
  prepareAttachments,
  type PreparedAttachments,
} from './attachments.js'
import {
  buildChromeToolDefinitions,
  CHROME_MCP_SERVER_NAME,
} from './chromeTools.js'
import type {
  AgentActRequest,
  AgentMessage,
  AgentSession,
  RealtimeEvent,
} from './contract.js'
import type { AgentServerStore } from './store.js'
import { StreamBlockTracker } from './streaming.js'
import { buildChromeAgentSystemPrompt } from './systemPrompt.js'

/** Tool-call timeout; the extension gives up at 30s too. */
const TOOL_TIMEOUT_MS = 30_000

/**
 * Tool that reports open windows and tabs.
 *
 * Not `chrome_`-prefixed: `TOOL_NAMES.BROWSER.GET_WINDOWS_AND_TABS` is
 * `get_windows_and_tabs`, as are the three performance tools. Taking the name
 * from the registry rather than hardcoding it keeps this correct if the shared
 * contract changes.
 */
const TABS_TOOL = TOOL_NAMES.BROWSER.GET_WINDOWS_AND_TABS

type Listener = (event: RealtimeEvent) => void

/**
 * Execute one tool call from the model against the browser.
 *
 * The agent server owns browser control here rather than going through the MCP
 * package, because that package advertises an 18-name tool surface
 * (`read_page`, `find`, …) while the extension implements 31 `chrome_*`
 * names. Routing through the extension's own names keeps one vocabulary.
 */
export type ToolExecutor = (
  name: string,
  args: Record<string, unknown>,
) => Promise<unknown>

function nowIso(): string {
  return new Date().toISOString()
}

/**
 * Flatten an extension tool result into text.
 *
 * Tool results arrive as `{ content: [{ type, text }] }` (Chrome's MCP shape);
 * anything else is handed through as JSON so the model still sees something.
 */
function toolResultText(result: unknown): string {
  if (typeof result === 'string') {
    return result
  }
  if (result && typeof result === 'object') {
    const content = (result as { content?: unknown }).content
    if (Array.isArray(content)) {
      const parts = content
        .map(block =>
          block && typeof block === 'object'
            ? (block as { text?: unknown }).text
            : undefined,
        )
        .filter((text): text is string => typeof text === 'string')
      if (parts.length) {
        return parts.join('\n')
      }
    }
    return JSON.stringify(result)
  }
  return String(result ?? '')
}

/** One tab as reported by the extension's windows/tabs tool. */
type TabSummary = {
  tabId?: number
  url?: string
  title?: string
  active?: boolean
}

type TabsSnapshot = {
  windowCount?: number
  tabCount?: number
  windows?: Array<{ windowId?: number; tabs?: TabSummary[] }>
}

/** The tab id the panel reported for itself, if it sent one. */
function readPanelTabId(clientMeta: unknown): number | undefined {
  if (!clientMeta || typeof clientMeta !== 'object') {
    return undefined
  }
  const value = (clientMeta as { panelTabId?: unknown }).panelTabId
  return typeof value === 'number' && Number.isFinite(value)
    ? value
    : undefined
}

/** Locate the panel's own tab inside a windows/tabs snapshot. */
function findTab(
  snapshot: TabsSnapshot,
  tabId: number,
): TabSummary | undefined {
  for (const window of snapshot.windows ?? []) {
    for (const tab of window.tabs ?? []) {
      if (tab.tabId === tabId) {
        return tab
      }
    }
  }
  return undefined
}

/** Pull display text out of an SDK content array. */
function extractText(content: unknown): string {
  if (typeof content === 'string') {
    return content
  }
  if (!Array.isArray(content)) {
    return ''
  }
  const parts: string[] = []
  for (const block of content) {
    if (block && typeof block === 'object') {
      const typed = block as { type?: string; text?: string; thinking?: string }
      if (typed.type === 'text' && typeof typed.text === 'string') {
        parts.push(typed.text)
      } else if (typed.type === 'thinking' && typeof typed.thinking === 'string') {
        parts.push(typed.thinking)
      }
    }
  }
  return parts.join('\n')
}

/** Render a tool_result block back into text for the transcript. */
function extractToolResultText(content: unknown): string {
  if (typeof content === 'string') {
    return content
  }
  if (!Array.isArray(content)) {
    return ''
  }
  const parts: string[] = []
  for (const block of content) {
    if (block && typeof block === 'object') {
      const typed = block as {
        type?: string
        content?: unknown
        is_error?: boolean
      }
      if (typed.type === 'tool_result') {
        parts.push(extractText(typed.content) || '')
      }
    }
  }
  return parts.filter(Boolean).join('\n')
}

type ActiveRun = {
  requestId: string
  query: Query
  abort: AbortController
}

/**
 * Per-session runtime state: the live agent turn plus its SSE subscribers.
 *
 * One run at a time per session — the panel serialises requests, and two
 * concurrent `query()` objects on the same cwd would interleave transcripts.
 */
export class SessionRuntime {
  readonly listeners = new Set<Listener>()
  active: ActiveRun | null = null

  /** In-flight text blocks for the turn currently streaming. */
  private readonly stream = new StreamBlockTracker()

  constructor(
    readonly session: AgentSession,
    private readonly store: AgentServerStore,
    private readonly runTool: ToolExecutor,
    /**
     * Directory the CLI was launched from. Every turn runs here: the side panel
     * has no notion of a project on this machine, and silently falling back to
     * wherever the process happens to be would put file edits somewhere the
     * user never chose.
     */
    private readonly cwd: string,
  ) {}

  emit(event: RealtimeEvent): void {
    for (const listener of [...this.listeners]) {
      try {
        listener(event)
      } catch {
        // A broken SSE pipe must not stop the other listeners or the agent.
      }
    }
  }

  status(
    status: 'starting' | 'ready' | 'running' | 'completed' | 'error' | 'cancelled',
    requestId?: string,
    message?: string,
  ): void {
    this.emit({
      type: 'status',
      data: { sessionId: this.session.id, status, requestId, message },
    })
  }

  /**
   * Persist a message and stream it to subscribers.
   *
   * Upserts by id: a streamed delta reuses the id of the block it belongs to,
   * so each delta replaces the previous copy instead of appending a row per
   * token. The final message for that block reuses the same id too, which is
   * what stops the panel showing the answer twice.
   */
  publish(message: AgentMessage): void {
    const fields = {
      projectId: this.session.projectId,
      sessionId: this.session.id,
      role: message.role,
      content: message.content,
      messageType: message.messageType,
      metadata: message.metadata,
      cliSource: message.cliSource ?? null,
      requestId: message.requestId,
      createdAt: message.createdAt,
    }
    const stored =
      this.store.updateMessage(message.id, fields) ??
      this.store.addMessage({ id: message.id, ...fields })
    this.emit({ type: 'message', data: { ...message, id: stored.id } })
  }

  cancel(requestId: string): boolean {
    if (!this.active || this.active.requestId !== requestId) {
      return false
    }
    this.active.abort.abort()
    return true
  }

  async close(): Promise<void> {
    this.active?.abort.abort()
    this.active?.query.close()
    this.listeners.clear()
  }

  /**
   * Run one turn.
   *
   * `/act` returns as soon as the turn is accepted; the transcript arrives over
   * SSE. That is why `status: 'starting'` is emitted here rather than waiting
   * for the first token.
   */
  async act(request: AgentActRequest): Promise<{ requestId: string }> {
    const requestId = request.requestId ?? randomUUID()

    if (this.active) {
      this.emit({
        type: 'error',
        error: 'A request is already running for this session',
        data: { sessionId: this.session.id, requestId },
      })
      throw new Error('A request is already running for this session')
    }

    const abort = new AbortController()
    this.status('starting', requestId)

    // Persist whatever the panel attached before echoing the message, so the
    // panel can render thumbnails from the saved copies.
    const userMessageId = randomUUID()
    const attachments = await prepareAttachments(
      request.attachments ?? [],
      this.session.projectId,
      userMessageId,
    )

    // Echo the user's own message so the panel can swap its optimistic bubble
    // for the persisted one. `displayText` wins: the panel may inject context
    // into `instruction` that should not be shown back to the user.
    const displayText = request.displayText?.trim()
    this.publish({
      id: userMessageId,
      sessionId: this.session.id,
      role: 'user',
      content: displayText || request.instruction,
      messageType: 'chat',
      requestId,
      createdAt: nowIso(),
      metadata:
        displayText || request.clientMeta || attachments.metadata.length
          ? {
              displayText,
              clientMeta: request.clientMeta,
              attachments: attachments.metadata.length
                ? attachments.metadata
                : undefined,
            }
          : undefined,
    })

    const browserContext = await this.collectBrowserContext(request)
    const prompt = this.buildPrompt(request, browserContext, attachments)

    let agentQuery: Query
    try {
      agentQuery = query({
        prompt: Array.isArray(prompt) ? this.blockPrompt(prompt) : prompt,
        options: {
          cwd: this.cwd,
          model: request.model ?? this.session.model,
          permissionMode: this.resolvePermissionMode(),
          abortController: abort,
          includePartialMessages: true,
          // Appended to the default prompt rather than replacing it: the agent
          // still needs its usual coding instructions, plus the browser facts
          // it cannot discover on its own (see systemPrompt.ts).
          systemPrompt: {
            type: 'preset' as const,
            preset: 'claude_code',
            append: buildChromeAgentSystemPrompt({ cwd: this.cwd }),
          },
          // The SDK denies every tool call unless a permission callback is
          // supplied, so omitting this would silently disable all tool use.
          canUseTool: async () => ({ behavior: 'allow' as const }),
          // Without this the model has no browser tools at all in the panel:
          // the built-in WebBrowserTool drives a separate Playwright Chromium,
          // not the user's own Chrome.
          mcpServers: {
            [CHROME_MCP_SERVER_NAME]: createSdkMcpServer({
              type: 'sdk',
              name: CHROME_MCP_SERVER_NAME,
              tools: buildChromeToolDefinitions(this.runTool),
            }),
          },
        },
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      this.emit({
        type: 'error',
        error: message,
        data: { sessionId: this.session.id, requestId },
      })
      this.status('error', requestId, message)
      throw error
    }

    this.active = { requestId, query: agentQuery, abort }
    this.status('running', requestId)

    // Consume in the background: `/act` already returned to the panel.
    void this.consume(agentQuery, requestId, abort.signal)

    return { requestId }
  }

  private resolvePermissionMode():
    | 'default'
    | 'acceptEdits'
    | 'bypassPermissions'
    | 'plan' {
    const mode = this.session.permissionMode
    if (
      mode === 'acceptEdits' ||
      mode === 'bypassPermissions' ||
      mode === 'plan'
    ) {
      return mode
    }
    return this.session.allowDangerouslySkipPermissions
      ? 'bypassPermissions'
      : 'default'
  }

  /**
   * Ask the extension what the browser looks like right now.
   *
   * Without this the agent has no idea it is driving a real browser — it
   * cannot answer "which tab am I on?" without spending a tool call to find
   * out. Collected fresh on every turn so nothing stale is ever handed over,
   * and told which tab the panel is attached to rather than guessing from
   * whichever tab happens to be active in whichever window has focus.
   *
   * Best-effort: a disconnected extension must not block the prompt, so
   * failures degrade to a short note instead of throwing.
   */
  private async collectBrowserContext(
    request: AgentActRequest,
  ): Promise<string> {
    const panelTabId = readPanelTabId(request.clientMeta)
    const capturedAt = nowIso()

    try {
      const result = await this.runTool(TABS_TOOL, {})
      const text = toolResultText(result)
      const lines = [
        'You are running inside the GakrCLI in Chrome side panel, connected to',
        "the user's real Chrome browser via the GakrCLI extension.",
        'Use the chrome_* tools for anything about the browser (tabs,',
        'navigation, page content, clicking, typing). Do not use them for',
        'general coding tasks.',
        '',
        `Current browser state (captured ${capturedAt}):`,
        text,
      ]

      if (panelTabId !== undefined) {
        let snapshot: TabsSnapshot | undefined
        try {
          snapshot = JSON.parse(text) as TabsSnapshot
        } catch {
          snapshot = undefined
        }
        const tab = snapshot ? findTab(snapshot, panelTabId) : undefined
        lines.push(
          '',
          tab
            ? `The side panel is attached to tabId ${panelTabId}: ${tab.title || '(untitled)'} — ${tab.url || '(no url)'}`
            : // The snapshot is authoritative; say so rather than describing a
              // tab that is no longer in it.
              `The side panel reported tabId ${panelTabId}, which is not in that snapshot — that tab has probably been closed. Ask the user which tab they mean.`,
        )
      }

      return lines.join('\n')
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      return [
        'You are running inside the GakrCLI in Chrome side panel. The chrome_*',
        'tools are available but the extension did not respond, so the current',
        'browser state is unknown. Do not claim to know what the user is looking',
        'at: ask, or retry a chrome_* tool call.',
        panelTabId !== undefined
          ? `The side panel reported tabId ${panelTabId}, but its state could not be read at ${capturedAt}.`
          : `The browser state could not be read at ${capturedAt}.`,
        `(last error: ${message})`,
      ].join('\n')
    }
  }

  /**
   * Wrap content blocks in the single-message prompt `query()` accepts.
   *
   * A string prompt cannot carry images; an async iterable of `SDKUserMessage`
   * can, and the SDK passes `message.content` straight through to the model.
   */
  private async *blockPrompt(
    content: ContentBlockParam[],
  ): AsyncIterable<SDKUserMessage> {
    yield {
      type: 'user',
      message: { role: 'user', content },
      parent_tool_use_id: null,
    }
  }

  private buildPrompt(
    request: AgentActRequest,
    browserContext: string,
    attachments: PreparedAttachments,
  ): string | ContentBlockParam[] {
    const parts = [browserContext, '', '---', '', request.instruction]
    if (attachments.files.length) {
      parts.push(
        '',
        'The user attached these files. They are saved on disk; read them',
        'with your file tools:',
        ...attachments.files.map(f => `- ${f.name}: ${f.path}`),
      )
    }
    const text = parts.join('\n')
    if (!attachments.blocks.length) {
      return text
    }
    return [{ type: 'text', text }, ...attachments.blocks]
  }

  /** Translate the SDK stream into side-panel events. */
  private async consume(
    agentQuery: Query,
    requestId: string,
    signal: AbortSignal,
  ): Promise<void> {
    const usage = {
      inputTokens: 0,
      outputTokens: 0,
      cacheReadInputTokens: 0,
      cacheCreationInputTokens: 0,
      totalCostUsd: 0,
      durationMs: 0,
      numTurns: 0,
    }
    const startedAt = Date.now()

    try {
      for await (const message of agentQuery as AsyncIterable<SDKMessage>) {
        if (signal.aborted) {
          break
        }
        this.handleSdkMessage(message, requestId, usage)
      }

      if (signal.aborted) {
        this.status('cancelled', requestId)
      } else {
        this.status('completed', requestId)
      }
    } catch (error) {
      if (signal.aborted) {
        this.status('cancelled', requestId)
      } else {
        const text = error instanceof Error ? error.message : String(error)
        this.emit({
          type: 'error',
          error: text,
          data: { sessionId: this.session.id, requestId },
        })
        this.status('error', requestId, text)
      }
    } finally {
      usage.durationMs = Date.now() - startedAt
      this.emit({
        type: 'usage',
        data: { sessionId: this.session.id, requestId, ...usage },
      })
      this.active = null
      try {
        agentQuery.close()
      } catch {
        // Already closed.
      }
    }
  }

  private handleSdkMessage(
    message: SDKMessage,
    requestId: string,
    usage: {
      inputTokens: number
      outputTokens: number
      cacheReadInputTokens: number
      cacheCreationInputTokens: number
      totalCostUsd: number
      numTurns: number
    },
  ): void {
    switch (message.type) {
      case 'stream_event': {
        this.handleStreamEvent(message.event, requestId)
        return
      }

      case 'assistant': {
        const content = message.message?.content
        if (!Array.isArray(content)) {
          return
        }
        for (let index = 0; index < content.length; index++) {
          const block = content[index]
          if (!block || typeof block !== 'object') {
            continue
          }
          const typed = block as {
            type?: string
            id?: string
            name?: string
            input?: unknown
            text?: string
          }
          if (typed.type === 'text' && typeof typed.text === 'string') {
            this.publish({
              // Reuse the id the deltas streamed under, so this final message
              // replaces that bubble instead of adding a second one. Text
              // blocks carry no id of their own, which is why the streaming id
              // is keyed by block index.
              id:
                this.stream.idForBlock(index) ??
                typed.id ??
                randomUUID(),
              sessionId: this.session.id,
              role: 'assistant',
              content: typed.text,
              messageType: 'chat',
              requestId,
              createdAt: nowIso(),
              isStreaming: false,
              isFinal: true,
            })
          } else if (typed.type === 'tool_use') {
            this.publish({
              id: typed.id ?? randomUUID(),
              sessionId: this.session.id,
              role: 'assistant',
              content: typed.name ?? 'tool',
              messageType: 'tool_use',
              requestId,
              createdAt: nowIso(),
              isStreaming: false,
              isFinal: true,
              metadata: { toolName: typed.name, input: typed.input },
            })
          }
        }
        // Every block in this message has arrived complete; the next message
        // starts its own block indexes.
        this.stream.reset()
        return
      }

      case 'user': {
        // User messages from the SDK carry tool results back to the model.
        const content = message.message?.content
        if (!Array.isArray(content)) {
          return
        }
        for (const block of content) {
          if (
            block &&
            typeof block === 'object' &&
            (block as { type?: string }).type === 'tool_result'
          ) {
            const typed = block as { tool_use_id?: string; content?: unknown }
            this.publish({
              id: typed.tool_use_id ?? randomUUID(),
              sessionId: this.session.id,
              role: 'tool',
              content: extractToolResultText(typed.content),
              messageType: 'tool_result',
              requestId,
              createdAt: nowIso(),
              isStreaming: false,
              isFinal: true,
            })
          }
        }
        return
      }

      case 'result': {
        usage.inputTokens = message.usage?.input_tokens ?? usage.inputTokens
        usage.outputTokens = message.usage?.output_tokens ?? usage.outputTokens
        usage.cacheReadInputTokens =
          message.usage?.cache_read_input_tokens ?? usage.cacheReadInputTokens
        usage.cacheCreationInputTokens =
          message.usage?.cache_creation_input_tokens ??
          usage.cacheCreationInputTokens
        usage.totalCostUsd = message.total_cost_usd ?? usage.totalCostUsd
        usage.numTurns = message.num_turns ?? usage.numTurns
        return
      }

      default:
        return
    }
  }

  /**
   * Translate one raw stream event into a progressive message.
   *
   * Deltas go out flagged `isStreaming: true, isFinal: false`, which is what
   * makes the panel's streaming indicator (and its "stop" affordance) real; the
   * final `assistant` message closes the same id with both flags flipped back.
   */
  private handleStreamEvent(event: unknown, requestId: string): void {
    const delta = this.stream.apply(event, requestId)
    if (!delta) {
      return
    }
    this.publish({
      id: delta.id,
      sessionId: this.session.id,
      role: 'assistant',
      content: delta.text,
      messageType: 'chat',
      requestId,
      createdAt: nowIso(),
      isStreaming: true,
      isFinal: false,
    })
  }
}

export { TOOL_TIMEOUT_MS }