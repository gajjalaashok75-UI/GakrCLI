# GakrCLI Slash Commands — Audit Report

_Generated 2026-08-03 from `src/commands.ts` registry + `scripts/build.ts` feature-flag map._

## Overview

| Metric | Count |
|---|---|
| Registered commands (main registry) | 126 |
| Internal-only commands (ANT/dev-only, gated in registry) | 27 |
| **Total command modules** | **153** |
| Feature-flag-gated (registration-time) | 27 |
| — Flag ON (command registered & available) | 9 |
| — Flag OFF (command not registered / hidden) | 18 |
| Runtime-gated (evaluated at runtime, not build flags) | 3 |
| Always available (no gate) | 96 |
| Stubs — registered as `name: 'stub'`, with `isEnabled: () => false` (NOT implemented) | 7 |
| Feature flags in `scripts/build.ts` | 105 (`true`×64 · `false`×41) |

Command types: `local-jsx`×80, `text`×6, `prompt`×6, `local`×34

## Status legend

- **ON (flag)** — enabled by a feature flag set to `true` in `scripts/build.ts` (registered & available).
- **OFF (flag)** — gated by a feature flag set to `false` (not registered / unavailable in the built CLI).
- **runtime:<cond>** — availability decided at runtime (e.g. `isBuddyEnabled()`, `!isUsing3PServices()`), not by a build flag.
- **always** — no gate; registered unconditionally.
- **stub** — placeholder module with `name: 'stub'` and `isEnabled: () => false`; effectively not implemented.

## All commands

| # | Command | Type | Status | Gate (flag → build value) | Implemented | Description |
|---|---|---|---|---|---|---|
| 1 | /add-dir | local-jsx | always | — | ✅ | Add a new working directory |
| 2 | /advisor | text | always | — | ✅ | Configure the advisor model |
| 3 | /agents | local-jsx | always | — | ✅ | Manage agent configurations |
| 4 | /auto-fix | prompt | always | — | ✅ | Configure auto-fix: run lint/test after AI edits |
| 5 | /autonomy | local-jsx | always | — | ✅ | Inspect automatic autonomy runs recorded for proactive ticks and scheduled tasks |
| 6 | /benchmark | text | always | — | ✅ | Benchmark OpenAI-compatible model throughput |
| 7 | /branch | local-jsx | always | — | ✅ | Create a branch of the current conversation at this point |
| 8 | /btw | local-jsx | always | — | ✅ | Ask a quick side question without interrupting the main conversation |
| 9 | /cache-probe | local | always | — | ✅ | Send identical requests to test prompt caching (results in debug log) |
| 10 | /cache-stats | local | always | — | ✅ | Show per-turn and session cache hit/miss stats (works across all providers) |
| 11 | /chrome | local-jsx | always | — | ✅ | GakrCLI in Chrome (Beta) settings |
| 12 | /clear | local | always | — | ✅ | Clear conversation history and free up context |
| 13 | /clear-context-window | local | always | — | ✅ | Clear session-scoped context window overrides |
| 14 | /color | local-jsx | always | — | ✅ | Set the prompt bar color for this session |
| 15 | /compact | local | always | — | ✅ | Clear conversation history but keep a summary in context. Optional: /compact [instructions for summarization] |
| 16 | /commit-message | local | always | — | ✅ | Configure commit attribution text |
| 17 | /config | local-jsx | always | — | ✅ | Open config panel |
| 18 | /resume | local-jsx | always | — | ✅ | Resume a previous conversation |
| 19 | /copy | local-jsx | always | — | ✅ | Copy GakrCLI's last response to clipboard (or /copy N for the Nth-latest) |
| 20 | /desktop | local-jsx | always | — | ✅ | Continue the current session in GakrCLI Desktop |
| 21 | /context | local-jsx | always | — | ✅ | Visualize current context usage as a colored grid |
| 22 | /cost | local | always | — | ✅ | Show the total cost and duration of the current session |
| 23 | /ctx | local | always | — | ✅ | Show context window usage and token breakdown |
| 24 | /diff | local-jsx | always | — | ✅ | View uncommitted changes and per-turn diffs |
| 25 | /diagnostics | local | always | — | ✅ | Show available LSP diagnostics already captured for this session |
| 26 | /dream | prompt | always | — | ✅ | Run memory consolidation — synthesize recent sessions into durable memories |
| 27 | /doctor | local-jsx | always | — | ✅ | Diagnose and verify your GakrCLI installation and settings |
| 28 | /effort | local-jsx | always | — | ✅ | Set effort level for model usage |
| 29 | /exit | local-jsx | always | — | ✅ | Exit the REPL |
| 30 | /fast | local-jsx | always | — | ✅ | Toggle fast mode (fast-mode model only) |
| 31 | /files | local | always | — | ✅ | List all files currently in context |
| 32 | /heapdump | local | always | — | ✅ | Dump the JS heap to ~/Desktop |
| 33 | /help | local-jsx | always | — | ✅ | Show help and available commands |
| 34 | /ide | local-jsx | always | — | ✅ | Manage IDE integrations and show status |
| 35 | /init | prompt | always | — | ✅ | Initialize new project instruction file(s) and optional skills/hooks with codebase documentation |
| 36 | /keybindings | local | always | — | ✅ | Open or create your keybindings configuration file |
| 37 | /lang | local-jsx | always | — | ✅ | Set display language (en/zh/auto) |
| 38 | /local-memory | local-jsx | OFF (flag) | `LOCAL_MEMORY`→false | ✅ | Manage local memory stores for notes and context. Stored in ~/.gakrcli/local-memory/ — no API key required. |
| 39 | /local-vault | local-jsx | OFF (flag) | `LOCAL_VAULT`→false | ✅ | Manage local encrypted secrets. Stored in OS keychain or encrypted file fallback — no API key required. |
| 40 | /knowledge | local | ON (flag) | `KNOWLEDGE`→true | ✅ | Manage native Knowledge Graph |
| 41 | /lsp | local | always | — | ✅ | Inspect and set up Language Server Protocol code intelligence |
| 42 | /install-github-app | local-jsx | always | — | ✅ | Set up GakrCLI GitHub Actions for a repository |
| 43 | /install-slack-app | local | always | — | ✅ | Install the GakrCLI Slack app |
| 44 | /mcp | local-jsx | always | — | ✅ | Manage MCP servers |
| 45 | /memory | local-jsx | always | — | ✅ | Edit GakrCLI memory files |
| 46 | /mobile | local-jsx | always | — | ✅ | Show QR code to download the GakrCLI mobile app |
| 47 | /model | local-jsx | always | — | ✅ | Set the AI model for GakrCLI |
| 48 | /mode | local-jsx | always | — | ✅ | Switch interaction mode (default, gentle, sharp, workhorse, token-saver, super-ai) |
| 49 | /onboard-github | local-jsx | always | — | ✅ | Interactive setup for GitHub Copilot: OAuth device login stored in secure storage |
| 50 | /output-style | local-jsx | always | — | ✅ | Deprecated: use /config to change output style |
| 51 | /remote-env | local-jsx | always | — | ✅ | Configure the default remote environment for teleport sessions |
| 52 | /plugin | local-jsx | always | — | ✅ | Manage GakrCLI plugins |
| 53 | /provider | local-jsx | always | — | ✅ | Manage API provider profiles |
| 54 | /pr-comments | text | always | — | ✅ | Get comments from a GitHub pull request |
| 55 | /release-notes | local | always | — | ✅ | View release notes |
| 56 | /replay | local-jsx | always | — | ✅ | Replay a session showing tool execution timeline |
| 57 | /repomap | local | always | — | ✅ | Show or configure the repository structural map (codebase intelligence) |
| 58 | /reload-plugins | local | always | — | ✅ | Activate pending plugin changes in the current session |
| 59 | /rename | local-jsx | always | — | ✅ | Rename the current conversation |
| 60 | /request-size | local-jsx | always | — | ✅ | Show estimated request context load and top contributors |
| 61 | /session | local-jsx | always | — | ✅ | Show remote session URL and QR code |
| 62 | /set-context-window | local | always | — | ✅ | Set a session-scoped context window override for a model |
| 63 | /skills | local-jsx | always | — | ✅ | List available skills |
| 64 | /smartroute | text | always | — | ✅ | Configure smart auto-routing (experimental): route simple turns to your configured simple model |
| 65 | /skill-learning | local-jsx | always | — | ✅ | Manage skill learning (observe, analyze, evolve) |
| 66 | /skill-search | local-jsx | always | — | ✅ | Control automatic skill matching during conversations |
| 67 | /skill-store | local-jsx | always | — | ✅ | Browse and install remote skills from the Anthropic skill marketplace. Requires GakrCLI Pro/Max/Team subscription. |
| 68 | /stats | local-jsx | always | — | ✅ | Show your GakrCLI usage statistics and activity |
| 69 | /status | local-jsx | always | — | ✅ | Show GakrCLI status including version, model, account, API connectivity, and tool statuses |
| 70 | /statusline | prompt | always | — | ✅ | Set up GakrCLI's status line UI |
| 71 | /stickers | local | always | — | ✅ | Order GakrCLI stickers |
| 72 | /tag | local-jsx | always | — | ✅ | Toggle a searchable tag on the current session |
| 73 | /theme | local-jsx | always | — | ✅ | Change the theme |
| 74 | /logo | local-jsx | always | — | ✅ | Change the startup logo color scheme |
| 75 | /feedback | local-jsx | always | — | ✅ | Submit feedback about GakrCLI |
| 76 | /goal | local | always | — | ✅ | Set and manage a session completion goal |
| 77 | /review | prompt | always | — | ✅ | Review a pull request |
| 78 | /rewind | local | always | — | ✅ | Restore the code and/or conversation to a previous point |
| 79 | /security-review | text | always | — | ✅ | Complete a security review of the pending changes on the current branch |
| 80 | /terminal-setup | local-jsx | always | — | ✅ | Enable Option+Enter key binding for newlines and visual bell |
| 81 | /upgrade | local-jsx | always | — | ✅ | Upgrade to Max for higher rate limits and more Opus |
| 82 | /update | local-jsx | always | — | ✅ | Update GakrCLI to the latest version |
| 83 | /extra-usage | local-jsx | always | — | ✅ | Configure extra usage to keep working when limits are hit |
| 84 | /rate-limit-options | local-jsx | always | — | ✅ | Show options when rate limit is reached |
| 85 | /usage | local-jsx | always | — | ✅ | Show plan usage limits |
| 86 | /insights | prompt | always | — | ✅ | Generate a report analyzing your GakrCLI sessions |
| 87 | /web-tools | local-jsx | always | — | ✅ | Configure web search and web fetch backends |
| 88 | /vim | local | always | — | ✅ | Toggle between Vim and Normal editing modes |
| 89 | /wiki | local-jsx | always | — | ✅ | Initialize and inspect the GakrCLI project wiki |
| 90 | /web-setup | local-jsx | OFF (flag) | `CCR_REMOTE_SETUP`→false | ✅ | Setup GakrCLI on the web (requires connecting your GitHub account) |
| 91 | /fork | local-jsx | ON (flag) | `FORK_SUBAGENT`→true | ✅ | Fork the current session into a new sub-agent |
| 92 | /job | local-jsx | OFF (flag) | `TEMPLATES`→false | ✅ | Manage template jobs |
| 93 | /buddy | local-jsx | runtime:buddy | runtime `buddy` | ✅ | Hatch, pet, and manage your GakrCLI companion |
| 94 | /poor | local | ON (flag) | `POOR`→true | ✅ | Toggle poor mode — disable extract_memories and prompt_suggestion to save tokens |
| 95 | /daemon | local-jsx | ON (flag) | `DAEMON`→false · `BG_SESSIONS`→true | ✅ | Manage background sessions and daemon |
| 96 | /monitor | local-jsx | ON (flag) | `MONITOR_TOOL`→true | ✅ | Start a background shell monitor (Shift+Down to view) |
| 97 | /coordinator | local-jsx | ON (flag) | `COORDINATOR_MODE`→true | ✅ | Toggle coordinator (multi-worker) mode |
| 98 | /force-snip | text | ON (flag) | `HISTORY_SNIP`→true | ✅ | Force snip conversation history at current point |
| 99 | /proactive | local-jsx | ON (flag) | `PROACTIVE`→true · `KAIROS`→false | ✅ | Toggle proactive (autonomous) mode |
| 100 | /brief | local-jsx | OFF (flag) | `KAIROS`→false · `KAIROS_BRIEF`→false | ✅ | Toggle brief-only mode |
| 101 | /assistant | local-jsx | OFF (flag) | `KAIROS`→false | ✅ | Open the Kairos assistant panel |
| 102 | /remote-control | local-jsx | OFF (flag) | `BRIDGE_MODE`→false | ✅ | Connect this terminal for remote-control sessions |
| 103 | /remote-control-server | local-jsx | OFF (flag) | `DAEMON`→false | ✅ | Start a persistent Remote Control server (daemon) that accepts multiple sessions |
| 104 | /voice | local | OFF (flag) | `VOICE_MODE`→false | ✅ | Toggle voice mode |
| 105 | /think-back | local-jsx | always | — | ✅ | Your 2025 GakrCLI Year in Review |
| 106 | /thinkback-play | local | always | — | ✅ | Play the thinkback animation |
| 107 | /permissions | local-jsx | always | — | ✅ | Manage allow & deny tool permission rules |
| 108 | /plan | local-jsx | always | — | ✅ | Enable plan mode or view the current session plan |
| 109 | /privacy-settings | local-jsx | always | — | ✅ | View and update your privacy settings |
| 110 | /hooks | local-jsx | always | — | ✅ | View hook configurations for tool events |
| 111 | /export | local-jsx | always | — | ✅ | Export the current conversation to a file or clipboard |
| 112 | /sandbox | local-jsx | always | — | ✅ | Toggle bash command sandboxing (live status shown in description) |
| 113 | /logout | local-jsx | runtime:!isUsing3PServices | runtime `!isUsing3PServices` | ✅ | Sign out from your Anthropic account |
| 114 | /login | local-jsx | runtime:!isUsing3PServices | runtime `!isUsing3PServices` | ✅ | Switch Anthropic accounts |
| 115 | /passes | local-jsx | always | — | ✅ | Share a free week of GakrCLI with friends and earn extra usage |
| 116 | /peers | local | OFF (flag) | `UDS_INBOX`→false | ✅ | List connected GakrCLI peers |
| 117 | /attach | local | OFF (flag) | `UDS_INBOX`→false | ✅ | Attach to a sub GakrCLI CLI instance via named pipe |
| 118 | /detach | local | OFF (flag) | `UDS_INBOX`→false | ✅ | Detach from a sub CLI (or all connected subs) |
| 119 | /send | local | OFF (flag) | `UDS_INBOX`→false | ✅ | Send a message to a connected sub CLI |
| 120 | /pipes | local | OFF (flag) | `UDS_INBOX`→false | ✅ | Inspect pipe registry state and toggle the pipe selector |
| 121 | /pipe-status | local | OFF (flag) | `UDS_INBOX`→false | ✅ | Show current pipe connection status |
| 122 | /history | local | OFF (flag) | `UDS_INBOX`→false | ✅ | View session history of a connected sub CLI |
| 123 | /claim-main | local | OFF (flag) | `UDS_INBOX`→false | ✅ | Claim main role for this machine (overrides current main machine) |
| 124 | /tasks | local-jsx | always | — | ✅ | List and manage background tasks |
| 125 | /workflows | local-jsx | ON (flag) | `WORKFLOW_SCRIPTS`→true | ✅ | Manage workflow scripts |
| 126 | /torch | local-jsx | OFF (flag) | `TORCH`→false | ✅ | [INTERNAL] Development debug command (reserved) |

## Commands currently disabled (flag OFF)

These are gated by build flags set to `false`, so they are not registered in the built CLI:

| Command | Type | Gate | Description |
|---|---|---|---|
| /local-memory | local-jsx | `LOCAL_MEMORY`=false | Manage local memory stores for notes and context. Stored in ~/.gakrcli/local-memory/ — no API key required. |
| /local-vault | local-jsx | `LOCAL_VAULT`=false | Manage local encrypted secrets. Stored in OS keychain or encrypted file fallback — no API key required. |
| /web-setup | local-jsx | `CCR_REMOTE_SETUP`=false | Setup GakrCLI on the web (requires connecting your GitHub account) |
| /job | local-jsx | `TEMPLATES`=false | Manage template jobs |
| /brief | local-jsx | `KAIROS`=false · `KAIROS_BRIEF`=false | Toggle brief-only mode |
| /assistant | local-jsx | `KAIROS`=false | Open the Kairos assistant panel |
| /remote-control | local-jsx | `BRIDGE_MODE`=false | Connect this terminal for remote-control sessions |
| /remote-control-server | local-jsx | `DAEMON`=false | Start a persistent Remote Control server (daemon) that accepts multiple sessions |
| /voice | local | `VOICE_MODE`=false | Toggle voice mode |
| /peers | local | `UDS_INBOX`=false | List connected GakrCLI peers |
| /attach | local | `UDS_INBOX`=false | Attach to a sub GakrCLI CLI instance via named pipe |
| /detach | local | `UDS_INBOX`=false | Detach from a sub CLI (or all connected subs) |
| /send | local | `UDS_INBOX`=false | Send a message to a connected sub CLI |
| /pipes | local | `UDS_INBOX`=false | Inspect pipe registry state and toggle the pipe selector |
| /pipe-status | local | `UDS_INBOX`=false | Show current pipe connection status |
| /history | local | `UDS_INBOX`=false | View session history of a connected sub CLI |
| /claim-main | local | `UDS_INBOX`=false | Claim main role for this machine (overrides current main machine) |
| /torch | local-jsx | `TORCH`=false | [INTERNAL] Development debug command (reserved) |

## Commands enabled by flag (flag ON)

| Command | Type | Gate | Description |
|---|---|---|---|
| /knowledge | local | `KNOWLEDGE`=true | Manage native Knowledge Graph |
| /fork | local-jsx | `FORK_SUBAGENT`=true | Fork the current session into a new sub-agent |
| /poor | local | `POOR`=true | Toggle poor mode — disable extract_memories and prompt_suggestion to save tokens |
| /daemon | local-jsx | `DAEMON`=false · `BG_SESSIONS`=true | Manage background sessions and daemon |
| /monitor | local-jsx | `MONITOR_TOOL`=true | Start a background shell monitor (Shift+Down to view) |
| /coordinator | local-jsx | `COORDINATOR_MODE`=true | Toggle coordinator (multi-worker) mode |
| /force-snip | text | `HISTORY_SNIP`=true | Force snip conversation history at current point |
| /proactive | local-jsx | `PROACTIVE`=true · `KAIROS`=false | Toggle proactive (autonomous) mode |
| /workflows | local-jsx | `WORKFLOW_SCRIPTS`=true | Manage workflow scripts |

## Runtime-gated commands

| Command | Type | Gate | Description |
|---|---|---|---|
| /buddy | local-jsx | `buddy` | Hatch, pet, and manage your GakrCLI companion |
| /logout | local-jsx | `!isUsing3PServices` | Sign out from your Anthropic account |
| /login | local-jsx | `!isUsing3PServices` | Switch Anthropic accounts |
> Note: `/dream` is also runtime-gated at the module level via `isEnabled: () => isAutoMemoryEnabled()` (auto-memory must be enabled).

## Not implemented (stubs)

Registered only inside the internal/ANT command block and immediately disabled via `isEnabled: () => false`. The module body is a placeholder (`name: 'stub'`), so these commands do **not** work:

| Module id | Registered name | Status |
|---|---|---|
| `backfillSessions` | `stub` | disabled stub — not implemented |
| `goodgakrcli` | `stub` | disabled stub — not implemented |
| `mockLimits` | `stub` | disabled stub — not implemented |
| `resetLimits` | `stub` | disabled stub — not implemented |
| `resetLimitsNonInteractive` | `stub` | disabled stub — not implemented |
| `antTrace` | `stub` | disabled stub — not implemented |
| `oauthRefresh` | `stub` | disabled stub — not implemented |

## Internal-only commands (ANT / dev-only)

Registered only when `process.env.USER_TYPE === 'ant' && !process.env.IS_DEMO`. 20 modules (stubs listed separately above):

| Command | Type | Description |
|---|---|---|
| /break-cache | text | Manage prompt-cache breaking. Open actions or run: once, status, always, off |
| /commit | prompt | Create a git commit |
| /commit-push-pr | prompt | Commit, push, and open a PR |
| /issue | local | Create a GitHub issue via gh CLI. Flags: --label <label>, --assignee <user> |
| /init-verifiers | prompt | Create verifier skill(s) for automated verification of code changes |
| /bridge-kick | text | Inject bridge failure states for manual recovery testing |
| /version | text | Print the version this session is running (not what autoupdate downloaded) |
| /ultraplan | local-jsx | ~10–30 min · GakrCLI on the web drafts an advanced plan you can edit and approve. See ccr terms url |
| /subscribe-pr | text | Subscribe to GitHub PR activity (comments, CI, reviews) |
| /onboarding | local-jsx | Re-run the first-run setup (theme, trust, model, MCP) |
| /share | local | Upload the current session log to GitHub Gist. Flags: --public, --private (default), --mask-secrets, --summary-only, --allow-public-fallback |
| /summary | text | Generate and display a session summary |
| /recap | text | Generate a one-line session recap now |
| /teleport | local-jsx | Resume a GakrCLI Code session from gakrcli.ai |
| /tui | text | Manage flicker-free TUI mode. Open actions or run: status, on, off, toggle |
| /perf-issue | tool_use | Capture a performance + token-usage snapshot. Flags: --format=json\|csv\|md (default md) |
| /env | local | Show current environment, runtime, and feature flags |
| /debug-tool-call | tool_use | Show the last N tool call pairs (use/result) from the session log |
| /autofix-pr | local-jsx | Auto-fix CI failures on a pull request |

## Feature flags that gate commands (source: `scripts/build.ts`)

| Flag | Build value | Gated command(s) | build.ts comment |
|---|---|---|---|
| `BG_SESSIONS` | `true` | /daemon | Local detached background sessions |
| `BRIDGE_MODE` | `false` | /remote-control | Remote desktop bridge via CCR infrastructure |
| `CCR_REMOTE_SETUP` | `false` | /web-setup | PATCHED: Enable remote setup command |
| `COORDINATOR_MODE` | `true` | /coordinator | Multi-agent coordinator with worker delegation |
| `DAEMON` | `false` | /daemon, /remote-control-server | Background daemon process (stubbed in open build) |
| `FORK_SUBAGENT` | `true` | /fork | Implicit context-forking when omitting subagent_type |
| `HISTORY_SNIP` | `true` | /force-snip | Model-callable snip tool for context management |
| `KAIROS` | `false` | /proactive, /brief, /assistant | Persistent assistant/session mode (cloud backend) |
| `KAIROS_BRIEF` | `false` | /brief | Brief mode toggle (KAIROS sub-feature) |
| `KAIROS_GITHUB_WEBHOOKS` | `false` | /subscribe-pr | GitHub webhook PR subscription (KAIROS sub-feature) |
| `KNOWLEDGE` | `true` | /knowledge | Knowledge graph slash command |
| `LOCAL_MEMORY` | `false` | /local-memory | Local memory recall tool & command |
| `LOCAL_VAULT` | `false` | /local-vault | Local vault HTTP fetch tool & command |
| `MONITOR_TOOL` | `true` | /monitor | MCP server monitoring/streaming tool |
| `POOR` | `true` | /poor | 穷鬼模式，跳过 extract_memories/prompt_suggestion 减少消耗 |
| `PROACTIVE` | `true` | /proactive | Autonomous agent mode (tick-driven agent, 12/12 tests pass) |
| `TEMPLATES` | `false` | /job | Template jobs (new/list/reply subcommands) |
| `TORCH` | `false` | /torch | Torch command (requires external infra) |
| `UDS_INBOX` | `false` | /peers, /attach, /detach, /send, /pipes, /pipe-status, /history, /claim-main | Unix Domain Socket inter-session messaging |
| `ULTRAPLAN` | `true` | /ultraplan | Ultraplan multi-phase planning system |
| `VOICE_MODE` | `false` | /voice | Push-to-talk STT via gakrcli.ai OAuth endpoint |
| `WORKFLOW_SCRIPTS` | `true` | /workflows | Workflow scripts (.gakrcli/workflows/ YAML/MD) |

## Runtime availability (display-time filters)

`always` in the table above means **no registration-time feature gate** — it does NOT mean the command is shown to every user. After registration, each command passes three more runtime checks before it appears in `/help` or the command menu:

1. **`availability`** — `src/commands.ts` `meetsAvailabilityRequirement()`: commands declaring `availability: ['gakrcli-ai']` are only shown when `isGakrCLIAISubscriber()` is true (GakrCLI AI web subscription). `availability: ['console']` requires a direct 1P API-key customer (not 3P, not gakrcli.ai).
2. **`isEnabled()`** — `isCommandEnabled()` (`src/types/command.ts`): per-command runtime condition (auth state, env vars, remote feature gates, mode). Defaults to `true` when absent.
3. **`isHidden`** — controls whether the command is listed in the menu (hidden commands still run if typed).

The following commands are registered but were verified NOT to appear in a default CLI session (OpenAI/3P provider, no GakrCLI AI subscription, no `USER_TYPE=ant`):

| Command | Real registered name | Runtime condition | Why hidden |
|---|---|---|---|
| /chrome | `chrome` | `availability: ['gakrcli-ai']` + `!getIsNonInteractiveSession()` | needs GakrCLI AI subscription |
| /desktop | `desktop` (alias `/app`) | `availability: ['gakrcli-ai']` + `isSupportedPlatform` | subscription-gated (platform fine on win32 x64) |
| /files | `files` | `isEnabled: () => process.env.USER_TYPE === 'ant'` | ANT/dev-only |
| /keybindings | `keybindings` | GrowthBook remote gate `tengu_keybinding_customization_release` (default false) | remote gate off |
| /install-github | `install-github-app` | `availability: ['gakrcli-ai','console']` | not AI subscriber, not direct-API user |
| /install-slack | `install-slack-app` | `availability: ['gakrcli-ai']` | subscription-gated |
| /mobile | `mobile` | `isEnabled: () => false` | dead — never enabled |
| /remote-env | `remote-env` | `isGakrCLIAISubscriber() && isPolicyAllowed('allow_remote_sessions')` | subscription + policy |
| /session | `session` | `getIsRemoteMode()` | only shown in remote mode |
| /skill-learning | `skill-learning` | `isSkillLearningCompiledIn()` → `feature('SKILL_LEARNING')` = `false` | build flag off |
| /skill-store | `skill-store` | `availability: ['gakrcli-ai']` | subscription-gated |
| /tag | `tag` | `isEnabled: () => process.env.USER_TYPE === 'ant'` | ANT/dev-only |
| /feedback | `feedback` | `isEnabled: () => false` | dead — never enabled |
| /extra-usage | `extra-usage` | `isOverageProvisioningAllowed()` — needs GakrCLI AI + Stripe/Apple/Google billing | subscription + billing |
| /rate-limit | `rate-limit-options` | `isGakrCLIAISubscriber()` + `isHidden: true` | subscription-gated + hidden |
| /think-back | `think-back` (module `thinkback`) | Statsig remote gate `tengu_thinkback` | remote gate off |
| /thinkback-play | `thinkback-play` | same gate + `isHidden: true` | remote gate off + hidden |
| /privacy-settings | `privacy-settings` | `isConsumerSubscriber()` — GakrCLI AI + consumer plan | subscription + plan |
| /install | (none) | not in COMMANDS array | used only from `cli.tsx` native-install flow — NOT a slash command |

Name notes: there is no `/install-github` or `/install-slack` — the registered names are `install-github-app` and `install-slack-app`. There is no `/rate-limit` — it is `rate-limit-options`. `/think-back` is the module `thinkback`.

## Orphan modules in `src/commands/` (implemented but NOT registered)

Cross-referencing every entry in `src/commands/` against the `COMMANDS` array found **6 fully-implemented command modules that are never registered** — they cannot be invoked and don't appear in `/help`. They exist in the source tree but are dead code from the user's perspective.

| Module | Command name | Type | Status | Notes |
|---|---|---|---|---|
| `artifacts/` | `artifacts` | local-jsx | **orphan** | `isEnabled: () => true`, no gate — simply never added to `COMMANDS` |
| `memory-stores/` | `memory-stores` (aliases `mem`, `mstore`) | local-jsx | **orphan** | `isEnabled: () => true`, `availability: ['gakrcli-ai']`, hidden without API key |
| `schedule/` | `triggers` (alias `cron`) | local-jsx | **orphan** | renamed `schedule` → `triggers` to avoid collision with the bundled `scheduleRemoteAgents` skill, but never added to `COMMANDS` |
| `vault/` | `vault` (aliases `vaults`) | local-jsx | **orphan** | `isEnabled: () => true`, `availability: ['gakrcli-ai']`, hidden without API key |

The three Pro/Max/Team commands (`memory-stores`, `triggers`, `vault`) are `availability: ['gakrcli-ai']`-gated, so even if registered they'd only appear for subscribers. `artifacts` is completely ungated (`isEnabled: () => true`, no availability) — it would work for everyone if wired into `COMMANDS`.

Other entries in `src/commands/` that are **not** commands (correctly excluded from the registry):

- `_shared/` — shared launch helpers (e.g. `launchCommand.ts`), imported by other command modules
- `__tests__/`, `*.test.*` — test files
- `autonomyPanel.tsx` — UI component lazily loaded by the registered `/autonomy` command
- `createMovedToPluginCommand.ts` — factory used by `bughunter`, `bughunter-perf`, `bughunter-security`, `pr_comments`, `security-review`
- `initMode.ts` — helper for the registered `/init` command
- `insights.ts` — registered via a lazy shim in `commands.ts` (deferred import, not a directory)
- `install.tsx` — used only from the `cli.tsx` native-install flow, intentionally not a slash command

## Method

- Registry parsed from the `COMMANDS` array in `src/commands.ts` (order-preserving, including spread-gated entries).
- Command metadata (`name`, `type`, `description`, `aliases`) extracted from each module's `Command` object literal.
- Feature-flag values read from the `featureFlags` map in `scripts/build.ts`.
- Runtime availability (`availability`, `isEnabled`, `isHidden`) verified manually against each command module.