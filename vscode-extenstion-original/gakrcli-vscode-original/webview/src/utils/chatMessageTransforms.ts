import type { ChatMessage } from '../types/chat';
import type { ContentBlock, ToolResultBlock, UserMessage } from '../types/messages';

export function extractUserVisibleText(content: UserMessage['message']['content']): string {
  if (typeof content === 'string') {
    return stripInternalTextWrappers(content);
  }
  if (!Array.isArray(content)) {
    return '';
  }

  const text = content
    .filter((block): block is { type: 'text'; text: string } =>
      typeof block === 'object' &&
      block !== null &&
      (block as Record<string, unknown>).type === 'text' &&
      typeof (block as Record<string, unknown>).text === 'string',
    )
    .map((block) => block.text)
    .join('\n')
    .trim();

  return stripInternalTextWrappers(text);
}

export function extractToolResultBlocks(content: UserMessage['message']['content']): ToolResultBlock[] {
  if (!Array.isArray(content)) {
    return [];
  }

  return content
    .filter((block): block is Record<string, unknown> =>
      typeof block === 'object' &&
      block !== null &&
      (block as Record<string, unknown>).type === 'tool_result' &&
      typeof (block as Record<string, unknown>).tool_use_id === 'string',
    )
    .map((block) => ({
      type: 'tool_result' as const,
      tool_use_id: block.tool_use_id as string,
      content: normalizeToolResultContent(block.content),
      is_error: Boolean(block.is_error),
    }));
}

export function attachToolResults(messages: ChatMessage[], results: ToolResultBlock[]): ChatMessage[] {
  return results.reduce((currentMessages, result) => attachToolResult(currentMessages, result), messages);
}

export function mergeExistingToolResults(
  finalBlocks: Array<{ block: ContentBlock; index: number; isStreaming: boolean }>,
  existingBlocks: Array<{ block: unknown; index: number; isStreaming: boolean }>,
): Array<{ block: ContentBlock; index: number; isStreaming: boolean }> {
  return existingBlocks.reduce((blocks, existing) => {
    if (isToolResultBlock(existing.block)) {
      return attachToolResultToBlocks(blocks, existing.block as ToolResultBlock);
    }
    return blocks;
  }, finalBlocks);
}

export function isToolUseBlock(block: unknown): boolean {
  return Boolean(
    block &&
    typeof block === 'object' &&
    ((block as Record<string, unknown>).type === 'tool_use' ||
      (block as Record<string, unknown>).type === 'server_tool_use'),
  );
}

export function normalizeTextContentBlock(block: ContentBlock): ContentBlock {
  if (block.type !== 'text') {
    return block;
  }
  return { ...block, text: stripThinkTagsFromText(block.text) };
}

export function normalizeRenderableBlocks(
  blocks: Array<{ block: unknown; index: number; isStreaming: boolean }>,
): Array<{ block: ContentBlock; index: number; isStreaming: boolean }> {
  return blocks.map((block) => ({
    ...block,
    block: normalizeTextContentBlock(block.block as ContentBlock),
  }));
}

export function stripInternalTextWrappers(text: string): string {
  const trimmed = text.trim();
  if (trimmed === 'No response requested.' || trimmed === 'No response requested') {
    return '';
  }
  if (/^<local-command-(stdout|stderr)>[\s\S]*<\/local-command-(stdout|stderr)>$/.test(trimmed)) {
    return '';
  }

  return trimmed
    .replace(/<local-command-stdout>([\s\S]*?)<\/local-command-stdout>/g, '$1')
    .replace(/<local-command-stderr>([\s\S]*?)<\/local-command-stderr>/g, '$1')
    .trim();
}

export function blocksSignature(blocks: Array<{ block: unknown }>): string {
  return JSON.stringify(
    blocks
      .map((block) => normalizeBlockForSignature(block.block))
      .filter((block) => block !== null),
  );
}

export function blocksSoftSignature(blocks: Array<{ block: unknown }>): string {
  return JSON.stringify(
    blocks
      .map((block) => normalizeBlockForSoftSignature(block.block))
      .filter((block) => block !== null),
  );
}

export function formatFilesPersistedMessage(message: Record<string, unknown>): string {
  const files = Array.isArray(message.files) ? message.files : [];
  const names = files
    .map((file) => {
      if (!file || typeof file !== 'object') {
        return '';
      }
      const record = file as Record<string, unknown>;
      return String(record.filename ?? record.path ?? record.file_id ?? '').trim();
    })
    .filter(Boolean);

  if (names.length === 0) {
    return 'Saved session memory.';
  }

  return `Saved session memory: ${names.join(', ')}`;
}

function normalizeToolResultContent(content: unknown): string | ContentBlock[] {
  if (typeof content === 'string') {
    return content;
  }
  if (Array.isArray(content)) {
    return content as ContentBlock[];
  }
  if (content === undefined || content === null) {
    return '';
  }
  try {
    return JSON.stringify(content, null, 2);
  } catch {
    return String(content);
  }
}

function attachToolResult(messages: ChatMessage[], result: ToolResultBlock): ChatMessage[] {
  let targetIndex = -1;

  for (let index = messages.length - 1; index >= 0; index--) {
    const message = messages[index];
    if (message?.role !== 'assistant') {
      continue;
    }
    if ((message.blocks ?? []).some((block) => isMatchingToolUse(block.block, result.tool_use_id))) {
      targetIndex = index;
      break;
    }
  }

  if (targetIndex < 0) {
    for (let index = messages.length - 1; index >= 0; index--) {
      if (messages[index]?.role === 'assistant') {
        targetIndex = index;
        break;
      }
    }
  }

  if (targetIndex < 0) {
    return messages;
  }

  return messages.map((message, index) => {
    if (index !== targetIndex) {
      return message;
    }
    return { ...message, blocks: attachToolResultToBlocks(message.blocks ?? [], result) };
  });
}

function attachToolResultToBlocks(
  blocks: Array<{ block: unknown; index: number; isStreaming: boolean }>,
  result: ToolResultBlock,
): Array<{ block: ContentBlock; index: number; isStreaming: boolean }> {
  if (blocks.some((block) =>
    isToolResultBlock(block.block) &&
    (block.block as ToolResultBlock).tool_use_id === result.tool_use_id
  )) {
    return reindexBlocks(blocks as Array<{ block: ContentBlock; index: number; isStreaming: boolean }>);
  }

  const resultBlock = { index: blocks.length, block: result as ContentBlock, isStreaming: false };
  const toolIndex = blocks.findIndex((block) => isMatchingToolUse(block.block, result.tool_use_id));
  const nextBlocks = toolIndex >= 0
    ? [...blocks.slice(0, toolIndex + 1), resultBlock, ...blocks.slice(toolIndex + 1)]
    : [...blocks, resultBlock];

  return reindexBlocks(nextBlocks as Array<{ block: ContentBlock; index: number; isStreaming: boolean }>);
}

function reindexBlocks(
  blocks: Array<{ block: ContentBlock; index: number; isStreaming: boolean }>,
): Array<{ block: ContentBlock; index: number; isStreaming: boolean }> {
  return blocks.map((block, index) => ({ ...block, index }));
}

function isMatchingToolUse(block: unknown, toolUseId: string): boolean {
  if (!isToolUseBlock(block)) {
    return false;
  }
  return (block as Record<string, unknown>).id === toolUseId;
}

function isToolResultBlock(block: unknown): block is ToolResultBlock {
  return Boolean(
    block &&
    typeof block === 'object' &&
    (block as Record<string, unknown>).type === 'tool_result' &&
    typeof (block as Record<string, unknown>).tool_use_id === 'string',
  );
}

function normalizeBlockForSignature(block: unknown): unknown {
  if (!block || typeof block !== 'object') {
    return block;
  }

  const record = block as Record<string, unknown>;
  if (record.type === 'thinking' || record.type === 'redacted_thinking') {
    return null;
  }

  if (record.type === 'text' && typeof record.text === 'string') {
    return {
      type: 'text',
      text: stripThinkTagsFromText(record.text),
    };
  }

  if (record.type === 'tool_use' || record.type === 'server_tool_use') {
    return {
      type: record.type,
      id: record.id,
      name: record.name,
    };
  }

  if (record.type === 'tool_result') {
    return {
      type: record.type,
      tool_use_id: record.tool_use_id,
      is_error: record.is_error,
    };
  }

  return record;
}

function normalizeBlockForSoftSignature(block: unknown): unknown {
  if (!block || typeof block !== 'object') {
    return block;
  }

  const record = block as Record<string, unknown>;
  if (
    record.type === 'thinking' ||
    record.type === 'redacted_thinking' ||
    record.type === 'tool_result'
  ) {
    return null;
  }

  if (record.type === 'text' && typeof record.text === 'string') {
    const text = stripThinkTagsFromText(record.text);
    return text ? { type: 'text', text } : null;
  }

  if (record.type === 'tool_use' || record.type === 'server_tool_use') {
    return {
      type: record.type,
      name: record.name,
      input: record.input,
    };
  }

  return record;
}

function stripThinkTagsFromText(text: string): string {
  return text
    .replace(/<(think|thinking|reasoning)(?:\s[^>]*)?>[\s\S]*?<\/\1>/gi, '')
    .replace(/<(think|thinking|reasoning)(?:\s[^>]*)?>[\s\S]*$/gi, '')
    .replace(/^[\s\S]*?<\/(think|thinking|reasoning)>\s*/i, '')
    .replace(/<\/(think|thinking|reasoning)>/gi, '')
    .trim();
}
