import { useEffect } from 'react';
import type { ChatMessage } from '../../types/chat';
import { useAutoScroll } from '../../hooks/useAutoScroll';
import { UserMessage } from './UserMessage';
import { AssistantMessage } from './AssistantMessage';
import { StreamingIndicator } from './StreamingIndicator';
import { findStreamingAssistantIndex } from '../../utils/messageListState';
import { shouldShowThinkingIndicator } from '../../utils/messageVisibility';
import { collectAssistantTurnText, isAssistantTurnEnd } from '../../utils/assistantTurnActions';

interface MessageListProps {
  messages: ChatMessage[];
  isStreaming: boolean;
  processState?: 'idle' | 'starting' | 'running' | 'stopped' | 'crashed' | 'restarting';
  onEditMessage?: (uuid: string, newContent: string) => void;
}

export function MessageList({ messages, isStreaming, processState, onEditMessage }: MessageListProps) {
  const { containerRef, userScrolledUp, autoScroll, scrollToBottom } = useAutoScroll();
  const latestAssistantIndex = findLatestAssistantIndex(messages);
  const streamingAssistantIndex = findStreamingAssistantIndex(messages);

  // Auto-scroll when messages change or streaming content updates
  useEffect(() => {
    autoScroll();
  }, [messages, isStreaming, autoScroll]);

  if (messages.length === 0) {
    return (
      <div
        ref={containerRef}
        className="messages-container"
        style={{ justifyContent: 'center', alignItems: 'center' }}
      >
        {processState === 'starting' ? <LoadingState /> : <EmptyState />}
      </div>
    );
  }

  return (
    <div className="flex-1 relative">
      <div
        ref={containerRef}
        className="messages-container"
        style={{ position: 'absolute', inset: 0 }}
      >
        {/* Message list */}
        <div>
          {messages.map((msg, index) => (
            <div key={msg.id} className="message">
              {msg.role === 'user' ? (
                <UserMessage message={msg} onEdit={onEditMessage} />
              ) : msg.role === 'system' ? (
                <SystemMessage text={msg.text ?? ''} kind={msg.systemKind} />
              ) : (
                <AssistantMessage
                  message={msg}
                  isLatest={index === latestAssistantIndex}
                  isStreaming={isStreaming && index === streamingAssistantIndex}
                  showActions={isAssistantTurnEnd(messages, index)}
                  actionContent={collectAssistantTurnText(messages, index)}
                />
              )}
            </div>
          ))}

          {/* Streaming indicator — shown when waiting for first content block */}
          <StreamingIndicator
            visible={shouldShowThinkingIndicator(messages, isStreaming)}
          />

        </div>
      </div>

      {/* Scroll-to-bottom button when user has scrolled up */}
      {userScrolledUp && (
        <button
          onClick={() => scrollToBottom('smooth')}
          className="absolute bottom-4 right-4 z-10
            flex items-center gap-1.5 px-3 py-1.5 rounded-full
            bg-vscode-button-bg text-vscode-button-fg text-xs
            shadow-lg hover:bg-vscode-button-hover transition-colors"
          title="Scroll to bottom"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="6 9 12 15 18 9" />
          </svg>
          New content
        </button>
      )}
    </div>
  );
}

// ============================================================================
// Helpers
// ============================================================================

function findLatestAssistantIndex(messages: ChatMessage[]): number {
  for (let index = messages.length - 1; index >= 0; index--) {
    if (messages[index]?.role === 'assistant') {
      return index;
    }
  }
  return -1;
}

function EmptyState() {
  return (
    <div className="empty-state">
      <div className="empty-state-content" style={{ opacity: 0.4, padding: '0 20px' }}>
        <div style={{ fontSize: '2em', marginBottom: 12 }}>{"{ }"}</div>
        <p style={{ fontSize: '0.85em', fontWeight: 500, marginBottom: 4 }}>No messages yet</p>
        <p style={{ fontSize: '0.75em' }}>Type a message below to start a conversation.</p>
      </div>
    </div>
  );
}

function LoadingState() {
  return (
    <div className="empty-state">
      <div className="empty-state-content" style={{ opacity: 0.5, padding: '0 20px' }}>
        <p style={{ fontSize: '0.85em', fontWeight: 500 }}>Loading session...</p>
      </div>
    </div>
  );
}

/** Inline system message (api_retry, compact_boundary, tool_use_summary) */
function SystemMessage({
  text,
  kind,
}: {
  text: string;
  kind?: ChatMessage['systemKind'];
}) {
  if (kind === 'compact-start' || kind === 'compact-done') {
    return (
      <div
        className="compact-boundary"
        data-state={kind === 'compact-start' ? 'active' : 'done'}
        role="status"
        aria-live="polite"
      >
        <span className="compact-boundary-line" />
        <span className="compact-boundary-label">
          <CompactBoundaryIcon active={kind === 'compact-start'} />
          <span>{text}</span>
        </span>
        <span className="compact-boundary-line" />
      </div>
    );
  }

  return (
    <div
      style={{
        color: 'var(--app-secondary-foreground)',
        fontSize: 11,
        fontStyle: 'italic',
        padding: '2px 0',
        opacity: 0.7,
      }}
    >
      {text}
    </div>
  );
}

function CompactBoundaryIcon({ active }: { active: boolean }) {
  if (active) {
    return (
      <span className="compact-boundary-spinner" aria-hidden="true" />
    );
  }

  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M4 3h5l3 3v7H4z" />
      <path d="M9 3v3h3" />
      <path d="M2.5 5.5h2" />
      <path d="M2.5 8h2" />
      <path d="M2.5 10.5h2" />
    </svg>
  );
}
