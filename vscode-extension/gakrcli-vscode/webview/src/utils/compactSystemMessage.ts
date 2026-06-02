import type { ChatMessage } from '../types/chat';

export const COMPACTING_TEXT = 'Automatically compacting context';
export const COMPACTED_TEXT = 'Context automatically compacted';

export function startCompactSystemMessage(
  messages: ChatMessage[],
  id: string,
  timestamp = Date.now(),
): ChatMessage[] {
  const existingIndex = findActiveCompactIndex(messages);
  if (existingIndex >= 0) {
    return messages;
  }

  return [
    ...messages,
    {
      id,
      role: 'system',
      text: COMPACTING_TEXT,
      systemKind: 'compact-start',
      isStreaming: false,
      timestamp,
      parentToolUseId: null,
    },
  ];
}

export function completeCompactSystemMessage(
  messages: ChatMessage[],
  id: string,
  timestamp = Date.now(),
): ChatMessage[] {
  const existingIndex = findActiveCompactIndex(messages);
  if (existingIndex >= 0) {
    return messages.map((message, index) =>
      index === existingIndex
        ? {
            ...message,
            text: COMPACTED_TEXT,
            systemKind: 'compact-done',
          }
        : message,
    );
  }

  if (messages.some((message) => message.systemKind === 'compact-done' && message.id === id)) {
    return messages;
  }

  return [
    ...messages,
    {
      id,
      role: 'system',
      text: COMPACTED_TEXT,
      systemKind: 'compact-done',
      isStreaming: false,
      timestamp,
      parentToolUseId: null,
    },
  ];
}

function findActiveCompactIndex(messages: ChatMessage[]): number {
  return messages.findIndex((message) => message.systemKind === 'compact-start');
}
