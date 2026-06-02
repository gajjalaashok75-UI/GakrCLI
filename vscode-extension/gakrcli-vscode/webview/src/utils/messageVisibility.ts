import type { ChatMessage, RenderableBlock } from '../types/chat';

export function isThinkingBlock(block: unknown): boolean {
  return Boolean(
    block &&
      typeof block === 'object' &&
      ((block as Record<string, unknown>).type === 'thinking' ||
        (block as Record<string, unknown>).type === 'redacted_thinking'),
  );
}

export function isVisibleAssistantBlock(renderableBlock: RenderableBlock): boolean {
  return !isThinkingBlock(renderableBlock.block);
}

export function hasActiveThinkingBlock(messages: ChatMessage[]): boolean {
  const assistant = findLatestStreamingAssistant(messages);
  if (!assistant) {
    return false;
  }

  return (assistant.blocks ?? []).some(
    (block) => block.isStreaming && isThinkingBlock(block.block),
  );
}

export function hasVisibleAssistantBlocks(messages: ChatMessage[]): boolean {
  const assistant = findLatestStreamingAssistant(messages) ?? findLatestAssistant(messages);
  if (!assistant) {
    return false;
  }

  return (assistant.blocks ?? []).some(isVisibleAssistantBlock);
}

export function shouldShowThinkingIndicator(messages: ChatMessage[], isStreaming: boolean): boolean {
  return isStreaming && (hasActiveThinkingBlock(messages) || !hasVisibleAssistantBlocks(messages));
}

function findLatestStreamingAssistant(messages: ChatMessage[]): ChatMessage | null {
  for (let index = messages.length - 1; index >= 0; index--) {
    const message = messages[index];
    if (message?.role === 'assistant' && message.isStreaming) {
      return message;
    }
  }
  return null;
}

function findLatestAssistant(messages: ChatMessage[]): ChatMessage | null {
  for (let index = messages.length - 1; index >= 0; index--) {
    const message = messages[index];
    if (message?.role === 'assistant') {
      return message;
    }
  }
  return null;
}
