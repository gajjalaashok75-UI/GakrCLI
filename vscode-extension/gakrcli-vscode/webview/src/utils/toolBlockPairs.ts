import type { RenderableBlock } from '../types/chat';
import type { ToolResultBlock } from '../types/messages';

type BlockRecord = Record<string, unknown>;

export function getPairedToolResult(
  blocks: RenderableBlock[],
  toolIndex: number,
): ToolResultBlock | null {
  const toolId = getToolUseId(blocks[toolIndex]?.block);
  if (!toolId) {
    return null;
  }

  for (let index = toolIndex + 1; index < blocks.length; index++) {
    const block = blocks[index]?.block;
    if (isToolUseBlock(block)) {
      return null;
    }
    if (isMatchingToolResult(block, toolId)) {
      return block as ToolResultBlock;
    }
  }

  return null;
}

export function isPairedToolResult(
  blocks: RenderableBlock[],
  resultIndex: number,
): boolean {
  const result = blocks[resultIndex]?.block;
  if (!isToolResultBlock(result)) {
    return false;
  }

  const toolUseId = (result as ToolResultBlock).tool_use_id;
  for (let index = resultIndex - 1; index >= 0; index--) {
    const block = blocks[index]?.block;
    if (isMatchingToolUse(block, toolUseId)) {
      return true;
    }
    if (isToolUseBlock(block)) {
      return false;
    }
    if (isToolResultBlock(block)) {
      return false;
    }
  }

  return false;
}

function getToolUseId(block: unknown): string | null {
  if (!isToolUseBlock(block)) {
    return null;
  }
  const id = (block as BlockRecord).id;
  return typeof id === 'string' ? id : null;
}

function isMatchingToolUse(block: unknown, toolUseId: string): boolean {
  return getToolUseId(block) === toolUseId;
}

function isMatchingToolResult(block: unknown, toolUseId: string): boolean {
  return (
    isToolResultBlock(block) &&
    (block as ToolResultBlock).tool_use_id === toolUseId
  );
}

function isToolUseBlock(block: unknown): boolean {
  return Boolean(
    block &&
      typeof block === 'object' &&
      (((block as BlockRecord).type === 'tool_use') ||
        ((block as BlockRecord).type === 'server_tool_use')),
  );
}

function isToolResultBlock(block: unknown): block is ToolResultBlock {
  return Boolean(
    block &&
      typeof block === 'object' &&
      (block as BlockRecord).type === 'tool_result' &&
      typeof (block as BlockRecord).tool_use_id === 'string',
  );
}
