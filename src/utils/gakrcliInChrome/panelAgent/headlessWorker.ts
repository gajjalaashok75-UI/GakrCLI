/**
 * One persistent headless `gakrcli` conversation (Phase 3A prototype).
 *
 * The worker owns a single `gakrcli --print` child started with stream-json
 * input/output. The panel-agent service (3B) will own routing, HTTP/SSE and
 * lifecycle; this class only:
 *
 *  - spawns and waits for the CLI's `system/init`,
 *  - writes one NDJSON user turn at a time and resolves on `result`,
 *  - translates NDJSON into `RealtimeEvent`s (see `eventTranslation.ts`),
 *  - relays `can_use_tool` control requests and writes the decision back,
 *  - terminates the child on cancel/close and reports the exit,
 *  - resumes the same CLI conversation with `--resume <uuid>` on restart.
 *
 * It deliberately contains no prompt construction, HTTP or SSE code.
 */

import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { createInterface, type Interface } from 'node:readline';
import type {
  AgentUsageStats,
  RealtimeEvent,
} from '@gakr-gakr/mcp-chrome-shared';
import { toCliSessionId } from './cliSessionId.js';
import {
  PanelAgentTranslator,
  type TurnResult,
} from './eventTranslation.js';

export type PermissionMode =
  | 'default'
  | 'acceptEdits'
  | 'bypassPermissions'
  | 'plan';

export type PermissionRequest = {
  requestId: string;
  toolName: string;
  input: Record<string, unknown>;
  toolUseId: string;
  suggestions?: unknown[];
  blockedPath?: string;
  decisionReason?: unknown;
};

export type PermissionDecision =
  | {
      behavior: 'allow';
      updatedInput?: Record<string, unknown>;
      updatedPermissions?: unknown[];
    }
  | { behavior: 'deny'; message?: string };

export type McpServerConfig = {
  type?: 'stdio';
  command: string;
  args?: string[];
  env?: Record<string, string>;
};

export type HeadlessWorkerOptions = {
  /** Absolute path to the built CLI entry (e.g. `dist/cli.mjs`). */
  cliEntry: string;
  /** Runtime that executes `cliEntry`; defaults to the current executable. */
  execPath?: string;
  cwd: string;
  /** Panel session id; non-uuids are mapped deterministically. */
  sessionId: string;
  /** Resume an existing CLI session instead of starting a new one. */
  resume?: boolean;
  model?: string;
  permissionMode?: PermissionMode;
  mcpConfig?: { mcpServers: Record<string, McpServerConfig> };
  allowedTools?: string[];
  extraArgs?: string[];
  env?: NodeJS.ProcessEnv;
  includeThinking?: boolean;
  startupTimeoutMs?: number;
  /** Grace period before SIGKILL when cancelling/closing. */
  killGraceMs?: number;
};

export type WorkerState =
  | 'idle'
  | 'starting'
  | 'ready'
  | 'running'
  | 'closing'
  | 'exited';

export type WorkerInfo = {
  pid: number | undefined;
  /** Panel session id as supplied. */
  sessionId: string;
  /** CLI uuid used for `--session-id` / `--resume`. */
  cliSessionId: string;
  model?: string;
  tools?: string[];
  serverNames?: string[];
};

export type WorkerEvent =
  | RealtimeEvent
  | { type: 'permission_request'; request: PermissionRequest };

type Listener = (event: WorkerEvent) => void;

type ActiveTurn = {
  requestId: string;
  startedAt: number;
  resolve: (result: TurnResult) => void;
  reject: (error: Error) => void;
};

const MAX_STDERR_LINES = 20;

function emptyUsage(sessionId: string, requestId: string): AgentUsageStats {
  return {
    sessionId,
    requestId,
    inputTokens: 0,
    outputTokens: 0,
    totalCostUsd: 0,
    durationMs: 0,
    numTurns: 0,
  };
}

export class HeadlessCliWorker {
  readonly sessionId: string;
  readonly cliSessionId: string;

  private readonly options: HeadlessWorkerOptions;
  private child: ChildProcessWithoutNullStreams | null = null;
  private stdoutReader: Interface | null = null;
  private listeners = new Set<Listener>();
  private pendingPermissions = new Map<string, PermissionRequest>();
  private activeTurn: ActiveTurn | null = null;
  private stderrLines: string[] = [];
  private killTimer: NodeJS.Timeout | null = null;
  private startup: {
    resolve: (info: WorkerInfo) => void;
    reject: (error: Error) => void;
  } | null = null;
  private initDeferred: {
    resolve: (info: WorkerInfo) => void;
    promise: Promise<WorkerInfo>;
  };
  private cancelled = false;
  private lastUsage = emptyUsage('', '');
  private translator: PanelAgentTranslator;

  state: WorkerState = 'idle';
  info: WorkerInfo | null = null;

  constructor(options: HeadlessWorkerOptions) {
    this.options = options;
    this.sessionId = options.sessionId;
    this.cliSessionId = toCliSessionId(options.sessionId);
    this.translator = new PanelAgentTranslator(options.sessionId, {
      includeThinking: options.includeThinking,
    });
    let resolveInit!: (info: WorkerInfo) => void;
    const promise = new Promise<WorkerInfo>(resolve => {
      resolveInit = resolve;
    });
    this.initDeferred = { resolve: resolveInit, promise };
  }

  /**
   * Resolves with the `system/init` payload. The CLI emits init as the first
   * message of a query turn, so this only settles after the first `sendTurn()`.
   */
  get initialized(): Promise<WorkerInfo> {
    return this.initDeferred.promise;
  }

  onEvent(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private emit(event: WorkerEvent): void {
    for (const listener of [...this.listeners]) {
      try {
        listener(event);
      } catch {
        // A broken listener must not stop the worker.
      }
    }
  }

  private emitStatus(
    status: 'starting' | 'ready' | 'running' | 'completed' | 'error' | 'cancelled',
    requestId?: string,
    message?: string,
  ): void {
    this.emit({
      type: 'status',
      data: { sessionId: this.sessionId, status, requestId, message },
    });
  }

  buildArgs(): string[] {
    const options = this.options;
    const args = [
      '--print',
      '--input-format',
      'stream-json',
      '--output-format',
      'stream-json',
      '--verbose',
      '--include-partial-messages',
      '--replay-user-messages',
      // Without this, a permission that would prompt in the TUI has no route
      // to the extension and the tool call stalls or is denied.
      '--permission-prompt-tool',
      'stdio',
    ];

    if (options.resume) {
      args.push('--resume', this.cliSessionId);
    } else {
      args.push('--session-id', this.cliSessionId);
    }

    if (options.model) {
      args.push('--model', options.model);
    }
    if (options.permissionMode) {
      args.push('--permission-mode', options.permissionMode);
    }
    if (options.mcpConfig) {
      args.push('--mcp-config', JSON.stringify(options.mcpConfig));
    }
    if (options.allowedTools?.length) {
      args.push('--allowedTools', ...options.allowedTools);
    }
    if (options.extraArgs?.length) {
      args.push(...options.extraArgs);
    }
    return args;
  }

  /**
   * Spawn the CLI. Readiness means the process started and stdin is writable;
   * tool/model metadata arrives with the first turn's `system/init`.
   */
  async start(): Promise<WorkerInfo> {
    if (this.state !== 'idle') {
      throw new Error(`worker already started (${this.state})`);
    }
    this.state = 'starting';
    this.emitStatus('starting');

    const child = spawn(
      this.options.execPath ?? process.execPath,
      [this.options.cliEntry, ...this.buildArgs()],
      {
        cwd: this.options.cwd,
        stdio: ['pipe', 'pipe', 'pipe'],
        env: this.options.env ?? process.env,
        windowsHide: true,
      },
    );
    this.child = child;
    this.attachStreams(child);

    const spawnTimeout = this.options.startupTimeoutMs ?? 30_000;
    const info = await new Promise<WorkerInfo>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.startup = null;
        this.terminate();
        reject(
          new Error(
            `CLI process did not start within ${spawnTimeout}ms` +
              this.stderrSuffix(),
          ),
        );
      }, spawnTimeout);
      this.startup = {
        resolve: value => {
          clearTimeout(timer);
          this.startup = null;
          resolve(value);
        },
        reject: error => {
          clearTimeout(timer);
          this.startup = null;
          reject(error);
        },
      };
      child.once('spawn', () => {
        this.startup?.resolve({
          pid: child.pid,
          sessionId: this.sessionId,
          cliSessionId: this.cliSessionId,
        });
      });
    });

    this.state = 'ready';
    this.info = info;
    this.emitStatus('ready');
    return info;
  }

  private attachStreams(child: ChildProcessWithoutNullStreams): void {
    this.stdoutReader = createInterface({ input: child.stdout });
    this.stdoutReader.on('line', line => this.handleLine(line));

    const stderrReader = createInterface({ input: child.stderr });
    stderrReader.on('line', line => {
      if (this.stderrLines.length >= MAX_STDERR_LINES) {
        this.stderrLines.shift();
      }
      this.stderrLines.push(line);
    });

    child.on('error', error => {
      this.failAll(error);
    });
    child.on('exit', (code, signal) => this.handleExit(code, signal));
  }

  private stderrSuffix(): string {
    const text = this.stderrLines.join('\n').trim();
    return text ? `\n${text}` : '';
  }

  private handleLine(line: string): void {
    const trimmed = line.trim();
    if (!trimmed) {
      return;
    }
    let raw: unknown;
    try {
      raw = JSON.parse(trimmed);
    } catch {
      // Anything non-JSON on stdout is a diagnostic; keep it out of the
      // protocol but make it available on failure.
      this.stderrLines.push(trimmed);
      return;
    }

    const message = raw as {
      type?: string;
      subtype?: string;
      session_id?: string;
      model?: string;
      tools?: string[];
      mcp_servers?: Array<{ name?: string; status?: string }>;
      request_id?: string;
      request?: Record<string, unknown>;
    };

    if (message.type === 'system' && message.subtype === 'init') {
      const info: WorkerInfo = {
        pid: this.child?.pid,
        sessionId: this.sessionId,
        cliSessionId: message.session_id ?? this.cliSessionId,
        model: message.model,
        tools: message.tools,
        serverNames: message.mcp_servers?.map(server => server.name ?? '') ?? [],
      };
      this.info = info;
      this.initDeferred.resolve(info);
      return;
    }

    if (message.type === 'control_request') {
      this.handleControlRequest(message);
      return;
    }

    const requestId = this.activeTurn?.requestId ?? '';
    const translation = this.translator.translate(raw, requestId);
    for (const event of translation.events) {
      if (event.type === 'usage') {
        this.lastUsage = event.data;
      }
      this.emit(event);
    }

    if (translation.result) {
      const result = translation.result;
      if (this.cancelled) {
        return;
      }
      this.emitStatus(result.isError ? 'error' : 'completed', requestId);
      this.settleTurn(result);
    }
  }

  private handleControlRequest(message: {
    request_id?: string;
    request?: Record<string, unknown>;
  }): void {
    const request = message.request;
    if (!request || request.subtype !== 'can_use_tool') {
      return;
    }
    const requestId = message.request_id;
    if (!requestId) {
      return;
    }
    const permission: PermissionRequest = {
      requestId,
      toolName: String(request.tool_name ?? 'tool'),
      input: (request.input as Record<string, unknown>) ?? {},
      toolUseId: String(request.tool_use_id ?? ''),
      suggestions: request.permission_suggestions as unknown[] | undefined,
      blockedPath: request.blocked_path as string | undefined,
      decisionReason: request.decision_reason,
    };
    this.pendingPermissions.set(requestId, permission);
    this.emit({ type: 'permission_request', request: permission });
  }

  /** Answer a `can_use_tool` request. Returns false if it is not pending. */
  respondPermission(
    requestId: string,
    decision: PermissionDecision,
  ): boolean {
    if (!this.pendingPermissions.delete(requestId)) {
      return false;
    }
    if (!this.child || this.child.exitCode !== null) {
      return false;
    }
    const response = {
      type: 'control_response',
      response: {
        subtype: 'success',
        request_id: requestId,
        response: decision,
      },
    };
    this.child.stdin.write(`${JSON.stringify(response)}\n`);
    return true;
  }

  get pendingPermissionIds(): string[] {
    return [...this.pendingPermissions.keys()];
  }

  /**
   * Send one user turn. The worker serialises turns: the panel API rejects a
   * second act while one is running, but the worker enforces it too.
   */
  sendTurn(
    input: string | unknown[],
    requestId: string = randomUUID(),
  ): Promise<TurnResult> {
    if (this.state !== 'ready') {
      return Promise.reject(
        new Error(`worker is not ready (${this.state})`),
      );
    }
    if (this.activeTurn) {
      return Promise.reject(
        new Error('A request is already running for this session'),
      );
    }

    const content =
      typeof input === 'string'
        ? [{ type: 'text', text: input }]
        : input;
    const line = {
      type: 'user',
      session_id: this.info?.cliSessionId ?? this.cliSessionId,
      message: { role: 'user', content },
      parent_tool_use_id: null,
    };

    this.cancelled = false;
    this.state = 'running';
    this.emitStatus('running', requestId);

    return new Promise<TurnResult>((resolve, reject) => {
      this.activeTurn = {
        requestId,
        startedAt: Date.now(),
        resolve,
        reject,
      };
      try {
        this.child!.stdin.write(`${JSON.stringify(line)}\n`);
      } catch (error) {
        this.activeTurn = null;
        this.state = 'ready';
        reject(error instanceof Error ? error : new Error(String(error)));
      }
    });
  }

  private settleTurn(result: TurnResult): void {
    const turn = this.activeTurn;
    if (!turn) {
      return;
    }
    this.activeTurn = null;
    this.state = 'ready';
    this.lastUsage = result.usage;
    turn.resolve(result);
  }

  /** Abort the in-flight turn by terminating the child. */
  async cancel(): Promise<boolean> {
    if (!this.activeTurn) {
      return false;
    }
    this.cancelled = true;
    const turn = this.activeTurn;
    this.activeTurn = null;
    this.emitStatus('cancelled', turn.requestId);
    turn.resolve({
      isError: false,
      cancelled: true,
      numTurns: 0,
      usage: {
        ...emptyUsage(this.sessionId, turn.requestId),
        durationMs: Date.now() - turn.startedAt,
      },
    });
    this.state = 'closing';
    this.terminate();
    return true;
  }

  /** Stop the worker if needed and wait for the child to exit. */
  async close(): Promise<void> {
    if (this.state === 'exited' || !this.child) {
      return;
    }
    this.cancelled = true;
    this.state = 'closing';
    this.terminate();
    await new Promise<void>(resolve => {
      if (!this.child || this.child.exitCode !== null) {
        resolve();
        return;
      }
      this.child.once('exit', () => resolve());
    });
  }

  private terminate(): void {
    const child = this.child;
    if (!child || child.exitCode !== null) {
      return;
    }
    try {
      child.kill('SIGTERM');
    } catch {
      // Already gone.
    }
    const grace = this.options.killGraceMs ?? 2_000;
    if (!this.killTimer) {
      this.killTimer = setTimeout(() => {
        if (child.exitCode === null) {
          try {
            child.kill('SIGKILL');
          } catch {
            // Already gone.
          }
        }
      }, grace);
    }
  }

  private failAll(error: Error): void {
    this.startup?.reject(error);
    const turn = this.activeTurn;
    this.activeTurn = null;
    turn?.reject(error);
  }

  private handleExit(code: number | null, signal: NodeJS.Signals | null): void {
    this.state = 'exited';
    if (this.killTimer) {
      clearTimeout(this.killTimer);
      this.killTimer = null;
    }
    this.stdoutReader?.close();
    this.stdoutReader = null;

    const suffix = this.stderrSuffix();
    const exitError = new Error(
      `CLI exited (code=${code ?? 'null'}, signal=${signal ?? 'null'})` + suffix,
    );
    this.startup?.reject(exitError);

    const turn = this.activeTurn;
    if (turn) {
      this.activeTurn = null;
      if (this.cancelled) {
        turn.resolve({
          isError: false,
          cancelled: true,
          numTurns: 0,
          usage: {
            ...emptyUsage(this.sessionId, turn.requestId),
            durationMs: Date.now() - turn.startedAt,
          },
        });
      } else {
        turn.reject(exitError);
      }
    }

    for (const requestId of [...this.pendingPermissions.keys()]) {
      this.pendingPermissions.delete(requestId);
    }
    // A clean shutdown is not an error; only surface abnormal exits.
    if (!this.cancelled && code !== 0) {
      this.emit({ type: 'error', error: exitError.message });
    }
  }

  /** Last usage observed (empty before the first `result`). */
  get usage(): AgentUsageStats {
    return this.lastUsage;
  }
}
