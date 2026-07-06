# Story 9: Status Bar, Commands & Keyboard Shortcuts — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement a fully functional status bar manager with colored state indicators, extract all 22 commands into a dedicated command registry with real implementations, wire the 5 keyboard shortcuts, and add terminal mode support. Replace the placeholder command stubs in `extension.ts` with a clean modular architecture.

**Architecture:** `StatusBarManager` owns the `vscode.StatusBarItem` lifecycle -- text, color, tooltip, and click behavior. It exposes a state machine (idle, pending-permission, completed-while-hidden) with visual indicators (blue dot, orange dot). `CommandRegistry` registers all 22 commands from `package.json` and delegates to the appropriate manager (WebviewManager, ProcessManager, StatusBarManager, etc.). Terminal mode spawns the CLI in VS Code's integrated terminal instead of the webview.

**Tech Stack:** TypeScript 5.x, VS Code Extension API (StatusBarItem, commands, Terminal), Vitest

**Spec:** [2026-04-02-gakrcli-vscode-extension-design.md](../specs/2026-04-02-gakrcli-vscode-extension-design.md) — Story 9, Sections 4.1, 4.2, 4.3, 5.2

**Dependencies:** Story 2 (ProcessManager for spawn/kill), Story 1 (package.json with all commands, keybindings, settings declared)

**Claude Code extension reference:** `~/.vscode/extensions/anthropic.gakrcli-code-2.1.85-darwin-arm64/extension.js` — the status bar setup and command registration patterns are deminifiable from this file.

---

## File Structure

| File | Responsibility |
|---|---|
| `src/statusbar/statusBarManager.ts` | StatusBarItem creation, state transitions (idle/pending/done-hidden), color indicators, click handler |
| `src/commands/commandRegistry.ts` | Registers all 22 commands, delegates to managers, handles terminal mode routing |
| `src/extension.ts` | Simplified activation: compose managers, remove inline command stubs |
| `test/unit/statusBarManager.test.ts` | Unit tests for state machine transitions and indicator logic |
| `test/unit/commandRegistry.test.ts` | Unit tests for command delegation, terminal-mode routing |

---

## Task 1: StatusBarManager — Extension Host Module

**Files:**
- Create: `src/statusbar/statusBarManager.ts`

The StatusBarManager creates a single `vscode.StatusBarItem` in the bottom-right with the sparkle icon and "gakrcli" label. It manages three visual states:
1. **Idle** — default appearance
2. **Pending permission** — blue dot indicator (permission request waiting for user)
3. **Completed while hidden** — orange dot indicator (Claude finished while tab not visible)

Priority: pending > completed-while-hidden > idle (if both flags set, pending wins).

- [ ] **Step 1: Create the directory**

Run: `mkdir -p /Users/harshagarwal/Documents/workspace/gakrcli-vscode/src/statusbar`

- [ ] **Step 2: Create src/statusbar/statusBarManager.ts**

```typescript
import * as vscode from 'vscode';

export type StatusBarState = 'idle' | 'pending' | 'completed-hidden';

export class StatusBarManager implements vscode.Disposable {
  private item: vscode.StatusBarItem;
  private pendingPermission = false;
  private completedWhileHidden = false;
  private disposables: vscode.Disposable[] = [];

  constructor() {
    // Create status bar item in the bottom-right (StatusBarAlignment.Right, priority 100)
    this.item = vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Right,
      100,
    );

    // Default click action: open the gakrcli panel
    this.item.command = 'gakrcli.editor.openLast';

    // Apply initial state
    this.updateDisplay();

    // Show the status bar item
    this.item.show();

    this.disposables.push(this.item);
  }

  /**
   * Set whether a permission request is pending.
   * Blue dot indicator when true.
   */
  setPendingPermission(pending: boolean): void {
    this.pendingPermission = pending;
    this.updateDisplay();
  }

  /**
   * Set whether Claude completed a response while the panel was hidden.
   * Orange dot indicator when true.
   */
  setCompletedWhileHidden(done: boolean): void {
    this.completedWhileHidden = done;
    this.updateDisplay();
  }

  /**
   * Clear the completed-while-hidden indicator.
   * Call this when the panel is revealed/focused.
   */
  clearCompletedWhileHidden(): void {
    if (this.completedWhileHidden) {
      this.completedWhileHidden = false;
      this.updateDisplay();
    }
  }

  /**
   * Get the current state for debugging/testing.
   */
  getState(): StatusBarState {
    if (this.pendingPermission) return 'pending';
    if (this.completedWhileHidden) return 'completed-hidden';
    return 'idle';
  }

  /**
   * Update the visual display based on current state.
   * Priority: pending (blue) > completed-hidden (orange) > idle (default).
   */
  private updateDisplay(): void {
    if (this.pendingPermission) {
      // Blue dot — permission request waiting
      this.item.text = '$(circle-filled) $(sparkle) gakrcli';
      this.item.tooltip = 'gakrcli — Permission request pending';
      this.item.color = new vscode.ThemeColor('statusBarItem.warningForeground');
      this.item.backgroundColor = new vscode.ThemeColor(
        'statusBarItem.warningBackground',
      );
    } else if (this.completedWhileHidden) {
      // Orange dot — completed while tab hidden
      this.item.text = '$(circle-filled) $(sparkle) gakrcli';
      this.item.tooltip = 'gakrcli — Response ready (click to view)';
      this.item.color = new vscode.ThemeColor(
        'statusBarItem.prominentForeground',
      );
      this.item.backgroundColor = new vscode.ThemeColor(
        'statusBarItem.prominentBackground',
      );
    } else {
      // Idle — default appearance
      this.item.text = '$(sparkle) gakrcli';
      this.item.tooltip = 'gakrcli — Click to open';
      this.item.color = undefined;
      this.item.backgroundColor = undefined;
    }
  }

  /**
   * Hide the status bar item entirely.
   */
  hide(): void {
    this.item.hide();
  }

  /**
   * Show the status bar item.
   */
  show(): void {
    this.item.show();
  }

  dispose(): void {
    for (const d of this.disposables) {
      d.dispose();
    }
    this.disposables = [];
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add src/statusbar/statusBarManager.ts
git commit -m "feat(statusbar): add StatusBarManager with idle, pending, and completed-hidden states"
```

---

## Task 2: Unit Tests for StatusBarManager

**Files:**
- Create: `test/unit/statusBarManager.test.ts`

- [ ] **Step 1: Create the test directory**

Run: `mkdir -p /Users/harshagarwal/Documents/workspace/gakrcli-vscode/test/unit`

- [ ] **Step 2: Create test/unit/statusBarManager.test.ts**

We test the state machine logic. Since `vscode.StatusBarItem` is not available outside the extension host, we test the state transitions by mocking the VS Code API or testing the pure logic.

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Test the StatusBarManager state machine logic.
 *
 * Since vscode.window.createStatusBarItem is not available in Vitest,
 * we mock the VS Code API and test the state transitions.
 */

// Mock the vscode module
vi.mock('vscode', () => ({
  StatusBarAlignment: { Right: 2 },
  ThemeColor: class ThemeColor {
    constructor(public id: string) {}
  },
  window: {
    createStatusBarItem: vi.fn(() => ({
      text: '',
      tooltip: '',
      command: '',
      color: undefined,
      backgroundColor: undefined,
      show: vi.fn(),
      hide: vi.fn(),
      dispose: vi.fn(),
    })),
  },
}));

// Import after mocking
import { StatusBarManager } from '../../src/statusbar/statusBarManager';

describe('StatusBarManager', () => {
  let manager: StatusBarManager;

  beforeEach(() => {
    manager = new StatusBarManager();
  });

  it('should start in idle state', () => {
    expect(manager.getState()).toBe('idle');
  });

  it('should transition to pending when permission request arrives', () => {
    manager.setPendingPermission(true);
    expect(manager.getState()).toBe('pending');
  });

  it('should transition back to idle when permission is resolved', () => {
    manager.setPendingPermission(true);
    expect(manager.getState()).toBe('pending');

    manager.setPendingPermission(false);
    expect(manager.getState()).toBe('idle');
  });

  it('should transition to completed-hidden when response finishes while hidden', () => {
    manager.setCompletedWhileHidden(true);
    expect(manager.getState()).toBe('completed-hidden');
  });

  it('should clear completed-hidden when panel is revealed', () => {
    manager.setCompletedWhileHidden(true);
    expect(manager.getState()).toBe('completed-hidden');

    manager.clearCompletedWhileHidden();
    expect(manager.getState()).toBe('idle');
  });

  it('should prioritize pending over completed-hidden when both flags are set', () => {
    manager.setCompletedWhileHidden(true);
    manager.setPendingPermission(true);
    expect(manager.getState()).toBe('pending');
  });

  it('should fall back to completed-hidden when pending is cleared but completed flag remains', () => {
    manager.setCompletedWhileHidden(true);
    manager.setPendingPermission(true);
    expect(manager.getState()).toBe('pending');

    manager.setPendingPermission(false);
    expect(manager.getState()).toBe('completed-hidden');
  });

  it('should return to idle when both flags are cleared', () => {
    manager.setPendingPermission(true);
    manager.setCompletedWhileHidden(true);

    manager.setPendingPermission(false);
    manager.setCompletedWhileHidden(false);
    expect(manager.getState()).toBe('idle');
  });

  it('should be idempotent — setting same state twice is harmless', () => {
    manager.setPendingPermission(true);
    manager.setPendingPermission(true);
    expect(manager.getState()).toBe('pending');

    manager.setPendingPermission(false);
    expect(manager.getState()).toBe('idle');
  });

  it('should handle clearCompletedWhileHidden when not in completed state', () => {
    expect(manager.getState()).toBe('idle');
    manager.clearCompletedWhileHidden(); // no-op
    expect(manager.getState()).toBe('idle');
  });
});
```

- [ ] **Step 3: Run the tests**

Run: `cd /Users/harshagarwal/Documents/workspace/gakrcli-vscode && npx vitest run test/unit/statusBarManager.test.ts`

Expected: All tests pass.

- [ ] **Step 4: Commit**

```bash
git add test/unit/statusBarManager.test.ts
git commit -m "test(statusbar): add unit tests for status bar state machine transitions"
```

---

## Task 3: CommandRegistry — All 22 Commands

**Files:**
- Create: `src/commands/commandRegistry.ts`

The CommandRegistry registers all 22 commands declared in `package.json` and routes each to the appropriate manager. It replaces the inline placeholder stubs currently in `extension.ts`.

The 22 commands (from package.json, Section 4.1 of spec):

| # | Command ID | Action |
|---|---|---|
| 1 | `gakrcli.editor.open` | Open in new tab (WebviewPanel) |
| 2 | `gakrcli.editor.openLast` | Open (preferred location: sidebar or panel) |
| 3 | `gakrcli.primaryEditor.open` | Open in primary editor area |
| 4 | `gakrcli.window.open` | Open in new window |
| 5 | `gakrcli.sidebar.open` | Open in side bar |
| 6 | `gakrcli.terminal.open` | Open in terminal (spawns CLI in integrated terminal) |
| 7 | `gakrcli.terminal.open.keyboard` | Open in terminal (keyboard shortcut variant) |
| 8 | `gakrcli.createWorktree` | Create git worktree |
| 9 | `gakrcli.newConversation` | Start new conversation |
| 10 | `gakrcli.focus` | Focus the input box |
| 11 | `gakrcli.blur` | Blur the input box (return focus to editor) |
| 12 | `gakrcli.insertAtMention` | Insert @-mention reference |
| 13 | `gakrcli.acceptProposedDiff` | Accept proposed diff changes |
| 14 | `gakrcli.rejectProposedDiff` | Reject proposed diff changes |
| 15 | `gakrcli.showLogs` | Show output channel logs |
| 16 | `gakrcli.openWalkthrough` | Open the walkthrough |
| 17 | `gakrcli.update` | Update extension |
| 18 | `gakrcli.installPlugin` | Install a plugin |
| 19 | `gakrcli.logout` | Logout |
| 20 | `gakrcli.selectProvider` | Select provider |
| 21 | `gakrcli.resumeSession` | Resume a session (internal, from Story 8) |
| 22 | `gakrcli.useTerminal` | N/A — this is a setting, not a command |

- [ ] **Step 1: Create the directory**

Run: `mkdir -p /Users/harshagarwal/Documents/workspace/gakrcli-vscode/src/commands`

- [ ] **Step 2: Create src/commands/commandRegistry.ts**

```typescript
import * as vscode from 'vscode';

/**
 * Dependencies injected from extension.ts.
 * Each manager may or may not exist yet depending on which stories are implemented.
 */
export interface CommandRegistryDeps {
  context: vscode.ExtensionContext;
  output: vscode.OutputChannel;
  /** Open a webview panel in a specific location */
  openPanel: (location: 'tab' | 'sidebar' | 'primary' | 'newWindow') => void;
  /** Open the preferred location (respects gakrcliCode.preferredLocation setting) */
  openPreferred: () => void;
  /** Focus the input box in the active webview */
  focusInput: () => void;
  /** Blur the input box (return focus to editor) */
  blurInput: () => void;
  /** Start a new conversation (kill existing CLI, spawn fresh) */
  newConversation: () => void;
  /** Resume a session by ID */
  resumeSession: (sessionId: string) => void;
  /** Insert @-mention reference at cursor */
  insertAtMention: () => void;
  /** Accept currently shown diff */
  acceptDiff: () => void;
  /** Reject currently shown diff */
  rejectDiff: () => void;
  /** Open CLI in integrated terminal */
  openTerminal: () => void;
  /** Create a git worktree */
  createWorktree: () => void;
  /** Logout from provider */
  logout: () => void;
  /** Open provider picker */
  selectProvider: () => void;
  /** Install a plugin */
  installPlugin: () => void;
}

export class CommandRegistry implements vscode.Disposable {
  private disposables: vscode.Disposable[] = [];

  constructor(private readonly deps: CommandRegistryDeps) {}

  /**
   * Register all 22 commands declared in package.json.
   * Commands that depend on unimplemented stories show a "Coming soon" message.
   */
  registerAll(): void {
    const { context, output, deps } = { deps: this.deps, context: this.deps.context, output: this.deps.output };

    this.register('gakrcli.editor.open', () => {
      if (this.isTerminalMode()) {
        deps.openTerminal();
      } else {
        deps.openPanel('tab');
      }
    });

    this.register('gakrcli.editor.openLast', () => {
      if (this.isTerminalMode()) {
        deps.openTerminal();
      } else {
        deps.openPreferred();
      }
    });

    this.register('gakrcli.primaryEditor.open', () => {
      if (this.isTerminalMode()) {
        deps.openTerminal();
      } else {
        deps.openPanel('primary');
      }
    });

    this.register('gakrcli.window.open', () => {
      deps.openPanel('newWindow');
    });

    this.register('gakrcli.sidebar.open', () => {
      deps.openPanel('sidebar');
    });

    this.register('gakrcli.terminal.open', () => {
      deps.openTerminal();
    });

    this.register('gakrcli.terminal.open.keyboard', () => {
      deps.openTerminal();
    });

    this.register('gakrcli.createWorktree', () => {
      deps.createWorktree();
    });

    this.register('gakrcli.newConversation', () => {
      deps.newConversation();
    });

    this.register('gakrcli.focus', () => {
      deps.focusInput();
    });

    this.register('gakrcli.blur', () => {
      deps.blurInput();
    });

    this.register('gakrcli.insertAtMention', () => {
      deps.insertAtMention();
    });

    this.register('gakrcli.acceptProposedDiff', () => {
      deps.acceptDiff();
    });

    this.register('gakrcli.rejectProposedDiff', () => {
      deps.rejectDiff();
    });

    this.register('gakrcli.showLogs', () => {
      output.show();
    });

    this.register('gakrcli.openWalkthrough', () => {
      vscode.commands.executeCommand(
        'workbench.action.openWalkthrough',
        'gajjalaashok75-UI.gakrcli-vscode#gakrcli-walkthrough',
        false,
      );
    });

    this.register('gakrcli.update', () => {
      vscode.window.showInformationMessage(
        'gakrcli: Check the VS Code marketplace for updates.',
      );
    });

    this.register('gakrcli.installPlugin', () => {
      deps.installPlugin();
    });

    this.register('gakrcli.logout', () => {
      deps.logout();
    });

    this.register('gakrcli.selectProvider', () => {
      deps.selectProvider();
    });

    // Internal command used by SessionTracker (Story 8)
    this.register('gakrcli.resumeSession', (sessionId: string) => {
      deps.resumeSession(sessionId);
    });
  }

  /**
   * Check if terminal mode is enabled via the gakrcliCode.useTerminal setting.
   */
  private isTerminalMode(): boolean {
    return vscode.workspace
      .getConfiguration('gakrcliCode')
      .get<boolean>('useTerminal', false);
  }

  /**
   * Register a single command and track its disposable.
   */
  private register(id: string, handler: (...args: unknown[]) => void): void {
    const disposable = vscode.commands.registerCommand(id, handler);
    this.deps.context.subscriptions.push(disposable);
    this.disposables.push(disposable);
  }

  dispose(): void {
    for (const d of this.disposables) {
      d.dispose();
    }
    this.disposables = [];
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add src/commands/commandRegistry.ts
git commit -m "feat(commands): add CommandRegistry with all 22 commands and terminal mode routing"
```

---

## Task 4: Unit Tests for CommandRegistry

**Files:**
- Create: `test/unit/commandRegistry.test.ts`

- [ ] **Step 1: Create test/unit/commandRegistry.test.ts**

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Track all registered commands
const registeredCommands: Map<string, (...args: unknown[]) => void> = new Map();

vi.mock('vscode', () => ({
  StatusBarAlignment: { Right: 2 },
  ThemeColor: class ThemeColor {
    constructor(public id: string) {}
  },
  commands: {
    registerCommand: vi.fn((id: string, handler: (...args: unknown[]) => void) => {
      registeredCommands.set(id, handler);
      return { dispose: vi.fn() };
    }),
    executeCommand: vi.fn(),
  },
  workspace: {
    getConfiguration: vi.fn(() => ({
      get: vi.fn((key: string, defaultValue: unknown) => {
        if (key === 'useTerminal') return false;
        return defaultValue;
      }),
    })),
  },
  window: {
    showInformationMessage: vi.fn(),
    createStatusBarItem: vi.fn(() => ({
      text: '',
      tooltip: '',
      command: '',
      color: undefined,
      backgroundColor: undefined,
      show: vi.fn(),
      hide: vi.fn(),
      dispose: vi.fn(),
    })),
  },
}));

import { CommandRegistry, CommandRegistryDeps } from '../../src/commands/commandRegistry';

describe('CommandRegistry', () => {
  let deps: CommandRegistryDeps;
  let registry: CommandRegistry;

  beforeEach(() => {
    registeredCommands.clear();
    deps = {
      context: { subscriptions: [] } as unknown as CommandRegistryDeps['context'],
      output: { show: vi.fn(), dispose: vi.fn() } as unknown as CommandRegistryDeps['output'],
      openPanel: vi.fn(),
      openPreferred: vi.fn(),
      focusInput: vi.fn(),
      blurInput: vi.fn(),
      newConversation: vi.fn(),
      resumeSession: vi.fn(),
      insertAtMention: vi.fn(),
      acceptDiff: vi.fn(),
      rejectDiff: vi.fn(),
      openTerminal: vi.fn(),
      createWorktree: vi.fn(),
      logout: vi.fn(),
      selectProvider: vi.fn(),
      installPlugin: vi.fn(),
    };
    registry = new CommandRegistry(deps);
    registry.registerAll();
  });

  it('should register all 21 expected commands', () => {
    const expectedCommands = [
      'gakrcli.editor.open',
      'gakrcli.editor.openLast',
      'gakrcli.primaryEditor.open',
      'gakrcli.window.open',
      'gakrcli.sidebar.open',
      'gakrcli.terminal.open',
      'gakrcli.terminal.open.keyboard',
      'gakrcli.createWorktree',
      'gakrcli.newConversation',
      'gakrcli.focus',
      'gakrcli.blur',
      'gakrcli.insertAtMention',
      'gakrcli.acceptProposedDiff',
      'gakrcli.rejectProposedDiff',
      'gakrcli.showLogs',
      'gakrcli.openWalkthrough',
      'gakrcli.update',
      'gakrcli.installPlugin',
      'gakrcli.logout',
      'gakrcli.selectProvider',
      'gakrcli.resumeSession',
    ];

    for (const cmd of expectedCommands) {
      expect(registeredCommands.has(cmd)).toBe(true);
    }
  });

  it('gakrcli.editor.open should open a tab panel', () => {
    const handler = registeredCommands.get('gakrcli.editor.open')!;
    handler();
    expect(deps.openPanel).toHaveBeenCalledWith('tab');
  });

  it('gakrcli.sidebar.open should open the sidebar', () => {
    const handler = registeredCommands.get('gakrcli.sidebar.open')!;
    handler();
    expect(deps.openPanel).toHaveBeenCalledWith('sidebar');
  });

  it('gakrcli.newConversation should call newConversation', () => {
    const handler = registeredCommands.get('gakrcli.newConversation')!;
    handler();
    expect(deps.newConversation).toHaveBeenCalled();
  });

  it('gakrcli.focus should call focusInput', () => {
    const handler = registeredCommands.get('gakrcli.focus')!;
    handler();
    expect(deps.focusInput).toHaveBeenCalled();
  });

  it('gakrcli.blur should call blurInput', () => {
    const handler = registeredCommands.get('gakrcli.blur')!;
    handler();
    expect(deps.blurInput).toHaveBeenCalled();
  });

  it('gakrcli.terminal.open should call openTerminal', () => {
    const handler = registeredCommands.get('gakrcli.terminal.open')!;
    handler();
    expect(deps.openTerminal).toHaveBeenCalled();
  });

  it('gakrcli.showLogs should show the output channel', () => {
    const handler = registeredCommands.get('gakrcli.showLogs')!;
    handler();
    expect(deps.output.show).toHaveBeenCalled();
  });

  it('gakrcli.resumeSession should pass sessionId to resumeSession', () => {
    const handler = registeredCommands.get('gakrcli.resumeSession')!;
    handler('test-session-uuid');
    expect(deps.resumeSession).toHaveBeenCalledWith('test-session-uuid');
  });

  it('gakrcli.acceptProposedDiff should call acceptDiff', () => {
    const handler = registeredCommands.get('gakrcli.acceptProposedDiff')!;
    handler();
    expect(deps.acceptDiff).toHaveBeenCalled();
  });

  it('gakrcli.rejectProposedDiff should call rejectDiff', () => {
    const handler = registeredCommands.get('gakrcli.rejectProposedDiff')!;
    handler();
    expect(deps.rejectDiff).toHaveBeenCalled();
  });
});

describe('CommandRegistry — terminal mode', () => {
  it('gakrcli.editor.open should route to terminal when useTerminal is true', () => {
    registeredCommands.clear();

    // Re-mock to return useTerminal=true
    const vscode = await import('vscode');
    vi.mocked(vscode.workspace.getConfiguration).mockReturnValue({
      get: vi.fn((key: string, defaultValue: unknown) => {
        if (key === 'useTerminal') return true;
        return defaultValue;
      }),
    } as unknown as ReturnType<typeof vscode.workspace.getConfiguration>);

    const deps: CommandRegistryDeps = {
      context: { subscriptions: [] } as unknown as CommandRegistryDeps['context'],
      output: { show: vi.fn(), dispose: vi.fn() } as unknown as CommandRegistryDeps['output'],
      openPanel: vi.fn(),
      openPreferred: vi.fn(),
      focusInput: vi.fn(),
      blurInput: vi.fn(),
      newConversation: vi.fn(),
      resumeSession: vi.fn(),
      insertAtMention: vi.fn(),
      acceptDiff: vi.fn(),
      rejectDiff: vi.fn(),
      openTerminal: vi.fn(),
      createWorktree: vi.fn(),
      logout: vi.fn(),
      selectProvider: vi.fn(),
      installPlugin: vi.fn(),
    };

    const reg = new CommandRegistry(deps);
    reg.registerAll();

    const handler = registeredCommands.get('gakrcli.editor.open')!;
    handler();
    expect(deps.openTerminal).toHaveBeenCalled();
    expect(deps.openPanel).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run the tests**

Run: `cd /Users/harshagarwal/Documents/workspace/gakrcli-vscode && npx vitest run test/unit/commandRegistry.test.ts`

Expected: All tests pass.

- [ ] **Step 3: Commit**

```bash
git add test/unit/commandRegistry.test.ts
git commit -m "test(commands): add unit tests for command registry delegation and terminal mode"
```

---

## Task 5: Terminal Mode Implementation

**Files:**
- Create helper in `src/commands/terminalManager.ts`

When `gakrcliCode.useTerminal` is `true`, panel-opening commands should spawn the gakrcli CLI in VS Code's integrated terminal instead of showing the webview.

- [ ] **Step 1: Create src/commands/terminalManager.ts**

```typescript
import * as vscode from 'vscode';

/**
 * Manages the gakrcli integrated terminal instance.
 * When terminal mode is enabled, this spawns the CLI in VS Code's terminal.
 */
export class TerminalManager implements vscode.Disposable {
  private terminal: vscode.Terminal | undefined;
  private disposables: vscode.Disposable[] = [];

  constructor() {
    // Listen for terminal close events to clean up our reference
    vscode.window.onDidCloseTerminal(
      (closedTerminal) => {
        if (closedTerminal === this.terminal) {
          this.terminal = undefined;
        }
      },
      undefined,
      this.disposables,
    );
  }

  /**
   * Open or focus the gakrcli terminal.
   * Resolves the CLI binary and spawns it with appropriate flags.
   */
  open(): void {
    if (this.terminal) {
      // Terminal already exists — just focus it
      this.terminal.show();
      return;
    }

    const config = vscode.workspace.getConfiguration('gakrcliCode');
    const processWrapper = config.get<string>('gakrcliProcessWrapper', '');

    // Determine the CLI command
    const cliCommand = processWrapper || 'gakrcli';

    // Get workspace folder for cwd
    const cwd = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;

    // Build environment variables
    const env: Record<string, string> = {};
    const envVars = config.get<Array<{ name: string; value: string }>>(
      'environmentVariables',
      [],
    );
    for (const v of envVars) {
      env[v.name] = v.value;
    }

    // Create the terminal
    this.terminal = vscode.window.createTerminal({
      name: 'gakrcli',
      cwd,
      env,
      iconPath: new vscode.ThemeIcon('sparkle'),
    });

    // Send the CLI command
    const flags: string[] = [];
    const model = config.get<string>('selectedModel', 'default');
    if (model && model !== 'default') {
      flags.push('--model', model);
    }
    const permMode = config.get<string>('initialPermissionMode', 'default');
    if (permMode && permMode !== 'default') {
      flags.push('--permission-mode', permMode);
    }

    const fullCommand = [cliCommand, ...flags].join(' ');
    this.terminal.sendText(fullCommand);
    this.terminal.show();
  }

  dispose(): void {
    this.terminal?.dispose();
    for (const d of this.disposables) {
      d.dispose();
    }
    this.disposables = [];
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/commands/terminalManager.ts
git commit -m "feat(commands): add TerminalManager for spawning CLI in integrated terminal"
```

---

## Task 6: Refactor extension.ts to Use Managers

**Files:**
- Modify: `src/extension.ts`

Replace the inline command stubs with proper manager composition. This is the key integration step that ties StatusBarManager, CommandRegistry, and TerminalManager together.

- [ ] **Step 1: Rewrite the activate function**

Replace the current `activate()` body with:

```typescript
import * as vscode from 'vscode';
import { StatusBarManager } from './statusbar/statusBarManager';
import { CommandRegistry, CommandRegistryDeps } from './commands/commandRegistry';
import { TerminalManager } from './commands/terminalManager';
// These imports depend on other stories — guard with conditional checks:
// import { ProcessManager } from './process/processManager';
// import { WebviewManager } from './webview/webviewManager';
// import { SessionTracker } from './session/sessionTracker';

export async function activate(context: vscode.ExtensionContext) {
  console.log('gakrcli VS Code extension activated');

  // Output channel for logs
  const output = vscode.window.createOutputChannel('gakrcli');
  context.subscriptions.push(output);

  // Status bar
  const statusBar = new StatusBarManager();
  context.subscriptions.push(statusBar);

  // Terminal manager
  const terminalManager = new TerminalManager();
  context.subscriptions.push(terminalManager);

  // Placeholder functions for managers not yet implemented
  // These will be replaced as other stories are merged
  const notImplemented = (feature: string) => () => {
    vscode.window.showInformationMessage(`gakrcli: ${feature} coming soon!`);
  };

  // Command registry
  const commandDeps: CommandRegistryDeps = {
    context,
    output,
    openPanel: (location) => {
      // TODO: Replace with webviewManager.openPanel(location) from Story 3
      notImplemented(`Open panel (${location})`)();
    },
    openPreferred: () => {
      // TODO: Replace with webviewManager.openPreferred() from Story 3
      const pref = vscode.workspace
        .getConfiguration('gakrcliCode')
        .get<string>('preferredLocation', 'panel');
      notImplemented(`Open preferred (${pref})`)();
    },
    focusInput: () => {
      // TODO: Replace with webviewManager.focusInput() from Story 3
      notImplemented('Focus input')();
    },
    blurInput: () => {
      // TODO: Return focus to editor
      vscode.commands.executeCommand('workbench.action.focusActiveEditorGroup');
    },
    newConversation: () => {
      // TODO: Replace with processManager.spawnFresh() from Story 2
      notImplemented('New conversation')();
    },
    resumeSession: (sessionId: string) => {
      // TODO: Replace with processManager.spawnWithResume() from Stories 2+8
      notImplemented(`Resume session ${sessionId}`)();
    },
    insertAtMention: () => {
      // TODO: Replace with atMentionProvider.trigger() from Story 5
      notImplemented('Insert @-mention')();
    },
    acceptDiff: () => {
      // TODO: Replace with diffManager.accept() from Story 6
      notImplemented('Accept diff')();
    },
    rejectDiff: () => {
      // TODO: Replace with diffManager.reject() from Story 6
      notImplemented('Reject diff')();
    },
    openTerminal: () => {
      terminalManager.open();
    },
    createWorktree: () => {
      // TODO: Replace with worktreeManager.create() from Story 14
      notImplemented('Create worktree')();
    },
    logout: () => {
      // TODO: Replace with authManager.logout() from Story 11
      notImplemented('Logout')();
    },
    selectProvider: () => {
      // TODO: Replace with providerPicker.show() from Story 11
      notImplemented('Select provider')();
    },
    installPlugin: () => {
      // TODO: Replace with pluginManager.install() from Story 13
      notImplemented('Install plugin')();
    },
  };

  const commandRegistry = new CommandRegistry(commandDeps);
  commandRegistry.registerAll();
  context.subscriptions.push(commandRegistry);

  // --- Status bar event wiring ---

  // Wire: permission request pending -> blue dot
  // (Will be connected to processManager.onControlRequest in Story 7)
  // processManager.onControlRequest((req) => {
  //   if (req.subtype === 'can_use_tool') {
  //     statusBar.setPendingPermission(true);
  //   }
  // });

  // Wire: permission resolved -> clear blue dot
  // processManager.onControlResponse(() => {
  //   statusBar.setPendingPermission(false);
  // });

  // Wire: response complete while panel hidden -> orange dot
  // processManager.onMessage((msg) => {
  //   if (msg.type === 'result' && !webviewManager.isAnyPanelVisible()) {
  //     statusBar.setCompletedWhileHidden(true);
  //   }
  // });

  // Wire: panel revealed -> clear orange dot
  // webviewManager.onPanelRevealed(() => {
  //   statusBar.clearCompletedWhileHidden();
  // });

  output.appendLine('gakrcli extension activated successfully');
}

export function deactivate() {
  console.log('gakrcli VS Code extension deactivated');
}
```

- [ ] **Step 2: Build the extension**

Run: `cd /Users/harshagarwal/Documents/workspace/gakrcli-vscode && npm run build`

Expected: Build succeeds with no TypeScript errors.

- [ ] **Step 3: Verify F5 launches and commands work**

1. Press F5 to open the Extension Development Host
2. Open the Command Palette (Cmd+Shift+P)
3. Type "gakrcli" — all 22 commands should appear
4. Click "gakrcli: Open in Terminal" — an integrated terminal should spawn with the `gakrcli` command
5. Check the bottom-right status bar — "gakrcli" with sparkle icon should be visible
6. Click the status bar item — it should try to open the panel

- [ ] **Step 4: Commit**

```bash
git add src/extension.ts
git commit -m "refactor: replace inline command stubs with StatusBarManager, CommandRegistry, and TerminalManager"
```

---

## Task 7: Wire Live Status Bar Transitions

**Files:**
- Modify: `src/extension.ts`
- Modify: `src/webview/webviewProvider.ts` (if it exists from Story 3)

Connect real events to the status bar state changes. The full wiring requires Story 2 (ProcessManager) and Story 7 (PermissionHandler), but we can wire what is available.

- [ ] **Step 1: Wire panel visibility to clear the orange dot**

If `webviewProvider.ts` or `webviewManager.ts` exists from Story 3, add:

```typescript
// In extension.ts, after creating webviewManager:
webviewManager.onPanelRevealed(() => {
  statusBar.clearCompletedWhileHidden();
});
```

If the webview manager doesn't exist yet, add a TODO comment:

```typescript
// TODO: Wire webviewManager.onPanelRevealed -> statusBar.clearCompletedWhileHidden()
// This depends on Story 3 (WebviewManager)
```

- [ ] **Step 2: Wire permission events from processManager**

If `processManager.ts` exists from Story 2, add:

```typescript
// Wire permission request pending
processManager.onControlRequest((req) => {
  if (req.request?.subtype === 'can_use_tool') {
    statusBar.setPendingPermission(true);
  }
});

// Wire permission resolved (user responded or CLI canceled)
processManager.onMessage((msg) => {
  if (
    msg.type === 'control_cancel_request' ||
    (msg.type === 'control_response' && msg.response?.subtype === 'success')
  ) {
    statusBar.setPendingPermission(false);
  }
});
```

If processManager doesn't exist yet, add TODO comments.

- [ ] **Step 3: Wire result events for completed-while-hidden**

```typescript
// Wire: CLI sends 'result' type while no panel is visible -> orange dot
processManager.onMessage((msg) => {
  if (msg.type === 'result') {
    const anyVisible = webviewManager?.isAnyPanelVisible() ?? false;
    if (!anyVisible) {
      statusBar.setCompletedWhileHidden(true);
    }
  }
});
```

- [ ] **Step 4: Commit**

```bash
git add src/extension.ts
git commit -m "feat(statusbar): wire live status bar transitions for permission and completion events"
```

---

## Task 8: Verify Keyboard Shortcuts

**Files:** No files to create — keybindings are declared in `package.json` from Story 1.

This task verifies that the 5 keyboard shortcuts declared in `package.json` are working correctly with the commands we just registered.

The 5 keybindings (from package.json, Section 4.2 of spec):

| Shortcut (Mac) | Shortcut (Win/Linux) | Command | When |
|---|---|---|---|
| `Cmd+Escape` | `Ctrl+Escape` | `gakrcli.focus` | `!gakrcliCode.useTerminal` |
| `Cmd+Shift+Escape` | `Ctrl+Shift+Escape` | `gakrcli.editor.open` | `!gakrcliCode.useTerminal` |
| `Alt+K` | `Alt+K` | `gakrcli.insertAtMention` | `editorFocus` |
| `Cmd+Alt+K` | `Ctrl+Alt+K` | `gakrcli.insertAtMention` | `editorFocus` (terminal variant) |
| `Cmd+N` | `Ctrl+N` | `gakrcli.newConversation` | `gakrcli.panelFocused && gakrcliCode.enableNewConversationShortcut` |

- [ ] **Step 1: Verify keybindings exist in package.json**

Run: `cd /Users/harshagarwal/Documents/workspace/gakrcli-vscode && node -e "const p = require('./package.json'); console.log('Keybindings:', p.contributes.keybindings?.length || 0); p.contributes.keybindings?.forEach(k => console.log(' ', k.command, k.key, k.mac))"`

Expected: 5 keybindings listed.

- [ ] **Step 2: Manual verification in Extension Development Host**

1. F5 to open Extension Development Host
2. Press `Cmd+Escape` — should trigger `gakrcli.focus` (focus input)
3. Press `Cmd+Shift+Escape` — should trigger `gakrcli.editor.open` (open in new tab)
4. With an editor focused, press `Alt+K` — should trigger `gakrcli.insertAtMention`
5. Enable `gakrcliCode.enableNewConversationShortcut` in settings, then press `Cmd+N` while panel is focused — should trigger `gakrcli.newConversation`

- [ ] **Step 3: Set context keys for when-clause evaluation**

Add to `extension.ts` after activation:

```typescript
// Set context keys used in keybinding when-clauses
vscode.commands.executeCommand('setContext', 'gakrcliCode.useTerminal', false);
vscode.commands.executeCommand(
  'setContext',
  'gakrcliCode.enableNewConversationShortcut',
  vscode.workspace.getConfiguration('gakrcliCode').get('enableNewConversationShortcut', false),
);

// Update context keys when settings change
vscode.workspace.onDidChangeConfiguration(
  (e) => {
    if (e.affectsConfiguration('gakrcliCode.useTerminal')) {
      const val = vscode.workspace.getConfiguration('gakrcliCode').get('useTerminal', false);
      vscode.commands.executeCommand('setContext', 'gakrcliCode.useTerminal', val);
    }
    if (e.affectsConfiguration('gakrcliCode.enableNewConversationShortcut')) {
      const val = vscode.workspace
        .getConfiguration('gakrcliCode')
        .get('enableNewConversationShortcut', false);
      vscode.commands.executeCommand(
        'setContext',
        'gakrcliCode.enableNewConversationShortcut',
        val,
      );
    }
  },
  undefined,
  context.subscriptions,
);
```

- [ ] **Step 4: Commit**

```bash
git add src/extension.ts
git commit -m "feat(commands): set context keys for keybinding when-clauses and settings sync"
```

---

## Task 9: Build and End-to-End Verification

- [ ] **Step 1: Build the entire extension**

Run: `cd /Users/harshagarwal/Documents/workspace/gakrcli-vscode && npm run build`

Expected: Build succeeds.

- [ ] **Step 2: Run all tests**

Run: `cd /Users/harshagarwal/Documents/workspace/gakrcli-vscode && npx vitest run test/unit/statusBarManager.test.ts test/unit/commandRegistry.test.ts`

Expected: All tests pass.

- [ ] **Step 3: Manual verification (F5 Extension Development Host)**

1. Status bar shows "$(sparkle) gakrcli" in bottom-right
2. Click status bar item -> opens gakrcli panel (or shows "Coming soon" if Story 3 not merged)
3. Command Palette (Cmd+Shift+P) shows all 22 "gakrcli:" commands
4. `Cmd+Escape` toggles focus between editor and gakrcli input
5. `Cmd+Shift+Escape` opens gakrcli in new tab
6. `Alt+K` triggers @-mention insertion
7. "gakrcli: Open in Terminal" spawns CLI in integrated terminal
8. Terminal opens with correct cwd and model flags

---

## Verification Checklist (maps to acceptance criteria)

- [ ] Status bar item "gakrcli" with spark icon in bottom-right -- visual check
- [ ] Blue dot when permission request is pending -- call `statusBar.setPendingPermission(true)` from debug console
- [ ] Orange dot when Claude finishes while tab is hidden -- call `statusBar.setCompletedWhileHidden(true)` from debug console
- [ ] Click status bar -> opens gakrcli panel -- click and verify
- [ ] All 22 commands registered and working in Command Palette -- Cmd+Shift+P, type "gakrcli"
- [ ] Cmd+Escape toggles focus between editor and gakrcli input -- press shortcut
- [ ] Cmd+Shift+Escape opens new tab -- press shortcut
- [ ] Alt+K inserts @-mention -- press shortcut with editor focused
- [ ] Cmd+N starts new conversation (when setting enabled) -- enable setting, press shortcut
- [ ] Terminal mode: `gakrcliCode.useTerminal` spawns CLI in integrated terminal -- enable setting, run open command
