# Architecture

GakrCLI VS Code is a **thin UI wrapper** around the [GakrCLI CLI](https://www.npmjs.com/package/@gitlawb/gakrcli). The CLI handles all intelligence; the extension provides VS Code-native UI.

## High-Level Overview

```
┌─────────────────────────────────────────────┐
│  Webview (React + Tailwind + TypeScript)     │
│  ┌─────────────────────────────────────────┐ │
│  │  ChatPanel        PermissionDialog      │ │
│  │  ModeSelector     SessionsList          │ │
│  │  DiffViewer       SettingsPanel         │ │
│  └──────────────────┬──────────────────────┘ │
│                     │ postMessage             │
├─────────────────────┼─────────────────────────┤
│  Extension Host     │                         │
│  ┌──────────────────▼──────────────────────┐  │
│  │  Activate()                             │  │
│  │  ├─ ProcessManager (spawns CLI process) │  │
│  │  ├─ PermissionHandler (mode + rules)    │  │
│  │  ├─ DiffManager (file edit handling)    │  │
│  │  ├─ AuthManager (provider credentials)  │  │
│  │  ├─ SessionManager (history + resume)   │  │
│  │  └─ WebviewManager (IPC bridge)         │  │
│  └──────────────────┬──────────────────────┘  │
│                     │ stdin/stdout NDJSON      │
├─────────────────────┼─────────────────────────┤
│  GakrCLI CLI        │                         │
│  ┌──────────────────▼──────────────────────┐  │
│  │  Tool Execution                         │  │
│  │  Provider Routing                       │  │
│  │  MCP Server Management                  │  │
│  │  Slash Commands                         │  │
│  │  Session Persistence                    │  │
│  └──────────────────┬──────────────────────┘  │
│                     │ OpenAI Chat Completions  │
├─────────────────────┼─────────────────────────┤
│  LLM Provider       │                         │
│  ┌──────────────────▼──────────────────────┐  │
│  │  OpenAI / Anthropic / Gemini / Ollama   │  │
│  │  AWS Bedrock / Vertex AI / Custom       │  │
│  └─────────────────────────────────────────┘  │
└─────────────────────────────────────────────┘
```

## Layers

### 1. Webview Layer

A React + Tailwind application running in a VS Code webview panel. Components:

- **ChatPanel** — Main chat interface with streaming markdown output
- **PermissionDialog** — Tool approval dialog matching CLI UX
- **ModeSelector** — Permission mode dropdown
- **SessionsList** — Past conversation browser
- **DiffViewer** — Inline diff display for file edits

Communication with the extension host happens via `postMessage()` / `onDidReceiveMessage()`.

### 2. Extension Host Layer

TypeScript code running in VS Code's extension host process. Key modules:

- **ProcessManager** — Spawns and manages the CLI child process (stdin/stdout NDJSON transport)
- **PermissionHandler** — Routes permission checks, manages modes and session rules
- **DiffHandler** — Routes file edits to DiffManager for diff-based approvals
- **DiffManager** — Applies file edits directly (acceptEdits mode) or opens diff view
- **AuthManager** — Manages provider credentials, builds environment for the CLI
- **SessionManager** — Tracks conversation history, resume/fork support
- **WebviewManager** — Bridge for webview-to-host IPC
- **PermissionRules** — In-memory store for "Always Allow for Session" rules

### 3. CLI Layer

The GakrCLI CLI runs as a child process. It handles:

- Tool execution (Read, Write, Edit, Bash, Grep, etc.)
- LLM provider routing and model selection
- MCP server lifecycle
- Slash command processing
- Session persistence (JSONL transcripts)

Communication is via NDJSON (newline-delimited JSON) over stdin/stdout.

## Communication Protocol

```
Webview → Extension Host:  postMessage (typed messages)
Extension Host → CLI:      stdin NDJSON (control_request, user_input)
CLI → Extension Host:      stdout NDJSON (assistant_message, control_response)
Extension Host → Webview:  postMessage (typed messages)
```

### Message Types

**Webview → Host:**
- `user_input` — User's chat prompt
- `permission_response` — Tool approval/denial
- `set_permission_mode` — Mode change
- `set_model` / `set_provider` — Provider/model selection
- `resume_session` / `delete_session` — Session management

**Host → Webview:**
- `assistant_message` — AI response with text and tool calls
- `permission_request` — Tool approval prompt
- `settings_state` — Current provider/model/mode state
- `sessions_list` — Past conversation list
- `runtime_status` — CLI process state (Starting/Active/Error)

**CLI ↔ Host (NDJSON):**
- `control_request` — Permission checks, settings queries
- `control_response` — Permission decisions, settings data
- `user_input` — Forwarded user prompts
- `assistant_message` — AI response chunks

## Permission System Architecture

The permission system has 3 tiers:

1. **Mode-based auto-approve** (fast path, no user interaction)
2. **Session rules** (in-memory, per-session)
3. **Interactive dialog** (user prompt)

See [PERMISSIONS.md](PERMISSIONS.md) for the full flow.

## Windows Compatibility

On Windows, the extension resolves the CLI binary through `APPDATA`/`LOCALAPPDATA` npm paths and spawns Node.js directly (bypassing `cmd.exe`) to ensure reliable stdin piping. The `GAKR_DISABLE_HEAP_RELAUNCH=1` flag suppresses an extra process layer.

## Key Design Decisions

- **CLI is the source of truth**: Provider config, permissions, sessions — all live in the CLI. The extension is a pass-through UI.
- **No workspaceState persistence for rules**: Session rules are in-memory only. Each restart starts fresh, preventing silent auto-approval carry-over.
- **Diff as a first-class UI**: File edits open in VS Code's native diff editor, not inline replacements.
- **MCP servers managed by CLI**: The extension forwards MCP commands to the CLI; the CLI handles server lifecycle.
- **NDJSON transport**: Simple, line-based protocol replaces WebSocket for the extension-CLI bridge.
