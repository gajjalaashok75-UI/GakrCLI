import * as vscode from 'vscode';
import { resolveCliLaunchCommand } from '../settings/cliExecutable';

/**
 * Manages the GakrCLI integrated terminal instance.
 * When terminal mode is enabled, spawns the CLI in VS Code's terminal
 * instead of the webview panel.
 */
export class TerminalManager implements vscode.Disposable {
  private terminal: vscode.Terminal | undefined;
  private readonly disposables: vscode.Disposable[] = [];

  constructor(private readonly extensionPath?: string) {
    this.disposables.push(
      vscode.window.onDidCloseTerminal((closed) => {
        if (closed === this.terminal) {
          this.terminal = undefined;
        }
      }),
    );
  }

  /**
   * Open or focus the GakrCLI terminal.
   * If a terminal already exists, just reveals it.
   */
  open(): void {
    if (this.terminal) {
      this.terminal.show();
      return;
    }

    const config = vscode.workspace.getConfiguration('gakrcliCode');
    const cwd = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    const cliCommand = resolveCliLaunchCommand(config, {
      workspaceFolder: cwd,
      extensionPath: this.extensionPath,
    }).displayCommand;

    const envVars = config.get<Array<{ name: string; value: string }>>(
      'environmentVariables',
      [],
    );
    const env: Record<string, string> = {};
    for (const v of envVars) {
      env[v.name] = v.value;
    }

    this.terminal = vscode.window.createTerminal({
      name: 'GakrCLI',
      cwd,
      env,
      iconPath: new vscode.ThemeIcon('sparkle'),
    });

    const flags: string[] = [];
    const model = config.get<string>('selectedModel', 'default');
    if (model && model !== 'default') {
      flags.push('--model', model);
    }
    const permMode = config.get<string>('initialPermissionMode', 'default');
    if (permMode && permMode !== 'default') {
      flags.push('--permission-mode', permMode);
    }

    this.terminal.sendText([cliCommand, ...flags.map(quoteShellToken)].join(' '));
    this.terminal.show();
  }

  /**
   * Run a one-off GakrCLI command in its own terminal.
   */
  runCommand(args: string[], name = 'GakrCLI'): void {
    const config = vscode.workspace.getConfiguration('gakrcliCode');
    const cwd = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    const cliCommand = resolveCliLaunchCommand(config, {
      workspaceFolder: cwd,
      extensionPath: this.extensionPath,
    }).displayCommand;
    const terminal = vscode.window.createTerminal({
      name,
      cwd,
      iconPath: new vscode.ThemeIcon('sparkle'),
    });
    terminal.sendText([cliCommand, ...args.map(quoteShellToken)].join(' '));
    terminal.show();
  }

  /**
   * Send text to the managed GakrCLI terminal without submitting it.
   */
  sendText(text: string): void {
    this.open();
    this.terminal?.sendText(text, false);
  }

  dispose(): void {
    this.terminal?.dispose();
    for (const d of this.disposables) {
      d.dispose();
    }
  }
}

function quoteShellToken(value: string): string {
  if (!value) return '""';
  if (!/[\s"'&()<>^|]/.test(value)) return value;
  return `"${value.replace(/"/g, '\\"')}"`;
}
