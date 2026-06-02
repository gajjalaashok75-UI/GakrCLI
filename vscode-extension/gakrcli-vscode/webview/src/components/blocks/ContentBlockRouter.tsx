// webview/src/components/blocks/ContentBlockRouter.tsx
import React from 'react';
import type { ContentBlock } from '../../types/blocks';
import { ImageBlockRenderer } from './ImageBlockRenderer';
import { DocumentBlockRenderer } from './DocumentBlockRenderer';
import { SearchResultBlock } from './SearchResultBlock';
import { WebSearchResultBlock } from './WebSearchResultBlock';
import { ServerToolUseBlock } from './ServerToolUseBlock';
import { isThinkingBlock } from '../../utils/messageVisibility';

interface ContentBlockRouterProps {
  block: ContentBlock;
}

/**
 * Routes a ContentBlock to the appropriate renderer component.
 * Text and tool_use blocks are handled by the existing AssistantMessage
 * rendering pipeline (MarkdownRenderer and ToolCallBlock respectively).
 * This router handles all OTHER block types.
 */
export const ContentBlockRouter: React.FC<ContentBlockRouterProps> = ({
  block,
}) => {
  if (isThinkingBlock(block)) {
    return null;
  }

  switch (block.type) {
    case 'image':
      return <ImageBlockRenderer block={block} />;

    case 'document':
      return <DocumentBlockRenderer block={block} />;

    case 'search_result':
      return <SearchResultBlock block={block} />;

    case 'web_search_tool_result':
      return <WebSearchResultBlock block={block} />;

    case 'server_tool_use':
      return <ServerToolUseBlock block={block} />;

    // text, tool_use, tool_result handled by parent
    default:
      return null;
  }
};
