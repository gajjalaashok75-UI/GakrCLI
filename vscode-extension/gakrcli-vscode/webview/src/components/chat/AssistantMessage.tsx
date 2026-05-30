import type { ChatMessage, RenderableBlock } from '../../types/chat';
import type { TextBlock, ToolUseBlock, ServerToolUseBlock, ToolResultBlock as ToolResultContentBlock } from '../../types/messages';
import { MarkdownRenderer } from '../shared/MarkdownRenderer';
import { ToolCallBlock } from './ToolCallBlock';
import { ContentBlockRouter } from '../blocks/ContentBlockRouter';
import type { ContentBlock } from '../../types/blocks';
import { MessageActions } from './MessageActions';
import { formatTurnCompletion } from '../../utils/turnCompletion';

interface AssistantMessageProps {
  message: ChatMessage;
  isLatest?: boolean;
  isStreaming?: boolean;
  onRetry?: (uuid: string) => void;
  onStop?: () => void;
}

export function AssistantMessage({ message, isLatest = false, isStreaming = false, onRetry, onStop }: AssistantMessageProps) {
  const blocks = message.blocks || [];
  const turnCompletionText =
    message.cost && !isStreaming && !message.isStreaming
      ? formatTurnCompletion(message.cost.durationMs, message.id)
      : null;

  // Extract plain text content for copy
  const plainTextContent = blocks
    .filter((b) => b.block.type === 'text')
    .map((b) => (b.block as TextBlock).text)
    .join('\n');

  return (
    <div className="group relative" style={{ width: '100%' }}>
      {/* Message actions (hover) */}
      {/* Content blocks — no header/label, just content */}
      <div>
        {blocks.map((renderableBlock) => (
          <BlockRenderer
            key={renderableBlock.index}
            renderableBlock={renderableBlock}
            isMessageStreaming={message.isStreaming}
          />
        ))}
      </div>

      {turnCompletionText && (
        <div className="assistant-turn-footer" aria-label={turnCompletionText}>
          <span className="turn-completion-mark">*</span>
          <span className="turn-completion-summary">{turnCompletionText}</span>
        </div>
      )}

      {plainTextContent && (
        <div className="message-actions-row">
          <MessageActions
            messageRole="assistant"
            content={plainTextContent}
            uuid={message.id}
            isFailed={false}
            isStreaming={isStreaming || message.isStreaming}
            isLatest={isLatest}
            onRetry={onRetry}
            onStop={onStop}
          />
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Block Renderer — dispatches to the right renderer per block type
// ============================================================================

interface BlockRendererProps {
  renderableBlock: RenderableBlock;
  isMessageStreaming: boolean;
}

function BlockRenderer({ renderableBlock, isMessageStreaming: _isMessageStreaming }: BlockRendererProps) {
  const { block, isStreaming } = renderableBlock;

  switch (block.type) {
    case 'text':
      return (
        <MarkdownRenderer
          content={(block as TextBlock).text}
          isStreaming={isStreaming}
        />
      );

    case 'tool_use':
    case 'server_tool_use':
      return (
        <ToolCallBlock
          block={block as ToolUseBlock | ServerToolUseBlock}
          isStreaming={isStreaming}
        />
      );

    case 'tool_result':
      return (
        <ToolResultBlock
          block={block as ToolResultContentBlock}
        />
      );

    case 'thinking':
    case 'redacted_thinking':
    case 'image':
    case 'document':
    case 'search_result':
    case 'web_search_tool_result':
      return (
        <ContentBlockRouter
          block={block as ContentBlock}
          showThinkingSummaries={false}
        />
      );

    default:
      // Unknown block type — show raw JSON as fallback
      return (
        <div className="tool-call-card my-2 text-xs font-mono opacity-80 px-3 py-1.5 rounded overflow-x-auto">
          <pre>{JSON.stringify(block, null, 2)}</pre>
        </div>
      );
  }
}

function ToolResultBlock({ block }: { block: ToolResultContentBlock }) {
  const content = formatToolResultContent(block.content);
  const preview = content.length > 160 ? `${content.slice(0, 157)}...` : content;

  return (
    <details className={`tool-result-card my-1 rounded overflow-hidden ${block.is_error ? 'tool-result-error' : ''}`}>
      <summary className="tool-result-summary flex items-center gap-2 px-3 py-1.5 text-xs cursor-pointer">
        <span className="opacity-60">Result</span>
        {block.is_error && <span className="text-red-400">Error</span>}
        {!block.is_error && <span className="ml-auto opacity-40">{preview || 'No output'}</span>}
      </summary>
      <pre className="tool-result-pre m-0 px-3 py-2 text-xs font-mono whitespace-pre-wrap break-words max-h-56 overflow-auto">
        {content || 'No output'}
      </pre>
    </details>
  );
}

function formatToolResultContent(content: ToolResultContentBlock['content']): string {
  if (typeof content === 'string') {
    return content;
  }
  try {
    return JSON.stringify(content, null, 2);
  } catch {
    return String(content);
  }
}

// ============================================================================
// Icons
// ============================================================================
