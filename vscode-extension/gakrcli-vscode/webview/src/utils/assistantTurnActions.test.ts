import { describe, expect, test } from 'bun:test';

import type { ChatMessage } from '../types/chat';
import { collectAssistantTurnText, isAssistantTurnEnd } from './assistantTurnActions.ts';

function assistant(id: string, text: string): ChatMessage {
  return {
    id,
    role: 'assistant',
    blocks: [
      {
        index: 0,
        block: { type: 'text', text },
        isStreaming: false,
      },
    ],
    isStreaming: false,
    timestamp: 1,
    parentToolUseId: null,
  };
}

const user: ChatMessage = {
  id: 'user-1',
  role: 'user',
  text: 'hi',
  isStreaming: false,
  timestamp: 1,
  parentToolUseId: null,
};

describe('assistant turn actions', () => {
  test('only the last assistant fragment in a run is the turn end', () => {
    const messages = [user, assistant('a1', 'first'), assistant('a2', 'second'), user];

    expect(isAssistantTurnEnd(messages, 1)).toBe(false);
    expect(isAssistantTurnEnd(messages, 2)).toBe(true);
  });

  test('collects all text fragments from one assistant turn', () => {
    const messages = [user, assistant('a1', 'first'), assistant('a2', 'second')];

    expect(collectAssistantTurnText(messages, 2)).toBe('first\n\nsecond');
    expect(collectAssistantTurnText(messages, 1)).toBe('');
  });
});
