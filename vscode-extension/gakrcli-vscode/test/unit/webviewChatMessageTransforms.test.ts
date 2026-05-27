import { describe, expect, it } from 'vitest';
import type { ChatMessage } from '../../webview/src/types/chat';
import type { ContentBlock } from '../../webview/src/types/messages';
import {
  attachToolResults,
  blocksSoftSignature,
  extractToolResultBlocks,
  extractUserVisibleText,
  formatFilesPersistedMessage,
  mergeExistingToolResults,
  normalizeRenderableBlocks,
  stripInternalTextWrappers,
} from '../../webview/src/utils/chatMessageTransforms';

describe('webview chat message transforms', () => {
  it('hides protocol-only user messages instead of rendering tool interaction placeholders', () => {
    expect(extractUserVisibleText('No response requested.')).toBe('');
    expect(extractUserVisibleText('<local-command-stdout>Set model</local-command-stdout>')).toBe('');
    expect(stripInternalTextWrappers('  <local-command-stderr>warning</local-command-stderr>  ')).toBe('');
  });

  it('extracts tool results from user messages and attaches them after the matching tool use', () => {
    const messages: ChatMessage[] = [
      {
        id: 'assistant-1',
        role: 'assistant',
        isStreaming: false,
        timestamp: 1,
        parentToolUseId: null,
        blocks: [
          {
            index: 0,
            isStreaming: false,
            block: { type: 'text', text: 'I will search.' },
          },
          {
            index: 1,
            isStreaming: false,
            block: { type: 'tool_use', id: 'toolu_1', name: 'WebSearch', input: { query: 'news' } },
          },
        ],
      },
    ];

    const results = extractToolResultBlocks([
      { type: 'tool_result', tool_use_id: 'toolu_1', content: 'headline output' },
    ] as ContentBlock[]);
    const updated = attachToolResults(messages, results);

    expect(updated[0]?.blocks?.map((block) => block.block.type)).toEqual([
      'text',
      'tool_use',
      'tool_result',
    ]);
    expect(updated[0]?.blocks?.[2]?.block).toMatchObject({
      type: 'tool_result',
      tool_use_id: 'toolu_1',
      content: 'headline output',
    });
  });

  it('does not duplicate an already-attached tool result when history or final payloads replay it', () => {
    const existing = [
      { index: 0, isStreaming: false, block: { type: 'tool_use', id: 'toolu_1', name: 'Read', input: {} } },
      { index: 1, isStreaming: false, block: { type: 'tool_result', tool_use_id: 'toolu_1', content: 'file' } },
    ];
    const finalBlocks = [
      { index: 0, isStreaming: false, block: { type: 'tool_use', id: 'toolu_1', name: 'Read', input: {} } },
    ] as Array<{ block: ContentBlock; index: number; isStreaming: boolean }>;

    const merged = mergeExistingToolResults(finalBlocks, existing);

    expect(merged.filter((block) => block.block.type === 'tool_result')).toHaveLength(1);
    expect(merged.map((block) => block.index)).toEqual([0, 1]);
  });

  it('strips raw thinking tags from renderable text and soft signatures', () => {
    const blocks = normalizeRenderableBlocks([
      {
        index: 0,
        isStreaming: true,
        block: { type: 'text', text: '<think>private reasoning</think>Final answer' },
      },
    ]);

    expect(blocks[0]?.block).toEqual({ type: 'text', text: 'Final answer' });
    expect(blocksSoftSignature(blocks)).toBe('[{"type":"text","text":"Final answer"}]');
  });

  it('formats persisted memory files as a compact system message', () => {
    expect(formatFilesPersistedMessage({
      files: [
        { filename: 'memory.md' },
        { path: 'notes/project.md' },
        { file_id: 'fact-1' },
      ],
    })).toBe('Saved session memory: memory.md, notes/project.md, fact-1');
    expect(formatFilesPersistedMessage({ files: [] })).toBe('Saved session memory.');
  });
});
