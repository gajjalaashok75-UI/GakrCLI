import type { ChatMessage } from '../types/chat';

export function isAssistantTurnEnd(messages: ChatMessage[], index: number): boolean {
  const message = messages[index];
  if (message?.role !== 'assistant') {
    return false;
  }

  return messages[index + 1]?.role !== 'assistant';
}

export function collectAssistantTurnText(messages: ChatMessage[], endIndex: number): string {
  if (!isAssistantTurnEnd(messages, endIndex)) {
    return '';
  }

  let startIndex = endIndex;
  while (startIndex > 0 && messages[startIndex - 1]?.role === 'assistant') {
    startIndex--;
  }

  const parts: string[] = [];
  for (let index = startIndex; index <= endIndex; index++) {
    const message = messages[index];
    if (message?.role !== 'assistant') {
      continue;
    }

    for (const block of message.blocks ?? []) {
      const content = block.block;
      if (content.type === 'text' && content.text.trim()) {
        parts.push(content.text.trim());
      }
    }
  }

  return parts.join('\n\n').trim();
}
