import { describe, expect, test } from 'bun:test';
import type { ChatMessage } from '../types/chat';
import {
  COMPACTED_TEXT,
  COMPACTING_TEXT,
  completeCompactSystemMessage,
  startCompactSystemMessage,
} from './compactSystemMessage';

describe('compact system message transitions', () => {
  test('adds a single active compacting marker', () => {
    const first = startCompactSystemMessage([], 'compact-1', 10);
    const second = startCompactSystemMessage(first, 'compact-2', 20);

    expect(second).toHaveLength(1);
    expect(second[0]).toMatchObject({
      id: 'compact-1',
      text: COMPACTING_TEXT,
      systemKind: 'compact-start',
    });
  });

  test('turns the active marker into the completed marker', () => {
    const started = startCompactSystemMessage([], 'compact-1', 10);
    const completed = completeCompactSystemMessage(started, 'compact-1', 20);

    expect(completed).toHaveLength(1);
    expect(completed[0]).toMatchObject({
      id: 'compact-1',
      text: COMPACTED_TEXT,
      systemKind: 'compact-done',
    });
  });

  test('adds a completed marker when history only contains the boundary', () => {
    const existing: ChatMessage[] = [{
      id: 'assistant-1',
      role: 'assistant',
      blocks: [],
      isStreaming: false,
      timestamp: 1,
      parentToolUseId: null,
    }];

    const completed = completeCompactSystemMessage(existing, 'compact-1', 20);

    expect(completed).toHaveLength(2);
    expect(completed[1]).toMatchObject({
      text: COMPACTED_TEXT,
      systemKind: 'compact-done',
    });
  });
});
