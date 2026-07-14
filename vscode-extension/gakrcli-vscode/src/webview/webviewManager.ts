import * as vscode from 'vscode';
import { WebviewBridge } from './webviewBridge';
import { generateWebviewHtml } from './htmlGenerator';
import { getThemeKind, getFontConfig } from './htmlGenerator';
import type {
  WebviewToHostMessage,
  HostToWebviewMessage,
  PanelLocation,
  SessionInfo,
} from './types';

let nextPanelId = 1;

function createPanelId(): string {
  return `panel-${nextPanelId++}`;
}

type MessageHandler<T extends WebviewToHostMessage['type']> = (
  message: Extract<WebviewToHostMessage, { type: T }>,
  panelId: string,
) => void | Promise<void>;

/**
 * Manages all GakrCLI webview panels across sidebar, editor tabs, and new windows.
 *
 * Extracted from Claude Code extension.js `DQ` class:
 * - createPanel() creates editor tab panels (ViewColumn.Beside or unused column)
 * - resolveWebviewView() handles sidebar panels
 * - setupPanel() wires message handlers
 * - Tracks multiple simultaneous panels (allComms, webviews, sessionPanels Maps)
 * - Broadcasts session state across all panels
 * - Handles panel serialization/deserialization for persistence
 */
export class WebviewManager implements vscode.Disposable {
  private readonly bridges = new Map<string, WebviewBridge>();
  private readonly panelMap = new Map<string, vscode.WebviewPanel>();
  private readonly sessionPanels = new Map<string, string>(); // sessionId -> panelId
  private readonly disposables: vscode.Disposable[] = [];
  private readonly globalHandlers = new Map<string, MessageHandler<never>[]>();

  /** Track session states for badge updates and cross-panel sync */
  private sessionStates = new Map<string, SessionInfo>();
  private activeSessionId?: string;

  constructor(
    private readonly extensionUri: vscode.Uri,
    private readonly context: vscode.ExtensionContext,
    private readonly output: vscode.OutputChannel,
  ) {
    // Listen for theme changes and broadcast to all panels
    this.disposables.push(
      vscode.window.onDidChangeActiveColorTheme(() => {
        const theme = getThemeKind();
        this.broadcast({ type: 'theme_changed', theme });
      }),
    );

    // Listen for font configuration changes
    this.disposables.push(
      vscode.workspace.onDidChangeConfiguration((e) => {
        if (
          e.affectsConfiguration('chat.fontSize') ||
          e.affectsConfiguration('chat.fontFamily') ||
          e.affectsConfiguration('chat.editor.fontSize') ||
          e.affectsConfiguration('chat.editor.fontFamily') ||
          e.affectsConfiguration('chat.editor.fontWeight')
        ) {
          const fonts = getFontConfig();
          this.broadcast({ type: 'font_config', ...fonts });
        }
      }),
    );
  }

  /**
   * Register a global message handler that fires for messages from ANY panel.
   * Used by ProcessManager, SessionTracker, etc. to react to webview messages.
   */
  onMessage<T extends WebviewToHostMessage['type']>(
    type: T,
    handler: MessageHandler<T>,
  ): vscode.Disposable {
    const handlers = this.globalHandlers.get(type) || [];
    handlers.push(handler as unknown as MessageHandler<never>);
    this.globalHandlers.set(type, handlers);

    // Also register on all existing bridges
    const bridgeDisposables: vscode.Disposable[] = [];
    for (const bridge of this.bridges.values()) {
      bridgeDisposables.push(bridge.onMessage(type, handler));
    }

    return {
      dispose: () => {
        const current = this.globalHandlers.get(type);
        if (current) {
          const index = current.indexOf(handler as unknown as MessageHandler<never>);
          if (index >= 0) {
            current.splice(index, 1);
          }
        }
        for (const d of bridgeDisposables) {
          d.dispose();
        }
      },
    };
  }

  /**
   * Send a message to a specific panel by ID.
   */
  sendToPanel(panelId: string, message: HostToWebviewMessage): void {
    const bridge = this.bridges.get(panelId);
    if (bridge) {
      bridge.postMessage(message);
    }
  }

  /**
   * Broadcast a message to ALL active panels.
   */
  broadcast(message: HostToWebviewMessage): void {
    for (const bridge of this.bridges.values()) {
      bridge.postMessage(message);
    }
  }

  /**
   * Check if any webview is currently visible.
   */
  hasVisibleWebview(): boolean {
    for (const [panelId] of this.bridges) {
      const panel = this.panelMap.get(panelId);
      if (panel?.visible) {
        return true;
      }
    }
    // Sidebar visibility is tracked differently — check sidebarVisible flag
    return this.sidebarVisible;
  }

  private sidebarVisible = false;

  /**
   * Create a new webview panel in an editor tab.
   *
   * Extracted from Claude Code DQ.createPanel():
   * - Finds an unused column or reuses one with only GakrCLI tabs
   * - Sets retainContextWhenHidden, enableFindWidget, enableScripts
   * - Sets icon, wires message handlers, registers disposal
   *
   * Returns { panelId, startedInNewColumn }.
   */
  createPanel(
    sessionId?: string,
    initialPrompt?: string,
    viewColumn?: vscode.ViewColumn,
  ): { panelId: string; startedInNewColumn: boolean } {
    // If session already has an open panel, reveal it
    if (sessionId) {
      const existingPanelId = this.sessionPanels.get(sessionId);
      if (existingPanelId) {
        const existingPanel = this.panelMap.get(existingPanelId);
        if (existingPanel) {
          existingPanel.reveal();
          if (initialPrompt) {
            vscode.window.showInformationMessage(
              'Session is already open. Your prompt was not applied — enter it manually.',
            );
          }
          return { panelId: existingPanelId, startedInNewColumn: false };
        }
      }
    }

    // Determine target column
    let startedInNewColumn = false;
    let targetColumn: vscode.ViewColumn;

    if (viewColumn !== undefined) {
      targetColumn = viewColumn;
    } else {
      // Try to find a column that only has GakrCLI tabs
      const existingGroup = vscode.window.tabGroups.all.find((group) => {
        if (group.tabs.length === 0) return false;
        return group.tabs.every((tab) => {
          if (tab.input instanceof vscode.TabInputWebview) {
            return tab.input.viewType.includes('gakrcliPanel');
          }
          return false;
        });
      });

      if (existingGroup?.viewColumn) {
        targetColumn = existingGroup.viewColumn;
      } else {
        targetColumn = this.findUnusedColumn();
        startedInNewColumn = true;
      }
    }

    const isFullEditor = viewColumn === vscode.ViewColumn.Active;
    const panelId = createPanelId();

    const panel = vscode.window.createWebviewPanel(
      'gakrcliPanel',
      'GakrCLI',
      targetColumn,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        enableFindWidget: true,
        localResourceRoots: [
          vscode.Uri.joinPath(this.extensionUri, 'dist', 'webview'),
          vscode.Uri.joinPath(this.extensionUri, 'resources'),
        ],
      },
    );

    // Set panel icon
    const iconUri = vscode.Uri.joinPath(this.extensionUri, 'resources', 'gakrcli-logo.svg');
    panel.iconPath = { light: iconUri, dark: iconUri };

    this.setupPanel(panel, panelId, 'editor-tab', sessionId, initialPrompt, isFullEditor);

    return { panelId, startedInNewColumn };
  }

  /**
   * Open a panel in a new VS Code window.
   * Creates a panel and then moves it to a new window.
   */
  async createPanelInNewWindow(sessionId?: string): Promise<string> {
    const { panelId } = this.createPanel(sessionId);
    await vscode.commands.executeCommand('workbench.action.moveEditorToNewWindow');
    return panelId;
  }

  /**
   * Set up a panel — generate HTML, wire bridge, register disposal.
   * Used by both createPanel() and the WebviewPanelSerializer for restoring panels.
   *
   * Extracted from Claude Code DQ.setupPanel().
   */
  setupPanel(
    panel: vscode.WebviewPanel,
    panelId: string,
    location: PanelLocation,
    sessionId?: string,
    initialPrompt?: string,
    isFullEditor?: boolean,
  ): void {
    panel.webview.options = {
      enableScripts: true,
      localResourceRoots: [
        vscode.Uri.joinPath(this.extensionUri, 'dist', 'webview'),
        vscode.Uri.joinPath(this.extensionUri, 'resources'),
      ],
    };

    panel.webview.html = generateWebviewHtml({
      webview: panel.webview,
      extensionUri: this.extensionUri,
      isSidebar: false,
      isFullEditor,
      isSessionListOnly: false,
      initialSessionId: sessionId,
      initialPrompt,
    });

    const bridge = new WebviewBridge(panel.webview, panelId, location);
    this.bridges.set(panelId, bridge);
    this.panelMap.set(panelId, panel);

    if (sessionId) {
      this.sessionPanels.set(sessionId, panelId);
    }

    // Register global handlers on new bridge
    for (const [type, handlers] of this.globalHandlers) {
      for (const handler of handlers) {
        bridge.onMessage(type as WebviewToHostMessage['type'], handler as unknown as MessageHandler<WebviewToHostMessage['type']>);
      }
    }

    // Wire ready handler to send init state
    bridge.onMessage('ready', () => {
      bridge.postMessage({
        type: 'init_state',
        isSidebar: false,
        isFullEditor: !!isFullEditor,
        isSessionListOnly: false,
        theme: getThemeKind(),
        initialSessionId: sessionId,
        initialPrompt,
        extensionVersion: this.context.extension.packageJSON.version || '0.2.5',
      });
    });

    // Track visibility changes
    panel.onDidChangeViewState(
      () => {
        if (panel.active) {
          // Update active session when panel becomes active
          for (const [sid, pid] of this.sessionPanels) {
            if (pid === panelId) {
              this.activeSessionId = sid;
              this.broadcastSessionStates();
              break;
            }
          }
        }
      },
      null,
      this.disposables,
    );

    // Clean up on dispose
    panel.onDidDispose(
      () => {
        bridge.dispose();
        this.bridges.delete(panelId);
        this.panelMap.delete(panelId);

        // Clean up session tracking
        for (const [sid, pid] of this.sessionPanels) {
          if (pid === panelId) {
            this.sessionPanels.delete(sid);
            this.sessionStates.delete(sid);
            if (this.activeSessionId === sid) {
              this.activeSessionId = undefined;
            }
          }
        }
        this.broadcastSessionStates();
      },
      null,
      this.disposables,
    );

    this.disposables.push(panel);
  }

  /**
   * Resolve a sidebar WebviewView — called by the WebviewViewProvider.
   *
   * Extracted from Claude Code DQ.resolveWebviewView().
   */
  resolveSidebarView(
    webviewView: vscode.WebviewView,
  ): string {
    const panelId = createPanelId();

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [
        vscode.Uri.joinPath(this.extensionUri, 'dist', 'webview'),
        vscode.Uri.joinPath(this.extensionUri, 'resources'),
      ],
    };

    webviewView.webview.html = generateWebviewHtml({
      webview: webviewView.webview,
      extensionUri: this.extensionUri,
      isSidebar: true,
      isFullEditor: false,
      isSessionListOnly: false,
    });

    webviewView.show(true);

    const bridge = new WebviewBridge(webviewView.webview, panelId, 'sidebar');
    this.bridges.set(panelId, bridge);

    // Register global handlers on new bridge
    for (const [type, handlers] of this.globalHandlers) {
      for (const handler of handlers) {
        bridge.onMessage(type as WebviewToHostMessage['type'], handler as unknown as MessageHandler<WebviewToHostMessage['type']>);
      }
    }

    // Wire ready handler
    bridge.onMessage('ready', () => {
      bridge.postMessage({
        type: 'init_state',
        isSidebar: true,
        isFullEditor: false,
        isSessionListOnly: false,
        theme: getThemeKind(),
        extensionVersion: this.context.extension.packageJSON.version || '0.2.5',
      });
    });

    // Track visibility
    webviewView.onDidChangeVisibility(
      () => {
        this.sidebarVisible = webviewView.visible;
      },
      null,
      this.disposables,
    );
    this.sidebarVisible = webviewView.visible;

    // Clean up
    webviewView.onDidDispose(
      () => {
        bridge.dispose();
        this.bridges.delete(panelId);
        this.sidebarVisible = false;
      },
      null,
      this.disposables,
    );

    return panelId;
  }

  /**
   * Update session state and broadcast to all panels.
   * Extracted from Claude Code DQ.updateSessionState() / broadcastSessionStates().
   */
  updateSessionState(sessionId: string, state: SessionInfo['state'], title?: string): void {
    this.sessionStates.set(sessionId, { sessionId, state, title });
    this.broadcastSessionStates();
  }

  private broadcastSessionStates(): void {
    const sessions = Array.from(this.sessionStates.values());
    this.broadcast({
      type: 'session_state',
      sessions,
      activeSessionId: this.activeSessionId,
    });
  }

  /**
   * Get a bridge by panel ID.
   */
  getBridge(panelId: string): WebviewBridge | undefined {
    return this.bridges.get(panelId);
  }

  /**
   * Get all active bridge IDs.
   */
  getAllPanelIds(): string[] {
    return Array.from(this.bridges.keys());
  }

  /**
   * Find an unused editor column.
   * Extracted from Claude Code DQ.findUnusedColumn().
   */
  private findUnusedColumn(): vscode.ViewColumn {
    const usedColumns = new Set<vscode.ViewColumn>();
    vscode.window.tabGroups.all.forEach((group) => {
      if (group.viewColumn !== undefined) {
        usedColumns.add(group.viewColumn);
      }
    });

    for (let col = vscode.ViewColumn.One; col <= vscode.ViewColumn.Nine; col++) {
      if (!usedColumns.has(col)) {
        return col;
      }
    }
    return vscode.ViewColumn.Beside;
  }

  dispose(): void {
    for (const bridge of this.bridges.values()) {
      bridge.dispose();
    }
    this.bridges.clear();
    this.panelMap.clear();
    this.sessionPanels.clear();
    this.sessionStates.clear();
    for (const d of this.disposables) {
      d.dispose();
    }
    this.disposables.length = 0;
  }
}
