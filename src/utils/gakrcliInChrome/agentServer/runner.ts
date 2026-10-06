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
import { createSdkMcpServer } from '../../../entrypoints/sdk/index.js'
import { query, type Query } from '../../../entrypoints/sdk/query.js'
import type { SDKMessage } from '../../../entrypoints/sdk/shared.js'
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

  constructor(
    readonly session: AgentSession,
    private readonly store: AgentServerStore,
    private readonly runTool: ToolExecutor,
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

  /** Append a message, persist it, and stream it to subscribers. */
  publish(message: AgentMessage): void {
    const stored = this.store.addMessage({
      id: message.id,
      projectId: this.session.projectId,
      sessionId: this.session.id,
      role: message.role,
      content: message.content,
      messageType: message.messageType,
      metadata: message.metadata,
      cliSource: message.cliSource ?? null,
      requestId: message.requestId,
      createdAt: message.createdAt,
    })
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

    // Echo the user's own message so the panel can swap its optimistic bubble
    // for the persisted one. `displayText` wins: the panel may inject context
    // into `instruction` that should not be shown back to the user.
    this.publish({
      id: randomUUID(),
      sessionId: this.session.id,
      role: 'user',
      content: request.displayText?.trim() || request.instruction,
      messageType: 'chat',
      requestId,
      createdAt: nowIso(),
      metadata: request.displayText?.trim() || request.clientMeta
        ? {
            displayText: request.displayText?.trim(),
            clientMeta: request.clientMeta,
          }
        : undefined,
    })

    const project = this.store.getProject(this.session.projectId)
    const cwd = request.projectRoot || project?.rootPath || process.cwd()
    const browserContext = await this.collectBrowserContext()

    let agentQuery: Query
    try {
      agentQuery = query({
        prompt: this.buildPrompt(request, browserContext),
        options: {
          cwd,
          model: request.model ?? this.session.model,
          permissionMode: this.resolvePermissionMode(),
          abortController: abort,
          includePartialMessages: true,
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
   * Ask the extension what the browser currently looks like.
   *
   * Without this the agent has no idea it is driving a real browser — it
   * cannot answer "which tab am I on?" without spending a tool call to find
   * out. Best-effort: a disconnected extension must not block the prompt, so
   * failures degrade to a short note instead of throwing.
   */
  private async collectBrowserContext(): Promise<string> {
    try {
      const result = await this.runTool(TABS_TOOL, {})
      return [
        'You are running inside the GakrCLI in Chrome side panel, connected to',
        "the user's real Chrome browser via the GakrCLI extension.",
        'Use the chrome_* tools for anything about the browser (tabs,',
        'navigation, page content, clicking, typing). Do not use them for',
        'general coding tasks.',
        '',
        'Current browser state:',
        typeof result === 'string' ? result : JSON.stringify(result, null, 2),
      ].join('\n')
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      return [
        'You are running inside the GakrCLI in Chrome side panel. The chrome_*',
        'tools are available but the extension did not respond, so the current',
        'browser state is unknown. If a tool call fails, the extension may be',
        'disconnected.',
        `(last error: ${message})`,
      ].join('\n')
    }
  }

  private buildPrompt(
    request: AgentActRequest,
    browserContext: string,
  ): string {
    const parts = [browserContext, '', '---', '', request.instruction]
    if (request.attachments?.length) {
      parts.push(
        '',
        'Attached from the browser side panel:',
        ...request.attachments.map(
          a => `- ${a.name} (${a.mimeType}, ${a.type})`,
        ),
      )
    }
    return parts.join('\n')
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
      case 'assistant': {
        const content = message.message?.content
        if (!Array.isArray(content)) {
          return
        }
        for (const block of content) {
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
              id: typed.id ?? randomUUID(),
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
}

export { TOOL_TIMEOUT_MS }