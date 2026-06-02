import { describe, expect, test } from 'bun:test';

import type { ChatMessage, RenderableBlock } from '../types/chat';
import {
  hasActiveThinkingBlock,
  hasVisibleAssistantBlocks,
  isVisibleAssistantBlock,
  shouldShowThinkingIndicator,
} from './messageVisibility.ts';

function assistant(blocks: RenderableBlock[], isStreaming = true): ChatMessage {
  return {
    id: 'assistant-1',
    role: 'assistant',
    blocks,
    isStreaming,
    timestamp: 1,
    parentToolUseId: null,
  };
}

function block(type: string, isStreaming = false): RenderableBlock {
  const content =
    type === 'text'
      ? { type: 'text' as const, text: 'hello' }
      : type === 'tool_use'
        ? { type: 'tool_use' as const, id: 'tool-1', name: 'Write', input: {} }
        : type === 'redacted_thinking'
          ? { type: 'redacted_thinking' as const }
          : { type: 'thinking' as const, thinking: 'private reasoning' };

  return {
    index: 0,
    block: content,
    isStreaming,
  };
}

describe('message visibility helpers', () => {
  test('thinking blocks are not visible assistant content', () => {
    expect(isVisibleAssistantBlock(block('thinking'))).toBe(false);
    expect(isVisibleAssistantBlock(block('redacted_thinking'))).toBe(false);
    expect(isVisibleAssistantBlock(block('text'))).toBe(true);
  });

  test('shows the compact indicator while hidden thinking is active', () => {
    const messages = [assistant([block('thinking', true)])];

    expect(hasActiveThinkingBlock(messages)).toBe(true);
    expect(hasVisibleAssistantBlocks(messages)).toBe(false);
    expect(shouldShowThinkingIndicator(messages, true)).toBe(true);
  });

  test('keeps the indicator visible when hidden thinking follows a tool call', () => {
    const messages = [assistant([block('tool_use'), block('thinking', true)])];

    expect(hasVisibleAssistantBlocks(messages)).toBe(true);
    expect(shouldShowThinkingIndicator(messages, true)).toBe(true);
  });

  test('does not show the thinking indicator while visible text is streaming', () => {
    const messages = [assistant([block('text', true)])];

    expect(hasActiveThinkingBlock(messages)).toBe(false);
    expect(shouldShowThinkingIndicator(messages, true)).toBe(false);
  });

  test('does not show old completed thinking after streaming stops', () => {
    const messages = [assistant([block('thinking', false)], false)];

    expect(shouldShowThinkingIndicator(messages, false)).toBe(false);
  });
});
