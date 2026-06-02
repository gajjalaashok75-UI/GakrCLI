import { describe, expect, test } from 'bun:test';

import type { RenderableBlock } from '../types/chat';
import { getPairedToolResult, isPairedToolResult } from './toolBlockPairs.ts';
import {
  formatToolInput,
  summarizeToolInput,
  summarizeToolResult,
} from './toolDisplay.ts';

function renderable(block: Record<string, unknown>, index = 0): RenderableBlock {
  return {
    index,
    block: block as unknown as RenderableBlock['block'],
    isStreaming: false,
  };
}

describe('tool block pairing', () => {
  test('pairs a tool call with its matching result', () => {
    const blocks = [
      renderable({ type: 'tool_use', id: 'tool-1', name: 'Bash', input: { command: 'npm test' } }, 0),
      renderable({ type: 'tool_result', tool_use_id: 'tool-1', content: 'ok' }, 1),
    ];

    expect(getPairedToolResult(blocks, 0)?.content).toBe('ok');
    expect(isPairedToolResult(blocks, 1)).toBe(true);
  });

  test('does not cross another tool call when pairing results', () => {
    const blocks = [
      renderable({ type: 'tool_use', id: 'tool-1', name: 'Bash', input: {} }, 0),
      renderable({ type: 'tool_use', id: 'tool-2', name: 'Read', input: {} }, 1),
      renderable({ type: 'tool_result', tool_use_id: 'tool-1', content: 'late' }, 2),
    ];

    expect(getPairedToolResult(blocks, 0)).toBeNull();
    expect(isPairedToolResult(blocks, 2)).toBe(false);
  });
});

describe('tool display formatting', () => {
  test('summarizes command-like input and formats shell commands', () => {
    const input = { command: 'npm.cmd run build' };

    expect(summarizeToolInput(input)).toBe('npm.cmd run build');
    expect(formatToolInput(input)).toBe('$ npm.cmd run build');
  });

  test('summarizes result state without expanding full output', () => {
    expect(summarizeToolResult({ type: 'tool_result', tool_use_id: 'tool-1', content: 'created file' })).toBe('created file');
    expect(summarizeToolResult({ type: 'tool_result', tool_use_id: 'tool-1', content: 'bad', is_error: true })).toBe('Error');
  });
});
