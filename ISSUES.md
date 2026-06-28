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
