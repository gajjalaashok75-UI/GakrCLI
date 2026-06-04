# Changelog

All notable changes to GakrCLI will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [unreleased - 0.5.6]

### Added (2026-06-03)
- **OpenClaw-Style Workspace Persistence**: Added root workspace files under `~/.gakrcli/workspace/` for GakrCLI identity, rulebook, soul, user profile, tools, memory, dreams, heartbeat, and first-run bootstrap context.
- **Workspace Location Metadata**: Added canonical `~/.gakrcli/workspace/<file>` location and update-target guidance to every packaged workspace file so model-driven updates can route durable facts to the right file.

### Changed (2026-06-03)
- **Workspace And Project Memory Routing**: Moved project memory under `~/.gakrcli/workspace/projects/<project>/memory/` while keeping root `MEMORY.md` as global cross-project memory.
- **Bootstrap Completion Flow**: Kept `BOOTSTRAP.md` as a first-run-only context file and added startup cleanup when identity setup was completed but bootstrap deletion was missed.
- **Release Versions**: Bumped GakrCLI to `0.5.6` and the VS Code extension to `0.2.4`.

### Added (2026-06-03)
- **Context Building Test Coverage**: Added 22 unit tests for workspace context priority ordering (`WORKSPACE_CONTEXT_FILE_ORDER`), `renderWorkspaceContext` output structure, HTML comment stripping, and `parseMemoryFileContent` frontmatter/globs/contentDiffersFromDisk handling in `src/utils/gakrclimd.test.ts`.
- **Internal Helpers Exported for Testing**: Exported `WORKSPACE_CONTEXT_FILE_ORDER`, `compareWorkspaceFiles`, `renderWorkspaceContext`, and `parseMemoryFileContent` from `src/utils/gakrclimd.ts` to enable direct unit verification of context-building internals.
- **Memory Extraction Prompt Overhaul**: Added concise 10-turn parallel directive, workspace routing, per-file ~50 KB cap, MEMORY.md index line-cap guard, absolute path requirements, TEAMMEM flag check, and frontmatter schema example to extraction prompt in `src/services/extractMemories/prompts.ts`.
- **Raised Auto-Update Budget**: Increased `maxTurns` from 5 to 10 in `src/services/extractMemories/extractMemories.ts` to support parallel multi-file writes (up to 10 files) across workspace and project memory in a single extraction run.
- **Doubled MEMORY.md Index Truncation Limits**: Raised `MAX_ENTRYPOINT_LINES` from 200 to 400 and `MAX_ENTRYPOINT_BYTES` from 25 KB to 50 KB in `src/memdir/memdir.ts` for richer project `MEMORY.md` index content. Workspace-root `MEMORY.md` remains uncapped as cross-project memory; per-file topic entries still advise ~50 KB max.
- **Context Building Documentation**: Documented the exact context shared by the main agent and the auto-update memory fork, including inherited system/user context, parent message prefix, isolated tool state, transcript skipping, and memory-safe tool restrictions.

### Changed (2026-06-04)
- **Semantic Memory Storage Only**: Removed dated session memory/log guidance from the main memory prompt, KAIROS assistant-mode memory prompt, extraction prompt, and auto-dream consolidation prompt. Memory updates now target semantic topic files plus the appropriate `MEMORY.md` index only.
- **Open-Build KAIROS Activation**: Enabled the KAIROS build flag for local assistant-mode startup, added open-build assistant/gate/session-discovery shims, kept remote assistant session attachment out of the open-build startup path, and covered forced mode plus unavailable cloud discovery with focused tests.
- **Runtime Wiring And Verification**: Wired the new open-build KAIROS, permission-mode, provider routing, semantic memory, settings watcher, skill watcher, auto-compact, and VS Code runtime changes together with focused regression coverage and full-suite verification.
- **VS Code Test Runtime Compatibility**: Added a shared VS Code compatibility loader so extension unit tests can exercise runtime modules without depending on the real `vscode` host module.

## [unreleased - 0.5.5]

### Fixed (2026-06-01)
- **Edit Tool Anchored Deletions**: Normalized unique anchored deletion edits so stale surrounding anchors do not break safe block removals, while still rejecting ambiguous duplicate deletion targets.
- **VS Code Markdown List Markers**: Restored visible unordered, ordered, and nested list markers in assistant markdown output after Tailwind's base reset removed default bullets.
- **VS Code Context Meter Placement**: Moved the live context usage indicator from the input toolbar into the lower composer control row beside permission, provider, and Fast mode controls.
- **Edit Tool Indentation Matching**: Allowed unique multiline edit targets to match when only leading indentation differs, preventing brittle HTML/CSS replacement failures while still refusing ambiguous relaxed matches.
- **VS Code Context Meter And Bash Stability**: Preserved the last known live context value across empty SDK refreshes and guarded sandbox stderr annotation so Bash results keep working when the sandbox runtime does not expose its optional helper.
- **VS Code Live Context Meter Refresh**: Kept the composer context meter updating from SDK runtime usage and local SDK token estimates when full context analysis is unavailable, and replaced the native title tooltip with a glass hover panel and fill-line meter.
- **VS Code Context Meter And Autocompact UI**: Added a live SDK-backed composer context meter between model and reasoning controls, kept pending context data visible while refreshing, and rendered compacting/compacted transcript dividers from SDK status and compact-boundary events.
- **VS Code Live Chat Title**: Derived a live header title from the first visible user prompt while new sessions are still waiting for host/session title updates, matching resumed chat titles.
- **VS Code Live Session Parity**: Matched live webview chats to resumed history by hiding unresolved stopped tool placeholders and deriving the header title immediately from the first visible user prompt.
- **VS Code Codex-Style Tool Rows**: Tightened webview tool-row spacing, headers, borders, and expanded detail heights so collapsed and opened tool results take less vertical space.
- **VS Code Tool Details And Copy Actions**: Bounded expanded tool input panels with their own scroll area and moved assistant copy actions to the end of each assistant turn, copying the full turn text instead of each intermediate text fragment.
- **VS Code Tool Transcript Density**: Paired tool calls with their matching results inside one expandable webview row, keeping command/result details hidden until clicked while preserving compact previews for hover and scan.
- **VS Code Hidden Thinking Display**: Hid streamed and resumed thinking blocks from the GakrCLI webview transcript while keeping a compact shining thinking indicator active during hidden reasoning, reducing long-scroll conversations around tool use.
- **SDK And VS Code Session Persistence**: Kept SDK transcript writes inside the query-scoped async context, forced fresh SDK sessions to use the workspace transcript directory, and refreshed VS Code chat titles/history from live SDK user/result events.
- **SDK Headless Permission Flow**: Kept forced `ask` decisions on the SDK host-permission path instead of returning an unresolved ask decision to the tool runner, so interactive tools such as `AskUserQuestion` can receive webview answers through `canUseTool`/`onPermissionRequest`.
- **SDK Session Transcript Routing**: Reset the SDK transcript file pointer immediately after session resolution so new in-process VS Code turns write under the active workspace session directory instead of reusing a stale process-cwd transcript path.
- **SDK Slash Command Registry**: Loaded the canonical CLI slash command registry into headless SDK runtime snapshots and query processing, deduping hidden/model-only commands so VS Code can show the full command menu without local fallbacks.
- **SDK Early Runtime Snapshot Stability**: Guarded headless runtime state reads before config initialization and treated stubbed plugin command stores as empty, preventing VS Code startup from reporting crashed/connection lost during SDK initialize.
- **VS Code Session History And Fast Mode**: Recovered misplaced SDK transcripts by matching recorded JSONL `cwd` to the open workspace, refreshed history on demand, normalized Fast mode from both SDK string and object states, and routed extension permission decisions through an explicit SDK `canUseTool` callback.
- **VS Code Chat Hover And Fast Mode State**: Scoped stop-generation hover actions to the actively streaming assistant turn, kept completed turns on copy-only hover, and preserved the user's Fast mode toggle across per-turn runtime/result updates.

## [released - 0.5.4]
### Fixed (2026-05-31)
- **VS Code Resume And Fast Mode State**: Restored result records during resumed chat replay so per-turn completion text survives session reloads, and synced Fast mode from SDK runtime settings snapshots after webview toggles.
- **VS Code Clarification Dialog**: Changed AskUserQuestion/clarification prompts to a one-question stepper with scrollable content and pinned Skip, Back, Next, and Submit actions.
- **VS Code AskUserQuestion Routing**: Treated `AskUserQuestion` as a clarification flow instead of a tool permission prompt, rendering the question fields in the webview and returning collected answers through the SDK permission response path.

### Changed (2026-05-30)
- **VS Code Permission Prompt Reliability**: Routed pending-permission status through the real permission dialog lifecycle, added a webview fallback for SDK tool permission requests, and cleared pending permission UI/status on stop, restart, session changes, and shutdown.
- **VS Code Runtime Refresh And Stop Polish**: Added a header refresh button that restarts the SDK runtime while preserving the current session, kept startup in Starting until provider/model state hydrates, and folded stopped-turn interruption/duration UI into the assistant turn so the cursor and copy action settle correctly.
- **VS Code Stop And Model Picker Fixes**: Made the webview stop button render the GakrCLI interruption prompt immediately and allowed provider model discovery to enrich SDK runtime state instead of stopping at a single fallback model.
- **VS Code Interrupt Prompt Parity**: Added the terminal-style `Interrupted · What should Gakr do instead?` row for user-stopped webview turns while keeping the turn completion duration after the interruption.
- **VS Code Turn Completion UI**: Replaced the chat footer cost/token pill with the GakrCLI-style per-turn duration line, kept stopped requests quiet with only the finished duration, and made assistant copy actions available on hover for every completed response.
- **VS Code Chat Runtime Feedback**: Added SDK-backed todo state for the webview, GakrCLI-style spinner glyphs and live turn timers, retry countdown text, per-turn usage attachment fixes, and interrupt cleanup so stopped requests no longer render synthetic abort messages.
- **VS Code Settings Entry Point**: Kept the top-right Settings button as a lightweight placeholder dialog with a working SDK-backed refresh action while runtime setting edits continue through the composer controls.
- **SDK Runtime Control Surface**: Added a headless SDK runtime snapshot and mutation API for provider/profile/model state, settings, permission mode, reasoning effort, fast mode, context usage, slash commands, MCP, plugins, and usage summaries so IDE hosts can manage GakrCLI without launching a child CLI wrapper.
- **VS Code SDK Webview Wiring**: Routed VS Code settings, provider/model, MCP, plugin, fast mode, effort, and runtime refresh flows through SDK control methods and added SDK-backed webview state broadcasts for native UI surfaces.
- **VS Code Permission UI**: Reworked permission and clarification dialogs into compact centered prompts with command/details previews and numbered actions matching the native Codex-style approval flow.
- **VS Code SDK Runtime**: Replaced the native VS Code chat runtime's hardcoded CLI wrapper process with direct `@gakr-gakr/gakrcli/sdk` usage, preserving the existing webview, permission, diff, MCP, resume, and model-control behavior through the SDK query surface.
- **VS Code SDK Packaging**: Declared `@gakr-gakr/gakrcli` as the extension runtime dependency, kept the SDK import external in the extension bundle, and packaged the published npm SDK dependency instead of relying on root checkout files.
- **VS Code Provider Model Discovery**: Added SDK-first model discovery through `query().supportedModels()` with live OpenAI-compatible `/models` fallback, and covered active provider profile, active model, model promotion, and nullable SDK capability responses with regression tests.

### Fixed (2026-05-29)
- **VS Code Provider Model Parity**: Wired the VS Code wrapper to the active `~/.gakrcli.json` provider profile before falling back to legacy `.gakrcli-profile.json`, kept model switches persisted through the GakrCLI `/model` profile path, showed full model IDs in the picker, and added footer runtime status for Sleep, Starting, Idle, and Running states.
- **VS Code Dynamic Model Picker**: Matched the terminal `/model` flow more closely by fetching OpenAI-compatible provider models from `/v1/models` with `/models` fallback, removing broad static model-list fallback from the picker, and updating selected models immediately while preserving full provider-prefixed IDs.
- **VS Code Runtime Usage UI**: Moved cost, duration, and token usage into the assistant message hover actions beside copy controls, keeping usage tied to the completed conversation instead of showing a permanent centered footer pill.

### Changed (2026-05-28)
- **VS Code Webview Glass Theme**: Tuned the extension webview toward a darker black-glass look with low-brightness sky-blue shine, covering chat, sessions, tool output, provider/model selectors, MCP and plugin dialogs, permission prompts, and onboarding panels.
- **VS Code Chat Composer Layout**: Reworked the chat composer footer so the inline input row starts with add and attachment controls, MCP and plugins live under the add menu, permission/provider/fast controls remain in the outside footer row, and model/provider popups stay bounded in the webview.
- **VS Code Conversation Usage Stats**: Moved runtime usage details to the end of the conversation and expanded the display to include cost, input/output tokens, cache tokens, turns, and duration.
- **VS Code Webview Boundary**: Added a subtle full-shell border and removed the duplicate standalone attach button now that file/photo upload lives in the add menu.

### Fixed (2026-05-28)
- **VS Code Bypass Permission Mode**: Wired Bypass mode through the wrapper launch flags by enabling the required GakrCLI allow flag when selected and passing `--allow-dangerously-skip-permissions` into new and resumed processes.
- **VS Code Model Selector**: Rendered the model menu through a bounded webview portal, kept the active model label populated from the provider/profile state, and allowed explicit model selections to override the `.gakrcli-profile.json` fallback model.
- **VS Code File Attachments**: Deduplicated attached files from the picker through send-time prompt construction and compacted the attachment bar for larger file sets.
- **VS Code Model Picker Bounds**: Clamped the model picker to the webview viewport so it stays visible in narrow panes.
- **VS Code Provider Profile State**: Kept startup, resume, and provider display aligned with the active `.gakrcli-profile.json` fallback model and base URL when extension provider settings are not explicitly set.
- **VS Code Permission Mode Sync**: Reported the effective permission mode back to the webview so blocked Bypass attempts snap back to the active mode.

### Fixed (2026-05-27 16:49:02 +05:30)
- **VS Code Permission Prompts**: Launched headless VS Code wrapper sessions with the stdio permission prompt tool so WebSearch, Bash, and other gated tools surface approval dialogs in the webview, with `/allow ToolName` and `allow ToolName` fallback handling for pending and future requests.
- **VS Code Chat Rendering**: Deduplicated streamed and final assistant payloads, filtered internal command wrappers and raw thinking tags, limited copy actions to the latest assistant response, and kept thinking output readable without horizontal truncation.
- **VS Code Slash Commands and Provider Picker**: Deduplicated slash commands, matched searches by command name only, allowed unknown slash-style prompts to send normally, and made the provider picker scroll within the webview.

## [0.5.4] - 2026-05-27

### Added
- **Fresh Install User Directory Bootstrap**: Initialized `~/.gakrcli` during CLI startup with required runtime directories and synced packaged `agents`, `rules`, and `skills` defaults without overwriting user files.
- **First-Run Provider Setup**: Added provider selection to the first-run GakrCLI setup flow so new users can choose and configure a provider before the REPL starts.
- **GitHub Models Provider Setup**: Moved GitHub Models browser login and personal-token setup into `/provider`, including secure token storage and current-session activation.
- **Request Size Command**: Added `/request-size` with transient interactive output and noninteractive text output so users can inspect context contributors without leaking request content or credentials.
- **xAI OAuth Provider Setup**: Added xAI OAuth login, callback handling, credential storage, provider validation, `/provider` setup, and `gakrcli auth xai` command wiring.

### Fixed
- **Global npm Install Asset Discovery**: Resolved packaged asset lookup from the installed package root and corrected global skills fallback paths for `@gakr-gakr/gakrcli`.
- **xAI OAuth Error Guidance**: Reported xAI OAuth credit/subscription entitlement failures as provider-side access errors instead of incorrectly suggesting `/login`, and clarified the `/provider` OAuth option label.
- **VS Code Chat Rendering**: Made VS Code chat tool calls render as compact collapsed rows with structured expandable details and bounded tool output previews.
- **VS Code Chat Composer**: Added file attachment, active-editor attachment, profile-derived model selection, and reasoning-effort controls to the VS Code chat panel.
- **SDK Query Lifecycle Isolation**: Isolated SDK resume lifecycle tests behind a temporary `GAKR_CONFIG_DIR` so full-suite runs no longer touch the real user config directory.
- **Build Output Cleanup**: Cleaned the old `dist/` directory at the start of `bun run build` so local build output only contains the current CLI and SDK bundles.
- **VS Code Extension Status**: Bumped the VS Code extension to 0.2.1, refreshed provider availability detection for current profiles, added global profile fallback detection, and aligned chat launches with the active workspace.
- **VS Code IDE Bridge**: Wired VS Code chat sessions to the root GakrCLI `sse-ide` MCP loader so `/ide`, workspace context, diagnostics, and terminal-backed IDE tools work from headless extension sessions.
- **VS Code Dev Host Launch**: Switched source-checkout VS Code sessions to launch the real CLI with `node dist/cli.mjs`, allowed wrapper commands with inline arguments, and surfaced initialize timeouts or early exits instead of leaving the webview stuck on "Starting GakrCLI...".
- **VS Code Wrapper Startup**: Resolved relative `node dist/cli.mjs` wrapper commands against the GakrCLI source checkout from any opened workspace, passed IDE MCP config through a temporary JSON file on Windows, and included stderr details when the headless wrapper exits before initialization.
- **VS Code IDE Matching on Windows**: Normalized Windows workspace path comparisons for `/ide`, exported `GAKR_CODE_SSE_PORT` into VS Code terminals, and kept new terminals aligned with the active extension bridge.
- **VS Code Provider/Profile Parity**: Expanded the extension wrapper to cover the root provider preset catalog, resolved workspace profiles through ancestor directories, and fell back to `~/.gakrcli/.gakrcli-profile.json` when no project profile is present.
- **VS Code Chat Interaction Polish**: Right-aligned user messages in the webview and wired edited prompts back through the live CLI session so resend-after-edit works again.
- **VS Code Command Wiring**: Registered real handlers for extension update, logout, and terminal-mode at-mention commands so contributed commands and keybindings no longer fall through to placeholder behavior.
- **GakrCLI Setup Naming**: Reframed onboarding, auth flow helpers, tests, and command copy away from old setup/account wording so the first-run experience is presented as GakrCLI setup.
- **Startup Provider Environment Refresh**: Reapplied selected provider profile environment after onboarding so first-run provider choices are available before validation.
- **Fresh Install Startup Order**: Created and synced `~/.gakrcli` before startup provider reads and stopped default `~/.codex/auth.json` discovery from silently selecting Codex before GakrCLI onboarding.
- **Provider Model Persistence**: Kept GitHub provider model switches scoped to GitHub mode so `/model` no longer rewrites the saved active provider profile or shows two active providers in `/provider`.
- **NVIDIA NIM Default Model**: Changed the NVIDIA NIM default to `stepfun-ai/step-3.5-flash` and preserved that selected model across restarts.
- **Windows Bash Error Output**: Probed usable Bash shells before selection and kept captured command output available so non-zero exits surface stdout, stderr, and command-not-found details on Windows.
- **Synthetic Output Schemas**: Wrapped non-object structured-output schemas so array and primitive synthetic outputs validate and unwrap correctly.
- **Query Timeout Cleanup**: Ensured timed-out query guards force-end stale generations and clear timeout state reliably.
- **Request Context Accounting**: Improved local context estimates for media, MCP tools, tool schemas, and request-size contributor rounding.
- **Full Suite Test Isolation**: Strengthened shared-mutation-lock usage and isolated provider/settings mocks so the full Bun test suite runs cleanly in one pass.

### Removed
- **Promotional Spinner Tips**: Removed the partner-tip catalog, scheduling controls, history tracking, settings schema, tests, and provider badge copy so spinner tips are only regular product tips.
- **Gitlawb Opengateway Provider**: Removed the Gitlawb Opengateway provider preset, zero-key auto-detect fallback, generated integration metadata, and legacy route normalization coverage.
- **Standalone GitHub Models Slash Command**: Removed `/onboard-github` from built-in slash commands now that GitHub Models setup lives in `/provider`.

## [0.5.3] - 2026-05-22

### Added
- **Official Plugin Marketplace Bootstrap**: Added startup checks that automatically install and enable the official GakrCLI plugin marketplace when needed, treating it as a built-in marketplace source.
- **Plugin MCP Regression Coverage**: Added focused tests for plugin MCP working-directory resolution, official marketplace startup repair, and UTF-8 BOM-safe JSON parsing.

### Fixed
- **Plugin Marketplace JSON Parsing**: Stripped UTF-8 BOM markers before JSON parsing so marketplace manifests downloaded from GitHub parse correctly.
- **Plugin MCP Startup on Windows**: Spawned plugin-provided stdio MCP servers from the plugin install directory and accepted both `${GAKR_PLUGIN_*}` and legacy `${GAKRCLI_PLUGIN_*}` variable names, fixing official Telegram MCP startup.
- **Built-In Marketplace Protection**: Hid remove actions for the official marketplace in `/plugin` and blocked removal through the marketplace manager.

### Removed
- **Bundled Placeholder Plugins**: Removed the bundled Karpathy guidelines plugin and the temporary official-marketplace shim plugin from the visible built-in plugin list.

## [0.5.2] - 2026-05-17

### Changed
- **GakrCLI Config Home Cleanup (2026-05-20 09:37:21 +05:30)**: Removed active legacy `~/.claude` and project `.claude` config fallback paths so user config, project markdown loading, managed local install detection, VS Code session discovery, and permission special-casing now rely on `~/.gakrcli` / `.gakrcli` only.
- **Pinned Bun Runtime**: Added the shared `.bun-version` and wired CI and Docker builds to use the repo-tracked Bun version.

### Added
- **Multi-Format Conversation Exports**: Added export format helpers and coverage for text, Markdown, and JSON transcript exports, including direct filenames, explicit format flags, dialog selection, clipboard export, and file-save flows.
- **Xiaomi MiMo Model Picker**: Added cached Xiaomi MiMo model options with provider detection coverage for MiMo credentials and base URLs.
- **Command and Buddy Runtime Wiring**: Exposed the existing `/commit-message` command in the slash-command registry, registered `/loop` through its runtime visibility gate, and routed Buddy UI surfaces through the shared runtime feature helper.
- **Config and Tool Reminder Controls**: Added the tool-history compression toggle to `/config`, memoized model picker options by fast-mode state, and let `GAKR_DISABLE_TOOL_REMINDERS` suppress FileRead mitigation reminders.
- **Tool Prompt Product Copy**: Routed ConfigTool and EnterPlanMode prompt surfaces through the shared product display name and removed the internal-only plan-mode prompt fork.
- **Permission Prompt Identity**: Routed permission, plan-mode, log-search, and notification setting copy through the shared GakrCLI product display name.
- **Codex OAuth Callback Host**: Bound the Codex OAuth callback listener to the configured loopback host and covered `CODEX_OAUTH_CALLBACK_HOST=127.0.0.1`.
- **Maintainer Templates**: Added GitHub bug report and feature request issue templates.
- **Regression Coverage and Shared Helpers**: Added focused tests for storage providers, export rendering, abort-signal cleanup, Bash safety checks, OAuth callback bounds, local fast-path provider config, CLI heap settings, shared mutation locking, agent markdown rendering, and extracted keybinding, plugin command, and FileRead tool-name helpers.
- **Provider Setup Hints**: Documented Z.AI, Hicap, self-hosted Firecrawl, and structured token-usage logging environment options in the sample environment file.
- **NVIDIA NIM Model Coverage**: Added current NIM route entries for DeepSeek V4, GLM 5.1, MiniMax M2.7, Nemotron, Mistral, Kimi, and related models, with coverage to prevent duplicate picker IDs.

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
- **Provider Profile Startup Persistence**: Threaded explicit profile-file locations through active provider profile startup persistence and isolated provider profile tests that mutate process env.
- **Profile File Cleanup**: Added explicit config-directory profile file handling so user config profiles and legacy workspace fallbacks can be cleaned up together without mutating global env.
- **External Validation Noise**: Marked optional telemetry, cloud SDK, and SDK-only externals as intentional so smoke builds no longer warn about dynamic runtime packages missing from `package.json`.
- **xAI Grok Defaults**: Updated xAI provider descriptors, runtime fallbacks, provider flags, and model metadata to use Grok 4.3 as the default while preserving explicit Grok 4 selections.
- **Provider Catalog Constraints**: Switched fixed MiniMax, DeepSeek, Moonshot, and xAI catalogs to static descriptors and stripped unsupported `reasoning_effort` from Groq shim requests.
- **Build Feature Flags**: Switched build-time feature flag replacement to Bun load transforms so smoke/build no longer rewrites source files during bundling.
- **Network Diagnostics Cleanup**: Shared URL query-secret redaction across diagnostics paths, delayed MCP OAuth timeout cleanup until error-body normalization completes, and used the product display name in Web Fetch permission prompts.
- **SDK Test Isolation**: Added shared mutation locks and local TypeScript compiler execution across SDK tests that mutate env, session state, tool schema caches, or package-consumer fixtures.
- **Expired OAuth Hints**: Pointed expired OAuth-token 401s toward `/provider` or `/login` re-authentication instead of generic API-key troubleshooting.
- **Stable JSON Serialization**: Emitted compact sorted request bodies directly, added a strict JSON wrapper for API payloads, and isolated tool-history compression mocks with the shared mutation lock.
- **Codex Strict Schemas**: Inferred missing JSON schema types for Codex Responses tools and dropped orphan required keys so untyped MCP schemas do not fail strict-mode validation.
- **Local Provider Fast Path**: Wired `GAKR_LOCAL_FAST_PATH` into OpenAI-compatible requests so local endpoints can skip cloud-only stable serialization, strict tool rewrites, and tool-history compression.
- **Gemini Tool Signatures**: Replayed real Gemini `thought_signature` metadata by model or base URL and preserved signatures from streaming and non-streaming OpenAI-compatible responses.
- **OpenAI Shim Stream Resilience**: Converted Gemini raw tool-call text into tool-use blocks, surfaced structured in-stream errors, and annotated length-truncated streams.
- **GitHub Native Claude Mode**: Routed GitHub Claude-family models through Anthropic-native requests so prompt caching and `cache_control` blocks remain available.
- **OpenAI Shim Compatibility**: Redacted credentials from transport-error URLs and stripped unsupported `store` fields for Cerebras chat-completion requests.
- **API Context Overflow Handling**: Removed a duplicate 500-context-overflow error branch while keeping regression coverage for the friendly new-session guidance.
- **VS Code Extension Packaging**: Added explicit activation events, packaged-file allowlists, and isolated extension module mocks during tests.
- **Agent File Safety**: Prevented non-string agent descriptions from crashing markdown creation and respected loaded agent directories when editing existing agents.
- **Agent Creation and Handoffs**: Rejected generated agents with non-string required fields, routed async child-agent completion and cancellation notifications back to the invoking subagent, and kept agent creation/statusline prompts aligned with the active GakrCLI product and settings home.
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
- **Command and Plugin Hook Safety**: Filtered generated command stubs out of the slash-command registry and deduplicated repeated plugin hook registrations.
- **Provider Profile Coverage**: Added Venice and Xiaomi MiMo regression coverage for provider flags, saved profile env mirroring, startup profile persistence, `/provider` summaries, and OpenAI-shim model defaults.
- **Config Directory Cleanup**: Hard-cut default config paths to `~/.gakrcli` and kept explicit `GAKR_CONFIG_DIR` overrides as the only config-directory override.
- **Runtime Identity Cleanup**: Replaced leftover upstream memory, coordinator, ripgrep, and custom Web Search identity strings with GakrCLI names and `GAKR_*` environment variables, with regression coverage for the prompt surfaces.
- **SDK Package Identity**: Updated SDK consumer type tests, VS Code session discovery, and tool-concurrency tuning to use the GakrCLI package name and `GAKR_*` environment variables, documented the tuning knob in the sample environment file, and cleaned a stale upstream wording note from the landing-page setup guide.
- **Provider Preset Setup Flow**: Restored the streamlined preset model/API-key setup for non-placeholder providers while keeping placeholder endpoints on the full setup form, with OpenAI, MiniMax, and Hicap regression coverage.
- **Conversation Export Wiring**: Connected `/export`, the export dialog, and semantic Markdown/JSON rendering to the multi-format export helpers, including normalized filenames and duplicate-submit guards.
- **Provider Mode Cleanup**: Shared GitHub provider activation cleanup through the provider manager, and cleared stale Mistral, NVIDIA, Bankr, xAI, Venice, MiMo, and OpenAI-compatible auth overrides when provider profiles are saved.
- **Tool Safety Checks**: Restored Bash command validation guards for nested heredoc substitutions and zsh `fc -e` detection, and aligned Web Search permission text with the GakrCLI product name.
- **Provider Env Docs Alignment**: Pointed the strict OpenAI-compatible tool-schema kill switch at the documented `GAKR_DISABLE_STRICT_TOOLS` variable and added the Mistral API-key signup hint to provider bootstrap failures.
- **Maintainer PR Template**: Added a GitHub pull request template for GakrCLI changes and pointed contributor docs at the shared checklist.
- **Bypass Permission Settings**: Honored trusted `permissions.allowBypassPermissionsMode` settings when initializing tool permissions while keeping project settings excluded from enabling bypass mode.
- **Settings Runtime Guards**: Moved recursive settings-load and MDM cache state onto GakrCLI global guards and kept the deprecated settings accessor callable during cyclic imports.
- **Tool Failure Loop Guard**: Added a query-loop guard that stops repeated failing tool calls by signature, error category, or path before optional follow-up work runs.
- **Bridge Session Diagnostics**: Logged bridge session fetch failures with status, method, URL, timeout, and error-code context, allowed `GAKR_BRIDGE_SESSION_INGRESS_URL` to override session ingress outside internal-only shells, and kept bridge pointer project discovery on the shared config-home resolver.
- **Effort Level Settings**: Accepted persisted `max` effort settings for supported models, matching the SDK and runtime effort controls.
- **Xiaomi MiMo Model Picker**: Surfaced the MiMo catalog in `/model` options whenever the Xiaomi MiMo provider route is active.
- **Custom Select Focus Stability**: Kept select navigation from resetting when option labels or callbacks get fresh identities and restored initial default focus handling.
- **Tool Reminder Kill Switch**: Honored the documented `GAKR_DISABLE_TOOL_REMINDERS` env var for todo and task reminder attachments.
- **Hook Chain Recovery Wiring**: Dispatched hook-chain recovery rules from failed tool hooks and completed-task hooks, and kept async-rewake hook commands alive across user interrupts.
- **Codex OAuth Startup Profile**: Marked newly saved Codex OAuth profiles as the active startup provider during setup instead of only switching the current session.
- **Rapid Text Input Stability**: Kept regular and Vim text input cursor operations on the live local buffer so fast keystrokes are preserved before delayed parent updates land.
- **Plugin Command Refreshes**: Routed plugin slash commands through the shared command store so reloads update the REPL command list without relying on AppState command snapshots.

## [0.5.2] - 2026-05-16

### Added
- **Hybrid Knowledge Graph Search**: Upgraded persistent project memory with serialized async mutations, JSON/SQLite storage, Orama-backed semantic indexing, recovery for corrupted indexes, and focused stress coverage for concurrent updates.
- **Provider Spinner Tips**: Added rotating tips for `/provider` multi-provider setup and GitHub Models setup.

## [0.5.1] - 2026-05-16

### Changed
- **Documentation Refresh**: Updated root setup, Android/Termux, provider, VS Code extension, LiteLLM, integration, security, and playbook docs for the current `0.5.1` release, current model defaults, and the `.gakrcli-profile.json` profile path.
- **Safe Run Notes**: Replaced scratch run notes containing real-looking provider tokens with safe reusable build, provider, and validation instructions.

### Fixed
- **VS Code Extension Profile Detection**: Aligned workspace profile detection and tests with the current `.gakrcli-profile.json` filename and switched the extension test script to Bun so the documented test command matches the test mocks.

## [0.5.1] - 2026-05-15 15:35:56 +05:30

### Fixed
- **GitHub Copilot Model Discovery**: Added live Copilot model discovery with required integration headers, filtered disabled-policy/non-chat/internal entries from `/model`, deduplicated discovered API names, hid stale rejected aliases, and clarified labels for dated model variants.
- **GitHub Copilot Session Activation**: Switched the active session model to `github:copilot` immediately after GitHub Models setup so successful onboarding no longer leaves the session on a stale provider model.

## [0.5.1] - 2026-05-15 15:09:17 +05:30

### Fixed
- **GitHub Copilot Onboarding**: Exchanged browser device-flow OAuth tokens for Copilot runtime tokens before saving credentials so GitHub Copilot requests authenticate after setup.
- **GitHub Model Picker**: Let `/model` use the full local Copilot model registry instead of the minimal GitHub gateway catalog so supported Copilot models are selectable.

## [0.5.1] - 2026-05-15 11:32:47 +05:30

### Fixed
- **NVIDIA NIM Provider Defaults**: Added regression coverage for NVIDIA NIM startup, profile loading, and request resolution defaults.

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
  - Enhanced GitHub Models setup with token reuse support

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
