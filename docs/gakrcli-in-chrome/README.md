# GakrCLI in Chrome

Browser automation for GakrCLI — navigate pages, execute JavaScript, read console logs and network requests, capture screenshots, record GIFs, fill forms, and more.

## Quick Summary

| Aspect | Detail |
|--------|--------|
| **npm package** | `@gakr-gakr/gakrcli-for-chrome-mcp` v0.1.0 |
| **MCP server name** | `gakrcli-in-chrome` |
| **Chrome extension** | `@gakr-gakr/chrome-extension` (built from `packages/chrome-extension/`, GakrCLI-owned, no subscription required) |
| **Native host** | `com.gakr.chrome.bridge` |
| **Default transport** | Unix socket → Native messaging host → Chrome extension |
| **Alternative transport** | WebSocket bridge (for remote Chrome) |
| **Auth** | None — extension and MCP server are both open-source MIT |
| **CLI flags** | `--gakrcli-in-chrome-mcp`, `--chrome-native-host` |
| **Slash command** | `/chrome` (interactive TUI menu) |
| **Skill** | `gakrcli-in-chrome` (bundled, gated by subscription) |
| **Tools** | **17 MCP tools** across 6 categories |

---

## Architecture

```
User's Terminal                          Chrome Browser
┌──────────────────┐     ┌──────────────────────────────┐
│   GakrCLI CLI     │     │     Chrome Extension          │
│                    │     │  (Claude in Chrome)           │
│  ┌──────────────┐  │     │                               │
│  │ MCP Client    │──┼──▶ │  ┌──────────────────────────┐ │
│  │ (client.ts)   │  │     │  │ Extension (background)   │ │
│  └──────┬───────┘  │     │  │ • Native messaging host   │ │
│         │          │     │  │ • Tool execution          │ │
│  ┌──────┴───────┐  │     │  │ • Tab management          │ │
│  │ gakrcli-in-  │  │     │  └──────────────────────────┘ │
│  │ chrome MCP   │◀─┼────│           ▲                    │
│  │ Server        │  │     │           │                    │
│  │ (mcpServer.ts)│  │     │  ┌───────┴────────┐          │
│  └──────┬───────┘  │     │  │ Browser (DOM)   │          │
│         │          │     │  │ Console / Network│          │
│  ┌──────┴───────┐  │     │  └────────────────┘          │
│  │ Native Host   │  │     └──────────────────────────────┘
│  │ (chromeNative │──┼────▶
│  │  Host.ts)     │  │     Unix Socket / Native Messaging
│  └──────────────┘  │
└──────────────────┘

           OR (Remote)

┌──────────────────┐     ┌──────────────────────────────┐
│   GakrCLI CLI     │     │   Remote Chrome (different   │
│                    │     │   machine / network)         │
│  ┌──────────────┐  │     │                               │
│  │ WebSocket     │──┼────│─ WebSocket Bridge ──────────▶ │
│  │ Bridge Client │  │     │  (bridge.gakrcliusercontent  │
│  └──────────────┘  │     │   .com)                       │
└──────────────────┘     └──────────────────────────────┘
```

### Three Transport Modes

| Mode | When to Use | Class |
|------|-------------|-------|
| **Unix Socket (Single)** | Local Chrome, single profile | `McpSocketClient` |
| **Socket Pool (Multi)** | Local Chrome, multiple profiles | `McpSocketPool` |
| **WebSocket Bridge** | Remote Chrome (different machine/network) | `BridgeClient` |

---

## 17 MCP Tools

### Navigation & Tabs

| Tool | Description |
|------|-------------|
| `navigate` | Navigate to a URL. Returns the page title and URL after navigation completes. |
| `tabs_context_mcp` | List all open tabs across windows with their IDs, titles, and URLs. |
| `tabs_create_mcp` | Open a new tab with a specific URL. |
| `resize_window` | Resize the browser window to specified width and height. |
| `switch_browser` | Switch between different browser profiles. |

### Page Interaction

| Tool | Description |
|------|-------------|
| `read_page` | Read the accessibility tree of the current page to understand its structure. |
| `find` | Find an interactive element on the page using natural language description. Returns the element's center coordinates. |
| `form_input` | Fill a form field with a value by describing the field in natural language. |
| `get_page_text` | Get the visible text content of the current page. |

### JavaScript & Debugging

| Tool | Description |
|------|-------------|
| `javascript_tool` | Execute arbitrary JavaScript in the page context. Returns the result as a string. |
| `read_console_messages` | Read recent console.log/warn/error messages from the page. |
| `read_network_requests` | Read network request logs filtered by type (XHR, JS, CSS, img, etc.). |

### Computer Control

| Tool | Description |
|------|-------------|
| `computer` | Mouse and keyboard actions: click, double-click, right-click, hover, type text, scroll, screenshot. |

### Media & Recording

| Tool | Description |
|------|-------------|
| `gif_creator` | Create a GIF recording from a specified area of the page. |
| `upload_image` | Upload an image to a file input on the page. |
| `update_plan` | Set the plan for recording feature. |

### Workflow Shortcuts

| Tool | Description |
|------|-------------|
| `shortcuts_list` | List available keyboard shortcuts for the extension. |
| `shortcuts_execute` | Execute a keyboard shortcut by name. |

---

## Package: `@gakr-gakr/gakrcli-for-chrome-mcp`

The npm package published at v0.1.0 provides:

### Exports

```typescript
// Core MCP server factory
createGakrCLIForChromeMcpServer(context: GakrCLIForChromeContext): Server

// Transport creators
createChromeSocketClient(context): McpSocketClient
createBridgeClient(config: BridgeConfig): BridgeClient

// Tool definitions
BROWSER_TOOLS: Tool[]  // Array of 17 MCP tool definitions

// Types
GakrCLIForChromeContext  // Context with logger, socket paths, OAuth, etc.
PermissionMode           // 'ask' | 'skip_all_permission_checks' | 'follow_a_plan'
BridgeConfig             // WebSocket bridge configuration
SocketClient             // Socket client interface
Logger                   // Logger interface
ChromeExtensionInfo      // Extension info type

// Utilities
localPlatformLabel()     // Returns the current platform label
toLoggerDetail()        // Converts log detail level
```

### Source Files

| File | Purpose |
|------|---------|
| `src/index.ts` | Entry point — re-exports all public API |
| `src/types.ts` | All TypeScript types and interfaces |
| `src/mcpServer.ts` | MCP server factory — creates the server, registers tool handlers |
| `src/browserTools.ts` | 17 MCP tool definitions with JSON Schema inputs |
| `src/toolCalls.ts` | Tool call handler — dispatches to socket client with permission checks |
| `src/mcpSocketClient.ts` | Unix socket client — connects to Chrome native messaging host |
| `src/mcpSocketPool.ts` | Multi-profile socket pool — routes by tab ID |
| `src/bridgeClient.ts` | WebSocket bridge client — remote Chrome connection |

---

## Codebase Wiring

### Registration Points

| Layer | File | Registration |
|-------|------|-------------|
| **Command** | `src/commands.ts:281` | `chrome` command (interactive `/chrome` menu) |
| **Skill** | `src/skills/bundled/index.ts:57` | `registerGakrCLIInChromeSkill()` — registers `gakrcli-in-chrome` skill |
| **Skill gate** | `src/skills/bundled/gakrcliInChromeAccess.ts` | `shouldEnableGakrCLIInChromeSkill()` — checks subscription + auto-enable |
| **CLI entry** | `src/entrypoints/cli.tsx:359` | `--gakrcli-in-chrome-mcp` flag starts MCP subprocess |
| **CLI entry** | `src/entrypoints/cli.tsx:366` | `--chrome-native-host` flag starts native host |
| **MCP server** | `src/services/mcp/client.ts:947` | Dynamic import to start in-process MCP server |
| **MCP config** | `src/services/mcp/config.ts:637` | Blocks `gakrcli-in-chrome` as reserved server name |
| **Notification** | `src/hooks/useChromeExtensionNotification.tsx` | Startup notification for extension status |

### Integration Files (src/utils/gakrcliInChrome/)

| File | Purpose |
|------|---------|
| `common.ts` | Browser detection (7 Chromium browsers), socket paths, `openInChrome()`, tab tracking |
| `chromeNativeHost.ts` | Native messaging host — Unix socket server, Chrome message protocol |
| `mcpServer.ts` | MCP server integration — creates `GakrCLIForChromeContext`, starts server |
| `setup.ts` | Setup — extension detection, native host manifest installation, wrapper scripts |
| `setupPortable.ts` | Portable extension detection for both TUI and VS Code |
| `startup.ts` | Startup mode resolution — `disabled`/`explicit`/`auto` |
| `prompt.ts` | System prompts for browser automation behavior |
| `toolRendering.tsx` | Custom Ink UI rendering for each chrome tool |
| `startup.test.ts` | Tests for startup mode logic |

### CLI Files

| File | Purpose |
|------|---------|
| `src/commands/chrome/chrome.tsx` | `/chrome` TUI command — interactive menu |
| `src/components/gakrcliInChromeOnboarding.tsx` | First-run onboarding dialog |
| `src/hooks/useChromeExtensionNotification.tsx` | Startup notification for extension detection |

---

## How to Use

### Prerequisites

1. Install the **Claude in Chrome** extension from [Chrome Web Store](https://chromewebstore.google.com/detail/claude/fcoeoabgfenejglbffodgkkbkcdhcgfn)
2. Have an active **Claude subscription** (required by the extension)
3. Sign in to the extension with your Claude account

### Automatic Setup

GakrCLI detects the extension automatically on startup. If detected:
- The `gakrcli-in-chrome` skill is auto-enabled
- The native messaging host manifest is installed
- You get a "GakrCLI in Chrome enabled" notification

### Manual Setup via `/chrome` Command

```
> /chrome
```

Opens an interactive menu:
- **Install Chrome extension** — opens the Chrome Web Store page
- **Manage permissions** — configure permission mode
- **Reconnect extension** — re-pair with the extension
- **Enabled by default: Yes/No** — toggle auto-enable

### CLI Flags

```bash
gakrcli --gakrcli-in-chrome-mcp        # Run as Chrome MCP subprocess
gakrcli --chrome-native-host            # Run as native messaging host
gakrcli --no-chrome                     # Disable Chrome integration
```

### Permission Modes

| Mode | Behavior |
|------|----------|
| `ask` (default) | Prompt for confirmation before each tool call |
| `skip_all_permission_checks` | Auto-approve all tool calls |
| `follow_a_plan` | Auto-approve calls within a plan context |

---

## Environment Variables

| Variable | Purpose |
|----------|---------|
| `GAKR_CLI_CHROME` | Force enable/disable (`1`/`0`) |
| `CHROME_EXTENSION_KEY` | Extension key for Chrome Web Store publishing |
| `GAKR_CLI_CHROME_BRIDGE_URL` | Custom WebSocket bridge URL |

---

## Features & Capabilities

### What You Can Do

1. **Browse and navigate** — Tell GakrCLI to visit websites, follow links, fill forms
2. **Debug web pages** — Read console logs, monitor network requests, execute JavaScript
3. **Take screenshots** — Capture full page or element screenshots
4. **Record GIFs** — Create GIF recordings of page interactions
5. **Automate workflows** — Fill forms, click buttons, scrape data
6. **Multi-tab context** — Work across multiple tabs and windows
7. **Remote control** — Connect to Chrome on a different machine via WebSocket bridge

### Use Cases

- **Web scraping** — Navigate pages, extract content, handle dynamic JS-rendered content
- **E2E testing** — Automate browser interactions, verify page states
- **Debugging** — Read console errors, inspect network requests
- **Form automation** — Fill and submit forms across multiple pages
- **Visual verification** — Take screenshots, record GIFs of workflows
- **Research** — Open multiple tabs, extract information across pages

---

## Development

### Local Development

```bash
# Build the package
cd packages/gakrcli-for-chrome-mcp
npm run build

# Run tests
cd packages/gakrcli-for-chrome-mcp
npm test
```

### Publishing

```bash
cd packages/gakrcli-for-chrome-mcp
npm publish --access public
```

### Adding a New Tool

1. Add the tool definition in `browserTools.ts`
2. Add the tool handler in `toolCalls.ts` (in the MCP package)
3. Add the implementation in the `chrome-extension` background (in the extension package)
4. Add custom rendering in `toolRendering.tsx` (in the main app)
5. Update the system prompt in `prompt.ts` if needed

---

## Related Files

| Path | Description |
|------|-------------|
| `packages/gakrcli-for-chrome-mcp/` | Published npm package source |
| `src/utils/gakrcliInChrome/` | Chrome integration logic (9 files) |
| `src/skills/bundled/gakrcliInChrome.ts` | Bundled skill registration |
| `src/skills/bundled/gakrcliInChromeAccess.ts` | Skill access gating |
| `src/skills/bundled/gakrcliInChrome.test.ts` | Skill access tests |
| `src/commands/chrome/` | `/chrome` command (TUI menu) |
| `src/hooks/useChromeExtensionNotification.tsx` | Startup notification |
| `src/components/gakrcliInChromeOnboarding.tsx` | Onboarding UI |
| `src/optionalModules.d.ts` | Type declarations (line 200) |
| `src/services/mcp/client.ts` | Dynamic import (line 947) |
| `src/services/mcp/config.ts` | Reserved server name (line 637) |
| `src/entrypoints/cli.tsx` | CLI flag handlers (line 359, 366) |
| `scripts/build.ts` | Build stubs (removed from stub list) |
