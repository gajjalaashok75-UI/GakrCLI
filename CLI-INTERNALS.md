PS C:\Users\gajja\Documents\data-science\Gakrcli> gakrcli auth status --json

 ██████   ░█████░   ██   ██   ██████
██        █░   ░█   ██  ██    ██   ██
██  ███   ███████   █████     ██████
██   ██   █░   ░█   ██  ██    ██  ██
 ██████   █░   ░█   ██   ██   ██   ██

  ✦ Open terminal for any LLM ✦

╔════════════════════════════════════════════════════════════╗
│ Provider  NVIDIA NIM                                       │
│ Model     stepfun-ai/step-3.7-flash                        │
│ Endpoint  https://integrate.api.nvidia.com/v1              │
╠════════════════════════════════════════════════════════════╣
│ ● cloud    Ready — type /help to begin                     │
╚════════════════════════════════════════════════════════════╝
  gakrcli v0.5.7

{
  "loggedIn": true,
  "authMethod": "third_party",
  "apiProvider": "nvidia-nim"
}
PS C:\Users\gajja\Documents\data-science\Gakrcli> gakrcli -h

 ██████   ░█████░   ██   ██   ██████
██        █░   ░█   ██  ██    ██   ██
██  ███   ███████   █████     ██████
██   ██   █░   ░█   ██  ██    ██  ██
 ██████   █░   ░█   ██   ██   ██   ██

  ✦ Open terminal for any LLM ✦

╔════════════════════════════════════════════════════════════╗
│ Provider  NVIDIA NIM                                       │
│ Model     stepfun-ai/step-3.7-flash                        │
│ Endpoint  https://integrate.api.nvidia.com/v1              │
╠════════════════════════════════════════════════════════════╣
│ ● cloud    Ready — type /help to begin                     │
╚════════════════════════════════════════════════════════════╝
  gakrcli v0.5.7

Usage: gakrcli [options] [command] [prompt]

GakrCLI - starts an interactive session by default, use -p/--print for non-interactive output

Arguments:
  prompt                                            Your prompt

Options:
  --add-dir <directories...>                        Additional directories to allow tool access to
  --agent <agent>                                   Agent for the current session. Overrides the 'agent' setting.
  --agents <json>                                   JSON object defining custom agents (e.g. '{"reviewer": {"description": "Reviews code", "prompt": "You are a     
                                                    code reviewer"}}')
  --allow-dangerously-skip-permissions              Enable bypassing all permission checks as an option, without it being enabled by default. Recommended only for  
                                                    sandboxes with no internet access.
  --allowedTools, --allowed-tools <tools...>        Comma or space-separated list of tool names to allow (e.g. "Bash(git:*) Edit")
  --append-system-prompt <prompt>                   Append a system prompt to the default system prompt
  --bare                                            Minimal mode: skip hooks, LSP, plugin sync, attribution, auto-memory, background prefetches, keychain reads,    
                                                    and GAKRCLI.md auto-discovery. Sets GAKR_CODE_SIMPLE=1. Anthropic auth is strictly ANTHROPIC_API_KEY or
                                                    apiKeyHelper via --settings (OAuth and keychain are never read). 3P providers (Bedrock/Vertex/Foundry) use      
                                                    their own credentials. Skills still resolve via /skill-name. Explicitly provide context via:
                                                    --system-prompt[-file], --append-system-prompt[-file], --add-dir (GAKRCLI.md dirs), --mcp-config, --settings,   
                                                    --agents, --plugin-dir.
  --betas <betas...>                                Beta headers to include in API requests (API key users only)
  --chrome                                          Enable GakrCLI in Chrome integration
  -c, --continue                                    Continue the most recent conversation in the current directory
  --dangerously-skip-permissions                    Bypass all permission checks. Recommended only for sandboxes with no internet access.
  -d, --debug [filter]                              Enable debug mode with optional category filtering (e.g., "api,hooks" or "!1p,!file")
  --debug-file <path>                               Write debug logs to a specific file path (implicitly enables debug mode)
  --disable-slash-commands                          Disable all skills
  --disallowedTools, --disallowed-tools <tools...>  Comma or space-separated list of tool names to deny (e.g. "Bash(git:*) Edit")
  --effort <level>                                  Effort level for the current session (low, medium, high, xhigh, max)
  --fallback-model <model>                          Enable automatic fallback to specified model when default model is overloaded
  --file <specs...>                                 File resources to download at startup. Format: file_id:relative_path (e.g., --file file_abc:doc.txt
                                                    file_def:img.png)
  --fork-session                                    When resuming, create a new session ID instead of reusing the original (use with --resume or --continue)        
  --from-pr [value]                                 Resume a session linked to a PR by PR number/URL, or open interactive picker with optional search term
  -h, --help                                        Display help for command
  --ide                                             Automatically connect to IDE on startup if exactly one valid IDE is available
  --include-hook-events                             Include all hook lifecycle events in the output stream (only works with --output-format=stream-json)
  --include-partial-messages                        Include partial message chunks as they arrive (only works with --print and --output-format=stream-json)
  --input-format <format>                           Input format (only works with --print): "text" (default), or "stream-json" (realtime streaming input) (choices: 
                                                    "text", "stream-json")
  --json-schema <schema>                            JSON Schema for structured output validation. Example:
                                                    {"type":"object","properties":{"name":{"type":"string"}},"required":["name"]}
  --max-budget-usd <amount>                         Maximum dollar amount to spend on API calls (only works with --print)
  --mcp-config <configs...>                         Load MCP servers from JSON files or strings (space-separated)
  --mcp-debug                                       [DEPRECATED. Use --debug instead] Enable MCP debug mode (shows MCP server errors)
  --model <model>                                   Model for the current session. Provide an alias for the latest model (e.g. 'sonnet' or 'opus') or a model's     
                                                    full name (e.g. 'claude-sonnet-4-6').
  -n, --name <name>                                 Set a display name for this session (shown in /resume and terminal title)
  --no-chrome                                       Disable GakrCLI in Chrome integration
  --no-session-persistence                          Disable session persistence - sessions will not be saved to disk and cannot be resumed (only works with
                                                    --print)
  --output-format <format>                          Output format (only works with --print): "text" (default), "json" (single result), or "stream-json" (realtime   
                                                    streaming) (choices: "text", "json", "stream-json")
  --permission-mode <mode>                          Permission mode to use for the session (choices: "acceptEdits", "bypassPermissions", "default", "dontAsk",      
                                                    "fullAccess", "plan", "auto")
  --plugin-dir <path>                               Load plugins from a directory for this session only (repeatable: --plugin-dir A --plugin-dir B) (default: [])   
  -p, --print                                       Print response and exit (useful for pipes). Note: The workspace trust dialog is skipped when GakrCLI is run     
                                                    with the -p mode. Only use this flag in directories you trust.
  --provider <provider>                             AI provider to use (anthropic, openai, gemini, github, bedrock, vertex, ollama). Reads API keys from
                                                    environment variables.
  --provider-env-file <path>                        Load provider environment variables from a file before validation (repeatable; existing values win) (default:   
                                                    [])
  --replay-user-messages                            Re-emit user messages from stdin back on stdout for acknowledgment (only works with --input-format=stream-json  
                                                    and --output-format=stream-json)
  -r, --resume [value]                              Resume a conversation by session ID, or open interactive picker with optional search term
  --session-id <uuid>                               Use a specific session ID for the conversation (must be a valid UUID)
  --setting-sources <sources>                       Comma-separated list of setting sources to load (user, project, local).
  --settings <file-or-json>                         Path to a settings JSON file or a JSON string to load additional settings from
  --strict-mcp-config                               Only use MCP servers from --mcp-config, ignoring all other MCP configurations
  --system-prompt <prompt>                          System prompt to use for the session
  --tmux                                            Create a tmux session for the worktree (requires --worktree). Uses iTerm2 native panes when available; use      
                                                    --tmux=classic for traditional tmux.
  --tools <tools...>                                Specify the list of available tools from the built-in set. Use "" to disable all tools, "default" to use all    
                                                    tools, or specify tool names (e.g. "Bash,Edit,Read").
  --verbose                                         Override verbose mode setting from config
  -v, --version                                     Output the version number
  -w, --worktree [name]                             Create a new git worktree for this session (optionally specify a name)

Commands:
  agents [options]                                  List configured agents
  auth                                              Manage authentication
  auto-mode                                         Inspect auto mode classifier configuration
  doctor                                            Check the health of your GakrCLI auto-updater. Note: The workspace trust dialog is skipped and stdio servers    
                                                    from .mcp.json are spawned for health checks. Only use this command in directories you trust.
  install [options] [target]                        Install GakrCLI native build. Use [target] to specify version (stable, latest, or specific version)
  mcp                                               Configure and manage MCP servers
  plugin|plugins                                    Manage GakrCLI plugins
  setup-token                                       Set up a long-lived authentication token (requires GakrCLI subscription)
  update|upgrade                                    Check for updates and install if available
PS C:\Users\gajja\Documents\data-science\Gakrcli> 

# GakrCLI Subcommands & Arguments Reference

> **Autobot 🧩** — Complete reference of all `gakrcli` CLI subcommands, flags, arguments, and use cases.
> Source: `src/main.tsx`, `src/commands/mcp/`, `src/cli/bg.ts`, `src/entrypoints/cli.tsx`

---

## Table of Contents

1. [Usage Overview](#usage-overview)
2. [Global Flags (Top-Level Options)](#global-flags-top-level-options)
3. [Subcommands](#subcommands)
   - [`gakrcli auth`](#gakrcli-auth)
   - [`gakrcli auth xai`](#gakrcli-auth-xai)
   - [`gakrcli mcp`](#gakrcli-mcp)
   - [`gakrcli plugin`](#gakrcli-plugin)
   - [`gakrcli plugin marketplace`](#gakrcli-plugin-marketplace)
   - [`gakrcli auto-mode`](#gakrcli-auto-mode)
   - [`gakrcli server`](#gakrcli-server)
   - [`gakrcli open`](#gakrcli-open)
   - [`gakrcli ssh`](#gakrcli-ssh)
   - [`gakrcli remote-control` / `gakrcli rc`](#gakrcli-remote-control)
   - [`gakrcli assistant`](#gakrcli-assistant)
4. [Top-Level Commands (No Subcommand Nesting)](#top-level-commands-no-subcommand-nesting)
5. [Background Session Commands](#background-session-commands)
6. [Feature-Gated Flags](#feature-gated-flags)
7. [Teammate/Agent Flags](#teammate-agent-flags)
8. [Environment Variables](#environment-variables)
9. [Usage Examples](#usage-examples)

---

## Usage Overview

```
gakrcli [global-flags] [prompt]
gakrcli [global-flags] <subcommand> [subcommand-flags] [arguments]
```

By default, `gakrcli` starts an **interactive session**. Pass `-p`/`--print` for non-interactive (pipe-friendly) output.

```
gakrcli -p "Write a Python script to sort a CSV"
```

---

## Global Flags (Top-Level Options)

These flags are defined on the root `gakrcli` command and affect the main session or are shared across subcommands via `passThroughOptions`.

### Session Mode & Output

| Flag | Alias | Description | Type |
|------|-------|-------------|------|
| `--print` | `-p` | Print response and exit (useful for pipes). Workspace trust dialog is skipped. | Boolean |
| `--output-format <format>` | — | Output format (only with `--print`). Choices: `text`, `json`, `stream-json` | String |
| `--json-schema <schema>` | — | JSON Schema for structured output validation. Example: `{"type":"object","properties":{"name":{"type":"string"}}}` | String |
| `--input-format <format>` | — | Input format (only with `--print`). Choices: `text`, `stream-json` | String |
| `--include-hook-events` | — | Include all hook lifecycle events in output stream (requires `--output-format=stream-json`) | Boolean |
| `--include-partial-messages` | — | Include partial message chunks as they arrive (requires `--print` + `--output-format=stream-json`) | Boolean |
| `--replay-user-messages` | — | Re-emit user messages from stdin back on stdout for acknowledgment (requires `--input-format=stream-json` + `--output-format=stream-json`) | Boolean |

### Session Behavior

| Flag | Alias | Description | Type |
|------|-------|-------------|------|
| `[prompt]` | — | Your prompt for the session (positional argument) | String |
| `--continue` | `-c` | Continue the most recent conversation in the current directory | Boolean |
| `--resume [value]` | `-r` | Resume a conversation by session ID, or open interactive picker with optional search term | String/Boolean |
| `--fork-session` | — | When resuming, create a new session ID instead of reusing the original (use with `--resume` or `--continue`) | Boolean |
| `--from-pr [value]` | — | Resume a session linked to a PR by PR number/URL, or open interactive picker with optional search term | String/Boolean |
| `--session-id <uuid>` | — | Use a specific session ID for the conversation (must be a valid UUID) | UUID |
| `--name <name>` | `-n` | Set a display name for this session (shown in `/resume` and terminal title) | String |
| `--no-session-persistence` | — | Disable session persistence — sessions will not be saved to disk (only with `--print`) | Boolean |
| `--resume-session-at <msg-id>` | — | When resuming, only messages up to and including the assistant message with `<message.id>` (use with `--resume` in print mode) | String |
| `--rewind-files <user-msg-id>` | — | Restore files to state at the specified user message and exit (requires `--resume`) | String |
| `--prefill <text>` | — | Pre-fill the prompt input with text without submitting it | String |
| `--deep-link-origin` | — | Signal that this session was launched from a deep link | Boolean |
| `--deep-link-repo <slug>` | — | Repo slug the deep link `?repo=` parameter resolved to the current cwd | String |
| `--deep-link-last-fetch <ms>` | — | `FETCH_HEAD` mtime in epoch ms, precomputed by the deep link trampoline | Number |

### Model & Provider

| Flag | Alias | Description | Type |
|------|-------|-------------|------|
| `--model <model>` | — | Model for the current session. Provide an alias (e.g. `sonnet`, `opus`) or full name (e.g. `claude-sonnet-4-6`) | String |
| `--provider <provider>` | — | AI provider to use. Options: `anthropic`, `openai`, `gemini`, `github`, `bedrock`, `vertex`, `ollama` | String |
| `--effort <level>` | — | Effort level for the current session: `low`, `medium`, `high`, `xhigh`, `max` | String |
| `--agent <agent>` | — | Agent for the current session. Overrides the `agent` setting | String |
| `--betas <betas...>` | — | Beta headers to include in API requests (API key users only) | String[] |
| `--fallback-model <model>` | — | Enable automatic fallback to specified model when default model is overloaded | String |
| `--thinking <mode>` | — | Thinking mode: `enabled` (equivalent to adaptive), `disabled` | String |
| `--max-thinking-tokens <tokens>` | — | [DEPRECATED] Maximum number of thinking tokens (only with `--print`) | Number |
| `--max-turns <turns>` | — | Maximum number of agentic turns in non-interactive mode (only with `--print`) | Number |
| `--max-budget-usd <amount>` | — | Maximum dollar amount to spend on API calls (only with `--print`) | Number |
| `--task-budget <tokens>` | — | API-side task budget in tokens (`output_config.task_budget`) | Number |
| `--workload <tag>` | — | Workload tag for billing-header attribution (`cc_workload`). Process-scoped; SDK daemon use (only with `--print`) | String |
| `--provider-env-file <path>` | — | Load provider environment variables from a file before validation (repeatable) | String[] |

### Debugging & Logging

| Flag | Alias | Description | Type |
|------|-------|-------------|------|
| `--debug [filter]` | `-d` | Enable debug mode with optional category filtering (e.g. `"api,hooks"` or `"!1p,!file"`) | String/Boolean |
| `--debug-to-stderr` | `-d2e` | Enable debug mode (to stderr) | Boolean |
| `--debug-file <path>` | — | Write debug logs to a specific file path (implicitly enables debug mode) | String |
| `--verbose` | — | Override verbose mode setting from config | Boolean |

### Permission & Security

| Flag | Alias | Description | Type |
|------|-------|-------------|------|
| `--dangerously-skip-permissions` | — | Bypass all permission checks. Recommended only for sandboxes with no internet access | Boolean |
| `--allow-dangerously-skip-permissions` | — | Enable bypassing all permission checks as an option, without it being enabled by default | Boolean |
| `--permission-mode <mode>` | — | Permission mode for the session. Choices: `default`, `accepted`, `bypassed`, `off`, `on`, `planned` (varies by build) | String |
| `--permission-prompt-tool <tool>` | — | MCP tool to use for permission prompts (only with `--print`) | String |

### Tools & MCP

| Flag | Alias | Description | Type |
|------|-------|-------------|------|
| `--allowedTools <tools...>` / `--allowed-tools <tools...>` | — | Comma or space-separated list of tool names to allow (e.g. `"Bash(git:*) Edit"`) | String[] |
| `--disallowedTools <tools...>` / `--disallowed-tools <tools...>` | — | Comma or space-separated list of tool names to deny (e.g. `"Bash(git:*) Edit"`) | String[] |
| `--tools <tools...>` | — | Specify the list of available tools from the built-in set. Use `""` to disable all, `"default"` for all tools, or specify tool names (e.g. `"Bash,Edit,Read"`) | String[] |
| `--mcp-config <configs...>` | — | Load MCP servers from JSON files or strings (space-separated) | String[] |
| `--strict-mcp-config` | — | Only use MCP servers from `--mcp-config`, ignoring all other MCP configurations | Boolean |
| `--mcp-debug` | — | [DEPRECATED] Enable MCP debug mode (shows MCP server errors) | Boolean |

### System Prompt

| Flag | Alias | Description | Type |
|------|-------|-------------|------|
| `--system-prompt <prompt>` | — | System prompt to use for the session | String |
| `--system-prompt-file <file>` | — | Read system prompt from a file | String |
| `--append-system-prompt <prompt>` | — | Append a system prompt to the default system prompt | String |
| `--append-system-prompt-file <file>` | — | Read system prompt from a file and append to the default system prompt | String |

### Configuration

| Flag | Alias | Description | Type |
|------|-------|-------------|------|
| `--settings <file-or-json>` | — | Path to a settings JSON file or a JSON string to load additional settings from | String |
| `--setting-sources <sources>` | — | Comma-separated list of setting sources to load: `user`, `project`, `local` | String |
| `--plugin-dir <path>` | — | Load plugins from a directory for this session only (repeatable: `--plugin-dir A --plugin-dir B`) | String[] |
| `--disable-slash-commands` | — | Disable all skills | Boolean |
| `--agents <json>` | — | JSON object defining custom agents (e.g. `'{"reviewer": {"description": "Reviews code", "prompt": "You are a code reviewer"}}'`) | JSON |
| `--add-dir <directories...>` | — | Additional directories to allow tool access to | String[] |

### Modes

| Flag | Alias | Description | Type |
|------|-------|-------------|------|
| `--bare` | — | Minimal mode: skip hooks, LSP, plugin sync, attribution, auto-memory, background prefetches, keychain reads, and GAKRCLI.md auto-discovery. Sets `GAKR_CODE_SIMPLE=1` | Boolean |
| `--init` | — | Run Setup hooks with init trigger, then continue | Boolean |
| `--init-only` | — | Run Setup and SessionStart:startup hooks, then exit | Boolean |
| `--maintenance` | — | Run Setup hooks with maintenance trigger, then continue | Boolean |
| `--proactive` | — | Start in proactive autonomous mode (feature-gated) | Boolean |
| `--brief` | — | Enable SendUserMessage tool for agent-to-user communication (feature-gated) | Boolean |
| `--assistant` | — | Force assistant mode (Agent SDK daemon use) | Boolean |
| `--chrome` | — | Enable GakrCLI in Chrome integration | Boolean |
| `--no-chrome` | — | Disable GakrCLI in Chrome integration | Boolean |

### Background & Worktree

| Flag | Alias | Description | Type |
|------|-------|-------------|------|
| `--bg` / `--background` | — | Run the session in the background (detached child process) | Boolean |
| `--worktree [name]` | `-w` | Create a new git worktree for this session (optionally specify a name) | String/Boolean |
| `--tmux` | — | Create a tmux session for the worktree (requires `--worktree`). Uses iTerm2 native panes when available; use `--tmux=classic` for traditional tmux | Boolean |

### IDE Integration

| Flag | Alias | Description | Type |
|------|-------|-------------|------|
| `--ide` | — | Automatically connect to IDE on startup if exactly one valid IDE is available | Boolean |

### Files

| Flag | Alias | Description | Type |
|------|-------|-------------|------|
| `--file <specs...>` | — | File resources to download at startup. Format: `file_id:relative_path` (e.g. `--file file_abc:doc.txt file_def:img.png`) | String[] |

### Other

| Flag | Alias | Description | Type |
|------|-------|-------------|------|
| `--version` | `-v` | Output the version number | Boolean |
| `--help` | `-h` | Display help for command | Boolean |
| `--enable-auth-status` | — | Enable auth status messages in SDK mode | Boolean |

---

## Subcommands

---

### `gakrcli auth`

Manage authentication for Anthropic and third-party providers.

**Parent:** `gakrcli auth`
**Description:** Manage authentication

| Subcommand | Description |
|------------|-------------|
| `auth login` | Sign in to your Anthropic account |
| `auth status` | Show authentication status |
| `auth logout` | Log out from your Anthropic account |
| `auth xai` | Sign in to xAI (Grok) with browser OAuth or device code |

#### `gakrcli auth login`

Sign in to your Anthropic account.

| Flag | Description | Type |
|------|-------------|------|
| `--email <email>` | Pre-populate email address on the login page | String |
| `--sso` | Force SSO login flow | Boolean |
| `--console` | Use Anthropic Console (API usage billing) instead of GakrCLI subscription | Boolean |
| `--gakrcliai` | Use GakrCLI subscription (default) | Boolean |

#### `gakrcli auth status`

Show authentication status.

| Flag | Description | Type |
|------|-------------|------|
| `--json` | Output as JSON (default) | Boolean |
| `--text` | Output as human-readable text | Boolean |

#### `gakrcli auth logout`

Log out from your Anthropic account. No additional flags.

#### `gakrcli auth xai`

**Parent:** `gakrcli auth xai`
**Description:** Sign in to xAI (Grok) with browser OAuth or device code

| Subcommand | Description |
|------------|-------------|
| `xai login` | Browser OAuth sign-in for an xAI account |
| `xai device` | Device-code sign-in for remote hosts (no localhost callback needed) |
| `xai logout` | Clear stored xAI OAuth credentials |
| `xai status` | Show xAI OAuth credential status |

---

### `gakrcli mcp`

Configure and manage MCP (Model Context Protocol) servers.

**Parent:** `gakrcli mcp`
**Description:** Configure and manage MCP servers

| Subcommand | Description |
|------------|-------------|
| `mcp serve` | Start the GakrCLI MCP server |
| `mcp add` | Add an MCP server |
| `mcp add-json` | Add an MCP server with a JSON string |
| `mcp add-from-gakrcli-desktop` | Import MCP servers from GakrCLI Desktop |
| `mcp remove` | Remove an MCP server |
| `mcp list` | List configured MCP servers |
| `mcp get` | Get details about an MCP server |
| `mcp doctor` | Diagnose MCP configuration |
| `mcp reset-project-choices` | Reset all approved/rejected project-scoped (.mcp.json) servers |
| `mcp xaa` | Manage the XAA (SEP-990) IdP connection |

#### `gakrcli mcp serve`

Start the GakrCLI MCP server.

| Flag | Alias | Description | Type |
|------|-------|-------------|------|
| `--debug` | `-d` | Enable debug mode | Boolean |
| `--verbose` | — | Override verbose mode setting from config | Boolean |

#### `gakrcli mcp add <name> <commandOrUrl> [args...]`

Add an MCP server to GakrCLI.

| Flag | Alias | Description | Type | Default |
|------|-------|-------------|------|---------|
| `--scope <scope>` | `-s` | Configuration scope: `local`, `user`, or `project` | String | `local` |
| `--transport <transport>` | `-t` | Transport type: `stdio`, `sse`, `http` | String | `stdio` |
| `--env <env...>` | `-e` | Set environment variables (e.g. `-e KEY=value`) | String[] | — |
| `--header <header...>` | `-H` | Set WebSocket headers (e.g. `-H "X-Api-Key: abc123"`) | String[] | — |
| `--client-id <clientId>` | — | OAuth client ID for HTTP/SSE servers | String | — |
| `--client-secret` | — | Prompt for OAuth client secret (or set `MCP_CLIENT_SECRET` env var) | Boolean | — |
| `--callback-port <port>` | — | Fixed port for OAuth callback (for servers requiring pre-registered redirect URIs) | Number | — |
| `--xaa` | — | Enable XAA (SEP-990) for this server. Requires `mcp xaa setup` first + `--client-id` + `--client-secret` | Boolean | — |

#### `gakrcli mcp add-json <name> <json>`

Add an MCP server (stdio or SSE) with a JSON string.

| Flag | Alias | Description | Type | Default |
|------|-------|-------------|------|---------|
| `--scope <scope>` | `-s` | Configuration scope: `local`, `user`, or `project` | String | `local` |
| `--client-secret` | — | Prompt for OAuth client secret (or set `MCP_CLIENT_SECRET` env var) | Boolean | — |

#### `gakrcli mcp add-from-gakrcli-desktop`

Import MCP servers from GakrCLI Desktop (Mac and WSL only).

| Flag | Alias | Description | Type | Default |
|------|-------|-------------|------|---------|
| `--scope <scope>` | `-s` | Configuration scope: `local`, `user`, or `project` | String | `local` |

#### `gakrcli mcp remove <name>`

Remove an MCP server.

| Flag | Alias | Description | Type |
|------|-------|-------------|------|
| `--scope <scope>` | `-s` | Configuration scope (`local`, `user`, or `project`) — if not specified, removes from whichever scope it exists in | String |

#### `gakrcli mcp list`

List configured MCP servers. No additional flags.

> **Note:** The workspace trust dialog is skipped and stdio servers from `.mcp.json` are spawned for health checks. Only use in directories you trust.

#### `gakrcli mcp get <name>`

Get details about an MCP server. No additional flags.

> **Note:** The workspace trust dialog is skipped and stdio servers from `.mcp.json` are spawned for health checks. Only use in directories you trust.

#### `gakrcli mcp doctor [name]`

Diagnose MCP configuration, precedence, disabled/pending state, and connection health.

| Flag | Alias | Description | Type |
|------|-------|-------------|------|
| `--scope <scope>` | `-s` | Restrict config analysis to a specific scope (`local`, `project`, `user`, or `enterprise`) | String |
| `--config-only` | — | Skip live connection checks and only analyze configuration state | Boolean |
| `--json` | — | Output the diagnostics report as JSON | Boolean |

> **Note:** Unless `--config-only` is used, stdio servers may be spawned and remote servers may be contacted. Only use in directories you trust.

#### `gakrcli mcp reset-project-choices`

Reset all approved and rejected project-scoped (`.mcp.json`) servers within this project. No additional flags.

#### `gakrcli mcp xaa`

Manage the XAA (SEP-990) IdP connection.

**Parent:** `gakrcli mcp xaa`
**Description:** Manage the XAA (SEP-990) IdP connection

| Subcommand | Description |
|------------|-------------|
| `xaa setup` | Configure the IdP connection (one-time setup for all XAA-enabled servers) |
| `xaa login` | Cache an IdP id_token so XAA-enabled MCP servers authenticate silently |
| `xaa show` | Show the current IdP connection config |
| `xaa clear` | Clear the IdP connection config and cached id_token |

##### `gakrcli mcp xaa setup`

Configure the IdP connection (one-time setup for all XAA-enabled servers).

| Flag | Description | Type |
|------|-------------|------|
| `--issuer <url>` | **(Required)** IdP issuer URL (OIDC discovery) | URL |
| `--client-id <id>` | **(Required)** GakrCLI Code's client_id at the IdP | String |
| `--client-secret` | Read IdP client secret from `MCP_XAA_IDP_CLIENT_SECRET` env var | Boolean |
| `--callback-port <port>` | Fixed loopback callback port (only if IdP does not honor RFC 8252 port-any matching) | Number |

##### `gakrcli mcp xaa login`

Cache an IdP id_token.

| Flag | Description | Type |
|------|-------------|------|
| `--force` | Ignore any cached id_token and re-login (useful after IdP-side revocation) | Boolean |
| `--id-token <jwt>` | Write this pre-obtained id_token directly to cache, skipping the OIDC browser login | String |

##### `gakrcli mcp xaa show`

Show the current IdP connection config. No additional flags.

##### `gakrcli mcp xaa clear`

Clear the IdP connection config and cached id_token. No additional flags.

---

### `gakrcli plugin`

Manage GakrCLI plugins.

**Alias:** `gakrcli plugins`
**Parent:** `gakrcli plugin`
**Description:** Manage GakrCLI plugins

| Subcommand | Alias | Description |
|------------|-------|-------------|
| `plugin validate <path>` | — | Validate a plugin or marketplace manifest |
| `plugin list` | — | List installed plugins |
| `plugin install <plugin>` | `i` | Install a plugin from available marketplaces |
| `plugin uninstall <plugin>` | `remove`, `rm` | Uninstall an installed plugin |
| `plugin enable <plugin>` | — | Enable a disabled plugin |
| `plugin disable [plugin]` | — | Disable an enabled plugin |
| `plugin update <plugin>` | — | Update a plugin to the latest version |
| `plugin marketplace` | — | Manage GakrCLI marketplaces |

**Hidden common flag on all plugin subcommands:**

| Flag | Description | Type |
|------|-------------|------|
| `--cowork` | Use cowork_plugins directory | Boolean |

#### `gakrcli plugin validate <path>`

Validate a plugin or marketplace manifest. No additional flags beyond `--cowork`.

#### `gakrcli plugin list`

List installed plugins.

| Flag | Description | Type |
|------|-------------|------|
| `--json` | Output as JSON | Boolean |
| `--available` | Include available plugins from marketplaces (requires `--json`) | Boolean |

#### `gakrcli plugin install <plugin> (-- i)`

Install a plugin from available marketplaces. Use `plugin@marketplace` for specific marketplace.

| Flag | Alias | Description | Type | Default |
|------|-------|-------------|------|---------|
| `--scope <scope>` | `-s` | Installation scope: `user`, `project`, or `local` | String | `user` |

#### `gakrcli plugin uninstall <plugin> (-- remove, rm)`

Uninstall an installed plugin.

| Flag | Alias | Description | Type | Default |
|------|-------|-------------|------|---------|
| `--scope <scope>` | `-s` | Uninstall from scope: `user`, `project`, or `local` | String | `user` |
| `--keep-data` | — | Preserve the plugin's persistent data directory (`~/.gakrcli/plugins/data/{id}/`) | Boolean | — |

#### `gakrcli plugin enable <plugin>`

Enable a disabled plugin.

| Flag | Alias | Description | Type | Default |
|------|-------|-------------|------|---------|
| `--scope <scope>` | `-s` | Installation scope: `user`, `project`, `local` (default: auto-detect) | String | auto-detect |

#### `gakrcli plugin disable [plugin]`

Disable an enabled plugin.

| Flag | Alias | Description | Type |
|------|-------|-------------|------|
| `--all` | `-a` | Disable all enabled plugins | Boolean |
| `--scope <scope>` | `-s` | Installation scope: `user`, `project`, `local` (default: auto-detect) | String |

#### `gakrcli plugin update <plugin>`

Update a plugin to the latest version (restart required to apply).

| Flag | Alias | Description | Type | Default |
|------|-------|-------------|------|---------|
| `--scope <scope>` | `-s` | Installation scope | String | `user` |

---

### `gakrcli plugin marketplace`

Manage GakrCLI marketplaces.

**Parent:** `gakrcli plugin marketplace`
**Description:** Manage GakrCLI marketplaces

| Subcommand | Alias | Description |
|------------|-------|-------------|
| `marketplace add <source>` | — | Add a marketplace from a URL, path, or GitHub repo |
| `marketplace list` | — | List all configured marketplaces |
| `marketplace remove <name>` | `rm` | Remove a configured marketplace |
| `marketplace update [name]` | — | Update marketplace(s) from their source — updates all if no name specified |

#### `gakrcli marketplace add <source>`

Add a marketplace from a URL, path, or GitHub repo.

| Flag | Description | Type |
|------|-------------|------|
| `--sparse <paths...>` | Limit checkout to specific directories via git sparse-checkout (for monorepos). Example: `--sparse .gakrcli-plugin plugins` | String[] |
| `--scope <scope>` | Where to declare the marketplace: `user` (default), `project`, or `local` | String |

#### `gakrcli marketplace list`

List all configured marketplaces.

| Flag | Description | Type |
|------|-------------|------|
| `--json` | Output as JSON | Boolean |

#### `gakrcli marketplace remove <name>` / `rm`

Remove a configured marketplace. No additional flags.

#### `gakrcli marketplace update [name]`

Update marketplace(s) from their source — updates all if no name specified. No additional flags.

---

### `gakrcli auto-mode`

Inspect auto mode classifier configuration. (Feature-gated by `TRANSCRIPT_CLASSIFIER`)

**Parent:** `gakrcli auto-mode`
**Description:** Inspect auto mode classifier configuration

| Subcommand | Description |
|------------|-------------|
| `auto-mode defaults` | Print the default auto mode environment, allow, and deny rules as JSON |
| `auto-mode config` | Print the effective auto mode config as JSON: your settings where set, defaults otherwise |
| `auto-mode critique` | Get AI feedback on your custom auto mode rules |

#### `gakrcli auto-mode critique`

Get AI feedback on your custom auto mode rules.

| Flag | Description | Type |
|------|-------------|------|
| `--model <model>` | Override which model is used | String |

---

### `gakrcli server`

Start an GakrCLI session server. (Feature-gated by `DIRECT_CONNECT`)

| Flag | Description | Type | Default |
|------|-------------|------|---------|
| `--port <number>` | HTTP port | Number | `0` |
| `--host <string>` | Bind address | String | `0.0.0.0` |
| `--auth-token <token>` | Bearer token for auth | String | auto-generated |
| `--unix <path>` | Listen on a unix domain socket | String | — |
| `--workspace <dir>` | Default working directory for sessions that do not specify cwd | String | — |
| `--idle-timeout <ms>` | Idle timeout for detached sessions in ms (`0` = never expire) | Number | `600000` |
| `--max-sessions <n>` | Maximum concurrent sessions (`0` = unlimited) | Number | `32` |

---

### `gakrcli open <cc-url>`

Connect to an GakrCLI server (internal — use `cc://` URLs). (Feature-gated by `DIRECT_CONNECT`)

| Flag | Alias | Description | Type |
|------|-------|-------------|------|
| `--print [prompt]` | `-p` | Print mode (headless) | String/Boolean |
| `--output-format <format>` | — | Output format: `text`, `json`, `stream-json` | String |

---

### `gakrcli ssh <host> [dir]`

Run GakrCLI on a remote host over SSH. (Feature-gated by `SSH_REMOTE`)

| Flag | Description | Type |
|------|-------------|------|
| `--permission-mode <mode>` | Permission mode for the remote session | String |
| `--dangerously-skip-permissions` | Skip all permission prompts on the remote (dangerous) | Boolean |
| `--local` | e2e test mode — spawn the child CLI locally (skip ssh/deploy) | Boolean |

---

### `gakrcli remote-control` / `gakrcli rc`

Connect your local environment for remote-control sessions via `gakrcli.ai/code`. (Feature-gated by `BRIDGE_MODE`)

Hidden command — handled by fast-path before main CLI loads.

### `gakrcli assistant [sessionId]`

Attach the REPL as a client to a running bridge session. Discovers sessions via API if no sessionId given. (Feature-gated by `KAIROS`)

---

## Top-Level Commands (No Subcommand Nesting)

These are standalone commands registered directly on the root `gakrcli` program.

| Command | Alias | Description |
|---------|-------|-------------|
| `gakrcli setup-token` | — | Set up a long-lived authentication token (requires GakrCLI subscription) |
| `gakrcli agents` | — | List configured agents |
| `gakrcli doctor` | — | Check the health of your GakrCLI auto-updater |
| `gakrcli update` | `upgrade` | Check for updates and install if available |
| `gakrcli install [target]` | — | Install GakrCLI native build. Use `[target]` to specify version: `stable`, `latest`, or specific version |

### `gakrcli agents`

List configured agents.

| Flag | Description | Type |
|------|-------------|------|
| `--setting-sources <sources>` | Comma-separated list of setting sources to load (`user`, `project`, `local`) | String |

### `gakrcli install [target]`

Install GakrCLI native build.

| Flag | Alias | Description | Type |
|------|-------|-------------|------|
| `--force` | — | Force installation even if already installed | Boolean |

---

## Background Session Commands

These are not Commander subcommands but are handled via the `--bg`/`--background` flag and dedicated handler functions in `src/cli/bg.ts`. They manage background (detached) sessions.

### `gakrcli --bg [--name <name>] "<prompt>"`

Launch a session in the background as a detached child process.

| Flag | Alias | Description | Type |
|------|-------|-------------|------|
| `--bg` / `--background` | — | Run session in background | Boolean |
| `--name <name>` | `-n` | Assign a name to the background session | String |

### `gakrcli ps`

List all background sessions with their status.

| Command | Description |
|---------|-------------|
| `ps` | List all background sessions (ID, STATUS, PID, NAME, STARTED, CWD) |

### `gakrcli logs <id-or-name> [-f] [--stderr]`

View logs of a background session.

| Flag | Alias | Description | Type |
|------|-------|-------------|------|
| `--follow` | `-f` | Follow (tail) the log output | Boolean |
| `--stderr` | — | View stderr log instead of stdout | Boolean |
| `--stdout` | — | View stdout log (default) | Boolean |

### `gakrcli attach <id-or-name>`

Attach to a running background session (not yet implemented for local sessions — use `gakrcli logs <id> -f` instead).

### `gakrcli kill <id-or-name>`

Kill a running background session.

---

## Feature-Gated Flags

These flags are conditionally available based on build-time or runtime feature flags.

| Flag | Feature Gate | Description |
|------|-------------|-------------|
| `--advisor <model>` | `canUserConfigureAdvisor()` | Enable the server-side advisor tool with the specified model |
| `--enable-auto-mode` | `TRANSCRIPT_CLASSIFIER` | Opt in to auto mode |
| `--proactive` | `PROACTIVE` or `KAIROS` | Start in proactive autonomous mode |
| `--messaging-socket-path <path>` | `UDS_INBOX` | Unix domain socket path for the UDS messaging server |
| `--brief` | `KAIROS` or `KAIROS_BRIEF` | Enable SendUserMessage tool for agent-to-user communication |
| `--assistant` | `KAIROS` | Force assistant mode (Agent SDK daemon use) |
| `--channels <servers...>` | `KAIROS` or `KAIROS_CHANNELS` | MCP servers whose channel notifications should register this session |
| `--dangerously-load-development-channels <servers...>` | `KAIROS` or `KAIROS_CHANNELS` | Load channel servers not on the approved allowlist |
| `--remote-control [name]` / `--rc [name]` | `BRIDGE_MODE` | Start an interactive session with Remote Control enabled |
| `--hard-fail` | `HARD_FAIL` | Crash on logError calls instead of silently logging |
| `--teleport [session]` | All builds (hidden) | Resume a teleport session |
| `--remote [description]` | All builds (hidden) | Create a remote session |
| `--sdk-url <url>` | All builds (hidden) | Use remote WebSocket endpoint for SDK I/O streaming |

---

## Teammate / Agent Flags

Used internally when spawning sub-agents (teammates) in tmux or in-process mode.

| Flag | Description | Type |
|------|-------------|------|
| `--agent-id <id>` | Teammate agent ID | String |
| `--agent-name <name>` | Teammate display name | String |
| `--team-name <name>` | Team name for swarm coordination | String |
| `--agent-color <color>` | Teammate UI color | String |
| `--plan-mode-required` | Require plan mode before implementation | Boolean |
| `--parent-session-id <id>` | Parent session ID for analytics correlation | String |
| `--teammate-mode <mode>` | How to spawn teammates: `auto`, `tmux`, or `in-process` | String |
| `--agent-type <type>` | Custom agent type for this teammate | String |

---

## Environment Variables

Key environment variables that affect the CLI behavior.

| Variable | Description |
|----------|-------------|
| `GAKR_CODE_DISABLE_EXPERIMENTAL_BETAS` | Disable experimental API betas (default: `true`) |
| `GAKR_CODE_SIMPLE` | Set by `--bare` mode; enables minimal mode |
| `GAKR_CODE_PROACTIVE` | Enable proactive mode via env var |
| `GAKR_CODE_BRIEF` | Enable brief mode via env var |
| `GAKR_CODE_ENTRYPOINT` | Set to `bg` for background child processes |
| `GAKR_CODE_SESSION_KIND` | Set to `bg` for background child processes |
| `GAKR_CODE_SESSION_LOG` | Log file path for background sessions |
| `GAKR_CODE_SESSION_NAME` | Session name for background sessions |
| `GAKR_HEAP_RELAUNCHED` | Set when the process has been relaunched with a larger heap |
| `GAKR_DISABLE_HEAP_RELAUNCH` | Disable heap relaunch behavior |
| `GAKR_NODE_MAX_OLD_SPACE_SIZE_MB` | Max old space size in MB for Node.js |
| `GAKR_MAX_MEMORY_MB` | Set from `--max-memory=` flag for max memory |
| `MCP_CLIENT_SECRET` | OAuth client secret for MCP servers |
| `MCP_XAA_IDP_CLIENT_SECRET` | IdP client secret for XAA (SEP-990) |
| `COREPACK_ENABLE_AUTO_PIN` | Set to `0` to disable corepack auto-pinning |
| `NODE_OPTIONS` | Node.js options (checked for `--max-old-space-size` and `--expose-gc`) |

### Heap Relaunch

The `bin/gakrcli` entrypoint automatically relaunches the process with a larger heap (default 8192 MB) if not already relaunched. Controlled by:

- `--max-memory=<MB>` flag (inline, before subcommand)
- `GAKR_NODE_MAX_OLD_SPACE_SIZE_MB` env var (default: `8192`)
- `GAKR_DISABLE_HEAP_RELAUNCH=1` to opt out
- `GAKR_HEAP_RELAUNCHED=1` (set automatically after relaunch)

---

## Usage Examples

### Basic Interactive Session

```bash
gakrcli
gakrcli "Write a Python script to parse CSV files"
```

### Print Mode (Non-Interactive)

```bash
# Simple print
gakrcli -p "List all files in the current directory"

# With model and provider
gakrcli -p --model sonnet --provider anthropic "Explain this code"

# JSON output
gakrcli -p --output-format json "Generate a JSON config"

# Streaming JSON output
gakrcli -p --output-format stream-json "Analyze this log file"
```

### Provider & Model Selection

```bash
gakrcli --provider openai --model gpt-4o "Hello"
gakrcli --provider gemini --model gemini-2.0-flash "Hello"
gakrcli --provider ollama --model llama3 "Hello"
gakrcli --provider bedrock --model anthropic.claude-sonnet-4 "Hello"

# With effort level
gakrcli -p --effort high --model sonnet "Solve this complex problem"

# Load provider env vars from file
gakrcli --provider-env-file .env.provider --provider openai "Hello"
```

### Session Management

```bash
# Continue most recent session
gakrcli -c

# Resume a specific session
gakrcli -r <session-id>

# Resume with fork (new session ID)
gakrcli --resume <session-id> --fork-session

# Resume linked to a PR
gakrcli --from-pr 42

# Name your session
gakrcli -n "my-session" "Build a todo app"

# Disable session persistence
gakrcli -p --no-session-persistence "Run once and forget"
```

### Debug Mode

```bash
# Basic debug
gakrcli --debug "Debug this"

# Filtered debug categories
gakrcli --debug "api,hooks" "Test API"

# Exclude categories
gakrcli --debug "!1p,!file" "Debug without noise"

# Debug to stderr
gakrcli --debug-to-stderr "Debug to stderr"

# Debug to file
gakrcli --debug-file /tmp/debug.log "Debug with file output"
```

### MCP Server Management

```bash
# Add a stdio MCP server
gakrcli mcp add my-server -- npx my-mcp-server

# Add with env vars
gakrcli mcp add -e API_KEY=xxx my-server -- npx my-mcp-server

# Add an SSE MCP server
gakrcli mcp add --transport sse sentry https://mcp.sentry.dev/mcp

# Add an HTTP MCP server
gakrcli mcp add --transport http corridor https://app.corridor.dev/api/mcp

# Add with OAuth
gakrcli mcp add --transport http --client-id myclient --client-secret \
  my-api https://api.example.com/mcp

# Add with headers
gakrcli mcp add --transport http my-api https://api.example.com/mcp \
  -H "Authorization: Bearer xxx"

# Add via JSON
gakrcli mcp add-json my-server '{"type":"stdio","command":"npx","args":["my-mcp"]}'

# List all MCP servers
gakrcli mcp list

# Get MCP server details
gakrcli mcp get my-server

# Remove an MCP server
gakrcli mcp remove my-server

# Diagnose MCP health
gakrcli mcp doctor
gakrcli mcp doctor --json
gakrcli mcp doctor --config-only

# Import from GakrCLI Desktop
gakrcli mcp add-from-gakrcli-desktop

# Reset project choices
gakrcli mcp reset-project-choices

# Start the MCP server
gakrcli mcp serve --debug
```

### Plugin Management

```bash
# List installed plugins
gakrcli plugin list
gakrcli plugin list --json --available

# Install a plugin
gakrcli plugin install my-plugin
gakrcli plugin install my-plugin@marketplace-name

# Uninstall a plugin
gakrcli plugin uninstall my-plugin
gakrcli plugin uninstall my-plugin --keep-data

# Enable/disable a plugin
gakrcli plugin enable my-plugin
gakrcli plugin disable my-plugin
gakrcli plugin disable --all

# Update a plugin
gakrcli plugin update my-plugin

# Validate a plugin manifest
gakrcli plugin validate ./path/to/manifest.json

# Marketplace management
gakrcli plugin marketplace add https://github.com/user/repo
gakrcli plugin marketplace add --sparse plugins ./local-path
gakrcli plugin marketplace list --json
gakrcli plugin marketplace remove my-marketplace
gakrcli plugin marketplace update
gakrcli plugin marketplace update my-marketplace
```

### Auth Management

```bash
# Login to Anthropic
gakrcli auth login
gakrcli auth login --email user@example.com
gakrcli auth login --sso
gakrcli auth login --console

# Auth status
gakrcli auth status
gakrcli auth status --text
gakrcli auth status --json

# Logout
gakrcli auth logout

# xAI auth
gakrcli auth xai login
gakrcli auth xai device
gakrcli auth xai status
gakrcli auth xai logout
```

### Background Sessions

```bash
# Start a background session
gakrcli --bg --name my-task "Process all the files"
gakrcli --background "Long running task" --model sonnet

# List background sessions
gakrcli ps

# View logs
gakrcli logs <session-id>
gakrcli logs my-task -f
gakrcli logs <session-id> --stderr

# Kill a background session
gakrcli kill <session-id>
gakrcli kill my-task
```

### Permission Modes

```bash
# Bypass all permissions (sandbox only!)
gakrcli --dangerously-skip-permissions "Do everything"

# Allow the flag to exist as an option
gakrcli --allow-dangerously-skip-permissions --dangerously-skip-permissions "..."

# Specific permission mode
gakrcli --permission-mode on "Build this app"
```

### Tool Filtering

```bash
# Allow only specific tools
gakrcli --allowed-tools "Bash,Edit,Read" "Do specific tasks"

# Disallow specific tools
gakrcli --disallowed-tools "Bash(git:*)" "Do tasks without git"

# Specify exact tool set
gakrcli --tools "Bash,Edit,Read" "Limited tool set"
gakrcli --tools "" "No tools at all"
```

### System Prompts

```bash
# Custom system prompt
gakrcli --system-prompt "You are a senior Rust engineer" "Review this code"

# Load from file
gakrcli --system-prompt-file ./prompt.txt "Execute this prompt"

# Append to default prompt
gakrcli --append-system-prompt "Be very concise" "Hello"

# Append from file
gakrcli --append-system-prompt-file ./extra.txt "Hello"
```

### Minimal Mode

```bash
gakrcli --bare "Run with minimal overhead"
```

### Data Input Format

```bash
# Streaming JSON input
echo '{"message": "Hello"}' | gakrcli -p --input-format stream-json

# With streaming JSON output
echo '{"message": "Hi"}' | gakrcli -p \
  --input-format stream-json \
  --output-format stream-json \
  --include-hook-events \
  --include-partial-messages \
  --replay-user-messages
```

### Worktree Mode

```bash
# Create a worktree session
gakrcli -w "Refactor this module"

# With a specific worktree name
gakrcli -w my-feature "Implement new feature"

# With tmux
gakrcli -w -w my-feature --tmux "Complex refactor"
```

### Additional Directory Access

```bash
gakrcli --add-dir /path/to/data /path/to/config \
  "Read files from these directories"
```

### Custom Agents

```bash
gakrcli --agents '{"reviewer":{"description":"Reviews code","prompt":"You are a code reviewer"}}' \
  "Review this PR"
```

### Installation & Updates

```bash
# Update GakrCLI
gakrcli update
gakrcli upgrade

# Install GakrCLI
gakrcli install
gakrcli install stable
gakrcli install latest
gakrcli install 0.5.7
gakrcli install --force
```

### Setup Token

```bash
gakrcli setup-token
```

### Doctor / Health Check

```bash
gakrcli doctor
```

### List Agents

```bash
gakrcli agents
gakrcli agents --setting-sources user,project
```

### Server Mode

```bash
# Start server on specific port
gakrcli server --port 8080 --host 0.0.0.0

# With auth token
gakrcli server --auth-token sk-ant-my-token

# Unix socket
gakrcli server --unix /tmp/gakrcli.sock

# With custom idle timeout and session limit
gakrcli server --idle-timeout 300000 --max-sessions 50

# With workspace directory
gakrcli server --workspace /home/user/projects
```

### SSH Remote

```bash
# Connect to remote host
gakrcli ssh user@remote-host

# With specific directory
gakrcli ssh user@remote-host /path/to/project

# With custom permission mode
gakrcli ssh user@remote-host --permission-mode on
```

### Connect to Server (cc:// URLs)

```bash
gakrcli open cc://server-url?token=abc123
gakrcli open cc://server-url -p "Run this command"
gakrcli open cc://server-url --output-format json -p "Get JSON output"
```

### Auto Mode (Feature-Gated)

```bash
# View defaults
gakrcli auto-mode defaults

# View effective config
gakrcli auto-mode config

# Get AI feedback on rules
gakrcli auto-mode critique
gakrcli auto-mode critique --model sonnet
```

### Structured Output

```bash
gakrcli -p --json-schema '{"type":"object","properties":{"name":{"type":"string"},"age":{"type":"number"}},"required":["name"]}' \
  "Extract name and age from this text"
```

### Memory & Heap Control

```bash
# Set max memory for the process
gakrcli --max-memory=4096 "Run with 4GB heap"
```

# overview

*Source: https://gakrcli.netlify.app/docs/*

gakrcli is an open-source coding agent CLI that runs in your terminal and connects to any AI model provider.

## how it works

Run it in any repository. The agent sees your file structure, reads and writes code, runs shell commands, and iterates on tasks autonomously — with every tool call and diff streamed to your terminal in real time.

Type your goal in natural language: `add pagination to the user list, then run the tests`. The agent plans, executes, and presents a diff for you to review before any change is committed.

## provider support

gakrcli works with every major AI provider out of the box — no rewrites, no plugins, no platform lock-in:

- **OpenAI-compatible** — OpenAI, OpenRouter, DeepSeek, Groq, Mistral, LM Studio, and any other /v1 server
- **Google Gemini** — API-key auth
- **GitHub Models** — Interactive OAuth onboarding via `/onboard-github`
- **Anthropic** — API key or account login
- **Ollama** — Local inference, no API key required
- **Bedrock / Vertex** — Cloud enterprise routes
- **NEAR AI** — Unified gateway with Claude, GPT, Gemini, and open models
- **Xiaomi MiMo**, **OpenCode Zen**, **Atomic Chat**, **Hicap** — Plus many more

Switch providers mid-session with `/provider` or set a default with environment variables. See the [provider guide](https://gakrcli.netlify.app/docs/providers/) for the full list.

## features

- **Real tools, not just chat** — Bash, file edits, grep, glob, MCP servers, skills, and plugins — all wired into the agent loop
- **Streaming diffs** — Watch the agent think, call tools, and produce diffs live. Every change stays reviewable
- **Non-interactive mode** — `--print` mode with JSON and `stream-json` output, tool allowlists, budgets, and session control
- **Session management** — Resume, branch, and rewind conversations. Background tasks, worktree isolation, remote session from your phone
- **Per-repo profiles** — Save model, base URL, auth, and runtime defaults so every clone boots the same way
- **MCP + plugins** — Extend the agent with MCP servers for web browsing, database queries, and custom toolchains
- **SSH remote sessions** — Run gakrcli on a remote machine with local API auth tunnelled back over the SSH connection

install gakrcli

```bash
$ npm install -g @gakr-gakr/gakrcli@latest
```

# install gakrcli

*Source: https://gakrcli.netlify.app/docs/installation/*

One npm command on macOS, Linux, or Windows. An AUR package exists for Arch.

## requirements

- **Node.js 18+** — The CLI runs on Node.js 18 or later.
- **npm** — Ships with Node.js, used for the global install.
- **git** — Required for gakrcli to create commits and work with your repository.

## install with npm

Install globally with npm:

```
npm install -g @gakr-gakr/gakrcli@latest
```

You may need `sudo` on macOS/Linux if your npm global prefix requires root. Consider using [nvm](https://github.com/nvm-sh/nvm) or [volta](https://volta.sh/) to manage Node.js and avoid permission issues.

## arch linux (aur)

Arch Linux users can install from the AUR:

```
yay -S gakrcli-bin
```

## verify the install

Check the installed version:

```
gakrcli --version
```

## update

Re-run the install command to get the latest version. The auto-updater also checks for updates during session startup and can be managed with `/config`.

## troubleshooting

- **Command not found** — Ensure npm global bin is in your `$PATH`. Run `npm bin -g` to see where packages are installed.
- **Permission errors** — Use a Node version manager (`nvm`, `volta`) or configure npm's prefix to a user-owned directory.


# quickstart

*Source: https://gakrcli.netlify.app/docs/quickstart/*

From a fresh install to a reviewed diff in about five minutes.

## 1. start the agent

Run it inside any repository (or empty directory):

```
cd your-repo
gakrcli
```

If you haven't [installed it](https://gakrcli.netlify.app/docs/installation/) yet: `npm install -g @gakr-gakr/gakrcli@latest`

## 2. pick a provider

Inside the session, type `/provider` for guided setup with saved profiles. It can wire up OpenAI, OpenRouter, Gemini, local Ollama, and a dozen other backends — see the [provider guide](https://gakrcli.netlify.app/docs/providers/) for the full list.

Prefer environment variables? The fastest OpenAI-compatible setup:

```
export GAKR_CODE_USE_OPENAI=1
export OPENAI_API_KEY=sk-your-key-here
export OPENAI_MODEL=gpt-4o

gakrcli
```

For GitHub Models, run `/onboard-github` for interactive OAuth onboarding.

## 3. give it a task

Write a task the way you'd brief a teammate:

```
> add retry with exponential backoff to the fetch client, then run the tests
```

The agent streams its plan, tool calls, and file diffs live to your terminal. You'll see every command it runs and every edit it makes, in real time.

## 4. review the changes

When the agent finishes, review the diff directly in the session. Run the tests, check the output — everything stays visible. Accept the changes when you're satisfied.

## next steps

- **[Slash commands](https://gakrcli.netlify.app/docs/slash-commands/)** — Learn /compact, /branch, /rewind, /model, /mcp, and 65+ more
- **[Configuration](https://gakrcli.netlify.app/docs/configuration/)** — Settings files, env vars, and project instructions
- **[CLI reference](https://gakrcli.netlify.app/docs/cli-reference/)** — All flags for non-interactive runs, SSH sessions, and setup



# model providers

*Source: https://gakrcli.netlify.app/docs/providers/*

One agent, every backend. Wire a provider once and switch models mid-session.

## how provider setup works

Run `/provider` inside a session for guided setup. It walks you through auth, lets you pick a model, and saves the result as a profile so future sessions — and other clones of the repo — boot the same way. You can also configure everything through [environment variables](https://gakrcli.netlify.app/docs/configuration/), which is handy for CI and scripted `--print` runs.

Switch models any time with `/model`, or pass `--provider` / `--model` on the command line — see the [CLI reference](https://gakrcli.netlify.app/docs/cli-reference/).

## supported providers

| provider | setup | notes |
| --- | --- | --- |
| **OpenAI-compatible** | `/provider or env vars` | Works with OpenAI, OpenRouter, DeepSeek, Groq, Mistral, LM Studio, and any other compatible /v1 server. |
| **Google Gemini** | `/provider or env vars` | Supports API-key auth only. |
| **GitHub Models** | `/onboard-github` | Interactive onboarding with saved credentials. |
| **Codex OAuth** | `/provider` | Opens ChatGPT sign-in in your browser and stores Codex credentials securely. Can also reuse existing Codex CLI auth or env credentials. |
| **NEAR AI** | `/provider or env vars` | Unified gateway (Claude, GPT, Gemini, plus TEE open models) at https://cloud-api.near.ai/v1. |
| **Ollama** | `/provider or env vars` | Local inference with no API key required. |
| **LM Studio** | `/provider or env vars` | Local OpenAI-compatible server; point the base URL at the LM Studio endpoint. |
| **Xiaomi MiMo** | `/provider or env vars` | OpenAI-compatible API at https://mimo.mi.com; defaults to mimo-v2.5-pro. |
| **OpenCode Zen / Go** | `/provider or env vars` | Pay-as-you-go gateway (Zen) and subscription tier for open models (Go); both share one key via opencode.ai. |
| **Atomic Chat** | `/provider or env vars` | Local model provider with auto-detection of loaded models. |
| **Hicap** | `/provider or OpenAI-compatible env vars` | api-key auth, discovers models from the unauthenticated /models endpoint, supports Responses mode for gpt- models. |
| **Anthropic** | `/login or env vars` | Sign in with an Anthropic account or use an API key directly. |
| **Bedrock / Vertex / Foundry** | `env vars` | Anthropic-family cloud routes. Vertex is for Claude on Vertex AI, not arbitrary Model Garden models. |

## env-var setup

Set the right environment variable and gakrcli picks up the provider on next launch. The full list of supported env vars is on the [configuration page](https://gakrcli.netlify.app/docs/configuration/).



# slash commands reference

*Source: https://gakrcli.netlify.app/docs/slash-commands/*

All 69 built-in slash commands, grouped by what they do. Type / inside a session to autocomplete any of them; plugins and skills can add more.

Commands run inside an interactive session and start with `/`. For flags you pass when launching the binary, see the [CLI reference](https://gakrcli.netlify.app/docs/cli-reference/) instead. You can also extend this list with your own [skills](https://gakrcli.netlify.app/docs/skills/).

## sessions & conversations

Start, resume, branch, and export conversations — and move them between devices.

### `/clear`[#](https://gakrcli.netlify.app/#cmd-clear)

Clear conversation history and free up context

### `/compact [instructions]`[#](https://gakrcli.netlify.app/#cmd-compact)

Clear conversation history but keep a summary in context

### `/resume [conversation id or search term]`[#](https://gakrcli.netlify.app/#cmd-resume)

Resume a previous conversation

### `/rename [name]`[#](https://gakrcli.netlify.app/#cmd-rename)

Rename the current conversation

### `/branch [name]`[#](https://gakrcli.netlify.app/#cmd-branch)

Create a branch of the current conversation at this point

### `/rewind`[#](https://gakrcli.netlify.app/#cmd-rewind)

Restore the code and/or conversation to a previous point

### `/export [filename]`[#](https://gakrcli.netlify.app/#cmd-export)

Export the current conversation to a file or clipboard

### `/copy [N]`[#](https://gakrcli.netlify.app/#cmd-copy)

Copy the agent's last response to clipboard (or /copy N for the Nth-latest)

### `/btw <question>`[#](https://gakrcli.netlify.app/#cmd-btw)

Ask a quick side question without interrupting the main conversation

### `/goal [condition|status|pause|resume|clear]`[#](https://gakrcli.netlify.app/#cmd-goal)

Set and manage a session completion goal

### `/tasks`[#](https://gakrcli.netlify.app/#cmd-tasks)

List and manage background tasks

### `/session`[#](https://gakrcli.netlify.app/#cmd-session)

Show remote session URL and QR code

### `/desktop`[#](https://gakrcli.netlify.app/#cmd-desktop)

Continue the current session in Gakr Desktop

### `/mobile`[#](https://gakrcli.netlify.app/#cmd-mobile)

Show QR code to download the Gakr mobile app

### `/exit`[#](https://gakrcli.netlify.app/#cmd-exit)

Exit the REPL

## context & memory

Control what the agent sees: working directories, context usage, memory, and project knowledge.

### `/context`[#](https://gakrcli.netlify.app/#cmd-context)

Show current context usage

### `/files`[#](https://gakrcli.netlify.app/#cmd-files)

List all files currently in context

### `/add-dir <path>`[#](https://gakrcli.netlify.app/#cmd-add-dir)

Add a new working directory

### `/init`[#](https://gakrcli.netlify.app/#cmd-init)

Initialize a new project instruction file with codebase documentation

### `/memory`[#](https://gakrcli.netlify.app/#cmd-memory)

Edit persistent memory files

### `/dream`[#](https://gakrcli.netlify.app/#cmd-dream)

Run memory consolidation — synthesize recent sessions into durable memories

### `/knowledge enable <yes|no> | clear | status | list`[#](https://gakrcli.netlify.app/#cmd-knowledge)

Manage the native Knowledge Graph

### `/wiki [init|status]`[#](https://gakrcli.netlify.app/#cmd-wiki)

Initialize and inspect the GakrCLI project wiki

### `/cost`[#](https://gakrcli.netlify.app/#cmd-cost)

Show the total cost and duration of the current session

### `/request-size`[#](https://gakrcli.netlify.app/#cmd-request-size)

Show estimated request context load and top contributors

### `/cache-stats`[#](https://gakrcli.netlify.app/#cmd-cache-stats)

Show per-turn and session cache hit/miss stats (works across all providers)

## models & providers

Pick a model, wire up providers, sign in and out, and track usage limits.

### `/model [model]`[#](https://gakrcli.netlify.app/#cmd-model)

Set the AI model for the session

### `/provider`[#](https://gakrcli.netlify.app/#cmd-provider)

Manage API provider profiles

### `/effort [low|medium|high|max|auto]`[#](https://gakrcli.netlify.app/#cmd-effort)

Set effort level for model usage

### `/login`[#](https://gakrcli.netlify.app/#cmd-login)

Sign in with your Anthropic account

### `/logout`[#](https://gakrcli.netlify.app/#cmd-logout)

Sign out from your Anthropic account

### `/onboard-github`[#](https://gakrcli.netlify.app/#cmd-onboard-github)

Interactive setup for GitHub Copilot: OAuth device login stored in secure storage

### `/usage`[#](https://gakrcli.netlify.app/#cmd-usage)

Show plan usage limits

### `/extra-usage`[#](https://gakrcli.netlify.app/#cmd-extra-usage)

Configure extra usage to keep working when limits are hit

## code review & git

Review diffs and pull requests, run security reviews, and connect GitHub or Slack.

### `/diff`[#](https://gakrcli.netlify.app/#cmd-diff)

View uncommitted changes and per-turn diffs

### `/review`[#](https://gakrcli.netlify.app/#cmd-review)

Review a pull request

### `/security-review`[#](https://gakrcli.netlify.app/#cmd-security-review)

Complete a security review of the pending changes on the current branch

### `/pr-comments`[#](https://gakrcli.netlify.app/#cmd-pr-comments)

Get comments from a GitHub pull request

### `/auto-fix`[#](https://gakrcli.netlify.app/#cmd-auto-fix)

Configure auto-fix: run lint/test after AI edits

### `/plan [open|<description>]`[#](https://gakrcli.netlify.app/#cmd-plan)

Enable plan mode or view the current session plan

### `/install-github-app`[#](https://gakrcli.netlify.app/#cmd-install-github-app)

Set up GitHub Actions integration for a repository

### `/install-slack-app`[#](https://gakrcli.netlify.app/#cmd-install-slack-app)

Install the Slack app integration

## tools & integrations

MCP servers, language servers, IDEs, plugins, skills, agents, and hooks.

### `/mcp [enable|disable [server-name]]`[#](https://gakrcli.netlify.app/#cmd-mcp)

Manage MCP servers

### `/lsp status | recommend [path] | install <plugin-id> | uninstall <plugin-id> | restart`[#](https://gakrcli.netlify.app/#cmd-lsp)

Inspect and set up Language Server Protocol code intelligence

### `/ide [open]`[#](https://gakrcli.netlify.app/#cmd-ide)

Manage IDE integrations and show status

### `/plugin`[#](https://gakrcli.netlify.app/#cmd-plugin)

Manage GakrCLI plugins

### `/reload-plugins`[#](https://gakrcli.netlify.app/#cmd-reload-plugins)

Activate pending plugin changes in the current session

### `/skills`[#](https://gakrcli.netlify.app/#cmd-skills)

List available skills

### `/agents`[#](https://gakrcli.netlify.app/#cmd-agents)

Manage agent configurations

### `/hooks`[#](https://gakrcli.netlify.app/#cmd-hooks)

View hook configurations for tool events

### `/permissions`[#](https://gakrcli.netlify.app/#cmd-permissions)

Manage allow & deny tool permission rules

## ui & customization

Themes, keybindings, vim mode, the status line, and editor ergonomics.

### `/config`[#](https://gakrcli.netlify.app/#cmd-config)

Open the config panel

### `/theme`[#](https://gakrcli.netlify.app/#cmd-theme)

Change the theme

### `/logo`[#](https://gakrcli.netlify.app/#cmd-logo)

Change the startup logo color scheme

### `/color <color|default>`[#](https://gakrcli.netlify.app/#cmd-color)

Set the prompt bar color for this session

### `/keybindings`[#](https://gakrcli.netlify.app/#cmd-keybindings)

Open or create your keybindings configuration file

### `/vim`[#](https://gakrcli.netlify.app/#cmd-vim)

Toggle between Vim and Normal editing modes

### `/statusline`[#](https://gakrcli.netlify.app/#cmd-statusline)

Set up GakrCLI's status line UI

### `/terminal-setup`[#](https://gakrcli.netlify.app/#cmd-terminal-setup)

Install the Shift+Enter key binding for newlines

### `/commit-message [status|off|default|set "text"|co-author <name> <email>]`[#](https://gakrcli.netlify.app/#cmd-commit-message)

Configure commit attribution text

### `/output-style`[#](https://gakrcli.netlify.app/#cmd-output-style)

Deprecated: use /config to change output style

### `/stickers`[#](https://gakrcli.netlify.app/#cmd-stickers)

Order GakrCLI stickers

## help & diagnostics

Check status, diagnose the installation, and inspect session statistics.

### `/help`[#](https://gakrcli.netlify.app/#cmd-help)

Show help and available commands

### `/status`[#](https://gakrcli.netlify.app/#cmd-status)

Show status including version, model, account, API connectivity, and tool statuses

### `/doctor`[#](https://gakrcli.netlify.app/#cmd-doctor)

Diagnose and verify your GakrCLI installation and settings

### `/stats`[#](https://gakrcli.netlify.app/#cmd-stats)

Show your usage statistics and activity

### `/insights`[#](https://gakrcli.netlify.app/#cmd-insights)

Generate a report analyzing your GakrCLI sessions

### `/release-notes`[#](https://gakrcli.netlify.app/#cmd-release-notes)

View release notes

### `/feedback [report]`[#](https://gakrcli.netlify.app/#cmd-feedback)

Submit feedback about GakrCLI


# CLI reference

*Source: https://gakrcli.netlify.app/docs/cli-reference/*

Every documented flag of the gakrcli binary, grouped by purpose. Slash commands you type inside a session are documented separately.

## usage

```
gakrcli [options] [prompt]

# interactive session in the current repo
gakrcli

# non-interactive: print the result and exit
gakrcli -p "explain the build pipeline" --output-format json
```

Looking for `/commands` you type inside the session? See the [slash commands reference](https://gakrcli.netlify.app/docs/slash-commands/).

## core

| flag | description |
| --- | --- |
| `-v, --version` | Show the installed version and exit. |
| `-h, --help` | Display help for the command. |
| `-p, --print` | Print the response and exit (useful for pipes and scripts). The workspace trust dialog is skipped — only use in directories you trust. |
| `--bare` | Minimal mode: skip hooks, LSP, plugin sync, attribution, auto-memory, keychain reads, and GAKRCLI.md auto-discovery. Provide context explicitly via --system-prompt, --add-dir, --mcp-config, --settings, --agents, or --plugin-dir. |
| `-d, --debug [filter]` | Enable debug mode with optional category filtering (e.g. "api,hooks" or "!file"). |
| `--debug-file <path>` | Write debug logs to a specific file path (implicitly enables debug mode). |
| `--verbose` | Override the verbose mode setting from config. |

## input & output formats

These flags shape non-interactive runs with --print, e.g. in scripts and CI.

| flag | description |
| --- | --- |
| `--output-format <format>` | Output format (with --print): "text" (default), "json" (single result), or "stream-json" (realtime streaming). |
| `--input-format <format>` | Input format (with --print): "text" (default) or "stream-json" (realtime streaming input). |
| `--json-schema <schema>` | JSON Schema for structured output validation of the final result. |
| `--include-hook-events` | Include hook lifecycle events in the output stream (stream-json only). |
| `--include-partial-messages` | Include partial message chunks as they arrive (stream-json only). |
| `--replay-user-messages` | Re-emit user messages from stdin back on stdout for acknowledgment (stream-json in and out). |

## model & provider

| flag | description |
| --- | --- |
| `--model <model>` | Model for the session: an alias like 'sonnet' or 'opus', or a full model name. |
| `--provider <provider>` | AI provider to use (anthropic, openai, gemini, github, bedrock, vertex, ollama, …). |
| `--effort <level>` | Effort level for model usage: low, medium, high, xhigh, or max. |
| `--fallback-model <model>` | Automatic fallback model when the default model is overloaded. |
| `--agent <agent>` | Agent for the current session. Overrides the 'agent' setting. |
| `--betas <betas...>` | Beta headers to include in API requests (API key users only). |

## sessions

| flag | description |
| --- | --- |
| `-c, --continue` | Continue the most recent conversation in the current directory. |
| `-r, --resume [id]` | Resume a conversation by session ID, or open the interactive picker with an optional search term. |
| `--fork-session` | When resuming, branch the conversation into a new session ID. This does not create filesystem or worktree isolation. |
| `--from-pr [pr]` | Resume a session linked to a PR by number/URL, or open the interactive picker. |
| `--session-id <uuid>` | Use a specific session ID for the conversation (must be a valid UUID). |
| `-n, --name <name>` | Set a display name for this session (shown in /resume and the terminal title). |
| `--no-session-persistence` | Disable session persistence — sessions are not saved to disk and cannot be resumed (--print only). |
| `-w, --worktree [name]` | Run the session in an isolated git worktree, optionally named. |

## permissions & tools

| flag | description |
| --- | --- |
| `--permission-mode <mode>` | Permission mode for the session (e.g. auto, plan, acceptEdits, bypassPermissions). |
| `--allowed-tools <tools...>` | Comma or space-separated list of tool rules to allow (e.g. "Bash(git:*) Edit"). |
| `--disallowed-tools <tools...>` | Comma or space-separated list of tool rules to deny. |
| `--tools <tools...>` | Restrict the built-in tool set: "" disables all tools, "default" enables all, or list names like "Bash,Edit,Read". |
| `--dangerously-skip-permissions` | Bypass all permission checks. Recommended only for sandboxes with no internet access. |
| `--allow-dangerously-skip-permissions` | Make permission bypass available as an option without enabling it by default. |
| `--add-dir <dirs...>` | Additional directories to allow tool access to. |

## system prompt

| flag | description |
| --- | --- |
| `--system-prompt <prompt>` | Replace the default system prompt for the session. |
| `--append-system-prompt <prompt>` | Append to the default system prompt instead of replacing it. |

## mcp

| flag | description |
| --- | --- |
| `--mcp-config <configs...>` | Load MCP servers from JSON files or strings (space-separated). |
| `--strict-mcp-config` | Only use MCP servers from --mcp-config, ignoring all other MCP configurations. |

## configuration

| flag | description |
| --- | --- |
| `--settings <file-or-json>` | Path to a settings JSON file, or a JSON string, with additional settings. |
| `--setting-sources <sources>` | Comma-separated list of setting sources to load: user, project, local. |
| `--agents <json>` | JSON object defining custom agents for the session. |
| `--plugin-dir <path>` | Load plugins from a directory (repeatable). |
| `--ide` | Automatically connect to your IDE on startup if exactly one valid IDE is available. |

## limits & budgets

| flag | description |
| --- | --- |
| `--max-budget-usd <amount>` | Maximum dollar amount to spend on API calls (--print only). |

## subcommands

| subcommand | description |
| --- | --- |
| `gakrcli mcp [add\|remove\|list\|doctor]` | Manage MCP server configuration from the command line. |
| `gakrcli ssh <host> [dir]` | Run GakrCLI on a remote host over SSH. Deploys the binary and tunnels API auth back through your local machine — no remote setup needed. |

Defaults for most of these flags can be persisted in settings files — see [configuration](https://gakrcli.netlify.app/docs/configuration/).


# configuration

*Source: https://gakrcli.netlify.app/docs/configuration/*

Layered settings files for defaults, environment variables for auth and CI, and project instructions for context.

## settings files

Settings merge in order: user → project → local, with later layers overriding earlier ones. Open the interactive panel with `/config`, or edit the files directly.

| file | scope | notes |
| --- | --- | --- |
| `~/.gakrcli/settings.json` | user | Default global settings path for every project on the machine; GAKR_CONFIG_DIR moves this under the configured config home. |
| `.gakrcli/settings.json` | project | Shared project settings, committed to the repo. |
| `.gakrcli/settings.local.json` | local | Per-machine overrides for one project; typically gitignored. |
| `~/.gakrcli/keybindings.json` | user | Default keyboard shortcut overrides path; GAKR_CONFIG_DIR moves this under the configured config home. |
| `GAKRCLI.md / .gakrcli/GAKRCLI.md` | project | Project instructions loaded into context at session start. |

## common options

A few of the most-used keys in `settings.json`:

| key | what it does |
| --- | --- |
| `model` | Default model (alias like 'sonnet' or a full model name). |
| `provider` | Default provider preset for new sessions. |
| `effort` | Default effort level: low, medium, high, xhigh, or max. |
| `agent` | Default agent for new sessions. |
| `permissions` | Allow/deny rules for tools, plus the default permission mode. |
| `env` | Environment variables applied to every session. |
| `theme` | Terminal color theme. |
| `verbose` | Verbose output by default. |
| `allowAutoUpdates` | Enable or disable the auto-updater. |
| `hooks` | Shell hooks that run on tool events (PreToolUse, PostToolUse, …). |

One-off overrides beat files: `--settings` accepts a path or inline JSON, and `--setting-sources` restricts which layers load — see the [CLI reference](https://gakrcli.netlify.app/docs/cli-reference/#config).

## environment variables

Auth and transport are driven by environment variables, which makes CI and `--print` scripting straightforward:

| variable | purpose |
| --- | --- |
| `ANTHROPIC_API_KEY` | Anthropic API key (also the strict auth path in --bare mode). |
| `ANTHROPIC_AUTH_TOKEN` | Bearer token alternative to an Anthropic API key. |
| `OPENAI_API_KEY` | Key for OpenAI-compatible providers and gateways (incl. Opengateway). |
| `OPENAI_BASE_URL` | Base URL of an OpenAI-compatible /v1 endpoint (OpenRouter, LM Studio, LiteLLM, …). |
| `OPENAI_MODEL` | Model name to request from the OpenAI-compatible endpoint. |
| `GOOGLE_API_KEY` | Google Gemini API key. |
| `NEARAI_API_KEY` | NEAR AI unified gateway key. |
| `MIMO_API_KEY` | Xiaomi MiMo API key. |
| `OPENCODE_API_KEY` | OpenCode Zen / Go gateway key. |
| `GITHUB_TOKEN` | GitHub token for GitHub Models and PR workflows. |
| `GAKR_CONFIG_DIR` | Preferred config directory override. Defaults to ~/.gakrcli when unset. |
| `GAKR_CONFIG_DIR` | Legacy config directory override. Used only when GAKR_CONFIG_DIR is unset. |
| `HTTP_PROXY / HTTPS_PROXY` | Route API traffic through a proxy. |
| `NODE_EXTRA_CA_CERTS` | Extra CA certificates for corporate TLS interception. |
| `GAKR_CODE_DISABLE_NONESSENTIAL_TRAFFIC` | Disable non-essential network traffic. |

Provider-specific setup recipes live on the [providers page](https://gakrcli.netlify.app/docs/providers/).

## project instructions

`GAKRCLI.md` (or `.gakrcli/GAKRCLI.md`) is loaded into context at session start — build commands, conventions, and anything the agent should always know about the repo. Generate a starting point with `/init`, and edit persistent memory with `/memory`.


# keybindings

*Source: https://gakrcli.netlify.app/docs/keybindings/*

Keyboard shortcuts for the interactive session. Edit or add your own in ~/.gakrcli/keybindings.json.

## default keybindings

| keys | action | context |
| --- | --- | --- |
| `Ctrl+C` | Interrupt the current turn | global |
| `Ctrl+D` | Exit the REPL | global |
| `Ctrl+L` | Redraw the screen | global |
| `Ctrl+T` | Toggle the todo list | global |
| `Ctrl+O` | Toggle the transcript view | global |
| `Ctrl+R` | Search prompt history | global |
| `Shift+Tab` | Cycle permission modes | prompt |
| `Ctrl+V` | Paste an image from the clipboard (Alt+V on Windows) | prompt |
| `Ctrl+S` | Stash the current prompt draft | prompt |
| `Ctrl+G` | Edit the prompt in your external $EDITOR | prompt |
| `Ctrl+_ / Ctrl+Shift+-` | Undo in the prompt input | prompt |
| `Ctrl+P / Ctrl+N` | Previous / next item | menus & pickers |
| `Ctrl+E` | Toggle the explanation panel | permission dialogs |
| `Esc` | Cancel / close the current dialog | dialogs |
| `Shift+Enter` | Insert a newline (install via /terminal-setup) | prompt |

## customize keybindings

Run `/keybindings` to open or create your user keybindings file at `~/.gakrcli/keybindings.json`. You can rebind any key or add chord bindings. See the [skills](https://gakrcli.netlify.app/docs/skills/) page for the `/keybindings-help` skill that walks you through the format.


# skills

*Source: https://gakrcli.netlify.app/docs/skills/*

Skills are reusable prompts that give the agent specialized capabilities. Use built-in skills or write your own.

## built-in skills

| invocation | description |
| --- | --- |
| `/batch` | Research and plan a large-scale change, then execute it in parallel across 5–30 isolated worktree agents that each open a PR. Use for sweeping, mechanical changes (migrations, refactors, bulk renames) that decompose into independent units. |
| `/loop` | Run a prompt on a fixed interval or dynamically reschedule it. Use to poll for status, babysit a workflow, or keep re-running a prompt within the current session. |
| `/simplify` | Review changed code for reuse, quality, and efficiency, then fix any issues found. |
| `/debug` | Enable debug logging for this session and help diagnose issues. |
| `/update-config` | Configure the harness via settings.json: permissions, env vars, hooks, and automated behaviors ("from now on when X…"). |
| `/keybindings-help` | Customize keyboard shortcuts: rebind keys, add chord bindings, or modify your keybindings file (default: ~/.gakrcli/keybindings.json; override via GAKR_CONFIG_DIR). |

## create your own

Skills live in `~/.gakrcli/skills/`. Each skill is a markdown file with frontmatter that tells gakrcli how to invoke it:

```
---
name: my-skill
description: A short description shown in /skills
---

Write your prompt here. The agent will execute this
when the skill is invoked.
```

Create a new skill with a single command:

```bash
$ gakrcli --execute 'create a skill at ~/.gakrcli/skills/review-pr.md that reviews pull requests for common mistakes'
```

Skills support [MCP tools](https://github.com/gajjalaashok75-UI/gakrcli) and can use the full agent toolchain — Bash, Read, Edit, Grep, Glob, and any connected MCP servers.



