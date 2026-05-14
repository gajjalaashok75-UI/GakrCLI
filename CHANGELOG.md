# Changelog

All notable changes to GakrCLI will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.5.0] - 2026-05-14 09:35:00 +05:30

### Fixed
- **Package Contents**: Tightened npm package inclusion to ship only the CLI bin entry and removed Windows `Zone.Identifier` metadata plus Python bytecode cache artifacts from release assets.

## [0.5.0] - 2026-05-14 09:05:45 +05:30

### Fixed
- **Logo Palette Spinner Colors**: Applied the selected startup logo palette to runtime spinners while preserving the existing no-progress warning color shift, and added coverage that saved palette choices are used on startup.

## [0.5.0] - 2026-05-14 08:52:52 +05:30

### Fixed
- **Login Provider Setup**: Reused the descriptor-backed provider manager for `/login` third-party setup so it shows the same full provider list as `/provider`, including the newer provider presets.

## [0.5.0] - 2026-05-14 08:19:17 +05:30

### Fixed
- **NVIDIA Provider Authentication**: Hid NVIDIA NIM custom auth-header prompts in `/provider` so saved NVIDIA profiles use the standard `Authorization: Bearer <key>` header instead of accidentally persisting an API key as a header name.
- **Provider Profile Sanitization**: Tightened active and inactive provider profile loading/saving to trim API keys, reject placeholder credentials, and prevent secret-looking values from being saved as base URLs, model names, or custom auth header names.
- **Profile Persistence Coverage**: Added regression coverage for NVIDIA startup profile mirroring, route auth-header UI metadata, secret-like value filtering, and malformed saved provider profiles.

## [0.5.0] - 2026-05-14 07:31:46 +05:30

### Added
- **Startup Logo Palette Picker**: Added `/logo` for selecting the startup logo palette, keeping the existing sky-blue palette as the default and adding alternate palettes.

### Fixed
- **OpenAI Shim Local Providers**: Stripped the OpenAI-only `store` field for local OpenAI-compatible endpoints so strict vLLM, llama.cpp, and custom gateways do not reject chat-completions requests.
- **Plan Mode Text and Paths**: Removed hard-coded assistant branding from plan approval/rejection copy and made the default plans directory resolve to `.gakrcli/plans`.

## [0.5.0] - 2026-05-13 09:46:56 +05:30

### Added
- **Incremental Token Counting**: Added a content-aware `IncrementalTokenCounter` and wired `tokenCountWithEstimation` to reuse cached counts for append-only conversation growth while safely recalculating on edits.

### Fixed
- **Hook Stdin Handling**: Closed hook stdin after the initial JSON payload so prompt submit hooks that read until EOF do not wait for the full hook timeout.

## [0.5.0] - 2026-05-13 09:28:55 +05:30

### Fixed
- **CLI Model Override**: Applied `--model` without `--provider` after saved provider profiles load so startup, resolution, and request payloads use the override for the active provider without writing it to the profile.

## [0.5.0] - 2026-05-13 09:13:54 +05:30

### Added
- **Brave Web Search Adapter**: Added first-class Brave Search support with `BRAVE_API_KEY`, bare `X-Subscription-Token` auth, provider mode selection, and auto-chain inclusion before Bing.

### Fixed
- **Web Search Presets**: Fixed the Brave preset to send a bare token and rewired Google Custom Search to use `?key=` plus `GOOGLE_CSE_ID`/`cx` query params with clear missing-env errors.
- **Exa Snippets**: Requested Exa highlights and mapped returned excerpts into result descriptions so Exa hits no longer return empty snippets.

## [0.5.0] - 2026-05-13 08:54:00 +05:30

### Fixed
- **Effort Persistence**: Normalized OpenAI/Codex `xhigh` selections to the internal `max` effort value so picker and `/effort xhigh` choices survive settings reloads while still displaying as `xhigh`.
- **Chat Completions Reasoning Effort**: Threaded resolved effort into OpenAI-compatible chat-completions requests so direct OpenAI, Codex, and provider override routes send `reasoning_effort` correctly.
- **Effort Clamp**: Preserved `max` for OpenAI/Codex models instead of downgrading it to `high`, while keeping the Anthropic non-Opus `max` clamp intact.

## [0.5.0] - 2026-05-13 08:43:39 +05:30

### Fixed
- **Async Agent Orchestration**: Updated async-launched agent tool result instructions so the main model ends its turn after launching background work unless it has clearly non-overlapping work to continue.
- **Source Map Cleanup**: Removed stray inline `//# sourceMappingURL=data:` comments from TypeScript and TSX sources.

## [0.5.0] - 2026-05-13 08:31:00 +05:30

### Fixed
- **Published CLI Startup**: Replaced the runtime teammate helper `require()` in `AppStateStore` with a static ESM import so Bun inlines `teammate.js` into `dist/cli.mjs` and published npm installs do not resolve a missing `utils/teammate.js` file at startup.

## [0.5.0] - 2026-05-13 08:18:26 +05:30

### Added
- **Provider Model Discovery**: Enabled dynamic `/model` catalog refresh for OpenAI-compatible providers with confirmed model-list endpoints, including OpenAI, OpenRouter, DeepSeek, Groq, Mistral, NVIDIA NIM, Together AI, xAI, MiniMax, Moonshot/Kimi API, Hicap, LM Studio, Atomic Chat, and Ollama.
- **Model Metadata Display**: Normalized discovered model metadata so model picker entries can show clean labels, owners, and context windows when providers return them.
- **Discovery Coverage**: Added regression coverage for OpenAI-compatible model-list parsing, top-level array responses, descriptor discovery wiring, and richer discovered model metadata.

## [0.5.0] - 2026-05-13 07:46:30 +05:30

### Fixed
- **Codex OAuth Browser Sign-In**: Prevented the OAuth browser flow from restarting after successful authorization when React callback identity changes during status updates.
- **Active Provider Startup**: Applied the saved active provider profile during CLI bootstrap so restarts use the last selected provider instead of stale legacy startup profile data.
- **Codex OAuth Profile Persistence**: Persisted Codex OAuth startup profile metadata correctly, including secure-credential markers, so stale NVIDIA startup routing is cleared after switching providers.
- **Model Selection Persistence**: Saved `/model` changes back to the active provider profile and startup profile so restarts keep the last selected model for the active provider.
- **Multi-Model Profiles**: Preserved multi-model provider profile lists while promoting the last selected model to the primary startup model.
- **Documentation**: Reworked the Codex OAuth browser sign-in document with the full flow, storage formats, secure credential loading, profile persistence, browser authorization, and troubleshooting details.

## [0.5.0] - 2026-05-12 20:22:51 +05:30

### Fixed
- **Root Test Suite Stabilization**: Updated the root test script to ignore generated `dist/` output and `references/` fixtures so the active source tests run cleanly.
- **Provider Configuration**: Preserved and refined NVIDIA provider mode while keeping Codex, OpenAI, GitHub, Gemini, Mistral, and other provider routes isolated.
- **Runtime Reliability**: Fixed provider cache partitioning, GakrCLI config path isolation, skills/session test isolation, OAuth refresh handling, shell tool sandbox schema exposure, Firecrawl configuration, auto-fix timeout handling, and token/cache/model helper behavior.
- **CLI and Extension Polish**: Restored rapid text input buffering, LSP tool registration behavior, GakrCLI branding, local installer paths, secure storage naming, and VS Code extension provider environment detection.
- **Coverage**: Added NVIDIA provider regression tests and renamed GakrCLI installer/path/UI coverage from the previous OpenClaude test surfaces.
- **Verification**: Root test suite passes with `bun.cmd run test` (`2343 pass`, `0 fail`).

## [0.5.0] - 2026-05-12 17:43:25 +05:30

### Fixed
- **NVIDIA NIM Provider Profiles**: Fixed saved NVIDIA NIM profiles being ignored at startup when the credential was stored through the OpenAI-compatible profile path.
  - NVIDIA NIM validation now accepts the existing `OPENAI_API_KEY` fallback used by OpenAI-compatible providers.
  - Newly saved NVIDIA NIM profiles also persist the dedicated `NVIDIA_API_KEY` alias for consistency with runtime activation.
  - Added focused regression tests for NVIDIA profile save, load, and validation behavior.

## [0.4.9] - 2025-01-15

### Fixed
- **Windows CLI Input Prompt Hang**: Fixed critical issue where CLI would hang on Windows without displaying input prompt
  - Fixed missing import for `registerKarpathyGuidelinesPlugin` in bundled plugins
  - Fixed incorrect usage of `useManagePlugins` hook in REPL component
  - CLI now properly displays input prompt and accepts user interaction on Windows
- **Plugin Commands Loading**: Fixed undefined plugin commands causing React hook errors
  - Plugin commands now properly loaded from AppState instead of hook return value
  - Resolved "Cannot read properties of undefined (reading 'length')" error

### Added
- **Comprehensive Documentation**: Updated README.md with complete feature documentation
  - Added detailed provider ecosystem table with 10+ supported providers
  - Documented 30+ available tools organized by category
  - Listed 100+ available skills across development, DevOps, AI, and security domains
  - Added 20+ specialized agents for different workflows
  - Comprehensive MCP integration documentation with configuration examples

## [0.4.8] - 2025-01-10

### Fixed
- **Branding Updates**: Updated all OpenClaude references to GakrCLI for consistent branding
- **Provider Profile Detection**: Fixed startup banner to show correct active provider
- **Model Settings**: Normalized model settings and removed duplicate provider entries
- **Test Coverage**: Improved test files and error handling across multiple components

### Added
- **Deterministic Request Serialization**: Added stable JSON serialization for prefix caching
  - Implemented `stableStringify` for consistent request body serialization
  - Improved caching performance for OpenAI-compatible providers
- **OpenAI Responses API Support**: Added support for OpenAI Responses API format
  - Custom authentication header support for non-standard providers
  - Configurable API format selection (Chat Completions vs Responses)
- **Enhanced Error Handling**: Increased error truncation limit from 10KB to 40KB
  - Fixed MCP tool validation and null handling
  - Improved error messages and debugging information

## [0.4.7] - 2024-12-20

### Added
- **Web Landing Page**: New marketing site under `web/` directory
  - Vite + React 19 with responsive design
  - Light/dark theme support with localStorage persistence
  - Feature showcase and installation instructions
- **Wiki Service**: Restored wiki service MVP with local source ingestion
  - `.gakrcli/wiki` scaffold creation with markdown pages
  - Recursive page counting and initialization checks
  - Path validation and security hardening

### Fixed
- **WebSearchTool Provider System**: Complete overhaul with modular provider system
  - Support for 10 search providers (Firecrawl, Tavily, Exa, etc.)
  - Intelligent fallback chain with auto mode
  - Domain filtering and security guardrails
- **Command Registry**: Restored missing reference commands
  - Added `/auto-fix`, `/benchmark`, `/cache-probe`, `/wiki` commands
  - Enhanced GitHub onboarding with token reuse support

## [0.4.6] - 2024-11-15

### Added
- **SDK Foundation**: Added comprehensive SDK building blocks
  - Type declarations and error classes
  - Core schemas with Zod validation
  - Message filters and validation utilities
- **Enhanced Input Handling**: Fixed bash mode entry issues
  - Proper mode character stripping
  - Consolidated mode entry logic

### Fixed
- **Windows PasswordVault**: Avoided legacy Windows PasswordVault reads by default
  - Improved performance and security
  - DPAPI-based storage as primary path
- **Model Capability Caching**: Fixed capability override cache isolation
  - Proper cache invalidation on environment changes
  - Dynamic environment change support

## [0.4.5] - 2024-10-30

### Added
- **Provider Ecosystem Expansion**: Enhanced support for multiple LLM providers
  - Improved OpenAI-compatible provider support
  - Better error handling and fallback mechanisms
- **Tool System Enhancements**: Expanded tool capabilities
  - Enhanced file operations with better diff display
  - Improved shell integration with sandboxing
  - Advanced search and navigation tools

### Fixed
- **Performance Optimizations**: Various performance improvements
  - Reduced startup time
  - Optimized memory usage
  - Better caching strategies

## [0.4.0] - 2024-09-15

### Added
- **MCP Integration**: First-class Model Context Protocol support
  - Built-in MCP servers for file system, Git, databases
  - Dynamic resource loading and management
  - OAuth and API key management for MCP servers
- **Agent System**: Comprehensive agent workflow support
  - 20+ specialized agents (architect, code-reviewer, security-reviewer)
  - Multi-agent collaboration and task delegation
  - Agent routing to different models for cost optimization
- **Plugin Architecture**: Extensible plugin system
  - 100+ bundled skills covering development, DevOps, AI
  - Hot reloading without restart
  - Custom plugin creation and sharing

### Changed
- **Provider System**: Unified provider architecture
  - Support for 10+ LLM providers
  - Consistent authentication and configuration
  - Provider profiles for project-specific settings

## [0.3.0] - 2024-08-01

### Added
- **Multi-Provider Support**: Initial support for multiple LLM providers
  - OpenAI, Anthropic, Gemini, Ollama integration
  - Environment variable configuration
  - Provider switching capabilities
- **Tool System**: Core tool implementation
  - File operations (read, write, edit)
  - Shell command execution
  - Web search and fetch capabilities
- **Terminal UI**: Ink-based terminal interface
  - Streaming output display
  - Interactive command input
  - Real-time token tracking

### Changed
- **Architecture**: Modular architecture implementation
  - Separation of concerns
  - Testable components
  - Extensible design patterns

## [0.2.0] - 2024-07-01

### Added
- **Core CLI Framework**: Basic command-line interface
  - Commander.js integration
  - Configuration management
  - Error handling and logging
- **Provider Integration**: Initial LLM provider support
  - Anthropic Claude integration
  - OpenAI compatibility layer
  - Basic authentication handling

## [0.1.0] - 2024-06-01

### Added
- **Initial Release**: Basic GakrCLI functionality
  - Simple chat interface
  - Basic file operations
  - Configuration system
  - Documentation and setup guides

---

## Release Notes

### Version Numbering
- **Major versions** (x.0.0): Breaking changes, major feature additions
- **Minor versions** (0.x.0): New features, provider additions, significant enhancements
- **Patch versions** (0.0.x): Bug fixes, documentation updates, minor improvements

### Upgrade Instructions
For upgrade instructions and migration guides, see our [documentation](docs/).

### Support
- **Issues**: [GitHub Issues](https://github.com/gajjalaashok75-UI/GakrCLI/issues)
- **Discussions**: [GitHub Discussions](https://github.com/gajjalaashok75-UI/GakrCLI/discussions)
- **Documentation**: [docs/](docs/)
