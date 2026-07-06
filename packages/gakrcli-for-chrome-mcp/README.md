# @gakr-gakr/gakrcli-for-chrome-mcp

MCP server for Chrome browser automation. Provides browser interaction, page debugging, screenshot capture, JavaScript execution, console/network reading, and form automation tools via the [Model Context Protocol](https://modelcontextprotocol.io).

Used by [GakrCLI](https://github.com/gajjalaashok75-UI/GakrCLI) for in-process browser automation.

## Features

**17 MCP tools** across 6 categories:

| Category | Tools |
|----------|-------|
| **Navigation** | `navigate`, `resize_window`, `tabs_context_mcp`, `tabs_create_mcp` |
| **Page interaction** | `read_page` (accessibility tree), `find`, `form_input`, `get_page_text` |
| **JavaScript** | `javascript_tool` — execute JS in page context |
| **Computer control** | `computer` — mouse, keyboard, screenshot, scroll, hover, zoom |
| **Debugging** | `read_console_messages`, `read_network_requests` |
| **Media & workflow** | `gif_creator`, `upload_image`, `shortcuts_list`, `shortcuts_execute`, `update_plan` |

## Transport Modes

The server supports three transport modes for connecting to Chrome:

| Mode | Class | Use Case |
|------|-------|----------|
| **Unix socket** | `McpSocketClient` | Local Chrome native messaging (single profile) |
| **Socket pool** | `McpSocketPool` | Multiple Chrome profiles — routes calls by tab ID |
| **WebSocket bridge** | `BridgeClient` | Remote Chrome extension via WebSocket bridge server |

## Usage

```typescript
import {
  createGakrCLIForChromeMcpServer,
  type GakrCLIForChromeContext,
} from '@gakr-gakr/gakrcli-for-chrome-mcp'

const context: GakrCLIForChromeContext = {
  serverName: 'gakrcli-in-chrome',
  logger: console,
  // Native messaging: provide getSocketPaths callback
  getSocketPaths: () => ['/path/to/chrome/socket'],
  // Or bridge mode: provide bridgeConfig
  // bridgeConfig: { ... }
}

const server = createGakrCLIForChromeMcpServer(context)
await server.connect(transport)
```

### Browser Tool Definitions

Import the tool definitions directly for registration:

```typescript
import { BROWSER_TOOLS } from '@gakr-gakr/gakrcli-for-chrome-mcp'

// BROWSER_TOOLS is an array of MCP tool definitions
// Each has: { name, description, inputSchema }
```

## Architecture

```
┌─────────────────┐     ┌──────────────────┐
│   GakrCLI CLI    │     │  Chrome Extension │
│  (in-process)    │     │  (Native Host)    │
│                  │     │                   │
│  createGakrCLI-  │◄───►│  Unix Socket      │
│  ForChromeMcp-   │     │  or WebSocket     │
│  Server()        │     │                   │
└─────────────────┘     └──────────────────┘
         │
         ▼
   ┌──────────┐
   │ Page DOM │
   │ Console  │
   │ Network  │
   └──────────┘
```

## License

MIT
