// src/process/processManager.ts
// Spawns and manages the GakrCLI CLI child process.
// Wires NdjsonTransport for communication, ControlRouter for control_request dispatch.
// Performs the initialize handshake on spawn.
//
// Process transport for GakrCLI stream-json sessions.

import { spawn, type ChildProcess } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import * as path from 'node:path';
import * as readline from 'node:readline';
import { NdjsonTransport } from './ndjsonTransport';
import { ControlRouter, type ControlRequestHandler } from './controlRouter';
import type { InitializeResponse } from '../types/protocol';
import type {
  SDKControlRequest,
  SDKControlCancelRequest,
  SDKKeepAliveMessage,
  StdoutMessage,
} from '../types/messages';
import type { PermissionMode } from '../types/session';

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
  /** Working directory for the CLI */
  cwd: string;
  /** Path to the gakrcli executable (default: 'gakrcli') */
  executable?: string;
  /** Arguments that must appear before the GakrCLI runtime flags, e.g. dist/cli.mjs for node. */
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
  /** IDE MCP server to pass to GakrCLI's headless MCP loader. */
  ideMcpServer?: {
    port: number;
    ideName?: string;
  };
  /** Fork session from a checkpoint UUID (used with sessionId) */
  forkSession?: boolean;
  /** Worktree name to pass as --worktree flag */
  worktree?: string;
  /** Additional environment variables */
  env?: Record<string, string>;
  /** Initialize request options */
  promptSuggestions?: boolean;
  agentProgressSummaries?: boolean;
  /** Auto-restart on crash */
  autoRestart?: boolean;
  /** Keep-alive interval in ms (default: 30000) */
  keepAliveIntervalMs?: number;
  /** SDK-owned MCP server names to advertise during initialize. */
  sdkMcpServers?: string[];
}

type MessageCallback = (message: StdoutMessage) => void;
type ErrorCallback = (error: Error) => void;
type ExitCallback = (code: number | null, signal: string | null) => void;
type StderrCallback = (line: string) => void;
type StateCallback = (state: ProcessState) => void;

interface SpawnCommand {
  executable: string;
  args: string[];
}

function isBareWindowsCommand(executable: string): boolean {
  return !/[\\/]/.test(executable) && path.win32.extname(executable) === '';
}

function isWindowsBatchWrapper(executable: string): boolean {
  const ext = path.win32.extname(executable).toLowerCase();
  return ext === '.cmd' || ext === '.bat';
}

function quoteForWindowsCmd(arg: string): string {
  if (arg.length === 0) {
    return '""';
  }

  if (!/[\s"&()<>^|]/.test(arg)) {
    return arg;
  }

  return `"${arg.replace(/"/g, '""')}"`;
}

function resolveSpawnCommand(executable: string, args: string[]): SpawnCommand {
  if (
    process.platform === 'win32' &&
    (isBareWindowsCommand(executable) || isWindowsBatchWrapper(executable))
  ) {
    // npm installs `gakrcli` on Windows as a `.cmd` shim, which must be
    // launched through `cmd.exe` for PATH/PATHEXT resolution to work reliably.
    return {
      executable: process.env.ComSpec?.trim() || 'cmd.exe',
      args: [
        '/d',
        '/s',
        '/c',
        [executable, ...args].map(quoteForWindowsCmd).join(' '),
      ],
    };
  }

  return { executable, args };
}

// ============================================================================
// ProcessManager
// ============================================================================

export class ProcessManager {
  private options: ProcessManagerOptions;
  private process: ChildProcess | undefined;
  private transport: NdjsonTransport | undefined;
  private router: ControlRouter | undefined;
  private stderrRl: readline.Interface | undefined;
  private keepAliveTimer: ReturnType<typeof setInterval> | undefined;
  private tempMcpConfigDir: string | undefined;
  private stderrTail: string[] = [];

  private _state: ProcessState = ProcessState.Idle;
  private _sessionId: string | undefined;
  private _initializeResponse: InitializeResponse | undefined;

  // Pending initialize handshake resolution
  private pendingInitResolve:
    | ((response: InitializeResponse) => void)
    | undefined;
  private pendingInitReject: ((error: Error) => void) | undefined;
  private initRequestId: string | undefined;
  private initTimer: ReturnType<typeof setTimeout> | undefined;
  private intentionalShutdown = false;

  // Callbacks
  private messageCallbacks: MessageCallback[] = [];
  private errorCallbacks: ErrorCallback[] = [];
  private exitCallbacks: ExitCallback[] = [];
  private stderrCallbacks: StderrCallback[] = [];
  private stateCallbacks: StateCallback[] = [];
  private controlHandlers = new Map<string, ControlRequestHandler>();

  constructor(options: ProcessManagerOptions) {
    this.options = options;
  }

  // ============================================================================
  // Public API
  // ============================================================================

  get state(): ProcessState {
    return this._state;
  }

  get sessionId(): string | undefined {
    return this._sessionId;
  }

  get initializeResponse(): InitializeResponse | undefined {
    return this._initializeResponse;
  }

  /** Get the current NDJSON transport (available after spawn). */
  get ndjsonTransport(): NdjsonTransport | undefined {
    return this.transport;
  }

  /**
   * Spawn the CLI process and perform the initialize handshake.
   * Returns the InitializeResponse on success.
   */
  spawn(): Promise<InitializeResponse> | void {
    if (this._state !== ProcessState.Idle && this._state !== ProcessState.Restarting) {
      return;
    }

    this.setState(ProcessState.Spawning);
    this.intentionalShutdown = false;
    this.stderrTail = [];

    const executable = (this.options.executable ?? 'gakrcli').trim() || 'gakrcli';
    const args = [...(this.options.executableArgs ?? []), ...this.buildArgs()];
    const env = this.buildEnv();
    const spawnCommand = resolveSpawnCommand(executable, args);

    try {
      this.process = spawn(spawnCommand.executable, spawnCommand.args, {
        cwd: this.options.cwd,
        stdio: ['pipe', 'pipe', 'pipe'],
        env,
        windowsHide: true,
        shell: false,
      });
    } catch (err) {
      this.setState(ProcessState.Idle);
      this.cleanupTempMcpConfig();
      const error =
        err instanceof Error ? err : new Error(String(err));
      this.emitError(error);
      return;
    }

    // Wire up transport
    if (this.process.stdout && this.process.stdin) {
      this.transport = new NdjsonTransport(
        this.process.stdout,
        this.process.stdin,
      );

      // Create router that writes through transport
      this.router = new ControlRouter((msg) => this.transport?.write(msg));
      for (const [subtype, handler] of this.controlHandlers) {
        this.router.registerHandler(subtype, handler);
      }

      // Handle parsed messages from stdout
      this.transport.onMessage((msg) => this.handleMessage(msg as StdoutMessage));
      this.transport.onError((err) => this.emitError(err));
      this.transport.onClose(() => {
        // Stream closed — process is exiting
      });
    }

    // Wire up stderr for debug logging
    if (this.process.stderr) {
      this.stderrRl = readline.createInterface({
        input: this.process.stderr,
      });
      this.stderrRl.on('line', (line) => {
        this.recordStderrLine(line);
        for (const cb of this.stderrCallbacks) {
          cb(line);
        }
      });
    }

    // Handle process lifecycle
    this.process.on('error', (err) => {
      this.setState(ProcessState.Idle);
      this.emitError(err);
      this.rejectPendingInitialize(err);
    });

    this.process.on('exit', (code, signal) => {
      if (this.intentionalShutdown) {
        this.clearPendingInitialize();
      } else {
        this.rejectPendingInitialize(
          new Error(this.formatEarlyExitError(code, signal)),
        );
      }
      this.cleanup();
      this.setState(ProcessState.Idle);

      for (const cb of this.exitCallbacks) {
        cb(code, signal);
      }

      // Auto-restart on non-zero exit if enabled
      if (
        this.options.autoRestart &&
        code !== 0 &&
        code !== null &&
        this._sessionId
      ) {
        this.restartWithResume();
      }
    });

    // Send initialize handshake
    this.setState(ProcessState.Initializing);
    return this.sendInitialize();
  }

  /**
   * Write a message to the CLI's stdin via the transport.
   */
  write(message: unknown): void {
    this.transport?.write(message);
  }

  /**
   * Send a control_request to the CLI and return a promise for the response.
   */
  async sendControlRequest(
    request: Record<string, unknown>,
  ): Promise<Record<string, unknown> | undefined> {
    const requestId = this.generateRequestId();
    const envelope = {
      type: 'control_request',
      request_id: requestId,
      request,
    };

    return new Promise((resolve, reject) => {
      // Store resolver indexed by request_id so handleMessage can resolve it
      this.pendingControlRequests.set(requestId, { resolve, reject });
      this.transport?.write(envelope);
    });
  }

  private pendingControlRequests = new Map<
    string,
    {
      resolve: (response: Record<string, unknown> | undefined) => void;
      reject: (error: Error) => void;
    }
  >();

  /**
   * Register a handler for an incoming control_request subtype from the CLI.
   */
  registerControlHandler(
    subtype: string,
    handler: ControlRequestHandler,
  ): void {
    this.controlHandlers.set(subtype, handler);
    this.router?.registerHandler(subtype, handler);
  }

  /**
   * Kill the CLI process.
   */
  kill(signal: NodeJS.Signals = 'SIGTERM'): void {
    if (this.process && !this.process.killed) {
      if (this.pendingInitReject) {
        this.intentionalShutdown = true;
      }
      this.process.kill(signal);
    }
  }

  /**
   * Clean up all resources.
   */
  dispose(): void {
    this.intentionalShutdown = true;
    this.stopKeepAlive();
    this.kill();
    this.transport?.dispose();
    this.router?.dispose();
    this.stderrRl?.close();
    this.messageCallbacks = [];
    this.errorCallbacks = [];
    this.exitCallbacks = [];
    this.stderrCallbacks = [];
    this.stateCallbacks = [];
    this.controlHandlers.clear();
    this.cleanupTempMcpConfig();
  }

  // ============================================================================
  // Event Registration
  // ============================================================================

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

  // ============================================================================
  // Private Methods
  // ============================================================================

  private buildArgs(): string[] {
    const args: string[] = [
      '--print',
      '--output-format',
      'stream-json',
      '--verbose',
      '--input-format',
      'stream-json',
      '--include-partial-messages',
      '--permission-prompt-tool',
      'stdio',
    ];

    if (this.options.model) {
      args.push('--model', this.options.model);
    }

    if (this.options.permissionMode) {
      args.push('--permission-mode', this.options.permissionMode);
    }

    if (this.options.allowDangerouslySkipPermissions) {
      args.push('--allow-dangerously-skip-permissions');
    }

    if (this.options.sessionId) {
      args.push('--resume', this.options.sessionId);
    }

    // Fork session: spawn from a checkpoint message UUID
    if (this.options.forkSession) {
      args.push('--fork-session');
    }

    if (this.options.continueSession) {
      args.push('--continue');
    }

    if (this.options.worktree) {
      args.push('--worktree', this.options.worktree);
    }

    if (this.options.ideMcpServer) {
      args.push('--mcp-config', this.writeIdeMcpConfigFile());
    }

    return args;
  }

  private buildEnv(): NodeJS.ProcessEnv {
    const env: NodeJS.ProcessEnv = { ...process.env };

    // Merge custom env vars
    if (this.options.env) {
      Object.assign(env, this.options.env);
    }

    // Set GakrCLI launch markers for provider/session diagnostics.
    if (!env.GAKR_CODE_ENTRYPOINT) {
      env.GAKR_CODE_ENTRYPOINT = 'gakrcli-vscode';
    }
    if (!env.GAKR_CODE_ENVIRONMENT_KIND) {
      env.GAKR_CODE_ENVIRONMENT_KIND = 'vscode';
    }

    // Remove NODE_OPTIONS to avoid runtime flag conflicts in the child process.
    delete env.NODE_OPTIONS;

    return env;
  }

  private sendInitialize(): Promise<InitializeResponse> {
    return new Promise<InitializeResponse>((resolve, reject) => {
      this.pendingInitResolve = resolve;
      this.pendingInitReject = reject;

      this.initRequestId = this.generateRequestId();

      const initRequest = {
        type: 'control_request',
        request_id: this.initRequestId,
        request: {
          subtype: 'initialize',
          hooks: {},
          sdkMcpServers: this.options.sdkMcpServers ?? [],
          promptSuggestions: this.options.promptSuggestions ?? true,
          agentProgressSummaries: this.options.agentProgressSummaries ?? true,
        },
      };

      this.transport?.write(initRequest);
      this.initTimer = setTimeout(() => {
        this.rejectPendingInitialize(
          new Error('GakrCLI did not respond to initialize within 15000ms'),
        );
      }, 15_000);
    });
  }

  private handleMessage(message: StdoutMessage): void {
    // Handle control_response (may be initialize response or response to our requests)
    if (message.type === 'control_response') {
      const response = message.response;
      const requestId = response.request_id;

      // Check if this is the initialize response
      if (requestId === this.initRequestId && this.pendingInitResolve) {
        this.clearInitializeTimer();
        if (response.subtype === 'success') {
          const initResponse = response.response as unknown as InitializeResponse;
          this._initializeResponse = initResponse;
          const sessionId =
            (initResponse as Record<string, unknown>).session_id ??
            (initResponse as Record<string, unknown>).sessionId;
          if (typeof sessionId === 'string') {
            this._sessionId = sessionId;
          }
          this.setState(ProcessState.Ready);
          this.startKeepAlive();
          this.pendingInitResolve(initResponse);
        } else {
          this.pendingInitReject?.(
            new Error(`Initialize failed: ${response.error}`),
          );
        }
        this.pendingInitResolve = undefined;
        this.pendingInitReject = undefined;
        this.initRequestId = undefined;
        return;
      }

      // Check if it matches a pending control request
      const pending = this.pendingControlRequests.get(requestId);
      if (pending) {
        this.pendingControlRequests.delete(requestId);
        if (response.subtype === 'success') {
          pending.resolve(response.response);
        } else {
          pending.reject(new Error(response.error));
        }
        return;
      }
    }

    // Handle incoming control_request from CLI (permission, elicitation, etc.)
    if (message.type === 'control_request') {
      for (const cb of this.messageCallbacks) {
        cb(message);
      }
      this.router?.handleControlRequest(message as SDKControlRequest);
      return;
    }

    // Handle cancel requests
    if (message.type === 'control_cancel_request') {
      for (const cb of this.messageCallbacks) {
        cb(message);
      }
      this.router?.handleControlCancelRequest(
        message as SDKControlCancelRequest,
      );
      return;
    }

    // Handle keep_alive (no-op, just acknowledge receipt)
    if (message.type === 'keep_alive') {
      return;
    }

    // Extract session_id from messages that carry it
    if ('session_id' in message && typeof (message as Record<string, unknown>).session_id === 'string') {
      this._sessionId = (message as Record<string, unknown>).session_id as string;
    }

    // Forward all other messages to listeners
    for (const cb of this.messageCallbacks) {
      cb(message);
    }
  }

  private startKeepAlive(): void {
    const interval = this.options.keepAliveIntervalMs ?? 30_000;
    this.keepAliveTimer = setInterval(() => {
      this.transport?.write({ type: 'keep_alive' } satisfies SDKKeepAliveMessage);
    }, interval);
  }

  private stopKeepAlive(): void {
    if (this.keepAliveTimer) {
      clearInterval(this.keepAliveTimer);
      this.keepAliveTimer = undefined;
    }
  }

  private clearInitializeTimer(): void {
    if (this.initTimer) {
      clearTimeout(this.initTimer);
      this.initTimer = undefined;
    }
  }

  private rejectPendingInitialize(error: Error): void {
    if (!this.pendingInitReject) {
      return;
    }
    this.clearInitializeTimer();
    this.pendingInitReject(error);
    this.pendingInitResolve = undefined;
    this.pendingInitReject = undefined;
    this.initRequestId = undefined;
  }

  private clearPendingInitialize(): void {
    this.clearInitializeTimer();
    this.pendingInitResolve = undefined;
    this.pendingInitReject = undefined;
    this.initRequestId = undefined;
  }

  private restartWithResume(): void {
    this.setState(ProcessState.Restarting);

    // Update options to resume the session
    if (this._sessionId) {
      this.options = { ...this.options, sessionId: this._sessionId };
    }

    // Delay slightly before restart to avoid tight restart loops
    setTimeout(() => {
      this.spawn();
    }, 1000);
  }

  private cleanup(): void {
    this.stopKeepAlive();
    this.clearInitializeTimer();
    this.transport?.dispose();
    this.transport = undefined;
    this.router?.dispose();
    this.router = undefined;
    this.stderrRl?.close();
    this.stderrRl = undefined;
    this.process = undefined;
    this.cleanupTempMcpConfig();
  }

  private writeIdeMcpConfigFile(): string {
    this.cleanupTempMcpConfig();
    const dir = mkdtempSync(path.join(tmpdir(), 'gakrcli-vscode-mcp-'));
    const file = path.join(dir, 'mcp-config.json');
    const config = {
      mcpServers: {
        ide: {
          type: 'sse-ide',
          url: `http://127.0.0.1:${this.options.ideMcpServer!.port}/sse`,
          ideName: this.options.ideMcpServer!.ideName ?? 'VS Code',
        },
      },
    };
    writeFileSync(file, JSON.stringify(config), 'utf8');
    this.tempMcpConfigDir = dir;
    return file;
  }

  private cleanupTempMcpConfig(): void {
    if (!this.tempMcpConfigDir) {
      return;
    }
    rmSync(this.tempMcpConfigDir, { recursive: true, force: true });
    this.tempMcpConfigDir = undefined;
  }

  private recordStderrLine(line: string): void {
    this.stderrTail.push(line);
    if (this.stderrTail.length > 20) {
      this.stderrTail.shift();
    }
  }

  private formatEarlyExitError(code: number | null, signal: string | null): string {
    const base = `GakrCLI exited before initialize completed: code=${code}, signal=${signal}`;
    if (this.stderrTail.length === 0) {
      return base;
    }
    return `${base}. stderr:\n${this.stderrTail.join('\n')}`;
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

  private generateRequestId(): string {
    return Math.random().toString(36).substring(2, 15);
  }
}
