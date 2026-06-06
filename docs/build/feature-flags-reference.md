# Feature Flags Reference

This page documents every flag currently listed in `scripts/build.ts`.

The values below describe the current open build. If the source file changes, this page should be updated with it.

## Disabled Flags

These flags are currently `false`. They are mostly private, incomplete, native, telemetry-only, or not fully mirrored into this source checkout.

| Flag | Current | What `true` compiles in | What `false` does | Notes |
| --- | --- | --- | --- | --- |
| `VOICE_MODE` | `false` | Push-to-talk voice input, voice UI, voice keybindings, STT hooks, and voice-related settings. | Removes voice input from the prompt UI and keybinding map. | Source references include `src/hooks/useVoiceIntegration.tsx`, `src/components/PromptInput/`, `src/voice/`, and `src/keybindings/defaultBindings.ts`. |
| `PROACTIVE` | `false` | Autonomous/proactive agent behavior, proactive prompt sections, proactive REPL behavior, and proactive UI hints. | Removes proactive mode paths and avoids loading proactive modules. | Comment says the proactive module/source is missing or not suitable for the open build. |
| `BRIDGE_MODE` | `false` | Remote-control bridge commands, bridge startup paths, bridge config/settings, REPL bridge hooks, and bridge permission callbacks. | Removes remote-control command routes and bridge UI/status paths. | Tied to CCR/private bridge infrastructure. |
| `DAEMON` | `false` | Daemon CLI routes such as `daemon` and `--daemon-worker`. | Keeps daemon commands unavailable. | Build stubs daemon modules with explicit "unavailable in the open build" errors. |
| `AGENT_TRIGGERS` | `false` | Scheduled/cron remote agent trigger tools and related prompt rows. | Removes scheduled trigger tools from the tool list. | Tied to remote agent trigger infrastructure. |
| `ABLATION_BASELINE` | `false` | Eval/A-B baseline entry behavior when `GAKR_CODE_ABLATION_BASELINE` is set. | Disables this eval harness path. | Internal experiment/evaluation support. |
| `CONTEXT_COLLAPSE` | `false` | Context-collapse commands, UI, context visualization behavior, withheld-413 handling, and collapse-aware restore paths. | Keeps normal compaction/context behavior without this optimization path. | Comment marks it stubbed. |
| `COMMIT_ATTRIBUTION` | `false` | Co-authored-by and attribution metadata in git/session/compact/worktree flows. | Skips attribution metadata behavior. | Mostly internal attribution handling. |
| `UDS_INBOX` | `false` | Unix Domain Socket inter-session messaging, peer/list tools, send-message routing, and messaging socket options. | Removes UDS peer messaging from startup and tool prompts. | Platform-specific inter-session path. |
| `BG_SESSIONS` | `false` | Background session commands such as `ps`, `logs`, `attach`, `kill`, `--bg`, and background task summaries. | Keeps background session CLI routes unavailable. | Build stubs background session handlers. |
| `WEB_BROWSER_TOOL` | `false` | Built-in browser automation tool and browser panel UI. | Removes browser automation tool and panel from the build. | Comment says the source is not mirrored. |
| `CHICAGO_MCP` | `false` | Computer-use MCP server routes, native Swift/computer-use wrappers, and built-in computer-use MCP config. | Removes computer-use MCP startup and native integrations. | Native/private modules are stubbed. |
| `COWORKER_TYPE_TELEMETRY` | `false` | Extra coworker/agent type metadata in analytics events. | Omits that telemetry metadata. | Telemetry-only path. |
| `MCP_SKILLS` | `false` | Dynamic MCP skill discovery from MCP resources and MCP skill indexing. | MCP servers can still exist, but resource-backed dynamic skill discovery stays disabled. | Explicitly risky: enabling without `src/skills/mcpSkills.ts` can cause runtime missing-export errors such as `fetchMcpSkillsForClient is not a function`. |

## Enabled Upstream Defaults

These flags are currently `true` and are treated as normal open-build behavior.

| Flag | Current | What `true` compiles in | What would happen if `false` | Runtime notes |
| --- | --- | --- | --- | --- |
| `COORDINATOR_MODE` | `true` | Multi-agent coordinator module, coordinator prompt context, coordinator-safe tool filtering, coordinator resume state. | Coordinator mode code and built-in coordinator agent pieces would be unavailable. | Some paths still require `GAKR_CODE_COORDINATOR_MODE`. |
| `BUILTIN_EXPLORE_PLAN_AGENTS` | `true` | Built-in Explore and Plan agent definitions. | Those built-in subagents would not be added. | See `src/tools/AgentTool/builtInAgents.ts`. |
| `BUDDY` | `true` | Buddy paired-programming mode and buddy trigger behavior. | Buddy prompt/input behavior would be unavailable. | Runtime behavior also depends on buddy feature helpers/settings. |
| `MONITOR_TOOL` | `true` | Monitor tool, monitor task detail UI, and monitor-aware shell/permission behavior. | Monitor tool and monitor detail dialogs would be removed. | Used by Bash, PowerShell, agent, and task UI paths. |
| `TEAMMEM` | `true` | Team memory paths, memory file detection, collapsed read/search summaries, and team-memory UI messages. | Team memory file handling and UI summaries would be removed. | Some team-memory behavior still depends on configured memory paths/settings. |
| `MESSAGE_ACTIONS` | `true` | Message action keybindings and interactive message-action UI. | Message action UI/keybindings would be removed. | Can be disabled at runtime with `GAKR_CODE_DISABLE_MESSAGE_ACTIONS`. |

## Enabled New Activations

These flags are currently `true` and compile selected newer features into the open build.

| Flag | Current | What `true` compiles in | What would happen if `false` | Runtime notes |
| --- | --- | --- | --- | --- |
| `DUMP_SYSTEM_PROMPT` | `true` | Fast CLI path for printing the rendered system prompt. | `--dump-system-prompt` would not be handled by this feature gate. | Use `gakrcli --dump-system-prompt` after building. |
| `CACHED_MICROCOMPACT` | `true` | Cache-aware micro-compact configuration and prompt-cache-aware API behavior. | Cache-aware micro-compaction paths would be disabled. | Used by prompt constants and API request logic. |
| `AWAY_SUMMARY` | `true` | REPL hook for "while you were away" summary after focus/blur gaps. | Away summary hook would be skipped. | Also affected by runtime state and local feature-gate values in the telemetry/no-telemetry layer. |
| `TRANSCRIPT_CLASSIFIER` | `true` | Auto permission mode, classifier decision reasons, permission setup paths, auto-mode settings, and classifier denial UI. | Auto/classifier permission mode would be removed from many permission flows. | This is broad and touches Bash, PowerShell, agent, permissions, settings, and UI. |
| `ULTRATHINK` | `true` | `ultrathink` keyword detection, highlighting, and deep-thinking trigger support. | The keyword trigger returns inactive and UI highlighting disappears. | User activates by typing `ultrathink` in a prompt. |
| `TOKEN_BUDGET` | `true` | Token budget parsing, input highlighting, spinner/task budget display, query budget tracking, and budget continuation checks. | Token-budget prompts and query budget checks would be disabled. | User-facing behavior depends on token budget phrases/options in prompts. |
| `HISTORY_PICKER` | `true` | Enhanced modal history picker ownership of history search. | Falls back toward the older history-search behavior. | Interacts with Ctrl+R/history search paths. |
| `QUICK_SEARCH` | `true` | Ctrl+G quick search across prompt history/input UI. | Quick search keybinding and UI path would be absent. | Disabled while modal overlays are active. |
| `SHOT_STATS` | `true` | Shot distribution statistics in stats cache and Stats UI. | Shot distribution is not computed/rendered. | Used in `src/utils/stats.ts`, `src/utils/statsCache.ts`, and `src/components/Stats.tsx`. |
| `EXTRACT_MEMORIES` | `true` | Durable memory extraction in stop hooks, background housekeeping, and transcript print flow. | Memory extraction hooks would be skipped. | Also depends on memory extraction runtime state. |
| `FORK_SUBAGENT` | `true` | Fork subagent type, fork command behavior, fork boilerplate rendering, and ToolSearch prompt guidance. | Fork subagent behavior and related alias behavior would be removed. | Changes `/branch` aliases: `fork` alias is omitted when this is enabled. |
| `VERIFICATION_AGENT` | `true` | Built-in read-only verification agent and verification reminders after non-trivial work. | Verification agent would not be added and reminder prompts would be absent. | Used by agent definitions, todo/task tools, and system prompt guidance. |
| `PROMPT_CACHE_BREAK_DETECTION` | `true` | Logging/detection for unexpected prompt cache invalidation. | Cache-break detection logs are skipped. | Used in compact, API, and agent run paths. |
| `HOOK_PROMPTS` | `true` | Allows hook/tool flows to call interactive prompt requests through the REPL. | Hook prompt callback is not passed. | Used around REPL `requestPrompt` wiring. |
| `KAIROS` | `false` | Local assistant-mode behavior, assistant command, brief layout pieces, assistant history/session handling, assistant startup, and SendUserFile-style tools. | Assistant/Kairos-specific code is removed from the open build. | See [kairos-and-internal-flags.md](kairos-and-internal-flags.md). |

## Flags Mentioned In Source But Not In `featureFlags`

The codebase contains other `feature('NAME')` checks. If `NAME` is not present in `featureFlags`, the build preprocessor treats it as `false`.

Examples include `WORKFLOW_SCRIPTS`, `EXPERIMENTAL_SKILL_SEARCH`, `KAIROS_BRIEF`, `BASH_CLASSIFIER`, `CONNECTOR_TEXT`, `HISTORY_SNIP`, `REACTIVE_COMPACT`, and others.

This default matters: adding a `feature('NEW_FLAG')` call without adding `NEW_FLAG` to `scripts/build.ts` means the code is disabled in the open build.
