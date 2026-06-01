import type { ToolResultBlock } from '../types/messages';

export function summarizeToolInput(input: Record<string, unknown>): string {
  const preferredKeys = [
    'command',
    'file_path',
    'path',
    'pattern',
    'query',
    'url',
    'old_string',
  ];

  for (const key of preferredKeys) {
    const value = input[key];
    if (typeof value === 'string' && value.trim()) {
      return truncateOneLine(value, 78);
    }
  }

  const firstEntry = Object.entries(input).find(([, value]) =>
    ['string', 'number', 'boolean'].includes(typeof value),
  );
  if (!firstEntry) {
    return '';
  }

  return truncateOneLine(String(firstEntry[1]), 78);
}

export function formatToolInput(input: Record<string, unknown>): string {
  if (typeof input.command === 'string' && input.command.trim()) {
    return `$ ${input.command}`;
  }

  try {
    return JSON.stringify(input, null, 2);
  } catch {
    return String(input);
  }
}

export function formatToolResultContent(content: ToolResultBlock['content']): string {
  if (typeof content === 'string') {
    return content;
  }
  try {
    return JSON.stringify(content, null, 2);
  } catch {
    return String(content);
  }
}

export function summarizeToolResult(result: ToolResultBlock | null): string {
  if (!result) {
    return '';
  }

  if (result.is_error) {
    return 'Error';
  }

  return truncateOneLine(formatToolResultContent(result.content), 96);
}

function truncateOneLine(value: string, maxLength: number): string {
  const oneLine = value.replace(/\s+/g, ' ').trim();
  if (oneLine.length <= maxLength) {
    return oneLine;
  }
  return `${oneLine.slice(0, maxLength - 3)}...`;
}
