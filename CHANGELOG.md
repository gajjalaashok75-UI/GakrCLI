# Changelog

All notable changes to GakrCLI will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.5.2] - 2026-05-13 07:46:30 +05:30

### Fixed
- **Codex OAuth Browser Sign-In**: Prevented the OAuth browser flow from restarting after successful authorization when React callback identity changes during status updates.
- **Active Provider Startup**: Applied the saved active provider profile during CLI bootstrap so restarts use the last selected provider instead of stale legacy startup profile data.
- **Codex OAuth Profile Persistence**: Persisted Codex OAuth startup profile metadata correctly, including secure-credential markers, so stale NVIDIA startup routing is cleared after switching providers.
- **Model Selection Persistence**: Saved `/model` changes back to the active provider profile and startup profile so restarts keep the last selected model for the active provider.
- **Multi-Model Profiles**: Preserved multi-model provider profile lists while promoting the last selected model to the primary startup model.
- **Documentation**: Reworked the Codex OAuth browser sign-in document with the full flow, storage formats, secure credential loading, profile persistence, browser authorization, and troubleshooting details.

## [0.5.1] - 2026-05-12 20:22:51 +05:30

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
