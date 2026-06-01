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
import { existsSync, readFileSync } from 'fs';
import * as path from 'path';
import { pathToFileURL } from 'url';
import { randomUUID } from 'crypto';

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
  private readonly pendingDecisions = new Map<string, {
    resolve: (decision: SDKPermissionResult) => void;
    reject: (error: Error) => void;
    timeout: NodeJS.Timeout;
  }>();

  constructor(private readonly respond: (toolUseId: string, decision: SDKPermissionResult) => void) {}

  remember(requestId: string, toolUseId: string): void {
    this.requestToToolUse.set(requestId, toolUseId);
  }

  waitForDecision(
    requestId: string,
    toolUseId: string,
    timeoutMs = 300_000,
  ): Promise<SDKPermissionResult> {
    this.remember(requestId, toolUseId);
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pendingDecisions.delete(requestId);
        this.requestToToolUse.delete(requestId);
        reject(new Error(`Permission request timed out for ${toolUseId}`));
      }, timeoutMs);
      this.pendingDecisions.set(requestId, { resolve, reject, timeout });
    });
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
      const decision = {
        behavior: 'deny',
        message: msg.response.error ?? 'Permission request failed',
        toolUseID: toolUseId,
      } as SDKPermissionResult;
      this.resolvePendingDecision(requestId, decision);
      this.respond(toolUseId, decision);
      return;
    }

    const decision = msg.response.response;
    if (decision) {
      const sdkDecision = decision as unknown as SDKPermissionResult;
      this.resolvePendingDecision(requestId, sdkDecision);
      this.respond(toolUseId, sdkDecision);
    }
  }

  dispose(): void {
    for (const pending of this.pendingDecisions.values()) {
      clearTimeout(pending.timeout);
      pending.reject(new Error('SDK response transport disposed'));
    }
    this.pendingDecisions.clear();
    this.requestToToolUse.clear();
  }

  private resolvePendingDecision(requestId: string, decision: SDKPermissionResult): void {
    const pending = this.pendingDecisions.get(requestId);
    if (!pending) return;
    clearTimeout(pending.timeout);
    this.pendingDecisions.delete(requestId);
    pending.resolve(decision);
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
  const workspaceSdk = await importWorkspaceSdkModule();
  if (workspaceSdk) {
    return workspaceSdk;
  }

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

async function importWorkspaceSdkModule(): Promise<SdkModule | undefined> {
  const explicitSdkPath = process.env.GAKRCLI_VSCODE_SDK_PATH;
  const baseDir = typeof __dirname === 'string' ? __dirname : process.cwd();
  const candidateRoots = [
    path.resolve(baseDir, '..', '..', '..'),
    path.resolve(baseDir, '..', '..', '..', '..'),
    process.cwd(),
  ];
  const candidates = [
    ...(explicitSdkPath ? [{ file: explicitSdkPath, explicit: true }] : []),
    ...candidateRoots.map(root => ({ file: path.join(root, 'dist', 'sdk.mjs'), explicit: false })),
  ];

  for (const candidate of candidates) {
    if (!existsSync(candidate.file)) continue;
    if (!candidate.explicit && !isGakrcliWorkspaceSdk(candidate.file)) continue;
    try {
      return await import(pathToFileURL(candidate.file).href) as SdkModule;
    } catch {
      // Fall back to the extension dependency if the local workspace build is stale.
    }
  }
  return undefined;
}

function isGakrcliWorkspaceSdk(candidate: string): boolean {
  try {
    const packageJsonPath = path.join(path.dirname(path.dirname(candidate)), 'package.json');
    const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8')) as { name?: string };
    return packageJson.name === '@gakr-gakr/gakrcli';
  } catch {
    return false;
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

function slashCommandInfo(command: Record<string, unknown>) {
  return {
    name: typeof command.name === 'string' ? command.name : '',
    description: typeof command.description === 'string' ? command.description : '',
    argumentHint: typeof command.argumentHint === 'string' ? command.argumentHint : '',
  };
}

function agentInfo(agent: Record<string, unknown>) {
  return {
    name: typeof agent.name === 'string' ? agent.name : '',
    description: typeof agent.description === 'string' ? agent.description : '',
    model: typeof agent.model === 'string' ? agent.model : undefined,
  };
}

function sdkModelInfo(model: Record<string, unknown>) {
  const value = typeof model.value === 'string' ? model.value : 'default';
  return {
    value,
    displayName: typeof model.displayName === 'string' ? model.displayName : value,
    description: typeof model.description === 'string' ? model.description : '',
    supportsEffort: typeof model.supportsReasoning === 'boolean' ? model.supportsReasoning : undefined,
    supportsFastMode: typeof model.supportsFastMode === 'boolean' ? model.supportsFastMode : undefined,
  };
}

function pluginInfo(plugin: Record<string, unknown>) {
  return {
    name: typeof plugin.name === 'string' ? plugin.name : '',
    path: typeof plugin.path === 'string' ? plugin.path : '',
    source: typeof plugin.source === 'string' ? plugin.source : undefined,
  };
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
        return { model, runtime: await this.safeRuntimeState() };
      }
      case 'set_permission_mode': {
        const mode = toSdkPermissionMode(request.mode as PermissionMode | undefined);
        if (mode) await this.sdkQuery.setPermissionMode(mode);
        return { mode: request.mode, runtime: await this.safeRuntimeState() };
      }
      case 'set_max_thinking_tokens': {
        const tokens = request.max_thinking_tokens;
        this.sdkQuery.setMaxThinkingTokens(typeof tokens === 'number' ? tokens : 0);
        return {
          reasoning: this.callSdkMethod('getReasoningConfig') ?? {},
          runtime: await this.safeRuntimeState(),
        };
      }
      case 'mcp_status':
        return { mcpServers: this.callSdkMethod('listMcpServers') ?? callRecordArray(() => this.sdkQuery?.mcpServerStatus()) };
      case 'rewind_files': {
        const dryRun = request.dry_run !== false;
        const result = dryRun
          ? this.sdkQuery.rewindFiles()
          : await this.sdkQuery.rewindFilesAsync();
        return result as Record<string, unknown>;
      }
      case 'get_context_usage':
        return await this.callSdkMethodAsync('getContextUsage') as Record<string, unknown> ?? this.emptyContextUsage();
      case 'get_settings':
        return this.callSdkMethod('getSettings') as Record<string, unknown> ??
          { effective: {}, sources: [], applied: { model: this.options.model ?? 'default', effort: null } };
      case 'get_runtime_state':
        return await this.safeRuntimeState();
      case 'reload_plugins': {
        const result = await this.callSdkMethodAsync('reloadPlugins') as Record<string, unknown> ?? {};
        return {
          ...result,
          commands: recordArray(this.callSdkMethod('listSlashCommands')).map(slashCommandInfo),
          agents: (await this.safeRuntimeState())?.agents?.map((agent) => agentInfo(agent as unknown as Record<string, unknown>)) ?? [],
          plugins: recordArray(this.callSdkMethod('listPlugins')).map(pluginInfo),
          mcpServers: this.callSdkMethod('listMcpServers') ?? callRecordArray(() => this.sdkQuery?.mcpServerStatus()),
          error_count: typeof result.error_count === 'number' ? result.error_count : 0,
        };
      }
      case 'apply_flag_settings':
        return await this.applyFlagSettings(request.settings);
      case 'seed_read_state':
      case 'cancel_async_message':
        return {};
      case 'mcp_set_servers':
        if (request.servers && typeof request.servers === 'object') {
          const result = await this.callSdkMethodAsync('setMcpServers', request.servers as Record<string, unknown>) as Record<string, unknown> ??
            { success: false, message: 'SDK MCP mutation API is unavailable' };
          return {
            ...result,
            added: Array.isArray(result.added) ? result.added : [],
            removed: Array.isArray(result.removed) ? result.removed : [],
            errors: result.success ? {} : { sdk: result.message ?? 'Failed to set MCP servers' },
          };
        }
        return { added: [], removed: [], errors: { sdk: 'Missing MCP server map' } };
      case 'mcp_reconnect':
        if (typeof request.serverName === 'string') {
          return await this.callSdkMethodAsync('reconnectMcpServer', request.serverName) as Record<string, unknown> ??
            { success: false, message: 'SDK MCP reconnect API is unavailable' };
        }
        return { success: false, message: 'Missing MCP server name' };
      case 'mcp_toggle':
        if (typeof request.serverName === 'string' && typeof request.enabled === 'boolean') {
          return await this.callSdkMethodAsync('toggleMcpServer', request.serverName, request.enabled) as Record<string, unknown> ??
            { success: false, message: 'SDK MCP toggle API is unavailable' };
        }
        return { success: false, message: 'Missing MCP server name or enabled flag' };
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
      canUseTool: (toolName, input, context) =>
        this.requestToolPermission(toolName, input, context?.toolUseID),
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
    const runtime = await this.safeRuntimeState();
    const commands = callStringArray(() => query?.supportedCommands());
    const agents = callStringArray(() => query?.supportedAgents());
    const models = callStringArray(() => query?.supportedModels());
    let account: AccountInfo = { apiKeySource: 'none' };
    if (runtime?.account) {
      account = runtime.account as AccountInfo;
    } else if (query) {
      try {
        account = await query.accountInfo() ?? account;
      } catch {
        account = { apiKeySource: 'none' };
      }
    }
    const fallbackModels = this.options.model ? [this.options.model] : [];
    const availableModels = models.length > 0 ? models : fallbackModels;
    const runtimeCommands = recordArray(runtime?.slashCommands).map(slashCommandInfo).filter((command) => command.name);
    const runtimeAgents = recordArray(runtime?.agents).map(agentInfo).filter((agent) => agent.name);
    const runtimeModels = recordArray(runtime?.models).map(sdkModelInfo).filter((model) => model.value);

    return {
      commands: runtimeCommands.length > 0 ? runtimeCommands : commands.map((name) => ({
        name,
        description: '',
        argumentHint: '',
      })),
      agents: runtimeAgents.length > 0 ? runtimeAgents : agents.map((name) => ({
        name,
        description: '',
      })),
      output_style: 'default',
      available_output_styles: ['default'],
      models: runtimeModels.length > 0
        ? runtimeModels
        : availableModels.length > 0
        ? availableModels.map((model) => modelInfo(model))
        : [modelInfo(this.options.model)],
      account,
      pid: process.pid,
      fast_mode_state: runtime?.fastModeState?.state ?? 'off',
    };
  }

  private async safeRuntimeState(): Promise<Record<string, unknown> | undefined> {
    try {
      return await this.callSdkMethodAsync('getRuntimeState') as Record<string, unknown> | undefined;
    } catch {
      return undefined;
    }
  }

  private callSdkMethod(name: string, ...args: unknown[]): unknown {
    const target = this.sdkQuery as unknown as Record<string, unknown> | undefined;
    const method = target?.[name];
    if (typeof method !== 'function') {
      return undefined;
    }
    return method.apply(this.sdkQuery, args);
  }

  private async callSdkMethodAsync(name: string, ...args: unknown[]): Promise<unknown> {
    return await this.callSdkMethod(name, ...args);
  }

  private async applyFlagSettings(settings: unknown): Promise<Record<string, unknown>> {
    const input = settings && typeof settings === 'object'
      ? settings as Record<string, unknown>
      : {};

    const permissionMode = typeof input.permissionMode === 'string'
      ? toSdkPermissionMode(input.permissionMode as PermissionMode)
      : typeof input.permission_mode === 'string'
        ? toSdkPermissionMode(input.permission_mode as PermissionMode)
        : undefined;

    const applyInput = {
      model: typeof input.model === 'string' ? input.model : undefined,
      permissionMode,
      effort: this.normalizeEffort(input.effort ?? input.reasoningEffort ?? input.reasoning_effort),
      maxThinkingTokens: typeof input.maxThinkingTokens === 'number'
        ? input.maxThinkingTokens
        : typeof input.max_thinking_tokens === 'number'
          ? input.max_thinking_tokens
          : undefined,
      fastMode: typeof input.fastMode === 'boolean'
        ? input.fastMode
        : typeof input.fast_mode === 'boolean'
          ? input.fast_mode
          : undefined,
      env: input.env && typeof input.env === 'object'
        ? input.env as Record<string, string | undefined>
        : undefined,
    };

    const snapshot = await this.callSdkMethodAsync('applySettings', applyInput) as Record<string, unknown> | undefined ??
      { effective: {}, sources: [], applied: { model: applyInput.model ?? this.options.model ?? 'default', effort: applyInput.effort ?? null } };

    if (input.enabledPlugins && typeof input.enabledPlugins === 'object') {
      for (const [pluginName, enabled] of Object.entries(input.enabledPlugins as Record<string, unknown>)) {
        if (typeof enabled === 'boolean') {
          await this.callSdkMethodAsync('setPluginEnabled', pluginName, enabled);
        }
      }
    }

    return {
      ...snapshot,
      runtime: await this.safeRuntimeState(),
    } as unknown as Record<string, unknown>;
  }

  private normalizeEffort(value: unknown): 'low' | 'medium' | 'high' | 'max' | number | null | undefined {
    if (value === null) return null;
    if (typeof value === 'number') return value;
    if (value === 'low' || value === 'medium' || value === 'high' || value === 'max') return value;
    return undefined;
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

  private async requestToolPermission(
    toolName: string,
    input: unknown,
    toolUseId?: string,
  ): Promise<SDKPermissionResult> {
    const effectiveToolUseId = toolUseId ?? randomUUID();
    const requestId = randomUUID();
    const controlRequest: SDKControlRequest = {
      type: 'control_request',
      request_id: requestId,
      request: {
        subtype: 'can_use_tool',
        tool_name: toolName,
        input: input as Record<string, unknown>,
        tool_use_id: effectiveToolUseId,
      },
    };
    const decisionPromise = this.responseTransport?.waitForDecision(requestId, effectiveToolUseId);

    for (const cb of this.messageCallbacks) {
      cb(controlRequest as StdoutMessage);
    }

    void this.router?.handleControlRequest(controlRequest);

    if (!decisionPromise) {
      return {
        behavior: 'deny',
        message: 'Permission transport unavailable',
        toolUseID: effectiveToolUseId,
      } as SDKPermissionResult;
    }

    return decisionPromise;
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
