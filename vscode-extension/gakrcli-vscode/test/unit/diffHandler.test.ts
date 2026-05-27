import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createCanUseToolHandler } from '../../src/diff/diffHandler';
import { SELF_HANDLED } from '../../src/process/controlRouter';
import type { DiffManager } from '../../src/diff/diffManager';
import type { NdjsonTransport } from '../../src/process/ndjsonTransport';
import type { ControlRequestPermission } from '../../src/types/messages';

function createMockDiffManager() {
  return {
    isFileEditToolRequest: vi.fn(),
    showDiff: vi.fn().mockResolvedValue(undefined),
  } as unknown as DiffManager;
}

function createMockTransport() {
  return {
    write: vi.fn(),
  } as unknown as NdjsonTransport;
}

function createMockOutputChannel() {
  return {
    appendLine: vi.fn(),
  } as unknown as import('vscode').OutputChannel;
}

describe('createCanUseToolHandler', () => {
  let diffManager: ReturnType<typeof createMockDiffManager>;
  let transport: ReturnType<typeof createMockTransport>;
  let outputChannel: ReturnType<typeof createMockOutputChannel>;
  let handler: ReturnType<typeof createCanUseToolHandler>;

  beforeEach(() => {
    diffManager = createMockDiffManager();
    transport = createMockTransport();
    outputChannel = createMockOutputChannel();
    handler = createCanUseToolHandler(
      diffManager as unknown as DiffManager,
      () => transport as unknown as NdjsonTransport,
      outputChannel as unknown as import('vscode').OutputChannel,
    );
  });

  it('should delegate file edit tools to DiffManager and return SELF_HANDLED', async () => {
    (diffManager.isFileEditToolRequest as ReturnType<typeof vi.fn>).mockReturnValue(true);

    const request: ControlRequestPermission = {
      subtype: 'can_use_tool',
      tool_name: 'FileEditTool',
      input: { file_path: '/test.ts', old_string: 'a', new_string: 'b' },
      tool_use_id: 'tu-1',
    };

    const result = await handler(request, new AbortController().signal, 'req-1');

    expect(result).toBe(SELF_HANDLED);
    expect(diffManager.showDiff).toHaveBeenCalledWith('req-1', request, transport);
  });

  it('should auto-allow non-file-edit tools', async () => {
    (diffManager.isFileEditToolRequest as ReturnType<typeof vi.fn>).mockReturnValue(false);

    const request: ControlRequestPermission = {
      subtype: 'can_use_tool',
      tool_name: 'BashTool',
      input: { command: 'ls' },
      tool_use_id: 'tu-2',
    };

    const result = await handler(request, new AbortController().signal, 'req-2');

    expect(result).toEqual({
      behavior: 'allow',
      updatedInput: { command: 'ls' },
      toolUseID: 'tu-2',
    });
    expect(diffManager.showDiff).not.toHaveBeenCalled();
  });

  it('should throw when no transport is available', async () => {
    const noTransportHandler = createCanUseToolHandler(
      diffManager as unknown as DiffManager,
      () => undefined,
      outputChannel as unknown as import('vscode').OutputChannel,
    );

    const request: ControlRequestPermission = {
      subtype: 'can_use_tool',
      tool_name: 'FileEditTool',
      input: {},
      tool_use_id: 'tu-3',
    };

    await expect(
      noTransportHandler(request, new AbortController().signal, 'req-3'),
    ).rejects.toThrow('No transport available');
  });
});
