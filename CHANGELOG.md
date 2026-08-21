# Changelog

All notable changes to GakrCLI will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.6.1] - 2026-08-21

### Added
- **WebBrowserTool**: Added `UI.tsx` component for programmatic usage and new test suite `WebBrowserTool.result.test.ts` for result handling.

### Changed
- **WebBrowserPanel**: Complete UX refactor (Round 12-13) — ANSI-safe widths, tab overflow (+N more), separated tab bar, right-aligned status badges, content wrapping, perfect borders, terminal resize safe at 80/120/160/200 cols.
- **WebBrowserPanel UX**: Active tab bracket highlight (●/○), tab title normalization, content clipping (8 lines), fixed viewport, empty state (🌐), HTTP status colors (🟢 2xx, 🟡 3xx/4xx, 🔴 5xx), content hierarchy, footer "Last Action", tab count badge, content summary mode.
- **WebBrowserPanel**: "Last Action" footer now shows target URL for `switch_tab` and `close_tab` operations instead of just the tab ID (e.g., "SWITCH_TAB → to https://example.com").

### Fixed
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

