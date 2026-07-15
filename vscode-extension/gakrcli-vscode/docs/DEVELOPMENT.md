# Development Guide

## Prerequisites

- Node.js 18+
- npm
- VS Code
- GakrCLI root checkout (for CLI integration)

## Setup

```bash
# Clone
git clone https://github.com/gajjalaashok75-UI/gakrcli-vscode
cd gakrcli-vscode

# Install dependencies
npm install
cd webview && npm install && cd ..

# Build
npm run build
```

## Development Workflow

### Watch Mode

```bash
npm run watch
```

Press `F5` in VS Code to launch an Extension Development Host. Changes to source files trigger auto-rebuild.

### Build Commands

```bash
npm run build          # Full build (extension + webview)
npm run build:extension  # Extension host only
npm run build:webview    # Webview UI only
npm run watch            # Development watch mode
```

### Testing

```bash
npm test              # Run test suite
npm run test:watch    # Watch mode
```

## Project Structure

```
gakrcli-vscode/
├── src/                    # Extension host source (TypeScript)
│   ├── activate.ts         # Entry point
│   ├── auth/               # Provider authentication
│   ├── diff/               # Diff viewer integration
│   ├── permissions/        # Permission system
│   ├── session/            # Session management
│   ├── mcp/                # MCP integration
│   └── utils/              # Utilities
├── webview/                # React webview UI
│   └── src/
│       ├── App.tsx         # Main app
│       ├── components/     # React components
│       └── hooks/          # React hooks
├── dist/                   # Build output
│   ├── extension.js
│   └── webview/
├── docs/                   # Documentation
└── package.json
```

## Key Source Files

| File | Purpose |
|---|---|
| `src/activate.ts` | Extension entry point, wires all modules |
| `src/permissions/permissionHandler.ts` | Permission mode management, dialog routing |
| `src/permissions/permissionRules.ts` | In-memory session rule store |
| `src/diff/diffHandler.ts` | Routes file edit requests to diff or auto-approve |
| `src/diff/diffManager.ts` | Applies file edits and manages diff view lifecycle |
| `src/auth/authManager.ts` | Provider credential management |
| `src/process/processManager.ts` | Spawns and manages CLI child process |
| `src/webviewManager.ts` | Extension-to-webview IPC bridge |
| `webview/src/App.tsx` | Webview main component |
| `webview/src/components/dialogs/PermissionDialog.tsx` | Permission approval UI |
| `webview/src/components/input/ModeSelector.tsx` | Permission mode selector |

## Adding a Feature

1. **Plan**: Understand which layer the feature belongs in (webview UI, extension host, or CLI)
2. **Webview changes**: Edit files in `webview/src/`, add message types to `webview/src/types.ts`
3. **Host changes**: Add message handler in `src/activate.ts`, implement logic
4. **Build**: `npm run build` verifies compilation
5. **Test**: Add tests, `npm test`
6. **Package**: `npm run package` creates `.vsix`

## Packaging

```bash
npm run build
npm run package
```

Creates `gakrcli-vscode-<version>.vsix` in the project root. See [PUBLISHING.md](PUBLISHING.md) for publishing to the marketplace.

## Architecture Overview

The extension is a 3-layer architecture:

1. **Webview** (React + Tailwind) — User interface
2. **Extension Host** (TypeScript) — VS Code integration, permissions, IPC bridge
3. **CLI** (child process) — AI orchestration, tool execution, provider routing

See [ARCHITECTURE.md](ARCHITECTURE.md) for details.
