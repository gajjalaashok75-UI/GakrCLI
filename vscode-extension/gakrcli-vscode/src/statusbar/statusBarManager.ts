import * as vscode from 'vscode';

export type StatusBarState = 'idle' | 'starting' | 'ready' | 'pending' | 'completed-hidden';

/**
 * Manages the GakrCLI status bar item with five visual states:
 * - idle: default sparkle icon
 * - starting: spinning loading indicator (CLI process is being spawned)
 * - ready: green checkmark (CLI process is connected and ready)
 * - pending: blue dot (permission request waiting)
 * - completed-hidden: orange dot (GakrCLI finished while panel hidden)
 *
 * Priority: pending > starting > completed-hidden > ready > idle.
 */
export class StatusBarManager implements vscode.Disposable {
  private readonly item: vscode.StatusBarItem;
  private _ready = false;
  private starting = false;
  private pendingPermission = false;
  private completedWhileHidden = false;
  private modelName: string | null = null;

  constructor() {
    this.item = vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Right,
      100,
    );
    this.item.command = 'gakrcli.editor.openLast';
    this.updateDisplay();
    this.item.show();
  }

  setStarting(starting: boolean): void {
    if (this.starting !== starting) {
      this.starting = starting;
      // Clear ready when entering starting
      if (starting) this._ready = false;
      this.updateDisplay();
    }
  }

  setReady(ready: boolean): void {
    if (this._ready !== ready) {
      this._ready = ready;
      this.updateDisplay();
    }
  }

  setModelName(model: string | null): void {
    if (this.modelName !== model) {
      this.modelName = model;
      this.updateDisplay();
    }
  }

  setPendingPermission(pending: boolean): void {
    this.pendingPermission = pending;
    this.updateDisplay();
  }

  setCompletedWhileHidden(done: boolean): void {
    this.completedWhileHidden = done;
    this.updateDisplay();
  }

  clearCompletedWhileHidden(): void {
    if (this.completedWhileHidden) {
      this.completedWhileHidden = false;
      this.updateDisplay();
    }
  }

  getState(): StatusBarState {
    if (this.pendingPermission) return 'pending';
    if (this.starting) return 'starting';
    if (this.completedWhileHidden) return 'completed-hidden';
    if (this._ready) return 'ready';
    return 'idle';
  }

  private updateDisplay(): void {
    if (this.pendingPermission) {
      this.item.text = '$(circle-filled) $(sparkle) GakrCLI';
      this.item.tooltip = 'GakrCLI — Permission request pending';
      this.item.color = new vscode.ThemeColor('statusBarItem.warningForeground');
      this.item.backgroundColor = new vscode.ThemeColor('statusBarItem.warningBackground');
    } else if (this.starting) {
      this.item.text = '$(sync~spin) GakrCLI';
      this.item.tooltip = 'GakrCLI — Starting...';
      this.item.color = new vscode.ThemeColor('statusBarItem.prominentForeground');
      this.item.backgroundColor = new vscode.ThemeColor('statusBarItem.prominentBackground');
    } else if (this._ready) {
      const suffix = this.modelName ? ` — ${this.modelName}` : '';
      this.item.text = `$(check) $(sparkle) GakrCLI${suffix}`;
      this.item.tooltip = `GakrCLI — Ready${suffix}`;
      this.item.color = new vscode.ThemeColor('statusBarItem.prominentForeground');
      this.item.backgroundColor = undefined;
    } else if (this.completedWhileHidden) {
      this.item.text = '$(circle-filled) $(sparkle) GakrCLI';
      this.item.tooltip = 'GakrCLI — Response ready (click to view)';
      this.item.color = new vscode.ThemeColor('statusBarItem.prominentForeground');
      this.item.backgroundColor = new vscode.ThemeColor('statusBarItem.prominentBackground');
    } else {
      this.item.text = '$(sparkle) GakrCLI';
      this.item.tooltip = 'GakrCLI — Click to open';
      this.item.color = undefined;
      this.item.backgroundColor = undefined;
    }
  }

  hide(): void {
    this.item.hide();
  }

  show(): void {
    this.item.show();
  }

  dispose(): void {
    this.item.dispose();
  }
}
