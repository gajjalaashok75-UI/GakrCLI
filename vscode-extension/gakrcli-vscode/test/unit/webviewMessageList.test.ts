import { describe, expect, it } from 'vitest';
import { findStreamingAssistantIndex } from '../../webview/src/utils/messageListState';
import type { ChatMessage } from '../../webview/src/types/chat';

describe('webview message list state', () => {
  it('does not treat the latest completed assistant message as the stoppable turn', () => {
    const messages: ChatMessage[] = [
      {
        id: 'user-1',
        role: 'user',
        text: 'tell me a myth',
        isStreaming: false,
        timestamp: 1,
        parentToolUseId: null,
      },
      {
        id: 'assistant-1',
        role: 'assistant',
        isStreaming: false,
        timestamp: 2,
        parentToolUseId: null,
        blocks: [{ index: 0, isStreaming: false, block: { type: 'text', text: 'Prometheus...' } }],
      },
      {
        id: 'user-2',
        role: 'user',
        text: 'tell me a joke',
        isStreaming: false,
        timestamp: 3,
        parentToolUseId: null,
      },
    ];

    expect(findStreamingAssistantIndex(messages)).toBe(-1);
  });

  it('returns the active assistant turn when one exists', () => {
    const messages: ChatMessage[] = [
      {
        id: 'assistant-1',
        role: 'assistant',
        isStreaming: false,
        timestamp: 1,
        parentToolUseId: null,
        blocks: [{ index: 0, isStreaming: false, block: { type: 'text', text: 'done' } }],
      },
      {
        id: 'assistant-2',
        role: 'assistant',
        isStreaming: true,
        timestamp: 2,
        parentToolUseId: null,
        blocks: [{ index: 0, isStreaming: true, block: { type: 'text', text: 'working' } }],
      },
    ];

    expect(findStreamingAssistantIndex(messages)).toBe(1);
  });
});
