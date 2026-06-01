import type { ChatMessage } from '../types/chat';

export function findStreamingAssistantIndex(messages: ChatMessage[]): number {
  for (let index = messages.length - 1; index >= 0; index--) {
    const message = messages[index];
    if (message?.role === 'assistant' && message.isStreaming) {
      return index;
    }
  }
  return -1;
}
