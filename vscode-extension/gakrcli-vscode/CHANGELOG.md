# Changelog

All notable changes to GakrCLI VS Code are documented here.

## [Unreleased]

### Fixed (2026-07-12)

- **`processManager` hoisted to module scope so `deactivate()` can kill the CLI process**: `processManager` was declared with `let` inside `activate()`, but `deactivate()` referenced it as a separate top-level function — a runtime `ReferenceError` that skipped process cleanup and left orphaned `gakrcli` child processes running after extension deactivation (e.g. on window reload or VS Code close). Hoisted to module scope so both `activate()` and `deactivate()` share the same binding.
- **`permissionHandler.currentMode` → `permissionHandler.getMode()`**: Fixed `TypeError` at init-time by calling the method instead of accessing a non-existent property.
- **`workspaceFolder` class property declared in `McpIdeServer`**: The constructor was assigning `this.workspaceFolder` without a prior declaration — TypeScript allows this but the intent was clearly a proper class field.
- **`context` class property declared in `PermissionRules`**: Same pattern — constructor assignment without declaration, now a proper `private readonly` field.
- **`initStartTime` declared and initialized in `ProcessManager`**: The field was read (as `Date.now()`) in `sendInitialize()` but never declared — produced `NaN` in periodic "still waiting for init" diagnostic logs, making them useless. Now properly declared and set.
- **Removed dead `sessionId` assignment in `ProcessManager.handleMessage()`**: The two ternary expressions always produced `undefined`, and `InitializeResponse` carries no `session_id`. Cleaned up to avoid confusion.
- **Changed `permissionHandler.currentMode` to `permissionHandler.getMode()`**: Fixed `TypeError` at init-time by calling the method instead of accessing a non-existent property.
- **`auto` default provider stops overriding the CLI's own login state**: Changed `selectedProvider` default from `anthropic` to `auto`. AuthManager's env builder now returns an empty env for `auto` instead of injecting provider flags that force the CLI into a specific provider's login flow. Removes the stale npm `overrides` block for `open@10.2.0` since the forced Azure auth path is no longer the default.
- **`ensureProcess()` replaces direct `processManager` access in webview command handlers**: `set_model`, `set_effort_level`, and `toggle_fast_mode` handlers now use `await ensureProcess()` so the CLI is spawned safely before the command is written; mirrors the existing `stop`/`restart` pattern and avoids writing to a non-existent process.
- **Provider credential changes now restart the running CLI process**: When the user changes provider/API key/base URL through the webview, the old CLI process is disposed and `ensureProcess()` respawns with the new env on the next message. Credential changes take effect without closing the panel.
- **`getProjectId()` now strips backslashes on Windows**: The separator regex previously only matched `/`, so on Windows the path was returned almost untouched — `path.join()` then produced a nested directory instead of the CLI's flattened `~/.gakrcli/workspace/projects/<slug>` folder, and the extension could never find sessions created by an external `gakrcli` terminal. Replaced with `/[\\/]/g` so both separators are normalized on every platform.
- **`PermissionModeIndicator` no longer sends duplicate `set_permission_mode` messages**: Removed the direct `vscode.postMessage` call. The `onModeChange` callback (in `ChatPanel.handleModeChange`) already sends it to the host, so the component was double-applying every mode change, visible in logs as `Mode changed: X → Y` immediately followed by a no-op `Y → Y`.
- **No-op early return in `PermissionHandler.setMode()` when the mode is already current**: Prevents repeated broadcast/log churn when the CLI confirms a mode change that was already applied locally by the same panel interaction.

### Fixed (2026-06-22)

- **Fixed Windows spawn stdin piping by spawning node directly**: On Windows, `shell: true` + `cmd.exe /c` wrapping passes args unsafely and breaks stdin piping through 3+ process layers. Added `resolveWindowsCliPath()` which finds the npm-installed `gakrcli.js` via `APPDATA`/`LOCALAPPDATA` and spawns `process.execPath` (node) directly — bypassing cmd.exe entirely. This fixes the initialize handshake: the extension can now send `control_request { subtype: 'initialize' }` to the CLI and get a response in <10s instead of hanging until the 300s timeout. On non-Windows, no shell is used (executable is directly in PATH as a symlink). The `bin/gakrcli` heap relaunch (`spawnSync` of itself with `--max-old-space-size`) is suppressed via `GAKR_DISABLE_HEAP_RELAUNCH=1` to avoid an extra process layer that could interfere with the extension's own lifecycle.
- **`--provider` flag removed from CLI spawn args**: The extension was passing `--provider anthropic` to the spawned CLI, overriding the user's configured provider in `~/.gakrcli/settings.json` and causing "Not logged in" auth errors. Removed `--provider` from `ProcessManager.buildArgs()` so the CLI uses its own provider config and credentials. Aligned with reference `openclaude-vscode` implementation.
- **Increased init timeout to 300s for provider/model discovery**: Increased `INIT_TIMEOUT_MS` and `SPAWN_POLL_TIMEOUT_MS` from 120s to 300s to accommodate slow provider/model discovery on cold starts. Added periodic "Still waiting for init..." diagnostic logging every 30s. Fixes the infinite "Starting → timeout → crashed → refresh → Starting" loop.

### Fixed (2026-06-01)

- Restored visible unordered, ordered, and nested list markers in assistant markdown output after Tailwind's base reset removed default bullets.
- Normalized unique anchored deletion edits so stale surrounding anchors do not break safe block removals, while still rejecting ambiguous duplicate deletion targets.
- Moved the live context usage indicator from the input toolbar into the lower composer control row beside permission, provider, and Fast mode controls.
- Allowed unique multiline edit targets to match when only leading indentation differs, preventing brittle HTML/CSS replacement failures while still refusing ambiguous relaxed matches.
- Preserved the last known live context value across empty SDK refreshes and guarded sandbox stderr annotation so Bash results keep working when the sandbox runtime does not expose its optional helper.
- Kept the composer context meter updating from SDK runtime usage and local SDK token estimates when full context analysis is unavailable, and replaced the native title tooltip with a glass hover panel and fill-line meter.
- Added a live SDK-backed context meter between the model selector and reasoning effort control, kept it visible while token capacity is still refreshing, and rendered Codex-style compacting/compacted dividers from SDK status and compact-boundary events.
- Derived a live header title from the first visible user prompt while new sessions are still waiting for host/session title updates, matching resumed chat titles.
- Matched live chats to resumed history by hiding unresolved stopped tool placeholders and deriving the header title immediately from the first visible user prompt.
- Tightened tool-row spacing, headers, borders, and expanded detail heights so collapsed and opened tool results take less vertical space.
- Bounded expanded tool input panels with their own scroll area and moved assistant copy actions to the end of each assistant turn, copying the full turn text instead of each intermediate text fragment.
- Paired tool calls with their matching results inside one expandable webview row so command inputs and outputs stay available on click without adding extra transcript height.
- Hid streamed and resumed thinking blocks from the webview transcript while showing only a compact shining thinking indicator during active hidden reasoning.
- Kept active chat titles and today's history fresh by publishing fallback titles from SDK user replay messages, refreshing sessions after user/result events, and watching all GakrCLI project stores instead of only the expected workspace directory.
- Recovered today's sessions when SDK transcripts were written under VS Code's process directory by rescanning project stores and matching each JSONL file's recorded `cwd` to the active workspace.
- Routed SDK tool permission checks through an explicit `canUseTool` bridge so `AskUserQuestion` submissions resolve with `updatedInput.answers` instead of falling through to the SDK default denial.
- Scoped hover stop controls to the currently streaming assistant response so completed turns keep copy-only actions while a later prompt is running.
- Kept Fast mode toggles stable by accepting both SDK string states (`on`, `off`, `cooldown`) and object states from runtime snapshots, result messages, and init messages.
- Preserved the user's Fast mode toggle across turn-level SDK result/init updates and removed hardcoded slash command fallbacks so the menu follows the SDK command registry without duplicate provider aliases.
- Prevented SDK runtime snapshot failures from surfacing as crashed/connection lost during startup when provider config is not initialized yet or the headless SDK has a stubbed plugin command store.
- Preferred the local workspace SDK build during source-checkout development while still falling back to the packaged `@gakr-gakr/gakrcli/sdk` dependency.

### Fixed (2026-05-31)

- Restored result entries during resumed chat replay so per-turn completion text remains attached after loading session history.
- Synced Fast mode from SDK runtime settings snapshots after webview toggles, including toggles made before the runtime was already active.
- Changed clarification prompts to a one-question stepper with scrollable content and pinned Skip, Back, Next, and Submit actions.
- Routed `AskUserQuestion` requests to the webview clarification dialog instead of the permission dialog, then returned selected answers to the SDK as `updatedInput.answers`.

### Changed (2026-05-30)

- Routed pending-permission status through the real permission dialog lifecycle, added a webview fallback for SDK tool permission requests, and cleared pending permission UI/status on stop, restart, session changes, and shutdown.
- Added a header refresh button that restarts the SDK runtime while preserving the current session, delayed Active status until provider/model state is hydrated, and folded stopped-turn interruption/duration UI into the assistant turn so the cursor and copy action settle correctly.
- Made the stop button show the GakrCLI interruption prompt immediately and fixed provider model refresh so discovered provider catalogs can replace single-model SDK fallbacks.
- Added the terminal-style `Interrupted · What should GakrCLI do instead?` row for stopped webview turns, followed by the GakrCLI-style completion duration.
- Replaced assistant footer usage stats with the GakrCLI-style turn completion line, kept stopped turns from showing synthetic interruption bubbles, and made copy controls appear on hover for every assistant response.
- Added GakrCLI-style spinner glyphs, live turn timers, API retry countdowns, SDK todo-list state, stable per-turn usage attachment, and interrupt cleanup so stopped requests do not render synthetic abort chat bubbles.
- Kept the top-right Settings button as a lightweight coming-soon dialog with a working runtime refresh action and Close button.
- Added SDK-backed runtime refresh and mutation paths for settings, provider/model state, MCP server state, plugin state, Fast mode, and reasoning effort in the native webview flow.
- Added a top-right Settings entry point and SDK-backed settings state messages for the webview.
- Reworked permission and clarification dialogs into compact centered prompts with numbered approval/deny actions and command/detail previews.
- Replaced the native VS Code chat runtime's hardcoded GakrCLI wrapper process with direct `@gakr-gakr/gakrcli/sdk` usage while preserving the existing webview protocol, permission prompts, diff handling, MCP status, resume, and model switching behavior.
- Declared `@gakr-gakr/gakrcli` as a runtime dependency and packaged the published npm SDK dependency instead of relying on root checkout `dist/sdk.mjs` files.
- Moved provider model refresh to an SDK-first path using `query().supportedModels()`, with live OpenAI-compatible `/models` fallback when the SDK has no dynamic model list.
- Added regression coverage for active provider profiles, active model selection, model promotion into GakrCLI profiles, SDK model discovery fallback, and nullable SDK capability responses during startup.

### Fixed (2026-05-29)

- Loaded the active GakrCLI provider profile from `~/.gakrcli.json` before falling back to `.gakrcli-profile.json`, keeping NVIDIA NIM and other provider/model selections aligned with the root `/provider` and `/model` commands.
- Updated the model picker immediately after selection, displayed full model IDs such as `openai/gpt-oss-120b` and `openrouter/free`, and preferred the active provider profile model list over broad static catalogs.
- Added a footer runtime status chip showing Sleep, Starting, Idle, Running, and related states beside the permission, provider, and Fast controls.
- Fetched OpenAI-compatible model choices dynamically from the active provider `/v1/models` endpoint with `/models` fallback, using the same merged environment used to launch GakrCLI.
- Renamed the ready runtime chip from Idle to Active and moved cost, duration, and token usage into the assistant message hover actions beside the copy button.

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
