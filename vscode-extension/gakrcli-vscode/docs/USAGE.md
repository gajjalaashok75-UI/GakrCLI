# Usage Guide

## Opening GakrCLI

| Method | Action |
|---|---|
| Keyboard | `Ctrl+Escape` (Win/Linux) / `Cmd+Escape` (macOS) |
| Activity Bar | Click the GakrCLI icon |
| Command Palette | `GakrCLI: Open in New Tab` |

If `gakrcli.useTerminal` is enabled, the keyboard shortcut opens a terminal instead.

## Chat Basics

Type a prompt in the input box and press Enter. The AI responds in the chat panel with streaming output.

- **@-mentions**: Type `@` to reference files, folders, symbols, or line ranges for context
- **Slash commands**: Type `/` to browse available commands
- **Stop**: Click the stop button to interrupt generation
- **New conversation**: `GakrCLI: New Conversation` from Command Palette (or `Ctrl+N` with setting enabled)

## Provider Setup

Use `/provider` in the chat to configure providers interactively, or set environment variables:

### OpenAI

```bash
export OPENAI_API_KEY=sk-...
export OPENAI_MODEL=gpt-4o
```

### Anthropic

```bash
export ANTHROPIC_API_KEY=sk-ant-...
```

Or use Claude Code OAuth if already signed in.

### Google Gemini

```bash
export GOOGLE_API_KEY=AIza-...
export GEMINI_MODEL=gemini-2.0-flash
```

### Ollama (Local)

```bash
ollama serve
export OPENAI_BASE_URL=http://localhost:11434/v1
export OPENAI_MODEL=llama3
```

### AWS Bedrock

```bash
export AWS_REGION=us-east-1
```

Uses standard AWS credential chain (env vars, `~/.aws/credentials`, IAM role).

### Custom / OpenAI-compatible

```bash
export OPENAI_BASE_URL=https://api.deepseek.com/v1
export OPENAI_MODEL=deepseek-chat
```

Works with DeepSeek, Together AI, Fireworks, OpenRouter, and any OpenAI-compatible endpoint.

## Permission Modes

The permission mode controls which tools the AI can execute without prompting. Set it via the footer dropdown or the `gakrcli.initialPermissionMode` setting.

| Mode | Behavior |
|---|---|
| **Default** | Standard behavior; prompts for dangerous operations |
| **Accept Edits** | Auto-accepts file edit operations in the workspace |
| **Plan** | Analysis only; tool execution is blocked |
| **Bypass** | Skips normal permission prompts while preserving hard safety prompts |
| **Full Access** | Skips normal permission prompts and hard safety-check prompts |

### Permission Dialog

When the AI requests to use a tool (e.g., Read, Write, Bash), a permission dialog appears with these options:

1. **Yes** — Allow this one time
2. **Yes, allow all during this session** — Always allow this tool for the current session
3. **Yes, and enable Full Access for this session** — Allow this tool and switch to Full Access mode
4. **No, provide reason** — Deny with a custom reason sent to the AI
5. **No** — Deny without explanation

See [PERMISSIONS.md](PERMISSIONS.md) for the detailed permission architecture.

## Slash Commands

| Command | Description |
|---|---|
| `/help` | Show all available commands |
| `/provider` | Set up and switch LLM providers |
| `/model` | Switch between models for the current provider |
| `/compact` | Compact conversation context to save tokens |
| `/resume` | Browse and resume past sessions |
| `/diff` | Show current git diff |
| `/commit` | Create a git commit with AI-generated message |
| `/review` | Review code, a diff, or a PR |
| `/mcp` | Manage MCP servers |
| `/plugins` | Manage GakrCLI plugins |
| `/fast` | Toggle Fast mode (cached system prompts) |
| `/repomap` | Generate a repository structure map |

## Keyboard Shortcuts

| Action | macOS | Windows / Linux |
|---|---|---|
| Open / Focus GakrCLI | `Cmd+Escape` | `Ctrl+Escape` |
| Open in new tab | `Cmd+Shift+Escape` | `Ctrl+Shift+Escape` |
| Insert @-mention | `Alt+K` | `Alt+K` |
| Insert @-mention from context | `Cmd+Alt+K` | `Ctrl+Alt+K` |
| New conversation | `Cmd+N` (opt-in) | `Ctrl+N` (opt-in) |

Enable the new conversation shortcut via `gakrcli.enableNewConversationShortcut`.

## Diff Viewer

When the AI proposes file edits, they open in VS Code's native diff viewer:
- **Accept**: Click the checkmark in the editor title bar or run `GakrCLI: Accept Proposed Changes`
- **Reject**: Click the X or run `GakrCLI: Reject Proposed Changes`

In **Accept Edits**, **Bypass**, or **Full Access** modes, file edits are auto-approved without diff review.

## Session Management

- **Resume**: Use `/resume` or click the Past Conversations button to browse and resume sessions
- **Fork**: Resume a session as a new conversation
- **Refresh**: Click the Refresh button to restart the CLI while preserving the current session
- **Logs**: Run `GakrCLI: Show Logs` from the Command Palette

## MCP Servers

Manage MCP (Model Context Protocol) servers via `/mcp` or the Plugins panel. GakrCLI supports:
- **STDIO servers** — Local process-based MCP servers
- **Streamable HTTP servers** — Remote MCP servers

## Walkthrough

If this is your first time, run `GakrCLI: Open Walkthrough` from the Command Palette for a guided tour.
