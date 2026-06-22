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
