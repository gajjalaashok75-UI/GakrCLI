# Terminal backend (`gakrcli --chrome-extension`)

Spawns a real `gakrcli --chrome` process per terminal session with node-pty and
exposes it to the Chrome side panel over an authenticated WebSocket. The Chrome
MCP / native-messaging path is untouched: that process talks to the native host
on its own socket, exactly as before.

```
Chrome side panel (Vue + xterm.js)
  │  GET /discover  (loopback HTTP, origin-checked)
  ▼
Discovery + WebSocket server (127.0.0.1, port range 64201-64210)
  │  ws://…/terminal?token=…
  ▼
PTY session  →  gakrcli --chrome  →  existing Chrome MCP / native host
```

## HTTP discovery

The extension cannot read files under `~/.gakrcli`, and the native-host
protocol is off limits, so the backend advertises itself over a loopback HTTP
endpoint. The endpoint only hands out connection information; it never carries
terminal input or output.

- Method/path: `GET /discover`
- Bind: `127.0.0.1` only
- Ports: first free port in `64201..64210` (`TERMINAL_DISCOVERY_PORT_BASE` /
  `_ATTEMPTS`); the side panel probes the same range in parallel.
- Success (`200`):

```json
{
  "version": 1,
  "wsPath": "/terminal",
  "token": "<64 hex chars, rotated per backend process>",
  "pid": 12345,
  "startedAt": "2026-01-01T00:00:00.000Z"
}
```

### Security checks

1. **Loopback bind** – no interface other than `127.0.0.1` can reach it.
2. **Host header** – must equal `127.0.0.1:<port the server is bound to>`
   (compared against `req.socket.localPort`), which defeats DNS rebinding: a
   rebound hostname still sends its own `Host`.
3. **Origin** –
   - if `Origin` is present it must equal `chrome-extension://<configured id>`;
   - if it is absent (Chrome omits `Origin` for extension-page fetches made
     with host permissions) the request must carry
     `X-Gakr-Terminal-Origin: chrome-extension://<configured id>`;
   - any request whose `Sec-Fetch-Site` is not `none` is refused, so a web page
     can never reach the token.
4. **No wildcard CORS** – `Access-Control-Allow-Origin` is echoed only for the
   configured extension origin, together with `Vary: Origin`.
5. **No unconfigured fallback** – if no extension id is configured, discovery
   refuses every request instead of allowing any origin (`extension_not_configured`).
6. **Read-only surface** – only `GET /discover` exists; there is no endpoint
   that accepts input.

### Failure behavior

| Condition | Status | Body `error` |
| --- | --- | --- |
| Method other than GET | `405` (`Allow: GET`) | `method_not_allowed` |
| Wrong/missing `Host` | `403` | `invalid_host` |
| No configured extension id | `403` | `extension_not_configured` |
| Origin (or asserted origin) mismatch, or page-initiated request | `403` | `unauthorized_origin` |
| Any path other than `/discover` | `404` | `not_found` |

Error responses are not CORS-readable by other origins and never contain the
token.

## WebSocket protocol

`ws://127.0.0.1:<port>/terminal?token=<token>`

The same `Origin` rule applies at the upgrade. Messages are JSON:

| Direction | Message |
| --- | --- |
| client → server | `{ type: 'init', cols, rows, sessionId? }` |
| client → server | `{ type: 'input', data }` |
| client → server | `{ type: 'resize', cols, rows }` |
| client → server | `{ type: 'ping' }` |
| server → client | `{ type: 'attached', role: 'owner' \| 'observer', sessionId }` |
| server → client | `{ type: 'output', data }` |
| server → client | `{ type: 'history', chunks: [{ ts, data }] }` |
| server → client | `{ type: 'exit', code, signal }` |
| server → client | `{ type: 'error', message }` |
| server → client | `{ type: 'pong' }` |

Rejections before `init` close with `4001` (bad token) or `4003` (bad origin).
Only the owner may write input or resize. Output is buffered and persisted as
NDJSON (rotated at 2 MB, TTL 7 days) so a reconnecting client receives the
scrollback and reattaches to the same PTY instead of spawning a new one.
