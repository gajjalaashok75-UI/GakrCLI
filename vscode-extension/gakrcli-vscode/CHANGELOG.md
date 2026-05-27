# Changelog

All notable changes to GakrCLI VS Code are documented here.

## [Unreleased]

## [0.2.2] - 2026-05-27

### Fixed

- The dev-host/source-checkout launch path now starts the real CLI with `node dist/cli.mjs`, supports wrapper commands with inline arguments, and reports initialize timeouts or early exits instead of hanging on "Starting GakrCLI...".
- Relative wrapper commands such as `node dist/cli.mjs` now resolve against the GakrCLI source checkout even when VS Code is opened on another folder, IDE MCP config is passed as a JSON file on Windows, and early startup failures include stderr details.
- VS Code terminals now receive `GAKR_CODE_SSE_PORT` from the extension MCP server, and Windows `/ide` matching now treats workspace paths case-insensitively so fresh terminals reconnect reliably.
- Provider badges, provider selection, and profile loading now match the root GakrCLI provider catalog, search ancestor workspace profiles, and fall back to `~/.gakrcli/.gakrcli-profile.json` when no project profile exists.
- User chat messages now render on the right side, and editing a user message sends the updated prompt back through the active CLI session.

## [0.2.1] - 2026-05-27

### Added

- Added a React-based chat webview with structured streaming output, compact tool-call rows, file attachments, active-editor attachments, profile-derived model selection, and reasoning effort controls.
- Added TypeScript extension infrastructure for sessions, checkpoints, permissions, diff handling, settings sync, provider auth, MCP IDE tools, status bar updates, worktrees, plugins, and URI handling.

### Fixed

- Wired extension chat launches to the real GakrCLI stream-json runtime with the IDE MCP server passed through `--mcp-config`, so root `/ide` and headless extension sessions share the same `sse-ide` connection path.
- Added `~/.gakrcli/.gakrcli-profile.json` fallback discovery when no workspace profile exists, keeping provider/model status aligned with the active GakrCLI profile.
- Registered real handlers for the update, logout, and terminal-mode at-mention commands so all contributed command and keybinding entries are wired.
- Removed legacy non-provider Claude naming from the extension runtime, packaged bundle, settings, and generated webview surfaces.

## [0.2.0] — 2026-04-02

### Added

**Core infrastructure (Stories 1–3)**
- Project scaffolding: TypeScript + esbuild + Vitest setup
- Process manager with NDJSON transport for streaming AI output
- Protocol update handler for GakrCLI message format

**Chat UI (Stories 4–5)**
- Streaming chat panel with React + Tailwind webview
- Markdown rendering, code blocks, and tool-use visualization
- `@`-mention picker for files, folders, and symbols
- Toolbar with model selector and action buttons

**Diff viewer (Story 6)**
- Side-by-side diff for AI-proposed file changes
- Accept / Reject buttons in the editor title bar
- `gakrcli.viewingProposedDiff` context key

**Permissions (Story 7)**
- Permission rule engine with `default`, `acceptEdits`, `plan`, and `bypassPermissions` modes
- Per-action prompts with remember-choice support

**Session management (Story 8)**
- Session tracker persisting conversation history to disk
- Sessions list webview with resume and fork actions
- `/resume` slash command

**Status bar & commands (Story 9)**
- Status bar item showing model name and token count
- Command palette entries for all major actions
- Keyboard shortcuts for focus, blur, open, and new conversation

**Checkpoint / rewind (Story 10)**
- Snapshot and restore conversation state
- Checkpoint manager with diff-based storage

**Provider auth (Story 11)**
- Auth manager supporting Anthropic, OpenAI, Ollama, Gemini, and custom endpoints
- Secure credential storage via VS Code `SecretStorage`
- Login / logout commands

**MCP IDE server (Story 12)**
- Model Context Protocol server exposing VS Code workspace context
- Tools: `read_file`, `list_directory`, `get_diagnostics`, `run_terminal_command`

**Plugin manager (Story 13)**
- Install, enable, disable, and remove MCP plugins from the UI
- Plugin bridge for inter-process communication

**Git worktree support (Story 14)**
- Create and switch git worktrees from the command palette
- Isolated AI sessions per worktree

**Onboarding & URI handler (Story 15)**
- Four-step walkthrough on first launch
- `vscode://gakrcli/...` URI handler for deep links

**Content block renderers (Story 16)**
- Rich rendering for text, code, tool-use, tool-result, and thinking blocks
- Collapsible tool-use sections with status indicators

**Teleport & elicitation (Story 17)**
- Teleport command to jump to AI-referenced code locations
- Elicitation UI for structured AI-requested user input

**Settings, fast mode & prompt suggestions (Story 18)**
- Settings sync between VS Code config and GakrCLI settings files
- Fast mode toggle for cached system prompts
- Prompt suggestion chips in the input area

**Plan review & inline comments (Story 19)**
- Plan mode with inline comment annotations
- Comment thread UI in the webview

**Polish, testing & packaging (Story 20)**
- Comprehensive unit test suite (21 test files)
- CI workflow (GitHub Actions)
- Publish workflow with vsce and GitHub Releases
- Final README, CHANGELOG, and `.vscodeignore` cleanup
