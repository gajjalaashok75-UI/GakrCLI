# Changelog

All notable changes to GakrCLI will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- **`/model` custom model name entry**: The `/model` picker now ends with an `Enter model name…` row. Selecting it swaps the list for a free-text field, so a model can be switched to by typing its name — no `/provider` → edit → navigate-every-field round trip. This is the fix for custom / unlisted OpenAI- and Anthropic-compatible providers, whose routes discovery cannot enumerate and whose picker previously offered only the configured default. Gated behind a new `allowCustomModelInput` prop so the embedded pickers (`PromptInput`, `/config`) keep their fixed choice sets. List navigation wraps, so the row is one `↑` from the top of a 100+ model catalog.
- **Dynamic model discovery for 22 more provider routes**: `openai`, `deepseek`, `moonshot`, `xai`, `venice`, `longcat`, `zai`, `nearai`, `fireworks`, `bankr`, `xiaomi-mimo`, `together`, `mistral`, `dashscope-intl`, `dashscope-cn`, `atlas-cloud`, `gitlawb-opengateway`, `kimi-code`, `clinepass`, `opencode`, `opencode-go`, and `xiaomi-mimo-token` moved from `source: 'static'` to `'hybrid'` with `discovery: { kind: 'openai-compatible' }`. Each route's `GET {baseUrl}/models` endpoint was probed first to confirm it exists. Routes with discovery went from 9 to 31; the 8 that stay static do so because they do not expose an OpenAI-shaped catalog — `azure-openai` (deployments API), `bedrock` (SigV4 `ListFoundationModels`), `cloudflare` (no default base URL, account-scoped), `gemini` (native API shape), `github` / `github-enterprise` (GitHub Models catalog API), `minimax` (anthropic-proxy transport), and `vertex` (Google auth). Static entries still win on `apiName` collision, so hand-authored context windows, capabilities, and reasoning metadata survive the merge, and any discovery failure falls back to the static list.
- **`discoveryModelFilter.ts`**: Shared `mapOpenAIChatCatalogModel` for the routes above. Aggregating providers serve embeddings, rerankers, image/video/speech models, and moderation endpoints from the same `/models` catalog as their chat models; this drops them so they cannot bury usable entries in the picker. Deliberately an exclusion list rather than an allowlist — chat ids vary too much (`glm-5`, `auto`, `inkling`, `mindai/macaron-v1-tall`) for a positive pattern to be safe. Validated against seven live catalogs — 416 ids, 10 removed, all of them genuinely non-chat (`deepseek-ocr`, `gpt-image-2`, three Gemini `-image` variants, `FLUX.2-klein-4B`, `whisper-large-v3`, `Qwen3-Embedding-0.6B`, `Qwen3-Reranker-0.6B`, `openai/privacy-filter`) and no chat model dropped. It also picks up `contextWindow` / `maxOutputTokens` from the common field spellings and honors inline `active: false` / `isAvailable: false`.
- **Discovery status line and manual refresh are now rendered in the picker**: `ModelPicker` already accepted `discoveryState` and `onRefresh`, and `modelPicker:refresh` was already bound to `r` in the keybinding registry, but neither prop was read in the component body — so the "Loaded fresh … models" / "Using cached …" line never appeared and `r` did nothing. The status line now renders under the session-model line, colored by tone, and `r` is wired through `useKeybindings`. The `r to refresh models` hint only appears when the route can actually refresh. Both are suppressed while the custom model-name field is open, otherwise typing `r` would fire a refresh instead of inserting the character.

### Fixed
- **The in-REPL model shortcut ignored the configured provider**: `PromptInput` rendered `ModelPicker` bare — no `optionsOverride`, no `discoveryState`, no `onRefresh` — so the hotkey picker offered only the built-in Anthropic models regardless of which provider was active, while `/model` showed the right list. The discovery plumbing is now extracted into `ModelPickerWithDiscovery` (shared by both surfaces) plus `ModelPickerWithLazyDiscovery` for callers that cannot await the context before rendering, which is the hotkey's case: `/model` resolves it in its async `call`, the hotkey toggles synchronously. The lazy variant renders nothing until the context settles rather than mounting the picker first, because mounting first would flash the Anthropic list before the provider's models replaced it — resolving reads the discovery cache, not the network, so the gap is not user-visible. A failed load still opens the picker with the built-in options instead of leaving the hotkey dead. The machinery stays in `model.tsx` rather than moving to a new module: `model.test.tsx` cache-busts via `./model.js?<suffix>` re-imports, and a separate non-cache-busted module would quietly break that isolation.
- **Custom model-name entry bypassed the organization allowlist**: `/model`'s `handleSelect` checks `isModelAllowed`, but `PromptInput`'s `handleModelSelect` does not, and the free-text field is the one path into the picker that skips the vetted option list. `isModelAllowed` is now enforced at submit time in the picker itself, with the error shown inline so the field stays open to retype — the post-selection callers can only close the picker with a message. No change for users without `availableModels` configured.
- **`GET /models` responses with a top-level array were read as empty**: `listOpenAICompatibleModels` and `fetchOpenAICompatibleModelsRaw` only ever read `data.data`. Providers that return the array at the top level instead of inside the OpenAI `{ object: 'list', data: [...] }` envelope therefore looked like "no models", and discovery silently fell back to the static catalog with no error. Both now normalize through a shared `normalizeModelsListPayload` that accepts a bare array, `data`, or `models`, preserving the previous return values for standard payloads.

## [0.6.1] - 2026-08-21

### Added
- **WebBrowserTool**: Added `UI.tsx` component for programmatic usage and new test suite `WebBrowserTool.result.test.ts` for result handling.
- **WebBrowser footer pill**: New `BagelPill` component renders a `browser (<host>)` pill in the prompt footer while a browser tab is open, and `Enter` on it toggles the browser panel. The label reads the live page host from `bagelUrl`; URLs with no hostname (`about:blank`, `data:`, `file:`) and unparseable URLs fall back to a plain `browser` label so a mid-navigation URL can never blank the pill. Text-only by design — pills in the footer's `parts` array render inside `<Text wrap="truncate">`, where the Ink reconciler throws on a nested `Box`, so this pill has no click target.
- **BrowserToolExecutor**: Added `onSharedChange()` so UI code can react to shared-executor creation/teardown instead of polling `getSharedIfExists()`. Listeners fire *outside* the shared mutex, so a listener that re-enters `getShared()`/`resetShared()` can no longer deadlock on the lock its caller already holds.

### Changed
- **WebBrowserPanel**: Complete UX refactor (Round 12-13) — ANSI-safe widths, tab overflow (+N more), separated tab bar, right-aligned status badges, content wrapping, perfect borders, terminal resize safe at 80/120/160/200 cols.
- **WebBrowserPanel UX**: Active tab bracket highlight (●/○), tab title normalization, content clipping (8 lines), fixed viewport, empty state (🌐), HTTP status colors (🟢 2xx, 🟡 3xx/4xx, 🔴 5xx), content hierarchy, footer "Last Action", tab count badge, content summary mode.
- **WebBrowserPanel**: "Last Action" footer now shows target URL for `switch_tab` and `close_tab` operations instead of just the tab ID (e.g., "SWITCH_TAB → to https://example.com").
- **scripts/build.ts**: Updated the `WEB_BROWSER_TOOL` flag comment — the panel UI is no longer stubbed.

### Fixed
- **WebBrowser footer pill never rendered**: The pill was gated on `useAppState(_s => false)`, its `footerSelection` case was an empty `break`, and `_bagelSelected` was computed but never passed to any child — so no pill could ever appear. `bagelActive`/`bagelUrl` were declared in `AppStateStore` but written by nothing. The pill is now rendered from `PromptInputFooterLeftSide`'s `parts` array (immediately after the tmux pill, matching `footerItems` nav order) and `bagelSelected` is threaded through `PromptInputFooter`. Inclusion is gated on `bagelActive` at the array level rather than by returning `null`, because `Byline` inserts its ` · ` separator by array index and an empty entry would leave a stray separator behind.
- **WebBrowser panel state was never populated**: Added `useWebBrowserLiveState()` in `REPL.tsx`, which mirrors the shared executor's live state into `bagelActive`/`bagelUrl`. It is called unconditionally from the REPL body — the panel lives in a subtree that unmounts whenever a dialog takes focus, so subscribing from there would tear the mirror down and drop the pill mid-session. Browser teardown (`resetShared()`) now clears both fields, hiding the pill and panel.
- **WebBrowser panel violated the Rules of Hooks**: The panel gate was an inline IIFE calling `useAppState()` inside a conditionally-rendered subtree. Extracted to a `WebBrowserPanelGate` component so its hooks run in their own render scope. The gate also no longer reads executor state during render — it relies on the mirrored app state, so panel visibility no longer depends on an incidental re-render coinciding with a tab change.
- **WebBrowser panel toggle was a no-op on first press**: The footer toggle defaulted `bagelPanelVisible` to `false` while the gate treated undefined as hidden, so the first `Enter` set it to a value it already effectively had. Both sides now default to visible, so a browser opening shows the panel and the first press hides it.
- **SleepTool**: Fixed immediate return when calling Sleep in normal REPL mode — was incorrectly checking proactive mode state instead of allowing sleep in all modes. Now only interrupts for queued work (proactive auto-wake).
- **RecordingSession tests**: Fixed mock evaluate sequence, double-start handling, stop error scenarios.
- **WebBrowserPanel**: Removed sync `/tmp` debug logging, eliminated 145-line inline render duplication.
- **WebBrowserPanel**: Memoized `computeBoxWidth`/`displayWidth`/`truncate`, fixed spinner interval leak, bounded executor polling.
- **WebBrowserPanel**: Moved `parseLastAction` outside component, removed unused `resolveLogoAccent`/`panelAccentColor`, wrapped with `React.memo`.

## [0.6.0] - 2026-08-19 14:49:41 +0530

### Added
- **WebBrowserTool**: Enabled the built-in browser navigation tool (`WEB_BROWSER_TOOL` flag). Refactored the tool into modular files — `browserEngine.ts` (Chromium/Playwright engine), `browserServer.ts` (device session server), `asyncMutex.ts`, `eventStorage.ts`, `recording.ts`, `refManager.ts`, `types.ts`, and `index.ts`. Added the `playwright` dependency (kept external in `scripts/externals.ts` so native helpers resolve at runtime). Expanded the panel UI and added new test suites: `WebBrowserTool.mocks.test.ts`, `WebBrowserTool.newtab.test.ts`, `jsScripts.test.ts`, and `recording.test.ts`.

## [0.6.0] - 2026-08-09 08:33:46 +0530

### Changed
- **Version**: Bumped from 0.5.8 to 0.6.0.
- **Code cleanup pass**: Reviewed the full working tree (197 files) for code reuse, quality, and efficiency. Fixed `collapseReadSearch` (removed per-render array copy), `taskSummary` (replaced `Record<string, unknown>` casts with a typed structural options type), and restored the `doctorDiagnostic.settingsPath.test.ts` contract to match the intentionally-stubbed implementation (7/7 tests pass).
- **Type fixes**: Renamed `usegakrcliCodeHintRecommendation.tsx` → `useGakrCLICodeHintRecommendation.tsx` to fix the TS1261 case-mismatch error; full `tsc --noEmit` passes with zero errors.

## [0.5.8] - 2026-07-14

### Fixed
- **scripts/externals.ts**: Added `web-tree-sitter` and `tree-sitter-wasms` to COMMON_EXTERNALS (WASM runtime path resolution), and `graphology`, `graphology-metrics`, `js-tiktoken` to INTENTIONALLY_BUNDLED (build externals validation passes).

### Removed
- **Sponsored tips feature**: Removed `sponsoredTips.ts` stub and all references — `getSponsoredTipsFrequency`/`isSponsoredSlotEligible`/`recordSponsoredTipShown`/`getSessionsSinceLastSponsored` from tipScheduler, tipHistory, and tipRegistry; `sponsoredTipsHistory` field from config.ts.

### Fixed
- **vscode-extension/gakrcli-vscode**: Resolved 14 TypeScript compilation errors (TS 5.5 closure-narrowing, tagged union casts, permissionHandler type mismatches, missing `ShowElicitationMessage` type, generic handler cast incompatibilities); removed 3 duplicate command definitions in `package.json`; `gakrcli.focus` no longer broadcasts meaningless empty `at_mention_inserted` payload.

### Fixed
- **vscode-extension/gakrcli-vscode — Permission system fixes**: `elicitation_response` now routes through `PermissionHandler.handleAskUserQuestionResponse()` to wrap values in `{behavior, updatedInput}` — fixes `invalid_union` on AskUserQuestion. Removed native VS Code dialog fallback that caused double prompts. Mode changes (`set_permission_mode`) are forwarded to CLI so `hasPermissionsToUseTool` respects correct mode. `diffHandler` accepts `getPermissionMode` callback and auto-approves file edits in `acceptEdits` mode without interactive diff viewer. Webview permission response now includes user-entered reason text for denials, passed through to CLI as deny message.

### Changed
- **vscode-extension/gakrcli-vscode — PermissionDialog redesigned to match CLI UX**: Risk level shown as small capsule badge (not full banner). Tool input parsed by type — Write shows File+Content, Bash shows Command+Description, Edit shows File+Replace+With. Four vertical options (Allow Once / Allow for Session / Enable Full Access / Deny) with optional reason text input for denial. Mode descriptions in ModeSelector expanded to clarify which tools each mode affects.

### Fixed
- **vscode-extension/gakrcli-vscode — PermissionRules now truly session-scoped**: Removed workspaceState persistence. Always-allow rules from previous sessions no longer silently carry over — each extension restart starts fresh, restoring the "ask before each tool use" contract of `default` mode.
- **vscode-extension/gakrcli-vscode — Mode list synced to CLI exactly**: Replaced `dontAsk` (not a CLI mode) with `Full Access` (CLI mode). Mode descriptions now match CLI verbatim — "Standard behavior; prompts for dangerous operations" (Default), "Auto-accept file edit operations in the workspace" (Accept Edits), "Analysis only; tool execution is blocked" (Plan), "Skip normal permission prompts while preserving hard safety prompts" (Bypass), "Skip normal permission prompts and hard safety-check prompts" (Full Access).
- **vscode-extension/gakrcli-vscode — PermissionDialog options now match CLI exactly**: Labels updated to CLI convention — "Allow Once" → "Yes", "Allow for This Session" → "Yes, allow all during this session", "Enable Full Access for Session" → "Yes, and enable Full Access for this session". "Deny" split into "No, provide reason" (inline input, shortcut R) and "No" (deny without reason, shortcut D), matching CLI's `reject+withReason` and `reject` options. Full Access option now triggers mode change to `bypassPermissions` via extension host.

## [0.5.8] - 2026-07-13

### Fixed
- **src/hooks/toolPermission/handlers/interactiveHandler.ts**: Added missing `onExternalAbort` handler and closing braces for try/catch structure, fixing watchdog suspension tests (24/24 pass).
- **src/utils/plugins/schemas.ts**: Added `isOfficialGitUrl()` for exact git URL host matching, preventing impersonation via substring matching (20/20 pass).
- **src/integrations/runtimeMetadata.ts**: Added `.settings` field to `resolveModelRuntimeLimits()` precedence chain so settings `modelLimits` override env defaults (10/10 pass).
- **src/tools/BashTool/bashSecurity.ts**: Added `isPermissiveSafety()` early return in `bashCommandIsSafe_DEPRECATED` and `bashCommandIsSafeAsync_DEPRECATED` for permissive mode support (6/6 pass).
- **src/tools/PowerShellTool/commandSemantics.ts**: Replaced simplified stub with full reference implementation (wrapper command resolution, env utility, diagnostic semantics, package script resolving) (86/86 pass).
- **src/tools/PowerShellTool/pathValidation.ts**: Changed `CMDLET_PATH_CONFIG` to use `Object.create(null)` to prevent prototype chain pollution from `constructor`/`__proto__` cmdlet names (6/6 pass).

## [0.5.8] - 2026-07-08

### Added
- **scripts/build.ts**: Added `CCR_REMOTE_SETUP` feature flag for self-hosted RCS setup command.
- **src/entrypoints/cli.tsx**: Added `SKILLS_LEADING_VALUE_FLAGS` set (18 flags including `--model`, `--provider`, `--session-id`, `--effort`) for proper skills CLI argument parsing.
- **src/entrypoints/cli.tsx**: Added missing boolean flags (`--bare`, `--dangerously-skip-permissions`, `--disable-slash-commands`, `--fork-session`, `--init`, `--init-only`, `--maintenance`, `--mcp-debug`, `--no-session-persistence`, `--replay-user-messages`) to `SKILLS_LEADING_BOOLEAN_FLAGS`.
- **.gitignore**: Added `remote-control-changes.md` to ignore list.

### Fixed
- **src/entrypoints/cli.tsx**: Moved skills CLI check before profile validation so `gakrcli skills` works even when provider config is broken.
- **src/entrypoints/cli.tsx**: Fixed `getSkillsCliArgs()` — proper value flag skipping, `=` variant handling for multi-value flags with value extraction, correct optional value flag logic (set `sawPromptModeFlag` before index increment, check for `'skills'` before consuming value, added `=` variant handler).
- **src/entrypoints/cli.tsx**: Wrapped `printStartupScreen()` in `if (args[0] !== 'skills')` guard so script-friendly skills output avoids the gradient banner.
- **src/utils/messages.ts**: Added string content handling in `normalizeMessages()`, `stripCallerFieldFromAssistantMessage()`, and `normalizeMessagesForAPI()` to prevent `.map()` crash when `message.message.content` is a string.

### Changed
- **src/entrypoints/cli.tsx**: Moved `--model`, `-m` from `SKILLS_LEADING_BOOLEAN_FLAGS` to `SKILLS_LEADING_VALUE_FLAGS` (they take values, not booleans).

