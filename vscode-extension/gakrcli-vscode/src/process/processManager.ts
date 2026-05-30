// src/process/processManager.ts
// In-process transport for GakrCLI SDK sessions.
//
// This keeps the extension-facing ProcessManager API stable, but runs the
// GakrCLI SDK directly instead of spawning the CLI and speaking NDJSON.

import { ControlRouter, type ControlRequestHandler } from './controlRouter';
import type { InitializeResponse } from '../types/protocol';
import type {
  SDKControlRequest,
  SDKKeepAliveMessage,
  SDKUserMessage,
  StdoutMessage,
} from '../types/messages';
import type { AccountInfo, PermissionMode, PermissionResult } from '../types/session';
import type {
  Query,
  QueryOptions,
  SDKMessage,
  SDKPermissionRequestMessage,
  PermissionResult as SDKPermissionResult,
} from '@gakr-gakr/gakrcli/sdk';

// ============================================================================
// Types
// ============================================================================

export enum ProcessState {
  Idle = 'idle',
  Spawning = 'spawning',
  Initializing = 'initializing',
  Ready = 'ready',
  Restarting = 'restarting',
}

export interface ProcessManagerOptions {
  /** Working directory for the SDK session */
  cwd: string;
  /** Retained for backward compatibility; ignored by SDK mode. */
  executable?: string;
  /** Retained for backward compatibility; ignored by SDK mode. */
  executableArgs?: string[];
  /** Model to use */
  model?: string;
  /** Permission mode */
  permissionMode?: PermissionMode;
  /** Allow switching into bypassPermissions mode during the session. */
  allowDangerouslySkipPermissions?: boolean;
  /** Session ID to resume */
  sessionId?: string;
  /** Continue last session */
  continueSession?: boolean;
  /** IDE MCP server exposed by the extension. */
  ideMcpServer?: {
    port: number;
    ideName?: string;
  };
  /** Fork session before resuming */
  forkSession?: boolean;
  /** Worktree name. Retained for API compatibility. */
  worktree?: string;
  /** Additional environment variables */
  env?: Record<string, string>;
  /** Initialize request options */
  promptSuggestions?: boolean;
  agentProgressSummaries?: boolean;
  /** Retained for API compatibility. SDK mode does not crash-restart. */
  autoRestart?: boolean;
  /** Retained for API compatibility. */
  keepAliveIntervalMs?: number;
  /** SDK-owned MCP server names to advertise during initialize. */
  sdkMcpServers?: string[];
}

type MessageCallback = (message: StdoutMessage) => void;
type ErrorCallback = (error: Error) => void;
type ExitCallback = (code: number | null, signal: string | null) => void;
type StderrCallback = (line: string) => void;
type StateCallback = (state: ProcessState) => void;

type SdkModule = typeof import('@gakr-gakr/gakrcli/sdk');

interface QueuedPrompt {
  type: 'user';
  message: {
    role: 'user';
    content: string | unknown[];
  };
  parent_tool_use_id: null;
  uuid?: string;
  priority?: 'now' | 'next' | 'later';
}

class AsyncPromptQueue implements AsyncIterable<QueuedPrompt> {
  private readonly values: QueuedPrompt[] = [];
  private readonly waiters: Array<(next: IteratorResult<QueuedPrompt>) => void> = [];
  private closed = false;

  push(value: QueuedPrompt): void {
    if (this.closed) return;
    const waiter = this.waiters.shift();
    if (waiter) {
      waiter({ value, done: false });
      return;
    }
    this.values.push(value);
  }

  close(): void {
    if (this.closed) return;
    this.closed = true;
    while (this.waiters.length > 0) {
      this.waiters.shift()?.({ value: undefined, done: true });
    }
  }

  async *[Symbol.asyncIterator](): AsyncIterator<QueuedPrompt> {
    while (true) {
      if (this.values.length > 0) {
        yield this.values.shift()!;
        continue;
      }
      if (this.closed) {
        return;
      }
      const next = await new Promise<IteratorResult<QueuedPrompt>>((resolve) => {
        this.waiters.push(resolve);
      });
      if (next.done) return;
      yield next.value;
    }
  }
}

class SdkResponseTransport {
  private readonly requestToToolUse = new Map<string, string>();

  constructor(private readonly respond: (toolUseId: string, decision: SDKPermissionResult) => void) {}

  remember(requestId: string, toolUseId: string): void {
    this.requestToToolUse.set(requestId, toolUseId);
  }

  write(message: unknown): void {
    const msg = message as {
      type?: string;
      response?: {
        subtype?: 'success' | 'error';
        request_id?: string;
        response?: PermissionResult;
        error?: string;
      };
    };

    if (msg.type !== 'control_response' || !msg.response?.request_id) {
      return;
    }

    const requestId = msg.response.request_id;
    const toolUseId =
      msg.response.response?.toolUseID ??
      this.requestToToolUse.get(requestId);
    if (!toolUseId) {
      return;
    }

    this.requestToToolUse.delete(requestId);
    if (msg.response.subtype === 'error') {
      this.respond(toolUseId, {
        behavior: 'deny',
        message: msg.response.error ?? 'Permission request failed',
        toolUseID: toolUseId,
      });
      return;
    }

    const decision = msg.response.response;
    if (decision) {
      this.respond(toolUseId, decision as unknown as SDKPermissionResult);
    }
  }

  dispose(): void {
    this.requestToToolUse.clear();
  }
}

// ============================================================================
// SDK loading
// ============================================================================

let sdkModulePromise: Promise<SdkModule> | undefined;

async function loadSdkModule(): Promise<SdkModule> {
  if (!sdkModulePromise) {
    sdkModulePromise = importSdkModule();
  }
  return sdkModulePromise;
}

async function importSdkModule(): Promise<SdkModule> {
  try {
    return await import('@gakr-gakr/gakrcli/sdk');
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(
      `Unable to load @gakr-gakr/gakrcli/sdk from the extension dependencies: ${message}. ` +
        'Run npm install in the extension project before development, and package the extension with production dependencies.',
    );
  }
}

export function __setSdkModuleForTests(sdk: SdkModule | undefined): void {
  sdkModulePromise = sdk ? Promise.resolve(sdk) : undefined;
}

function toSdkPermissionMode(mode?: PermissionMode): QueryOptions['permissionMode'] {
  if (mode === 'dontAsk') return 'default';
  return mode;
}

function modelInfo(model: string | undefined) {
  const value = model || 'default';
  return {
    value,
    displayName: value,
    description: 'Current GakrCLI SDK model',
  };
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}

function callStringArray(read: () => unknown): string[] {
  try {
    return stringArray(read());
  } catch {
    return [];
  }
}

function recordArray(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value)
    ? value.filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === 'object')
    : [];
}

function callRecordArray(read: () => unknown): Record<string, unknown>[] {
  try {
    return recordArray(read());
  } catch {
    return [];
  }
}

// ============================================================================
// ProcessManager
// ============================================================================

export class ProcessManager {
  private options: ProcessManagerOptions;
  private sdkQuery: Query | undefined;
  private promptQueue: AsyncPromptQueue | undefined;
  private router: ControlRouter | undefined;
  private responseTransport: SdkResponseTransport | undefined;
  private abortController: AbortController | undefined;
  private consumePromise: Promise<void> | undefined;

  private _state: ProcessState = ProcessState.Idle;
  private _sessionId: string | undefined;
  private _initializeResponse: InitializeResponse | undefined;
  private intentionalShutdown = false;

  private messageCallbacks: MessageCallback[] = [];
  private errorCallbacks: ErrorCallback[] = [];
  private exitCallbacks: ExitCallback[] = [];
  private stderrCallbacks: StderrCallback[] = [];
  private stateCallbacks: StateCallback[] = [];
  private controlHandlers = new Map<string, ControlRequestHandler>();

  constructor(options: ProcessManagerOptions) {
    this.options = options;
  }

  get state(): ProcessState {
    return this._state;
  }

  get sessionId(): string | undefined {
    return this._sessionId;
  }

  get initializeResponse(): InitializeResponse | undefined {
    return this._initializeResponse;
  }

  /** Compatibility adapter used by permission and diff handlers. */
  get ndjsonTransport(): { write(message: unknown): void } | undefined {
    return this.responseTransport;
  }

  async spawn(): Promise<InitializeResponse> {
    if (this._state !== ProcessState.Idle && this._state !== ProcessState.Restarting) {
      return this._initializeResponse ?? this.createInitializeResponse();
    }

    this.setState(ProcessState.Spawning);
    this.intentionalShutdown = false;

    try {
      this.setState(ProcessState.Initializing);
      const sdk = await loadSdkModule();

      this.abortController = new AbortController();
      this.promptQueue = new AsyncPromptQueue();
      this.responseTransport = new SdkResponseTransport((toolUseId, decision) => {
        this.sdkQuery?.respondToPermission(toolUseId, decision);
      });

      this.router = new ControlRouter((msg) => this.responseTransport?.write(msg));
      for (const [subtype, handler] of this.controlHandlers) {
        this.router.registerHandler(subtype, handler);
      }

      this.sdkQuery = sdk.query({
        prompt: this.promptQueue,
        options: this.buildQueryOptions(),
      });
      this._sessionId = this.sdkQuery.sessionId;
      this._initializeResponse = await this.createInitializeResponse();
      this.consumePromise = this.consumeSdkMessages();

      this.setState(ProcessState.Ready);
      return this._initializeResponse;
    } catch (err) {
      this.cleanup();
      this.setState(ProcessState.Idle);
      const error = err instanceof Error ? err : new Error(String(err));
      this.emitError(error);
      throw error;
    }
  }

  write(message: unknown): void {
    const msg = message as Record<string, unknown>;
    if (msg.type === 'user') {
      const userMessage = msg as unknown as SDKUserMessage;
      const message = userMessage.message as { content?: unknown } | undefined;
      const content = message?.content;
      this.promptQueue?.push({
        type: 'user',
        message: {
          role: 'user',
          content: typeof content === 'string' || Array.isArray(content)
            ? content
            : String(content ?? ''),
        },
        parent_tool_use_id: null,
        uuid: typeof userMessage.uuid === 'string' ? userMessage.uuid : undefined,
        priority: userMessage.priority,
      });
      return;
    }

    if (msg.type === 'control_response') {
      this.responseTransport?.write(message);
      return;
    }

    if (msg.type === 'control_request') {
      const request = msg.request as Record<string, unknown> | undefined;
      if (request) {
        void this.sendControlRequest(request).catch((err) => this.emitError(err));
      }
      return;
    }

    if ((msg as unknown as SDKKeepAliveMessage).type === 'keep_alive') {
      return;
    }
  }

  async sendControlRequest(
    request: Record<string, unknown>,
  ): Promise<Record<string, unknown> | undefined> {
    if (!this.sdkQuery) {
      return undefined;
    }

    switch (request.subtype) {
      case 'interrupt':
        this.sdkQuery.interrupt();
        return {};
      case 'set_model': {
        const model = typeof request.model === 'string' ? request.model : undefined;
        if (model) await this.sdkQuery.setModel(model);
        return { model };
      }
      case 'set_permission_mode': {
        const mode = toSdkPermissionMode(request.mode as PermissionMode | undefined);
        if (mode) await this.sdkQuery.setPermissionMode(mode);
        return { mode: request.mode };
      }
      case 'set_max_thinking_tokens': {
        const tokens = request.max_thinking_tokens;
        if (typeof tokens === 'number') {
          this.sdkQuery.setMaxThinkingTokens(tokens);
        }
        return {};
      }
      case 'mcp_status':
        return { mcpServers: callRecordArray(() => this.sdkQuery?.mcpServerStatus()) };
      case 'rewind_files': {
        const dryRun = request.dry_run !== false;
        const result = dryRun
          ? this.sdkQuery.rewindFiles()
          : await this.sdkQuery.rewindFilesAsync();
        return result as Record<string, unknown>;
      }
      case 'get_context_usage':
        return this.emptyContextUsage();
      case 'get_settings':
        return { effective: {}, sources: [], applied: { model: this.options.model ?? 'default', effort: null } };
      case 'reload_plugins':
        return {
          commands: [],
          agents: [],
          plugins: [],
          mcpServers: callRecordArray(() => this.sdkQuery?.mcpServerStatus()),
          error_count: 0,
        };
      case 'apply_flag_settings':
      case 'seed_read_state':
      case 'cancel_async_message':
      case 'mcp_set_servers':
      case 'mcp_reconnect':
      case 'mcp_toggle':
      case 'stop_task':
        return {};
      default:
        return undefined;
    }
  }

  registerControlHandler(
    subtype: string,
    handler: ControlRequestHandler,
  ): void {
    this.controlHandlers.set(subtype, handler);
    this.router?.registerHandler(subtype, handler);
  }

  kill(signal: NodeJS.Signals = 'SIGTERM'): void {
    if (signal === 'SIGINT') {
      this.sdkQuery?.interrupt();
      return;
    }

    this.intentionalShutdown = true;
    this.cleanup();
    this.setState(ProcessState.Idle);
    for (const cb of this.exitCallbacks) {
      cb(0, signal);
    }
  }

  dispose(): void {
    this.intentionalShutdown = true;
    this.cleanup();
    this.messageCallbacks = [];
    this.errorCallbacks = [];
    this.exitCallbacks = [];
    this.stderrCallbacks = [];
    this.stateCallbacks = [];
    this.controlHandlers.clear();
  }

  onMessage(callback: MessageCallback): void {
    this.messageCallbacks.push(callback);
  }

  onError(callback: ErrorCallback): void {
    this.errorCallbacks.push(callback);
  }

  onExit(callback: ExitCallback): void {
    this.exitCallbacks.push(callback);
  }

  onStderr(callback: StderrCallback): void {
    this.stderrCallbacks.push(callback);
  }

  onStateChange(callback: StateCallback): void {
    this.stateCallbacks.push(callback);
  }

  private buildQueryOptions(): QueryOptions {
    const mcpServers: Record<string, unknown> = {};
    if (this.options.ideMcpServer) {
      mcpServers.ide = {
        type: 'sse',
        url: `http://127.0.0.1:${this.options.ideMcpServer.port}/sse`,
      };
    }

    return {
      cwd: this.options.cwd,
      model: this.options.model,
      sessionId: this.options.sessionId,
      continue: this.options.continueSession,
      forkSession: this.options.forkSession,
      permissionMode: toSdkPermissionMode(this.options.permissionMode),
      allowDangerouslySkipPermissions: this.options.allowDangerouslySkipPermissions,
      includePartialMessages: true,
      abortController: this.abortController,
      env: this.buildEnvOverrides(),
      mcpServers: Object.keys(mcpServers).length > 0 ? mcpServers : undefined,
      onPermissionRequest: (message) => this.handlePermissionRequest(message),
      stderr: (line) => this.emitStderr(String(line)),
    };
  }

  private buildEnvOverrides(): Record<string, string | undefined> {
    const env: Record<string, string | undefined> = {
      ...(this.options.env ?? {}),
      GAKR_CODE_ENTRYPOINT: this.options.env?.GAKR_CODE_ENTRYPOINT ?? 'gakrcli-vscode',
      GAKR_CODE_ENVIRONMENT_KIND: this.options.env?.GAKR_CODE_ENVIRONMENT_KIND ?? 'vscode',
      NODE_OPTIONS: undefined,
    };
    return env;
  }

  private async createInitializeResponse(): Promise<InitializeResponse> {
    const query = this.sdkQuery;
    const commands = callStringArray(() => query?.supportedCommands());
    const agents = callStringArray(() => query?.supportedAgents());
    const models = callStringArray(() => query?.supportedModels());
    let account: AccountInfo = { apiKeySource: 'none' };
    if (query) {
      try {
        account = await query.accountInfo() ?? account;
      } catch {
        account = { apiKeySource: 'none' };
      }
    }
    const fallbackModels = this.options.model ? [this.options.model] : [];
    const availableModels = models.length > 0 ? models : fallbackModels;

    return {
      commands: commands.map((name) => ({
        name,
        description: '',
        argumentHint: '',
      })),
      agents: agents.map((name) => ({
        name,
        description: '',
      })),
      output_style: 'default',
      available_output_styles: ['default'],
      models: availableModels.length > 0
        ? availableModels.map((model) => modelInfo(model))
        : [modelInfo(this.options.model)],
      account,
      pid: process.pid,
      fast_mode_state: 'off',
    };
  }

  private async consumeSdkMessages(): Promise<void> {
    const query = this.sdkQuery;
    if (!query) return;

    try {
      for await (const message of query) {
        this.handleSdkMessage(message);
      }
    } catch (err) {
      if (!this.intentionalShutdown) {
        this.emitError(err instanceof Error ? err : new Error(String(err)));
        this.setState(ProcessState.Idle);
      }
    }
  }

  private handleSdkMessage(message: SDKMessage): void {
    const msg = message as StdoutMessage;
    const record = msg as unknown as Record<string, unknown>;
    if ('session_id' in record && typeof record.session_id === 'string') {
      this._sessionId = record.session_id;
    }

    for (const cb of this.messageCallbacks) {
      cb(msg);
    }
  }

  private handlePermissionRequest(message: SDKPermissionRequestMessage): void {
    const controlRequest: SDKControlRequest = {
      type: 'control_request',
      request_id: message.request_id,
      request: {
        subtype: 'can_use_tool',
        tool_name: message.tool_name,
        input: message.input,
        tool_use_id: message.tool_use_id,
      },
    };

    this.responseTransport?.remember(message.request_id, message.tool_use_id);

    for (const cb of this.messageCallbacks) {
      cb(controlRequest as StdoutMessage);
    }

    void this.router?.handleControlRequest(controlRequest);
  }

  private emptyContextUsage(): Record<string, unknown> {
    return {
      categories: [],
      totalTokens: 0,
      maxTokens: 0,
      rawMaxTokens: 0,
      percentage: 0,
      gridRows: [],
      model: this.options.model ?? 'default',
      memoryFiles: [],
      mcpTools: [],
      agents: [],
      isAutoCompactEnabled: false,
      apiUsage: null,
    };
  }

  private cleanup(): void {
    this.promptQueue?.close();
    this.promptQueue = undefined;
    this.sdkQuery?.close();
    this.sdkQuery = undefined;
    this.abortController?.abort();
    this.abortController = undefined;
    this.router?.dispose();
    this.router = undefined;
    this.responseTransport?.dispose();
    this.responseTransport = undefined;
    this.consumePromise = undefined;
  }

  private setState(state: ProcessState): void {
    this._state = state;
    for (const cb of this.stateCallbacks) {
      cb(state);
    }
  }

  private emitError(error: Error): void {
    for (const cb of this.errorCallbacks) {
      cb(error);
    }
  }

  private emitStderr(line: string): void {
    for (const cb of this.stderrCallbacks) {
      cb(line);
    }
  }
}
