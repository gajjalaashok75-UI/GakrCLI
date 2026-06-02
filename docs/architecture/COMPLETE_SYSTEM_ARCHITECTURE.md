# GakrCLI Complete System Architecture

This document summarizes the current architecture for GakrCLI `0.5.5` and the VS Code extension `0.2.3`.

## Layers

```text
CLI / SDK core
  -> provider routing
  -> tool execution
  -> MCP and plugins
  -> sessions and transcripts

Hosts
  -> terminal CLI
  -> VS Code extension
  -> SDK consumers

User interfaces
  -> terminal UI
  -> VS Code React webview
  -> custom SDK host UI
```

## CLI And SDK Core

The core package contains:

- provider profile resolution
- model and route metadata
- request execution
- tool definitions
- permission handling
- MCP server integration
- plugin and skill loading
- session persistence
- SDK exports

The SDK is exported as:

```ts
import { query } from '@gakr-gakr/gakrcli/sdk'
```

The SDK bundle is built as `dist/sdk.mjs` and is checked to avoid React/Ink terminal UI leakage.

## VS Code Extension

The native webview path uses:

```text
React webview
  -> VS Code extension host
  -> @gakr-gakr/gakrcli/sdk
```

The extension uses SDK runtime controls for:

- provider and model state
- permission mode
- reasoning effort
- fast mode
- context usage
- autocompact markers
- MCP status
- plugin state
- slash commands
- sessions and history

Terminal fallback uses:

```text
VS Code command
  -> integrated terminal
  -> gakrcli executable
```

## Provider Layer

Provider routes include native, OpenAI-compatible, hosted gateway, cloud, and local providers. The current public provider list is maintained in [../PROVIDERS.md](../PROVIDERS.md).

Provider data comes from:

- `src/integrations/*`
- `src/utils/model/*`
- active provider profiles
- environment variables
- VS Code explicit fallback settings

## Tool Layer

Common tools include:

- file read/write/edit
- grep and glob search
- shell command execution
- web search and fetch
- MCP tools
- plugin tools
- clarification and permission flows

Tools pass through permission checks and emit structured progress/results for hosts.

## Session Layer

Sessions store transcript events and metadata. Hosts can:

- list sessions
- resume sessions
- fork sessions
- rename sessions
- tag sessions
- delete sessions
- replay transcript events into a UI

The VS Code webview normalizes live and resumed sessions so tool rows, titles, compact markers, context state, and assistant turns render consistently.

## Security And Privacy

Publishing and runtime checks focus on:

- no `.env` files in packages
- no local `.gakrcli` state in packages
- no workspace transcripts in packages
- no source maps in VSIX
- no React/Ink leakage into `dist/sdk.mjs`
- explicit permission modes for risky tools
- sandbox-aware Bash handling

Run:

```bash
bun run verify:privacy
npm pack --dry-run
npx @vscode/vsce ls --tree
```

## Publication Versions

- npm package: `@gakr-gakr/gakrcli@0.5.5`
- VS Code extension: `gakrcli-vscode@0.2.3`
- VS Code extension dependency: `@gakr-gakr/gakrcli@^0.5.5`
