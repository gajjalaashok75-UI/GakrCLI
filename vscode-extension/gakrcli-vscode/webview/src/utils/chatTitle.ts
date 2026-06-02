import type { ChatMessage } from '../types/chat';

export function getDisplaySessionTitle(
  messages: ChatMessage[],
  sessionTitle: string,
  chatSessionTitle: string | null,
): string {
  if (chatSessionTitle?.trim()) {
    return compactTitle(chatSessionTitle);
  }

  if (sessionTitle && sessionTitle !== 'New Conversation') {
    return sessionTitle;
  }

  return getFirstUserTitle(messages) ?? sessionTitle;
}

function getFirstUserTitle(messages: ChatMessage[]): string | null {
  const firstUser = messages.find((message) => message.role === 'user' && message.text?.trim());
  if (!firstUser?.text) {
    return null;
  }
  return compactTitle(firstUser.text);
}

function compactTitle(text: string): string {
  return text.replace(/\s+/g, ' ').trim().slice(0, 120);
}
