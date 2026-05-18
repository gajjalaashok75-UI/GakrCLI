# Changelog

All notable changes to GakrCLI will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.5.2] - 2026-05-17

### Added
- **Multi-Format Conversation Exports**: Added export format helpers and coverage for text, Markdown, and JSON transcript exports, including direct filenames, explicit format flags, dialog selection, clipboard export, and file-save flows.
- **Sponsored Spinner Tips**: Added sponsored tip metadata, Atomic Chat and Xiaomi MiMo sponsored tips, frequency settings, scheduler partitioning, and history coverage.
- **Xiaomi MiMo Model Picker**: Added cached Xiaomi MiMo model options with provider detection coverage for MiMo credentials and base URLs.
- **Maintainer Templates**: Added GitHub bug report and feature request issue templates.
- **Regression Coverage and Shared Helpers**: Added focused tests for storage providers, export rendering, abort-signal cleanup, Bash safety checks, OAuth callback bounds, local fast-path provider config, CLI heap settings, shared mutation locking, agent markdown rendering, and extracted keybinding, plugin command, and FileRead tool-name helpers.
- **Provider Setup Hints**: Documented Z.AI, Hicap, self-hosted Firecrawl, and structured token-usage logging environment options in the sample environment file.
- **NVIDIA NIM Model Coverage**: Added current NIM route entries for DeepSeek V4, GLM 5.1, MiniMax M2.7, Nemotron, Mistral, Kimi, and related models, with coverage to prevent duplicate picker IDs.

### Changed
- **Pinned Bun Runtime**: Added the shared `.bun-version` and wired CI and Docker builds to use the repo-tracked Bun version.

### Fixed
- **Windows Bin Import Path**: Normalized Windows drive-letter paths in the CLI bin import helper so built entrypoint URLs are valid across path contexts.
- **Abort Timeout Cleanup**: Replaced raw timeout abort signals across runtime fetch, hook, bridge, shutdown, and updater paths with cleanup-safe combined abort signals.
- **Legacy npm Package Cleanup**: Restored cleanup and doctor checks for the real legacy `@anthropic-ai/claude-code` package while keeping GakrCLI package checks pointed at `@gakr-gakr/gakrcli`.
- **Codex OAuth Callback Settings**: Restored loopback callback host validation and host-aware redirect URI construction for Codex OAuth.
- **Web Fetch Firecrawl Endpoint**: Let Web Fetch use self-hosted Firecrawl endpoints via `FIRECRAWL_API_URL`, matching Web Search behavior.
- **Atomic Chat Provider Tests**: Replaced stale duplicate Ollama coverage with Atomic Chat provider tests adapted for GakrCLI.
- **Shared Mutation Lock Tests**: Restored isolated test mutex helpers so env-mutating tests can exercise timeout behavior without touching global state.
- **Runtime Dependency Metadata**: Declared the `cross-spawn` runtime dependency directly so Windows-safe process spawning is available from package installs.
- **Provider Profile Goal Env**: Corrected startup and session profile loading to honor `GAKR_PROFILE_GOAL` for default model selection.
- **Active Provider Startup Env**: Reapplied active `/provider` profiles after settings env merges and prevented stale legacy profile files from overriding concrete configured provider startup env.
- **Profile File Cleanup**: Added explicit config-directory profile file handling so user config profiles and legacy workspace fallbacks can be cleaned up together without mutating global env.
- **External Validation Noise**: Marked optional telemetry, cloud SDK, and SDK-only externals as intentional so smoke builds no longer warn about dynamic runtime packages missing from `package.json`.
- **xAI Grok Defaults**: Updated xAI provider descriptors, runtime fallbacks, provider flags, and model metadata to use Grok 4.3 as the default while preserving explicit Grok 4 selections.
- **Provider Catalog Constraints**: Switched fixed MiniMax, DeepSeek, Moonshot, and xAI catalogs to static descriptors and stripped unsupported `reasoning_effort` from Groq shim requests.
- **Build Feature Flags**: Switched build-time feature flag replacement to Bun load transforms so smoke/build no longer rewrites source files during bundling.
- **Network Diagnostics Cleanup**: Shared URL query-secret redaction across diagnostics paths, delayed MCP OAuth timeout cleanup until error-body normalization completes, and used the product display name in Web Fetch permission prompts.
- **SDK Test Isolation**: Added shared mutation locks and local TypeScript compiler execution across SDK tests that mutate env, session state, tool schema caches, or package-consumer fixtures.
- **Expired OAuth Hints**: Pointed expired OAuth-token 401s toward `/onboard-github` or `/login` re-authentication instead of generic API-key troubleshooting.
- **Stable JSON Serialization**: Emitted compact sorted request bodies directly, added a strict JSON wrapper for API payloads, and isolated tool-history compression mocks with the shared mutation lock.
- **Codex Strict Schemas**: Inferred missing JSON schema types for Codex Responses tools and dropped orphan required keys so untyped MCP schemas do not fail strict-mode validation.
- **Local Provider Fast Path**: Wired `GAKR_LOCAL_FAST_PATH` into OpenAI-compatible requests so local endpoints can skip cloud-only stable serialization, strict tool rewrites, and tool-history compression.
- **Gemini Tool Signatures**: Replayed real Gemini `thought_signature` metadata by model or base URL and preserved signatures from streaming and non-streaming OpenAI-compatible responses.
- **OpenAI Shim Stream Resilience**: Converted Gemini raw tool-call text into tool-use blocks, surfaced structured in-stream errors, and annotated length-truncated streams.
- **GitHub Native Claude Mode**: Routed GitHub Claude-family models through Anthropic-native requests so prompt caching and `cache_control` blocks remain available.
- **Opengateway Smart Route**: Moved Gitlawb Opengateway defaults to the shared `/v1` endpoint, added the Gemini Flash Lite partner model, and normalized older hosted route URLs.
- **OpenAI Shim Compatibility**: Redacted credentials from transport-error URLs and stripped unsupported `store` fields for Cerebras chat-completion requests.
- **VS Code Extension Packaging**: Added explicit activation events, packaged-file allowlists, and isolated extension module mocks during tests.
- **Agent File Safety**: Prevented non-string agent descriptions from crashing markdown creation and respected loaded agent directories when editing existing agents.
- **Context and Web Test Stability**: Pinned GPT-5.5 to the conservative Codex context window, added prefixed Gemini Flash Lite metadata, and isolated context plus web-tool tests behind the shared mutation lock.
- **API Test Isolation**: Added shared mutation locks around API/provider tests that mutate environment variables, global fetch, module mocks, proxy state, or cache-stat counters.
- **Utility Test Isolation**: Added shared mutation locks and complete module mock factories for utility/provider tests that mutate process env, fetch, settings caches, or Bun module mocks.
- **Model Test Isolation**: Isolated model selection, model discovery, swarm env inheritance, and prompt-shell regression tests that mutate settings, provider mocks, env, or tool methods.
- **Credential Recovery Test Isolation**: Isolated credential, recovery, hook-chain, fast-mode, secure-storage, and prompt-queue tests that mutate process env, module mocks, platform state, or global runtime helpers.
- **Command and UI Test Isolation**: Isolated command, provider-manager, startup-screen, theme, OAuth, feedback, and prompt-input tests that mutate env, app config, global macros, module mocks, or Ink render state.
- **Runtime and Plugin Test Isolation**: Isolated remaining runtime, integration, plugin, MCP, LSP, Bash permission, API client, compact, OAuth, GitHub, and cache tests that mutate env, registries, global macros, module mocks, fetch, axios, or platform state, and capped sandbox auto-allow subcommand fanout while preserving AST-validated chains.
- **Plugin Git Env Sanitization**: Routed marketplace clone, pull, and sparse checkout git subprocesses through the sanitized no-prompt environment builder so unsafe shell variables no longer break plugin updates.
- **Plugin Component Path Hardening**: Rejected plugin command, agent, skill, output-style, and hooks paths that traverse or symlink outside the plugin directory, including nested skill discovery.
- **Tool Error Handling**: Surfaced Web Search adapter failures with actionable provider guidance and normalized single-question AskUserQuestion payloads before schema validation.
- **Provider Diagnostic Coverage**: Added regression coverage for Venice and Xiaomi MiMo route defaults, Xiaomi MiMo credential validation, and shared URL credential-parameter redaction.
- **Provider Route Compatibility**: Restored the Copilot Claude cache metrics bucket name and added coverage for Xiaomi MiMo auth headers, max-token shaping, and Gitlawb Opengateway smart-route normalization.
- **Command and Plugin Hook Safety**: Filtered generated command stubs out of the slash-command registry, deduplicated repeated plugin hook registrations, and restored legacy `.claude` project agent loading with `.gakrcli` precedence.
- **Provider Profile Coverage**: Added Venice and Xiaomi MiMo regression coverage for provider flags, saved profile env mirroring, startup profile persistence, `/provider` summaries, and OpenAI-shim model defaults.
- **Config Directory Migration**: Hard-cut default config paths to `~/.gakrcli`, copied missing legacy `.claude` config homes and global config files forward, and kept legacy fallbacks scoped to failed migrations or explicit `GAKR_CONFIG_DIR` overrides.
- **Runtime Identity Cleanup**: Replaced leftover upstream memory, coordinator, ripgrep, and custom Web Search identity strings with GakrCLI names and `GAKR_*` environment variables, with regression coverage for the prompt surfaces.
- **SDK Package Identity**: Updated SDK consumer type tests, VS Code session discovery, and tool-concurrency tuning to use the GakrCLI package name and `GAKR_*` environment variables, documented the tuning knob in the sample environment file, and cleaned a stale upstream wording note from the landing-page setup guide.
- **Provider Preset Setup Flow**: Restored the streamlined preset model/API-key setup for non-placeholder providers while keeping placeholder endpoints on the full setup form, with OpenAI, MiniMax, and Hicap regression coverage.
- **Conversation Export Wiring**: Connected `/export`, the export dialog, and semantic Markdown/JSON rendering to the multi-format export helpers, including normalized filenames and duplicate-submit guards.
- **Provider Mode Cleanup**: Shared GitHub provider activation cleanup across `/onboard-github` and the provider manager, and cleared stale Mistral, NVIDIA, Bankr, xAI, Venice, MiMo, and OpenAI-compatible auth overrides when provider profiles are saved.
- **Tool Safety Checks**: Restored Bash command validation guards for nested heredoc substitutions and zsh `fc -e` detection, and aligned Web Search permission text with the GakrCLI product name.
- **Provider Env Docs Alignment**: Pointed the strict OpenAI-compatible tool-schema kill switch at the documented `GAKR_DISABLE_STRICT_TOOLS` variable and added the Mistral API-key signup hint to provider bootstrap failures.
- **Maintainer PR Template**: Added a GitHub pull request template for GakrCLI changes and pointed contributor docs at the shared checklist.
- **Bypass Permission Settings**: Honored trusted `permissions.allowBypassPermissionsMode` settings when initializing tool permissions while keeping project settings excluded from enabling bypass mode.
- **Sponsored Tip Scheduling**: Completed sponsored spinner-tip wiring with settings validation, persisted throttling history, scheduler partitioning, and registry inclusion.
- **Settings Runtime Guards**: Moved recursive settings-load and MDM cache state onto GakrCLI global guards and kept the deprecated settings accessor callable during cyclic imports.
- **Tool Failure Loop Guard**: Added a query-loop guard that stops repeated failing tool calls by signature, error category, or path before optional follow-up work runs.
- **Custom Select Focus Stability**: Kept select navigation from resetting when option labels or callbacks get fresh identities and restored initial default focus handling.
- **Tool Reminder Kill Switch**: Honored the documented `GAKR_DISABLE_TOOL_REMINDERS` env var for todo and task reminder attachments.
- **Hook Chain Recovery Wiring**: Dispatched hook-chain recovery rules from failed tool hooks and completed-task hooks, and kept async-rewake hook commands alive across user interrupts.
- **Codex OAuth Startup Profile**: Marked newly saved Codex OAuth profiles as the active startup provider during setup instead of only switching the current session.
- **Rapid Text Input Stability**: Kept regular and Vim text input cursor operations on the live local buffer so fast keystrokes are preserved before delayed parent updates land.
- **Plugin Command Refreshes**: Routed plugin slash commands through the shared command store so reloads update the REPL command list without relying on AppState command snapshots.

## [0.5.2] - 2026-05-16

### Added
- **Hybrid Knowledge Graph Search**: Upgraded persistent project memory with serialized async mutations, JSON/SQLite storage, Orama-backed semantic indexing, recovery for corrupted indexes, and focused stress coverage for concurrent updates.
- **Provider Spinner Tips**: Added rotating tips for `/provider` multi-provider setup and `/onboard-github` GitHub Models onboarding.

## [0.5.1] - 2026-05-16

### Changed
- **Documentation Refresh**: Updated root setup, Android/Termux, provider, VS Code extension, LiteLLM, integration, security, and playbook docs for the current `0.5.1` release, current model defaults, and the `.gakrcli-profile.json` profile path.
- **Safe Run Notes**: Replaced scratch run notes containing real-looking provider tokens with safe reusable build, provider, and validation instructions.

### Fixed
- **VS Code Extension Profile Detection**: Aligned workspace profile detection and tests with the current `.gakrcli-profile.json` filename and switched the extension test script to Bun so the documented test command matches the test mocks.

## [0.5.1] - 2026-05-15 15:35:56 +05:30

### Fixed
- **GitHub Copilot Model Discovery**: Added live Copilot model discovery with required integration headers, filtered disabled-policy/non-chat/internal entries from `/model`, deduplicated discovered API names, hid stale rejected aliases, and clarified labels for dated model variants.
- **GitHub Copilot Session Activation**: Switched the active session model to `github:copilot` immediately after `/onboard-github` so successful onboarding no longer leaves the session on a stale provider model.

## [0.5.1] - 2026-05-15 15:09:17 +05:30

### Fixed
- **GitHub Copilot Onboarding**: Exchanged browser device-flow OAuth tokens for Copilot runtime tokens before saving credentials so GitHub Copilot requests authenticate after `/onboard-github`.
- **GitHub Model Picker**: Let `/model` use the full local Copilot model registry instead of the minimal GitHub gateway catalog so supported Copilot models are selectable.

## [0.5.1] - 2026-05-15 11:32:47 +05:30

### Fixed
- **NVIDIA NIM Provider Defaults**: Replaced the stale `stepfun-ai/step-3.5-flash` NVIDIA fallback with the supported NIM default, healed legacy saved NVIDIA profiles that still contain the old model, and added regression coverage for startup, profile loading, and request resolution.

## [0.5.1] - 2026-05-15 11:09:33 +05:30

### Fixed
- **Web App Construction**: Wired the Get Started, Providers, and Commands pages into the React app shell, removed duplicate navigation links, cleaned corrupted text encoding in web metadata/content, and added responsive styling for the new web pages.

## [0.5.1] - 2026-05-14 10:47:30 +05:30

### Fixed
- **OpenAI-Compatible Reasoning Effort**: Normalized Groq `reasoning_effort` payloads per supported model family, avoided standalone reasoning effort on DeepSeek-compatible thinking routes, and added a one-time retry without `reasoning_effort` for OpenAI-compatible providers that reject the field.

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
- **Coverage**: Added NVIDIA provider regression tests and renamed GakrCLI installer/path/UI coverage from the previous upstream test surfaces.
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
- **Branding Updates**: Updated legacy branding references to GakrCLI for consistent naming
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
