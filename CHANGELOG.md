# Changelog

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
