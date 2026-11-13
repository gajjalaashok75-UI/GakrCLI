import { describe, expect, test } from 'bun:test';
import { PanelAgentTranslator } from './eventTranslation.js';

const SESSION = 'session-1';
const REQUEST = 'request-1';

function translate(raw: unknown, includeThinking = false) {
  const translator = new PanelAgentTranslator(SESSION, { includeThinking });
  return translator.translate(raw, REQUEST);
}

describe('PanelAgentTranslator', () => {
  test('accumulates text deltas under one id and closes it with the assistant block', () => {
    const translator = new PanelAgentTranslator(SESSION);

    const start = translator.translate(
      {
        type: 'stream_event',
        event: {
          type: 'content_block_start',
          index: 0,
          content_block: { type: 'text', text: '' },
        },
      },
      REQUEST,
    );
    expect(start.events).toHaveLength(0);

    const first = translator.translate(
      {
        type: 'stream_event',
        event: {
          type: 'content_block_delta',
          index: 0,
          delta: { type: 'text_delta', text: 'Hel' },
        },
      },
      REQUEST,
    );
    const second = translator.translate(
      {
        type: 'stream_event',
        event: {
          type: 'content_block_delta',
          index: 0,
          delta: { type: 'text_delta', text: 'lo' },
        },
      },
      REQUEST,
    );

    const firstMessage = first.events[0];
    const secondMessage = second.events[0];
    if (firstMessage?.type !== 'message' || secondMessage?.type !== 'message') {
      throw new Error('expected message events');
    }
    expect(firstMessage.data.content).toBe('Hel');
    expect(secondMessage.data.content).toBe('Hello');
    expect(firstMessage.data.id).toBe(secondMessage.data.id);
    expect(firstMessage.data.isStreaming).toBe(true);
    expect(firstMessage.data.isFinal).toBe(false);

    const final = translator.translate(
      {
        type: 'assistant',
        message: { content: [{ type: 'text', text: 'Hello' }] },
      },
      REQUEST,
    );
    const finalMessage = final.events[0];
    if (finalMessage?.type !== 'message') {
      throw new Error('expected final message');
    }
    expect(finalMessage.data.id).toBe(firstMessage.data.id);
    expect(finalMessage.data.isFinal).toBe(true);
    expect(finalMessage.data.isStreaming).toBe(false);
  });

  test('maps tool_use and tool_result blocks', () => {
    const toolUse = translate({
      type: 'assistant',
      message: {
        content: [
          {
            type: 'tool_use',
            id: 'toolu_1',
            name: 'Bash',
            input: { command: 'ls' },
          },
        ],
      },
    }).events[0];
    if (toolUse?.type !== 'message') throw new Error('expected tool_use');
    expect(toolUse.data.id).toBe('toolu_1');
    expect(toolUse.data.messageType).toBe('tool_use');
    expect(toolUse.data.content).toBe('Bash');
    expect(toolUse.data.metadata).toEqual({
      toolName: 'Bash',
      input: { command: 'ls' },
    });

    const toolResult = translate({
      type: 'user',
      message: {
        content: [
          {
            type: 'tool_result',
            tool_use_id: 'toolu_1',
            content: [{ type: 'text', text: 'file.txt' }],
          },
        ],
      },
    }).events[0];
    if (toolResult?.type !== 'message') throw new Error('expected tool_result');
    expect(toolResult.data.id).toBe('toolu_1');
    expect(toolResult.data.role).toBe('tool');
    expect(toolResult.data.messageType).toBe('tool_result');
    expect(toolResult.data.content).toBe('file.txt');
  });

  test('emits usage and an error event for a failed result', () => {
    const { events, result } = translate({
      type: 'result',
      subtype: 'error',
      is_error: true,
      result: 'API blew up',
      usage: { input_tokens: 5, output_tokens: 2 },
      total_cost_usd: 0.01,
      duration_ms: 42,
      num_turns: 3,
    });

    expect(result).toBeDefined();
    expect(result!.isError).toBe(true);
    expect(result!.numTurns).toBe(3);
    expect(result!.usage.inputTokens).toBe(5);
    expect(result!.usage.totalCostUsd).toBe(0.01);

    expect(events[0]).toMatchObject({ type: 'usage' });
    expect(events.find(event => event.type === 'error')).toMatchObject({
      type: 'error',
      error: 'API blew up',
      data: { sessionId: SESSION, requestId: REQUEST },
    });
  });

  test('drops thinking by default and maps it when enabled', () => {
    const raw = {
      type: 'stream_event',
      event: {
        type: 'content_block_delta',
        index: 0,
        delta: { type: 'thinking_delta', thinking: 'pondering' },
      },
    };
    expect(translate(raw, false).events).toHaveLength(0);

    const enabled = new PanelAgentTranslator(SESSION, {
      includeThinking: true,
    }).translate(raw, REQUEST);
    const message = enabled.events[0];
    if (message?.type !== 'message') throw new Error('expected thinking');
    expect(message.data.content).toBe('<thinking>pondering</thinking>');
    expect(message.data.metadata).toMatchObject({ thinking: true });
  });

  test('ignores unknown and malformed input', () => {
    expect(translate(null).events).toHaveLength(0);
    expect(translate({ type: 'system', subtype: 'init' }).events).toHaveLength(0);
    expect(translate({ type: 'nonsense' }).events).toHaveLength(0);
  });
});
