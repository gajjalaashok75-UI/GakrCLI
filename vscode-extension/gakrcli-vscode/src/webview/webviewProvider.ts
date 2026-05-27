import * as vscode from 'vscode';
import { WebviewManager } from './webviewManager';

/**
 * WebviewViewProvider for the sidebar (both primary and secondary).
 * The provider delegates all work to WebviewManager, which handles HTML generation,
 * bridge setup, and message routing.
 */
export class GakrCLIWebviewProvider implements vscode.WebviewViewProvider {
  constructor(private readonly manager: WebviewManager) {}

  resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken,
  ): void {
    this.manager.resolveSidebarView(webviewView);
  }
}

/**
 * Serializer for restoring webview panels when VS Code is restarted.
 * When VS Code restarts, it calls deserializeWebviewPanel with the saved panel
 * and its state. We re-create the bridge and restore the panel.
 */
export class GakrCLIPanelSerializer implements vscode.WebviewPanelSerializer {
  constructor(private readonly manager: WebviewManager) {}

  async deserializeWebviewPanel(
    panel: vscode.WebviewPanel,
    state: { isFullEditor?: boolean; sessionId?: string } | undefined,
  ): Promise<void> {
    const isFullEditor = state?.isFullEditor ?? this.inferIsFullEditor(panel);
    this.manager.setupPanel(
      panel,
      `restored-${Date.now()}`,
      'editor-tab',
      state?.sessionId,
      undefined,
      isFullEditor,
    );
  }

  /**
   * Infer if a panel was in the primary editor position.
   * If the panel is in the first tab group, it's likely the primary editor.
   */
  private inferIsFullEditor(panel: vscode.WebviewPanel): boolean {
    return (
      vscode.window.tabGroups.all.findIndex(
        (group) => group.viewColumn === panel.viewColumn,
      ) === 0
    );
  }
}
