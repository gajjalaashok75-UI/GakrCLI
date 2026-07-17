import { useEffect, useMemo } from 'react';
import type { ChatMessage, SubAgentSession, RenderableBlock } from '../../types/chat';
import type { ContentBlock } from '../../types/messages';
import { useAutoScroll } from '../../hooks/useAutoScroll';
import { UserMessage } from './UserMessage';
import { AssistantMessage } from './AssistantMessage';
import { SubAgentBlock } from './SubAgentBlock';
import { StreamingIndicator } from './StreamingIndicator';
import { findStreamingAssistantIndex } from '../../utils/messageListState';
import { shouldShowThinkingIndicator } from '../../utils/messageVisibility';
import { collectAssistantTurnText, isAssistantTurnEnd } from '../../utils/assistantTurnActions';

interface MessageListProps {
  messages: ChatMessage[];
  isStreaming: boolean;
  showThinking: boolean;
  processState?: 'idle' | 'starting' | 'running' | 'stopped' | 'crashed' | 'restarting';
  onEditMessage?: (uuid: string, newContent: string) => void;
  subAgentSessions?: Record<string, SubAgentSession>;
}

export function MessageList({ messages, isStreaming, showThinking, processState, onEditMessage, subAgentSessions = {} }: MessageListProps) {
  const { containerRef, userScrolledUp, autoScroll, scrollToBottom } = useAutoScroll();
  const latestAssistantIndex = findLatestAssistantIndex(messages);
  const streamingAssistantIndex = findStreamingAssistantIndex(messages);

  // Derive sub-agent grouping: which message IDs belong to sub-agents, and which tool_uses trigger them
  const { subAgentMessageIds, subAgentGroups, subAgentToolUseIds } = useMemo(() => {
    const agentKeys = new Set(Object.keys(subAgentSessions));
    const subMsgIds = new Set<string>();
    const groups: Record<string, ChatMessage[]> = {};
    const toolUseIds = new Set(agentKeys);

    // Scan all messages for Agent tool_use IDs so forwarded user messages
    // are hidden from the main conversation even before task_started arrives.
    for (const msg of messages) {
      if (msg.blocks) {
        for (const b of msg.blocks) {
          if (b.block.type === 'tool_use' && b.block.name === 'Agent' && b.block.id) {
            toolUseIds.add(b.block.id);
          }
        }
      }
    }

    for (const msg of messages) {
      const parentId = msg.parentToolUseId;
      if (parentId && toolUseIds.has(parentId)) {
        subMsgIds.add(msg.id);
        if (!groups[parentId]) groups[parentId] = [];
        groups[parentId].push(msg);
      }
    }

    return { subAgentMessageIds: subMsgIds, subAgentGroups: groups, subAgentToolUseIds: toolUseIds };
  }, [messages, subAgentSessions]);

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
          {messages.map((msg, index) => {
            // Skip messages that belong to a sub-agent (rendered inside SubAgentBlock)
            if (subAgentMessageIds.has(msg.id)) {
              return null;
            }

            // Check if this assistant message contains a tool_use that triggered a sub-agent
            // Build set of agent tool_use IDs including both known sessions and any Agent-named
            // tool_uses in this message. This handles the timing gap where tool_use arrives
            // before task_started, preventing instructions from rendering twice.
            const agentToolUseIds = new Set(subAgentToolUseIds);
            if (msg.blocks) {
              for (const b of msg.blocks) {
                if (b.block.type === 'tool_use' && b.block.name === 'Agent' && b.block.id) {
                  agentToolUseIds.add(b.block.id);
                }
              }
            }

            const isAgentToolUse = (b: RenderableBlock) =>
              b.block.type === 'tool_use' && agentToolUseIds.has(b.block.id);

            const subAgentTriggered = msg.role === 'assistant' && msg.blocks?.some(isAgentToolUse);

            // Filter out sub-agent tool_use AND tool_result blocks so they aren't rendered
            // by AssistantMessage (they will be rendered inside SubAgentBlock instead)
            const filteredBlocks = subAgentTriggered && msg.blocks
              ? msg.blocks.filter(
                  (b) => !(
                    isAgentToolUse(b) ||
                    (b.block.type === 'tool_result' && b.block.tool_use_id && agentToolUseIds.has(b.block.tool_use_id))
                  )
                )
              : msg.blocks;

            // Extract final result text from tool_result blocks that belong to sub-agents
            const finalResultMap = subAgentTriggered && msg.blocks
              ? extractFinalResults(msg.blocks, agentToolUseIds)
              : {};

            return (
              <div key={msg.id} className="message">
                {msg.role === 'user' ? (
                  <UserMessage message={msg} onEdit={onEditMessage} />
                ) : msg.role === 'system' ? (
                  <SystemMessage text={msg.text ?? ''} kind={msg.systemKind} />
                ) : (
                  <>
                    <AssistantMessage
                      message={{ ...msg, blocks: filteredBlocks }}
                      showThinking={showThinking}
                      isLatest={index === latestAssistantIndex}
                      isStreaming={isStreaming && index === streamingAssistantIndex}
                      showActions={isAssistantTurnEnd(messages, index)}
                      actionContent={collectAssistantTurnText(messages, index)}
                    />
                    {/* Render SubAgentBlock for each triggered sub-agent */}
                    {subAgentTriggered && msg.blocks?.map((block) => {
                      if (block.block.type !== 'tool_use' || !block.block.id) return null;
                      const isAgent = block.block.name === 'Agent';
                      if (!subAgentSessions[block.block.id] && !isAgent) return null;
                      // Create a pending session from the tool_use block when task_started hasn't arrived yet
                      const session = subAgentSessions[block.block.id] || {
                        toolUseId: block.block.id,
                        taskId: '',
                        agentType: block.block.name,
                        description: typeof (block.block.input as Record<string, unknown>)?.description === 'string'
                          ? (block.block.input as Record<string, unknown>).description as string
                          : '',
                        prompt: typeof (block.block.input as Record<string, unknown>)?.prompt === 'string'
                          ? (block.block.input as Record<string, unknown>).prompt as string
                          : '',
                        status: 'running' as const,
                        messages: [],
                      };
                      const childMessages = subAgentGroups[block.block.id] || [];
                      const finalResult = finalResultMap[block.block.id] || undefined;
                      return (
                        <SubAgentBlock
                          key={`subagent-${block.block.id}`}
                          session={session}
                          messages={childMessages}
                          finalResult={finalResult}
                        />
                      );
                    })}
                  </>
                )}
              </div>
            );
          })}

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

/** Extract text from a tool_result ContentBlock */
function extractToolResultText(block: ContentBlock & { type: 'tool_result' }): string {
  if (typeof block.content === 'string') return block.content;
  if (Array.isArray(block.content)) {
    return block.content
      .map((part) => {
        if (typeof part === 'string') return part;
        if ('text' in part) return part.text;
        return '';
      })
      .filter(Boolean)
      .join('\n');
  }
  return '';
}

/** Extract final result text from tool_result blocks for each sub-agent */
function extractFinalResults(
  blocks: { block: ContentBlock }[],
  subAgentToolUseIds: Set<string>,
): Record<string, string> {
  const results: Record<string, string> = {};
  for (const rb of blocks) {
    if (rb.block.type === 'tool_result' && rb.block.tool_use_id && subAgentToolUseIds.has(rb.block.tool_use_id)) {
      const text = extractToolResultText(rb.block);
      if (text) {
        results[rb.block.tool_use_id] = text;
      }
    }
  }
  return results;
}

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
