# GakrCLI VS Code Architecture

This document describes the extension architecture for version 0.2.3.

## Native Webview Flow

```text
React webview
  -> VS Code postMessage bridge
  -> extension host controllers
  -> @gakr-gakr/gakrcli/sdk Query/session runtime
  -> GakrCLI tools, provider router, MCP, plugins, sessions
```

The extension no longer needs a child-process NDJSON wrapper for the native webview flow. It imports the SDK and uses runtime-control methods to read and mutate:

- provider and model state
- permission mode
- reasoning effort
- fast mode
- context usage
- slash commands
- MCP server status
- plugin state
- session and transcript state

## Terminal Flow

Terminal mode remains available:

```text
VS Code command
  -> integrated terminal
  -> gakrcli executable
```

Use terminal mode when you want the classic CLI UI or need to debug provider environment variables directly.

## Webview State

The webview stores only UI state needed for rendering. Sensitive provider secrets are not written into webview state. Secrets should live in:

- environment variables
- VS Code settings secret storage where applicable
- OS credential storage
- GakrCLI provider profiles

## Packaging

The VSIX package includes compiled extension code, compiled webview assets, resources, schema files, README, changelog, and license.

`.vscodeignore` excludes:

- TypeScript source
- webview source
- tests
- docs
- local `.vsix` files
- `node_modules` from development folders
- maps and local SDK bundles
- workspace/user config directories

Docs are kept in the repository but intentionally excluded from the VSIX package.

## Runtime Dependency

The extension declares `@gakr-gakr/gakrcli` as a dependency. During source-checkout development it can prefer the local root SDK build; packaged extensions use the dependency bundled through npm.

For this release:

- GakrCLI root package: `0.5.5`
- VS Code extension: `0.2.3`
- Extension dependency: `@gakr-gakr/gakrcli@^0.5.5`

## Important Files

| Path | Purpose |
| --- | --- |
| `src/extension.ts` | Extension activation and command registration. |
| `src/webview/` | Webview managers, bridge, runtime integration. |
| `src/auth/authManager.ts` | Provider definitions and environment construction. |
| `webview/src/components/chat/ChatPanel.tsx` | Main chat/composer UI. |
| `webview/src/hooks/useChat.ts` | Webview chat state and SDK message handling. |
| `webview/src/utils/` | Tested webview transformation helpers. |
| `resources/` | Marketplace icon and walkthrough markdown. |
| `gakrcli-settings.schema.json` | JSON schema contribution for GakrCLI settings. |
