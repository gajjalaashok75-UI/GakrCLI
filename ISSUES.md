# Known Issues

## Inactive Feature Flags

### `UDS_INBOX` — Unix Domain Socket inter-session messaging
- **Tool affected**: `ListPeersTool`
- **Status**: Intentionally disabled in both dev and build modes
- **Root cause**: Causes Node.js process to hang after build (`scripts/defines.ts` comment: "构建后 nodejs 环境卡住")
- **Files**: `scripts/build.ts:46` — `UDS_INBOX: false`; `scripts/defines.ts:68` — commented out from `DEFAULT_BUILD_FEATURES`
- **Tool wiring**: `ListPeersTool` is fully implemented and registered in `src/tools.ts` behind `feature('UDS_INBOX')`, but the flag is always false
