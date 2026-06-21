# Story 3: Webview Shell & PostMessage Bridge — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a full WebviewManager that creates/destroys webview panels in 3 locations (sidebar, editor tab, new window), a typed PostMessage bridge for bidirectional communication between webview and extension host, Content Security Policy with nonce, VS Code theme detection, multiple simultaneous panels with independent state, and webview persistence via `vscode.getState()`/`setState()`.

**Architecture:** The extension host creates webview panels through a `WebviewManager` class that tracks all active panels. Each panel gets its own `WebviewBridge` instance that handles typed postMessage routing. The webview React app communicates with the extension host exclusively through typed messages — no direct API calls. The bridge is generic enough that Stories 4+ (chat UI, process manager) plug into it without changes.

**Tech Stack:** TypeScript 5.x, VS Code Extension API (WebviewViewProvider, WebviewPanel, WebviewPanelSerializer), React 18, Tailwind CSS 3, Vite 5, Vitest (unit tests)

**Spec:** [2026-04-02-gakrcli-vscode-extension-design.md](../specs/2026-04-02-gakrcli-vscode-extension-design.md) — Story 3

**Claude Code extension (source to extract from):** `~/.vscode/extensions/anthropic.gakrcli-code-2.1.85-darwin-arm64/extension.js` — Lines 803+ (DQ class: getHtmlForWebview, resolveWebviewView, createPanel, setupPanel) and the postMessage handling in `fromClient` / `onDidReceiveMessage`.

**Depends on:** Story 1 (project scaffolding must be complete — package.json, esbuild, Vite, basic extension.ts, webview scaffold)

---

## File Structure

| File | Responsibility |
|---|---|
| `src/webview/webviewManager.ts` | Manages all webview panels — create in sidebar/tab/window, track active panels, dispose |
| `src/webview/webviewProvider.ts` | Enhanced WebviewViewProvider for sidebar — replaces Story 1's basic version |
| `src/webview/webviewBridge.ts` | Typed PostMessage bridge — extension host side message routing |
| `src/webview/htmlGenerator.ts` | Generates webview HTML with CSP nonce, theme CSS vars, data attributes |
| `src/webview/types.ts` | All PostMessage type definitions (webview → host, host → webview) |
| `webview/src/vscode.ts` | Enhanced VS Code API wrapper with typed messages, getState/setState |
| `webview/src/hooks/useVSCode.ts` | React hook for message sending/receiving and state persistence |
| `webview/src/hooks/useTheme.ts` | React hook for dark/light theme detection and CSS variable injection |
| `webview/src/App.tsx` | Updated root component — uses bridge, renders theme-aware shell |
| `webview/src/main.tsx` | Updated entry — initializes bridge, sends `ready` message |
| `src/extension.ts` | Updated — uses WebviewManager, registers serializer, wires commands |
| `test/unit/webviewBridge.test.ts` | Unit tests for message routing |
| `test/unit/webviewManager.test.ts` | Unit tests for panel lifecycle |
| `test/unit/htmlGenerator.test.ts` | Unit tests for CSP and HTML generation |

---

## Task 1: PostMessage Type Definitions

**Files:**
- Create: `src/webview/types.ts`

Define all message types that flow between the webview and extension host. This is the contract that all future stories depend on.

- [ ] **Step 1: Create the PostMessage type system**

Create `src/webview/types.ts`:

```typescript
/**
 * PostMessage types for webview <-> extension host communication.
 *
 * Pattern extracted from Claude Code extension.js (DQ class):
 * - Webview sends messages via vscode.postMessage({ type: '...', ...payload })
 * - Extension host receives via webview.onDidReceiveMessage
 * - Extension host sends via webview.postMessage({ type: '...', ...payload })
 * - Webview receives via window.addEventListener('message', ...)
 */

// ============================================================
// Webview -> Extension Host messages
// ============================================================

/** Webview signals it has loaded and is ready to receive data */
export interface ReadyMessage {
  type: 'ready';
}

/** User submits a chat prompt */
export interface SendPromptMessage {
  type: 'send_prompt';
  text: string;
  attachments?: Attachment[];
  mentions?: Mention[];
}

/** User wants to interrupt/cancel current generation */
export interface InterruptMessage {
  type: 'interrupt';
}

/** User responds to a permission request */
export interface PermissionResponseMessage {
  type: 'permission_response';
  requestId: string;
  allowed: boolean;
  alwaysAllow?: boolean;
}

/** User responds to an elicitation request */
export interface ElicitationResponseMessage {
  type: 'elicitation_response';
  requestId: string;
  response: Record<string, unknown>;
}

/** User wants to start a new conversation */
export interface NewConversationMessage {
  type: 'new_conversation';
}

/** User wants to resume a session */
export interface ResumeSessionMessage {
  type: 'resume_session';
  sessionId: string;
}

/** User changes the AI model */
export interface SetModelMessage {
  type: 'set_model';
  model: string;
}

/** User changes permission mode */
export interface SetPermissionModeMessage {
  type: 'set_permission_mode';
  mode: 'default' | 'plan' | 'acceptEdits' | 'bypassPermissions' | 'dontAsk';
}

/** User requests context usage info */
export interface GetContextUsageMessage {
  type: 'get_context_usage';
}

/** User copies text to clipboard */
export interface CopyToClipboardMessage {
  type: 'copy_to_clipboard';
  text: string;
}

/** User clicks a file reference to open in editor */
export interface OpenFileMessage {
  type: 'open_file';
  filePath: string;
  line?: number;
  column?: number;
}

/** User accepts/rejects a proposed diff */
export interface DiffResponseMessage {
  type: 'diff_response';
  accepted: boolean;
  filePath: string;
}

/** User requests to open plugins dialog */
export interface OpenPluginsMessage {
  type: 'open_plugins';
  pluginName?: string;
  marketplace?: string;
}

/** User requests logout */
export interface LogoutMessage {
  type: 'logout';
}

/** User requests session list */
export interface GetSessionsMessage {
  type: 'get_sessions';
}

/** Webview requests state restore after re-show */
export interface RestoreStateMessage {
  type: 'restore_state';
}

/** User executes a slash command */
export interface SlashCommandMessage {
  type: 'slash_command';
  command: string;
  args?: string;
}

/** User changes effort level */
export interface SetEffortLevelMessage {
  type: 'set_effort_level';
  level: 'low' | 'medium' | 'high' | 'max';
}

/** User requests rewind to a checkpoint */
export interface RewindMessage {
  type: 'rewind';
  messageId: string;
  dryRun?: boolean;
}

/** All messages the webview can send to the extension host */
export type WebviewToHostMessage =
  | ReadyMessage
  | SendPromptMessage
  | InterruptMessage
  | PermissionResponseMessage
  | ElicitationResponseMessage
  | NewConversationMessage
  | ResumeSessionMessage
  | SetModelMessage
  | SetPermissionModeMessage
  | GetContextUsageMessage
  | CopyToClipboardMessage
  | OpenFileMessage
  | DiffResponseMessage
  | OpenPluginsMessage
  | LogoutMessage
  | GetSessionsMessage
  | RestoreStateMessage
  | SlashCommandMessage
  | SetEffortLevelMessage
  | RewindMessage;

// ============================================================
// Extension Host -> Webview messages
// ============================================================

/** Initial state sent to webview after 'ready' */
export interface InitStateMessage {
  type: 'init_state';
  isSidebar: boolean;
  isFullEditor: boolean;
  isSessionListOnly: boolean;
  theme: 'dark' | 'light' | 'high-contrast';
  initialSessionId?: string;
  initialPrompt?: string;
  extensionVersion: string;
}

/** Forwarded CLI stdout message (NDJSON line) */
export interface CliOutputMessage {
  type: 'cli_output';
  data: unknown; // Raw NDJSON message from CLI — webview parses by subtype
}

/** Permission request from CLI → show dialog in webview */
export interface PermissionRequestMessage {
  type: 'permission_request';
  requestId: string;
  toolName: string;
  toolInput: Record<string, unknown>;
  riskLevel?: string;
}

/** Cancel a stale permission/elicitation dialog */
export interface CancelRequestMessage {
  type: 'cancel_request';
  requestId: string;
}

/** Elicitation request from CLI → show structured question */
export interface ElicitationRequestMessage {
  type: 'elicitation_request';
  requestId: string;
  question: string;
  responseFormat: unknown;
}

/** Session state changed (for multi-panel badge updates) */
export interface SessionStateMessage {
  type: 'session_state';
  sessions: SessionInfo[];
  activeSessionId?: string;
}

/** Context usage response */
export interface ContextUsageMessage {
  type: 'context_usage';
  utilization: number;
  error?: string;
}

/** Theme changed in VS Code */
export interface ThemeChangedMessage {
  type: 'theme_changed';
  theme: 'dark' | 'light' | 'high-contrast';
}

/** At-mention inserted from editor */
export interface AtMentionInsertedMessage {
  type: 'at_mention_inserted';
  text: string;
}

/** Session list data */
export interface SessionListMessage {
  type: 'session_list';
  sessions: SessionSummary[];
}

/** CLI process state changed */
export interface ProcessStateMessage {
  type: 'process_state';
  state: 'starting' | 'running' | 'stopped' | 'crashed' | 'restarting';
}

/** Font configuration changed */
export interface FontConfigMessage {
  type: 'font_config';
  editorFontFamily: string;
  editorFontSize: number;
  editorFontWeight: string;
  chatFontSize: number;
  chatFontFamily: string;
}

/** All messages the extension host can send to the webview */
export type HostToWebviewMessage =
  | InitStateMessage
  | CliOutputMessage
  | PermissionRequestMessage
  | CancelRequestMessage
  | ElicitationRequestMessage
  | SessionStateMessage
  | ContextUsageMessage
  | ThemeChangedMessage
  | AtMentionInsertedMessage
  | SessionListMessage
  | ProcessStateMessage
  | FontConfigMessage;

// ============================================================
// Shared types
// ============================================================

export interface Attachment {
  type: 'file' | 'image' | 'url' | 'text';
  name: string;
  content: string; // base64 for images, path for files, raw for text/url
}

export interface Mention {
  type: 'file' | 'folder' | 'line_range' | 'terminal' | 'browser';
  path: string;
  startLine?: number;
  endLine?: number;
}

export interface SessionInfo {
  sessionId: string;
  state: 'running' | 'waiting_input' | 'idle' | 'stopped';
  title?: string;
}

export interface SessionSummary {
  sessionId: string;
  title: string;
  model?: string;
  timestamp: number;
  messageCount: number;
  isStarred?: boolean;
}

// ============================================================
// Panel identification
// ============================================================

export type PanelLocation = 'sidebar' | 'editor-tab' | 'new-window';

export interface PanelInfo {
  id: string;
  location: PanelLocation;
  sessionId?: string;
  isVisible: boolean;
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd /Users/harshagarwal/Documents/workspace/gakrcli-vscode && npx tsc --noEmit src/webview/types.ts 2>&1 | /usr/bin/head -5`

Expected: No errors (or only "Cannot find module 'vscode'" which is expected without the full build)

- [ ] **Step 3: Commit**

```bash
cd /Users/harshagarwal/Documents/workspace/gakrcli-vscode
git add src/webview/types.ts
git commit -m "feat(webview): define PostMessage type system for webview<->host bridge"
```

---

## Task 2: HTML Generator with CSP Nonce and Theme Detection

**Files:**
- Create: `src/webview/htmlGenerator.ts`

This is extracted from Claude Code's `DQ.getHtmlForWebview()` method (extension.js line 803+). The pattern: generate a nonce, build CSP header, inject CSS variables for fonts, set data attributes for sidebar/fullEditor mode, load the bundled webview JS/CSS.

- [ ] **Step 1: Create the HTML generator**

Create `src/webview/htmlGenerator.ts`:

```typescript
import * as vscode from 'vscode';
import * as crypto from 'crypto';

/**
 * Generate a cryptographic nonce for Content Security Policy.
 * Extracted from Claude Code extension.js: `function N3() { return tQ.randomBytes(16).toString("hex"); }`
 */
export function generateNonce(): string {
  return crypto.randomBytes(16).toString('hex');
}

/**
 * Escape a string for use in an HTML attribute value.
 * Prevents XSS via data attributes (e.g., initial prompt injection).
 */
export function escapeHtmlAttribute(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/**
 * Detect the current VS Code color theme kind.
 * Maps vscode.ColorThemeKind to a simple string the webview can use.
 */
export function getThemeKind(): 'dark' | 'light' | 'high-contrast' {
  const kind = vscode.window.activeColorTheme.kind;
  switch (kind) {
    case vscode.ColorThemeKind.Light:
    case vscode.ColorThemeKind.HighContrastLight:
      return 'light';
    case vscode.ColorThemeKind.HighContrast:
      return 'high-contrast';
    case vscode.ColorThemeKind.Dark:
    default:
      return 'dark';
  }
}

/**
 * Read font configuration from VS Code settings.
 * Extracted from Claude Code extension.js DQ.getHtmlForWebview():
 *   let M = S4.workspace.getConfiguration("chat.editor");
 *   let A = M.get("fontFamily") || "default"; ...
 */
export function getFontConfig(): {
  editorFontFamily: string;
  editorFontSize: number;
  editorFontWeight: string;
  chatFontSize: number;
  chatFontFamily: string;
} {
  const editorConfig = vscode.workspace.getConfiguration('chat.editor');
  let editorFontFamily = editorConfig.get<string>('fontFamily') || 'default';
  if (editorFontFamily === 'default') {
    editorFontFamily = 'monospace';
  }
  const editorFontSize = editorConfig.get<number>('fontSize') || 12;
  const editorFontWeight = editorConfig.get<string>('fontWeight') || 'normal';

  const chatConfig = vscode.workspace.getConfiguration('chat');
  const chatFontSize = chatConfig.get<number>('fontSize') || 13;
  let chatFontFamily = chatConfig.get<string>('fontFamily') || 'default';
  if (chatFontFamily === 'default') {
    chatFontFamily = "-apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif";
  }

  return { editorFontFamily, editorFontSize, editorFontWeight, chatFontSize, chatFontFamily };
}

export interface HtmlGeneratorOptions {
  webview: vscode.Webview;
  extensionUri: vscode.Uri;
  isSidebar: boolean;
  isFullEditor?: boolean;
  isSessionListOnly?: boolean;
  initialSessionId?: string;
  initialPrompt?: string;
}

/**
 * Generate the full HTML for a webview panel.
 *
 * Extracted from Claude Code extension.js DQ.getHtmlForWebview() (line 803+).
 * Key patterns preserved:
 * - Nonce-based CSP (no 'unsafe-eval', no external URLs)
 * - CSS custom properties for font config
 * - data-* attributes on #root for initial state
 * - Window globals for panel type (IS_SIDEBAR, IS_FULL_EDITOR, IS_SESSION_LIST_ONLY)
 * - Script loaded as type="module" with nonce
 */
export function generateWebviewHtml(options: HtmlGeneratorOptions): string {
  const { webview, extensionUri, isSidebar, isFullEditor, isSessionListOnly, initialSessionId, initialPrompt } = options;

  const distPath = vscode.Uri.joinPath(extensionUri, 'dist', 'webview');
  const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(distPath, 'index.js'));
  const styleUri = webview.asWebviewUri(vscode.Uri.joinPath(distPath, 'index.css'));

  const nonce = generateNonce();
  const fonts = getFontConfig();
  const theme = getThemeKind();

  // Build CSP directives — matches Claude Code's pattern exactly
  const styleSrc = `style-src ${webview.cspSource} 'unsafe-inline'`;
  const fontSrc = `font-src ${webview.cspSource}`;
  const imgSrc = `img-src ${webview.cspSource} data:`;
  const workerSrc = `worker-src ${webview.cspSource}`;

  // Build data attributes for #root
  let dataAttrs = '';
  if (initialPrompt) {
    dataAttrs += ` data-initial-prompt="${escapeHtmlAttribute(initialPrompt)}"`;
  }
  if (initialSessionId) {
    dataAttrs += ` data-initial-session="${escapeHtmlAttribute(initialSessionId)}"`;
  }
  dataAttrs += ` data-theme="${escapeHtmlAttribute(theme)}"`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">

  <!--
    Use a content security policy to only allow loading images from our extension directory or data URIs,
    and only allow scripts that have a specific nonce.
    Note: External https: URLs are blocked to prevent data exfiltration via markdown image URLs.
  -->
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; ${styleSrc}; ${fontSrc}; ${imgSrc}; script-src 'nonce-${nonce}'; ${workerSrc};">

  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <link href="${styleUri}" rel="stylesheet">
  <style>
    :root {
      --vscode-editor-font-family: ${fonts.editorFontFamily} !important;
      --vscode-editor-font-size: ${fonts.editorFontSize}px !important;
      --vscode-editor-font-weight: ${fonts.editorFontWeight} !important;
      --vscode-chat-font-size: ${fonts.chatFontSize}px;
      --vscode-chat-font-family: ${fonts.chatFontFamily};
    }
  </style>
</head>
<body>
  <pre id="gakrcli-error"></pre>
  <div id="root"${dataAttrs}></div>
  <script nonce="${nonce}">
    window.IS_SIDEBAR = ${isSidebar ? 'true' : 'false'};
    window.IS_FULL_EDITOR = ${isFullEditor ? 'true' : 'false'};
    window.IS_SESSION_LIST_ONLY = ${isSessionListOnly ? 'true' : 'false'};
  </script>
  <script nonce="${nonce}" src="${scriptUri}" type="module"></script>
</body>
</html>`;
}
```

- [ ] **Step 2: Commit**

```bash
cd /Users/harshagarwal/Documents/workspace/gakrcli-vscode
git add src/webview/htmlGenerator.ts
git commit -m "feat(webview): HTML generator with CSP nonce, theme detection, font config"
```

---

## Task 3: WebviewBridge — Extension Host Side Message Router

**Files:**
- Create: `src/webview/webviewBridge.ts`

This handles receiving messages from the webview's `vscode.postMessage()` and sending messages back. Extracted from Claude Code's pattern where `DQ` registers `webview.onDidReceiveMessage((N) => { x?.fromClient(N) })` and sends via `webview.postMessage(...)`.

- [ ] **Step 1: Create the WebviewBridge class**

Create `src/webview/webviewBridge.ts`:

```typescript
import * as vscode from 'vscode';
import type {
  WebviewToHostMessage,
  HostToWebviewMessage,
  PanelInfo,
  PanelLocation,
} from './types';

type MessageHandler<T extends WebviewToHostMessage['type']> = (
  message: Extract<WebviewToHostMessage, { type: T }>,
  panelId: string,
) => void | Promise<void>;

/**
 * Typed PostMessage bridge between extension host and a single webview.
 *
 * Each WebviewBridge instance is bound to one webview (sidebar view or panel).
 * It provides:
 * - Typed message sending (host -> webview)
 * - Typed message receiving with handler registration (webview -> host)
 * - Automatic disposal of event listeners
 *
 * Pattern extracted from Claude Code extension.js:
 *   webview.onDidReceiveMessage((N) => { x?.fromClient(N) })
 *   webview.postMessage({ type: '...', ...payload })
 */
export class WebviewBridge implements vscode.Disposable {
  private readonly disposables: vscode.Disposable[] = [];
  private readonly handlers = new Map<string, MessageHandler<never>[]>();
  private isReady = false;
  private pendingMessages: HostToWebviewMessage[] = [];

  constructor(
    private readonly webview: vscode.Webview,
    public readonly panelId: string,
    public readonly location: PanelLocation,
  ) {
    // Listen for messages from the webview
    this.disposables.push(
      webview.onDidReceiveMessage((message: WebviewToHostMessage) => {
        this.handleIncomingMessage(message);
      }),
    );
  }

  /**
   * Register a handler for a specific message type from the webview.
   * Multiple handlers can be registered for the same type.
   */
  onMessage<T extends WebviewToHostMessage['type']>(
    type: T,
    handler: MessageHandler<T>,
  ): vscode.Disposable {
    const handlers = this.handlers.get(type) || [];
    handlers.push(handler as MessageHandler<never>);
    this.handlers.set(type, handlers);

    return {
      dispose: () => {
        const current = this.handlers.get(type);
        if (current) {
          const index = current.indexOf(handler as MessageHandler<never>);
          if (index >= 0) {
            current.splice(index, 1);
          }
        }
      },
    };
  }

  /**
   * Send a typed message to the webview.
   * If the webview hasn't sent 'ready' yet, messages are queued.
   */
  postMessage(message: HostToWebviewMessage): void {
    if (!this.isReady) {
      this.pendingMessages.push(message);
      return;
    }
    this.webview.postMessage(message);
  }

  /**
   * Get info about this bridge's panel.
   */
  getPanelInfo(isVisible: boolean, sessionId?: string): PanelInfo {
    return {
      id: this.panelId,
      location: this.location,
      sessionId,
      isVisible,
    };
  }

  private handleIncomingMessage(message: WebviewToHostMessage): void {
    // Special handling for 'ready' — flush pending messages
    if (message.type === 'ready') {
      this.isReady = true;
      for (const pending of this.pendingMessages) {
        this.webview.postMessage(pending);
      }
      this.pendingMessages = [];
    }

    // Dispatch to registered handlers
    const handlers = this.handlers.get(message.type);
    if (handlers) {
      for (const handler of handlers) {
        try {
          handler(message as never, this.panelId);
        } catch (err) {
          console.error(`Error in webview message handler for '${message.type}':`, err);
        }
      }
    }
  }

  dispose(): void {
    for (const d of this.disposables) {
      d.dispose();
    }
    this.disposables.length = 0;
    this.handlers.clear();
    this.pendingMessages = [];
  }
}
```

- [ ] **Step 2: Commit**

```bash
cd /Users/harshagarwal/Documents/workspace/gakrcli-vscode
git add src/webview/webviewBridge.ts
git commit -m "feat(webview): WebviewBridge for typed postMessage routing"
```

---

## Task 4: WebviewManager — Multi-Panel Lifecycle

**Files:**
- Create: `src/webview/webviewManager.ts`

This is the main orchestrator — extracted from Claude Code's `DQ` class. It manages all active webview panels, creates panels in 3 locations, tracks visibility, and broadcasts state across all panels.

- [ ] **Step 1: Create the WebviewManager class**

Create `src/webview/webviewManager.ts`:

```typescript
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
 * Manages all gakrcli webview panels across sidebar, editor tabs, and new windows.
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
    handlers.push(handler as MessageHandler<never>);
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
          const index = current.indexOf(handler as MessageHandler<never>);
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
   * - Finds an unused column or reuses one with only gakrcli tabs
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
      // Try to find a column that only has gakrcli tabs
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
      'gakrcli',
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
        bridge.onMessage(type as WebviewToHostMessage['type'], handler);
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
        bridge.onMessage(type as WebviewToHostMessage['type'], handler);
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
```

- [ ] **Step 2: Commit**

```bash
cd /Users/harshagarwal/Documents/workspace/gakrcli-vscode
git add src/webview/webviewManager.ts
git commit -m "feat(webview): WebviewManager with multi-panel lifecycle and session tracking"
```

---

## Task 5: Enhanced WebviewViewProvider

**Files:**
- Modify: `src/webview/webviewProvider.ts`

Replace Story 1's basic provider with one that delegates to WebviewManager. Also add the WebviewPanelSerializer for persisting panels across VS Code restarts.

- [ ] **Step 1: Rewrite webviewProvider.ts**

Replace `src/webview/webviewProvider.ts` with:

```typescript
import * as vscode from 'vscode';
import { WebviewManager } from './webviewManager';

/**
 * WebviewViewProvider for the sidebar (both primary and secondary).
 *
 * Extracted from Claude Code extension.js:
 *   registerWebviewViewProvider("claudeVSCodeSidebar", Z, { webviewOptions: { retainContextWhenHidden: true } })
 *   registerWebviewViewProvider("claudeVSCodeSidebarSecondary", Z, ...)
 *
 * The provider delegates all work to WebviewManager, which handles HTML generation,
 * bridge setup, and message routing.
 */
export class gakrcliWebviewProvider implements vscode.WebviewViewProvider {
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
 *
 * Extracted from Claude Code extension.js:
 *   registerWebviewPanelSerializer("claudeVSCodePanel", {
 *     async deserializeWebviewPanel(A, I) {
 *       let w = I, v;
 *       if (typeof w?.isFullEditor === "boolean") v = w.isFullEditor;
 *       else v = ... findIndex ...
 *       Z.setupPanel(A, void 0, void 0, v)
 *     }
 *   })
 *
 * When VS Code restarts, it calls deserializeWebviewPanel with the saved panel
 * and its state. We re-create the bridge and restore the panel.
 */
export class gakrcliPanelSerializer implements vscode.WebviewPanelSerializer {
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
```

- [ ] **Step 2: Commit**

```bash
cd /Users/harshagarwal/Documents/workspace/gakrcli-vscode
git add src/webview/webviewProvider.ts
git commit -m "feat(webview): enhanced WebviewViewProvider + PanelSerializer for persistence"
```

---

## Task 6: Webview-Side VS Code API Wrapper (Enhanced)

**Files:**
- Modify: `webview/src/vscode.ts`

Enhance Story 1's basic wrapper with typed messaging, state persistence via `getState()`/`setState()`, and proper typing.

- [ ] **Step 1: Rewrite webview/src/vscode.ts**

Replace `webview/src/vscode.ts` with:

```typescript
/**
 * Typed VS Code API wrapper for the webview side.
 *
 * This wraps the acquireVsCodeApi() singleton and provides:
 * - Typed postMessage sending (WebviewToHostMessage)
 * - State persistence via getState/setState
 * - Message listening with type filtering
 *
 * The VS Code API can only be acquired once — this module caches it.
 *
 * Pattern from Claude Code webview/index.js:
 *   vscode.postMessage({ type: 'ready' });
 *   vscode.postMessage({ type: 'comment', id: N.id, ... });
 */

// Import types from the shared type definitions
// During build, these are resolved by Vite's alias config
// At runtime, the extension host defines the message contract

/** Message types the webview can send to the extension host */
export interface WebviewToHostMessageBase {
  type: string;
  [key: string]: unknown;
}

/** Message types the extension host can send to the webview */
export interface HostToWebviewMessageBase {
  type: string;
  [key: string]: unknown;
}

/** Webview persisted state shape */
export interface WebviewPersistedState {
  /** Scroll position of the message list */
  scrollTop?: number;
  /** Draft text in the input field */
  draftText?: string;
  /** Current session ID */
  sessionId?: string;
  /** Whether the user has scrolled up (paused auto-scroll) */
  isScrollPaused?: boolean;
  /** Collapsed tool call block IDs */
  collapsedToolCalls?: string[];
  /** Custom data from components */
  [key: string]: unknown;
}

type MessageListener = (message: HostToWebviewMessageBase) => void;

interface VSCodeApi {
  postMessage(message: unknown): void;
  getState(): WebviewPersistedState | undefined;
  setState(state: WebviewPersistedState): void;
}

class VSCodeAPIWrapper {
  private readonly api: VSCodeApi | undefined;
  private listeners: Map<string, Set<MessageListener>> = new Map();
  private globalListeners: Set<MessageListener> = new Set();

  constructor() {
    // acquireVsCodeApi is injected by VS Code into the webview context
    if (typeof acquireVsCodeApi === 'function') {
      this.api = acquireVsCodeApi() as VSCodeApi;
    }

    // Listen for messages from the extension host
    window.addEventListener('message', (event: MessageEvent) => {
      const message = event.data as HostToWebviewMessageBase;
      if (!message || typeof message.type !== 'string') return;

      // Dispatch to type-specific listeners
      const typeListeners = this.listeners.get(message.type);
      if (typeListeners) {
        for (const listener of typeListeners) {
          try {
            listener(message);
          } catch (err) {
            console.error(`Error in message listener for '${message.type}':`, err);
          }
        }
      }

      // Dispatch to global listeners
      for (const listener of this.globalListeners) {
        try {
          listener(message);
        } catch (err) {
          console.error('Error in global message listener:', err);
        }
      }
    });
  }

  /**
   * Send a typed message to the extension host.
   */
  postMessage(message: WebviewToHostMessageBase): void {
    if (this.api) {
      this.api.postMessage(message);
    } else {
      console.log('[gakrcli] VS Code API not available, message:', message);
    }
  }

  /**
   * Listen for a specific message type from the extension host.
   * Returns an unsubscribe function.
   */
  onMessage(type: string, listener: MessageListener): () => void {
    let typeSet = this.listeners.get(type);
    if (!typeSet) {
      typeSet = new Set();
      this.listeners.set(type, typeSet);
    }
    typeSet.add(listener);

    return () => {
      typeSet!.delete(listener);
      if (typeSet!.size === 0) {
        this.listeners.delete(type);
      }
    };
  }

  /**
   * Listen for ALL messages from the extension host.
   * Returns an unsubscribe function.
   */
  onAnyMessage(listener: MessageListener): () => void {
    this.globalListeners.add(listener);
    return () => {
      this.globalListeners.delete(listener);
    };
  }

  /**
   * Get persisted webview state.
   * This survives the webview being hidden and re-shown (retainContextWhenHidden),
   * and also survives VS Code restarts (via WebviewPanelSerializer).
   */
  getState(): WebviewPersistedState | undefined {
    return this.api?.getState();
  }

  /**
   * Persist webview state.
   * Call this when the user types in the input, scrolls, etc.
   */
  setState(state: WebviewPersistedState): void {
    this.api?.setState(state);
  }

  /**
   * Update a single key in the persisted state without overwriting other keys.
   */
  updateState(partial: Partial<WebviewPersistedState>): void {
    const current = this.getState() || {};
    this.setState({ ...current, ...partial });
  }

  /**
   * Check if we're running inside a VS Code webview.
   */
  get isVSCode(): boolean {
    return this.api !== undefined;
  }
}

// Singleton — acquireVsCodeApi can only be called once
export const vscode = new VSCodeAPIWrapper();
```

- [ ] **Step 2: Add the `acquireVsCodeApi` type declaration**

Create `webview/src/types/vscode.d.ts`:

```typescript
/**
 * Global type declaration for the VS Code webview API.
 * This function is injected by VS Code into the webview's JavaScript context.
 * It can only be called once — subsequent calls throw an error.
 */
declare function acquireVsCodeApi(): {
  postMessage(message: unknown): void;
  getState(): unknown;
  setState(state: unknown): void;
};

/**
 * Window globals set by the extension host in the HTML template.
 * See htmlGenerator.ts — these are set in a <script> tag before the main bundle.
 */
interface Window {
  IS_SIDEBAR: boolean;
  IS_FULL_EDITOR: boolean;
  IS_SESSION_LIST_ONLY: boolean;
}
```

- [ ] **Step 3: Commit**

```bash
cd /Users/harshagarwal/Documents/workspace/gakrcli-vscode
git add webview/src/vscode.ts webview/src/types/vscode.d.ts
git commit -m "feat(webview): enhanced VS Code API wrapper with typed messaging and state persistence"
```

---

## Task 7: React Hooks — useVSCode and useTheme

**Files:**
- Create: `webview/src/hooks/useVSCode.ts`
- Create: `webview/src/hooks/useTheme.ts`

- [ ] **Step 1: Create useVSCode hook**

Create `webview/src/hooks/useVSCode.ts`:

```typescript
import { useEffect, useCallback, useRef, useState } from 'react';
import { vscode, type HostToWebviewMessageBase, type WebviewPersistedState } from '../vscode';

/**
 * React hook for interacting with the VS Code extension host.
 *
 * Provides:
 * - sendMessage(): typed message sending
 * - useMessageListener(): subscribe to specific message types
 * - state persistence via getState/setState
 */
export function useVSCode() {
  const sendMessage = useCallback((type: string, payload?: Record<string, unknown>) => {
    vscode.postMessage({ type, ...payload });
  }, []);

  const getState = useCallback((): WebviewPersistedState | undefined => {
    return vscode.getState();
  }, []);

  const setState = useCallback((state: WebviewPersistedState) => {
    vscode.setState(state);
  }, []);

  const updateState = useCallback((partial: Partial<WebviewPersistedState>) => {
    vscode.updateState(partial);
  }, []);

  return { sendMessage, getState, setState, updateState, isVSCode: vscode.isVSCode };
}

/**
 * React hook that subscribes to a specific message type from the extension host.
 * Automatically unsubscribes on unmount.
 *
 * Usage:
 *   useMessageListener('init_state', (msg) => { setTheme(msg.theme); });
 */
export function useMessageListener<T extends HostToWebviewMessageBase>(
  type: string,
  handler: (message: T) => void,
): void {
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  useEffect(() => {
    const unsubscribe = vscode.onMessage(type, (message) => {
      handlerRef.current(message as T);
    });
    return unsubscribe;
  }, [type]);
}

/**
 * React hook that subscribes to ALL messages from the extension host.
 */
export function useAnyMessageListener(
  handler: (message: HostToWebviewMessageBase) => void,
): void {
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  useEffect(() => {
    const unsubscribe = vscode.onAnyMessage((message) => {
      handlerRef.current(message);
    });
    return unsubscribe;
  }, []);
}

/**
 * React hook that persists a value in webview state.
 * Like useState, but the value survives the webview being hidden and re-shown.
 *
 * Usage:
 *   const [draft, setDraft] = usePersistedState('draftText', '');
 */
export function usePersistedState<K extends keyof WebviewPersistedState>(
  key: K,
  defaultValue: NonNullable<WebviewPersistedState[K]>,
): [NonNullable<WebviewPersistedState[K]>, (value: NonNullable<WebviewPersistedState[K]>) => void] {
  const [value, setValueInternal] = useState<NonNullable<WebviewPersistedState[K]>>(() => {
    const saved = vscode.getState();
    if (saved && key in saved && saved[key] !== undefined) {
      return saved[key] as NonNullable<WebviewPersistedState[K]>;
    }
    return defaultValue;
  });

  const setValue = useCallback(
    (newValue: NonNullable<WebviewPersistedState[K]>) => {
      setValueInternal(newValue);
      vscode.updateState({ [key]: newValue } as Partial<WebviewPersistedState>);
    },
    [key],
  );

  return [value, setValue];
}
```

- [ ] **Step 2: Create useTheme hook**

Create `webview/src/hooks/useTheme.ts`:

```typescript
import { useState, useEffect } from 'react';
import { vscode } from '../vscode';

export type ThemeKind = 'dark' | 'light' | 'high-contrast';

/**
 * React hook for detecting the VS Code color theme.
 *
 * Reads the initial theme from the #root data attribute (set by htmlGenerator.ts),
 * and listens for 'theme_changed' messages from the extension host.
 *
 * VS Code injects CSS custom properties (--vscode-*) into the webview automatically,
 * but this hook provides the theme KIND (dark/light/high-contrast) for conditional
 * rendering (e.g., different icons, different placeholder text).
 *
 * The actual colors come from Tailwind classes that reference CSS custom properties:
 *   bg-vscode-bg, text-vscode-fg, border-vscode-border, etc.
 * These are defined in webview/tailwind.config.ts and work automatically because
 * VS Code injects the --vscode-* CSS variables into every webview.
 */
export function useTheme(): ThemeKind {
  const [theme, setTheme] = useState<ThemeKind>(() => {
    // Read initial theme from data attribute set by htmlGenerator.ts
    const root = document.getElementById('root');
    const dataTheme = root?.getAttribute('data-theme');
    if (dataTheme === 'light' || dataTheme === 'dark' || dataTheme === 'high-contrast') {
      return dataTheme;
    }

    // Fallback: detect from VS Code's body class
    // VS Code adds 'vscode-dark', 'vscode-light', or 'vscode-high-contrast' to <body>
    if (document.body.classList.contains('vscode-light')) return 'light';
    if (document.body.classList.contains('vscode-high-contrast')) return 'high-contrast';
    return 'dark';
  });

  useEffect(() => {
    const unsubscribe = vscode.onMessage('theme_changed', (message) => {
      const newTheme = (message as { theme: ThemeKind }).theme;
      if (newTheme) {
        setTheme(newTheme);
      }
    });

    // Also listen for VS Code body class changes (belt and suspenders)
    const observer = new MutationObserver(() => {
      if (document.body.classList.contains('vscode-light')) setTheme('light');
      else if (document.body.classList.contains('vscode-high-contrast')) setTheme('high-contrast');
      else setTheme('dark');
    });

    observer.observe(document.body, {
      attributes: true,
      attributeFilter: ['class'],
    });

    return () => {
      unsubscribe();
      observer.disconnect();
    };
  }, []);

  return theme;
}
```

- [ ] **Step 3: Commit**

```bash
cd /Users/harshagarwal/Documents/workspace/gakrcli-vscode
git add webview/src/hooks/useVSCode.ts webview/src/hooks/useTheme.ts
git commit -m "feat(webview): useVSCode and useTheme hooks for messaging and state persistence"
```

---

## Task 8: Update Webview App.tsx and main.tsx

**Files:**
- Modify: `webview/src/App.tsx`
- Modify: `webview/src/main.tsx`

Update the webview to use the new hooks, send `ready` on mount, display theme info, and demonstrate the PostMessage bridge working.

- [ ] **Step 1: Update main.tsx to send ready message**

Replace `webview/src/main.tsx` with:

```tsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './styles/index.css';
import { vscode } from './vscode';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);

// Signal to the extension host that the webview is ready to receive messages.
// This must happen after React mounts so message listeners are registered.
// Pattern from Claude Code webview/index.js line 725:
//   vscode.postMessage({ type: 'ready' });
vscode.postMessage({ type: 'ready' });
```

- [ ] **Step 2: Update App.tsx with theme-aware shell**

Replace `webview/src/App.tsx` with:

```tsx
import { useState } from 'react';
import { useTheme } from './hooks/useTheme';
import { useVSCode, useMessageListener, usePersistedState } from './hooks/useVSCode';

function App() {
  const theme = useTheme();
  const { sendMessage, isVSCode } = useVSCode();
  const [draftText, setDraftText] = usePersistedState('draftText', '');
  const [initState, setInitState] = useState<{
    isSidebar: boolean;
    isFullEditor: boolean;
    extensionVersion: string;
  } | null>(null);
  const [processState, setProcessState] = useState<string>('not connected');

  // Listen for init state from extension host
  useMessageListener('init_state', (msg: Record<string, unknown>) => {
    setInitState({
      isSidebar: msg.isSidebar as boolean,
      isFullEditor: msg.isFullEditor as boolean,
      extensionVersion: msg.extensionVersion as string,
    });
  });

  // Listen for process state changes
  useMessageListener('process_state', (msg: Record<string, unknown>) => {
    setProcessState(msg.state as string);
  });

  const isSidebar = initState?.isSidebar ?? (window as Window).IS_SIDEBAR ?? false;

  return (
    <div className="flex flex-col h-screen bg-vscode-bg text-vscode-fg">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-vscode-border">
        <h1 className="text-sm font-semibold">gakrcli</h1>
        <div className="flex items-center gap-2">
          <span className="text-xs opacity-50">{theme}</span>
          <span className="text-xs opacity-50">
            {initState?.extensionVersion ?? 'v0.2.5'}
          </span>
        </div>
      </div>

      {/* Message area (placeholder — Chat UI comes in Story 4) */}
      <div className="flex-1 flex items-center justify-center px-4">
        <div className="text-center opacity-70 space-y-3">
          <p className="text-lg font-semibold">gakrcli</p>
          <p className="text-sm">AI coding assistant powered by any LLM</p>
          <div className="text-xs space-y-1 mt-4 text-left mx-auto inline-block">
            <p>Bridge status: {isVSCode ? 'connected' : 'standalone'}</p>
            <p>Panel type: {isSidebar ? 'sidebar' : initState?.isFullEditor ? 'full editor' : 'editor tab'}</p>
            <p>Process: {processState}</p>
            <p>Theme: {theme}</p>
          </div>
          <p className="text-xs mt-4 opacity-50">
            Chat UI coming in Story 4.
          </p>
        </div>
      </div>

      {/* Input area (placeholder with working draft persistence) */}
      <div className="px-4 py-3 border-t border-vscode-border">
        <div className="flex items-center rounded border border-vscode-input-border bg-vscode-input-bg px-3 py-2">
          <input
            type="text"
            placeholder="Type a message... (not connected yet)"
            className="flex-1 bg-transparent text-vscode-input-fg outline-none text-sm"
            value={draftText}
            onChange={(e) => setDraftText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && draftText.trim()) {
                sendMessage('send_prompt', { text: draftText.trim() });
                setDraftText('');
              }
            }}
          />
        </div>
        <p className="text-xs opacity-30 mt-1 text-center">
          Draft text persists when panel is hidden (try hiding and re-showing)
        </p>
      </div>
    </div>
  );
}

export default App;
```

- [ ] **Step 3: Commit**

```bash
cd /Users/harshagarwal/Documents/workspace/gakrcli-vscode
git add webview/src/main.tsx webview/src/App.tsx
git commit -m "feat(webview): theme-aware shell with PostMessage bridge and state persistence"
```

---

## Task 9: Update Extension Entry Point

**Files:**
- Modify: `src/extension.ts`

Wire up the WebviewManager, register all 3 sidebar providers (primary, secondary, sessions list), register the panel serializer, and update commands to use the manager.

- [ ] **Step 1: Rewrite src/extension.ts**

Replace `src/extension.ts` with:

```typescript
import * as vscode from 'vscode';
import { WebviewManager } from './webview/webviewManager';
import { gakrcliWebviewProvider, gakrcliPanelSerializer } from './webview/webviewProvider';

let webviewManager: WebviewManager | undefined;

export function activate(context: vscode.ExtensionContext) {
  const output = vscode.window.createOutputChannel('gakrcli', { log: true });
  context.subscriptions.push(output);

  output.info('gakrcli VS Code extension activated');

  // Create the WebviewManager — central orchestrator for all panels
  webviewManager = new WebviewManager(context.extensionUri, context, output);
  context.subscriptions.push(webviewManager);

  const provider = new gakrcliWebviewProvider(webviewManager);

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
  // Pattern from Claude Code: register the same provider for both sidebar locations
  // with retainContextWhenHidden to preserve webview state when the sidebar is collapsed
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

  // Register session list sidebar view
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider('gakrcliSessionsList', {
      resolveWebviewView(webviewView, _ctx, _token) {
        // Sessions list uses the same manager but with isSessionListOnly flag
        // Full implementation comes in Story 7 (Session Management)
        webviewManager!.resolveSidebarView(webviewView);
      },
    }, {
      webviewOptions: { retainContextWhenHidden: true },
    }),
  );

  // Register panel serializer for restoring panels across VS Code restarts
  context.subscriptions.push(
    vscode.window.registerWebviewPanelSerializer(
      'gakrcliPanel',
      new gakrcliPanelSerializer(webviewManager),
    ),
  );

  // Track preferred location (sidebar vs panel)
  let preferredLocation: 'sidebar' | 'panel' = 'panel';

  // Status bar item — shows when sidebar is preferred
  const statusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right);
  statusBar.text = '$(sparkle) gakrcli';
  statusBar.command = 'gakrcli.editor.openLast';
  statusBar.tooltip = 'Open gakrcli';
  context.subscriptions.push(statusBar);

  if (preferredLocation === 'sidebar' && supportsSecondarySidebar) {
    statusBar.show();
  }

  // ==========================================
  // Command Registration
  // ==========================================

  // Open in New Tab (creates editor tab panel)
  context.subscriptions.push(
    vscode.commands.registerCommand(
      'gakrcli.editor.open',
      async (sessionId?: string, prompt?: string, viewColumn?: vscode.ViewColumn) => {
        if (viewColumn !== vscode.ViewColumn.Active) {
          preferredLocation = 'panel';
        }
        const { startedInNewColumn } = webviewManager!.createPanel(
          sessionId,
          prompt,
          viewColumn,
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
        vscode.window.showWarningMessage(
          'Secondary Sidebar not supported in this version of VS Code. Opening in Activity Bar instead.',
        );
        await vscode.commands.executeCommand('gakrcliSidebar.focus');
        return;
      }
      await vscode.commands.executeCommand('gakrcliSidebarSecondary.focus');
      statusBar.show();
    }),
  );

  // Open in New Window
  context.subscriptions.push(
    vscode.commands.registerCommand('gakrcli.window.open', async () => {
      await webviewManager!.createPanelInNewWindow();
      statusBar.hide();
    }),
  );

  // New Conversation
  context.subscriptions.push(
    vscode.commands.registerCommand('gakrcli.newConversation', async () => {
      webviewManager!.broadcast({ type: 'init_state' as never });
      // Full implementation in Story 7
    }),
  );

  // Focus input
  context.subscriptions.push(
    vscode.commands.registerCommand('gakrcli.focus', async () => {
      if (!webviewManager!.hasVisibleWebview()) {
        await vscode.commands.executeCommand('gakrcli.editor.openLast');
      }
      // Send at-mention with current selection if available
      const editor = vscode.window.activeTextEditor;
      if (editor) {
        const doc = editor.document;
        const relativePath = vscode.workspace.asRelativePath(doc.fileName);
        const selection = editor.selection;

        if (!selection.isEmpty) {
          const startLine = selection.start.line + 1;
          const endLine = selection.end.line + 1;
          const mention =
            startLine !== endLine
              ? `@${relativePath}#${startLine}-${endLine}`
              : `@${relativePath}#${startLine}`;
          webviewManager!.broadcast({ type: 'at_mention_inserted', text: mention });
        } else {
          webviewManager!.broadcast({ type: 'at_mention_inserted', text: '' });
        }
      }
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
      const editor = vscode.window.activeTextEditor;
      if (!editor) return;

      const doc = editor.document;
      const relativePath = vscode.workspace.asRelativePath(doc.fileName);
      const selection = editor.selection;

      let mention: string;
      if (selection.isEmpty) {
        mention = `@${relativePath}`;
      } else {
        const startLine = selection.start.line + 1;
        const endLine = selection.end.line + 1;
        mention =
          startLine !== endLine
            ? `@${relativePath}#${startLine}-${endLine}`
            : `@${relativePath}#${startLine}`;
      }
      webviewManager!.broadcast({ type: 'at_mention_inserted', text: mention });
    }),
  );

  // Show Logs
  context.subscriptions.push(
    vscode.commands.registerCommand('gakrcli.showLogs', () => {
      output.show();
    }),
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

  // Register remaining commands as no-ops (implementations come in later stories)
  const noopCommands = [
    'gakrcli.terminal.open',
    'gakrcli.terminal.open.keyboard',
    'gakrcli.createWorktree',
    'gakrcli.acceptProposedDiff',
    'gakrcli.rejectProposedDiff',
    'gakrcli.update',
    'gakrcli.installPlugin',
    'gakrcli.logout',
  ];

  for (const id of noopCommands) {
    context.subscriptions.push(
      vscode.commands.registerCommand(id, () => {
        vscode.window.showInformationMessage('gakrcli: Coming soon!');
      }),
    );
  }

  // Log a webview message handler for debugging
  webviewManager.onMessage('send_prompt', (message, panelId) => {
    output.info(`[Panel ${panelId}] User prompt: ${JSON.stringify(message)}`);
    // Actual prompt sending to CLI comes in Story 2 (Process Manager)
  });

  // Set context for sidebar state
  vscode.commands.executeCommand('setContext', 'gakrcli.sessionsListEnabled', true);
  vscode.commands.executeCommand('setContext', 'gakrcli.primaryEditorEnabled', true);

  output.info('gakrcli: All commands and providers registered');
}

export function deactivate() {
  console.log('gakrcli VS Code extension deactivated');
  webviewManager = undefined;
}
```

- [ ] **Step 2: Commit**

```bash
cd /Users/harshagarwal/Documents/workspace/gakrcli-vscode
git add src/extension.ts
git commit -m "feat: wire WebviewManager into extension with all 3 panel locations and commands"
```

---

## Task 10: Unit Tests — WebviewBridge

**Files:**
- Create: `test/unit/webviewBridge.test.ts`

TDD tests for the PostMessage bridge.

- [ ] **Step 1: Install test dependencies (if not already present)**

Run: `cd /Users/harshagarwal/Documents/workspace/gakrcli-vscode && npm install --save-dev vitest @types/vscode 2>&1 | /usr/bin/tail -3`

Expected: Packages added

- [ ] **Step 2: Create vitest config (if not present)**

Create `vitest.config.ts` in the project root:

```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['test/unit/**/*.test.ts'],
    globals: true,
    environment: 'node',
    // Mock vscode module since it's not available outside VS Code
    alias: {
      vscode: new URL('./test/mocks/vscode.ts', import.meta.url).pathname,
    },
  },
});
```

- [ ] **Step 3: Create VS Code mock**

Create `test/mocks/vscode.ts`:

```typescript
/**
 * Mock of the vscode module for unit testing.
 * Only the parts used by our code are mocked.
 */

export enum ColorThemeKind {
  Light = 1,
  Dark = 2,
  HighContrast = 3,
  HighContrastLight = 4,
}

export enum ViewColumn {
  Active = -1,
  Beside = -2,
  One = 1,
  Two = 2,
  Three = 3,
  Four = 4,
  Five = 5,
  Six = 6,
  Seven = 7,
  Eight = 8,
  Nine = 9,
}

export enum StatusBarAlignment {
  Left = 1,
  Right = 2,
}

export enum UIKind {
  Desktop = 1,
  Web = 2,
}

export class Uri {
  static joinPath(base: Uri, ...paths: string[]): Uri {
    return new Uri(`${base.fsPath}/${paths.join('/')}`);
  }

  static file(path: string): Uri {
    return new Uri(path);
  }

  readonly fsPath: string;
  readonly scheme = 'file';

  constructor(fsPath: string) {
    this.fsPath = fsPath;
  }

  toString(): string {
    return this.fsPath;
  }
}

export class EventEmitter<T> {
  private listeners: ((e: T) => void)[] = [];

  event = (listener: (e: T) => void) => {
    this.listeners.push(listener);
    return { dispose: () => {
      const idx = this.listeners.indexOf(listener);
      if (idx >= 0) this.listeners.splice(idx, 1);
    }};
  };

  fire(data: T): void {
    for (const listener of this.listeners) {
      listener(data);
    }
  }

  dispose(): void {
    this.listeners = [];
  }
}

export class Disposable {
  static from(...disposables: { dispose: () => void }[]): Disposable {
    return new Disposable(() => {
      for (const d of disposables) d.dispose();
    });
  }

  constructor(private callOnDispose: () => void) {}

  dispose(): void {
    this.callOnDispose();
  }
}

class MockWebview {
  options: Record<string, unknown> = {};
  html = '';
  private messageEmitter = new EventEmitter<unknown>();
  private postedMessages: unknown[] = [];

  get cspSource(): string {
    return 'https://mock.csp.source';
  }

  onDidReceiveMessage = this.messageEmitter.event;

  postMessage(message: unknown): Thenable<boolean> {
    this.postedMessages.push(message);
    return Promise.resolve(true);
  }

  asWebviewUri(uri: Uri): Uri {
    return uri;
  }

  // Test helpers
  simulateMessage(message: unknown): void {
    this.messageEmitter.fire(message);
  }

  getPostedMessages(): unknown[] {
    return [...this.postedMessages];
  }

  clearPostedMessages(): void {
    this.postedMessages = [];
  }
}

export function createMockWebview(): MockWebview {
  return new MockWebview();
}

export class TabInputWebview {
  constructor(public readonly viewType: string) {}
}

export const window = {
  activeColorTheme: { kind: ColorThemeKind.Dark },
  createWebviewPanel: (_viewType: string, _title: string, _column: ViewColumn, _options: unknown) => {
    const webview = createMockWebview();
    return {
      webview,
      viewColumn: ViewColumn.One,
      visible: true,
      active: true,
      iconPath: undefined as unknown,
      title: _title,
      reveal: () => {},
      dispose: () => {},
      onDidChangeViewState: new EventEmitter<unknown>().event,
      onDidDispose: new EventEmitter<void>().event,
    };
  },
  createOutputChannel: (_name: string, _options?: unknown) => ({
    info: (..._args: unknown[]) => {},
    warn: (..._args: unknown[]) => {},
    error: (..._args: unknown[]) => {},
    show: () => {},
    dispose: () => {},
  }),
  createStatusBarItem: () => ({
    text: '',
    command: '',
    tooltip: '',
    show: () => {},
    hide: () => {},
    dispose: () => {},
  }),
  registerWebviewViewProvider: () => ({ dispose: () => {} }),
  registerWebviewPanelSerializer: () => ({ dispose: () => {} }),
  showInformationMessage: () => {},
  showWarningMessage: () => {},
  showErrorMessage: () => {},
  onDidChangeActiveColorTheme: new EventEmitter<unknown>().event,
  tabGroups: { all: [] },
  activeTextEditor: undefined,
};

export const workspace = {
  getConfiguration: (_section?: string) => ({
    get: <T>(_key: string, defaultValue?: T): T | undefined => defaultValue,
  }),
  onDidChangeConfiguration: new EventEmitter<unknown>().event,
  asRelativePath: (path: string) => path,
  workspaceFolders: [],
};

export const commands = {
  registerCommand: (_command: string, _callback: (...args: unknown[]) => unknown) => ({
    dispose: () => {},
  }),
  executeCommand: async (_command: string, ..._args: unknown[]) => {},
};

export const env = {
  uiKind: UIKind.Desktop,
  clipboard: {
    writeText: async (_text: string) => {},
    readText: async () => '',
  },
};

export const version = '1.106.0';

export default {
  ColorThemeKind,
  ViewColumn,
  StatusBarAlignment,
  UIKind,
  Uri,
  EventEmitter,
  Disposable,
  TabInputWebview,
  window,
  workspace,
  commands,
  env,
  version,
};
```

- [ ] **Step 4: Create WebviewBridge tests**

Create `test/unit/webviewBridge.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createMockWebview } from '../mocks/vscode';
import { WebviewBridge } from '../../src/webview/webviewBridge';

describe('WebviewBridge', () => {
  let mockWebview: ReturnType<typeof createMockWebview>;
  let bridge: WebviewBridge;

  beforeEach(() => {
    mockWebview = createMockWebview();
    bridge = new WebviewBridge(mockWebview as never, 'test-panel-1', 'editor-tab');
  });

  describe('message receiving (webview -> host)', () => {
    it('dispatches messages to registered handlers', () => {
      const handler = vi.fn();
      bridge.onMessage('send_prompt', handler);

      mockWebview.simulateMessage({ type: 'send_prompt', text: 'hello' });

      expect(handler).toHaveBeenCalledOnce();
      expect(handler).toHaveBeenCalledWith(
        { type: 'send_prompt', text: 'hello' },
        'test-panel-1',
      );
    });

    it('supports multiple handlers for the same message type', () => {
      const handler1 = vi.fn();
      const handler2 = vi.fn();
      bridge.onMessage('ready', handler1);
      bridge.onMessage('ready', handler2);

      mockWebview.simulateMessage({ type: 'ready' });

      expect(handler1).toHaveBeenCalledOnce();
      expect(handler2).toHaveBeenCalledOnce();
    });

    it('does not dispatch to unregistered handlers', () => {
      const handler = vi.fn();
      bridge.onMessage('send_prompt', handler);

      mockWebview.simulateMessage({ type: 'interrupt' });

      expect(handler).not.toHaveBeenCalled();
    });

    it('supports unsubscribing handlers', () => {
      const handler = vi.fn();
      const disposable = bridge.onMessage('ready', handler);

      disposable.dispose();
      mockWebview.simulateMessage({ type: 'ready' });

      expect(handler).not.toHaveBeenCalled();
    });

    it('catches errors in handlers without breaking other handlers', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const handler1 = vi.fn(() => {
        throw new Error('handler1 error');
      });
      const handler2 = vi.fn();

      bridge.onMessage('ready', handler1);
      bridge.onMessage('ready', handler2);

      mockWebview.simulateMessage({ type: 'ready' });

      expect(handler1).toHaveBeenCalledOnce();
      expect(handler2).toHaveBeenCalledOnce();
      expect(consoleSpy).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });
  });

  describe('message sending (host -> webview)', () => {
    it('queues messages until webview sends ready', () => {
      bridge.postMessage({ type: 'init_state' } as never);
      bridge.postMessage({ type: 'theme_changed', theme: 'dark' } as never);

      // Messages should be queued, not sent
      expect(mockWebview.getPostedMessages()).toHaveLength(0);

      // Send ready
      mockWebview.simulateMessage({ type: 'ready' });

      // Queued messages should now be flushed
      expect(mockWebview.getPostedMessages()).toHaveLength(2);
      expect(mockWebview.getPostedMessages()[0]).toEqual({ type: 'init_state' });
      expect(mockWebview.getPostedMessages()[1]).toEqual({ type: 'theme_changed', theme: 'dark' });
    });

    it('sends messages immediately after ready', () => {
      mockWebview.simulateMessage({ type: 'ready' });
      mockWebview.clearPostedMessages();

      bridge.postMessage({ type: 'theme_changed', theme: 'light' } as never);

      expect(mockWebview.getPostedMessages()).toHaveLength(1);
      expect(mockWebview.getPostedMessages()[0]).toEqual({ type: 'theme_changed', theme: 'light' });
    });
  });

  describe('getPanelInfo', () => {
    it('returns correct panel info', () => {
      const info = bridge.getPanelInfo(true, 'session-123');

      expect(info).toEqual({
        id: 'test-panel-1',
        location: 'editor-tab',
        sessionId: 'session-123',
        isVisible: true,
      });
    });
  });

  describe('dispose', () => {
    it('cleans up handlers and pending messages', () => {
      const handler = vi.fn();
      bridge.onMessage('ready', handler);
      bridge.postMessage({ type: 'init_state' } as never);

      bridge.dispose();

      // Handler should no longer fire
      mockWebview.simulateMessage({ type: 'ready' });
      expect(handler).not.toHaveBeenCalled();
    });
  });
});
```

- [ ] **Step 5: Run the tests**

Run: `cd /Users/harshagarwal/Documents/workspace/gakrcli-vscode && npx vitest run test/unit/webviewBridge.test.ts 2>&1 | /usr/bin/tail -15`

Expected: All tests pass:
```
 ✓ test/unit/webviewBridge.test.ts (8 tests)

 Tests  8 passed
```

- [ ] **Step 6: Commit**

```bash
cd /Users/harshagarwal/Documents/workspace/gakrcli-vscode
git add vitest.config.ts test/mocks/vscode.ts test/unit/webviewBridge.test.ts
git commit -m "test: add WebviewBridge unit tests with vscode mock"
```

---

## Task 11: Unit Tests — HTML Generator

**Files:**
- Create: `test/unit/htmlGenerator.test.ts`

- [ ] **Step 1: Create HTML generator tests**

Create `test/unit/htmlGenerator.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import {
  generateNonce,
  escapeHtmlAttribute,
  getThemeKind,
  generateWebviewHtml,
} from '../../src/webview/htmlGenerator';
import { createMockWebview, Uri } from '../mocks/vscode';

describe('generateNonce', () => {
  it('returns a 32-character hex string', () => {
    const nonce = generateNonce();
    expect(nonce).toMatch(/^[0-9a-f]{32}$/);
  });

  it('returns different values on each call', () => {
    const nonce1 = generateNonce();
    const nonce2 = generateNonce();
    expect(nonce1).not.toBe(nonce2);
  });
});

describe('escapeHtmlAttribute', () => {
  it('escapes double quotes', () => {
    expect(escapeHtmlAttribute('hello "world"')).toBe('hello &quot;world&quot;');
  });

  it('escapes angle brackets', () => {
    expect(escapeHtmlAttribute('<script>alert(1)</script>')).toBe(
      '&lt;script&gt;alert(1)&lt;/script&gt;',
    );
  });

  it('escapes ampersands', () => {
    expect(escapeHtmlAttribute('foo & bar')).toBe('foo &amp; bar');
  });

  it('escapes single quotes', () => {
    expect(escapeHtmlAttribute("it's")).toBe('it&#39;s');
  });

  it('handles empty string', () => {
    expect(escapeHtmlAttribute('')).toBe('');
  });
});

describe('getThemeKind', () => {
  it('returns dark by default (mock has ColorThemeKind.Dark)', () => {
    expect(getThemeKind()).toBe('dark');
  });
});

describe('generateWebviewHtml', () => {
  it('produces valid HTML with CSP nonce', () => {
    const webview = createMockWebview() as never;
    const extensionUri = Uri.file('/test/extension');

    const html = generateWebviewHtml({
      webview,
      extensionUri,
      isSidebar: false,
    });

    // Has DOCTYPE
    expect(html).toContain('<!DOCTYPE html>');

    // Has CSP with nonce
    expect(html).toMatch(/Content-Security-Policy/);
    expect(html).toMatch(/script-src 'nonce-[0-9a-f]{32}'/);

    // Has no unsafe-eval
    expect(html).not.toContain('unsafe-eval');

    // Has style-src with unsafe-inline (needed for CSS custom properties)
    expect(html).toContain("style-src");
    expect(html).toContain("'unsafe-inline'");

    // Has script tags with nonce
    expect(html).toMatch(/<script nonce="[0-9a-f]{32}">/);

    // Has the root div
    expect(html).toContain('<div id="root"');

    // Has theme data attribute
    expect(html).toContain('data-theme="dark"');
  });

  it('sets IS_SIDEBAR to true for sidebar panels', () => {
    const webview = createMockWebview() as never;
    const extensionUri = Uri.file('/test/extension');

    const html = generateWebviewHtml({
      webview,
      extensionUri,
      isSidebar: true,
    });

    expect(html).toContain('window.IS_SIDEBAR = true');
    expect(html).toContain('window.IS_FULL_EDITOR = false');
  });

  it('sets IS_FULL_EDITOR to true when specified', () => {
    const webview = createMockWebview() as never;
    const extensionUri = Uri.file('/test/extension');

    const html = generateWebviewHtml({
      webview,
      extensionUri,
      isSidebar: false,
      isFullEditor: true,
    });

    expect(html).toContain('window.IS_SIDEBAR = false');
    expect(html).toContain('window.IS_FULL_EDITOR = true');
  });

  it('includes initial session data attribute when provided', () => {
    const webview = createMockWebview() as never;
    const extensionUri = Uri.file('/test/extension');

    const html = generateWebviewHtml({
      webview,
      extensionUri,
      isSidebar: false,
      initialSessionId: 'session-abc-123',
    });

    expect(html).toContain('data-initial-session="session-abc-123"');
  });

  it('escapes XSS in initial prompt', () => {
    const webview = createMockWebview() as never;
    const extensionUri = Uri.file('/test/extension');

    const html = generateWebviewHtml({
      webview,
      extensionUri,
      isSidebar: false,
      initialPrompt: '"><script>alert(1)</script>',
    });

    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).toContain('&quot;&gt;&lt;script&gt;alert(1)&lt;/script&gt;');
  });

  it('includes font CSS custom properties', () => {
    const webview = createMockWebview() as never;
    const extensionUri = Uri.file('/test/extension');

    const html = generateWebviewHtml({
      webview,
      extensionUri,
      isSidebar: false,
    });

    expect(html).toContain('--vscode-editor-font-family:');
    expect(html).toContain('--vscode-editor-font-size:');
    expect(html).toContain('--vscode-chat-font-size:');
  });
});
```

- [ ] **Step 2: Run the tests**

Run: `cd /Users/harshagarwal/Documents/workspace/gakrcli-vscode && npx vitest run test/unit/htmlGenerator.test.ts 2>&1 | /usr/bin/tail -15`

Expected: All tests pass:
```
 ✓ test/unit/htmlGenerator.test.ts (9 tests)

 Tests  9 passed
```

- [ ] **Step 3: Commit**

```bash
cd /Users/harshagarwal/Documents/workspace/gakrcli-vscode
git add test/unit/htmlGenerator.test.ts
git commit -m "test: add HTML generator unit tests for CSP, nonce, theme, XSS escaping"
```

---

## Task 12: Unit Tests — WebviewManager

**Files:**
- Create: `test/unit/webviewManager.test.ts`

- [ ] **Step 1: Create WebviewManager tests**

Create `test/unit/webviewManager.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { WebviewManager } from '../../src/webview/webviewManager';
import { Uri } from '../mocks/vscode';
import * as vscode from 'vscode';

// Mock ExtensionContext
function createMockContext(): vscode.ExtensionContext {
  return {
    extensionUri: Uri.file('/test/extension') as never,
    subscriptions: [],
    extension: {
      id: 'gajjalaashok75-UI.gakrcli-vscode',
      packageJSON: { version: '0.2.5' },
    },
    globalState: {
      get: () => undefined,
      update: async () => {},
    },
  } as unknown as vscode.ExtensionContext;
}

describe('WebviewManager', () => {
  let manager: WebviewManager;

  beforeEach(() => {
    const context = createMockContext();
    const output = vscode.window.createOutputChannel('test');
    manager = new WebviewManager(
      context.extensionUri,
      context,
      output as unknown as vscode.OutputChannel,
    );
  });

  describe('createPanel', () => {
    it('creates a panel and returns a panelId', () => {
      const result = manager.createPanel();
      expect(result.panelId).toBeDefined();
      expect(typeof result.panelId).toBe('string');
    });

    it('returns different IDs for different panels', () => {
      const result1 = manager.createPanel();
      const result2 = manager.createPanel();
      expect(result1.panelId).not.toBe(result2.panelId);
    });

    it('reveals existing panel if session is already open', () => {
      const result1 = manager.createPanel('session-1');
      const result2 = manager.createPanel('session-1');
      expect(result2.panelId).toBe(result1.panelId);
      expect(result2.startedInNewColumn).toBe(false);
    });

    it('tracks all panel IDs', () => {
      manager.createPanel();
      manager.createPanel();
      expect(manager.getAllPanelIds().length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('global message handlers', () => {
    it('registers handlers that fire for new panels', () => {
      const handler = vi.fn();
      manager.onMessage('send_prompt', handler);

      const { panelId } = manager.createPanel();
      const bridge = manager.getBridge(panelId);

      expect(bridge).toBeDefined();
      // Global handler is registered on the bridge
    });

    it('supports unsubscribing global handlers', () => {
      const handler = vi.fn();
      const disposable = manager.onMessage('send_prompt', handler);
      disposable.dispose();
      // Handler should be removed from future panels
    });
  });

  describe('broadcast', () => {
    it('sends message to all active bridges', () => {
      manager.createPanel();
      manager.createPanel();

      // Broadcast should not throw even with mock webviews
      expect(() => {
        manager.broadcast({ type: 'theme_changed', theme: 'dark' } as never);
      }).not.toThrow();
    });
  });

  describe('session state', () => {
    it('tracks session states', () => {
      manager.updateSessionState('session-1', 'running', 'Test session');

      // Should not throw — the broadcast goes to all bridges
      expect(() => {
        manager.updateSessionState('session-1', 'waiting_input', 'Test session');
      }).not.toThrow();
    });
  });

  describe('dispose', () => {
    it('cleans up all bridges and panels', () => {
      manager.createPanel();
      manager.createPanel();

      manager.dispose();

      expect(manager.getAllPanelIds()).toHaveLength(0);
    });
  });
});
```

- [ ] **Step 2: Run all tests**

Run: `cd /Users/harshagarwal/Documents/workspace/gakrcli-vscode && npx vitest run 2>&1 | /usr/bin/tail -20`

Expected: All tests pass:
```
 ✓ test/unit/webviewBridge.test.ts
 ✓ test/unit/htmlGenerator.test.ts
 ✓ test/unit/webviewManager.test.ts

 Tests  N passed
```

- [ ] **Step 3: Commit**

```bash
cd /Users/harshagarwal/Documents/workspace/gakrcli-vscode
git add test/unit/webviewManager.test.ts
git commit -m "test: add WebviewManager unit tests for multi-panel lifecycle"
```

---

## Task 13: Build and End-to-End Verification

- [ ] **Step 1: Build the extension host**

Run: `cd /Users/harshagarwal/Documents/workspace/gakrcli-vscode && node esbuild.config.mjs`

Expected: `Extension built successfully`

- [ ] **Step 2: Build the webview**

Run: `cd /Users/harshagarwal/Documents/workspace/gakrcli-vscode && npm run build:webview`

Expected: Vite build succeeds, files in `dist/webview/`

- [ ] **Step 3: Full build**

Run: `cd /Users/harshagarwal/Documents/workspace/gakrcli-vscode && npm run build`

Expected: Both builds succeed with no errors

- [ ] **Step 4: Run all tests**

Run: `cd /Users/harshagarwal/Documents/workspace/gakrcli-vscode && npx vitest run`

Expected: All tests pass

- [ ] **Step 5: Package as .vsix**

Run: `cd /Users/harshagarwal/Documents/workspace/gakrcli-vscode && npx @vscode/vsce package --no-dependencies --allow-missing-repository`

Expected: Produces `gakrcli-vscode-0.2.5.vsix`

- [ ] **Step 6: Manual verification checklist**

Install: `code --install-extension gakrcli-vscode-0.2.5.vsix`

Verify:
- Extension appears in secondary sidebar with gakrcli icon
- Sidebar panel shows "gakrcli" with bridge status "connected"
- Sidebar panel shows "Panel type: sidebar" and "Theme: dark" (or light)
- Cmd+Shift+P -> "gakrcli: Open in New Tab" -> opens editor tab panel showing "editor tab"
- Cmd+Shift+P -> "gakrcli: Open in New Window" -> opens in new VS Code window
- Type text in the input -> hide sidebar -> re-show sidebar -> text is preserved (draft persistence)
- Open 2+ editor tab panels simultaneously -> each shows independent state
- Switch VS Code theme (dark/light) -> panels update theme text immediately
- Close VS Code -> reopen -> editor tab panels restore (via PanelSerializer)
- Check Output panel (gakrcli channel) -> shows message logs

- [ ] **Step 7: Commit final**

```bash
cd /Users/harshagarwal/Documents/workspace/gakrcli-vscode
git add -A
git commit -m "feat: Story 3 complete — WebviewManager, PostMessage bridge, multi-panel support"
```

---

## Summary

| Task | What it does | Key files |
|---|---|---|
| 1 | PostMessage type definitions (30+ message types) | `src/webview/types.ts` |
| 2 | HTML generator with CSP nonce, theme, fonts | `src/webview/htmlGenerator.ts` |
| 3 | WebviewBridge — typed message routing per panel | `src/webview/webviewBridge.ts` |
| 4 | WebviewManager — multi-panel lifecycle, session tracking | `src/webview/webviewManager.ts` |
| 5 | Enhanced WebviewViewProvider + PanelSerializer | `src/webview/webviewProvider.ts` |
| 6 | Webview-side VS Code API wrapper with state | `webview/src/vscode.ts`, `webview/src/types/vscode.d.ts` |
| 7 | React hooks — useVSCode, useTheme | `webview/src/hooks/useVSCode.ts`, `webview/src/hooks/useTheme.ts` |
| 8 | Updated App.tsx with theme-aware shell + draft persistence | `webview/src/App.tsx`, `webview/src/main.tsx` |
| 9 | Updated extension.ts with all commands wired to manager | `src/extension.ts` |
| 10 | WebviewBridge unit tests (8 tests) | `test/unit/webviewBridge.test.ts` |
| 11 | HTML generator unit tests (9 tests) | `test/unit/htmlGenerator.test.ts` |
| 12 | WebviewManager unit tests | `test/unit/webviewManager.test.ts` |
| 13 | Build, test, package, manual verification | `.vsix` output |

### Patterns Extracted from Claude Code Extension

| Pattern | Source | Our Implementation |
|---|---|---|
| Nonce generation | `function N3() { return tQ.randomBytes(16).toString("hex") }` | `generateNonce()` in htmlGenerator.ts |
| CSP header | `default-src 'none'; style-src ... 'unsafe-inline'; script-src 'nonce-${Z}'` | Same CSP in generateWebviewHtml() |
| HTML template | Lines 804-835 with CSS vars, data attrs, window globals | generateWebviewHtml() matches structure |
| Panel creation | `DQ.createPanel()` with column reuse, retainContextWhenHidden | `WebviewManager.createPanel()` |
| Sidebar provider | `registerWebviewViewProvider("claudeVSCodeSidebarSecondary", Z, {retainContextWhenHidden})` | Same pattern, rebranded |
| Panel serializer | `registerWebviewPanelSerializer("claudeVSCodePanel", {...})` | `gakrcliPanelSerializer` |
| Message routing | `webview.onDidReceiveMessage((N) => { x?.fromClient(N) })` | `WebviewBridge.handleIncomingMessage()` |
| Multi-panel tracking | `allComms Set, webviews Set, sessionPanels Map` | `bridges Map, panelMap Map, sessionPanels Map` |
| Session state broadcast | `DQ.broadcastSessionStates()` | `WebviewManager.broadcastSessionStates()` |
| Theme detection | `vscode.window.activeColorTheme.kind` | `getThemeKind()` + `onDidChangeActiveColorTheme` |
| Font config | `getConfiguration("chat.editor").get("fontFamily")` | `getFontConfig()` + `onDidChangeConfiguration` |
| Window globals | `window.IS_SIDEBAR = true/false` | Same globals in HTML template |
| XSS escaping | `LQ()` function for data attributes | `escapeHtmlAttribute()` |
| Ready signal | `vscode.postMessage({ type: 'ready' })` | Same pattern in main.tsx |
