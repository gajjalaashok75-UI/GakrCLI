import React, { useState, useMemo } from 'react';
import type { ChatMessage, SubAgentSession, RenderableBlock } from '../../types/chat';
import type { ContentBlock } from '../../types/messages';
import { ToolCallBlock } from './ToolCallBlock';

interface SubAgentBlockProps {
  session: SubAgentSession;
  messages: ChatMessage[];
  finalResult?: string;
}

export const SubAgentBlock: React.FC<SubAgentBlockProps> = ({ session, messages, finalResult }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [showFullPrompt, setShowFullPrompt] = useState(false);
  const [showFullFinalResult, setShowFullFinalResult] = useState(false);
  const isRunning = session.status === 'running';

  const hasLongPrompt = useMemo(() => session.prompt.length > 200, [session.prompt]);
  const hasLongFinalResult = useMemo(() => !!finalResult && finalResult.length > 200, [finalResult]);

  const durationText = useMemo(() => {
    if (!session.durationMs) return null;
    if (session.durationMs < 1000) return `${session.durationMs}ms`;
    if (session.durationMs < 60000) return `${(session.durationMs / 1000).toFixed(1)}s`;
    const mins = Math.floor(session.durationMs / 60000);
    const secs = Math.floor((session.durationMs % 60000) / 1000);
    return `${mins}m ${secs}s`;
  }, [session.durationMs]);

  return (
    <div className={`sub-agent-block ${isRunning ? 'sub-agent-running' : 'sub-agent-completed'}`}>
      {/* Header — click to expand/collapse */}
      <div
        className="sub-agent-header"
        onClick={() => setIsExpanded((prev) => !prev)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setIsExpanded((prev) => !prev); } }}
      >
        <div className="sub-agent-header-left">
          <div className={`sub-agent-status-dot ${isRunning ? 'running' : 'completed'}`} />
          <div className="sub-agent-header-info">
            <span className="sub-agent-name">
              {session.agentType || 'Agent'}
            </span>
            <span className="sub-agent-description">
              {session.description || session.taskId.slice(0, 16)}
            </span>
          </div>
        </div>
        <div className="sub-agent-header-right">
          <span className={`sub-agent-badge ${isRunning ? 'badge-running' : 'badge-completed'}`}>
            {isRunning ? 'Running' : 'Done'}
          </span>
          {durationText && !isRunning && (
            <span className="sub-agent-duration">{durationText}</span>
          )}
          <span className={`sub-agent-chevron ${isExpanded ? 'expanded' : ''}`}>
            ▸
          </span>
        </div>
      </div>

      {/* Expanded content */}
      {isExpanded && (
        <div className="sub-agent-content">
          {/* Instructions — collapsible, shows 2 lines by default */}
          {session.prompt && (
            <div className="sub-agent-instruction">
              <div
                className="sub-agent-instruction-header"
                onClick={() => setShowFullPrompt((prev) => !prev)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setShowFullPrompt((prev) => !prev); } }}
              >
                <span className="sub-agent-instruction-label">Instructions</span>
                <span className={`sub-agent-chevron ${showFullPrompt ? 'expanded' : ''}`}>▸</span>
              </div>
              <pre className={`sub-agent-instruction-text ${showFullPrompt ? 'expanded' : 'collapsed'}`}>
                {session.prompt}
              </pre>
              {hasLongPrompt && (
                <button
                  className="sub-agent-toggle-btn"
                  onClick={(e) => { e.stopPropagation(); setShowFullPrompt((prev) => !prev); }}
                >
                  {showFullPrompt ? 'Show less' : 'Show more'}
                </button>
              )}
            </div>
          )}

          {/* Messages from the sub-agent — skip forwarded user messages that duplicate instructions */}
          {messages.filter(msg => msg.role !== 'user' || msg.text !== session.prompt).length > 0 && (
            <div className="sub-agent-messages">
              {messages.map((msg) => {
                if (msg.role === 'user' && msg.text === session.prompt) return null;
                return <SubAgentMessageView key={msg.id} message={msg} />;
              })}
            </div>
          )}

          {/* Final result — collapsible with truncation */}
          {finalResult && (
            <div className="sub-agent-final-result">
              <div
                className="sub-agent-final-result-header"
                onClick={() => setShowFullFinalResult((prev) => !prev)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setShowFullFinalResult((prev) => !prev); } }}
              >
                <span className="sub-agent-final-result-label">Result</span>
                <span className={`sub-agent-chevron ${showFullFinalResult ? 'expanded' : ''}`}>▸</span>
              </div>
              <div className={`sub-agent-final-result-text ${showFullFinalResult ? 'expanded' : 'collapsed'}`}>
                {finalResult}
              </div>
              {hasLongFinalResult && (
                <button
                  className="sub-agent-toggle-btn"
                  onClick={(e) => { e.stopPropagation(); setShowFullFinalResult((prev) => !prev); }}
                >
                  {showFullFinalResult ? 'Show less' : 'Show more'}
                </button>
              )}
            </div>
          )}

          {/* Running indicator */}
          {isRunning && (
            <div className="sub-agent-running-indicator">
              <span className="running-dot" />
              Agent is running...
            </div>
          )}

          {/* Completed summary */}
          {!isRunning && session.durationMs !== undefined && (
            <div className="sub-agent-done-text">
              Completed in {durationText}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

/** Renders a single message inside sub-agent — no redundant label above tool calls */
const SubAgentMessageView: React.FC<{ message: ChatMessage }> = ({ message }) => {
  if (message.role === 'user') {
    if (message.text) {
      return (
        <div className="sub-agent-msg sub-agent-msg-user">
          <div className="sub-agent-msg-blocks">
            <pre className="sub-agent-msg-text">{message.text}</pre>
          </div>
        </div>
      );
    }
    return null;
  }

  if (message.role === 'assistant') {
    if (message.blocks && message.blocks.length > 0) {
      return (
        <div className="sub-agent-msg sub-agent-msg-assistant">
          <div className="sub-agent-msg-blocks">
            <PairedBlocks blocks={message.blocks} />
          </div>
        </div>
      );
    }

    if (message.text) {
      return (
        <div className="sub-agent-msg sub-agent-msg-assistant">
          <div className="sub-agent-msg-text">{message.text}</div>
        </div>
      );
    }
  }

  return null;
};

/** Pairs tool_use with tool_result and renders via ToolCallBlock */
const PairedBlocks: React.FC<{ blocks: RenderableBlock[] }> = ({ blocks }) => {
  const paired = useMemo(() => {
    const result: React.ReactNode[] = [];
    const skipped = new Set<number>();

    for (let i = 0; i < blocks.length; i++) {
      if (skipped.has(i)) continue;
      const content = blocks[i]!.block;
      const isStreaming = blocks[i]!.isStreaming;

      if (content.type === 'tool_use') {
        let toolResult: (ContentBlock & { type: 'tool_result' }) | undefined;
        for (let j = i + 1; j < blocks.length; j++) {
          if (skipped.has(j)) continue;
          const other = blocks[j]!.block;
          if (other.type === 'tool_result' && other.tool_use_id === content.id) {
            toolResult = other;
            skipped.add(j);
            break;
          }
        }
        result.push(
          <div key={`tool-${content.id}`} className="sub-agent-tool-wrapper">
            <ToolCallBlock
              block={content}
              isStreaming={isStreaming}
              result={toolResult}
            />
          </div>
        );
      } else if (content.type === 'tool_result') {
        result.push(
          <div key={`result-${i}`} className="sub-agent-tool-wrapper">
            <ToolCallBlock
              block={{ type: 'tool_use' as const, id: content.tool_use_id, name: 'result', input: {} }}
              isStreaming={false}
              result={content}
            />
          </div>
        );
      } else if (content.type === 'text') {
        result.push(
          <div key={`text-${i}`} className="sub-agent-block-text">{content.text}</div>
        );
      } else if (content.type === 'thinking') {
        result.push(
          <details key={`think-${i}`} className="sub-agent-thinking-details">
            <summary className="sub-agent-thinking-summary">Thinking</summary>
            <div className="sub-agent-thinking-content">{content.thinking}</div>
          </details>
        );
      } else if (content.type === 'redacted_thinking') {
        result.push(
          <div key={`redact-${i}`} className="sub-agent-block-text" style={{ opacity: 0.6, fontStyle: 'italic' }}>
            [Redacted thinking block]
          </div>
        );
      }
    }
    return result;
  }, [blocks]);

  return <>{paired}</>;
};

export default SubAgentBlock;
