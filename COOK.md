# GakrCLI SDK + VS Code Extension Cooking Plan

## Current Findings

- SDK entrypoint: `src/entrypoints/sdk/index.ts`.
- Main SDK query/session implementation: `src/entrypoints/sdk/query.ts` and `src/entrypoints/sdk/v2.ts`.
- VS Code in-process adapter: `vscode-extension/gakrcli-vscode/src/process/processManager.ts`.
- The extension already imports `@gakr-gakr/gakrcli/sdk`, but still exposes a compatibility control/NDJSON-style adapter to the rest of the extension.
- Current SDK coverage is strong for query/session basics, permissions, MCP connection status, session transcript helpers, and simple model/thinking mutation.
- Current gaps are full provider/model/profile catalog APIs, active runtime state snapshots, settings read/write, context/token/cost readouts, fast-mode control, plugin/MCP mutation, and slash command metadata/execution.

## Slice 1: Baseline Plan

- [x] Keep this file as the implementation checklist.
- [x] Land the work in small, buildable slices.
- [x] Preserve the public `@gakr-gakr/gakrcli/sdk` import path.
- [x] Keep the SDK bundle headless: no React, Ink, or TUI component imports.
- [x] Add first-pass public runtime/control APIs, docs, and tests.

## Slice 2: SDK Runtime State Read API

- [x] Add a headless runtime/control surface to the SDK.
- [x] Expose `getRuntimeState()` from active query objects.
- [x] Runtime state includes session id, cwd, status, provider/profile, model catalog, active model, permission mode, reasoning config, fast mode, slash commands, agents, MCP status, plugin state, account info, and last usage/cost.
- [ ] Deepen runtime status/spinner integration from engine events beyond idle/running/closed.

## Slice 3: Providers, Profiles, And Models

- [x] Add SDK read APIs for providers, active profile, active model, configured models, and discovered model options.
- [x] Add SDK write APIs for active provider profile and active model.
- [x] Prefer existing integration registry and provider profile helpers over duplicating extension logic.
- [ ] Replace `discoverModels()` catalog fallback with provider-specific live discovery where available.

## Slice 4: Settings And Runtime Mutations

- [x] Add `getSettings()` and `applySettings()`.
- [x] Support runtime mutation for model, permission mode, fast mode, reasoning effort/max thinking tokens, and environment overrides.
- [x] Keep existing extension message names where possible.
- [ ] Populate per-source settings snapshots from the canonical settings loader instead of empty source placeholders.

## Slice 5: Context, Tokens, Cost, And Status

- [x] Add `getContextUsage()` using existing noninteractive context collection where safe, with a stable empty fallback.
- [x] Track the last result message and expose `getUsageSummary()`.
- [x] Include tokens, cost, model usage, context windows, and fast-mode state where existing data is available.
- [ ] Add finer status/spinner and compact/autocompact details to the runtime snapshot.

## Slice 6: Slash Commands

- [x] Add `listSlashCommands()` returning command metadata.
- [x] Add `runSlashCommand()` for headless-safe handling.
- [x] Return `requiresUi: true` for local JSX/TUI commands instead of importing UI.
- [ ] Execute prompt/local text slash commands through a full headless command context.

## Slice 7: MCP Runtime Management

- [x] Add `listMcpServers()`, `setMcpServers()`, `toggleMcpServer()`, and `reconnectMcpServer()`.
- [x] Preserve IDE MCP injection from the extension.
- [ ] Return richer config/capability snapshots for disabled and configured-but-not-connected servers.
- [ ] Add remove-server support.

## Slice 8: Plugin Runtime Management

- [x] Add `listPlugins()`, `setPluginEnabled()`, and `reloadPlugins()`.
- [x] Return plugin, command, agent, and MCP summaries from current SDK state.
- [x] Use existing plugin operations when they can run headlessly.
- [ ] Wire true plugin reload/install/uninstall refresh boundaries where available.

## Slice 9: VS Code Extension Cleanup

- [x] Update `ProcessManager` to call SDK runtime/control methods directly.
- [x] Keep a narrow compatibility adapter for permission and diff code that still expects control responses.
- [x] Keep terminal mode as the only path that intentionally launches the CLI.
- [ ] Remove remaining extension-side provider/model/plugin bridge duplication after SDK methods are fully canonical.

## Slice 10: Verification

- [x] Add SDK unit tests for runtime state, settings, provider/model APIs, fast mode, reasoning mutation, MCP mutation, usage, and slash command metadata.
- [x] Add extension tests for `ProcessManager` initialize and mutation routing through SDK runtime methods.
- [x] Run `bun.cmd test tests\sdk\query-methods.test.ts`.
- [x] Run `bun.cmd test vscode-extension\gakrcli-vscode\test\unit\processManager.test.ts`.
- [x] Run `npm.cmd run build:webview` from `vscode-extension/gakrcli-vscode`.
- [x] Run `npm.cmd run build:extension` from `vscode-extension/gakrcli-vscode`.
- [x] Run root `npm.cmd run build`.
- [ ] Full root `npm.cmd test` currently reaches 3082 passing tests but fails on unrelated missing `vscode` package test imports plus extension tests that require the VS Code test harness.
- [ ] Root `npm.cmd run typecheck` currently fails on broad pre-existing repository type issues unrelated to this slice.

## Slice 11: VS Code Runtime Settings Webview

- [x] Add a Settings button in the chat header next to New Chat.
- [x] Add a runtime settings dialog connected to SDK-backed host messages.
- [x] List supported SDK-updatable settings in the dialog:
  - Model
  - Permission mode
  - Reasoning effort
  - Max thinking tokens
  - Fast mode
- [x] Apply model, permission mode, effort, max thinking tokens, and fast mode through `ProcessManager.sendControlRequest({ subtype: 'apply_flag_settings' })`.
- [x] Refresh visible provider/model/settings/runtime summaries after updates.
- [ ] Add provider-profile switching controls directly into the settings dialog.
- [ ] Add editable environment override rows in the settings dialog.

## Slice 12: SDK-Backed MCP And Plugin Webview State

- [x] Route MCP refresh/reconnect/toggle/add/remove actions through SDK `sendControlRequest()` calls instead of write-only control requests.
- [x] Broadcast `mcp_servers_state` back to the webview after MCP mutations.
- [x] Route plugin refresh/toggle through SDK settings/plugin reload paths.
- [x] Broadcast `plugins_state` back to the webview after plugin mutations.
- [ ] Add true MCP remove-server support in the SDK instead of mapping remove to disable.
- [ ] Add marketplace/install/uninstall SDK methods and replace slash-command fallbacks.

## Slice 13: Permission And Clarification UI Polish

- [x] Rework permission prompts into a compact centered modal modeled after the provided screenshot.
- [x] Show command/details in a monospace block.
- [x] Use numbered choices for Allow, Always Allow, and Deny.
- [x] Support keyboard shortcuts: `1`/Enter allow, `2` always allow, `3`/Escape deny.
- [x] Rework AskUserQuestion/elicitation dialogs to use the same compact modal language.
- [ ] Add richer previews for AskUserQuestion option preview content.
