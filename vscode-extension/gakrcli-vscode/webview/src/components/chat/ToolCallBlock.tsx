import { useState } from 'react';
import type { ToolUseBlock, ServerToolUseBlock, ToolResultBlock } from '../../types/messages';
import {
  formatToolInput,
  formatToolResultContent,
  summarizeToolInput,
  summarizeToolResult,
} from '../../utils/toolDisplay';

interface ToolCallBlockProps {
  /** The tool_use or server_tool_use content block */
  block: ToolUseBlock | ServerToolUseBlock;
  /** Whether the tool is still being invoked */
  isStreaming: boolean;
  /** Matching result block, when available */
  result?: ToolResultBlock | null;
}

export function ToolCallBlock({ block, isStreaming, result = null }: ToolCallBlockProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const toolName = block.name;
  const input = block.input;
  const hasInput = Object.keys(input).length > 0;
  const inputSummary = summarizeToolInput(input);
  const resultSummary = summarizeToolResult(result);
  const hasResult = Boolean(result);
  const isError = Boolean(result?.is_error);
  const resultContent = result ? formatToolResultContent(result.content) : '';

  return (
    <div className={`tool-call-card my-0 overflow-hidden ${isError ? 'tool-result-error' : ''}`}>
      {/* Collapsible header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="tool-call-header flex items-center gap-1.5 w-full px-2.5 py-1 text-left text-sm transition-colors"
        aria-expanded={isExpanded}
      >
        {/* Chevron */}
        <svg
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          className={`transition-transform ${isExpanded ? 'rotate-90' : ''}`}
        >
          <polyline points="9 18 15 12 9 6" />
        </svg>

        {/* Tool icon */}
        <ToolIcon />

        {/* Tool name */}
        <span className="font-mono text-xs font-medium">{toolName}</span>

        {inputSummary && (
          <span className="tool-call-preview min-w-0 truncate text-xs opacity-45">
            {inputSummary}
          </span>
        )}

        {/* Status indicator */}
        {isStreaming && (
          <span className="ml-auto flex items-center gap-1 text-xs opacity-50">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-yellow-400 animate-pulse" />
            Running
          </span>
        )}
        {!isStreaming && isError && (
          <span className="ml-auto text-xs text-red-400">
            Error
          </span>
        )}
        {!isStreaming && !isError && (
          <span className="ml-auto text-xs opacity-40">
            {hasResult ? 'Done' : 'Queued'}
          </span>
        )}
      </button>

      {/* Expandable content */}
      {isExpanded && (
        <div className="tool-call-body px-2.5 py-1.5">
          {hasInput ? (
            <div className="tool-detail-section">
              <div className="text-xs opacity-50 mb-1 font-semibold">Input</div>
              <pre className="tool-input-pre tool-detail-pre text-xs font-mono overflow-auto p-1.5 rounded whitespace-pre-wrap break-all">
                {formatToolInput(input)}
              </pre>
            </div>
          ) : (
            <div className="text-xs opacity-40 italic">No input</div>
          )}
          {result && (
            <div className="tool-detail-section">
              <div className="tool-detail-heading">
                <span className="text-xs opacity-50 font-semibold">Result</span>
                {resultSummary && !isError && <span className="tool-result-inline-preview">{resultSummary}</span>}
              </div>
              <pre className="tool-result-pre tool-detail-pre m-0 px-2 py-1.5 text-xs font-mono whitespace-pre-wrap break-words overflow-auto">
                {resultContent || 'No output'}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ToolIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="opacity-60"
    >
      <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
    </svg>
  );
}
