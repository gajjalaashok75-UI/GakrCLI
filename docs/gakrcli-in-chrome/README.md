# GakrCLI in Chrome

Drive your own Chrome from GakrCLI: navigate, click, fill forms, screenshot,
record GIFs, and read console logs and network requests — in the profile you are
already signed into.

The user-facing guide (install steps, screenshots, troubleshooting) lives at
<https://gakrcli.netlify.app/docs/gakrcli-in-chrome/>; its source is
[`web/src/pages/docs/GakrCLIInChrome.tsx`](../../web/src/pages/docs/GakrCLIInChrome.tsx).

## Pieces

| Piece | Where |
|---|---|
| Extension | `packages/chrome-extension/` (WXT, MV3) |
| Tool contract | `packages/mcp-chrome-shared/src/tools.ts` (`TOOL_SCHEMAS`) |
| Native host | `gakrcli --chrome-native-host` (`src/entrypoints/cli.tsx`) |
| MCP server | `src/utils/gakrcliInChrome/mcpServer.ts` |
| Host socket client | `src/utils/gakrcliInChrome/chromeNativeHostClient.ts` |
| Side-panel terminal backend | `src/utils/gakrcliInChrome/terminalBackend/` |
| Bundle served by the docs site | `web/public/docs/gakrcli-in-chrome/gakrcli-in-chrome.zip` |

The extension owns the tool implementations. The CLI advertises exactly
`TOOL_SCHEMAS`, so the names cannot drift from what the extension dispatches
(`mcpServer.test.ts` asserts the old 18-name surface is not advertised).

## Surfaces

| Command | What it runs |
|---|---|
| `gakrcli --chrome` | In-process MCP server, connected by `services/mcp/client.ts` |
| `gakrcli --gakrcli-in-chrome-mcp` | The same server over stdio, for external MCP clients |
| `gakrcli --chrome-extension` | Terminal backend the Chrome side panel talks to |
| `/chrome` | Status, install steps, and extension-id settings |

`--chrome` and the bundled skill are gated on a gakrcli.ai subscription; the
stdio and terminal-backend servers are not. WSL is not supported.

## Extension id

Chrome derives an unpacked extension's id from its install path, so every
install can have a different id, and the native-messaging manifest's
`allowed_origins` has to name it or Chrome refuses to start the host. Set it
with `/chrome` → **Set Chrome extension ID**, `chromeExtensionId` in
`~/.gakrcli.json`, or `GAKR_CHROME_EXTENSION_ID` (wins over the file). The
`/chrome` dialog and `refreshChromeNativeHostManifest()` rewrite the manifest.

## How a tool call travels

1. The CLI sends `{ requestId, method: 'call_tool', params: { name, args } }`
   over the native-host socket (`com.gakr.chrome.bridge`).
2. The extension runs the tool and answers `{ responseToRequestId, payload }`
   whose `data` is an MCP-shaped `{ content, isError }`.
3. `toToolResult()` forwards that envelope, so an extension-reported error keeps
   its `isError: true` and the payload is not re-encoded as a JSON string.

For the side panel the direction reverses: `gakrcli --chrome-extension` runs a
long-lived terminal backend that binds a loopback HTTP/WebSocket server. The
panel discovers it over HTTP (`GET /discover` on `127.0.0.1:64201-64210`,
origin-gated), then opens an authenticated WebSocket (`/terminal`) and streams
PTY input/output. The backend spawns a real `gakrcli --chrome` under `node-pty`,
so the panel is a terminal, not a chat UI.

## Rebuilding the bundle

```bash
bun run chrome:zip
```

WXT writes `.output/*-chrome.zip`; the script copies it to `web/public/docs/`.
It refuses a build whose manifest has a `key` (that would make every install
share one id) or lacks `nativeMessaging`. `scripts/package-chrome-extension.test.ts`
fails if the committed zip's version no longer matches
`packages/chrome-extension/package.json` or if a tool in `TOOL_SCHEMAS` is
missing from the bundle.
