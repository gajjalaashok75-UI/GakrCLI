# Known Issues

## Inactive Feature Flags

### `UDS_INBOX` — Unix Domain Socket inter-session messaging
- **Tool affected**: `ListPeersTool`
- **Status**: Intentionally disabled in both dev and build modes
- **Root cause**: Causes Node.js process to hang after build (`scripts/defines.ts` comment: "构建后 nodejs 环境卡住")
- **Files**: `scripts/build.ts:46` — `UDS_INBOX: false`; `scripts/defines.ts:68` — commented out from `DEFAULT_BUILD_FEATURES`
- **Tool wiring**: `ListPeersTool` is fully implemented and registered in `src/tools.ts` behind `feature('UDS_INBOX')`, but the flag is always false
-
- ### `REPL_TOOL` — REPL execution engine requires ant-native runtime
- - **Tool affected**: `REPLTool`
- - **Status**: Intentionally inaccessible in public builds
- - **Root cause**: `src/tools.ts:17` hardcodes `const REPLTool = null`. Even if un-nulled, registration at `src/tools.ts:240` requires `process.env.USER_TYPE === 'ant'`. The `call()` method returns an error: "REPL execution engine requires the ant-native runtime."
- - **Files**: `src/tools/REPLTool/REPLTool.ts` (full implementation matching reference, but `call()` returns error); `src/tools.ts:17` (hardcoded null); `src/tools.ts:240` (USER_TYPE gate)
- - **Reference**: `references/claude-code-main/packages/builtin-tools/src/tools/REPLTool/REPLTool.ts` — identical implementation, same USER_TYPE gate pattern

- ### `SUGGEST_BACKGROUND_PR_TOOL` — requires KAIROS runtime
- **Tool affected**: `SuggestBackgroundPRTool`
- **Status**: Intentionally inaccessible in public builds
- **Root cause**: `src/tools.ts:18` hardcodes `const SuggestBackgroundPRTool = null`. Registration at line 223 uses null guard. Reference gates behind `USER_TYPE === 'ant'`. `call()` returns error: "SuggestBackgroundPR requires the KAIROS runtime."
- **Files**: `src/tools/SuggestBackgroundPRTool/SuggestBackgroundPRTool.ts` (full implementation matching reference, but `call()` returns error); `src/tools.ts:18` (hardcoded null)
- **Reference**: `references/claude-code-main/packages/builtin-tools/.../SuggestBackgroundPRTool.ts` — identical implementation; `src/tools.ts:21-25` gates behind `USER_TYPE === 'ant'`

### `lang` — Not in REMOTE_SAFE or BRIDGE_SAFE
- **Command affected**: `lang` (Set display language — en/zh/auto)
- **Status**: Intentionally excluded from remote-safe operation
- **Root cause**: `lang` is a `local-jsx` command that renders Ink UI. Remote/bridge mode cannot execute `local-jsx` commands. Reference (`references/claude-code-main/`) does not add `lang` to `REMOTE_SAFE` or `BRIDGE_SAFE`.
- **Files**: `src/commands/lang/lang.ts` (full `local-jsx` implementation); `src/commands.ts:335` (registered without feature gate, unconditional)
- **Reference**: `references/claude-code-main/...` — same pattern, no remote-safe registration

### `memory-stores` — Not wired (Bun mock.module state leak in tests)
- **Command affected**: `memory-stores` (Manage cloud memory stores via Anthropic API)
- **Status**: Source files present (`index.ts`, `launchMemoryStores.tsx`, `memoryStoresApi.ts`, `MemoryStoresView.tsx`, `parseArgs.ts`, `__tests__/`), NOT registered in `commands.ts`
- **Root cause**: Registering triggers test failures in `index.test.ts` and `launchMemoryStores.test.ts` due to Bun `mock.module` state leakage. `api.test.ts` (runs first alphabetically) mocks `oauth.js` and `teleport/api.js` with only a subset of exports, leaking to `index.test.ts` which needs `getOAuthHeaders` and `fileSuffixForOauthConfig` from the real modules.
- **Files**: `src/commands/memory-stores/` (6 source files, 4 test files)
- **Reference**: `references/claude-code-main/src/commands/memory-stores/` — same implementation, no feature gate

### `artifacts` — Not wired (no cloud-artifacts domain)
- **Command affected**: `artifacts` (List HTML artifacts uploaded to cloud-artifacts)
- **Status**: Source files present (`index.ts`, `artifacts.tsx`, `ArtifactsMenu.tsx`, `scanner.ts`, `__tests__/`), NOT registered in `commands.ts`
- **Root cause**: Requires a cloud-artifacts domain/upload endpoint. The command displays artifacts uploaded via `artifact` tool_use blocks in the session, but artifacts are uploaded to an external cloud endpoint. Without a configured domain the command would show only locally-extracted tool_use metadata without functional cloud artifact browsing.
- **Files**: `src/commands/artifacts/` (5 source files, 6 tests)
- **Reference**: `references/claude-code-main/src/commands/artifacts/` — same implementation, no feature gate

### `remote-control-server` — Not wired (requires pro/team/max subscription)
- **Command affected**: `remote-control-server` / `rcs` (Start a persistent Remote Control server)
- **Status**: Source files present (`index.ts`, `remoteControlServer.tsx`), NOT registered in `commands.ts`
- **Root cause**: Requires Anthropic pro/team/max subscription for bridge authentication. The command starts a daemon-backed persistent bridge server that accepts multiple concurrent remote sessions. Gated behind `feature('BRIDGE_MODE')` and requires `getBridgeAccessToken()`. Without a valid subscription the bridge token is unavailable.
- **Files**: `src/commands/remoteControlServer/` (2 source files)
- **Reference**: `references/claude-code-main/src/commands/remoteControlServer/` — same implementation

### `schedule` (triggers/cron) — Not wired (requires pro/team/max subscription)
- **Command affected**: `schedule` / `triggers` / `cron` (Schedule periodic tasks via triggers API)
- **Status**: Source files present (`index.ts`, `launchSchedule.tsx`, `parseArgs.ts`, `ScheduleView.tsx`, `triggersApi.ts`, `__tests__/`), NOT registered in `commands.ts`
- **Root cause**: Requires Anthropic pro/team/max subscription for the triggers API endpoint. The command allows scheduling periodic tasks (like `/summary` every 4h) via the Anthropic triggers API. Without a valid subscription the API key is unavailable.
- **Files**: `src/commands/schedule/` (6 source files, 86 tests)
- **Reference**: `references/claude-code-main/src/commands/schedule/` — same implementation

### `vault` — Not wired (requires pro/team/max subscription)
- **Command affected**: `vault` / `vaults` (Manage knowledge vaults via Anthropic API)
- **Status**: Source files present (`index.tsx`, `launchVault.tsx`, `parseArgs.ts`, `vaultsApi.ts`, `VaultView.tsx`, `__tests__/`), NOT registered in `commands.ts`
- **Root cause**: Requires Anthropic pro/team/max subscription for the vaults API endpoint. The command allows browsing, searching, and managing knowledge vaults. Vault data is fetched from the Anthropic vaults API. Without a valid subscription the API key is unavailable.
- **Files**: `src/commands/vault/` (6 source files, 76 tests)
- **Reference**: `references/claude-code-main/src/commands/vault/` — same implementation

## Component Wiring Gaps

### `components/tasks/BackgroundAgentSelector.tsx` — Present but not wired
- **Status**: File exists in `src/components/tasks/`, never imported anywhere
- **Root cause**: Requires multi-system wiring (REPL.tsx, AppState, promptInput)
- **Files**: `src/components/tasks/BackgroundAgentSelector.tsx`
- **Reference**: `references/claude-code-main/src/components/tasks/BackgroundAgentSelector.tsx`

## Pre-existing Integration Test Failures

### `autonomy-lifecycle-user-flow.test.ts` — Build guard: hostGuard.ts stub
- **Status**: Fails during build (build guard exit code 1)
- **Root cause**: `src/services/auth/hostGuard.ts` has an unresolved relative import that gets stubbed to a noop default export during bundling. The build guard catches this and exits with code 1. Requires either adding the real source module or adding the path to `ACCEPTABLE_RUNTIME_STUBS` in `scripts/build.ts`.
- **Files**: `src/services/auth/hostGuard.ts`, `scripts/build.ts`
- **Reference**: `references/claude-code-main/src/services/auth/hostGuard.ts` — check if reference has the same issue

### `dependency-overrides.test.ts` — gaxios v6 API change
- **Status**: 1 test fails: `options.headers.get is not a function`
- **Root cause**: gaxios v6+ passes headers as a plain object, but the test adapter calls `options.headers.get('content-type')`. gaxios v5 used a Headers-like object with `.get()`. The installed version (`gaxios@6.7.1`) changed the header API. Test needs updating to use `options.headers['content-type']` instead of `.get()`.
- **Files**: `tests/integration/dependency-overrides.test.ts:80`
- **Reference**: `references/claude-code-main/tests/integration/dependency-overrides.test.ts` — check if same gaxios version

### `dependency-overrides.test.ts` — streamdown not found (missing remote-control-server package)
- **Status**: 1 test fails: `Cannot find package 'streamdown' from packages/remote-control-server/package.json`
- **Root cause**: `packages/remote-control-server/` directory does not exist locally. The test uses `createRequire` pointing to this package's `package.json` to resolve `streamdown`. Present in reference (`references/claude-code-main/packages/remote-control-server/`) but not ported locally.
- **Files**: `packages/remote-control-server/` (missing), `tests/integration/dependency-overrides.test.ts:110-113`
- **Reference**: `references/claude-code-main/packages/remote-control-server/` — has full package with its own package.json
