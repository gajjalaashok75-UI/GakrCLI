import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DiffManager } from '../../src/diff/diffManager';
import { DiffContentProvider } from '../../src/diff/diffContentProvider';

// Create minimal mocks for DiffManager dependencies
function createMockOutputChannel() {
  return {
    appendLine: vi.fn(),
    append: vi.fn(),
    clear: vi.fn(),
    show: vi.fn(),
    hide: vi.fn(),
    dispose: vi.fn(),
    name: 'test',
    replace: vi.fn(),
  } as unknown as import('vscode').OutputChannel;
}

describe('DiffManager.computeProposedContent', () => {
  let diffManager: DiffManager;

  beforeEach(() => {
    const original = new DiffContentProvider();
    original.scheme = 'gakrcli-diff-original';
    const proposed = new DiffContentProvider();
    proposed.scheme = 'gakrcli-diff-proposed';
    const outputChannel = createMockOutputChannel();
    diffManager = new DiffManager(original, proposed, outputChannel);
  });

  describe('FileWriteTool', () => {
    it('should return content field as the full proposed content', () => {
      const result = diffManager.computeProposedContent(
        'FileWriteTool',
        { content: 'new file content', file_path: '/test.ts' },
        'old content',
      );
      expect(result).toBe('new file content');
    });

    it('should handle empty content (truncate file)', () => {
      const result = diffManager.computeProposedContent(
        'FileWriteTool',
        { content: '', file_path: '/test.ts' },
        'old content',
      );
      expect(result).toBe('');
    });

    it('should handle missing content field', () => {
      const result = diffManager.computeProposedContent(
        'FileWriteTool',
        { file_path: '/test.ts' },
        'old content',
      );
      expect(result).toBe('');
    });

    it('should handle new file creation (empty original)', () => {
      const result = diffManager.computeProposedContent(
        'FileWriteTool',
        { content: 'brand new file', file_path: '/new.ts' },
        '',
      );
      expect(result).toBe('brand new file');
    });
  });

  describe('FileEditTool', () => {
    it('should apply old_string -> new_string replacement', () => {
      const original = 'function hello() {\n  return "hello";\n}';
      const result = diffManager.computeProposedContent(
        'FileEditTool',
        {
          file_path: '/test.ts',
          old_string: 'return "hello"',
          new_string: 'return "world"',
        },
        original,
      );
      expect(result).toBe('function hello() {\n  return "world";\n}');
    });

    it('should handle new file creation (empty old_string, empty original)', () => {
      const result = diffManager.computeProposedContent(
        'FileEditTool',
        {
          file_path: '/new.ts',
          old_string: '',
          new_string: 'export const x = 1;',
        },
        '',
      );
      expect(result).toBe('export const x = 1;');
    });

    it('should prepend when old_string is empty but file exists', () => {
      const result = diffManager.computeProposedContent(
        'FileEditTool',
        {
          file_path: '/test.ts',
          old_string: '',
          new_string: '// header\n',
        },
        'const x = 1;',
      );
      expect(result).toBe('// header\nconst x = 1;');
    });

    it('should return original when old_string is not found', () => {
      const original = 'const x = 1;';
      const result = diffManager.computeProposedContent(
        'FileEditTool',
        {
          file_path: '/test.ts',
          old_string: 'const y = 2',
          new_string: 'const y = 3',
        },
        original,
      );
      expect(result).toBe(original);
    });

    it('should replace only the first occurrence', () => {
      const original = 'aaa bbb aaa';
      const result = diffManager.computeProposedContent(
        'FileEditTool',
        {
          file_path: '/test.ts',
          old_string: 'aaa',
          new_string: 'ccc',
        },
        original,
      );
      expect(result).toBe('ccc bbb aaa');
    });

    it('should handle deletion (new_string is empty)', () => {
      const original = 'line1\nline2\nline3';
      const result = diffManager.computeProposedContent(
        'FileEditTool',
        {
          file_path: '/test.ts',
          old_string: 'line2\n',
          new_string: '',
        },
        original,
      );
      expect(result).toBe('line1\nline3');
    });

    it('should handle multi-line replacements', () => {
      const original = 'function foo() {\n  // old\n  return 1;\n}';
      const result = diffManager.computeProposedContent(
        'FileEditTool',
        {
          file_path: '/test.ts',
          old_string: '  // old\n  return 1;',
          new_string: '  // new\n  return 42;',
        },
        original,
      );
      expect(result).toBe('function foo() {\n  // new\n  return 42;\n}');
    });

    it('should handle replacement at the start of the file', () => {
      const original = 'const x = 1;\nconst y = 2;';
      const result = diffManager.computeProposedContent(
        'FileEditTool',
        {
          file_path: '/test.ts',
          old_string: 'const x = 1;',
          new_string: 'const x = 99;',
        },
        original,
      );
      expect(result).toBe('const x = 99;\nconst y = 2;');
    });

    it('should handle replacement at the end of the file', () => {
      const original = 'const x = 1;\nconst y = 2;';
      const result = diffManager.computeProposedContent(
        'FileEditTool',
        {
          file_path: '/test.ts',
          old_string: 'const y = 2;',
          new_string: 'const y = 99;',
        },
        original,
      );
      expect(result).toBe('const x = 1;\nconst y = 99;');
    });
  });

  describe('Unknown tool', () => {
    it('should return original content unchanged', () => {
      const original = 'some content';
      const result = diffManager.computeProposedContent(
        'SomeOtherTool',
        { file_path: '/test.ts' },
        original,
      );
      expect(result).toBe(original);
    });
  });
});

describe('DiffManager.isFileEditToolRequest', () => {
  let diffManager: DiffManager;

  beforeEach(() => {
    const original = new DiffContentProvider();
    original.scheme = 'gakrcli-diff-original';
    const proposed = new DiffContentProvider();
    proposed.scheme = 'gakrcli-diff-proposed';
    const outputChannel = createMockOutputChannel();
    diffManager = new DiffManager(original, proposed, outputChannel);
  });

  it('should return true for FileEditTool', () => {
    expect(
      diffManager.isFileEditToolRequest({
        subtype: 'can_use_tool',
        tool_name: 'FileEditTool',
        input: {},
        tool_use_id: 'test',
      }),
    ).toBe(true);
  });

  it('should return true for FileWriteTool', () => {
    expect(
      diffManager.isFileEditToolRequest({
        subtype: 'can_use_tool',
        tool_name: 'FileWriteTool',
        input: {},
        tool_use_id: 'test',
      }),
    ).toBe(true);
  });

  it('should return false for other tools', () => {
    expect(
      diffManager.isFileEditToolRequest({
        subtype: 'can_use_tool',
        tool_name: 'BashTool',
        input: {},
        tool_use_id: 'test',
      }),
    ).toBe(false);
  });
});
