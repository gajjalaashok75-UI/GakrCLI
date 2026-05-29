import * as vscode from 'vscode';
import * as path from 'node:path';
import { WebviewManager } from './webview/webviewManager';
import { GakrCLIWebviewProvider, GakrCLIPanelSerializer } from './webview/webviewProvider';
import { ProcessManager, ProcessState } from './process/processManager';
import { SELF_HANDLED } from './process/controlRouter';
import { createDiffContentProviders } from './diff/diffContentProvider';
import { DiffManager } from './diff/diffManager';
import { createCanUseToolHandler } from './diff/diffHandler';
import { PermissionRules } from './permissions/permissionRules';
import { PermissionHandler } from './permissions/permissionHandler';
import { SessionTracker } from './session/sessionTracker';
import { SessionsViewProvider } from './session/sessionsViewProvider';
import { StatusBarManager } from './statusbar/statusBarManager';
import { TerminalManager } from './commands/terminalManager';
import { CheckpointManager } from './checkpoint/checkpointManager';
import type { RewindFilesResponse } from './checkpoint/checkpointManager';
import { AuthManager } from './auth/authManager';
import { SettingsSync } from './settings/settingsSync';
import { loadProfileFile } from './settings/profileFile';
import { resolveCliLaunchCommand } from './settings/cliExecutable';
import { McpIdeServer } from './mcp/mcpIdeServer';
import { buildToggleRequest, buildInstallCommand, buildReloadRequest } from './plugins/pluginBridge';
import { WorktreeManager } from './worktree/worktreeManager';
import { parseGakrCLIUri } from './uriHandler';
import { AtMentionProvider } from './mentions/atMentionProvider';

let webviewManager: WebviewManager | undefined;
let diffManagerInstance: DiffManager | undefined;

/** Get the active DiffManager instance (available after activation). */
export function getDiffManager(): DiffManager | undefined {
  return diffManagerInstance;
}

export function activate(context: vscode.ExtensionContext) {
  const output = vscode.window.createOutputChannel('GakrCLI', { log: true });
  context.subscriptions.push(output);

  output.info('GakrCLI VS Code extension activated');

  // === Diff system: register URI schemes and create DiffManager ===
  const { original, proposed, disposables: diffProviderDisposables } =
    createDiffContentProviders();
  context.subscriptions.push(...diffProviderDisposables);

  const diffManager = new DiffManager(original, proposed, output);
  context.subscriptions.push(diffManager);
  diffManagerInstance = diffManager;

  // Create the WebviewManager — central orchestrator for all panels
  webviewManager = new WebviewManager(context.extensionUri, context, output);
  context.subscriptions.push(webviewManager);

  // === Permission system: create rules store and handler ===
  const permissionRules = new PermissionRules(context);
  const permissionHandler = new PermissionHandler(webviewManager, permissionRules, output);
  context.subscriptions.push(permissionHandler);

  const provider = new GakrCLIWebviewProvider(webviewManager);

  // === Session management: create tracker and initialize ===
  const sessionTracker = new SessionTracker();
  context.subscriptions.push(sessionTracker);
  // Initialize asynchronously (scan files + start watcher)
  sessionTracker.initialize().then(() => {
    output.info(`[GakrCLI] SessionTracker initialized, found ${sessionTracker.getSessionList().length} sessions`);
  });

  // Broadcast session changes to all webviews
  sessionTracker.onSessionsChanged(() => {
    const grouped = sessionTracker.getGroupedSessions();
    webviewManager!.broadcast({
      type: 'sessionsData',
      grouped: grouped.map((g) => ({
        group: g.group,
        sessions: g.sessions.map((s) => ({
          id: s.id,
          title: s.title,
          model: s.model,
          timestamp: s.timestamp.toISOString(),
          createdAt: s.createdAt.toISOString(),
          messageCount: s.messageCount,
          cwd: s.cwd,
          gitBranch: s.gitBranch,
        })),
      })),
    } as never);
  });

  // Check if secondary sidebar is supported (VS Code 1.106+)
  const [major, minor] = vscode.version.split('.').map(Number);
  const supportsSecondarySidebar = major > 1 || (major === 1 && minor >= 106);

  if (!supportsSecondarySidebar) {
    vscode.commands.executeCommand(
      'setContext',
      'gakrcli:doesNotSupportSecondarySidebar',
      true,
    );
  }

  // Register sidebar webview providers
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider('gakrcliSidebar', provider, {
      webviewOptions: { retainContextWhenHidden: true },
    }),
  );
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider('gakrcliSidebarSecondary', provider, {
      webviewOptions: { retainContextWhenHidden: true },
    }),
  );

  // Register session list sidebar view with SessionsViewProvider
  const sessionsViewProvider = new SessionsViewProvider(context.extensionUri, sessionTracker);
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(
      SessionsViewProvider.viewType,
      sessionsViewProvider,
    ),
  );

  // Register panel serializer for restoring panels across VS Code restarts
  context.subscriptions.push(
    vscode.window.registerWebviewPanelSerializer(
      'gakrcliPanel',
      new GakrCLIPanelSerializer(webviewManager),
    ),
  );

  // Track preferred location (sidebar vs panel)
  let preferredLocation: 'sidebar' | 'panel' = 'panel';

  // Status bar manager (idle / pending-permission / completed-while-hidden)
  const statusBarManager = new StatusBarManager();
  context.subscriptions.push(statusBarManager);

  // Terminal manager for terminal mode
  const terminalManager = new TerminalManager(context.extensionPath);
  context.subscriptions.push(terminalManager);

  // === Checkpoint manager (Story 10) ===
  const checkpointManager = new CheckpointManager();

  // === Auth / provider manager (Story 11) ===
  const settingsSync = new SettingsSync();
  const extensionWorkspaceFolder = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || process.cwd();
  const authManager = new AuthManager(
    settingsSync,
    () => loadProfileFile({ cwd: extensionWorkspaceFolder }),
  );

  // === MCP IDE Server (Story 12) ===
  const mcpWorkspaceFolder = extensionWorkspaceFolder;
  const mcpIdeServer = new McpIdeServer(mcpWorkspaceFolder);
  mcpIdeServer.start().then(({ port }) => {
    output.info(`[GakrCLI] MCP IDE server running on port ${port}`);
    context.environmentVariableCollection.replace('GAKR_CODE_SSE_PORT', String(port));
    context.environmentVariableCollection.replace('GAKR_CODE_IDE_NAME', 'VS Code');
  }).catch((err: Error) => {
    output.warn(`[GakrCLI] Failed to start MCP IDE server: ${err.message}`);
  });
  context.subscriptions.push({
    dispose: () => context.environmentVariableCollection.clear(),
  });
  context.subscriptions.push(mcpIdeServer);

  // === Worktree manager (Story 14) ===
  const worktreeManager = new WorktreeManager();
  context.subscriptions.push(worktreeManager);

  // === @-mention provider (Story 5) ===
  const atMentionProvider = new AtMentionProvider();
  context.subscriptions.push(atMentionProvider);

  if (preferredLocation === 'sidebar' && supportsSecondarySidebar) {
    statusBarManager.show();
  }

  // ==========================================
  // ProcessManager — spawned on first user message
  // ==========================================
  let processManager: ProcessManager | undefined;
  let isSpawning = false;
  let crashRestartCount = 0;
  let lastCrashTime = 0;
  let currentSessionId: string | undefined;

  /** Map effort level string to max_thinking_tokens value */
  function effortToTokens(level: string): number | null {
    switch (level) {
      case 'low': return 1000;
      case 'medium': return 8000;
      case 'high': return 16000;
      case 'max': return null;
      default: return null;
    }
  }

  function getActiveEditorMention(): string | undefined {
    const editor = vscode.window.activeTextEditor;
    if (!editor) return undefined;

    const doc = editor.document;
    const relativePath = vscode.workspace.asRelativePath(doc.fileName);
    const selection = editor.selection;
    if (selection.isEmpty) {
      return `@${relativePath}`;
    }

    const startLine = selection.start.line + 1;
    const endLine = selection.end.line + 1;
    return startLine !== endLine
      ? `@${relativePath}#${startLine}-${endLine}`
      : `@${relativePath}#${startLine}`;
  }

  function providerStatePayload(error?: string) {
    const providers = authManager.getAvailableProviders();
    const current = authManager.getCurrentProvider();
    return {
      type: 'provider_state',
      providers: providers.map((p) => ({
        id: p.id,
        label: p.label,
        requiresApiKey: p.requiresApiKey,
        requiresBaseUrl: p.requiresBaseUrl,
        supportsModel: p.supportsModel,
        defaultBaseUrl: p.defaultBaseUrl,
      })),
      currentProviderId: current.id,
      currentModel: current.model,
      currentBaseUrl:
        settingsSync.baseUrl ??
        current.env.OPENAI_BASE_URL ??
        current.env.ANTHROPIC_BASE_URL ??
        current.env.GEMINI_BASE_URL ??
        current.env.MISTRAL_BASE_URL,
      models: current.modelOptions,
      ...(error ? { error } : {}),
    };
  }

  async function providerStatePayloadWithDiscoveredModels(error?: string) {
    const payload = providerStatePayload(error);
    try {
      const models = await authManager.discoverCurrentProviderModels();
      return {
        ...payload,
        models,
      };
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err);
      output.warn(`[GakrCLI] Failed to discover provider models: ${detail}`);
      return payload;
    }
  }

  async function sendProviderState(panelId?: string, error?: string) {
    const immediate = providerStatePayload(error);
    if (panelId) {
      webviewManager!.sendToPanel(panelId, immediate as never);
    } else {
      webviewManager!.broadcast(immediate as never);
    }

    const discovered = await providerStatePayloadWithDiscoveredModels(error);
    if (JSON.stringify(discovered.models ?? []) === JSON.stringify(immediate.models ?? [])) {
      return;
    }
    if (panelId) {
      webviewManager!.sendToPanel(panelId, discovered as never);
    } else {
      webviewManager!.broadcast(discovered as never);
    }
  }

  /**
   * Ensure the CLI process is running. Spawns it if not already started.
   * Returns the ProcessManager instance.
   */
  async function ensureProcess(options: { sessionId?: string } = {}): Promise<ProcessManager | undefined> {
    if (processManager && processManager.state === ProcessState.Ready) {
      return processManager;
    }
    if (isSpawning) {
      // Wait for the in-flight spawn
      return new Promise((resolve) => {
        const check = setInterval(() => {
          if (!isSpawning) {
            clearInterval(check);
            resolve(processManager);
          }
        }, 100);
      });
    }

    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) {
      vscode.window.showErrorMessage('GakrCLI: No workspace folder open');
      return undefined;
    }

    isSpawning = true;
    webviewManager!.broadcast({ type: 'process_state', state: 'starting' });

    const config = vscode.workspace.getConfiguration('gakrcliCode');
    const launchCommand = resolveCliLaunchCommand(config, {
      workspaceFolder: workspaceFolder.uri.fsPath,
      extensionPath: context.extensionPath,
    });
    // Use the permission handler's current mode (reflects user's UI selection),
    // falling back to the config default only on first launch
    const handlerMode = permissionHandler.getMode();
    const permissionMode = (handlerMode !== 'default'
      ? handlerMode
      : config.get<string>('initialPermissionMode')) as
      | 'default' | 'acceptEdits' | 'plan' | 'bypassPermissions' | 'dontAsk' | undefined;
    const allowDangerouslySkipPermissions =
      config.get<boolean>('allowDangerouslySkipPermissions', false) ||
      permissionMode === 'bypassPermissions';

    // Use AuthManager to build env vars (merges provider env + user env vars)
    const env = authManager.buildProcessEnv();
    const model = authManager.getCurrentProvider().model;
    const ideServerMeta = mcpIdeServer.getServerMetadata();

    processManager = new ProcessManager({
      cwd: workspaceFolder.uri.fsPath,
      executable: launchCommand.executable,
      executableArgs: launchCommand.args,
      model,
      permissionMode,
      allowDangerouslySkipPermissions,
      sessionId: options.sessionId,
      env,
      ideMcpServer: ideServerMeta ? { port: ideServerMeta.port, ideName: 'VS Code' } : undefined,
    });
    // Register diff handler for can_use_tool requests (with permission handler for non-file-edit tools)
    processManager.registerControlHandler(
      'can_use_tool',
      createCanUseToolHandler(
        diffManager,
        () => processManager?.ndjsonTransport,
        output,
        permissionHandler,
      ),
    );

    // Register set_permission_mode handler
    processManager.registerControlHandler(
      'set_permission_mode',
      async (request) => {
        const modeRequest = request as import('./types/messages').ControlRequestSetPermissionMode;
        return permissionHandler.handleSetPermissionMode(modeRequest);
      },
    );

    // Register elicitation handler — forward to webview as show_elicitation
    processManager.registerControlHandler(
      'elicitation',
      async (request, signal, requestId) => {
        const req = request as Record<string, unknown>;
        webviewManager!.broadcast({
          type: 'show_elicitation',
          requestId,
          message: req.message,
          fields: (req.fields as unknown[]) ?? [],
        } as never);
        // Response is sent asynchronously when user submits/cancels the dialog
        return SELF_HANDLED;
      },
    );

    // Wire permissionHandler's writeToStdin to the transport
    permissionHandler.setWriteToStdin((msg) => processManager?.ndjsonTransport?.write(msg));

    // Forward ALL CLI messages to the webview
    processManager.onMessage((msg) => {
      output.info(`[CLI→Webview] ${JSON.stringify(msg).substring(0, 300)}`);
      webviewManager!.broadcast({ type: 'cli_output', data: msg });

      const msgObj = msg as Record<string, unknown>;
      if (msgObj.type === 'control_request') {
        const req = msgObj.request as Record<string, unknown> | undefined;
        if (req?.subtype === 'can_use_tool') {
          statusBarManager.setPendingPermission(true);
        }
      }
      if (msgObj.type === 'control_cancel_request' && typeof msgObj.request_id === 'string') {
        permissionHandler.handleCancel(msgObj.request_id);
        statusBarManager.setPendingPermission(false);
      }

      // StatusBar: detect result while panel is hidden → orange dot
      if (msgObj.type === 'result' || msgObj.subtype === 'result') {
        if (!webviewManager!.hasVisibleWebview()) {
          statusBarManager.setCompletedWhileHidden(true);
        }
      }

      // Track session ID for auto-restart
      if (typeof msgObj.session_id === 'string') {
        currentSessionId = msgObj.session_id;
      }

      // ai-title: update session tracker so the session list shows the new title
      if (msgObj.type === 'system' && msgObj.subtype === 'ai-title' && typeof msgObj.title === 'string' && typeof msgObj.session_id === 'string') {
        sessionTracker.updateSessionTitle(msgObj.session_id, msgObj.title);
      }

      // --- Checkpoint tracking (Story 10) ---
      if (msgObj.type === 'assistant' && typeof msgObj.uuid === 'string' && typeof msgObj.session_id === 'string') {
        checkpointManager.registerAssistantMessage(msgObj.uuid, msgObj.session_id);
        webviewManager!.broadcast({
          type: 'checkpoint_state',
          checkpoints: checkpointManager.getWebviewState(),
        });
      }

      if (msgObj.type === 'system' && msgObj.subtype === 'files_persisted' && typeof msgObj.uuid === 'string') {
        const files = (msgObj.files as Array<{ filename: string; file_id: string }>) ?? [];
        checkpointManager.markFilesPersisted(msgObj.uuid, files);
        webviewManager!.broadcast({
          type: 'checkpoint_state',
          checkpoints: checkpointManager.getWebviewState(),
        });
      }

      if (msgObj.type === 'system' && msgObj.subtype === 'session_state_changed') {
        const state = msgObj.state as 'idle' | 'running' | 'requires_action';
        const sessionId = msgObj.session_id as string;
        if (state && sessionId) {
          checkpointManager.handleSessionStateChanged(state, sessionId);
        }
      }
    });

    processManager.onError((err) => {
      output.error(`[GakrCLI] Error: ${err.message}`);
      webviewManager!.broadcast({ type: 'process_state', state: 'crashed' });
    });

    processManager.onExit((code, signal) => {
      output.info(`[GakrCLI] CLI exited: code=${code}, signal=${signal}`);
      isSpawning = false;

      // Auto-restart on non-zero exit if we have a session to resume
      if (code !== 0 && code !== null && currentSessionId) {
        const now = Date.now();
        if (now - lastCrashTime > 30_000) {
          crashRestartCount = 0;
        }
        crashRestartCount++;
        lastCrashTime = now;

        if (crashRestartCount <= 3) {
          output.warn(`[GakrCLI] CLI crashed (attempt ${crashRestartCount}/3), restarting with --resume...`);
          webviewManager!.broadcast({ type: 'process_state', state: 'restarting' as never });
          setTimeout(async () => {
            processManager = undefined;
            await ensureProcess({ sessionId: currentSessionId });
          }, 1000);
          return;
        } else {
          output.error('[GakrCLI] CLI crashed too many times, giving up.');
          vscode.window.showErrorMessage('GakrCLI: CLI crashed repeatedly. Check the Output panel for logs.');
        }
      }

      webviewManager!.broadcast({ type: 'process_state', state: 'stopped' });
    });

    processManager.onStateChange((state) => {
      output.info(`[GakrCLI] State: ${state}`);
      if (state === ProcessState.Ready) {
        webviewManager!.broadcast({ type: 'process_state', state: 'running' });
      }
    });

    processManager.onStderr((line) => {
      output.warn(`[CLI stderr] ${line}`);
    });

    try {
      const response = await processManager.spawn();
      isSpawning = false;
      if (response) {
        // The response might be the InitializeResponse directly, or nested under .response
        const resp = response as Record<string, unknown>;
        const initData = (resp.response && typeof resp.response === 'object')
          ? resp.response as Record<string, unknown>  // double-nested: response.response
          : resp;                                      // direct: response itself

        output.info(`[GakrCLI] Connected! Init response keys: ${Object.keys(initData).join(', ')}`);

        // Broadcast slash commands to webview — ALWAYS broadcast (even if empty, for debugging)
        const commands = Array.isArray(initData.commands)
          ? initData.commands
          : Array.isArray(initData.slash_commands)
            ? initData.slash_commands
            : [];
        webviewManager!.broadcast({
          type: 'slash_commands_available',
          commands: commands.map((c: string | Record<string, unknown>) => ({
            name: typeof c === 'string' ? c : (c.name as string) || (c.command as string) || '',
            description: typeof c === 'string' ? '' : (c.description as string) || '',
            argumentHint:
              typeof c === 'string'
                ? ''
                : (c.argument_hint as string) || (c.argumentHint as string) || (c.args as string) || '',
          })),
        } as never);
        output.info(`[GakrCLI] Broadcast ${commands.length} slash commands`);

        // Broadcast a synthetic system/init — ALWAYS broadcast so webview gets models + fast_mode_state
        const models = Array.isArray(initData.models) ? initData.models : [];
        const fastModeState = initData.fast_mode_state ?? { enabled: false, canToggle: true };
        const account = initData.account as Record<string, unknown> | undefined;
        const permMode = initData.permission_mode ?? initData.permissionMode ?? permissionHandler.getMode();
        webviewManager!.broadcast({
          type: 'cli_output',
          data: {
            type: 'system',
            subtype: 'init',
            session_id: processManager.sessionId ?? '',
            model: typeof initData.model === 'string' ? initData.model : '',
            models: models,
            fast_mode_state: fastModeState,
            permissionMode: permMode,
            account: account ?? {},
          },
          } as never);
        output.info(`[GakrCLI] Broadcast init with ${models.length} models, permissionMode=${permMode}`);
      }
      return processManager;
    } catch (err) {
      isSpawning = false;
      const msg = err instanceof Error ? err.message : String(err);
      output.error(`[GakrCLI] Failed to start: ${msg}`);
      vscode.window.showErrorMessage(`GakrCLI failed to start: ${msg}`);
      webviewManager!.broadcast({ type: 'process_state', state: 'crashed' });
      return undefined;
    }
  }

  // ==========================================
  // Wire webview messages to ProcessManager
  // ==========================================

  // Handle user sending a prompt
  webviewManager.onMessage('send_prompt', async (message) => {
    output.info(`[Webview→CLI] send_prompt: ${message.text.substring(0, 100)}`);
    const trimmedPrompt = message.text.trim();

    // GakrCLI-specific: /provider opens the provider picker dialog
    if (['/provider', '/providers'].includes(trimmedPrompt)) {
      webviewManager!.broadcast({ type: 'open_provider_picker' } as never);
      return;
    }

    const allowMatch = /^(?:\/allow|allow)\s+([A-Za-z][\w.-]*)$/i.exec(trimmedPrompt);
    if (allowMatch) {
      const toolName = allowMatch[1]!;
      const resolved = permissionHandler.allowTool(toolName);
      webviewManager!.broadcast({
        type: 'cli_output',
        data: {
          type: 'system',
          subtype: 'permission_rule_added',
          text: resolved > 0
            ? `Allowed ${toolName} and approved ${resolved} pending request${resolved === 1 ? '' : 's'}.`
            : `Allowed ${toolName} for future requests.`,
        },
      } as never);
      statusBarManager.setPendingPermission(false);
      return;
    }

    const pm = await ensureProcess();
    if (!pm) return;

    // Send as a user message to the CLI via NDJSON stdin
    pm.write({
      type: 'user',
      message: {
        role: 'user',
        content: message.text,
      },
      uuid: typeof message.uuid === 'string' ? message.uuid : undefined,
      priority: message.priority,
    });
  });

  // Handle slash commands from webview
  webviewManager.onMessage('slash_command', async (message) => {
    const msg = message as unknown as { command: string; args?: string };
    output.info(`[Webview→CLI] slash_command: /${msg.command}`);

    // GakrCLI-specific: /provider opens the provider picker dialog
    if (msg.command === 'provider' || msg.command === 'providers') {
      webviewManager!.broadcast({ type: 'open_provider_picker' } as never);
      return;
    }

    const pm = await ensureProcess();
    if (!pm) return;
    const content = msg.args ? `/${msg.command} ${msg.args}` : `/${msg.command}`;
    pm.write({ type: 'user', message: { role: 'user', content } });
  });

  // Handle set_model from webview
  webviewManager.onMessage('set_model', async (message) => {
    const msg = message as unknown as { model: string };
    const model = authManager.normalizeModelForCurrentProvider(msg.model);
    output.info(`[Webview→CLI] set_model: ${model}`);
    await authManager.updateModel(model);
    void sendProviderState();
    if (processManager) {
      void processManager.sendControlRequest({ subtype: 'set_model', model }).catch((err) => {
        const detail = err instanceof Error ? err.message : String(err);
        output.warn(`[GakrCLI] Failed to set model: ${detail}`);
      });
    }
  });

  // Handle set_effort_level from webview
  webviewManager.onMessage('set_effort_level', async (message) => {
    const msg = message as unknown as { level: string };
    output.info(`[Webview→CLI] set_effort_level: ${msg.level}`);
    if (processManager) {
      processManager.write({
        type: 'control_request',
        request_id: `set-effort-${Date.now()}`,
        request: { subtype: 'set_max_thinking_tokens', max_thinking_tokens: effortToTokens(msg.level) },
      });
    }
  });

  // Handle toggle_fast_mode from webview
  webviewManager.onMessage('toggle_fast_mode', async (message) => {
    const msg = message as unknown as { enabled: boolean };
    output.info(`[Webview→CLI] toggle_fast_mode: ${msg.enabled}`);
    if (processManager) {
      processManager.write({
        type: 'control_request',
        request_id: `fast-mode-${Date.now()}`,
        request: { subtype: 'apply_flag_settings', settings: { fastMode: msg.enabled } },
      });
    }
  });

  // Handle interrupt/stop
  webviewManager.onMessage('interrupt', async () => {
    output.info('[Webview→CLI] interrupt');
    if (processManager) {
      processManager.kill('SIGINT');
    }
  });

  // Handle new conversation
  webviewManager.onMessage('new_conversation', async () => {
    output.info('[Webview] new_conversation');
    if (processManager) {
      processManager.dispose();
      processManager = undefined;
    }
    currentSessionId = undefined;
    crashRestartCount = 0;
    checkpointManager.clear();
    webviewManager!.broadcast({ type: 'clearMessages' } as never);
    webviewManager!.broadcast({ type: 'process_state', state: 'stopped' });
    webviewManager!.broadcast({ type: 'checkpoint_state', checkpoints: [] });
  });

  // Handle get sessions request
  webviewManager.onMessage('get_sessions', async (_message, panelId) => {
    output.info('[Webview] get_sessions');
    const grouped = sessionTracker.getGroupedSessions();
    const payload = {
      type: 'sessionsData',
      grouped: grouped.map((g) => ({
        group: g.group,
        sessions: g.sessions.map((s) => ({
          id: s.id,
          title: s.title,
          model: s.model,
          timestamp: s.timestamp.toISOString(),
          createdAt: s.createdAt.toISOString(),
          messageCount: s.messageCount,
          cwd: s.cwd,
          gitBranch: s.gitBranch,
        })),
      })),
    };
    webviewManager!.sendToPanel(panelId, payload as never);
  });

  // Handle resume session
  webviewManager.onMessage('resume_session', async (message) => {
    output.info(`[Webview] resume_session: ${message.sessionId}`);
    // Kill existing process and spawn with --resume
    if (processManager) {
      processManager.dispose();
      processManager = undefined;
    }

    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) {
      vscode.window.showErrorMessage('GakrCLI: No workspace folder open');
      return;
    }

    const config = vscode.workspace.getConfiguration('gakrcliCode');
    const launchCommand = resolveCliLaunchCommand(config, {
      workspaceFolder: workspaceFolder.uri.fsPath,
      extensionPath: context.extensionPath,
    });
    const model = authManager.getCurrentProvider().model;
    const permissionMode = config.get<string>('initialPermissionMode') as
      | 'default' | 'acceptEdits' | 'plan' | 'bypassPermissions' | 'dontAsk' | undefined;
    const allowDangerouslySkipPermissions =
      config.get<boolean>('allowDangerouslySkipPermissions', false) ||
      permissionMode === 'bypassPermissions' ||
      permissionHandler.getMode() === 'bypassPermissions';

    const env = authManager.buildProcessEnv();

    // Clear old messages and load session history into webview
    webviewManager!.broadcast({ type: 'clearMessages' } as never);

    const historyMessages = await sessionTracker.loadSessionMessages(message.sessionId);
    if (historyMessages.length > 0) {
      webviewManager!.broadcast({
        type: 'session_history',
        messages: historyMessages,
      } as never);
    }

    isSpawning = true;
    webviewManager!.broadcast({ type: 'process_state', state: 'starting' });
    const ideServerMeta = mcpIdeServer.getServerMetadata();

    processManager = new ProcessManager({
      cwd: workspaceFolder.uri.fsPath,
      executable: launchCommand.executable,
      executableArgs: launchCommand.args,
      model,
      permissionMode,
      allowDangerouslySkipPermissions,
      sessionId: message.sessionId,
      env,
      ideMcpServer: ideServerMeta ? { port: ideServerMeta.port, ideName: 'VS Code' } : undefined,
    });

    // Re-register handlers on the new process
    processManager.registerControlHandler(
      'can_use_tool',
      createCanUseToolHandler(
        diffManager,
        () => processManager?.ndjsonTransport,
        output,
        permissionHandler,
      ),
    );
    processManager.registerControlHandler(
      'set_permission_mode',
      async (request) => {
        const modeRequest = request as import('./types/messages').ControlRequestSetPermissionMode;
        return permissionHandler.handleSetPermissionMode(modeRequest);
      },
    );
    processManager.registerControlHandler(
      'elicitation',
      async (request, _signal, requestId) => {
        const req = request as Record<string, unknown>;
        webviewManager!.broadcast({
          type: 'show_elicitation',
          requestId,
          message: req.message,
          fields: (req.fields as unknown[]) ?? [],
        } as never);
        return SELF_HANDLED;
      },
    );
    permissionHandler.setWriteToStdin((msg) => processManager?.ndjsonTransport?.write(msg));

    processManager.onMessage((msg) => {
      output.info(`[CLI→Webview] ${JSON.stringify(msg).substring(0, 300)}`);
      webviewManager!.broadcast({ type: 'cli_output', data: msg });

      const msgObj = msg as Record<string, unknown>;
      if (msgObj.type === 'control_request') {
        const req = msgObj.request as Record<string, unknown> | undefined;
        if (req?.subtype === 'can_use_tool') {
          statusBarManager.setPendingPermission(true);
        }
      }
      if (msgObj.type === 'control_cancel_request' && typeof msgObj.request_id === 'string') {
        permissionHandler.handleCancel(msgObj.request_id);
        statusBarManager.setPendingPermission(false);
      }

      // StatusBar: detect result while panel is hidden → orange dot
      if (msgObj.type === 'result' || msgObj.subtype === 'result') {
        if (!webviewManager!.hasVisibleWebview()) {
          statusBarManager.setCompletedWhileHidden(true);
        }
      }
    });
    processManager.onError((err) => {
      output.error(`[GakrCLI] Error: ${err.message}`);
      webviewManager!.broadcast({ type: 'process_state', state: 'crashed' });
    });
    processManager.onExit((code, signal) => {
      output.info(`[GakrCLI] CLI exited: code=${code}, signal=${signal}`);
      webviewManager!.broadcast({ type: 'process_state', state: 'stopped' });
      isSpawning = false;
    });
    processManager.onStateChange((state) => {
      output.info(`[GakrCLI] State: ${state}`);
      if (state === ProcessState.Ready) {
        webviewManager!.broadcast({ type: 'process_state', state: 'running' });
      }
    });
    processManager.onStderr((line) => {
      output.warn(`[CLI stderr] ${line}`);
    });

    try {
      await processManager.spawn();
      isSpawning = false;
      const session = sessionTracker.getSession(message.sessionId);
      webviewManager!.broadcast({
        type: 'sessionResumed',
        sessionId: message.sessionId,
        title: session?.title || 'Resumed Session',
      } as never);
    } catch (err) {
      isSpawning = false;
      const msg = err instanceof Error ? err.message : String(err);
      output.error(`[GakrCLI] Failed to resume: ${msg}`);
      vscode.window.showErrorMessage(`GakrCLI failed to resume session: ${msg}`);
      webviewManager!.broadcast({ type: 'process_state', state: 'crashed' });
    }
  });

  // Handle delete session
  webviewManager.onMessage('delete_session', async (message, panelId) => {
    output.info(`[Webview] delete_session: ${message.sessionId}`);
    const ok = await sessionTracker.deleteSession(message.sessionId);
    webviewManager!.sendToPanel(panelId, {
      type: 'sessionDeleted',
      sessionId: message.sessionId,
      success: ok,
    } as never);
    if (ok) {
      const grouped = sessionTracker.getGroupedSessions();
      webviewManager!.broadcast({
        type: 'sessionsData',
        grouped: grouped.map((g) => ({
          group: g.group,
          sessions: g.sessions.map((s) => ({
            id: s.id,
            title: s.title,
            model: s.model,
            timestamp: s.timestamp.toISOString(),
            createdAt: s.createdAt.toISOString(),
            messageCount: s.messageCount,
            cwd: s.cwd,
            gitBranch: s.gitBranch,
          })),
        })),
      } as never);
    }
  });

  // ==========================================
  // Checkpoint handlers (Story 10)
  // ==========================================

  webviewManager.onMessage('rewind', async (message) => {
    const msg = message as unknown as { messageUuid: string; dryRun: boolean };
    output.info(`[Webview] rewind: ${msg.messageUuid} dryRun=${msg.dryRun}`);
    if (!processManager) return;
    try {
      const request = checkpointManager.buildRewindRequest(msg.messageUuid, msg.dryRun);
      const response = await processManager.sendControlRequest(request as unknown as Record<string, unknown>);
      const rewindResponse = response as unknown as RewindFilesResponse;
      if (msg.dryRun) {
        webviewManager!.broadcast({
          type: 'rewind_preview',
          messageUuid: msg.messageUuid,
          canRewind: rewindResponse?.canRewind ?? false,
          error: rewindResponse?.error,
          filesChanged: rewindResponse?.filesChanged,
          insertions: rewindResponse?.insertions,
          deletions: rewindResponse?.deletions,
        });
      } else {
        webviewManager!.broadcast({
          type: 'rewind_result',
          messageUuid: msg.messageUuid,
          success: (rewindResponse?.canRewind ?? false) && !rewindResponse?.error,
          error: rewindResponse?.error,
          filesChanged: rewindResponse?.filesChanged,
          insertions: rewindResponse?.insertions,
          deletions: rewindResponse?.deletions,
        });
      }
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      webviewManager!.broadcast({
        type: msg.dryRun ? 'rewind_preview' : 'rewind_result',
        messageUuid: msg.messageUuid,
        canRewind: false,
        success: false,
        error: errMsg,
      } as never);
    }
  });

  webviewManager.onMessage('fork_session', async (message) => {
    const msg = message as unknown as { messageUuid: string };
    output.info(`[Webview] fork_session: ${msg.messageUuid}`);
    try {
      const forkOptions = checkpointManager.buildForkOptions(msg.messageUuid);
      const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
      if (!workspaceFolder) return;
      const launchCommand = resolveCliLaunchCommand(
        vscode.workspace.getConfiguration('gakrcliCode'),
        {
          workspaceFolder: workspaceFolder.uri.fsPath,
          extensionPath: context.extensionPath,
        },
      );
      const forkPm = new ProcessManager({
        cwd: workspaceFolder.uri.fsPath,
        executable: launchCommand.executable,
        executableArgs: launchCommand.args,
        sessionId: forkOptions.sessionId,
        forkSession: forkOptions.forkSession,
        env: authManager.buildProcessEnv(),
      });
      await forkPm.spawn();
      vscode.commands.executeCommand('gakrcli.editor.open');
    } catch (err) {
      vscode.window.showErrorMessage(`Fork failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  });

  webviewManager.onMessage('fork_and_rewind', async (message) => {
    const msg = message as unknown as { messageUuid: string };
    output.info(`[Webview] fork_and_rewind: ${msg.messageUuid}`);
    try {
      const forkOptions = checkpointManager.buildForkOptions(msg.messageUuid);
      const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
      if (!workspaceFolder) return;
      const launchCommand = resolveCliLaunchCommand(
        vscode.workspace.getConfiguration('gakrcliCode'),
        {
          workspaceFolder: workspaceFolder.uri.fsPath,
          extensionPath: context.extensionPath,
        },
      );
      const forkPm = new ProcessManager({
        cwd: workspaceFolder.uri.fsPath,
        executable: launchCommand.executable,
        executableArgs: launchCommand.args,
        sessionId: forkOptions.sessionId,
        forkSession: forkOptions.forkSession,
        env: authManager.buildProcessEnv(),
      });
      await forkPm.spawn();

      if (processManager) {
        const request = checkpointManager.buildRewindRequest(msg.messageUuid, false);
        const response = await processManager.sendControlRequest(request as unknown as Record<string, unknown>);
        const rewindResponse = response as unknown as RewindFilesResponse;
        webviewManager!.broadcast({
          type: 'rewind_result',
          messageUuid: msg.messageUuid,
          success: (rewindResponse?.canRewind ?? false) && !rewindResponse?.error,
          error: rewindResponse?.error,
          filesChanged: rewindResponse?.filesChanged,
        });
      }
      vscode.commands.executeCommand('gakrcli.editor.open');
    } catch (err) {
      vscode.window.showErrorMessage(`Fork+Rewind failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  });

  // ==========================================
  // Provider handlers (Story 11)
  // ==========================================

  webviewManager.onMessage('get_provider_state', async (_message, panelId) => {
    await sendProviderState(panelId);
  });

  webviewManager.onMessage('set_provider', async (message) => {
    const msg = message as unknown as {
      providerId: string;
      apiKey?: string;
      baseUrl?: string;
      model?: string;
    };
    const validation = authManager.validate({
      providerId: msg.providerId,
      apiKey: msg.apiKey,
      baseUrl: msg.baseUrl,
    });
    if (!validation.valid) {
      await sendProviderState(undefined, validation.errors.join('; '));
      return;
    }
    await authManager.updateProvider({
      providerId: msg.providerId,
      apiKey: msg.apiKey,
      baseUrl: msg.baseUrl,
      model: msg.model,
    });
    await sendProviderState();
  });

  // ==========================================
  // MCP handlers (Story 12)
  // ==========================================

  webviewManager.onMessage('mcp_refresh_status', async (_message, panelId) => {
    const meta = mcpIdeServer.getServerMetadata();
    webviewManager!.sendToPanel(panelId, {
      type: 'mcp_servers_state',
      servers: [],
      ideServer: {
        running: mcpIdeServer.isRunning(),
        port: meta?.port ?? null,
        toolCount: meta?.tools.length ?? 0,
      },
    } as never);
  });

  webviewManager.onMessage('mcp_reconnect', async (message) => {
    const msg = message as unknown as { serverName: string };
    output.info(`[Webview] mcp_reconnect: ${msg.serverName}`);
    if (processManager) {
      processManager.write({
        type: 'control_request',
        request_id: `mcp-reconnect-${Date.now()}`,
        request: { subtype: 'mcp_reconnect', serverName: msg.serverName },
      });
    }
  });

  webviewManager.onMessage('mcp_toggle', async (message) => {
    const msg = message as unknown as { serverName: string; enabled: boolean };
    output.info(`[Webview] mcp_toggle: ${msg.serverName} enabled=${msg.enabled}`);
    if (processManager) {
      processManager.write({
        type: 'control_request',
        request_id: `mcp-toggle-${Date.now()}`,
        request: { subtype: 'mcp_toggle', serverName: msg.serverName, enabled: msg.enabled },
      });
    }
  });

  webviewManager.onMessage('mcp_add_server', async (message) => {
    const msg = message as unknown as { name: string; config: Record<string, unknown> };
    output.info(`[Webview] mcp_add_server: ${msg.name}`);
    if (processManager) {
      processManager.write({
        type: 'control_request',
        request_id: `mcp-add-${Date.now()}`,
        request: { subtype: 'mcp_set_servers', servers: { [msg.name]: msg.config } },
      });
    }
  });

  webviewManager.onMessage('mcp_remove_server', async (message) => {
    const msg = message as unknown as { serverName: string };
    output.info(`[Webview] mcp_remove_server: ${msg.serverName}`);
    if (processManager) {
      processManager.write({
        type: 'control_request',
        request_id: `mcp-remove-${Date.now()}`,
        request: { subtype: 'mcp_toggle', serverName: msg.serverName, enabled: false },
      });
    }
  });

  // Handle workspace folder changes — restart CLI with new cwd
  context.subscriptions.push(
    vscode.workspace.onDidChangeWorkspaceFolders(() => {
      if (processManager) {
        output.info('[GakrCLI] Workspace folder changed, disposing CLI process');
        processManager.dispose();
        processManager = undefined;
        currentSessionId = undefined;
        crashRestartCount = 0;
        webviewManager!.broadcast({ type: 'process_state', state: 'stopped' });
      }
    }),
  );

  // ==========================================
  // Command Registration
  // ==========================================

  // Open in New Tab
  context.subscriptions.push(
    vscode.commands.registerCommand(
      'gakrcli.editor.open',
      async (sessionId?: string, prompt?: string, viewColumn?: vscode.ViewColumn) => {
        if (viewColumn !== vscode.ViewColumn.Active) {
          preferredLocation = 'panel';
        }
        const { startedInNewColumn } = webviewManager!.createPanel(
          sessionId, prompt, viewColumn,
        );
        if (startedInNewColumn) {
          await vscode.commands.executeCommand('workbench.action.lockEditorGroup');
        }
      },
    ),
  );

  // Open in Primary Editor
  context.subscriptions.push(
    vscode.commands.registerCommand(
      'gakrcli.primaryEditor.open',
      async (sessionId?: string, prompt?: string) => {
        webviewManager!.createPanel(sessionId, prompt, vscode.ViewColumn.Active);
      },
    ),
  );

  // Open (remembers last location)
  context.subscriptions.push(
    vscode.commands.registerCommand('gakrcli.editor.openLast', async () => {
      if (preferredLocation === 'sidebar') {
        await vscode.commands.executeCommand('gakrcli.sidebar.open');
        return;
      }
      await vscode.commands.executeCommand('gakrcli.editor.open');
    }),
  );

  // Open in Side Bar
  context.subscriptions.push(
    vscode.commands.registerCommand('gakrcli.sidebar.open', async () => {
      preferredLocation = 'sidebar';
      if (!supportsSecondarySidebar) {
        await vscode.commands.executeCommand('gakrcliSidebar.focus');
        return;
      }
      await vscode.commands.executeCommand('gakrcliSidebarSecondary.focus');
      statusBarManager.show();
    }),
  );

  // Open in New Window
  context.subscriptions.push(
    vscode.commands.registerCommand('gakrcli.window.open', async () => {
      await webviewManager!.createPanelInNewWindow();
      statusBarManager.hide();
    }),
  );

  // New Conversation
  context.subscriptions.push(
    vscode.commands.registerCommand('gakrcli.newConversation', async () => {
      if (processManager) {
        processManager.dispose();
        processManager = undefined;
      }
      currentSessionId = undefined;
      crashRestartCount = 0;
      checkpointManager.clear();
      webviewManager!.broadcast({ type: 'clearMessages' } as never);
      webviewManager!.broadcast({ type: 'process_state', state: 'stopped' });
      webviewManager!.broadcast({ type: 'checkpoint_state', checkpoints: [] });
    }),
  );

  // Focus input
  context.subscriptions.push(
    vscode.commands.registerCommand('gakrcli.focus', async () => {
      if (!webviewManager!.hasVisibleWebview()) {
        await vscode.commands.executeCommand('gakrcli.editor.openLast');
      }
      webviewManager!.broadcast({ type: 'at_mention_inserted', text: getActiveEditorMention() ?? '' });
    }),
  );

  // Blur input
  context.subscriptions.push(
    vscode.commands.registerCommand('gakrcli.blur', async () => {
      vscode.commands.executeCommand('workbench.action.focusFirstEditorGroup');
    }),
  );

  // Insert @-mention
  context.subscriptions.push(
    vscode.commands.registerCommand('gakrcli.insertAtMention', async () => {
      const mention = getActiveEditorMention();
      if (!mention) return;
      webviewManager!.broadcast({ type: 'at_mention_inserted', text: mention });
    }),
  );

  // Show Logs
  context.subscriptions.push(
    vscode.commands.registerCommand('gakrcli.showLogs', () => output.show()),
  );

  // Open Walkthrough
  context.subscriptions.push(
    vscode.commands.registerCommand('gakrcli.openWalkthrough', () => {
      const extensionId = context.extension.id;
      vscode.commands.executeCommand(
        'workbench.action.openWalkthrough',
        `${extensionId}#gakrcli-walkthrough`,
        false,
      );
    }),
  );

  // Diff commands
  context.subscriptions.push(
    vscode.commands.registerCommand('gakrcli.acceptProposedDiff', () => {
      diffManager.acceptCurrentDiff();
    }),
  );
  context.subscriptions.push(
    vscode.commands.registerCommand('gakrcli.rejectProposedDiff', () => {
      diffManager.rejectCurrentDiff();
    }),
  );

  // installPlugin command — opens the plugin manager in the active webview
  context.subscriptions.push(
    vscode.commands.registerCommand('gakrcli.installPlugin', () => {
      webviewManager!.broadcast({ type: 'open_plugin_manager' } as never);
    }),
  );

  // Plugin webview message handlers
  webviewManager.onMessage('plugin_refresh', async () => {
    if (processManager) {
      processManager.write({
        type: 'control_request',
        request_id: `plugin-state-${Date.now()}`,
        request: { subtype: 'get_settings' },
      });
    }
  });

  webviewManager.onMessage('plugin_toggle', async (message) => {
    const msg = message as unknown as { name: string; enabled: boolean };
    if (processManager) {
      processManager.write(buildToggleRequest(msg.name, msg.enabled) as unknown as Record<string, unknown>);
      processManager.write(buildReloadRequest() as unknown as Record<string, unknown>);
    }
  });

  webviewManager.onMessage('plugin_install', async (message) => {
    const msg = message as unknown as { name: string; scope: 'user' | 'project' | 'local' };
    const pm = await ensureProcess();
    if (pm) {
      pm.write({
        type: 'user',
        message: { role: 'user', content: buildInstallCommand(msg.name, msg.scope) },
      });
    }
  });

  webviewManager.onMessage('plugin_uninstall', async (message) => {
    const msg = message as unknown as { name: string };
    const pm = await ensureProcess();
    if (pm) {
      pm.write({
        type: 'user',
        message: { role: 'user', content: `/plugin uninstall ${msg.name}` },
      });
    }
  });

  webviewManager.onMessage('plugin_browse_marketplace', async () => {
    const pm = await ensureProcess();
    if (pm) {
      pm.write({ type: 'user', message: { role: 'user', content: '/plugins' } });
    }
  });

  webviewManager.onMessage('plugin_add_source', async () => {
    vscode.commands.executeCommand('workbench.action.openSettingsJson');
  });

  context.subscriptions.push(
    vscode.commands.registerCommand('gakrcli.update', () => {
      terminalManager.runCommand(['update'], 'GakrCLI Update');
    }),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('gakrcli.logout', async () => {
      const choice = await vscode.window.showWarningMessage(
        'Remove GakrCLI credentials saved in VS Code settings?',
        { modal: true },
        'Logout',
      );
      if (choice !== 'Logout') return;

      await settingsSync.setApiKey(undefined);
      await settingsSync.setBaseUrl(undefined);
      if (processManager) {
        processManager.write({ type: 'user', message: { role: 'user', content: '/logout' } });
      }
      await sendProviderState();
      vscode.window.showInformationMessage('GakrCLI: VS Code provider credentials cleared.');
    }),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('gakrcli.insertAtMentioned', () => {
      const mention = getActiveEditorMention();
      if (!mention) return;
      terminalManager.sendText(mention);
    }),
  );

  // Create Worktree (Story 14)
  context.subscriptions.push(
    vscode.commands.registerCommand('gakrcli.createWorktree', () => {
      worktreeManager.createWorktree();
    }),
  );

  // URI handler (Story 15)
  context.subscriptions.push(
    vscode.window.registerUriHandler({
      handleUri(uri: vscode.Uri): void {
        try {
          const parsed = parseGakrCLIUri(uri);
          if (uri.path !== '/open') {
            vscode.window.showWarningMessage(`GakrCLI: Unknown URI path "${uri.path}"`);
            return;
          }
          vscode.commands.executeCommand(
            'gakrcli.editor.open',
            parsed.session,
            parsed.prompt,
          );
        } catch {
          vscode.window.showWarningMessage('GakrCLI: Malformed URI — could not open.');
        }
      },
    }),
  );

  // Terminal mode commands
  context.subscriptions.push(
    vscode.commands.registerCommand('gakrcli.terminal.open', () => {
      terminalManager.open();
    }),
  );
  context.subscriptions.push(
    vscode.commands.registerCommand('gakrcli.terminal.open.keyboard', () => {
      terminalManager.open();
    }),
  );

  // ==========================================
  // StatusBar event wiring
  // ==========================================

  // Clear pending permission indicator when user responds to a permission request
  webviewManager.onMessage('permission_response', () => {
    statusBarManager.setPendingPermission(false);
  });

  // Handle elicitation response from webview → forward to CLI
  webviewManager.onMessage('elicitation_response', async (message) => {
    const msg = message as unknown as { requestId: string; values: Record<string, unknown> };
    output.info(`[Webview→CLI] elicitation_response: ${msg.requestId}`);
    if (processManager) {
      processManager.write({
        type: 'control_response',
        response: {
          subtype: 'success',
          request_id: msg.requestId,
          response: msg.values,
        },
      });
    }
  });

  // Handle elicitation cancel from webview → forward error response to CLI
  webviewManager.onMessage('elicitation_cancel', async (message) => {
    const msg = message as unknown as { requestId: string };
    output.info(`[Webview→CLI] elicitation_cancel: ${msg.requestId}`);
    if (processManager) {
      processManager.write({
        type: 'control_response',
        response: {
          subtype: 'error',
          request_id: msg.requestId,
          error: 'User cancelled elicitation',
        },
      });
    }
  });

  // Handle copy_message — write text to clipboard
  webviewManager.onMessage('copy_message', async (message) => {
    const msg = message as unknown as { content: string };
    await vscode.env.clipboard.writeText(msg.content);
  });

  // Handle copy_to_clipboard (alias used by some components)
  webviewManager.onMessage('copy_to_clipboard', async (message) => {
    await vscode.env.clipboard.writeText(message.text);
  });

  // Handle at_mention_query — search workspace files and return results
  webviewManager.onMessage('at_mention_query', async (message, panelId) => {
    const msg = message as unknown as { query: string };
    try {
      const results = await atMentionProvider.search(msg.query ?? '');
      webviewManager!.sendToPanel(panelId, {
        type: 'at_mention_results',
        query: msg.query ?? '',
        results,
      } as never);
    } catch (err) {
      output.warn(`[GakrCLI] at_mention_query error: ${err}`);
      webviewManager!.sendToPanel(panelId, {
        type: 'at_mention_results',
        query: msg.query ?? '',
        results: [],
      } as never);
    }
  });

  // Track active editor file and notify all webviews
  context.subscriptions.push(
    vscode.window.onDidChangeActiveTextEditor((editor) => {
      const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? '';
      if (editor) {
        const fsPath = editor.document.uri.fsPath;
        const relativePath = fsPath.startsWith(workspaceRoot)
          ? fsPath.slice(workspaceRoot.length).replace(/^[/\\]/, '')
          : fsPath;
        webviewManager!.broadcast({
          type: 'active_file_changed',
          filePath: relativePath,
          fileName: path.basename(editor.document.fileName) || null,
          languageId: editor.document.languageId,
        } as never);
      } else {
        webviewManager!.broadcast({
          type: 'active_file_changed',
          filePath: null,
          fileName: null,
          languageId: null,
        } as never);
      }
    }),
  );

  // Handle open_file — open a file in the editor at a specific line
  webviewManager.onMessage('open_file', async (message) => {
    try {
      const uri = vscode.Uri.file(message.filePath);
      const doc = await vscode.workspace.openTextDocument(uri);
      const editor = await vscode.window.showTextDocument(doc, { preview: false });
      if (message.line !== undefined) {
        const line = Math.max(0, (message.line as number) - 1);
        const col = message.column !== undefined ? Math.max(0, (message.column as number) - 1) : 0;
        const pos = new vscode.Position(line, col);
        editor.selection = new vscode.Selection(pos, pos);
        editor.revealRange(new vscode.Range(pos, pos), vscode.TextEditorRevealType.InCenter);
      }
    } catch (err) {
      output.error(`[GakrCLI] Failed to open file ${message.filePath}: ${err}`);
    }
  });

  // Handle plan_review_submit — forward review decision to CLI
  webviewManager.onMessage('plan_review_submit', async (message) => {
    const msg = message as unknown as {
      requestId: string;
      action: {
        type: 'approve' | 'approve_with_comments' | 'request_revision';
        clearContext?: boolean;
        comments?: Array<{ number: number; anchorText: string; text: string }>;
        revisionNote?: string;
      };
    };
    output.info(`[Webview→CLI] plan_review_submit: ${msg.requestId} action=${msg.action.type}`);
    if (!processManager) return;

    const { action } = msg;
    if (action.type === 'approve') {
      processManager.write({
        type: 'control_response',
        response: {
          subtype: 'success',
          request_id: msg.requestId,
          response: { decision: 'approve', clearContext: action.clearContext ?? false },
        },
      });
    } else if (action.type === 'approve_with_comments') {
      const commentSummary = (action.comments ?? [])
        .map((c) => `[${c.number}] "${c.anchorText}" — ${c.text}`)
        .join('\n');
      processManager.write({
        type: 'control_response',
        response: {
          subtype: 'success',
          request_id: msg.requestId,
          response: {
            decision: 'approve',
            feedback: commentSummary,
            clearContext: action.clearContext ?? false,
          },
        },
      });
    } else if (action.type === 'request_revision') {
      const commentSummary = (action.comments ?? [])
        .map((c) => `[${c.number}] "${c.anchorText}" — ${c.text}`)
        .join('\n');
      const fullFeedback = action.revisionNote
        ? `${action.revisionNote}\n\nInline comments:\n${commentSummary}`
        : commentSummary;
      processManager.write({
        type: 'control_response',
        response: {
          subtype: 'error',
          request_id: msg.requestId,
          error: fullFeedback || 'User requested revision',
        },
      });
    }
  });

  // Clear completed-while-hidden indicator when a webview becomes visible
  // (The webview sends 'ready' when it becomes visible/re-renders)
  // Also eagerly spawn the CLI so slash commands are available immediately.
  webviewManager.onMessage('ready', () => {
    statusBarManager.clearCompletedWhileHidden();
    // Spawn eagerly so slash commands + models are available before first message
    ensureProcess().catch((err) => {
      output.warn(`[GakrCLI] Eager spawn failed: ${err}`);
    });
  });

  // Handle file_picker_request — open VS Code file picker and return selected files
  webviewManager.onMessage('file_picker_request', async (_message, panelId) => {
    output.info('[Webview] file_picker_request');
    const uris = await vscode.window.showOpenDialog({
      canSelectMany: true,
      canSelectFiles: true,
      canSelectFolders: false,
      openLabel: 'Attach',
    });
    if (!uris || uris.length === 0) return;
    const seenPaths = new Set<string>();
    const files = uris.filter((uri) => {
      const key = uri.fsPath.toLowerCase();
      if (seenPaths.has(key)) {
        return false;
      }
      seenPaths.add(key);
      return true;
    }).map((uri) => ({
      type: 'file' as const,
      name: path.basename(uri.fsPath) || uri.fsPath,
      content: uri.fsPath,
    }));
    webviewManager!.sendToPanel(panelId, { type: 'file_picker_result', files } as never);
  });

  // Handle retry_connection — re-spawn the CLI process
  webviewManager.onMessage('retry_connection', async () => {
    output.info('[Webview] retry_connection');
    if (processManager) {
      processManager.dispose();
      processManager = undefined;
    }
    crashRestartCount = 0;
    await ensureProcess();
  });

  // Dispose ProcessManager on extension deactivation
  context.subscriptions.push({
    dispose: () => {
      processManager?.dispose();
    },
  });

  // Set context for sidebar state
  vscode.commands.executeCommand('setContext', 'gakrcli.sessionsListEnabled', true);
  vscode.commands.executeCommand('setContext', 'gakrcli.primaryEditorEnabled', true);

  output.info('GakrCLI: All commands and providers registered');
}

export function deactivate() {
  console.log('GakrCLI VS Code extension deactivated');
  // Kill CLI process gracefully, then force after 2s
  if (processManager) {
    processManager.kill('SIGTERM');
    setTimeout(() => processManager?.kill('SIGKILL'), 2000);
  }
  diffManagerInstance = undefined;
  webviewManager = undefined;
}
