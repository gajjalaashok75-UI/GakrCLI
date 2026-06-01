// test/unit/processManager.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  __setSdkModuleForTests,
  ProcessManager,
  ProcessState,
} from '../../src/process/processManager';

interface FakeQuery {
  sessionId: string;
  setModel: ReturnType<typeof vi.fn>;
  setPermissionMode: ReturnType<typeof vi.fn>;
  setMaxThinkingTokens: ReturnType<typeof vi.fn>;
  interrupt: ReturnType<typeof vi.fn>;
  close: ReturnType<typeof vi.fn>;
  respondToPermission: ReturnType<typeof vi.fn>;
  rewindFiles: ReturnType<typeof vi.fn>;
  rewindFilesAsync: ReturnType<typeof vi.fn>;
  supportedCommands: ReturnType<typeof vi.fn>;
  supportedModels: ReturnType<typeof vi.fn>;
  supportedAgents: ReturnType<typeof vi.fn>;
  mcpServerStatus: ReturnType<typeof vi.fn>;
  accountInfo: ReturnType<typeof vi.fn>;
  [Symbol.asyncIterator]: () => AsyncIterator<unknown>;
}

function createFakeQuery() {
  const resolvers: Array<(value: IteratorResult<unknown>) => void> = [];
  let closed = false;

  const query: FakeQuery = {
    sessionId: 'sdk-session-1',
    setModel: vi.fn().mockResolvedValue(undefined),
    setPermissionMode: vi.fn().mockResolvedValue(undefined),
    setMaxThinkingTokens: vi.fn(),
    interrupt: vi.fn(),
    close: vi.fn(() => {
      closed = true;
      while (resolvers.length > 0) {
        resolvers.shift()?.({ value: undefined, done: true });
      }
    }),
    respondToPermission: vi.fn(),
    rewindFiles: vi.fn(() => ({ canRewind: true })),
    rewindFilesAsync: vi.fn().mockResolvedValue({ canRewind: true, filesChanged: ['a.ts'] }),
    supportedCommands: vi.fn(() => ['/help']),
    supportedModels: vi.fn(() => ['gpt-4o']),
    supportedAgents: vi.fn(() => ['reviewer']),
    mcpServerStatus: vi.fn(() => [{ name: 'ide', status: 'connected' }]),
    accountInfo: vi.fn().mockResolvedValue({ apiKeySource: 'user' }),
    [Symbol.asyncIterator]: () => ({
      next: () => {
        if (closed) {
          return Promise.resolve({ value: undefined, done: true });
        }
        return new Promise<IteratorResult<unknown>>((resolve) => {
          resolvers.push(resolve);
        });
      },
    }),
  };

  return {
    query,
    pushMessage(message: unknown) {
      resolvers.shift()?.({ value: message, done: false });
    },
  };
}

describe('ProcessManager SDK mode', () => {
  let manager: ProcessManager;
  let fake: ReturnType<typeof createFakeQuery>;
  let queryFactory: ReturnType<typeof vi.fn>;
  let capturedParams: { prompt: AsyncIterable<unknown>; options: Record<string, unknown> } | undefined;

  beforeEach(() => {
    fake = createFakeQuery();
    queryFactory = vi.fn((params) => {
      capturedParams = params;
      return fake.query;
    });
    __setSdkModuleForTests({
      query: queryFactory,
    } as never);

    manager = new ProcessManager({
      cwd: '/tmp/test-project',
      model: 'gpt-4o',
      permissionMode: 'plan',
      sessionId: 'resume-me',
      env: { OPENAI_API_KEY: 'sk-test' },
      ideMcpServer: { port: 49152, ideName: 'VS Code' },
    });
  });

  afterEach(() => {
    manager.dispose();
    __setSdkModuleForTests(undefined);
    vi.clearAllMocks();
  });

  it('creates a direct SDK query with extension options', async () => {
    const init = await manager.spawn();

    expect(manager.state).toBe(ProcessState.Ready);
    expect(manager.sessionId).toBe('sdk-session-1');
    expect(queryFactory).toHaveBeenCalledOnce();
    expect(capturedParams?.options).toMatchObject({
      cwd: '/tmp/test-project',
      model: 'gpt-4o',
      sessionId: 'resume-me',
      permissionMode: 'plan',
      includePartialMessages: true,
      env: {
        OPENAI_API_KEY: 'sk-test',
        GAKR_CODE_ENTRYPOINT: 'gakrcli-vscode',
        GAKR_CODE_ENVIRONMENT_KIND: 'vscode',
        NODE_OPTIONS: undefined,
      },
      mcpServers: {
        ide: {
          type: 'sse',
          url: 'http://127.0.0.1:49152/sse',
        },
      },
    });
    expect(init.commands).toEqual([{ name: '/help', description: '', argumentHint: '' }]);
    expect(init.models[0]?.value).toBe('gpt-4o');
    expect(init.account.apiKeySource).toBe('user');
  });

  it('uses SDK runtime APIs for initialize and control state', async () => {
    (fake.query as any).getRuntimeState = vi.fn().mockResolvedValue({
      sessionId: 'sdk-session-1',
      cwd: '/tmp/test-project',
      status: 'idle',
      model: 'runtime-model',
      models: [{ value: 'runtime-model', displayName: 'Runtime Model', description: 'From SDK' }],
      slashCommands: [{ name: '/runtime', description: 'Runtime command', argumentHint: '<arg>' }],
      agents: [{ name: 'runtime-agent', description: 'Runtime agent', model: 'runtime-model' }],
      fastModeState: { state: 'on', enabled: true, canToggle: true },
      account: { apiKeySource: 'project' },
    });
    (fake.query as any).listMcpServers = vi.fn(() => [{ name: 'sdk-mcp', status: 'connected' }]);
    (fake.query as any).getSettings = vi.fn(() => ({ effective: { fastMode: true }, sources: [], applied: { model: 'runtime-model', effort: null } }));
    (fake.query as any).getContextUsage = vi.fn().mockResolvedValue({ totalTokens: 12, maxTokens: 100, categories: [] });
    (fake.query as any).applySettings = vi.fn().mockResolvedValue({ effective: { fastMode: false }, sources: [], applied: { model: 'runtime-model', effort: 'low' } });
    (fake.query as any).setMcpServers = vi.fn().mockResolvedValue({ success: true, added: ['ide'], removed: [] });

    const init = await manager.spawn();
    const mcp = await manager.sendControlRequest({ subtype: 'mcp_status' });
    const settings = await manager.sendControlRequest({ subtype: 'get_settings' });
    const context = await manager.sendControlRequest({ subtype: 'get_context_usage' });
    const applied = await manager.sendControlRequest({ subtype: 'apply_flag_settings', settings: { fastMode: false, effort: 'low' } });
    const mcpSet = await manager.sendControlRequest({ subtype: 'mcp_set_servers', servers: { ide: { type: 'sse', url: 'http://127.0.0.1:1/sse' } } });

    expect(init.commands).toEqual([{ name: '/runtime', description: 'Runtime command', argumentHint: '<arg>' }]);
    expect(init.agents).toEqual([{ name: 'runtime-agent', description: 'Runtime agent', model: 'runtime-model' }]);
    expect(init.models).toEqual([{ value: 'runtime-model', displayName: 'Runtime Model', description: 'From SDK' }]);
    expect(init.fast_mode_state).toBe('on');
    expect(init.account.apiKeySource).toBe('project');
    expect(mcp).toEqual({ mcpServers: [{ name: 'sdk-mcp', status: 'connected' }] });
    expect(settings).toEqual({ effective: { fastMode: true }, sources: [], applied: { model: 'runtime-model', effort: null } });
    expect(context).toMatchObject({ totalTokens: 12, maxTokens: 100 });
    expect(applied).toMatchObject({ effective: { fastMode: false } });
    expect((fake.query as any).applySettings).toHaveBeenCalledWith(expect.objectContaining({ fastMode: false, effort: 'low' }));
    expect(mcpSet).toMatchObject({ success: true, added: ['ide'], removed: [], errors: {} });
  });

  it('tolerates nullable SDK capability responses during startup', async () => {
    fake.query.supportedCommands.mockImplementation(() => {
      throw new TypeError("Cannot read properties of null (reading 'map')");
    });
    fake.query.supportedModels.mockReturnValue(null);
    fake.query.supportedAgents.mockReturnValue(null);
    fake.query.mcpServerStatus.mockImplementation(() => {
      throw new TypeError("Cannot read properties of null (reading 'map')");
    });
    fake.query.accountInfo.mockResolvedValue(null);

    const init = await manager.spawn();
    const mcp = await manager.sendControlRequest({ subtype: 'mcp_status' });

    expect(init.commands).toEqual([]);
    expect(init.agents).toEqual([]);
    expect(init.models).toEqual([{
      value: 'gpt-4o',
      displayName: 'gpt-4o',
      description: 'Current GakrCLI SDK model',
    }]);
    expect(init.account).toEqual({ apiKeySource: 'none' });
    expect(mcp).toEqual({ mcpServers: [] });
  });

  it('pushes user messages into the SDK prompt stream', async () => {
    await manager.spawn();

    const iterator = capturedParams!.prompt[Symbol.asyncIterator]();
    manager.write({
      type: 'user',
      message: { role: 'user', content: 'hello sdk' },
      uuid: 'msg-1',
      priority: 'now',
    });

    await expect(iterator.next()).resolves.toMatchObject({
      done: false,
      value: {
        type: 'user',
        message: { role: 'user', content: 'hello sdk' },
        parent_tool_use_id: null,
        uuid: 'msg-1',
        priority: 'now',
      },
    });
  });

  it('maps control requests to SDK query methods', async () => {
    await manager.spawn();

    await manager.sendControlRequest({ subtype: 'set_model', model: 'gpt-4.1' });
    await manager.sendControlRequest({ subtype: 'set_permission_mode', mode: 'acceptEdits' });
    await manager.sendControlRequest({ subtype: 'set_max_thinking_tokens', max_thinking_tokens: 8000 });
    const mcp = await manager.sendControlRequest({ subtype: 'mcp_status' });
    const dryRun = await manager.sendControlRequest({ subtype: 'rewind_files', dry_run: true });
    const rewind = await manager.sendControlRequest({ subtype: 'rewind_files', dry_run: false });

    expect(fake.query.setModel).toHaveBeenCalledWith('gpt-4.1');
    expect(fake.query.setPermissionMode).toHaveBeenCalledWith('acceptEdits');
    expect(fake.query.setMaxThinkingTokens).toHaveBeenCalledWith(8000);
    expect(mcp).toEqual({ mcpServers: [{ name: 'ide', status: 'connected' }] });
    expect(dryRun).toEqual({ canRewind: true });
    expect(rewind).toEqual({ canRewind: true, filesChanged: ['a.ts'] });
  });

  it('routes SDK permission requests through registered control handlers', async () => {
    const handler = vi.fn().mockResolvedValue({
      behavior: 'allow',
      updatedInput: { file_path: 'package.json' },
      toolUseID: 'tool-1',
    });
    const onMessage = vi.fn();
    manager.registerControlHandler('can_use_tool', handler);
    manager.onMessage(onMessage);

    await manager.spawn();
    const onPermissionRequest = capturedParams!.options.onPermissionRequest as (msg: unknown) => void;
    onPermissionRequest({
      type: 'permission_request',
      request_id: 'req-1',
      tool_name: 'Read',
      tool_use_id: 'tool-1',
      input: { file_path: 'package.json' },
      uuid: 'perm-uuid',
      session_id: 'sdk-session-1',
    });

    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(onMessage).toHaveBeenCalledWith(expect.objectContaining({
      type: 'control_request',
      request_id: 'req-1',
    }));
    expect(handler).toHaveBeenCalledWith(
      expect.objectContaining({ subtype: 'can_use_tool', tool_name: 'Read' }),
      expect.any(AbortSignal),
      'req-1',
    );
    expect(fake.query.respondToPermission).toHaveBeenCalledWith('tool-1', {
      behavior: 'allow',
      updatedInput: { file_path: 'package.json' },
      toolUseID: 'tool-1',
    });
  });

  it('provides a canUseTool callback that resolves through extension permission handlers', async () => {
    const handler = vi.fn().mockResolvedValue({
      behavior: 'allow',
      updatedInput: {
        questions: [{ question: 'Pick one?', options: [] }],
        answers: { 'Pick one?': 'Yes' },
      },
      toolUseID: 'tool-ask',
    });
    manager.registerControlHandler('can_use_tool', handler);

    await manager.spawn();
    const canUseTool = capturedParams!.options.canUseTool as (
      name: string,
      input: unknown,
      options?: { toolUseID?: string },
    ) => Promise<unknown>;

    const result = await canUseTool(
      'AskUserQuestion',
      { questions: [{ question: 'Pick one?', options: [] }] },
      { toolUseID: 'tool-ask' },
    );

    expect(handler).toHaveBeenCalledWith(
      expect.objectContaining({
        subtype: 'can_use_tool',
        tool_name: 'AskUserQuestion',
        tool_use_id: 'tool-ask',
      }),
      expect.any(AbortSignal),
      expect.any(String),
    );
    expect(result).toEqual({
      behavior: 'allow',
      updatedInput: {
        questions: [{ question: 'Pick one?', options: [] }],
        answers: { 'Pick one?': 'Yes' },
      },
      toolUseID: 'tool-ask',
    });
  });

  it('broadcasts SDK messages and tracks session id updates', async () => {
    const onMessage = vi.fn();
    manager.onMessage(onMessage);
    await manager.spawn();

    fake.pushMessage({
      type: 'assistant',
      message: { role: 'assistant', content: [] },
      parent_tool_use_id: null,
      uuid: 'assistant-1',
      session_id: 'sdk-session-2',
    });
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(onMessage).toHaveBeenCalledWith(expect.objectContaining({
      type: 'assistant',
      session_id: 'sdk-session-2',
    }));
    expect(manager.sessionId).toBe('sdk-session-2');
  });

  it('interrupts on SIGINT and closes on termination', async () => {
    const exit = vi.fn();
    manager.onExit(exit);
    await manager.spawn();

    manager.kill('SIGINT');
    expect(fake.query.interrupt).toHaveBeenCalled();
    expect(manager.state).toBe(ProcessState.Ready);

    manager.kill('SIGTERM');
    expect(fake.query.close).toHaveBeenCalled();
    expect(manager.state).toBe(ProcessState.Idle);
    expect(exit).toHaveBeenCalledWith(0, 'SIGTERM');
  });
});
