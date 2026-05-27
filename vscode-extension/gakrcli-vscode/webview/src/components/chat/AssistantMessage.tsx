import type { ChatMessage, RenderableBlock } from '../../types/chat';
import type { TextBlock, ToolUseBlock, ServerToolUseBlock, ToolResultBlock as ToolResultContentBlock } from '../../types/messages';
import { MarkdownRenderer } from '../shared/MarkdownRenderer';
import { ToolCallBlock } from './ToolCallBlock';
import { ContentBlockRouter } from '../blocks/ContentBlockRouter';
import type { ContentBlock } from '../../types/blocks';
import { MessageActions } from './MessageActions';

interface AssistantMessageProps {
  message: ChatMessage;
  isLatest?: boolean;
  isStreaming?: boolean;
  onRetry?: (uuid: string) => void;
  onStop?: () => void;
}

export function AssistantMessage({ message, isLatest = false, isStreaming = false, onRetry, onStop }: AssistantMessageProps) {
  const blocks = message.blocks || [];

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

      {plainTextContent && isLatest && (
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
        <div className="my-2 text-xs font-mono opacity-40 px-3 py-1.5 rounded border border-vscode-border overflow-x-auto">
          <pre>{JSON.stringify(block, null, 2)}</pre>
        </div>
      );
  }
}

function ToolResultBlock({ block }: { block: ToolResultContentBlock }) {
  const content = formatToolResultContent(block.content);
  const preview = content.length > 160 ? `${content.slice(0, 157)}...` : content;

  return (
    <details className={`my-1 rounded border border-vscode-border overflow-hidden ${block.is_error ? 'border-red-500/40' : ''}`}>
      <summary className="flex items-center gap-2 px-3 py-1.5 text-xs cursor-pointer bg-[var(--vscode-editorGroupHeader-tabsBackground)] hover:bg-[var(--vscode-list-hoverBackground)]">
        <span className="opacity-60">Result</span>
        {block.is_error && <span className="text-red-400">Error</span>}
        {!block.is_error && <span className="ml-auto opacity-40">{preview || 'No output'}</span>}
      </summary>
      <pre className="m-0 px-3 py-2 text-xs font-mono whitespace-pre-wrap break-words bg-[var(--vscode-editor-background)] max-h-56 overflow-auto">
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
