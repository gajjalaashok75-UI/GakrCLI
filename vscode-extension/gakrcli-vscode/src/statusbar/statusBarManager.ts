import * as vscode from 'vscode';

export type StatusBarState = 'idle' | 'pending' | 'completed-hidden';

/**
 * Manages the GakrCLI status bar item with three visual states:
 * - idle: default sparkle icon
 * - pending: blue dot (permission request waiting)
 * - completed-hidden: orange dot (GakrCLI finished while panel hidden)
 *
 * Priority: pending > completed-hidden > idle.
 */
export class StatusBarManager implements vscode.Disposable {
  private readonly item: vscode.StatusBarItem;
  private pendingPermission = false;
  private completedWhileHidden = false;

  constructor() {
    this.item = vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Right,
      100,
    );
    this.item.command = 'gakrcli.editor.openLast';
    this.updateDisplay();
    this.item.show();
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
    if (this.completedWhileHidden) return 'completed-hidden';
    return 'idle';
  }

  private updateDisplay(): void {
    if (this.pendingPermission) {
      this.item.text = '$(circle-filled) $(sparkle) GakrCLI';
      this.item.tooltip = 'GakrCLI — Permission request pending';
      this.item.color = new vscode.ThemeColor('statusBarItem.warningForeground');
      this.item.backgroundColor = new vscode.ThemeColor('statusBarItem.warningBackground');
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
