import { describe, expect, test } from 'bun:test';

import type { ChatMessage } from '../types/chat';
import { getDisplaySessionTitle } from './chatTitle.ts';

function user(text: string): ChatMessage {
  return {
    id: 'user-1',
    role: 'user',
    text,
    isStreaming: false,
    timestamp: 1,
    parentToolUseId: null,
  };
}

describe('getDisplaySessionTitle', () => {
  test('uses the live first user prompt while a new conversation has no session title yet', () => {
    expect(getDisplaySessionTitle([user('hello are you there')], 'New Conversation', null)).toBe('hello are you there');
  });

  test('keeps resumed or host session titles ahead of the live fallback', () => {
    expect(getDisplaySessionTitle([user('new text')], 'hello are you there', null)).toBe('hello are you there');
  });

  test('uses chat ai title ahead of session fallback', () => {
    expect(getDisplaySessionTitle([user('new text')], 'fallback', 'AI title')).toBe('AI title');
  });
});
