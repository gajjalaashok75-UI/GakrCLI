import type { ChatMessage, RenderableBlock } from '../../types/chat';
import type { TextBlock, ToolUseBlock, ServerToolUseBlock, ToolResultBlock as ToolResultContentBlock } from '../../types/messages';
import { MarkdownRenderer } from '../shared/MarkdownRenderer';
import { ToolCallBlock } from './ToolCallBlock';
import { ContentBlockRouter } from '../blocks/ContentBlockRouter';
import type { ContentBlock } from '../../types/blocks';
import { MessageActions } from './MessageActions';
import { formatTurnCompletion } from '../../utils/turnCompletion';
import { isThinkingBlock } from '../../utils/messageVisibility';
import { getPairedToolResult, isPairedToolResult } from '../../utils/toolBlockPairs';
import { formatToolResultContent } from '../../utils/toolDisplay';

interface AssistantMessageProps {
  message: ChatMessage;
  isLatest?: boolean;
  isStreaming?: boolean;
  showActions?: boolean;
  actionContent?: string;
  onRetry?: (uuid: string) => void;
  onStop?: () => void;
}

export function AssistantMessage({
  message,
  isLatest = false,
  isStreaming = false,
  showActions = false,
  actionContent = '',
  onRetry,
  onStop,
}: AssistantMessageProps) {
  const blocks = message.blocks || [];
  const turnCompletionText =
    message.cost && !isStreaming && !message.isStreaming
      ? formatTurnCompletion(message.cost.durationMs, message.id)
      : null;

  return (
    <div className="group relative" style={{ width: '100%' }}>
      {/* Message actions (hover) */}
      {/* Content blocks — no header/label, just content */}
      <div>
        {blocks.map((renderableBlock, blockIndex) => (
          <BlockRenderer
            key={renderableBlock.index}
            blocks={blocks}
            blockIndex={blockIndex}
            renderableBlock={renderableBlock}
            isMessageStreaming={message.isStreaming}
          />
        ))}
      </div>

      {message.interrupted && !message.isStreaming && (
        <div className="assistant-interrupt-row">
          Interrupted · What should Gakr do instead?
        </div>
      )}

      {turnCompletionText && (
        <div className="assistant-turn-footer" aria-label={turnCompletionText}>
          <span className="turn-completion-mark">*</span>
          <span className="turn-completion-summary">{turnCompletionText}</span>
        </div>
      )}

      {showActions && actionContent && (
        <div className="message-actions-row">
          <MessageActions
            messageRole="assistant"
            content={actionContent}
            uuid={message.id}
            isFailed={false}
            isStreaming={isStreaming}
            isLatest={isLatest}
            copyLabel="Copy conversation"
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
  blocks: RenderableBlock[];
  blockIndex: number;
  renderableBlock: RenderableBlock;
  isMessageStreaming: boolean;
}

function BlockRenderer({ blocks, blockIndex, renderableBlock, isMessageStreaming: _isMessageStreaming }: BlockRendererProps) {
  const { block, isStreaming } = renderableBlock;
  const blockType = (block as { type: string }).type;

  if (isThinkingBlock(block)) {
    return null;
  }

  if (blockType === 'tool_result' && isPairedToolResult(blocks, blockIndex)) {
    return null;
  }

  switch (blockType) {
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
          result={getPairedToolResult(blocks, blockIndex)}
        />
      );

    case 'tool_result':
      return (
        <ToolResultBlock
          block={block as ToolResultContentBlock}
        />
      );

    case 'image':
    case 'document':
    case 'search_result':
    case 'web_search_tool_result':
      return (
        <ContentBlockRouter
          block={block as ContentBlock}
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
    <details className={`tool-result-card my-0 overflow-hidden ${block.is_error ? 'tool-result-error' : ''}`}>
      <summary className="tool-result-summary flex items-center gap-1.5 px-2.5 py-1 text-xs cursor-pointer">
        <span className="opacity-60">Result</span>
        {block.is_error && <span className="text-red-400">Error</span>}
        {!block.is_error && <span className="ml-auto opacity-40">{preview || 'No output'}</span>}
      </summary>
      <pre className="tool-result-pre m-0 px-2 py-1.5 text-xs font-mono whitespace-pre-wrap break-words max-h-40 overflow-auto">
        {content || 'No output'}
      </pre>
    </details>
  );
}

// ============================================================================
// Icons
// ============================================================================
