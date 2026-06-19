# Story 8: Session Management — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a session management system that reads JSONL session files from `~/.claude/projects/`, displays them in a searchable and time-grouped list, supports resume/delete/new conversation, auto-updates session titles from `ai-title` messages, and provides a dedicated sessions sidebar view in the activity bar.

**Architecture:** `SessionTracker` (extension host) discovers, streams, and indexes JSONL files using Node.js `readline`. It exposes grouped/searchable session data via an EventEmitter. The webview receives session data via the postMessage bridge and renders `ChatHeader` (title + new/history buttons), `SessionList` (search + grouped overlay), and `SessionCard` (metadata row with delete). Resume spawns CLI with `--resume <uuid>`. A standalone `SessionsViewProvider` populates the `gakrcliSessionsList` webview view registered in `package.json`.

**Tech Stack:** TypeScript 5.x, Node.js (fs, readline, path, os), VS Code Extension API (FileSystemWatcher, WebviewViewProvider), React 18, Tailwind CSS 3, Vitest

**Spec:** [2026-04-02-gakrcli-vscode-extension-design.md](../specs/2026-04-02-gakrcli-vscode-extension-design.md) — Story 8, Sections 2.1, 3.3, 4.4, 5.2

**Dependencies:** Story 4 (ChatPanel, useChat, message rendering), Story 3 (postMessage bridge, WebviewManager), Story 2 (ProcessManager for spawn/resume)

**JSONL file location:** `~/.claude/projects/<project-dir>/<uuid>.jsonl` where `<project-dir>` is the workspace path with `/` replaced by `-` (e.g., `-Users-harsh-workspace-myproject`).

**JSONL entry format (observed from real session files):**
```json
{"type":"user","message":{"role":"user","content":"Hello"},"timestamp":"2026-04-03T01:12:37.505Z","uuid":"f0328d40-...","sessionId":"b5df8108-...","cwd":"/path/to/project","gitBranch":"main","isMeta":false,"entrypoint":"cli"}
{"type":"assistant","message":{"role":"assistant","content":[...],"model":"gpt-5.4"},"timestamp":"...","uuid":"...","sessionId":"..."}
{"type":"file-history-snapshot","messageId":"...","snapshot":{...}}
{"type":"system","subtype":"ai-title","title":"Session Title Here","timestamp":"..."}
```

---

## File Structure

| File | Responsibility |
|---|---|
| `src/session/sessionTracker.ts` | Discover JSONL files, stream-parse metadata, group by time period, search, delete |
| `src/session/sessionsViewProvider.ts` | WebviewViewProvider for the sessions sidebar (activity bar icon) |
| `webview/src/components/header/ChatHeader.tsx` | Top bar: session title, new conversation button, past conversations button |
| `webview/src/components/header/SessionList.tsx` | Searchable overlay with time-grouped session cards |
| `webview/src/components/header/SessionCard.tsx` | Single session row: title, model, relative time, message count, delete |
| `webview/src/hooks/useSession.ts` | React hook: session state, search filtering, grouping, resume/delete actions |
| `test/unit/sessionTracker.test.ts` | Unit tests for parsing, grouping, sorting, title extraction |

---

## Task 1: SessionTracker — Extension Host Module

**Files:**
- Create: `src/session/sessionTracker.ts`

The SessionTracker is the core extension-host module. It reads `~/.claude/projects/<project-dir>/*.jsonl`, extracts session metadata by streaming each file line-by-line, and provides methods for listing, grouping, searching, and deleting sessions.

- [ ] **Step 1: Create the directory**

Run: `mkdir -p /Users/harshagarwal/Documents/workspace/gakrcli-vscode/src/session`

- [ ] **Step 2: Create src/session/sessionTracker.ts**

```typescript
import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import * as readline from 'readline';

export interface SessionInfo {
  /** UUID — matches the JSONL filename without extension */
  id: string;
  /** From ai-title system message, or first non-meta user message, or 'Untitled Session' */
  title: string;
  /** Model string from first assistant message (e.g., 'gpt-5.4', 'claude-sonnet-4-20250514') */
  model: string;
  /** Last message timestamp (most recent activity) */
  timestamp: Date;
  /** First message timestamp (session creation) */
  createdAt: Date;
  /** Count of user + assistant messages, excluding isMeta and file-history-snapshot */
  messageCount: number;
  /** Project directory name in ~/.claude/projects/ */
  projectDir: string;
  /** Absolute path to the .jsonl file */
  filePath: string;
  /** Working directory from first message with a cwd field */
  cwd: string;
  /** Git branch from first message with a gitBranch field */
  gitBranch: string;
}

export type SessionGroup = 'Today' | 'Yesterday' | 'This Week' | 'This Month' | 'Older';

export interface GroupedSessions {
  group: SessionGroup;
  sessions: SessionInfo[];
}

export class SessionTracker implements vscode.Disposable {
  private sessions: Map<string, SessionInfo> = new Map();
  private watcher: vscode.FileSystemWatcher | undefined;
  private readonly _onSessionsChanged = new vscode.EventEmitter<SessionInfo[]>();
  public readonly onSessionsChanged = this._onSessionsChanged.event;
  private disposables: vscode.Disposable[] = [];

  constructor() {
    this.disposables.push(this._onSessionsChanged);
  }

  /** Initialize: scan existing files, start watching for changes. */
  async initialize(): Promise<void> {
    await this.scanAllSessions();
    this.startWatching();
  }

  /** ~/.claude/projects/ */
  private getProjectsDir(): string {
    return path.join(os.homedir(), '.claude', 'projects');
  }

  /**
   * Derive the project directory name for the current workspace.
   * Convention: absolute path with all / replaced by - .
   * Example: /Users/harsh/workspace/myproject -> -Users-harsh-workspace-myproject
   */
  getProjectDirForWorkspace(): string | undefined {
    const folders = vscode.workspace.workspaceFolders;
    if (!folders || folders.length === 0) {
      return undefined;
    }
    return folders[0].uri.fsPath.replace(/\//g, '-');
  }

  /** Scan all JSONL files in the current workspace's project directory. */
  async scanAllSessions(): Promise<void> {
    const projectDir = this.getProjectDirForWorkspace();
    if (!projectDir) {
      return;
    }
    const projectPath = path.join(this.getProjectsDir(), projectDir);
    if (!fs.existsSync(projectPath)) {
      return;
    }

    const files = fs.readdirSync(projectPath).filter(f => f.endsWith('.jsonl'));
    await Promise.all(files.map(f => this.parseSessionFile(path.join(projectPath, f))));
    this._onSessionsChanged.fire(this.getSessionList());
  }

  /**
   * Parse a single JSONL file to extract session metadata.
   * Uses readline to stream line-by-line (never loads entire file into memory).
   */
  async parseSessionFile(filePath: string): Promise<void> {
    const filename = path.basename(filePath, '.jsonl');
    const projectDir = path.basename(path.dirname(filePath));

    let title = '';
    let fallbackTitle = '';
    let model = '';
    let firstTimestamp: Date | undefined;
    let lastTimestamp: Date | undefined;
    let messageCount = 0;
    let cwd = '';
    let gitBranch = '';

    try {
      const fileStream = fs.createReadStream(filePath, { encoding: 'utf-8' });
      const rl = readline.createInterface({
        input: fileStream,
        crlfDelay: Infinity,
      });

      for await (const line of rl) {
        if (!line.trim()) {
          continue;
        }
        let entry: Record<string, unknown>;
        try {
          entry = JSON.parse(line);
        } catch {
          continue; // Skip malformed lines
        }

        // Track timestamps
        if (typeof entry.timestamp === 'string') {
          const ts = new Date(entry.timestamp as string);
          if (!firstTimestamp || ts < firstTimestamp) {
            firstTimestamp = ts;
          }
          if (!lastTimestamp || ts > lastTimestamp) {
            lastTimestamp = ts;
          }
        }

        // Extract cwd and gitBranch from first entry that has them
        if (!cwd && typeof entry.cwd === 'string') {
          cwd = entry.cwd as string;
        }
        if (!gitBranch && typeof entry.gitBranch === 'string') {
          gitBranch = entry.gitBranch as string;
        }

        // Count user messages (skip meta messages)
        if (entry.type === 'user' && !entry.isMeta) {
          messageCount++;
          // Extract fallback title from first non-meta user message
          if (!fallbackTitle) {
            const msg = entry.message as Record<string, unknown> | undefined;
            if (msg) {
              const content = msg.content;
              let text = '';
              if (typeof content === 'string') {
                text = content;
              } else if (Array.isArray(content)) {
                const textBlock = content.find(
                  (b: Record<string, unknown>) => b.type === 'text',
                );
                if (textBlock && typeof textBlock.text === 'string') {
                  text = textBlock.text;
                }
              }
              // Skip command/caveat messages as fallback titles
              if (
                text &&
                !text.startsWith('<command-name>') &&
                !text.startsWith('<local-command')
              ) {
                fallbackTitle = text.slice(0, 120);
              }
            }
          }
        }

        // Count assistant messages and extract model
        if (entry.type === 'assistant') {
          messageCount++;
          if (!model) {
            const msg = entry.message as Record<string, unknown> | undefined;
            if (msg && typeof msg.model === 'string') {
              model = msg.model as string;
            }
          }
        }

        // ai-title system message overrides any fallback title
        if (
          entry.type === 'system' &&
          entry.subtype === 'ai-title' &&
          typeof (entry as Record<string, unknown>).title === 'string'
        ) {
          title = (entry as Record<string, unknown>).title as string;
        }
      }
    } catch (err) {
      console.error(`SessionTracker: failed to parse ${filePath}:`, err);
      return;
    }

    if (!firstTimestamp) {
      return; // Empty or completely unparseable file
    }

    this.sessions.set(filename, {
      id: filename,
      title: title || fallbackTitle || 'Untitled Session',
      model: model || 'unknown',
      timestamp: lastTimestamp || firstTimestamp,
      createdAt: firstTimestamp,
      messageCount,
      projectDir,
      filePath,
      cwd,
      gitBranch,
    });
  }

  /** Watch for new/changed/deleted JSONL files in the project directory. */
  private startWatching(): void {
    const projectDir = this.getProjectDirForWorkspace();
    if (!projectDir) {
      return;
    }
    const pattern = new vscode.RelativePattern(
      vscode.Uri.file(path.join(this.getProjectsDir(), projectDir)),
      '*.jsonl',
    );
    this.watcher = vscode.workspace.createFileSystemWatcher(pattern);

    this.watcher.onDidCreate(async (uri) => {
      await this.parseSessionFile(uri.fsPath);
      this._onSessionsChanged.fire(this.getSessionList());
    });
    this.watcher.onDidChange(async (uri) => {
      await this.parseSessionFile(uri.fsPath);
      this._onSessionsChanged.fire(this.getSessionList());
    });
    this.watcher.onDidDelete((uri) => {
      this.sessions.delete(path.basename(uri.fsPath, '.jsonl'));
      this._onSessionsChanged.fire(this.getSessionList());
    });

    this.disposables.push(this.watcher);
  }

  /** All sessions sorted by timestamp descending. */
  getSessionList(): SessionInfo[] {
    return Array.from(this.sessions.values()).sort(
      (a, b) => b.timestamp.getTime() - a.timestamp.getTime(),
    );
  }

  /** Sessions grouped into time-period buckets, only including non-empty groups. */
  getGroupedSessions(): GroupedSessions[] {
    const sessions = this.getSessionList();
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterdayStart = new Date(todayStart.getTime() - 86_400_000);
    const weekStart = new Date(todayStart.getTime() - 7 * 86_400_000);
    const monthStart = new Date(todayStart.getTime() - 30 * 86_400_000);

    const buckets: Record<SessionGroup, SessionInfo[]> = {
      'Today': [],
      'Yesterday': [],
      'This Week': [],
      'This Month': [],
      'Older': [],
    };

    for (const s of sessions) {
      const t = s.timestamp.getTime();
      if (t >= todayStart.getTime()) {
        buckets['Today'].push(s);
      } else if (t >= yesterdayStart.getTime()) {
        buckets['Yesterday'].push(s);
      } else if (t >= weekStart.getTime()) {
        buckets['This Week'].push(s);
      } else if (t >= monthStart.getTime()) {
        buckets['This Month'].push(s);
      } else {
        buckets['Older'].push(s);
      }
    }

    const order: SessionGroup[] = ['Today', 'Yesterday', 'This Week', 'This Month', 'Older'];
    return order
      .filter((g) => buckets[g].length > 0)
      .map((g) => ({ group: g, sessions: buckets[g] }));
  }

  /** Search sessions by keyword (matches title, model, gitBranch). */
  searchSessions(query: string): SessionInfo[] {
    const q = query.toLowerCase();
    return this.getSessionList().filter(
      (s) =>
        s.title.toLowerCase().includes(q) ||
        s.model.toLowerCase().includes(q) ||
        s.gitBranch.toLowerCase().includes(q),
    );
  }

  /** Get a single session by its UUID. */
  getSession(id: string): SessionInfo | undefined {
    return this.sessions.get(id);
  }

  /** Delete a session by removing its JSONL file. Only deletes inside ~/.claude/projects/. */
  async deleteSession(id: string): Promise<boolean> {
    const session = this.sessions.get(id);
    if (!session) {
      return false;
    }
    // Safety: never delete outside the projects directory
    const projectsDir = this.getProjectsDir();
    if (!session.filePath.startsWith(projectsDir)) {
      console.error('SessionTracker: refusing to delete file outside projects dir');
      return false;
    }
    try {
      await fs.promises.unlink(session.filePath);
      this.sessions.delete(id);
      this._onSessionsChanged.fire(this.getSessionList());
      return true;
    } catch (err) {
      console.error(`SessionTracker: failed to delete session ${id}:`, err);
      return false;
    }
  }

  /** Update a session's title (called when ai-title arrives during active session). */
  updateSessionTitle(sessionId: string, newTitle: string): void {
    const s = this.sessions.get(sessionId);
    if (s) {
      s.title = newTitle;
      this._onSessionsChanged.fire(this.getSessionList());
    }
  }

  dispose(): void {
    for (const d of this.disposables) {
      d.dispose();
    }
    this.disposables = [];
    this.sessions.clear();
  }
}
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `cd /Users/harshagarwal/Documents/workspace/gakrcli-vscode && npx tsc --noEmit src/session/sessionTracker.ts 2>&1 || echo "Type check done (expected errors for missing vscode types until npm install)"`

- [ ] **Step 4: Commit**

```bash
git add src/session/sessionTracker.ts
git commit -m "feat(session): add SessionTracker with JSONL parsing, grouping, search, and file watcher"
```

---

## Task 2: Unit Tests for SessionTracker

**Files:**
- Create: `test/unit/sessionTracker.test.ts`

- [ ] **Step 1: Create the test directory**

Run: `mkdir -p /Users/harshagarwal/Documents/workspace/gakrcli-vscode/test/unit`

- [ ] **Step 2: Create test/unit/sessionTracker.test.ts**

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

/**
 * Tests for SessionTracker parsing and grouping logic.
 *
 * We test the pure logic by writing JSONL files to a temp directory,
 * then verifying parsing behavior. Full VS Code integration tests
 * (FileSystemWatcher, WebviewViewProvider) require the extension host.
 */

describe('SessionTracker — JSONL parsing', () => {
  const testDir = path.join(os.tmpdir(), 'gakrcli-session-test-' + Date.now());
  const projectDir = path.join(testDir, '-test-project');

  beforeEach(() => {
    fs.mkdirSync(projectDir, { recursive: true });
  });

  afterEach(() => {
    fs.rmSync(testDir, { recursive: true, force: true });
  });

  function writeJsonl(id: string, lines: object[]): string {
    const filePath = path.join(projectDir, `${id}.jsonl`);
    fs.writeFileSync(filePath, lines.map((l) => JSON.stringify(l)).join('\n') + '\n');
    return filePath;
  }

  it('should produce valid JSONL that can be parsed line by line', () => {
    const filePath = writeJsonl('session-001', [
      {
        type: 'user',
        message: { role: 'user', content: 'Hello world' },
        timestamp: '2026-04-02T10:00:00.000Z',
        uuid: 'msg-1',
        sessionId: 'session-001',
        cwd: '/test',
        gitBranch: 'main',
        isMeta: false,
      },
      {
        type: 'assistant',
        message: {
          role: 'assistant',
          content: [{ type: 'text', text: 'Hi there!' }],
          model: 'gpt-5.4',
        },
        timestamp: '2026-04-02T10:00:05.000Z',
        uuid: 'msg-2',
        sessionId: 'session-001',
      },
    ]);

    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.trim().split('\n');
    expect(lines).toHaveLength(2);

    const first = JSON.parse(lines[0]);
    expect(first.type).toBe('user');
    expect(first.message.content).toBe('Hello world');

    const second = JSON.parse(lines[1]);
    expect(second.type).toBe('assistant');
    expect(second.message.model).toBe('gpt-5.4');
  });

  it('should skip meta messages when counting', () => {
    writeJsonl('session-002', [
      {
        type: 'user',
        message: { role: 'user', content: 'Real message' },
        timestamp: '2026-04-02T10:00:00.000Z',
        isMeta: false,
      },
      {
        type: 'user',
        message: { role: 'user', content: [{ type: 'tool_result', content: 'tool output' }] },
        timestamp: '2026-04-02T10:00:01.000Z',
        isMeta: true,
      },
      {
        type: 'file-history-snapshot',
        messageId: 'msg-x',
        snapshot: {},
      },
    ]);

    const content = fs.readFileSync(path.join(projectDir, 'session-002.jsonl'), 'utf-8');
    const lines = content
      .trim()
      .split('\n')
      .map((l) => JSON.parse(l));
    const countable = lines.filter((l) => l.type === 'user' && !l.isMeta);
    expect(countable).toHaveLength(1);
  });

  it('should prefer ai-title over first user message for session title', () => {
    const lines = [
      {
        type: 'user',
        message: { role: 'user', content: 'Fallback title from user prompt' },
        timestamp: '2026-04-02T10:00:00.000Z',
        isMeta: false,
      },
      {
        type: 'system',
        subtype: 'ai-title',
        title: 'AI Generated Title',
        timestamp: '2026-04-02T10:00:10.000Z',
      },
    ];

    // Simulate the extraction priority logic from SessionTracker.parseSessionFile
    let title = '';
    let fallbackTitle = '';
    for (const entry of lines) {
      if (entry.type === 'user' && !entry.isMeta && !fallbackTitle) {
        const content =
          typeof entry.message?.content === 'string' ? entry.message.content : '';
        if (content && !content.startsWith('<command-name>')) {
          fallbackTitle = content.slice(0, 120);
        }
      }
      if (entry.type === 'system' && entry.subtype === 'ai-title' && entry.title) {
        title = entry.title;
      }
    }
    const finalTitle = title || fallbackTitle || 'Untitled Session';
    expect(finalTitle).toBe('AI Generated Title');
  });

  it('should fall back to first user message when no ai-title exists', () => {
    const lines = [
      {
        type: 'user',
        message: { role: 'user', content: 'Fix the websocket reconnect bug' },
        timestamp: '2026-04-02T10:00:00.000Z',
        isMeta: false,
      },
      {
        type: 'assistant',
        message: { role: 'assistant', content: [{ type: 'text', text: 'Sure!' }], model: 'gpt-5.4' },
        timestamp: '2026-04-02T10:00:05.000Z',
      },
    ];

    let fallbackTitle = '';
    for (const entry of lines) {
      if (entry.type === 'user' && !entry.isMeta && !fallbackTitle) {
        const content =
          typeof entry.message?.content === 'string' ? entry.message.content : '';
        if (content) fallbackTitle = content.slice(0, 120);
      }
    }
    expect(fallbackTitle).toBe('Fix the websocket reconnect bug');
  });

  it('should skip command messages as fallback titles', () => {
    const lines = [
      {
        type: 'user',
        message: { role: 'user', content: '<command-name>/provider</command-name>' },
        timestamp: '2026-04-02T10:00:00.000Z',
        isMeta: false,
      },
      {
        type: 'user',
        message: { role: 'user', content: 'Now fix the bug' },
        timestamp: '2026-04-02T10:00:01.000Z',
        isMeta: false,
      },
    ];

    let fallbackTitle = '';
    for (const entry of lines) {
      if (entry.type === 'user' && !entry.isMeta && !fallbackTitle) {
        const content =
          typeof entry.message?.content === 'string' ? entry.message.content : '';
        if (content && !content.startsWith('<command-name>') && !content.startsWith('<local-command')) {
          fallbackTitle = content.slice(0, 120);
        }
      }
    }
    expect(fallbackTitle).toBe('Now fix the bug');
  });
});

describe('SessionTracker — time grouping', () => {
  it('should place sessions into correct time buckets', () => {
    const now = new Date();
    const todayNoon = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12, 0, 0);
    const yesterdayNoon = new Date(todayNoon.getTime() - 86_400_000);
    const threeDaysAgo = new Date(todayNoon.getTime() - 3 * 86_400_000);
    const fifteenDaysAgo = new Date(todayNoon.getTime() - 15 * 86_400_000);
    const sixtyDaysAgo = new Date(todayNoon.getTime() - 60 * 86_400_000);

    const timestamps = [todayNoon, yesterdayNoon, threeDaysAgo, fifteenDaysAgo, sixtyDaysAgo];

    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterdayStart = new Date(todayStart.getTime() - 86_400_000);
    const weekStart = new Date(todayStart.getTime() - 7 * 86_400_000);
    const monthStart = new Date(todayStart.getTime() - 30 * 86_400_000);

    const buckets: Record<string, Date[]> = {
      'Today': [],
      'Yesterday': [],
      'This Week': [],
      'This Month': [],
      'Older': [],
    };

    for (const ts of timestamps) {
      const t = ts.getTime();
      if (t >= todayStart.getTime()) buckets['Today'].push(ts);
      else if (t >= yesterdayStart.getTime()) buckets['Yesterday'].push(ts);
      else if (t >= weekStart.getTime()) buckets['This Week'].push(ts);
      else if (t >= monthStart.getTime()) buckets['This Month'].push(ts);
      else buckets['Older'].push(ts);
    }

    expect(buckets['Today']).toHaveLength(1);
    expect(buckets['Yesterday']).toHaveLength(1);
    expect(buckets['This Week']).toHaveLength(1);
    expect(buckets['This Month']).toHaveLength(1);
    expect(buckets['Older']).toHaveLength(1);
  });

  it('should sort sessions newest first within each bucket', () => {
    const sessions = [
      { timestamp: new Date('2026-04-02T08:00:00Z') },
      { timestamp: new Date('2026-04-02T12:00:00Z') },
      { timestamp: new Date('2026-04-02T10:00:00Z') },
    ];

    const sorted = [...sessions].sort(
      (a, b) => b.timestamp.getTime() - a.timestamp.getTime(),
    );

    expect(sorted[0].timestamp.toISOString()).toBe('2026-04-02T12:00:00.000Z');
    expect(sorted[1].timestamp.toISOString()).toBe('2026-04-02T10:00:00.000Z');
    expect(sorted[2].timestamp.toISOString()).toBe('2026-04-02T08:00:00.000Z');
  });
});

describe('SessionTracker — search', () => {
  it('should match sessions by title substring', () => {
    const sessions = [
      { title: 'Fix websocket reconnect bug', model: 'gpt-5.4', gitBranch: 'main' },
      { title: 'Add auth middleware', model: 'claude-sonnet', gitBranch: 'feat/auth' },
      { title: 'Refactor API layer', model: 'gpt-5.4', gitBranch: 'main' },
    ];

    const query = 'auth';
    const results = sessions.filter(
      (s) =>
        s.title.toLowerCase().includes(query) ||
        s.model.toLowerCase().includes(query) ||
        s.gitBranch.toLowerCase().includes(query),
    );

    // Matches "Add auth middleware" by title and "feat/auth" by gitBranch
    expect(results).toHaveLength(2);
  });

  it('should match sessions by model name', () => {
    const sessions = [
      { title: 'Session A', model: 'gpt-5.4', gitBranch: 'main' },
      { title: 'Session B', model: 'claude-sonnet', gitBranch: 'main' },
    ];

    const query = 'claude';
    const results = sessions.filter(
      (s) =>
        s.title.toLowerCase().includes(query) ||
        s.model.toLowerCase().includes(query) ||
        s.gitBranch.toLowerCase().includes(query),
    );

    expect(results).toHaveLength(1);
    expect(results[0].title).toBe('Session B');
  });
});
```

- [ ] **Step 3: Run the tests**

Run: `cd /Users/harshagarwal/Documents/workspace/gakrcli-vscode && npx vitest run test/unit/sessionTracker.test.ts`

Expected: All tests pass.

- [ ] **Step 4: Commit**

```bash
git add test/unit/sessionTracker.test.ts
git commit -m "test(session): add unit tests for JSONL parsing, time grouping, search, and title extraction"
```

---

## Task 3: useSession Hook — Webview State Management

**Files:**
- Create: `webview/src/hooks/useSession.ts`

This React hook manages all session-related state in the webview: session list, search query, active session, grouped display, and actions (resume, delete, new conversation).

- [ ] **Step 1: Create the directory**

Run: `mkdir -p /Users/harshagarwal/Documents/workspace/gakrcli-vscode/webview/src/hooks`

- [ ] **Step 2: Create webview/src/hooks/useSession.ts**

```typescript
import { useState, useEffect, useCallback } from 'react';
import { vscode } from '../vscode';

export interface SessionData {
  id: string;
  title: string;
  model: string;
  timestamp: string;   // ISO 8601
  createdAt: string;    // ISO 8601
  messageCount: number;
  cwd: string;
  gitBranch: string;
}

export interface GroupedSessionData {
  group: string;       // 'Today' | 'Yesterday' | 'This Week' | 'This Month' | 'Older'
  sessions: SessionData[];
}

export interface UseSessionReturn {
  groupedSessions: GroupedSessionData[];
  allSessions: SessionData[];
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  filteredSessions: SessionData[];
  isSessionListOpen: boolean;
  setSessionListOpen: (open: boolean) => void;
  activeSessionId: string | null;
  sessionTitle: string;
  resumeSession: (sessionId: string) => void;
  deleteSession: (sessionId: string) => void;
  newConversation: () => void;
  isLoading: boolean;
}

export function useSession(): UseSessionReturn {
  const [groupedSessions, setGroupedSessions] = useState<GroupedSessionData[]>([]);
  const [allSessions, setAllSessions] = useState<SessionData[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredSessions, setFilteredSessions] = useState<SessionData[]>([]);
  const [isSessionListOpen, setSessionListOpen] = useState(false);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [sessionTitle, setSessionTitle] = useState('New Conversation');
  const [isLoading, setIsLoading] = useState(true);

  // Listen for messages from the extension host
  useEffect(() => {
    const handler = (event: MessageEvent) => {
      const msg = event.data;
      switch (msg.type) {
        case 'sessionsData': {
          setGroupedSessions(msg.grouped);
          const flat: SessionData[] = msg.grouped.flatMap(
            (g: GroupedSessionData) => g.sessions,
          );
          setAllSessions(flat);
          setIsLoading(false);
          break;
        }
        case 'sessionsUpdated': {
          setAllSessions(msg.sessions);
          // Re-request grouped view
          vscode.postMessage({ type: 'getSessions' });
          break;
        }
        case 'sessionDeleted': {
          if (msg.success && msg.sessionId === activeSessionId) {
            setActiveSessionId(null);
            setSessionTitle('New Conversation');
          }
          break;
        }
        case 'sessionResumed': {
          setActiveSessionId(msg.sessionId);
          setSessionTitle(msg.title || 'Resumed Session');
          setSessionListOpen(false);
          break;
        }
        case 'sessionTitleUpdate': {
          if (msg.sessionId === activeSessionId || !activeSessionId) {
            setSessionTitle(msg.title);
            setActiveSessionId(msg.sessionId);
          }
          break;
        }
      }
    };

    window.addEventListener('message', handler);
    // Request initial data
    vscode.postMessage({ type: 'getSessions' });
    return () => window.removeEventListener('message', handler);
  }, [activeSessionId]);

  // Client-side search filtering (instant, no round-trip)
  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredSessions([]);
      return;
    }
    const q = searchQuery.toLowerCase();
    setFilteredSessions(
      allSessions.filter(
        (s) =>
          s.title.toLowerCase().includes(q) ||
          s.model.toLowerCase().includes(q) ||
          s.gitBranch.toLowerCase().includes(q),
      ),
    );
  }, [searchQuery, allSessions]);

  const resumeSession = useCallback((sessionId: string) => {
    vscode.postMessage({ type: 'resumeSession', sessionId });
  }, []);

  const deleteSession = useCallback((sessionId: string) => {
    vscode.postMessage({ type: 'deleteSession', sessionId });
  }, []);

  const newConversation = useCallback(() => {
    vscode.postMessage({ type: 'newConversation' });
    setActiveSessionId(null);
    setSessionTitle('New Conversation');
    setSessionListOpen(false);
  }, []);

  return {
    groupedSessions,
    allSessions,
    searchQuery,
    setSearchQuery,
    filteredSessions,
    isSessionListOpen,
    setSessionListOpen,
    activeSessionId,
    sessionTitle,
    resumeSession,
    deleteSession,
    newConversation,
    isLoading,
  };
}
```

- [ ] **Step 3: Commit**

```bash
git add webview/src/hooks/useSession.ts
git commit -m "feat(session): add useSession hook for webview session state management"
```

---

## Task 4: SessionCard Component

**Files:**
- Create: `webview/src/components/header/SessionCard.tsx`

Each session in the list is a clickable card showing title, model badge, relative timestamp, message count, and a hover-visible delete button with confirmation.

- [ ] **Step 1: Create the directory**

Run: `mkdir -p /Users/harshagarwal/Documents/workspace/gakrcli-vscode/webview/src/components/header`

- [ ] **Step 2: Create webview/src/components/header/SessionCard.tsx**

```tsx
import React, { useState } from 'react';
import type { SessionData } from '../../hooks/useSession';

interface SessionCardProps {
  session: SessionData;
  isActive: boolean;
  onResume: (id: string) => void;
  onDelete: (id: string) => void;
}

/** Format ISO timestamp as a human-readable relative string. */
function formatRelativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  const hours = Math.floor(diff / 3_600_000);
  const days = Math.floor(diff / 86_400_000);

  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export const SessionCard: React.FC<SessionCardProps> = ({
  session,
  isActive,
  onResume,
  onDelete,
}) => {
  const [confirmDelete, setConfirmDelete] = useState(false);

  const handleDeleteClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirmDelete) {
      onDelete(session.id);
      setConfirmDelete(false);
    } else {
      setConfirmDelete(true);
      setTimeout(() => setConfirmDelete(false), 3000);
    }
  };

  return (
    <div
      className={`group flex items-start gap-2 px-3 py-2 cursor-pointer rounded transition-colors ${
        isActive
          ? 'bg-[var(--vscode-list-activeSelectionBackground)] text-[var(--vscode-list-activeSelectionForeground)]'
          : 'hover:bg-[var(--vscode-list-hoverBackground)]'
      }`}
      onClick={() => onResume(session.id)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') onResume(session.id);
      }}
    >
      {/* Session info */}
      <div className="flex-1 min-w-0">
        <div className="text-xs font-medium truncate" title={session.title}>
          {session.title}
        </div>
        <div className="flex items-center gap-2 mt-0.5 text-[10px] opacity-60">
          <span className="truncate max-w-[100px]" title={session.model}>
            {session.model}
          </span>
          <span>&middot;</span>
          <span>{formatRelativeTime(session.timestamp)}</span>
          <span>&middot;</span>
          <span>{session.messageCount} msg{session.messageCount !== 1 ? 's' : ''}</span>
        </div>
      </div>

      {/* Delete button — visible on hover, red on confirm */}
      <button
        className={`flex-shrink-0 p-1 rounded transition-all ${
          confirmDelete
            ? 'opacity-100 text-[var(--vscode-errorForeground)]'
            : 'opacity-0 group-hover:opacity-60 hover:!opacity-100'
        } hover:bg-[var(--vscode-toolbar-hoverBackground)]`}
        onClick={handleDeleteClick}
        title={confirmDelete ? 'Click again to confirm' : 'Delete session'}
        aria-label={confirmDelete ? 'Confirm delete' : 'Delete session'}
      >
        {confirmDelete ? (
          <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
            <path d="M14.431 3.323l-8.47 10-.79-.036-3.35-4.77.818-.574 2.978 4.24 8.051-9.506.763.646z"/>
          </svg>
        ) : (
          <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
            <path d="M10 3h3v1h-1v9l-1 1H4l-1-1V4H2V3h3V2a1 1 0 0 1 1-1h3a1 1 0 0 1 1 1v1zM9 2H6v1h3V2zM4 13h7V4H4v9zm2-8H5v7h1V5zm1 0h1v7H7V5zm2 0h1v7H9V5z"/>
          </svg>
        )}
      </button>
    </div>
  );
};
```

- [ ] **Step 3: Commit**

```bash
git add webview/src/components/header/SessionCard.tsx
git commit -m "feat(session): add SessionCard with relative time, model badge, and delete confirmation"
```

---

## Task 5: SessionList Component

**Files:**
- Create: `webview/src/components/header/SessionList.tsx`

The SessionList is an overlay panel that slides below the ChatHeader. It contains a search input, time-grouped session cards, and supports Escape to close and click-outside to dismiss.

- [ ] **Step 1: Create webview/src/components/header/SessionList.tsx**

```tsx
import React, { useRef, useEffect } from 'react';
import { SessionCard } from './SessionCard';
import type { SessionData, GroupedSessionData } from '../../hooks/useSession';

interface SessionListProps {
  groupedSessions: GroupedSessionData[];
  filteredSessions: SessionData[];
  searchQuery: string;
  onSearchChange: (query: string) => void;
  activeSessionId: string | null;
  onResumeSession: (id: string) => void;
  onDeleteSession: (id: string) => void;
  onClose: () => void;
}

export const SessionList: React.FC<SessionListProps> = ({
  groupedSessions,
  filteredSessions,
  searchQuery,
  onSearchChange,
  activeSessionId,
  onResumeSession,
  onDeleteSession,
  onClose,
}) => {
  const searchRef = useRef<HTMLInputElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const isSearching = searchQuery.trim().length > 0;

  // Auto-focus search input on mount
  useEffect(() => {
    searchRef.current?.focus();
  }, []);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  // Close on click outside (with brief delay to avoid catching the opening click)
  useEffect(() => {
    let cleanup: (() => void) | undefined;
    const timer = setTimeout(() => {
      const handler = (e: MouseEvent) => {
        if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
          onClose();
        }
      };
      document.addEventListener('mousedown', handler);
      cleanup = () => document.removeEventListener('mousedown', handler);
    }, 100);
    return () => {
      clearTimeout(timer);
      cleanup?.();
    };
  }, [onClose]);

  return (
    <div
      ref={panelRef}
      className="absolute top-[40px] left-0 right-0 z-50 bg-[var(--vscode-sideBar-background)] border border-vscode-border rounded-b shadow-lg max-h-[400px] flex flex-col"
    >
      {/* Search */}
      <div className="px-3 py-2 border-b border-vscode-border">
        <div className="relative">
          <svg
            className="absolute left-2 top-1/2 -translate-y-1/2 opacity-50"
            width="12" height="12" viewBox="0 0 16 16" fill="currentColor"
          >
            <path d="M15.25 15.02l-4.625-4.625a5.5 5.5 0 1 0-.707.707l4.625 4.625.707-.707zM6.5 11a4.5 4.5 0 1 1 0-9 4.5 4.5 0 0 1 0 9z"/>
          </svg>
          <input
            ref={searchRef}
            type="text"
            placeholder="Search past conversations..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full pl-7 pr-7 py-1.5 text-xs bg-vscode-input-bg text-vscode-input-fg border border-vscode-input-border rounded focus:outline-none focus:border-[var(--vscode-focusBorder)]"
          />
          {searchQuery && (
            <button
              onClick={() => onSearchChange('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 opacity-50 hover:opacity-100"
              aria-label="Clear search"
            >
              <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
                <path d="M8 8.707l3.646 3.647.708-.707L8.707 8l3.647-3.646-.707-.708L8 7.293 4.354 3.646l-.707.708L7.293 8l-3.646 3.646.707.708L8 8.707z"/>
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Session list body */}
      <div className="overflow-y-auto flex-1 py-1">
        {isSearching ? (
          filteredSessions.length > 0 ? (
            filteredSessions.map((s) => (
              <SessionCard
                key={s.id}
                session={s}
                isActive={s.id === activeSessionId}
                onResume={onResumeSession}
                onDelete={onDeleteSession}
              />
            ))
          ) : (
            <div className="px-3 py-6 text-center text-xs opacity-50">
              No sessions matching &ldquo;{searchQuery}&rdquo;
            </div>
          )
        ) : groupedSessions.length > 0 ? (
          groupedSessions.map((group) => (
            <div key={group.group}>
              <div className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider opacity-50">
                {group.group}
              </div>
              {group.sessions.map((s) => (
                <SessionCard
                  key={s.id}
                  session={s}
                  isActive={s.id === activeSessionId}
                  onResume={onResumeSession}
                  onDelete={onDeleteSession}
                />
              ))}
            </div>
          ))
        ) : (
          <div className="px-3 py-6 text-center text-xs opacity-50">
            No past conversations yet
          </div>
        )}
      </div>
    </div>
  );
};
```

- [ ] **Step 2: Commit**

```bash
git add webview/src/components/header/SessionList.tsx
git commit -m "feat(session): add SessionList with search, grouped display, and keyboard dismiss"
```

---

## Task 6: ChatHeader Component

**Files:**
- Create: `webview/src/components/header/ChatHeader.tsx`

The ChatHeader sits at the top of the ChatPanel. Left side: history button (clock icon). Center: session title. Right side: new conversation button (plus icon).

- [ ] **Step 1: Create webview/src/components/header/ChatHeader.tsx**

```tsx
import React from 'react';

interface ChatHeaderProps {
  sessionTitle: string;
  isSessionListOpen: boolean;
  onToggleSessionList: () => void;
  onNewConversation: () => void;
}

export const ChatHeader: React.FC<ChatHeaderProps> = ({
  sessionTitle,
  isSessionListOpen,
  onToggleSessionList,
  onNewConversation,
}) => {
  return (
    <div className="flex items-center justify-between px-3 py-2 border-b border-vscode-border min-h-[40px]">
      {/* History button */}
      <button
        onClick={onToggleSessionList}
        className={`flex items-center gap-1 px-2 py-1 rounded text-xs transition-colors hover:bg-[var(--vscode-toolbar-hoverBackground)] ${
          isSessionListOpen ? 'bg-[var(--vscode-toolbar-activeBackground)]' : ''
        }`}
        title="Past Conversations"
        aria-label="Past Conversations"
      >
        <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
          <path d="M13.507 12.324a7 7 0 0 0 .065-8.56A7 7 0 0 0 2 4.393V2H1v3.5l.5.5H5V5H2.811a6.008 6.008 0 1 1-.135 5.77l-.887.462a7 7 0 0 0 11.718 1.092zM8 4v4.5l.5.5H11v-1H9V4H8z"/>
        </svg>
        <span className="hidden sm:inline">History</span>
      </button>

      {/* Session title */}
      <div className="flex-1 text-center truncate px-2">
        <span className="text-xs font-medium opacity-80" title={sessionTitle}>
          {sessionTitle}
        </span>
      </div>

      {/* New conversation button */}
      <button
        onClick={onNewConversation}
        className="flex items-center gap-1 px-2 py-1 rounded text-xs transition-colors hover:bg-[var(--vscode-toolbar-hoverBackground)]"
        title="New Conversation"
        aria-label="New Conversation"
      >
        <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
          <path d="M14 7v1H8v6H7V8H1V7h6V1h1v6h6z"/>
        </svg>
        <span className="hidden sm:inline">New</span>
      </button>
    </div>
  );
};
```

- [ ] **Step 2: Commit**

```bash
git add webview/src/components/header/ChatHeader.tsx
git commit -m "feat(session): add ChatHeader with title, history toggle, and new conversation button"
```

---

## Task 7: Integrate Session Components into ChatPanel

**Files:**
- Modify: `webview/src/components/chat/ChatPanel.tsx`

Wire ChatHeader, SessionList, and useSession into the existing ChatPanel.

- [ ] **Step 1: Add imports and hook call to ChatPanel.tsx**

Add at the top of `ChatPanel.tsx`:

```typescript
import { ChatHeader } from '../header/ChatHeader';
import { SessionList } from '../header/SessionList';
import { useSession } from '../../hooks/useSession';
```

Inside the component function, add:

```typescript
const {
  groupedSessions,
  filteredSessions,
  searchQuery,
  setSearchQuery,
  isSessionListOpen,
  setSessionListOpen,
  activeSessionId,
  sessionTitle,
  resumeSession,
  deleteSession,
  newConversation,
} = useSession();
```

- [ ] **Step 2: Add ChatHeader and SessionList to the JSX**

Wrap the existing ChatPanel return in a relative container and add the header:

```tsx
return (
  <div className="flex flex-col h-full relative">
    <ChatHeader
      sessionTitle={sessionTitle}
      isSessionListOpen={isSessionListOpen}
      onToggleSessionList={() => setSessionListOpen(!isSessionListOpen)}
      onNewConversation={newConversation}
    />

    {isSessionListOpen && (
      <SessionList
        groupedSessions={groupedSessions}
        filteredSessions={filteredSessions}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        activeSessionId={activeSessionId}
        onResumeSession={resumeSession}
        onDeleteSession={deleteSession}
        onClose={() => setSessionListOpen(false)}
      />
    )}

    {/* ... existing MessageList, PromptInput, etc. ... */}
  </div>
);
```

- [ ] **Step 3: Handle session title updates from ai-title in useChat/useStream**

In the existing message handler (from Story 4), add a case when processing CLI output:

```typescript
// When receiving a system message with subtype 'ai-title' from the CLI stream:
if (parsedMessage.type === 'system' && parsedMessage.subtype === 'ai-title') {
  vscode.postMessage({
    type: 'updateSessionTitle',
    sessionId: parsedMessage.sessionId,
    title: parsedMessage.title,
  });
}
```

- [ ] **Step 4: Build the webview to verify no TypeScript errors**

Run: `cd /Users/harshagarwal/Documents/workspace/gakrcli-vscode && npm run build:webview`

Expected: Build succeeds.

- [ ] **Step 5: Commit**

```bash
git add webview/src/components/chat/ChatPanel.tsx
git commit -m "feat(session): integrate ChatHeader, SessionList, and useSession into ChatPanel"
```

---

## Task 8: Wire SessionTracker into Extension Activation

**Files:**
- Modify: `src/extension.ts`
- Modify: `src/webview/webviewProvider.ts` (or `webviewManager.ts`)

The SessionTracker must be initialized on activation, and the webview message handler must route session-related messages.

- [ ] **Step 1: Add SessionTracker to extension.ts activate()**

```typescript
import { SessionTracker } from './session/sessionTracker';

// Inside activate():
const sessionTracker = new SessionTracker();
await sessionTracker.initialize();
context.subscriptions.push(sessionTracker);

// Broadcast session changes to all webviews
sessionTracker.onSessionsChanged((sessions) => {
  webviewManager?.postMessageToAll({
    type: 'sessionsUpdated',
    sessions: sessions.map((s) => ({
      id: s.id,
      title: s.title,
      model: s.model,
      timestamp: s.timestamp.toISOString(),
      createdAt: s.createdAt.toISOString(),
      messageCount: s.messageCount,
      cwd: s.cwd,
      gitBranch: s.gitBranch,
    })),
  });
});
```

- [ ] **Step 2: Add session message handlers to webview onDidReceiveMessage**

In the webview message handler (inside `webviewProvider.ts` or `webviewManager.ts`):

```typescript
case 'getSessions': {
  const grouped = sessionTracker.getGroupedSessions();
  panel.webview.postMessage({
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
  });
  break;
}

case 'resumeSession': {
  processManager.spawnWithResume(message.sessionId);
  break;
}

case 'deleteSession': {
  const ok = await sessionTracker.deleteSession(message.sessionId);
  panel.webview.postMessage({
    type: 'sessionDeleted',
    sessionId: message.sessionId,
    success: ok,
  });
  break;
}

case 'newConversation': {
  processManager.spawnFresh();
  break;
}

case 'updateSessionTitle': {
  sessionTracker.updateSessionTitle(message.sessionId, message.title);
  panel.webview.postMessage({
    type: 'sessionTitleUpdate',
    sessionId: message.sessionId,
    title: message.title,
  });
  break;
}
```

- [ ] **Step 3: Add resume/fresh methods to ProcessManager**

In `src/process/processManager.ts`, add:

```typescript
/** Spawn CLI with --resume <uuid> to continue an existing session. */
async spawnWithResume(sessionId: string): Promise<void> {
  await this.killCurrentProcess();
  await this.spawn({ additionalFlags: ['--resume', sessionId] });
}

/** Kill current CLI and spawn a fresh process (new conversation). */
async spawnFresh(): Promise<void> {
  await this.killCurrentProcess();
  await this.spawn({});
}
```

- [ ] **Step 4: Commit**

```bash
git add src/extension.ts src/webview/webviewProvider.ts src/process/processManager.ts
git commit -m "feat(session): wire SessionTracker into activation, postMessage bridge, and process manager"
```

---

## Task 9: Sessions Sidebar View (Activity Bar Icon)

**Files:**
- Create: `src/session/sessionsViewProvider.ts`
- Modify: `src/extension.ts`

The `gakrcliSessionsList` view ID is already declared in `package.json` under the `gakrcli-sessions-sidebar` container. This task creates the `WebviewViewProvider` that populates it with a lightweight HTML session list.

- [ ] **Step 1: Create src/session/sessionsViewProvider.ts**

```typescript
import * as vscode from 'vscode';
import { SessionTracker } from './sessionTracker';

/**
 * Lightweight WebviewViewProvider for the sessions sidebar.
 * Renders a standalone HTML page (not the full React webview) with search + grouped sessions.
 */
export class SessionsViewProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'gakrcliSessionsList';

  private view: vscode.WebviewView | undefined;
  private disposables: vscode.Disposable[] = [];

  constructor(
    private readonly extensionUri: vscode.Uri,
    private readonly sessionTracker: SessionTracker,
  ) {}

  resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken,
  ): void {
    this.view = webviewView;

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this.extensionUri],
    };

    webviewView.webview.html = this.getHtml();

    webviewView.webview.onDidReceiveMessage(
      async (msg) => {
        switch (msg.type) {
          case 'resumeSession':
            vscode.commands.executeCommand('gakrcli.resumeSession', msg.sessionId);
            break;
          case 'deleteSession':
            await this.sessionTracker.deleteSession(msg.sessionId);
            break;
          case 'newConversation':
            vscode.commands.executeCommand('gakrcli.newConversation');
            break;
          case 'ready':
            this.pushSessions();
            break;
        }
      },
      undefined,
      this.disposables,
    );

    this.sessionTracker.onSessionsChanged(
      () => this.pushSessions(),
      undefined,
      this.disposables,
    );
  }

  private pushSessions(): void {
    if (!this.view) return;
    const grouped = this.sessionTracker.getGroupedSessions();
    this.view.webview.postMessage({
      type: 'sessionsData',
      grouped: grouped.map((g) => ({
        group: g.group,
        sessions: g.sessions.map((s) => ({
          id: s.id,
          title: s.title,
          model: s.model,
          timestamp: s.timestamp.toISOString(),
          messageCount: s.messageCount,
        })),
      })),
    });
  }

  private getHtml(): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: var(--vscode-font-family);
      font-size: var(--vscode-font-size);
      color: var(--vscode-foreground);
      background: var(--vscode-sideBar-background);
    }
    .header {
      display: flex; align-items: center; justify-content: space-between;
      padding: 8px 12px; border-bottom: 1px solid var(--vscode-panel-border);
    }
    .header-title {
      font-size: 11px; font-weight: 600; text-transform: uppercase;
      letter-spacing: 0.5px; opacity: 0.8;
    }
    .new-btn {
      background: none; border: none; color: var(--vscode-foreground);
      cursor: pointer; padding: 2px 6px; border-radius: 3px; font-size: 11px; opacity: 0.7;
    }
    .new-btn:hover { opacity: 1; background: var(--vscode-toolbar-hoverBackground); }
    .search-wrap { padding: 8px 12px; }
    .search-input {
      width: 100%; padding: 4px 8px; font-size: 11px;
      background: var(--vscode-input-background); color: var(--vscode-input-foreground);
      border: 1px solid var(--vscode-input-border); border-radius: 3px; outline: none;
    }
    .search-input:focus { border-color: var(--vscode-focusBorder); }
    .group-label {
      padding: 6px 12px 2px; font-size: 10px; font-weight: 600;
      text-transform: uppercase; letter-spacing: 0.5px; opacity: 0.5;
    }
    .card {
      display: flex; align-items: flex-start; gap: 8px;
      padding: 6px 12px; cursor: pointer; border-radius: 3px; margin: 0 4px;
    }
    .card:hover { background: var(--vscode-list-hoverBackground); }
    .info { flex: 1; min-width: 0; }
    .title { font-size: 12px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .meta { font-size: 10px; opacity: 0.6; margin-top: 2px; }
    .del {
      background: none; border: none; color: var(--vscode-foreground);
      cursor: pointer; padding: 2px; border-radius: 3px; opacity: 0; flex-shrink: 0;
    }
    .card:hover .del { opacity: 0.5; }
    .del:hover { opacity: 1 !important; background: var(--vscode-toolbar-hoverBackground); }
    .empty { text-align: center; padding: 24px 12px; font-size: 11px; opacity: 0.5; }
    .list { overflow-y: auto; flex: 1; }
    .root { display: flex; flex-direction: column; height: 100vh; }
  </style>
</head>
<body>
  <div class="root">
    <div class="header">
      <span class="header-title">Sessions</span>
      <button class="new-btn" onclick="newConv()" title="New Conversation">+ New</button>
    </div>
    <div class="search-wrap">
      <input class="search-input" type="text" placeholder="Search sessions..." oninput="onSearch(this.value)" />
    </div>
    <div class="list" id="list"></div>
  </div>
  <script>
    const vscode = acquireVsCodeApi();
    let data = [];
    let q = '';

    function relTime(iso) {
      const d = Date.now() - new Date(iso).getTime();
      const m = Math.floor(d/60000), h = Math.floor(d/3600000), dd = Math.floor(d/86400000);
      if (m < 1) return 'just now';
      if (m < 60) return m + 'm ago';
      if (h < 24) return h + 'h ago';
      if (dd < 7) return dd + 'd ago';
      return new Date(iso).toLocaleDateString(undefined,{month:'short',day:'numeric'});
    }
    function esc(s) {
      return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
    }
    function cardHtml(s) {
      return '<div class="card" onclick="resume(\\'' + s.id + '\\')">' +
        '<div class="info"><div class="title" title="' + esc(s.title) + '">' + esc(s.title) + '</div>' +
        '<div class="meta">' + esc(s.model) + ' &middot; ' + relTime(s.timestamp) + ' &middot; ' + s.messageCount + ' msgs</div></div>' +
        '<button class="del" onclick="event.stopPropagation();del(\\'' + s.id + '\\')" title="Delete">' +
        '<svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor"><path d="M10 3h3v1h-1v9l-1 1H4l-1-1V4H2V3h3V2a1 1 0 0 1 1-1h3a1 1 0 0 1 1 1v1zM9 2H6v1h3V2zM4 13h7V4H4v9zm2-8H5v7h1V5zm1 0h1v7H7V5zm2 0h1v7H9V5z"/></svg>' +
        '</button></div>';
    }
    function render() {
      const el = document.getElementById('list');
      if (q) {
        const flat = data.flatMap(g => g.sessions);
        const f = flat.filter(s => s.title.toLowerCase().includes(q) || s.model.toLowerCase().includes(q));
        el.innerHTML = f.length ? f.map(cardHtml).join('') : '<div class="empty">No matches</div>';
        return;
      }
      if (!data.length) { el.innerHTML = '<div class="empty">No past sessions</div>'; return; }
      el.innerHTML = data.map(g =>
        '<div class="group-label">' + g.group + '</div>' + g.sessions.map(cardHtml).join('')
      ).join('');
    }
    function resume(id) { vscode.postMessage({type:'resumeSession',sessionId:id}); }
    function del(id) { vscode.postMessage({type:'deleteSession',sessionId:id}); }
    function newConv() { vscode.postMessage({type:'newConversation'}); }
    function onSearch(v) { q = v.toLowerCase(); render(); }

    window.addEventListener('message', e => {
      if (e.data.type === 'sessionsData') { data = e.data.grouped; render(); }
    });
    vscode.postMessage({type:'ready'});
  </script>
</body>
</html>`;
  }

  dispose(): void {
    for (const d of this.disposables) d.dispose();
  }
}
```

- [ ] **Step 2: Register the SessionsViewProvider in extension.ts**

Add to `activate()`:

```typescript
import { SessionsViewProvider } from './session/sessionsViewProvider';

const sessionsViewProvider = new SessionsViewProvider(context.extensionUri, sessionTracker);
context.subscriptions.push(
  vscode.window.registerWebviewViewProvider(
    SessionsViewProvider.viewType,
    sessionsViewProvider,
  ),
);

// Enable the sessions sidebar via context key
vscode.commands.executeCommand('setContext', 'gakrcli.sessionsListEnabled', true);
```

- [ ] **Step 3: Verify package.json declares the view (from Story 1)**

Confirm `package.json` contains:

```json
"viewsContainers": {
  "activitybar": [
    {
      "id": "gakrcli-sessions-sidebar",
      "title": "gakrcli",
      "icon": "resources/gakrcli-logo.svg",
      "when": "gakrcli.sessionsListEnabled"
    }
  ]
},
"views": {
  "gakrcli-sessions-sidebar": [
    {
      "type": "webview",
      "id": "gakrcliSessionsList",
      "name": "",
      "when": "gakrcli.sessionsListEnabled"
    }
  ]
}
```

- [ ] **Step 4: Commit**

```bash
git add src/session/sessionsViewProvider.ts src/extension.ts
git commit -m "feat(session): add sessions sidebar view provider for activity bar"
```

---

## Task 10: Build and End-to-End Verification

- [ ] **Step 1: Build the entire extension**

Run: `cd /Users/harshagarwal/Documents/workspace/gakrcli-vscode && npm run build`

Expected: Both extension host and webview build without errors.

- [ ] **Step 2: Run all session tests**

Run: `cd /Users/harshagarwal/Documents/workspace/gakrcli-vscode && npx vitest run test/unit/sessionTracker.test.ts`

Expected: All tests pass.

- [ ] **Step 3: Manual verification (F5 Extension Development Host)**

1. Open the extension development host with F5
2. Verify the gakrcli activity bar icon appears (sessions sidebar)
3. Click it to see the sessions sidebar with grouped sessions
4. Open the main chat panel, verify ChatHeader shows "New Conversation"
5. Click "History" button, verify SessionList overlay appears with sessions from `~/.claude/projects/`
6. Type in the search box, verify filtering works
7. Click a session card, verify CLI spawns with `--resume <uuid>`
8. Click delete on a session, confirm the JSONL file is removed
9. Click "New" button, verify fresh CLI process starts
10. Start a conversation, wait for ai-title, verify the session title updates

---

## Verification Checklist (maps to acceptance criteria)

- [ ] SessionTracker reads JSONL files from `~/.claude/projects/` -- verified by console log of parsed session count
- [ ] SessionList shows past sessions searchable by keyword -- type in search, see filtered results
- [ ] Sessions grouped by: Today, Yesterday, This Week, This Month, Older -- check group headers
- [ ] SessionCard shows: title, model/provider, timestamp, message count -- visual inspection
- [ ] Click session -> resume (spawns CLI with `--resume <uuid>`) -- click a session, verify process args
- [ ] New Conversation button starts fresh CLI process -- click "New", verify fresh spawn
- [ ] Session title auto-updated from `ai-title` messages -- start conversation, observe title change
- [ ] Sessions sidebar view (activity bar icon) -- check activity bar has sessions icon
- [ ] Delete session removes JSONL file -- delete a session, verify file gone from disk
