# Changelog

## [0.4.4] (2026-04-27)

### Features

* **DeepSeek V4 Support**: Add comprehensive support for DeepSeek V4 models (deepseek-v4-flash, deepseek-v4-pro)
  - Add 1M context window (1,048,576 tokens) for V4 models
  - Add 262K max output tokens (262,144 tokens) for V4 models
  - Add thinking support with reasoning_content preservation
  - Add reasoning_effort normalization (low/medium/high/xhigh → high/max)
  - Update provider preset to default to deepseek-v4-flash
  - Add multi-model string support (deepseek-v4-flash, deepseek-v4-pro, deepseek-chat, deepseek-reasoner)

### Documentation

* Update .env.example with DeepSeek V4 model examples
* Update README.md with DeepSeek V4 agent routing example
* Update docs/advanced-setup.md with V4 model configuration
* Update docs/quick-start-mac-linux.md to use deepseek-v4-flash
* Update docs/quick-start-windows.md to use deepseek-v4-flash

### Bug Fixes

* Fix NVIDIA NIM profile saving issue - profile type now correctly saved as "nvidia-nim" instead of "openai"
* Fix NVIDIA environment variables - now uses NVIDIA_* prefix instead of OPENAI_*
* Fix API key retrieval logic in openaiShim.ts for NVIDIA provider
* Add missing helper functions: looksLikeLeakedReasoningPrefix, shouldBufferPotentialReasoningPrefix, stripLeakedReasoningPreamble
* Add normalizeProfileModel function to extract first model from multi-model strings

### Tests

* Add DeepSeek V4 context window tests
* Add DeepSeek V4 preset tests
* Add DeepSeek V4 multi-model string parsing tests
* Add DeepSeek thinking toggle test

## [0.4.3] (2026-04-26)

### Critical Bug Fixes

* fix LSP reinitialization hang that caused /reload-plugins to block indefinitely
* add 5-second timeout to reinitializeLspServerManager() using Promise.race()
* fix child process shutdown on Windows not responding to graceful termination

## [0.4.2] (2026-04-26)

### Bug Fixes

* fix Windows input handling by skipping early input capture on win32 platform
* prevents REPL from getting stuck waiting for stdin on Windows terminals

## [0.4.1](https://github.com/gakr-gakr/gakrcli/compare/v0.4.0...v0.4.1) (2026-04-26)

### Bug Fixes

* fix lodash-es deprecation warning (update from 4.18.0 to 4.17.21)
* fix async provider validation in interactiveHelpers.tsx
* add fallback strategy to web search tool prompt (use data-extraction skill when web tools fail)

### Features

* verified all 18 providers configured and working
* verified 170+ models available in /model command
* enhanced prompts with tool failure fallback instructions

## [0.4.0](https://github.com/gakr-gakr/gakrcli/compare/v0.3.1...v0.4.0) (2026-04-26)

### Features

* add comprehensive model provider support including NVIDIA NIM, MiniMax, and Mistral providers
* add GitHub native Anthropic API mode for Claude models on Copilot
* enable Buddy companion feature (BUDDY feature flag)
* enable Monitor tool for streaming shell output (MONITOR_TOOL feature flag)
* enable Coordinator mode for multi-agent workflows (COORDINATOR_MODE feature flag)
* add model caching utilities with benchmark support
* add Ollama model discovery with auto-detection
* add OpenAI model discovery for OpenAI-compatible providers
* add support for Codex models with proper authentication
* add memory management with team memory paths
* implement /reload-plugins command with timeout protection

### Bug Fixes

* fix missing MonitorPermissionRequest component
* fix MonitorMcpDetailDialog component for task monitoring
* fix MonitorMcpTask implementation for MCP task handling
* fix VerifyPlanExecutionTool constants and types
* fix cachedMCConfig re-export for microcompact caching
* fix coordinator workerAgent implementation
* fix environment variable naming (GAKR_CODE_* consistent)
* fix memory components stubs for /memory command compatibility

### Build

* enable 18+ additional feature flags in open build configuration
* add FullWidthRow design system component
* copy all missing modules from reference implementation
* fix build errors for all feature-flagged modules
* update providers test suite with proper env var handling
