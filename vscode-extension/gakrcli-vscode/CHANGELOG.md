# Changelog

All notable changes to GakrCLI VS Code are documented here.

## [Unreleased]

### Changed (2026-05-28)

- Refined the VS Code webview styling with a darker black-glass theme, lower-brightness sky-blue highlights, and consistent glass treatments across chat, sessions, tool output, provider/model selectors, MCP, plugin, permission, and onboarding surfaces.
- Reworked the chat composer footer so the input row starts with add and attachment controls, the add menu contains MCP and Plugins, and only permission mode, provider, and Fast remain in the outside footer row.
- Moved conversation runtime usage stats to the end of the chat and expanded them to show cost, input/output tokens, cache tokens, turns, and duration.
- Added a subtle full-shell webview border and removed the duplicate standalone attach button now that file/photo upload lives in the add menu.

### Fixed (2026-05-28)

- Wired Bypass mode through the wrapper launch flags by enabling the required GakrCLI allow flag when selected and passing `--allow-dangerously-skip-permissions` into new and resumed processes.
- Rendered the model menu through a bounded webview portal, kept the active model label populated from provider/profile state, and allowed explicit model selections to override the `.gakrcli-profile.json` fallback model.
- Deduplicated attached files from the picker through send-time prompt construction and compacted the attachment bar for larger file sets.
- Kept provider and model picker popups bounded above the composer in narrow VS Code panes and preserved provider selection behavior after the footer layout change.
- Clamped the model picker to the webview viewport so it stays visible in narrow panes.
- Kept startup, resume, and provider display aligned with the active `.gakrcli-profile.json` fallback model and base URL when extension provider settings are not explicitly set.
- Synced the effective permission mode back to the webview so blocked Bypass attempts snap back to the active mode.

### Added (2026-05-27 19:09:20 +05:30)

- Added focused regression tests for VS Code chat message cleanup, tool-result replay, permission request normalization, slash command filtering, session deletion state, and session history parsing.
- Extracted chat message transforms, permission request normalization, and session deletion updates into tested webview utility modules.

### Fixed (2026-05-27 19:09:20 +05:30)

- Permission approvals now stay bound to host-confirmed pending requests, preventing raw CLI control events from creating stale approval cards that cannot resolve.
- Tool results now remain attached under their matching tool calls during live streaming and resumed history, avoiding `[tool interaction]`, `[complex content]`, and duplicated final-answer output.
- Queued prompts sent while GakrCLI is still running keep their UUID/priority metadata so steering messages remain in the same conversation.
- Session history delete responses now update the visible grouped history immediately after a successful delete.

### Fixed (2026-05-27 16:49:02 +05:30)

- Headless wrapper launches now pass `--permission-prompt-tool stdio`, allowing WebSearch, Bash, and other tool approvals to appear in the VS Code permission dialog instead of being denied before the UI can respond.
- Added `allow ToolName` and `/allow ToolName` fallback handling to register a tool as allowed and resolve matching pending permission requests.
- Deduplicated streamed assistant responses from final payloads, hid internal local-command wrappers, stripped raw thinking tags, and moved copy actions to the latest assistant response.
- Slash command search now deduplicates by command name, matches command names only, hides empty results, and no longer blocks unknown slash-style prompts.
- Provider selection now scrolls inside a bounded dialog so all provider options remain reachable in narrow VS Code panes.

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
