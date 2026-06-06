# Project Structure

This map reflects the current repository layout for GakrCLI `0.5.6` and GakrCLI VS Code `0.2.4`.

## Repository Root

| Path | Purpose |
| --- | --- |
| `package.json` | Root npm package metadata for `@gakr-gakr/gakrcli`, scripts, binary entry, SDK export, and publish allow-list. |
| `bin/gakrcli.js` | Published executable shim for the `gakrcli` command. |
| `src/` | CLI, SDK, provider routing, tool runtime, terminal UI, sessions, MCP, plugins, skills, and supporting services. |
| `docs/` | User, SDK, provider, architecture, and integration documentation. |
| `assets/` | Bundled workspace files, agents, skills, rules, and project assets included in the npm package. |
| `scripts/` | Build, diagnostics, provider bootstrap, integration generation, privacy verification, and release support scripts. |
| `tests/` | SDK and build-focused tests. |
| `python/` | Python provider experiments and tests for local/smart routing helpers. |
| `web/` | Vite landing/documentation web app. |
| `vscode-extension/gakrcli-vscode/` | VS Code extension package, source, webview, resources, tests, docs, and VSIX build outputs. |
| `.gakrcli/` | Local GakrCLI workspace state and custom skills. This is intentionally excluded from packages. |
| `.github/` | GitHub workflow and repository automation files. |

## Root Source Layout

| Path | Purpose |
| --- | --- |
| `src/main.tsx` | Interactive terminal application entry and top-level runtime orchestration. |
| `src/commands.ts` | Slash-command registry that combines built-in commands, skills, plugins, workflows, and feature-gated commands. |
| `src/commands/` | Slash-command implementations such as provider, model, mcp, plugins, agents, skills, review, compact, resume, status, and settings flows. |
| `src/entrypoints/` | Published CLI/SDK entrypoints and public SDK type declarations. |
| `src/query.ts`, `src/QueryEngine.ts` | Headless query engine and runtime used by CLI and SDK hosts. |
| `src/tools/` | Tool implementations for file operations, shell, search, MCP, web, tasks, agents, plans, notebook edits, and permissions. |
| `src/services/` | API clients, analytics, compaction, OAuth, provider config, sessions, plugins, settings sync, LSP, and memory services. |
| `src/integrations/` | Provider/vendor/gateway/model descriptors and generated provider artifacts. |
| `src/utils/` | Shared helpers for settings, shell, sandboxing, storage, model/provider profiles, plugins, skills, telemetry, and task output. |
| `src/components/` | Ink/React terminal UI components for dialogs, settings, tasks, tools, status, spinners, and composer behavior. |
| `src/bridge/` | Remote bridge/session transport code for embedded and remote-control flows. |
| `src/grpc/`, `src/proto/` | gRPC and protobuf support. |
| `src/skills/`, `src/plugins/` | Skill loading, bundled skill registration, plugin discovery, and plugin command integration. |
| `src/assistant/`, `src/coordinator/` | Assistant session discovery/history and coordinator worker modes. |

## VS Code Extension Layout

| Path | Purpose |
| --- | --- |
| `vscode-extension/gakrcli-vscode/package.json` | Extension manifest, commands, keybindings, settings, views, walkthroughs, scripts, and dependency on `@gakr-gakr/gakrcli`. |
| `vscode-extension/gakrcli-vscode/src/extension.ts` | Extension activation, command registration, webview creation, terminal fallback, context keys, and high-level wiring. |
| `vscode-extension/gakrcli-vscode/src/webview/` | Extension-host webview managers, bridge, HTML generation, and message protocol. |
| `vscode-extension/gakrcli-vscode/webview/` | React/Vite webview application rendered inside VS Code. |
| `vscode-extension/gakrcli-vscode/src/process/` | Process and NDJSON transport helpers used by terminal or compatibility paths. |
| `vscode-extension/gakrcli-vscode/src/settings/` | CLI executable resolution, provider profile loading, model discovery, and settings sync. |
| `vscode-extension/gakrcli-vscode/src/permissions/` | Permission prompts, persistent allow rules, and request handling. |
| `vscode-extension/gakrcli-vscode/src/diff/` | Proposed diff content providers and accept/reject workflow. |
| `vscode-extension/gakrcli-vscode/src/session/` | Session tracking and sessions sidebar provider. |
| `vscode-extension/gakrcli-vscode/src/mcp/` | IDE-side MCP server support. |
| `vscode-extension/gakrcli-vscode/resources/` | Marketplace icon and walkthrough markdown. |
| `vscode-extension/gakrcli-vscode/docs/` | Extension user, reference, architecture, and publishing docs. |

## Build And Verification Scripts

| Command | Purpose |
| --- | --- |
| `bun run build` | Build the root CLI and SDK bundles. |
| `bun run smoke` | Build and run `node dist/cli.mjs --version`. |
| `bun run test` | Run Bun tests, excluding references and dist. |
| `bun run verify:privacy` | Check package/build output for privacy and package-boundary leaks. |
| `bun run integrations:check` | Verify generated integration artifacts are current. |
| `bun run doctor:runtime` | Run runtime/environment diagnostics. |
| `npm run build` from `vscode-extension/gakrcli-vscode` | Build extension host code and the webview. |
| `npm test` from `vscode-extension/gakrcli-vscode` | Run extension Vitest tests. |
| `npx @vscode/vsce package` | Package the extension as a VSIX. |

## Documentation Ownership

| Functionality | Primary Docs |
| --- | --- |
| Install and first run | `README.md`, `docs/quick-start-*.md`, `docs/non-technical-setup.md` |
| Providers | `docs/PROVIDERS.md`, `docs/advanced-setup.md`, `docs/integrations/` |
| SDK | `docs/GAKRCLI_SDK.md`, `src/entrypoints/sdk.d.ts`, `tests/sdk/` |
| Architecture | `docs/architecture/COMPLETE_SYSTEM_ARCHITECTURE.md`, this file |
| VS Code extension | `vscode-extension/gakrcli-vscode/README.md`, `vscode-extension/gakrcli-vscode/docs/` |
| Publishing | `README.md`, `vscode-extension/gakrcli-vscode/docs/PUBLISHING.md`, `package.json`, `.npmignore`, `.vscodeignore` |
