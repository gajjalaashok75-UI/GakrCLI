# Story 5: Prompt Input, @-Mentions, Slash Commands & Input Toolbar — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the full input area for the chat UI: a rich textarea with auto-resize, @-mention file picker, slash command menu, input toolbar with 7 buttons, attachment bar, context footer, and provider badge. This replaces the placeholder `<input>` from Story 1.

**Architecture:** The input area is a composition of 11 webview components plus 1 extension-host-side provider. The `PromptInput` textarea is the core, flanked by `AtMentionPicker` and `SlashCommandMenu` dropdowns that appear contextually. Below it sits `InputToolbar` (7 buttons), `AttachmentBar`, and `ContextFooter`. The extension host's `AtMentionProvider` handles workspace file search via `vscode.workspace.findFiles` and returns results through the PostMessage bridge.

**Tech Stack:** TypeScript 5.x, React 18, Tailwind CSS 3, VS Code Extension API, PostMessage bridge (from Story 3)

**Spec:** [2026-04-02-gakrcli-vscode-extension-design.md](../specs/2026-04-02-gakrcli-vscode-extension-design.md) — Section 3.2 (Input Area), Story 5

**Dependencies:** Stories 1 (scaffold), 2 (process/types), 3 (PostMessage bridge), 4 (ChatPanel shell)

---

## File Structure

| File | Responsibility |
|---|---|
| `webview/src/components/input/PromptInput.tsx` | Auto-resizing textarea with keyboard handling (Enter/Shift+Enter/Ctrl+Enter), @-mention and / detection, cursor position tracking |
| `webview/src/components/input/AtMentionPicker.tsx` | Floating dropdown triggered by `@` — fuzzy search, keyboard navigation, renders file/folder/terminal/browser results |
| `webview/src/components/input/SlashCommandMenu.tsx` | Floating dropdown triggered by `/` or button click — all commands from initialize response, fuzzy search, descriptions |
| `webview/src/components/input/InputToolbar.tsx` | 7-button toolbar below textarea: `/`, paperclip, `+`, globe, ModeSelector, EffortSelector, ActiveFileIndicator |
| `webview/src/components/input/ModeSelector.tsx` | Dropdown button for permission mode: Default / Plan / Accept Edits / Auto / Bypass |
| `webview/src/components/input/EffortSelector.tsx` | Dropdown button for effort level: Low / Medium / High / Max |
| `webview/src/components/input/FileUploadButton.tsx` | Paperclip button — triggers file picker via postMessage, supports images/PDFs/code |
| `webview/src/components/input/AttachmentBar.tsx` | Horizontal list of attached files/images with remove (x) buttons |
| `webview/src/components/input/ContextFooter.tsx` | Context window usage bar, token/line count, eye icon toggle, permission mode indicator |
| `webview/src/components/input/ProviderBadge.tsx` | Current provider + model name display |
| `webview/src/components/input/InputArea.tsx` | Composition root — orchestrates all input components, manages shared state |
| `webview/src/hooks/useAtMentions.ts` | Hook: manage @-mention state, postMessage queries, debounced search |
| `webview/src/hooks/useSlashCommands.ts` | Hook: manage slash command list from initialize response, fuzzy filter |
| `webview/src/hooks/useContextUsage.ts` | Hook: poll/request context usage from extension host |
| `webview/src/hooks/useActiveFile.ts` | Hook: track currently focused editor file from extension host messages |
| `webview/src/utils/fuzzySearch.ts` | Simple fuzzy search utility (no external dependency) |
| `src/mentions/atMentionProvider.ts` | Extension host: workspace file search via `vscode.workspace.findFiles`, supports @file, @folder, @file#L-L, @terminal, @browser |
| `src/webview/types.ts` | **Modify**: Add new PostMessage types for @-mention queries, file picker, active file, context usage |
| `test/unit/fuzzySearch.test.ts` | Unit tests for fuzzy search utility |
| `test/unit/atMentionProvider.test.ts` | Unit tests for AtMentionProvider parsing |

---

## Task 1: Fuzzy Search Utility

**Files:**
- Create: `webview/src/utils/fuzzySearch.ts`
- Create: `test/unit/fuzzySearch.test.ts`

This is a dependency-free fuzzy search used by both AtMentionPicker and SlashCommandMenu. We implement it first so the pickers can use it.

- [ ] **Step 1: Create webview/src/utils/fuzzySearch.ts**

```typescript
/**
 * Simple fuzzy search — matches characters in order (not necessarily contiguous).
 * Returns a score (lower is better match) or null if no match.
 *
 * Example: query "amc" matches "AtMentionComponent" (a...M...C)
 */
export interface FuzzyMatch<T> {
  item: T;
  score: number;
  highlights: number[]; // character indices that matched
}

export function fuzzyMatch(query: string, target: string): { score: number; highlights: number[] } | null {
  const queryLower = query.toLowerCase();
  const targetLower = target.toLowerCase();

  if (queryLower.length === 0) {
    return { score: 0, highlights: [] };
  }

  if (queryLower.length > targetLower.length) {
    return null;
  }

  const highlights: number[] = [];
  let queryIdx = 0;
  let score = 0;
  let lastMatchIdx = -1;

  for (let i = 0; i < targetLower.length && queryIdx < queryLower.length; i++) {
    if (targetLower[i] === queryLower[queryIdx]) {
      highlights.push(i);

      // Bonus for consecutive matches
      if (lastMatchIdx === i - 1) {
        score -= 1;
      }

      // Bonus for matching at word boundaries (after /, ., -, _, or uppercase)
      if (i === 0 || /[/.\-_]/.test(target[i - 1]) || (target[i] === target[i].toUpperCase() && target[i] !== target[i].toLowerCase())) {
        score -= 2;
      }

      // Penalty for distance from start
      score += i * 0.1;

      lastMatchIdx = i;
      queryIdx++;
    }
  }

  // All query characters must be matched
  if (queryIdx < queryLower.length) {
    return null;
  }

  return { score, highlights };
}

/**
 * Fuzzy search over a list of items. Returns matches sorted by score (best first).
 */
export function fuzzySearch<T>(
  query: string,
  items: T[],
  getText: (item: T) => string,
  maxResults = 50,
): FuzzyMatch<T>[] {
  if (!query) {
    return items.slice(0, maxResults).map((item) => ({
      item,
      score: 0,
      highlights: [],
    }));
  }

  const matches: FuzzyMatch<T>[] = [];

  for (const item of items) {
    const text = getText(item);
    const result = fuzzyMatch(query, text);
    if (result) {
      matches.push({ item, score: result.score, highlights: result.highlights });
    }
  }

  matches.sort((a, b) => a.score - b.score);
  return matches.slice(0, maxResults);
}
```

- [ ] **Step 2: Create test/unit/fuzzySearch.test.ts**

```typescript
import { fuzzyMatch, fuzzySearch } from '../../webview/src/utils/fuzzySearch';

describe('fuzzyMatch', () => {
  it('matches exact string', () => {
    const result = fuzzyMatch('auth', 'auth');
    expect(result).not.toBeNull();
    expect(result!.highlights).toEqual([0, 1, 2, 3]);
  });

  it('matches substring', () => {
    const result = fuzzyMatch('auth', 'auth.handlers.ts');
    expect(result).not.toBeNull();
    expect(result!.highlights).toEqual([0, 1, 2, 3]);
  });

  it('matches fuzzy characters in order', () => {
    const result = fuzzyMatch('aht', 'auth.handlers.ts');
    expect(result).not.toBeNull();
    expect(result!.highlights.length).toBe(3);
  });

  it('returns null when characters not in order', () => {
    const result = fuzzyMatch('zxy', 'auth.handlers.ts');
    expect(result).toBeNull();
  });

  it('returns null when query is longer than target', () => {
    const result = fuzzyMatch('very-long-query', 'short');
    expect(result).toBeNull();
  });

  it('returns match with empty query', () => {
    const result = fuzzyMatch('', 'anything');
    expect(result).not.toBeNull();
    expect(result!.score).toBe(0);
  });

  it('scores word boundary matches better', () => {
    const scoreExact = fuzzyMatch('pm', 'processManager.ts');
    const scoreMiddle = fuzzyMatch('pm', 'somepm.ts');
    // processManager has p at start and M at word boundary — should score better
    expect(scoreExact).not.toBeNull();
    expect(scoreMiddle).not.toBeNull();
    expect(scoreExact!.score).toBeLessThan(scoreMiddle!.score);
  });
});

describe('fuzzySearch', () => {
  const items = [
    'src/auth/auth.handlers.ts',
    'src/process/processManager.ts',
    'src/webview/webviewProvider.ts',
    'webview/src/App.tsx',
    'package.json',
  ];

  it('returns all items for empty query (up to maxResults)', () => {
    const results = fuzzySearch('', items, (x) => x);
    expect(results.length).toBe(5);
  });

  it('filters to matching items', () => {
    const results = fuzzySearch('auth', items, (x) => x);
    expect(results.length).toBe(1);
    expect(results[0].item).toBe('src/auth/auth.handlers.ts');
  });

  it('respects maxResults', () => {
    const results = fuzzySearch('s', items, (x) => x, 2);
    expect(results.length).toBeLessThanOrEqual(2);
  });

  it('works with object items and getText', () => {
    const commands = [
      { name: '/help', description: 'Show help' },
      { name: '/model', description: 'Switch model' },
      { name: '/compact', description: 'Compact context' },
    ];
    const results = fuzzySearch('mod', commands, (c) => c.name);
    expect(results.length).toBe(1);
    expect(results[0].item.name).toBe('/model');
  });
});
```

- [ ] **Step 3: Verify tests pass**

Run: `cd /Users/harshagarwal/Documents/workspace/gakrcli-vscode && npx jest test/unit/fuzzySearch.test.ts --passWithNoTests`

Expected: All tests pass

- [ ] **Step 4: Commit**

```bash
git add webview/src/utils/fuzzySearch.ts test/unit/fuzzySearch.test.ts
git commit -m "feat: add fuzzy search utility for @-mentions and slash commands"
```

---

## Task 2: Extend PostMessage Types

**Files:**
- Modify: `src/webview/types.ts`

Add the new message types needed for @-mention queries, file picker, active file tracking, slash command list, and effort/mode changes. These flow through the existing WebviewBridge.

- [ ] **Step 1: Add new Webview -> Host message types to src/webview/types.ts**

Add these types after the existing `RewindMessage` interface (before the `WebviewToHostMessage` union):

```typescript
/** User types @ in input — request file search results */
export interface AtMentionQueryMessage {
  type: 'at_mention_query';
  query: string; // text after @, e.g. "auth" for "@auth"
}

/** User clicks paperclip — request file picker dialog */
export interface FilePickerRequestMessage {
  type: 'file_picker_request';
  accept?: string[]; // file extensions filter, e.g. ['.png', '.jpg', '.pdf']
}

/** User clicks + button — add text/URL content */
export interface AddContentMessage {
  type: 'add_content';
  contentType: 'text' | 'url';
  content: string;
}

/** User clicks globe — insert @browser reference */
export interface InsertBrowserRefMessage {
  type: 'insert_browser_ref';
}

/** Webview requests current active file in editor */
export interface GetActiveFileMessage {
  type: 'get_active_file';
}

/** User drops files onto input area */
export interface FileDropMessage {
  type: 'file_drop';
  files: Array<{ name: string; path: string; type: string }>;
}
```

- [ ] **Step 2: Add new types to the WebviewToHostMessage union**

```typescript
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
  | RewindMessage
  | AtMentionQueryMessage
  | FilePickerRequestMessage
  | AddContentMessage
  | InsertBrowserRefMessage
  | GetActiveFileMessage
  | FileDropMessage;
```

- [ ] **Step 3: Add new Host -> Webview message types**

Add these types after the existing `FontConfigMessage` interface (before the `HostToWebviewMessage` union):

```typescript
/** @-mention search results from extension host */
export interface AtMentionResultsMessage {
  type: 'at_mention_results';
  query: string;
  results: AtMentionResult[];
}

export interface AtMentionResult {
  type: 'file' | 'folder' | 'line_range' | 'terminal' | 'browser';
  label: string;       // display name, e.g. "auth.handlers.ts"
  detail: string;      // full path, e.g. "src/auth/auth.handlers.ts"
  insertText: string;  // text to insert, e.g. "@src/auth/auth.handlers.ts"
  icon: string;        // codicon name, e.g. "file", "folder", "terminal"
}

/** File picker result (user selected files) */
export interface FilePickerResultMessage {
  type: 'file_picker_result';
  files: Attachment[];
}

/** Active file in editor changed */
export interface ActiveFileChangedMessage {
  type: 'active_file_changed';
  filePath: string | null;
  fileName: string | null;
  languageId: string | null;
}

/** Slash commands available (sent after initialize) */
export interface SlashCommandsAvailableMessage {
  type: 'slash_commands_available';
  commands: Array<{
    name: string;
    description: string;
    argumentHint: string;
  }>;
}

/** Session info update (model, provider, mode, effort) */
export interface SessionInfoMessage {
  type: 'session_info';
  model: string;
  provider: string;
  permissionMode: string;
  effortLevel: string | null;
}
```

- [ ] **Step 4: Add new types to the HostToWebviewMessage union**

```typescript
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
  | FontConfigMessage
  | AtMentionResultsMessage
  | FilePickerResultMessage
  | ActiveFileChangedMessage
  | SlashCommandsAvailableMessage
  | SessionInfoMessage;
```

- [ ] **Step 5: Commit**

```bash
git add src/webview/types.ts
git commit -m "feat: add PostMessage types for @-mentions, file picker, slash commands, active file"
```

---

## Task 3: AtMentionProvider (Extension Host Side)

**Files:**
- Create: `src/mentions/atMentionProvider.ts`
- Create: `test/unit/atMentionProvider.test.ts`

This runs in the extension host (Node.js, has access to `vscode` API). It receives search queries from the webview via PostMessage, searches workspace files using `vscode.workspace.findFiles`, and returns structured results. Supports `@file`, `@folder`, `@file#L5-L10`, `@terminal:name`, `@browser`.

- [ ] **Step 1: Create src/mentions/atMentionProvider.ts**

```typescript
import * as vscode from 'vscode';
import * as path from 'path';

export interface AtMentionSearchResult {
  type: 'file' | 'folder' | 'line_range' | 'terminal' | 'browser';
  label: string;
  detail: string;
  insertText: string;
  icon: string;
}

/**
 * Provides @-mention search results by querying the VS Code workspace.
 *
 * Supports:
 * - @file — fuzzy match against workspace files
 * - @folder — fuzzy match against workspace folders
 * - @file#L5-L10 — file with line range
 * - @terminal:name — reference a named terminal
 * - @browser — reference Chrome integration
 */
export class AtMentionProvider implements vscode.Disposable {
  private readonly disposables: vscode.Disposable[] = [];
  private cachedFiles: string[] | null = null;
  private cacheExpiry = 0;
  private static readonly CACHE_TTL_MS = 5000; // 5 second cache

  constructor() {
    // Invalidate cache on file system changes
    const watcher = vscode.workspace.createFileSystemWatcher('**/*');
    this.disposables.push(
      watcher.onDidCreate(() => this.invalidateCache()),
      watcher.onDidDelete(() => this.invalidateCache()),
      watcher,
    );
  }

  /**
   * Search for @-mention targets matching the given query.
   *
   * @param query The text after `@`, e.g. "auth" or "src/auth#L5-10" or "terminal:" or "browser"
   * @param maxResults Maximum results to return
   */
  async search(query: string, maxResults = 20): Promise<AtMentionSearchResult[]> {
    const results: AtMentionSearchResult[] = [];

    // Check for special prefixes first
    if (query === '' || query.toLowerCase().startsWith('b')) {
      // Always include @browser as an option
      if (this.fuzzyMatchSimple('browser', query)) {
        results.push({
          type: 'browser',
          label: 'browser',
          detail: 'Reference Chrome browser content',
          insertText: '@browser',
          icon: 'globe',
        });
      }
    }

    // @terminal:name
    if (query === '' || query.toLowerCase().startsWith('t')) {
      const terminalResults = this.getTerminalResults(query);
      results.push(...terminalResults);
    }

    // Check for line range syntax: file#L5-L10 or file#L5
    const lineRangeMatch = query.match(/^(.+?)#L(\d+)(?:-L?(\d+))?$/i);
    if (lineRangeMatch) {
      const fileQuery = lineRangeMatch[1];
      const startLine = parseInt(lineRangeMatch[2], 10);
      const endLine = lineRangeMatch[3] ? parseInt(lineRangeMatch[3], 10) : startLine;

      const files = await this.searchFiles(fileQuery, 5);
      for (const file of files) {
        const relativePath = file;
        results.push({
          type: 'line_range',
          label: `${path.basename(relativePath)}#L${startLine}-L${endLine}`,
          detail: `${relativePath}#L${startLine}-L${endLine}`,
          insertText: `@${relativePath}#L${startLine}-L${endLine}`,
          icon: 'symbol-number',
        });
      }
      return results.slice(0, maxResults);
    }

    // Search workspace files and folders
    const files = await this.searchFiles(query, maxResults);
    for (const file of files) {
      const relativePath = file;
      const isDirectory = file.endsWith('/');
      results.push({
        type: isDirectory ? 'folder' : 'file',
        label: isDirectory ? path.basename(file.slice(0, -1)) : path.basename(file),
        detail: relativePath,
        insertText: `@${relativePath}`,
        icon: isDirectory ? 'folder' : this.getFileIcon(file),
      });
    }

    return results.slice(0, maxResults);
  }

  /**
   * Search workspace files matching the query using vscode.workspace.findFiles.
   */
  private async searchFiles(query: string, maxResults: number): Promise<string[]> {
    const files = await this.getWorkspaceFiles();

    if (!query) {
      return files.slice(0, maxResults);
    }

    const queryLower = query.toLowerCase();

    // Score and sort files by fuzzy match quality
    const scored: Array<{ file: string; score: number }> = [];
    for (const file of files) {
      const score = this.scoreMatch(queryLower, file.toLowerCase());
      if (score >= 0) {
        scored.push({ file, score });
      }
    }

    scored.sort((a, b) => a.score - b.score);
    return scored.slice(0, maxResults).map((s) => s.file);
  }

  /**
   * Get all workspace files (cached for performance).
   */
  private async getWorkspaceFiles(): Promise<string[]> {
    if (this.cachedFiles && Date.now() < this.cacheExpiry) {
      return this.cachedFiles;
    }

    const excludePattern = '{**/node_modules/**,**/.git/**,**/dist/**,**/.next/**,**/build/**,**/__pycache__/**}';
    const uris = await vscode.workspace.findFiles('**/*', excludePattern, 5000);

    const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? '';
    const files = uris.map((uri) => {
      const rel = path.relative(workspaceRoot, uri.fsPath);
      return rel.split(path.sep).join('/'); // normalize to forward slashes
    });

    // Also add directories (deduplicated)
    const dirs = new Set<string>();
    for (const file of files) {
      const parts = file.split('/');
      for (let i = 1; i < parts.length; i++) {
        dirs.add(parts.slice(0, i).join('/') + '/');
      }
    }

    this.cachedFiles = [...files, ...Array.from(dirs)].sort();
    this.cacheExpiry = Date.now() + AtMentionProvider.CACHE_TTL_MS;
    return this.cachedFiles;
  }

  /**
   * Get terminal references from active VS Code terminals.
   */
  private getTerminalResults(query: string): AtMentionSearchResult[] {
    const terminalQuery = query.toLowerCase().startsWith('terminal:')
      ? query.slice('terminal:'.length)
      : query.toLowerCase().startsWith('terminal')
        ? query.slice('terminal'.length)
        : '';

    const results: AtMentionSearchResult[] = [];
    const terminals = vscode.window.terminals;

    for (const terminal of terminals) {
      if (!terminalQuery || terminal.name.toLowerCase().includes(terminalQuery.toLowerCase())) {
        results.push({
          type: 'terminal',
          label: `terminal:${terminal.name}`,
          detail: `Terminal: ${terminal.name}`,
          insertText: `@terminal:${terminal.name}`,
          icon: 'terminal',
        });
      }
    }

    return results;
  }

  /**
   * Simple fuzzy match: all characters of query appear in order in target.
   */
  private fuzzyMatchSimple(target: string, query: string): boolean {
    if (!query) return true;
    const targetLower = target.toLowerCase();
    const queryLower = query.toLowerCase();
    let qi = 0;
    for (let i = 0; i < targetLower.length && qi < queryLower.length; i++) {
      if (targetLower[i] === queryLower[qi]) qi++;
    }
    return qi === queryLower.length;
  }

  /**
   * Score a fuzzy match. Lower is better. Returns -1 for no match.
   * Prefers: exact prefix match > filename match > path match
   */
  private scoreMatch(queryLower: string, fileLower: string): number {
    // Exact prefix of filename
    const filenameLower = fileLower.split('/').pop() || fileLower;
    if (filenameLower.startsWith(queryLower)) {
      return 0 + filenameLower.length * 0.01; // shorter filenames rank higher
    }

    // Filename contains query
    if (filenameLower.includes(queryLower)) {
      return 10 + filenameLower.indexOf(queryLower) * 0.1;
    }

    // Full path contains query
    if (fileLower.includes(queryLower)) {
      return 20 + fileLower.indexOf(queryLower) * 0.1;
    }

    // Fuzzy match on full path
    let qi = 0;
    let score = 30;
    for (let i = 0; i < fileLower.length && qi < queryLower.length; i++) {
      if (fileLower[i] === queryLower[qi]) {
        qi++;
        score += i * 0.01;
      }
    }

    if (qi === queryLower.length) {
      return score;
    }

    return -1; // no match
  }

  /**
   * Map file extension to codicon name for display.
   */
  private getFileIcon(filePath: string): string {
    const ext = path.extname(filePath).toLowerCase();
    const iconMap: Record<string, string> = {
      '.ts': 'file-code',
      '.tsx': 'file-code',
      '.js': 'file-code',
      '.jsx': 'file-code',
      '.py': 'file-code',
      '.rs': 'file-code',
      '.go': 'file-code',
      '.java': 'file-code',
      '.css': 'file-code',
      '.scss': 'file-code',
      '.html': 'file-code',
      '.json': 'file-code',
      '.md': 'file-text',
      '.txt': 'file-text',
      '.yml': 'file-text',
      '.yaml': 'file-text',
      '.png': 'file-media',
      '.jpg': 'file-media',
      '.jpeg': 'file-media',
      '.gif': 'file-media',
      '.svg': 'file-media',
      '.pdf': 'file-pdf',
    };
    return iconMap[ext] || 'file';
  }

  private invalidateCache(): void {
    this.cachedFiles = null;
    this.cacheExpiry = 0;
  }

  dispose(): void {
    this.invalidateCache();
    for (const d of this.disposables) {
      d.dispose();
    }
  }
}
```

- [ ] **Step 2: Create test/unit/atMentionProvider.test.ts**

```typescript
/**
 * Unit tests for AtMentionProvider.
 * These test the parsing and scoring logic — workspace search is mocked.
 */
import { AtMentionProvider } from '../../src/mentions/atMentionProvider';

// Mock VS Code API
jest.mock('vscode', () => ({
  workspace: {
    findFiles: jest.fn().mockResolvedValue([]),
    workspaceFolders: [{ uri: { fsPath: '/workspace' } }],
    createFileSystemWatcher: jest.fn().mockReturnValue({
      onDidCreate: jest.fn().mockReturnValue({ dispose: jest.fn() }),
      onDidDelete: jest.fn().mockReturnValue({ dispose: jest.fn() }),
      dispose: jest.fn(),
    }),
  },
  window: {
    terminals: [
      { name: 'zsh' },
      { name: 'node' },
    ],
  },
  Uri: {
    file: (p: string) => ({ fsPath: p }),
  },
}), { virtual: true });

describe('AtMentionProvider', () => {
  let provider: AtMentionProvider;

  beforeEach(() => {
    provider = new AtMentionProvider();
  });

  afterEach(() => {
    provider.dispose();
  });

  it('returns @browser result for empty query', async () => {
    const results = await provider.search('');
    const browser = results.find((r) => r.type === 'browser');
    expect(browser).toBeDefined();
    expect(browser!.insertText).toBe('@browser');
  });

  it('returns @browser result for "b" query', async () => {
    const results = await provider.search('b');
    const browser = results.find((r) => r.type === 'browser');
    expect(browser).toBeDefined();
  });

  it('returns terminal results', async () => {
    const results = await provider.search('terminal:');
    const terminals = results.filter((r) => r.type === 'terminal');
    expect(terminals.length).toBe(2);
    expect(terminals[0].insertText).toBe('@terminal:zsh');
    expect(terminals[1].insertText).toBe('@terminal:node');
  });

  it('filters terminal results by name', async () => {
    const results = await provider.search('terminal:zsh');
    const terminals = results.filter((r) => r.type === 'terminal');
    expect(terminals.length).toBe(1);
    expect(terminals[0].label).toBe('terminal:zsh');
  });

  it('parses line range syntax', async () => {
    // With empty workspace, no file results expected, but the parser should work
    const results = await provider.search('auth.ts#L5-L10');
    // No files to match against in mock, so results may be empty
    // The test verifies parsing doesn't throw
    expect(Array.isArray(results)).toBe(true);
  });
});
```

- [ ] **Step 3: Run tests**

Run: `cd /Users/harshagarwal/Documents/workspace/gakrcli-vscode && npx jest test/unit/atMentionProvider.test.ts --passWithNoTests`

Expected: All tests pass

- [ ] **Step 4: Commit**

```bash
git add src/mentions/atMentionProvider.ts test/unit/atMentionProvider.test.ts
git commit -m "feat: add AtMentionProvider for workspace file search via VS Code API"
```

---

## Task 4: React Hooks — useAtMentions, useSlashCommands, useContextUsage, useActiveFile

**Files:**
- Create: `webview/src/hooks/useAtMentions.ts`
- Create: `webview/src/hooks/useSlashCommands.ts`
- Create: `webview/src/hooks/useContextUsage.ts`
- Create: `webview/src/hooks/useActiveFile.ts`

These hooks encapsulate all PostMessage communication for the input components. They listen for messages from the extension host and expose state + query functions to React components.

- [ ] **Step 1: Create webview/src/hooks/useAtMentions.ts**

```typescript
import { useState, useCallback, useEffect, useRef } from 'react';
import { vscode } from '../vscode';

export interface AtMentionResult {
  type: 'file' | 'folder' | 'line_range' | 'terminal' | 'browser';
  label: string;
  detail: string;
  insertText: string;
  icon: string;
}

interface UseAtMentionsReturn {
  results: AtMentionResult[];
  isLoading: boolean;
  query: (text: string) => void;
  clear: () => void;
}

/**
 * Hook for @-mention search. Sends queries to extension host via postMessage,
 * receives results back. Debounces queries by 150ms.
 */
export function useAtMentions(): UseAtMentionsReturn {
  const [results, setResults] = useState<AtMentionResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestQuery = useRef<string>('');

  // Listen for results from extension host
  useEffect(() => {
    const handler = (event: MessageEvent) => {
      const message = event.data;
      if (message.type === 'at_mention_results') {
        // Only accept results for the latest query (prevent stale updates)
        if (message.query === latestQuery.current) {
          setResults(message.results);
          setIsLoading(false);
        }
      }
    };

    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, []);

  const query = useCallback((text: string) => {
    latestQuery.current = text;

    // Clear previous debounce
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }

    if (!text && text !== '') {
      setResults([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);

    // Debounce the postMessage query
    debounceTimer.current = setTimeout(() => {
      vscode.postMessage({
        type: 'at_mention_query',
        query: text,
      });
    }, 150);
  }, []);

  const clear = useCallback(() => {
    latestQuery.current = '';
    setResults([]);
    setIsLoading(false);
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }
  }, []);

  return { results, isLoading, query, clear };
}
```

- [ ] **Step 2: Create webview/src/hooks/useSlashCommands.ts**

```typescript
import { useState, useEffect, useMemo } from 'react';
import { fuzzySearch } from '../utils/fuzzySearch';

export interface SlashCommandDef {
  name: string;
  description: string;
  argumentHint: string;
}

interface UseSlashCommandsReturn {
  commands: SlashCommandDef[];
  filteredCommands: (query: string) => SlashCommandDef[];
  isLoaded: boolean;
}

/**
 * Hook for slash command menu. Listens for the command list from the
 * initialize response (sent by extension host as `slash_commands_available`).
 */
export function useSlashCommands(): UseSlashCommandsReturn {
  const [commands, setCommands] = useState<SlashCommandDef[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    const handler = (event: MessageEvent) => {
      const message = event.data;
      if (message.type === 'slash_commands_available') {
        setCommands(message.commands);
        setIsLoaded(true);
      }
    };

    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, []);

  const filteredCommands = useMemo(() => {
    return (query: string): SlashCommandDef[] => {
      if (!query) return commands;

      // Strip leading / if present
      const q = query.startsWith('/') ? query.slice(1) : query;
      const matches = fuzzySearch(q, commands, (cmd) => cmd.name);
      return matches.map((m) => m.item);
    };
  }, [commands]);

  return { commands, filteredCommands, isLoaded };
}
```

- [ ] **Step 3: Create webview/src/hooks/useContextUsage.ts**

```typescript
import { useState, useEffect, useCallback } from 'react';
import { vscode } from '../vscode';

export interface ContextUsageData {
  percentage: number;
  totalTokens: number;
  maxTokens: number;
  model: string;
}

interface UseContextUsageReturn {
  usage: ContextUsageData | null;
  refresh: () => void;
}

/**
 * Hook for context window usage. Sends `get_context_usage` request to
 * extension host and receives usage data back.
 */
export function useContextUsage(): UseContextUsageReturn {
  const [usage, setUsage] = useState<ContextUsageData | null>(null);

  useEffect(() => {
    const handler = (event: MessageEvent) => {
      const message = event.data;
      if (message.type === 'context_usage') {
        setUsage({
          percentage: message.utilization ?? 0,
          totalTokens: message.totalTokens ?? 0,
          maxTokens: message.maxTokens ?? 0,
          model: message.model ?? '',
        });
      }
    };

    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, []);

  const refresh = useCallback(() => {
    vscode.postMessage({ type: 'get_context_usage' });
  }, []);

  return { usage, refresh };
}
```

- [ ] **Step 4: Create webview/src/hooks/useActiveFile.ts**

```typescript
import { useState, useEffect } from 'react';

export interface ActiveFileInfo {
  filePath: string;
  fileName: string;
  languageId: string;
}

interface UseActiveFileReturn {
  activeFile: ActiveFileInfo | null;
}

/**
 * Hook for tracking the currently active file in the VS Code editor.
 * Receives `active_file_changed` messages from the extension host.
 */
export function useActiveFile(): UseActiveFileReturn {
  const [activeFile, setActiveFile] = useState<ActiveFileInfo | null>(null);

  useEffect(() => {
    const handler = (event: MessageEvent) => {
      const message = event.data;
      if (message.type === 'active_file_changed') {
        if (message.filePath) {
          setActiveFile({
            filePath: message.filePath,
            fileName: message.fileName || message.filePath.split('/').pop() || '',
            languageId: message.languageId || '',
          });
        } else {
          setActiveFile(null);
        }
      }
    };

    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, []);

  return { activeFile };
}
```

- [ ] **Step 5: Commit**

```bash
git add webview/src/hooks/useAtMentions.ts webview/src/hooks/useSlashCommands.ts webview/src/hooks/useContextUsage.ts webview/src/hooks/useActiveFile.ts
git commit -m "feat: add React hooks for @-mentions, slash commands, context usage, active file"
```

---

## Task 5: PromptInput Component

**Files:**
- Create: `webview/src/components/input/PromptInput.tsx`

The core textarea component. Features: auto-resize to content height (up to max), Shift+Enter for newlines, Enter to send (or Ctrl+Enter if setting enabled), detect `@` and `/` to trigger pickers, report cursor position for dropdown placement.

- [ ] **Step 1: Create webview/src/components/input/PromptInput.tsx**

```tsx
import React, { useRef, useEffect, useCallback, useState, forwardRef, useImperativeHandle } from 'react';

export interface PromptInputProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: (value: string) => void;
  onAtTrigger: (query: string, position: { top: number; left: number }) => void;
  onAtDismiss: () => void;
  onSlashTrigger: (query: string, position: { top: number; left: number }) => void;
  onSlashDismiss: () => void;
  disabled?: boolean;
  placeholder?: string;
  useCtrlEnterToSend?: boolean;
}

export interface PromptInputHandle {
  focus: () => void;
  insertText: (text: string) => void;
  getTextarea: () => HTMLTextAreaElement | null;
}

const MIN_HEIGHT = 40; // px, single line
const MAX_HEIGHT = 300; // px, ~12 lines

/**
 * Auto-resizing textarea for chat prompt input.
 *
 * Keyboard behavior:
 * - Enter: send message (unless useCtrlEnterToSend is true)
 * - Shift+Enter: always inserts newline
 * - Ctrl+Enter / Cmd+Enter: send message (regardless of setting)
 * - Escape: dismiss active picker
 *
 * Trigger detection:
 * - `@` at word boundary: trigger AtMentionPicker
 * - `/` at position 0: trigger SlashCommandMenu
 */
export const PromptInput = forwardRef<PromptInputHandle, PromptInputProps>(
  function PromptInput(
    {
      value,
      onChange,
      onSubmit,
      onAtTrigger,
      onAtDismiss,
      onSlashTrigger,
      onSlashDismiss,
      disabled = false,
      placeholder = 'Type a message...',
      useCtrlEnterToSend = false,
    },
    ref,
  ) {
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const [atMentionActive, setAtMentionActive] = useState(false);
    const [slashActive, setSlashActive] = useState(false);
    const atStartPos = useRef<number>(-1);
    const slashStartPos = useRef<number>(-1);

    // Expose imperative methods
    useImperativeHandle(ref, () => ({
      focus: () => textareaRef.current?.focus(),
      insertText: (text: string) => {
        const textarea = textareaRef.current;
        if (!textarea) return;

        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const newValue = value.slice(0, start) + text + value.slice(end);
        onChange(newValue);

        // Set cursor after inserted text
        requestAnimationFrame(() => {
          const newPos = start + text.length;
          textarea.selectionStart = newPos;
          textarea.selectionEnd = newPos;
          textarea.focus();
        });
      },
      getTextarea: () => textareaRef.current,
    }));

    // Auto-resize textarea
    useEffect(() => {
      const textarea = textareaRef.current;
      if (!textarea) return;

      textarea.style.height = 'auto';
      const scrollHeight = textarea.scrollHeight;
      textarea.style.height = `${Math.min(Math.max(scrollHeight, MIN_HEIGHT), MAX_HEIGHT)}px`;
    }, [value]);

    /**
     * Calculate dropdown position relative to the textarea.
     */
    const getCaretPosition = useCallback((): { top: number; left: number } => {
      const textarea = textareaRef.current;
      if (!textarea) return { top: 0, left: 0 };

      // Use textarea's bounding rect — dropdown appears above the input
      const rect = textarea.getBoundingClientRect();
      return {
        top: rect.top, // dropdown positions itself above this
        left: rect.left,
      };
    }, []);

    /**
     * Detect @-mention and slash triggers from cursor position and text changes.
     */
    const detectTriggers = useCallback(
      (text: string, cursorPos: number) => {
        // --- Slash command detection ---
        // `/` must be at position 0 (start of input)
        if (text.startsWith('/') && !atMentionActive) {
          const query = text.slice(1); // everything after /
          if (!slashActive) {
            setSlashActive(true);
            slashStartPos.current = 0;
          }
          onSlashTrigger(query, getCaretPosition());
          return;
        } else if (slashActive && !text.startsWith('/')) {
          setSlashActive(false);
          slashStartPos.current = -1;
          onSlashDismiss();
        }

        // --- @-mention detection ---
        // Walk backwards from cursor to find `@`
        let atPos = -1;
        for (let i = cursorPos - 1; i >= 0; i--) {
          const char = text[i];
          if (char === '@') {
            // Valid if @ is at start or preceded by whitespace
            if (i === 0 || /\s/.test(text[i - 1])) {
              atPos = i;
            }
            break;
          }
          // Stop if we hit whitespace (no @ in this word)
          if (/\s/.test(char) && char !== '#') {
            break;
          }
        }

        if (atPos >= 0) {
          const query = text.slice(atPos + 1, cursorPos);
          if (!atMentionActive) {
            setAtMentionActive(true);
            atStartPos.current = atPos;
          }
          onAtTrigger(query, getCaretPosition());
        } else if (atMentionActive) {
          setAtMentionActive(false);
          atStartPos.current = -1;
          onAtDismiss();
        }
      },
      [atMentionActive, slashActive, onAtTrigger, onAtDismiss, onSlashTrigger, onSlashDismiss, getCaretPosition],
    );

    const handleChange = useCallback(
      (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        const newValue = e.target.value;
        onChange(newValue);
        detectTriggers(newValue, e.target.selectionStart);
      },
      [onChange, detectTriggers],
    );

    const handleKeyDown = useCallback(
      (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        const isEnter = e.key === 'Enter';
        const isShift = e.shiftKey;
        const isCtrlOrCmd = e.ctrlKey || e.metaKey;

        if (isEnter) {
          // Shift+Enter: always newline
          if (isShift) {
            return; // let default behavior insert newline
          }

          // Ctrl/Cmd+Enter: always send
          if (isCtrlOrCmd) {
            e.preventDefault();
            if (value.trim()) {
              onSubmit(value);
            }
            return;
          }

          // Enter alone: send unless useCtrlEnterToSend is enabled
          if (!useCtrlEnterToSend) {
            e.preventDefault();
            if (value.trim()) {
              onSubmit(value);
            }
            return;
          }

          // useCtrlEnterToSend is true and no modifier — insert newline
          return;
        }

        // Escape: dismiss active picker
        if (e.key === 'Escape') {
          if (atMentionActive) {
            setAtMentionActive(false);
            atStartPos.current = -1;
            onAtDismiss();
            e.preventDefault();
          }
          if (slashActive) {
            setSlashActive(false);
            slashStartPos.current = -1;
            onSlashDismiss();
            e.preventDefault();
          }
        }
      },
      [value, onSubmit, useCtrlEnterToSend, atMentionActive, slashActive, onAtDismiss, onSlashDismiss],
    );

    const handleClick = useCallback(
      (e: React.MouseEvent<HTMLTextAreaElement>) => {
        const textarea = e.currentTarget;
        detectTriggers(textarea.value, textarea.selectionStart);
      },
      [detectTriggers],
    );

    /**
     * Get the current @-mention start position (for replacing text on selection).
     */
    const getAtStartPos = useCallback(() => atStartPos.current, []);

    return (
      <textarea
        ref={textareaRef}
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onClick={handleClick}
        disabled={disabled}
        placeholder={placeholder}
        className={[
          'w-full resize-none bg-transparent text-vscode-input-fg outline-none text-sm',
          'scrollbar-thin scrollbar-thumb-vscode-border scrollbar-track-transparent',
          'placeholder:text-vscode-fg/40',
          disabled ? 'opacity-50 cursor-not-allowed' : '',
        ].join(' ')}
        style={{ minHeight: `${MIN_HEIGHT}px`, maxHeight: `${MAX_HEIGHT}px` }}
        rows={1}
        data-at-start-pos={atStartPos.current}
        data-slash-start-pos={slashStartPos.current}
      />
    );
  },
);
```

- [ ] **Step 2: Commit**

```bash
git add webview/src/components/input/PromptInput.tsx
git commit -m "feat: add PromptInput component with auto-resize and trigger detection"
```

---

## Task 6: AtMentionPicker Component

**Files:**
- Create: `webview/src/components/input/AtMentionPicker.tsx`

Floating dropdown that appears when user types `@`. Shows fuzzy search results from the extension host, supports keyboard navigation (up/down/enter/escape), highlights matched characters.

- [ ] **Step 1: Create webview/src/components/input/AtMentionPicker.tsx**

```tsx
import React, { useState, useEffect, useCallback, useRef } from 'react';
import type { AtMentionResult } from '../../hooks/useAtMentions';

export interface AtMentionPickerProps {
  results: AtMentionResult[];
  isLoading: boolean;
  isVisible: boolean;
  position: { top: number; left: number };
  onSelect: (result: AtMentionResult) => void;
  onDismiss: () => void;
}

const CODICON_MAP: Record<string, string> = {
  file: '\uEA7B',         // codicon-file
  'file-code': '\uEB0B',  // codicon-file-code
  'file-text': '\uEA7E',  // codicon-file-text
  'file-media': '\uEB0C', // codicon-file-media
  'file-pdf': '\uEA7E',   // codicon-file-pdf
  folder: '\uEA83',       // codicon-folder
  terminal: '\uEA85',     // codicon-terminal
  globe: '\uEB01',        // codicon-globe
  'symbol-number': '\uEA90', // codicon-symbol-number
};

/**
 * Floating dropdown picker for @-mentions.
 * Positioned above the input area. Supports keyboard navigation.
 */
export function AtMentionPicker({
  results,
  isLoading,
  isVisible,
  position,
  onSelect,
  onDismiss,
}: AtMentionPickerProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);

  // Reset selection when results change
  useEffect(() => {
    setSelectedIndex(0);
  }, [results]);

  // Scroll selected item into view
  useEffect(() => {
    if (!listRef.current) return;
    const items = listRef.current.querySelectorAll('[data-mention-item]');
    if (items[selectedIndex]) {
      items[selectedIndex].scrollIntoView({ block: 'nearest' });
    }
  }, [selectedIndex]);

  // Keyboard navigation (captured at window level when picker is visible)
  useEffect(() => {
    if (!isVisible) return;

    const handler = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          e.stopPropagation();
          setSelectedIndex((prev) => Math.min(prev + 1, results.length - 1));
          break;
        case 'ArrowUp':
          e.preventDefault();
          e.stopPropagation();
          setSelectedIndex((prev) => Math.max(prev - 1, 0));
          break;
        case 'Enter':
        case 'Tab':
          e.preventDefault();
          e.stopPropagation();
          if (results[selectedIndex]) {
            onSelect(results[selectedIndex]);
          }
          break;
        case 'Escape':
          e.preventDefault();
          e.stopPropagation();
          onDismiss();
          break;
      }
    };

    // Use capture phase to intercept before textarea
    window.addEventListener('keydown', handler, true);
    return () => window.removeEventListener('keydown', handler, true);
  }, [isVisible, results, selectedIndex, onSelect, onDismiss]);

  if (!isVisible) return null;

  return (
    <div
      className="absolute z-50 w-80 max-h-64 overflow-y-auto rounded-md border border-vscode-border bg-vscode-bg shadow-lg"
      style={{
        bottom: '100%',
        left: 0,
        marginBottom: '4px',
      }}
      ref={listRef}
    >
      {isLoading && results.length === 0 && (
        <div className="px-3 py-2 text-xs text-vscode-fg/50">Searching...</div>
      )}

      {!isLoading && results.length === 0 && (
        <div className="px-3 py-2 text-xs text-vscode-fg/50">No matches found</div>
      )}

      {results.map((result, index) => (
        <div
          key={`${result.type}-${result.detail}`}
          data-mention-item
          className={[
            'flex items-center gap-2 px-3 py-1.5 cursor-pointer text-sm',
            index === selectedIndex
              ? 'bg-vscode-button-bg text-vscode-button-fg'
              : 'hover:bg-vscode-input-bg text-vscode-fg',
          ].join(' ')}
          onClick={() => onSelect(result)}
          onMouseEnter={() => setSelectedIndex(index)}
        >
          <span className="flex-shrink-0 w-4 text-center opacity-70">
            {CODICON_MAP[result.icon] || CODICON_MAP['file']}
          </span>
          <div className="flex-1 min-w-0">
            <div className="truncate font-medium">{result.label}</div>
            <div className="truncate text-xs opacity-50">{result.detail}</div>
          </div>
          <span className="flex-shrink-0 text-xs opacity-40 capitalize">{result.type}</span>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add webview/src/components/input/AtMentionPicker.tsx
git commit -m "feat: add AtMentionPicker dropdown with keyboard navigation and codicons"
```

---

## Task 7: SlashCommandMenu Component

**Files:**
- Create: `webview/src/components/input/SlashCommandMenu.tsx`

Floating dropdown for slash commands. Triggered by typing `/` at position 0 or clicking the `/` toolbar button. Shows all commands from the initialize response with fuzzy search and descriptions.

- [ ] **Step 1: Create webview/src/components/input/SlashCommandMenu.tsx**

```tsx
import React, { useState, useEffect, useCallback, useRef } from 'react';
import type { SlashCommandDef } from '../../hooks/useSlashCommands';

export interface SlashCommandMenuProps {
  commands: SlashCommandDef[];
  isVisible: boolean;
  query: string;
  onSelect: (command: SlashCommandDef) => void;
  onDismiss: () => void;
}

/**
 * Floating dropdown for slash commands.
 * Shows command name, description, and argument hint.
 * Supports keyboard navigation (up/down/enter/escape).
 */
export function SlashCommandMenu({
  commands,
  isVisible,
  query,
  onSelect,
  onDismiss,
}: SlashCommandMenuProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);

  // Reset selection when commands change
  useEffect(() => {
    setSelectedIndex(0);
  }, [commands, query]);

  // Scroll selected into view
  useEffect(() => {
    if (!listRef.current) return;
    const items = listRef.current.querySelectorAll('[data-command-item]');
    if (items[selectedIndex]) {
      items[selectedIndex].scrollIntoView({ block: 'nearest' });
    }
  }, [selectedIndex]);

  // Keyboard navigation
  useEffect(() => {
    if (!isVisible) return;

    const handler = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          e.stopPropagation();
          setSelectedIndex((prev) => Math.min(prev + 1, commands.length - 1));
          break;
        case 'ArrowUp':
          e.preventDefault();
          e.stopPropagation();
          setSelectedIndex((prev) => Math.max(prev - 1, 0));
          break;
        case 'Enter':
        case 'Tab':
          e.preventDefault();
          e.stopPropagation();
          if (commands[selectedIndex]) {
            onSelect(commands[selectedIndex]);
          }
          break;
        case 'Escape':
          e.preventDefault();
          e.stopPropagation();
          onDismiss();
          break;
      }
    };

    window.addEventListener('keydown', handler, true);
    return () => window.removeEventListener('keydown', handler, true);
  }, [isVisible, commands, selectedIndex, onSelect, onDismiss]);

  if (!isVisible || commands.length === 0) return null;

  return (
    <div
      className="absolute z-50 w-96 max-h-72 overflow-y-auto rounded-md border border-vscode-border bg-vscode-bg shadow-lg"
      style={{
        bottom: '100%',
        left: 0,
        marginBottom: '4px',
      }}
      ref={listRef}
    >
      <div className="px-3 py-1.5 text-xs font-semibold text-vscode-fg/50 border-b border-vscode-border">
        Slash Commands {query && <span className="opacity-50">({commands.length} matching)</span>}
      </div>

      {commands.map((cmd, index) => (
        <div
          key={cmd.name}
          data-command-item
          className={[
            'flex items-start gap-2 px-3 py-2 cursor-pointer',
            index === selectedIndex
              ? 'bg-vscode-button-bg text-vscode-button-fg'
              : 'hover:bg-vscode-input-bg text-vscode-fg',
          ].join(' ')}
          onClick={() => onSelect(cmd)}
          onMouseEnter={() => setSelectedIndex(index)}
        >
          <span className="flex-shrink-0 text-sm font-mono opacity-70">/</span>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-medium text-sm">{cmd.name}</span>
              {cmd.argumentHint && (
                <span className="text-xs opacity-40 font-mono">{cmd.argumentHint}</span>
              )}
            </div>
            <div className="text-xs opacity-60 mt-0.5 line-clamp-2">{cmd.description}</div>
          </div>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add webview/src/components/input/SlashCommandMenu.tsx
git commit -m "feat: add SlashCommandMenu dropdown with descriptions and keyboard nav"
```

---

## Task 8: ModeSelector and EffortSelector Components

**Files:**
- Create: `webview/src/components/input/ModeSelector.tsx`
- Create: `webview/src/components/input/EffortSelector.tsx`

Small dropdown buttons for the input toolbar. ModeSelector switches permission modes. EffortSelector switches effort levels. Both send postMessage to the extension host.

- [ ] **Step 1: Create webview/src/components/input/ModeSelector.tsx**

```tsx
import React, { useState, useRef, useEffect } from 'react';
import { vscode } from '../../vscode';

export interface ModeSelectorProps {
  currentMode: string;
}

interface ModeOption {
  value: string;
  label: string;
  description: string;
  icon: string; // emoji or codicon
}

const MODES: ModeOption[] = [
  { value: 'default', label: 'Default', description: 'Ask before risky actions', icon: '\u{1F6E1}' },
  { value: 'plan', label: 'Plan', description: 'Plan only, no edits', icon: '\u{1F4CB}' },
  { value: 'acceptEdits', label: 'Accept Edits', description: 'Auto-accept file edits', icon: '\u{2705}' },
  { value: 'bypassPermissions', label: 'Auto', description: 'Accept all, no prompts', icon: '\u{26A1}' },
  { value: 'dontAsk', label: 'Bypass', description: 'Never ask, skip denied', icon: '\u{1F6AB}' },
];

/**
 * Dropdown button for switching permission modes.
 * Shows in the input toolbar with a shield icon.
 */
export function ModeSelector({ currentMode }: ModeSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const currentModeOption = MODES.find((m) => m.value === currentMode) || MODES[0];

  // Close on outside click
  useEffect(() => {
    if (!isOpen) return;

    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [isOpen]);

  const handleSelect = (mode: string) => {
    vscode.postMessage({ type: 'set_permission_mode', mode });
    setIsOpen(false);
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1 px-1.5 py-0.5 rounded text-xs hover:bg-vscode-input-bg text-vscode-fg/70 hover:text-vscode-fg transition-colors"
        title={`Permission mode: ${currentModeOption.label}`}
      >
        <span className="text-sm">{currentModeOption.icon}</span>
        <span className="hidden sm:inline">{currentModeOption.label}</span>
      </button>

      {isOpen && (
        <div className="absolute bottom-full left-0 mb-1 w-56 rounded-md border border-vscode-border bg-vscode-bg shadow-lg z-50">
          <div className="px-3 py-1.5 text-xs font-semibold text-vscode-fg/50 border-b border-vscode-border">
            Permission Mode
          </div>
          {MODES.map((mode) => (
            <button
              key={mode.value}
              className={[
                'w-full flex items-start gap-2 px-3 py-2 text-left',
                mode.value === currentMode
                  ? 'bg-vscode-button-bg/20 text-vscode-fg'
                  : 'hover:bg-vscode-input-bg text-vscode-fg',
              ].join(' ')}
              onClick={() => handleSelect(mode.value)}
            >
              <span className="text-sm mt-0.5">{mode.icon}</span>
              <div>
                <div className="text-sm font-medium">{mode.label}</div>
                <div className="text-xs opacity-50">{mode.description}</div>
              </div>
              {mode.value === currentMode && (
                <span className="ml-auto text-xs opacity-70">\u2713</span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Create webview/src/components/input/EffortSelector.tsx**

```tsx
import React, { useState, useRef, useEffect } from 'react';
import { vscode } from '../../vscode';

export interface EffortSelectorProps {
  currentEffort: string | null;
}

interface EffortOption {
  value: string;
  label: string;
  description: string;
  bar: string; // visual gauge
}

const EFFORTS: EffortOption[] = [
  { value: 'low', label: 'Low', description: 'Quick, concise responses', bar: '\u2581' },
  { value: 'medium', label: 'Medium', description: 'Balanced effort (default)', bar: '\u2583' },
  { value: 'high', label: 'High', description: 'Thorough, detailed work', bar: '\u2585' },
  { value: 'max', label: 'Max', description: 'Maximum effort, extended thinking', bar: '\u2588' },
];

/**
 * Dropdown button for switching effort levels.
 * Shows in the input toolbar with a gauge icon.
 */
export function EffortSelector({ currentEffort }: EffortSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const currentOption = EFFORTS.find((e) => e.value === currentEffort) || EFFORTS[1]; // default to medium

  // Close on outside click
  useEffect(() => {
    if (!isOpen) return;

    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [isOpen]);

  const handleSelect = (effort: string) => {
    vscode.postMessage({ type: 'set_effort_level', level: effort });
    setIsOpen(false);
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1 px-1.5 py-0.5 rounded text-xs hover:bg-vscode-input-bg text-vscode-fg/70 hover:text-vscode-fg transition-colors"
        title={`Effort: ${currentOption.label}`}
      >
        <span className="font-mono text-sm">{currentOption.bar}</span>
        <span className="hidden sm:inline">{currentOption.label}</span>
      </button>

      {isOpen && (
        <div className="absolute bottom-full right-0 mb-1 w-52 rounded-md border border-vscode-border bg-vscode-bg shadow-lg z-50">
          <div className="px-3 py-1.5 text-xs font-semibold text-vscode-fg/50 border-b border-vscode-border">
            Effort Level
          </div>
          {EFFORTS.map((effort) => (
            <button
              key={effort.value}
              className={[
                'w-full flex items-center gap-2 px-3 py-2 text-left',
                effort.value === (currentEffort || 'medium')
                  ? 'bg-vscode-button-bg/20 text-vscode-fg'
                  : 'hover:bg-vscode-input-bg text-vscode-fg',
              ].join(' ')}
              onClick={() => handleSelect(effort.value)}
            >
              <span className="font-mono text-sm w-4">{effort.bar}</span>
              <div className="flex-1">
                <div className="text-sm font-medium">{effort.label}</div>
                <div className="text-xs opacity-50">{effort.description}</div>
              </div>
              {effort.value === (currentEffort || 'medium') && (
                <span className="text-xs opacity-70">\u2713</span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add webview/src/components/input/ModeSelector.tsx webview/src/components/input/EffortSelector.tsx
git commit -m "feat: add ModeSelector and EffortSelector dropdown components"
```

---

## Task 9: FileUploadButton Component

**Files:**
- Create: `webview/src/components/input/FileUploadButton.tsx`

Paperclip button that triggers file picker dialog via the extension host. Supports images, PDFs, and code files.

- [ ] **Step 1: Create webview/src/components/input/FileUploadButton.tsx**

```tsx
import React, { useCallback } from 'react';
import { vscode } from '../../vscode';

export interface FileUploadButtonProps {
  disabled?: boolean;
}

/**
 * Paperclip button to attach files (images, PDFs, code files).
 * Sends a file_picker_request to the extension host, which opens
 * the native VS Code file picker dialog.
 */
export function FileUploadButton({ disabled = false }: FileUploadButtonProps) {
  const handleClick = useCallback(() => {
    vscode.postMessage({
      type: 'file_picker_request',
      accept: ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg', '.pdf', '.ts', '.tsx', '.js', '.jsx', '.py', '.rs', '.go', '.java', '.c', '.cpp', '.h', '.css', '.html', '.json', '.md', '.txt', '.yml', '.yaml', '.toml', '.sh'],
    });
  }, []);

  return (
    <button
      onClick={handleClick}
      disabled={disabled}
      className={[
        'flex items-center justify-center w-7 h-7 rounded',
        'hover:bg-vscode-input-bg text-vscode-fg/60 hover:text-vscode-fg transition-colors',
        disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer',
      ].join(' ')}
      title="Attach files (images, PDFs, code)"
      aria-label="Attach files"
    >
      {/* Paperclip icon (codicon) */}
      <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
        <path d="M10.97 4.97a.75.75 0 0 1 1.07 1.05l-3.99 4.99a2.75 2.75 0 0 1-4.35-3.36l4.18-5.17a1.5 1.5 0 0 1 2.18 2.06L6.07 9.43a.25.25 0 0 0 .36.36l3.93-4.94a.75.75 0 0 1-.06.06L6.43 9.84a1.75 1.75 0 0 1-2.51-2.44l4.18-5.17a.25.25 0 0 0-.36-.36L3.74 6.86a2.75 2.75 0 0 0 3.86 3.92l3.99-4.99a.75.75 0 0 1-.62-.82Z" />
      </svg>
    </button>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add webview/src/components/input/FileUploadButton.tsx
git commit -m "feat: add FileUploadButton (paperclip) for attaching files"
```

---

## Task 10: AttachmentBar Component

**Files:**
- Create: `webview/src/components/input/AttachmentBar.tsx`

Horizontal bar showing attached files with type icon, name, and remove button. Appears above the textarea when attachments exist.

- [ ] **Step 1: Create webview/src/components/input/AttachmentBar.tsx**

```tsx
import React from 'react';

export interface AttachmentItem {
  type: 'file' | 'image' | 'url' | 'text';
  name: string;
  content: string; // base64 for images, path for files, raw for text/url
}

export interface AttachmentBarProps {
  attachments: AttachmentItem[];
  onRemove: (index: number) => void;
}

const TYPE_ICONS: Record<string, string> = {
  file: '\uEA7B',   // codicon-file
  image: '\uEB0C',  // codicon-file-media
  url: '\uEB01',    // codicon-globe
  text: '\uEA7E',   // codicon-file-text
};

/**
 * Horizontal list of attached files/images/URLs with remove buttons.
 * Appears above the textarea when there are attachments.
 */
export function AttachmentBar({ attachments, onRemove }: AttachmentBarProps) {
  if (attachments.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-1.5 px-3 py-2 border-b border-vscode-border">
      {attachments.map((attachment, index) => (
        <div
          key={`${attachment.name}-${index}`}
          className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-vscode-input-bg border border-vscode-border text-xs group"
        >
          {/* Type icon */}
          <span className="opacity-60">{TYPE_ICONS[attachment.type] || TYPE_ICONS['file']}</span>

          {/* Image thumbnail */}
          {attachment.type === 'image' && attachment.content.startsWith('data:') && (
            <img
              src={attachment.content}
              alt={attachment.name}
              className="w-6 h-6 object-cover rounded"
            />
          )}

          {/* File name */}
          <span className="max-w-32 truncate text-vscode-fg">{attachment.name}</span>

          {/* Remove button */}
          <button
            onClick={() => onRemove(index)}
            className="flex items-center justify-center w-4 h-4 rounded-sm opacity-0 group-hover:opacity-100 hover:bg-vscode-border transition-opacity"
            title={`Remove ${attachment.name}`}
            aria-label={`Remove ${attachment.name}`}
          >
            <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor">
              <path d="M1.5 1.5l7 7M8.5 1.5l-7 7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" fill="none" />
            </svg>
          </button>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add webview/src/components/input/AttachmentBar.tsx
git commit -m "feat: add AttachmentBar component for displaying attached files"
```

---

## Task 11: ContextFooter and ProviderBadge Components

**Files:**
- Create: `webview/src/components/input/ContextFooter.tsx`
- Create: `webview/src/components/input/ProviderBadge.tsx`

ContextFooter shows the context window usage bar, token count, eye icon toggle (editor selection visibility), and permission mode indicator. ProviderBadge displays the current provider and model name.

- [ ] **Step 1: Create webview/src/components/input/ContextFooter.tsx**

```tsx
import React, { useState, useCallback } from 'react';
import type { ContextUsageData } from '../../hooks/useContextUsage';

export interface ContextFooterProps {
  usage: ContextUsageData | null;
  editorSelectionVisible: boolean;
  onToggleEditorSelection: () => void;
  permissionMode: string;
  onClickPermissionMode: () => void;
  lineCount: number;
}

/**
 * Footer below the input area showing context window usage, eye toggle,
 * and permission mode indicator.
 */
export function ContextFooter({
  usage,
  editorSelectionVisible,
  onToggleEditorSelection,
  permissionMode,
  onClickPermissionMode,
  lineCount,
}: ContextFooterProps) {
  const percentage = usage?.percentage ?? 0;
  const totalTokens = usage?.totalTokens ?? 0;
  const maxTokens = usage?.maxTokens ?? 0;

  // Color coding for usage bar
  const barColor =
    percentage > 90
      ? 'bg-red-500'
      : percentage > 70
        ? 'bg-yellow-500'
        : 'bg-vscode-button-bg';

  return (
    <div className="flex items-center justify-between px-3 py-1 text-xs text-vscode-fg/50">
      {/* Left side: context usage bar */}
      <div className="flex items-center gap-2">
        {/* Usage bar */}
        <div className="flex items-center gap-1.5" title={`Context: ${totalTokens.toLocaleString()} / ${maxTokens.toLocaleString()} tokens (${Math.round(percentage)}%)`}>
          <div className="w-16 h-1.5 rounded-full bg-vscode-border overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-300 ${barColor}`}
              style={{ width: `${Math.min(percentage, 100)}%` }}
            />
          </div>
          <span>{Math.round(percentage)}%</span>
        </div>

        {/* Line count */}
        {lineCount > 0 && (
          <span className="opacity-60">
            {lineCount} {lineCount === 1 ? 'line' : 'lines'}
          </span>
        )}
      </div>

      {/* Right side: eye toggle + permission mode */}
      <div className="flex items-center gap-2">
        {/* Eye icon — toggle editor selection visibility */}
        <button
          onClick={onToggleEditorSelection}
          className={[
            'flex items-center gap-1 px-1 py-0.5 rounded hover:bg-vscode-input-bg transition-colors',
            editorSelectionVisible ? 'text-vscode-fg/70' : 'text-vscode-fg/30',
          ].join(' ')}
          title={editorSelectionVisible ? 'Claude can see editor selection' : 'Claude cannot see editor selection'}
          aria-label="Toggle editor selection visibility"
        >
          {editorSelectionVisible ? (
            // Eye open
            <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
              <path d="M8 3C4.5 3 1.7 5.3.5 8c1.2 2.7 4 5 7.5 5s6.3-2.3 7.5-5c-1.2-2.7-4-5-7.5-5zm0 8a3 3 0 110-6 3 3 0 010 6zm0-4.5a1.5 1.5 0 100 3 1.5 1.5 0 000-3z" />
            </svg>
          ) : (
            // Eye closed
            <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
              <path d="M13.36 3.35l-1.42 1.42C10.8 3.6 9.4 3 8 3 4.5 3 1.7 5.3.5 8c.6 1.3 1.5 2.5 2.7 3.3l-1.4 1.4 1.06 1.06 11.5-11.5-1-1.01zm-5.36 8.15a3 3 0 01-2.83-4L2.55 10.12A10.5 10.5 0 011.5 8C2.7 5.8 5 4 8 4c.9 0 1.7.2 2.5.5L8.73 6.27A3 3 0 008 6.5c-.1 0-.2 0-.3.02l-1.2 1.2V7.5a1.5 1.5 0 001.3 1.49L6.5 10.3A3 3 0 018 11.5z" />
            </svg>
          )}
        </button>

        {/* Permission mode indicator */}
        <button
          onClick={onClickPermissionMode}
          className="px-1 py-0.5 rounded hover:bg-vscode-input-bg transition-colors capitalize"
          title={`Permission mode: ${permissionMode}`}
        >
          {permissionMode}
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create webview/src/components/input/ProviderBadge.tsx**

```tsx
import React from 'react';

export interface ProviderBadgeProps {
  provider: string;
  model: string;
  onClick?: () => void;
}

/**
 * Small badge showing the current AI provider and model.
 * Clickable to open model picker (if onClick is provided).
 */
export function ProviderBadge({ provider, model, onClick }: ProviderBadgeProps) {
  // Shorten common model names for display
  const displayModel = shortenModelName(model);
  const displayProvider = shortenProviderName(provider);

  return (
    <button
      onClick={onClick}
      className={[
        'flex items-center gap-1 px-2 py-0.5 rounded text-xs',
        'bg-vscode-badge-bg text-vscode-badge-fg',
        onClick ? 'cursor-pointer hover:opacity-80 transition-opacity' : 'cursor-default',
      ].join(' ')}
      title={`${provider} / ${model}`}
      aria-label={`Provider: ${provider}, Model: ${model}`}
    >
      <span className="opacity-70">{displayProvider}</span>
      <span className="opacity-30">|</span>
      <span className="font-medium">{displayModel}</span>
    </button>
  );
}

function shortenModelName(model: string): string {
  const replacements: Record<string, string> = {
    'gpt-4o-2024-08-06': 'GPT-4o',
    'gpt-4o-mini': 'GPT-4o mini',
    'gpt-4o': 'GPT-4o',
    'claude-sonnet-4-20250514': 'Sonnet 4',
    'claude-opus-4-20250514': 'Opus 4',
    'claude-3-5-sonnet-20241022': 'Sonnet 3.5',
    'gemini-2.5-pro': 'Gemini 2.5 Pro',
    'gemini-2.5-flash': 'Gemini 2.5 Flash',
    'deepseek-chat': 'DeepSeek V3',
    'deepseek-reasoner': 'DeepSeek R1',
  };
  return replacements[model] || model;
}

function shortenProviderName(provider: string): string {
  const replacements: Record<string, string> = {
    openai: 'OpenAI',
    anthropic: 'Anthropic',
    google: 'Google',
    deepseek: 'DeepSeek',
    ollama: 'Ollama',
    firstParty: 'Anthropic',
    bedrock: 'Bedrock',
    vertex: 'Vertex',
    foundry: 'Foundry',
  };
  return replacements[provider.toLowerCase()] || provider;
}
```

- [ ] **Step 3: Commit**

```bash
git add webview/src/components/input/ContextFooter.tsx webview/src/components/input/ProviderBadge.tsx
git commit -m "feat: add ContextFooter (usage bar, eye toggle) and ProviderBadge components"
```

---

## Task 12: InputToolbar Component

**Files:**
- Create: `webview/src/components/input/InputToolbar.tsx`

The 7-button toolbar below the textarea. Left-to-right: `/` (slash commands), paperclip (file upload), `+` (add content), globe (@browser), ModeSelector, EffortSelector, ActiveFileIndicator.

- [ ] **Step 1: Create webview/src/components/input/InputToolbar.tsx**

```tsx
import React, { useCallback } from 'react';
import { vscode } from '../../vscode';
import { FileUploadButton } from './FileUploadButton';
import { ModeSelector } from './ModeSelector';
import { EffortSelector } from './EffortSelector';
import type { ActiveFileInfo } from '../../hooks/useActiveFile';

export interface InputToolbarProps {
  onSlashClick: () => void;
  onAddContentClick: () => void;
  onBrowserRefClick: () => void;
  activeFile: ActiveFileInfo | null;
  onActiveFileClick: () => void;
  currentMode: string;
  currentEffort: string | null;
  disabled?: boolean;
}

/**
 * 7-button toolbar below the textarea:
 * [/] [paperclip] [+] [globe] [ModeSelector] [EffortSelector] [ActiveFile]
 */
export function InputToolbar({
  onSlashClick,
  onAddContentClick,
  onBrowserRefClick,
  activeFile,
  onActiveFileClick,
  currentMode,
  currentEffort,
  disabled = false,
}: InputToolbarProps) {
  return (
    <div className="flex items-center gap-0.5 px-2 py-1 border-t border-vscode-border/50">
      {/* Left group: action buttons */}
      <div className="flex items-center gap-0.5">
        {/* Slash command button */}
        <ToolbarButton
          onClick={onSlashClick}
          title="Slash commands"
          disabled={disabled}
        >
          <span className="font-mono font-bold text-sm">/</span>
        </ToolbarButton>

        {/* File upload (paperclip) */}
        <FileUploadButton disabled={disabled} />

        {/* Add content (+) */}
        <ToolbarButton
          onClick={onAddContentClick}
          title="Add text, URL, or content as context"
          disabled={disabled}
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
            <path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" fill="none" />
          </svg>
        </ToolbarButton>

        {/* Browse web (globe) — inserts @browser */}
        <ToolbarButton
          onClick={onBrowserRefClick}
          title="Insert @browser reference"
          disabled={disabled}
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
            <path d="M8 1a7 7 0 100 14A7 7 0 008 1zm0 1c.7 0 1.4.4 2 1.2.5.7.9 1.6 1.1 2.8H4.9c.2-1.2.6-2.1 1.1-2.8C6.6 2.4 7.3 2 8 2zM3.1 6h2.8C5.7 4.6 6.2 3.4 6.9 2.5A6 6 0 003.1 6zM2 8c0-.7.1-1.4.3-2h2.6A14 14 0 004.5 8c0 .7.1 1.4.2 2H2.3A6 6 0 012 8zm1.1 3h2.8c.2 1.4.7 2.6 1.4 3.5A6 6 0 013.1 11zm2.8 0h4.2c-.2 1.2-.6 2.1-1.1 2.8-.6.8-1.3 1.2-2 1.2s-1.4-.4-2-1.2c-.5-.7-.9-1.6-1.1-2.8zm5.2 0h2.8a6 6 0 01-4.2 3.5c.7-.9 1.2-2.1 1.4-3.5zM11.3 6h2.6a6 6 0 01.1 2c0 .7-.1 1.4-.3 2h-2.6c.1-.6.2-1.3.2-2s-.1-1.4-.2-2h.2zm-.2-3.5c.7.9 1.2 2.1 1.4 3.5h2.4a6 6 0 00-3.8-3.5z" />
          </svg>
        </ToolbarButton>
      </div>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Right group: selectors and active file */}
      <div className="flex items-center gap-0.5">
        <ModeSelector currentMode={currentMode} />
        <EffortSelector currentEffort={currentEffort} />

        {/* Active file indicator */}
        {activeFile && (
          <button
            onClick={onActiveFileClick}
            className="flex items-center gap-1 px-1.5 py-0.5 rounded text-xs hover:bg-vscode-input-bg text-vscode-fg/60 hover:text-vscode-fg transition-colors max-w-32 truncate"
            title={`Active file: ${activeFile.filePath}\nClick to reference in message`}
          >
            <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor" className="flex-shrink-0 opacity-60">
              <path d="M13.85 4.44l-3.28-3.3A.5.5 0 0010.21 1H3.5A1.5 1.5 0 002 2.5v11A1.5 1.5 0 003.5 15h9a1.5 1.5 0 001.5-1.5V4.8a.5.5 0 00-.15-.36zM10.5 2.12L12.88 4.5H10.5V2.12zM13 13.5a.5.5 0 01-.5.5h-9a.5.5 0 01-.5-.5v-11a.5.5 0 01.5-.5H9.5V5h4v8.5z" />
            </svg>
            <span className="truncate">{activeFile.fileName}</span>
          </button>
        )}
      </div>
    </div>
  );
}

/**
 * Generic toolbar button wrapper.
 */
function ToolbarButton({
  onClick,
  title,
  disabled = false,
  children,
}: {
  onClick: () => void;
  title: string;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={[
        'flex items-center justify-center w-7 h-7 rounded',
        'hover:bg-vscode-input-bg text-vscode-fg/60 hover:text-vscode-fg transition-colors',
        disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer',
      ].join(' ')}
      title={title}
      aria-label={title}
    >
      {children}
    </button>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add webview/src/components/input/InputToolbar.tsx
git commit -m "feat: add InputToolbar with 7 buttons (slash, paperclip, +, globe, mode, effort, active file)"
```

---

## Task 13: InputArea Composition Root

**Files:**
- Create: `webview/src/components/input/InputArea.tsx`

The composition root that wires all input components together. Manages shared state: prompt text, attachments, mentions, active pickers. Coordinates between PromptInput, AtMentionPicker, SlashCommandMenu, InputToolbar, AttachmentBar, ContextFooter, and ProviderBadge.

- [ ] **Step 1: Create webview/src/components/input/InputArea.tsx**

```tsx
import React, { useState, useCallback, useRef, useEffect } from 'react';
import { vscode } from '../../vscode';
import { PromptInput, type PromptInputHandle } from './PromptInput';
import { AtMentionPicker } from './AtMentionPicker';
import { SlashCommandMenu } from './SlashCommandMenu';
import { InputToolbar } from './InputToolbar';
import { AttachmentBar, type AttachmentItem } from './AttachmentBar';
import { ContextFooter } from './ContextFooter';
import { ProviderBadge } from './ProviderBadge';
import { useAtMentions } from '../../hooks/useAtMentions';
import { useSlashCommands } from '../../hooks/useSlashCommands';
import { useContextUsage } from '../../hooks/useContextUsage';
import { useActiveFile } from '../../hooks/useActiveFile';
import type { Mention, Attachment } from '../../../../src/webview/types';

export interface InputAreaProps {
  onSubmit: (text: string, attachments: Attachment[], mentions: Mention[]) => void;
  disabled?: boolean;
  model: string;
  provider: string;
  permissionMode: string;
  effortLevel: string | null;
}

/**
 * Complete input area composition root.
 * Layout (top to bottom):
 *   ProviderBadge (inline, optional)
 *   AttachmentBar (if attachments present)
 *   PromptInput (textarea)
 *     AtMentionPicker (floating, above)
 *     SlashCommandMenu (floating, above)
 *   InputToolbar (7 buttons)
 *   ContextFooter (usage bar, eye, mode)
 */
export function InputArea({
  onSubmit,
  disabled = false,
  model,
  provider,
  permissionMode,
  effortLevel,
}: InputAreaProps) {
  const [promptText, setPromptText] = useState('');
  const [attachments, setAttachments] = useState<AttachmentItem[]>([]);
  const [mentions, setMentions] = useState<Mention[]>([]);
  const [editorSelectionVisible, setEditorSelectionVisible] = useState(true);
  const [lineCount, setLineCount] = useState(0);

  // Picker state
  const [atPickerVisible, setAtPickerVisible] = useState(false);
  const [atPickerPosition, setAtPickerPosition] = useState({ top: 0, left: 0 });
  const [slashMenuVisible, setSlashMenuVisible] = useState(false);
  const [slashQuery, setSlashQuery] = useState('');

  const promptRef = useRef<PromptInputHandle>(null);

  // Hooks
  const { results: atResults, isLoading: atLoading, query: queryAtMentions, clear: clearAtMentions } = useAtMentions();
  const { commands: slashCommands, filteredCommands } = useSlashCommands();
  const { usage, refresh: refreshUsage } = useContextUsage();
  const { activeFile } = useActiveFile();

  // Refresh context usage periodically
  useEffect(() => {
    refreshUsage();
    const interval = setInterval(refreshUsage, 30000); // every 30s
    return () => clearInterval(interval);
  }, [refreshUsage]);

  // Update line count when text changes
  useEffect(() => {
    const lines = promptText.split('\n').length;
    setLineCount(promptText.trim() ? lines : 0);
  }, [promptText]);

  // Listen for file picker results
  useEffect(() => {
    const handler = (event: MessageEvent) => {
      const message = event.data;
      if (message.type === 'file_picker_result') {
        const newAttachments: AttachmentItem[] = message.files.map((f: Attachment) => ({
          type: f.type,
          name: f.name,
          content: f.content,
        }));
        setAttachments((prev) => [...prev, ...newAttachments]);
      }
    };

    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, []);

  // --- Event handlers ---

  const handleSubmit = useCallback(
    (text: string) => {
      if (!text.trim() && attachments.length === 0) return;

      const submitAttachments: Attachment[] = attachments.map((a) => ({
        type: a.type,
        name: a.name,
        content: a.content,
      }));

      onSubmit(text, submitAttachments, mentions);
      setPromptText('');
      setAttachments([]);
      setMentions([]);
      setAtPickerVisible(false);
      setSlashMenuVisible(false);
      clearAtMentions();
    },
    [attachments, mentions, onSubmit, clearAtMentions],
  );

  const handleAtTrigger = useCallback(
    (query: string, position: { top: number; left: number }) => {
      setAtPickerVisible(true);
      setAtPickerPosition(position);
      queryAtMentions(query);
    },
    [queryAtMentions],
  );

  const handleAtDismiss = useCallback(() => {
    setAtPickerVisible(false);
    clearAtMentions();
  }, [clearAtMentions]);

  const handleAtSelect = useCallback(
    (result: { type: string; insertText: string; detail: string; label: string }) => {
      // Replace the @query with the selected mention text
      const textarea = promptRef.current?.getTextarea();
      if (!textarea) return;

      const atStartPos = parseInt(textarea.dataset.atStartPos || '-1', 10);
      if (atStartPos < 0) return;

      const cursorPos = textarea.selectionStart;
      const before = promptText.slice(0, atStartPos);
      const after = promptText.slice(cursorPos);
      const newText = before + result.insertText + ' ' + after;

      setPromptText(newText);
      setAtPickerVisible(false);
      clearAtMentions();

      // Add to mentions list
      const mention: Mention = {
        type: result.type as Mention['type'],
        path: result.detail,
      };

      // Parse line range if present
      const lineMatch = result.detail.match(/#L(\d+)-L?(\d+)$/);
      if (lineMatch) {
        mention.startLine = parseInt(lineMatch[1], 10);
        mention.endLine = parseInt(lineMatch[2], 10);
      }

      setMentions((prev) => [...prev, mention]);

      // Focus and set cursor position
      requestAnimationFrame(() => {
        const newPos = atStartPos + result.insertText.length + 1;
        textarea.selectionStart = newPos;
        textarea.selectionEnd = newPos;
        textarea.focus();
      });
    },
    [promptText, clearAtMentions],
  );

  const handleSlashTrigger = useCallback(
    (query: string, _position: { top: number; left: number }) => {
      setSlashMenuVisible(true);
      setSlashQuery(query);
    },
    [],
  );

  const handleSlashDismiss = useCallback(() => {
    setSlashMenuVisible(false);
    setSlashQuery('');
  }, []);

  const handleSlashSelect = useCallback(
    (command: { name: string; argumentHint: string }) => {
      // Replace the entire input with the slash command
      const newText = `/${command.name} `;
      setPromptText(newText);
      setSlashMenuVisible(false);
      setSlashQuery('');

      // If the command takes no arguments, send immediately
      if (!command.argumentHint) {
        vscode.postMessage({
          type: 'slash_command',
          command: command.name,
        });
        setPromptText('');
      } else {
        // Focus input for user to type arguments
        promptRef.current?.focus();
      }
    },
    [],
  );

  const handleSlashButtonClick = useCallback(() => {
    if (slashMenuVisible) {
      setSlashMenuVisible(false);
    } else {
      setSlashMenuVisible(true);
      setSlashQuery('');
    }
  }, [slashMenuVisible]);

  const handleAddContentClick = useCallback(() => {
    // For now, prompt user with a simple text input via the input itself
    // In future: could open a modal. For MVP, insert a placeholder.
    promptRef.current?.insertText('[paste content here] ');
    promptRef.current?.focus();
  }, []);

  const handleBrowserRefClick = useCallback(() => {
    promptRef.current?.insertText('@browser ');
    promptRef.current?.focus();
    setMentions((prev) => [...prev, { type: 'browser', path: 'browser' }]);
  }, []);

  const handleActiveFileClick = useCallback(() => {
    if (!activeFile) return;
    const mentionText = `@${activeFile.filePath} `;
    promptRef.current?.insertText(mentionText);
    promptRef.current?.focus();
    setMentions((prev) => [...prev, { type: 'file', path: activeFile.filePath }]);
  }, [activeFile]);

  const handleRemoveAttachment = useCallback((index: number) => {
    setAttachments((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const handleToggleEditorSelection = useCallback(() => {
    setEditorSelectionVisible((prev) => !prev);
  }, []);

  const handleClickPermissionMode = useCallback(() => {
    // ModeSelector already handles this via its own dropdown
    // This is for the ContextFooter indicator — same effect
  }, []);

  // --- Drag and drop ---
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();

    // Only process if Shift is held (spec requirement)
    if (!e.shiftKey) return;

    const files = Array.from(e.dataTransfer.files);
    if (files.length === 0) return;

    const fileInfos = files.map((f) => ({
      name: f.name,
      path: '', // path not available from drag event — extension host will resolve
      type: f.type,
    }));

    vscode.postMessage({ type: 'file_drop', files: fileInfos });
  }, []);

  return (
    <div
      className="border-t border-vscode-border bg-vscode-bg"
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      {/* Provider badge (top of input area) */}
      <div className="flex items-center justify-between px-3 py-1">
        <ProviderBadge provider={provider} model={model} />
      </div>

      {/* Attachment bar (conditional) */}
      <AttachmentBar
        attachments={attachments}
        onRemove={handleRemoveAttachment}
      />

      {/* Textarea container with floating pickers */}
      <div className="relative px-3 py-2">
        {/* Floating pickers (positioned above textarea) */}
        <AtMentionPicker
          results={atResults}
          isLoading={atLoading}
          isVisible={atPickerVisible}
          position={atPickerPosition}
          onSelect={handleAtSelect}
          onDismiss={handleAtDismiss}
        />

        <SlashCommandMenu
          commands={filteredCommands(slashQuery)}
          isVisible={slashMenuVisible}
          query={slashQuery}
          onSelect={handleSlashSelect}
          onDismiss={handleSlashDismiss}
        />

        {/* Textarea */}
        <div className="rounded-lg border border-vscode-input-border bg-vscode-input-bg overflow-hidden">
          <div className="px-3 pt-2 pb-1">
            <PromptInput
              ref={promptRef}
              value={promptText}
              onChange={setPromptText}
              onSubmit={handleSubmit}
              onAtTrigger={handleAtTrigger}
              onAtDismiss={handleAtDismiss}
              onSlashTrigger={handleSlashTrigger}
              onSlashDismiss={handleSlashDismiss}
              disabled={disabled}
              placeholder={disabled ? 'Waiting for connection...' : 'Type a message... (@ to mention, / for commands)'}
            />
          </div>

          {/* Toolbar inside the input box */}
          <InputToolbar
            onSlashClick={handleSlashButtonClick}
            onAddContentClick={handleAddContentClick}
            onBrowserRefClick={handleBrowserRefClick}
            activeFile={activeFile}
            onActiveFileClick={handleActiveFileClick}
            currentMode={permissionMode}
            currentEffort={effortLevel}
            disabled={disabled}
          />
        </div>
      </div>

      {/* Context footer */}
      <ContextFooter
        usage={usage}
        editorSelectionVisible={editorSelectionVisible}
        onToggleEditorSelection={handleToggleEditorSelection}
        permissionMode={permissionMode}
        onClickPermissionMode={handleClickPermissionMode}
        lineCount={lineCount}
      />
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add webview/src/components/input/InputArea.tsx
git commit -m "feat: add InputArea composition root wiring all input components together"
```

---

## Task 14: Wire AtMentionProvider into Extension Host

**Files:**
- Modify: `src/extension.ts`

Register the AtMentionProvider in the extension activation and wire it to handle `at_mention_query` messages from the webview bridge. Also wire active file tracking and file picker handling.

- [ ] **Step 1: Update src/extension.ts to wire AtMentionProvider**

Add the following imports and wiring to the `activate` function. This goes after the existing webview provider registration:

```typescript
import { AtMentionProvider } from './mentions/atMentionProvider';
```

And in the `activate` function body, after registering webview providers:

```typescript
  // --- Story 5: @-mention provider ---
  const atMentionProvider = new AtMentionProvider();
  context.subscriptions.push(atMentionProvider);

  // Wire @-mention queries from webview
  // (This will be connected when WebviewBridge handlers are registered)
  // For now, register the handler pattern:
  const handleAtMentionQuery = async (query: string, webview: vscode.Webview) => {
    const results = await atMentionProvider.search(query);
    webview.postMessage({
      type: 'at_mention_results',
      query,
      results,
    });
  };

  // Track active editor file and notify webview
  const notifyActiveFile = (webview: vscode.Webview) => {
    const editor = vscode.window.activeTextEditor;
    if (editor) {
      const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? '';
      const relativePath = editor.document.uri.fsPath.startsWith(workspaceRoot)
        ? editor.document.uri.fsPath.slice(workspaceRoot.length + 1)
        : editor.document.uri.fsPath;

      webview.postMessage({
        type: 'active_file_changed',
        filePath: relativePath,
        fileName: editor.document.fileName.split('/').pop() || null,
        languageId: editor.document.languageId,
      });
    } else {
      webview.postMessage({
        type: 'active_file_changed',
        filePath: null,
        fileName: null,
        languageId: null,
      });
    }
  };

  // Listen for active editor changes
  context.subscriptions.push(
    vscode.window.onDidChangeActiveTextEditor(() => {
      // Notify all active webviews — actual implementation depends on
      // WebviewManager from Story 3. For now, this is the handler pattern.
    }),
  );

  // Handle file picker requests
  const handleFilePickerRequest = async (webview: vscode.Webview, accept?: string[]) => {
    const filters: Record<string, string[]> = {};
    if (accept && accept.length > 0) {
      filters['Supported Files'] = accept.map((ext) => ext.replace('.', ''));
    }

    const uris = await vscode.window.showOpenDialog({
      canSelectMany: true,
      canSelectFolders: false,
      filters: Object.keys(filters).length > 0 ? filters : undefined,
      title: 'Attach Files',
    });

    if (uris && uris.length > 0) {
      const fs = await import('fs');
      const path = await import('path');
      const attachments = [];

      for (const uri of uris) {
        const filePath = uri.fsPath;
        const fileName = path.basename(filePath);
        const ext = path.extname(filePath).toLowerCase();

        // Determine type
        const imageExts = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg'];
        const isImage = imageExts.includes(ext);

        if (isImage) {
          const content = fs.readFileSync(filePath);
          const base64 = `data:image/${ext.slice(1)};base64,${content.toString('base64')}`;
          attachments.push({ type: 'image', name: fileName, content: base64 });
        } else {
          attachments.push({ type: 'file', name: fileName, content: filePath });
        }
      }

      webview.postMessage({
        type: 'file_picker_result',
        files: attachments,
      });
    }
  };
```

- [ ] **Step 2: Commit**

```bash
git add src/extension.ts
git commit -m "feat: wire AtMentionProvider, active file tracking, and file picker into extension host"
```

---

## Task 15: Export Barrel and Integration with ChatPanel

**Files:**
- Create: `webview/src/components/input/index.ts`

Create a barrel export for all input components so ChatPanel (from Story 4) can import cleanly.

- [ ] **Step 1: Create webview/src/components/input/index.ts**

```typescript
export { InputArea } from './InputArea';
export type { InputAreaProps } from './InputArea';
export { PromptInput } from './PromptInput';
export type { PromptInputHandle, PromptInputProps } from './PromptInput';
export { AtMentionPicker } from './AtMentionPicker';
export type { AtMentionPickerProps } from './AtMentionPicker';
export { SlashCommandMenu } from './SlashCommandMenu';
export type { SlashCommandMenuProps } from './SlashCommandMenu';
export { InputToolbar } from './InputToolbar';
export type { InputToolbarProps } from './InputToolbar';
export { ModeSelector } from './ModeSelector';
export type { ModeSelectorProps } from './ModeSelector';
export { EffortSelector } from './EffortSelector';
export type { EffortSelectorProps } from './EffortSelector';
export { FileUploadButton } from './FileUploadButton';
export type { FileUploadButtonProps } from './FileUploadButton';
export { AttachmentBar } from './AttachmentBar';
export type { AttachmentBarProps, AttachmentItem } from './AttachmentBar';
export { ContextFooter } from './ContextFooter';
export type { ContextFooterProps } from './ContextFooter';
export { ProviderBadge } from './ProviderBadge';
export type { ProviderBadgeProps } from './ProviderBadge';
```

- [ ] **Step 2: Commit**

```bash
git add webview/src/components/input/index.ts
git commit -m "feat: add barrel export for all input components"
```

---

## Task 16: Build Verification & TypeScript Check

- [ ] **Step 1: Build the extension host**

Run: `cd /Users/harshagarwal/Documents/workspace/gakrcli-vscode && node esbuild.config.mjs`

Expected: `Extension built successfully`

- [ ] **Step 2: Build the webview**

Run: `cd /Users/harshagarwal/Documents/workspace/gakrcli-vscode/webview && npx vite build`

Expected: Build succeeds, no TypeScript errors

- [ ] **Step 3: Run TypeScript type checking**

Run: `cd /Users/harshagarwal/Documents/workspace/gakrcli-vscode && npx tsc --noEmit`

Expected: No type errors

Run: `cd /Users/harshagarwal/Documents/workspace/gakrcli-vscode/webview && npx tsc --noEmit`

Expected: No type errors

- [ ] **Step 4: Run all unit tests**

Run: `cd /Users/harshagarwal/Documents/workspace/gakrcli-vscode && npx jest --passWithNoTests`

Expected: All tests pass (fuzzySearch + atMentionProvider)

- [ ] **Step 5: Fix any build/type errors discovered**

If there are errors, fix them in the relevant files. Common issues:
- Missing imports (add them)
- Type mismatches between PostMessage types and component props (align types)
- Import path issues for shared types between extension host and webview (use relative paths)

- [ ] **Step 6: Commit any fixes**

```bash
git add -A
git commit -m "fix: resolve build and type errors in Story 5 input components"
```

---

## Task 17: End-to-End Manual Testing

- [ ] **Step 1: Full build**

Run: `cd /Users/harshagarwal/Documents/workspace/gakrcli-vscode && npm run build`

Expected: Build completes with no errors

- [ ] **Step 2: Package as .vsix**

Run: `cd /Users/harshagarwal/Documents/workspace/gakrcli-vscode && npx @vscode/vsce package --no-dependencies --allow-missing-repository`

Expected: Produces `gakrcli-vscode-*.vsix`

- [ ] **Step 3: Test in VS Code (manual)**

Install the extension and verify:
- InputArea appears at the bottom of the chat panel
- Textarea auto-resizes as you type multiline text
- Shift+Enter inserts newline, Enter sends
- Typing `@` shows the AtMentionPicker dropdown
- AtMentionPicker shows workspace files, fuzzy search works
- Selecting a mention inserts `@path` text into the textarea
- Typing `/` at start shows SlashCommandMenu
- Selecting a command replaces input text
- Toolbar buttons are visible: `/`, paperclip, `+`, globe, mode, effort, active file
- Paperclip button opens native file picker dialog
- Globe button inserts `@browser` into textarea
- ModeSelector dropdown opens with 5 modes, clicking sends postMessage
- EffortSelector dropdown opens with 4 levels, clicking sends postMessage
- Active file indicator shows the currently focused editor file
- AttachmentBar appears when files are attached, remove button works
- ContextFooter shows usage bar, eye toggle, permission mode
- ProviderBadge shows model name

- [ ] **Step 4: Commit final**

```bash
git add -A
git commit -m "chore: Story 5 complete — prompt input, @-mentions, slash commands, input toolbar"
```

---

## Summary

| Task | What it does | Key files |
|---|---|---|
| 1 | Fuzzy search utility (shared by pickers) | `webview/src/utils/fuzzySearch.ts` |
| 2 | Extend PostMessage types for new messages | `src/webview/types.ts` |
| 3 | AtMentionProvider (extension host file search) | `src/mentions/atMentionProvider.ts` |
| 4 | React hooks (atMentions, slashCommands, contextUsage, activeFile) | `webview/src/hooks/` |
| 5 | PromptInput (auto-resize textarea, trigger detection) | `webview/src/components/input/PromptInput.tsx` |
| 6 | AtMentionPicker (floating dropdown, keyboard nav) | `webview/src/components/input/AtMentionPicker.tsx` |
| 7 | SlashCommandMenu (floating dropdown, descriptions) | `webview/src/components/input/SlashCommandMenu.tsx` |
| 8 | ModeSelector + EffortSelector dropdowns | `webview/src/components/input/ModeSelector.tsx`, `EffortSelector.tsx` |
| 9 | FileUploadButton (paperclip) | `webview/src/components/input/FileUploadButton.tsx` |
| 10 | AttachmentBar (attached files with remove) | `webview/src/components/input/AttachmentBar.tsx` |
| 11 | ContextFooter + ProviderBadge | `webview/src/components/input/ContextFooter.tsx`, `ProviderBadge.tsx` |
| 12 | InputToolbar (7 buttons) | `webview/src/components/input/InputToolbar.tsx` |
| 13 | InputArea composition root | `webview/src/components/input/InputArea.tsx` |
| 14 | Wire AtMentionProvider + file picker into extension host | `src/extension.ts` |
| 15 | Barrel export | `webview/src/components/input/index.ts` |
| 16 | Build verification + TypeScript check + tests | — |
| 17 | End-to-end manual testing + .vsix | — |
