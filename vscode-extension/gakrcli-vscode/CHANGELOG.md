# Change Log

All notable changes to the "GakrCLI" extension will be documented in this file.

## [0.2.1-unreleased] - 2026-05-26

### Fixed
- Made chat tool calls render as compact collapsed rows by default, with structured expandable input/output details for file reads, edits, terminal commands, and search-style tools.
- Constrained large tool outputs in the expanded view and replaced noisy completed-tool labels with concise output summaries.

## [0.2.1-unreleased] - 2026-05-26

### Fixed
- Updated Control Center provider status detection for current GakrCLI profiles including xAI OAuth, MiniMax, Mistral, GitHub Models, Bedrock, Vertex, Foundry, and hosted OpenAI-compatible gateways.
- Made chat launches use the same active-workspace selection as the Control Center.
- Added global profile fallback detection for `~/.gakrcli/.gakrcli-profile.json` and `GAKR_CONFIG_DIR/.gakrcli-profile.json` when the workspace profile is absent.
- Updated repository and setup links to the current GakrCLI repository.

## [0.2.0] - 2026-04-21

### Added
- Real Control Center status in the Activity Bar
- Project-aware launch behavior
- Chat panel with webview support
- Session management for chat interactions
- Diff viewer for code changes
- Built-in dark theme: GakrCLI Terminal Black
- Permission mode configuration (default, acceptEdits, bypassPermissions, plan)
- Keyboard shortcut (Ctrl+Shift+L / Cmd+Shift+L) for opening chat

### Features
- Launch GakrCLI from active editor's workspace
- Launch in workspace root
- Open workspace profile
- Quick access to repository and setup guide
- Provider status detection from workspace profile
- Terminal integration with custom environment variables

## [0.1.0] - Initial Release

### Added
- Basic GakrCLI terminal integration
- Command palette commands
- Configuration settings
