# GakrCLI Documentation

This directory is the structured documentation entry point for the GakrCLI CLI, SDK, provider system, integrations, and VS Code extension.

## Start Here

| Document | Purpose |
| --- | --- |
| [../README.md](../README.md) | Main project overview, install steps, features, SDK summary, and release notes. |
| [quick-start-windows.md](quick-start-windows.md) | Windows install and first-run guide. |
| [quick-start-mac-linux.md](quick-start-mac-linux.md) | macOS and Linux install and first-run guide. |
| [non-technical-setup.md](non-technical-setup.md) | Plain-language setup for non-developer users. |
| [QUICK_START_INTEGRATION.md](QUICK_START_INTEGRATION.md) | Combined CLI and VS Code extension quick start. |

## Core References

| Document | Purpose |
| --- | --- |
| [PROVIDERS.md](PROVIDERS.md) | Current provider presets, credentials, endpoints, and examples. |
| [advanced-setup.md](advanced-setup.md) | Source builds, Bun workflows, provider profiles, diagnostics, and runtime control. |
| [GAKRCLI_SDK.md](GAKRCLI_SDK.md) | Public SDK import path, query APIs, session APIs, permissions, MCP, and host controls. |
| [context-building.md](context-building.md) | How GakrCLI builds and manages context. |
| [hook-chains.md](hook-chains.md) | Hook configuration and execution flow. |
| [codex-oauth-browser-sign-in.md](codex-oauth-browser-sign-in.md) | Browser sign-in flow documentation. |
| [litellm-setup.md](litellm-setup.md) | LiteLLM setup guidance. |

## Architecture

| Document | Purpose |
| --- | --- |
| [architecture/COMPLETE_SYSTEM_ARCHITECTURE.md](architecture/COMPLETE_SYSTEM_ARCHITECTURE.md) | Current high-level architecture for CLI, SDK, provider routing, tools, sessions, and VS Code. |
| [architecture/project-structure.md](architecture/project-structure.md) | Repository folder and file map for maintainers. |
| [architecture/integrations.md](architecture/integrations.md) | Integration architecture and descriptor flow. |
| [SYSTEM_FLOW_DIAGRAMS.md](SYSTEM_FLOW_DIAGRAMS.md) | Text flow diagrams for major runtime paths. |
| [self-improvement-architecture.md](self-improvement-architecture.md) | Self-improvement and feedback architecture. |

## Build And Feature Flags

| Document | Purpose |
| --- | --- |
| [build/README.md](build/README.md) | Build documentation entry point. |
| [build/feature-flags-overview.md](build/feature-flags-overview.md) | How build-time feature flags work. |
| [build/feature-flags-reference.md](build/feature-flags-reference.md) | Full reference for current `scripts/build.ts` feature flags. |
| [build/kairos-and-internal-flags.md](build/kairos-and-internal-flags.md) | Kairos, assistant mode, and private/incomplete flag notes. |
| [build/feature-flag-change-checklist.md](build/feature-flag-change-checklist.md) | Checklist for safely changing build flags. |

## Integrations

| Folder/File | Purpose |
| --- | --- |
| [integrations/overview.md](integrations/overview.md) | Integration system overview. |
| [integrations/reference-samples.md](integrations/reference-samples.md) | Reference descriptor examples. |
| [integrations/common-pitfalls.md](integrations/common-pitfalls.md) | Common integration mistakes and fixes. |
| [integrations/glossary.md](integrations/glossary.md) | Integration terminology. |
| [integrations/how-to/](integrations/how-to/) | Step-by-step guides for adding vendors, gateways, models, Anthropic proxies, and usage support. |

## VS Code Extension

The extension has its own docs under [../vscode-extension/gakrcli-vscode/docs/](../vscode-extension/gakrcli-vscode/docs/).

| Document | Purpose |
| --- | --- |
| [../vscode-extension/gakrcli-vscode/README.md](../vscode-extension/gakrcli-vscode/README.md) | Extension overview, install, features, settings, and development commands. |
| [../vscode-extension/gakrcli-vscode/docs/USER_GUIDE.md](../vscode-extension/gakrcli-vscode/docs/USER_GUIDE.md) | User workflow guide for the native webview and terminal mode. |
| [../vscode-extension/gakrcli-vscode/docs/REFERENCE.md](../vscode-extension/gakrcli-vscode/docs/REFERENCE.md) | Commands, keybindings, settings, views, and package structure from the extension manifest. |
| [../vscode-extension/gakrcli-vscode/docs/ARCHITECTURE.md](../vscode-extension/gakrcli-vscode/docs/ARCHITECTURE.md) | Extension runtime architecture. |
| [../vscode-extension/gakrcli-vscode/docs/PUBLISHING.md](../vscode-extension/gakrcli-vscode/docs/PUBLISHING.md) | Extension release checklist. |

## Maintenance Notes

- Keep version references aligned with root [../package.json](../package.json) and extension [../vscode-extension/gakrcli-vscode/package.json](../vscode-extension/gakrcli-vscode/package.json).
- Provider docs should match generated integration artifacts from `src/integrations/generated/integrationArtifacts.generated.ts`.
- SDK docs should match `src/entrypoints/sdk.d.ts` and the SDK tests under `tests/sdk/`.
- Extension command, keybinding, and setting docs should match `vscode-extension/gakrcli-vscode/package.json`.
