/**
 * Translate the headless CLI's NDJSON messages into the extension's
 * `RealtimeEvent` contract.
 *
 * This mirrors `agentServer/runner.ts` `handleSdkMessage()` exactly: streamed
 * text deltas and the final assistant text block publish under the same id
 * (via the shared `StreamBlockTracker`), tool calls publish as `tool_use`, tool
 * results as `tool_result`, and token/cost counts as a `usage` event. The
 * difference is the source: an actual `gakrcli --print` child instead of the
 * in-process SDK.
 */

import { randomUUID } from 'crypto';
import type {
  AgentMessage,
  AgentUsageStats,
  RealtimeEvent,
} from '@gakr-gakr/mcp-chrome-shared';
import { StreamBlockTracker } from '../agentServer/streaming.js';

/** Result of a single CLI turn, used by the worker to settle `sendTurn()`. */
export type TurnResult = {
  isError: boolean;
  resultText?: string;
  stopReason?: string;
  numTurns: number;
  durationMs?: number;
  usage: AgentUsageStats;
  cancelled?: boolean;
};

export type Translation = {
  events: RealtimeEvent[];
  result?: TurnResult;
};

type RawMessage = {
  type?: string;
  subtype?: string;
  session_id?: string;
  uuid?: string;
  message?: { content?: unknown };
  event?: unknown;
  usage?: Record<string, unknown>;
  total_cost_usd?: number;
  num_turns?: number;
  duration_ms?: number;
  duration_api_ms?: number;
  is_error?: boolean;
  result?: string;
  stop_reason?: string;
  permission_denials?: unknown[];
};

type ContentBlock = {
  type?: string;
  id?: string;
  name?: string;
  input?: unknown;
  text?: string;
  thinking?: string;
  tool_use_id?: string;
  content?: unknown;
};

function nowIso(): string {
  return new Date().toISOString();
}

function extractText(content: unknown): string {
  if (typeof content === 'string') {
    return content;
  }
  if (!Array.isArray(content)) {
    return '';
  }
  const parts: string[] = [];
  for (const block of content) {
    if (!block || typeof block !== 'object') {
      continue;
    }
    const typed = block as ContentBlock;
    if (typed.type === 'text' && typeof typed.text === 'string') {
      parts.push(typed.text);
    } else if (
      typed.type === 'thinking' &&
      typeof typed.thinking === 'string'
    ) {
      parts.push(typed.thinking);
    }
  }
  return parts.join('\n');
}

/**
 * Render a tool_result's inner content back into text.
 *
 * `runner.ts` only matched nested `tool_result` blocks here, so ordinary text
 * results rendered as an empty timeline row; the replacement reads the inner
 * blocks directly and keeps supporting nested results.
 */
function extractToolResultText(content: unknown): string {
  if (typeof content === 'string') {
    return content;
  }
  if (!Array.isArray(content)) {
    return '';
  }
  const parts: string[] = [];
  for (const block of content) {
    if (!block || typeof block !== 'object') {
      continue;
    }
    const typed = block as ContentBlock;
    if (typed.type === 'tool_result') {
      parts.push(extractToolResultText(typed.content));
    } else {
      parts.push(extractText([typed]));
    }
  }
  return parts.filter(Boolean).join('\n');
}

export type TranslatorOptions = {
  /**
   * Thinking deltas are dropped by the legacy runtime. The CLI emits them, and
   * the side panel can render `<thinking>` sections, so the worker can opt in;
   * default stays false until the panel has a reviewed thinking surface.
   */
  includeThinking?: boolean;
};

export class PanelAgentTranslator {
  private readonly stream = new StreamBlockTracker();
  private readonly thinking = new Map<number, string>();

  constructor(
    private readonly sessionId: string,
    private readonly options: TranslatorOptions = {},
  ) {}

  private message(fields: {
    id: string;
    role: AgentMessage['role'];
    content: string;
    messageType: AgentMessage['messageType'];
    requestId: string;
    isStreaming?: boolean;
    isFinal?: boolean;
    metadata?: Record<string, unknown>;
  }): RealtimeEvent {
    return {
      type: 'message',
      data: {
        sessionId: this.sessionId,
        createdAt: nowIso(),
        isStreaming: false,
        isFinal: true,
        ...fields,
      },
    };
  }

  translate(raw: unknown, requestId: string): Translation {
    if (!raw || typeof raw !== 'object') {
      return { events: [] };
    }
    const message = raw as RawMessage;

    switch (message.type) {
      case 'stream_event':
        return { events: this.translateStreamEvent(message.event, requestId) };

      case 'assistant':
        return { events: this.translateAssistant(message, requestId) };

      case 'user':
        return { events: this.translateUser(message, requestId) };

      case 'result':
        return this.translateResult(message, requestId);

      default:
        return { events: [] };
    }
  }

  private translateStreamEvent(
    event: unknown,
    requestId: string,
  ): RealtimeEvent[] {
    const events: RealtimeEvent[] = [];

    const delta = this.stream.apply(event, requestId);
    if (delta) {
      events.push(
        this.message({
          id: delta.id,
          role: 'assistant',
          content: delta.text,
          messageType: 'chat',
          requestId,
          isStreaming: true,
          isFinal: false,
          metadata: { streamed: true },
        }),
      );
    }

    if (this.options.includeThinking) {
      const typed = event as {
        type?: string;
        index?: number;
        delta?: { type?: string; thinking?: string };
      };
      if (
        typed.type === 'content_block_delta' &&
        typed.delta?.type === 'thinking_delta' &&
        typeof typed.delta.thinking === 'string'
      ) {
        const index = typed.index ?? 0;
        const text = (this.thinking.get(index) ?? '') + typed.delta.thinking;
        this.thinking.set(index, text);
        events.push(
          this.message({
            id: `${requestId}:thinking:${index}`,
            role: 'assistant',
            content: `<thinking>${text}</thinking>`,
            messageType: 'chat',
            requestId,
            isStreaming: true,
            isFinal: false,
            metadata: { thinking: true, blockIndex: index },
          }),
        );
      }
    }

    return events;
  }

  private translateAssistant(
    message: RawMessage,
    requestId: string,
  ): RealtimeEvent[] {
    const content = message.message?.content;
    if (!Array.isArray(content)) {
      return [];
    }

    const events: RealtimeEvent[] = [];
    for (let index = 0; index < content.length; index++) {
      const block = content[index] as ContentBlock | undefined;
      if (!block || typeof block !== 'object') {
        continue;
      }
      if (block.type === 'text' && typeof block.text === 'string') {
        events.push(
          this.message({
            id: this.stream.idForBlock(index) ?? block.id ?? randomUUID(),
            role: 'assistant',
            content: block.text,
            messageType: 'chat',
            requestId,
            isStreaming: false,
            isFinal: true,
          }),
        );
      } else if (block.type === 'thinking') {
        if (
          this.options.includeThinking &&
          typeof block.thinking === 'string' &&
          block.thinking.length > 0
        ) {
          events.push(
            this.message({
              id: `${requestId}:thinking:${index}`,
              role: 'assistant',
              content: `<thinking>${block.thinking}</thinking>`,
              messageType: 'chat',
              requestId,
              isStreaming: false,
              isFinal: true,
              metadata: { thinking: true, blockIndex: index },
            }),
          );
        }
      } else if (block.type === 'tool_use') {
        events.push(
          this.message({
            id: block.id ?? randomUUID(),
            role: 'assistant',
            content: block.name ?? 'tool',
            messageType: 'tool_use',
            requestId,
            metadata: { toolName: block.name, input: block.input },
          }),
        );
      }
    }

    // Every block in this message is complete; the next message restarts
    // block indexes.
    this.stream.reset();
    this.thinking.clear();
    return events;
  }

  private translateUser(
    message: RawMessage,
    requestId: string,
  ): RealtimeEvent[] {
    const content = message.message?.content;
    if (!Array.isArray(content)) {
      return [];
    }
    const events: RealtimeEvent[] = [];
    for (const block of content) {
      const typed = block as ContentBlock | undefined;
      if (typed?.type !== 'tool_result') {
        continue;
      }
      events.push(
        this.message({
          id: typed.tool_use_id ?? randomUUID(),
          role: 'tool',
          content: extractToolResultText(typed.content),
          messageType: 'tool_result',
          requestId,
        }),
      );
    }
    return events;
  }

  private translateResult(message: RawMessage, requestId: string): Translation {
    const usage = message.usage ?? {};
    const stats: AgentUsageStats = {
      sessionId: this.sessionId,
      requestId,
      inputTokens: Number(usage.input_tokens ?? 0),
      outputTokens: Number(usage.output_tokens ?? 0),
      cacheReadInputTokens: Number(usage.cache_read_input_tokens ?? 0),
      cacheCreationInputTokens: Number(usage.cache_creation_input_tokens ?? 0),
      totalCostUsd: Number(message.total_cost_usd ?? 0),
      durationMs: Number(message.duration_ms ?? 0),
      numTurns: Number(message.num_turns ?? 0),
    };

    const isError = message.is_error === true || message.subtype === 'error';
    const events: RealtimeEvent[] = [{ type: 'usage', data: stats }];
    const result: TurnResult = {
      isError,
      resultText: message.result,
      stopReason: message.stop_reason,
      numTurns: stats.numTurns,
      durationMs: message.duration_ms,
      usage: stats,
    };

    if (isError) {
      const error = message.result?.trim() || 'Agent turn failed';
      events.push({
        type: 'error',
        error,
        data: { sessionId: this.sessionId, requestId },
      });
    }

    return { events, result };
  }
}
