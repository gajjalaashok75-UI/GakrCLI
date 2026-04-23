# GakrCLI Complete System Architecture

## System Overview

GakrCLI is a **three-layer system** that connects your IDE with an AI-powered CLI tool:

```
┌─────────────────────────────────────────────────────────────────┐
│                    VS CODE EDITOR                               │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  GakrCLI VS Code Extension (v0.2.0)                      │   │
│  │  ├── Control Center (Activity Bar)                       │   │
│  │  ├── Chat Panel (Webview)                                │   │
│  │  ├── Session Manager                                     │   │
│  │  └── Diff Viewer                                         │   │
│  └──────────────────────────────────────────────────────────┘   │
│                           ↕                                      │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  Integrated Terminal                                     │   │
│  │  └── Runs: gakrcli (CLI Tool)                            │   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                           ↕
┌─────────────────────────────────────────────────────────────────┐
│                    IDE INTEGRATION LAYER                         │
│  ├── IDE Detection (VS Code, Cursor, Windsurf, JetBrains)      │
│  ├── Extension/Plugin Communication                             │
│  ├── Lockfile Management (~/.gakrcli/ide/)                      │
│  └── WebSocket/SSE Connection                                   │
└─────────────────────────────────────────────────────────────────┘
                           ↕
┌─────────────────────────────────────────────────────────────────┐
│                    GAKRCLI CLI TOOL (v0.3.0)                    │
│  ├── LLM Provider Integration                                   │
│  │   ├── OpenAI, Anthropic, Gemini, Ollama, etc.               │
│  │   └── Model Context Protocol (MCP)                          │
│  ├── Tool Execution                                             │
│  │   ├── File Operations (read, write, edit)                   │
│  │   ├── Shell Commands                                        │
│  │   ├── Web Search & Fetch                                    │
│  │   └── Grep/Glob Search                                      │
│  ├── Agent Reasoning                                            │
│  │   ├── Multi-step workflows                                  │
│  │   ├── Tool calling loops                                    │
│  │   └── Context management                                    │
│  └── Session Management                                         │
│      ├── History persistence                                    │
│      └── Cost tracking                                          │
└─────────────────────────────────────────────────────────────────┘
```

---

## Layer 1: VS Code Extension (gakrcli-vscode)

### What It Does

The VS Code Extension is the **user interface layer** that makes GakrCLI accessible from within VS Code.

### Key Components

#### 1. Control Center (Activity Bar)

**Location**: Left sidebar icon (torch icon)

**Displays**:
```
┌─────────────────────────────────────┐
│ GakrCLI Control Center              │
├─────────────────────────────────────┤
│ Status: ✓ Installed                 │
│ Command: gakrcli                    │
│ Workspace: /path/to/project         │
│ Profile: .gakr-profile.json (found) │
│ Provider: OpenAI                    │
├─────────────────────────────────────┤
│ [Launch GakrCLI]                    │
│ [Launch in Workspace Root]          │
│ [Open Workspace Profile]            │
│ [Open Repository]                   │
│ [Open Setup Guide]                  │
└─────────────────────────────────────┘
```

**What It Shows**:
- ✓ gakrcli is installed and available
- Current workspace folder
- Whether `.gakr-profile.json` exists
- Detected LLM provider
- Quick action buttons

#### 2. Chat Panel (Webview)

**Activation**: Press `Ctrl+Shift+L` (or `Cmd+Shift+L` on macOS)

**Features**:
- Real-time message streaming
- Session history
- Multi-turn conversations
- Tool execution display
- Permission request handling

**How It Works**:
```
User Types Message in Chat Panel
    ↓
Extension sends to gakrcli subprocess
    ↓
gakrcli processes and streams response
    ↓
Extension parses streaming output
    ↓
Chat Panel displays in real-time
```

#### 3. Session Manager

**Stores**:
- Chat history
- Session metadata
- User preferences
- Previous conversations

**Location**: `~/.gakrcli/sessions/`

**Enables**:
- Resume previous conversations
- Access chat history
- Multi-session support

#### 4. Diff Viewer

**Shows**:
- Code changes proposed by GakrCLI
- Added/removed lines
- Syntax highlighting
- Accept/reject interface

---

## Layer 2: IDE Integration Layer

### What It Does

The IDE Integration Layer **bridges the gap** between the VS Code Extension and the GakrCLI CLI tool. It enables:
- IDE detection
- Real-time communication
- Context sharing
- File operations

### How IDE Detection Works

```
GakrCLI Starts
    ↓
Scans ~/.gakrcli/ide/ for lockfiles
    ↓
Reads lockfile: [port].lock
    ├── Contains: workspace folders, IDE name, port, PID
    └── Format: JSON with connection info
    ↓
Validates:
├── Is process still running? (check PID)
├── Is port responding? (test connection)
├── Is workspace matching? (check cwd)
└── Is IDE parent process? (check ancestry)
    ↓
If Valid: Connect to IDE
├── Via WebSocket: ws://127.0.0.1:[port]
└── Via SSE: http://127.0.0.1:[port]/sse
    ↓
IDE Features Enabled
├── Reference files/lines (Ctrl+Alt+K)
├── Quick launch (Cmd+Esc)
└── View diffs in IDE
```

### Lockfile Structure

**Location**: `~/.gakrcli/ide/[port].lock`

**Content**:
```json
{
  "workspaceFolders": ["/path/to/workspace"],
  "pid": 12345,
  "ideName": "VS Code",
  "transport": "ws",
  "runningInWindows": false,
  "authToken": "optional-token"
}
```

### Connection Methods

#### WebSocket (Real-time)
```
IDE Extension ←→ WebSocket ←→ GakrCLI
ws://127.0.0.1:8080
```
- Bidirectional communication
- Real-time updates
- Lower latency

#### SSE (Server-Sent Events)
```
IDE Extension ← SSE ← GakrCLI
http://127.0.0.1:8080/sse
```
- One-way streaming
- Server pushes updates
- Browser-compatible

### Supported IDEs

**VS Code Family**:
- VS Code
- Cursor
- Windsurf

**JetBrains Family**:
- IntelliJ IDEA
- PyCharm
- WebStorm
- PhpStorm
- RubyMine
- CLion
- GoLand
- Rider
- DataGrip
- AppCode
- DataSpell
- Android Studio

---

## Layer 3: GakrCLI CLI Tool

### What It Does

The CLI tool is the **core engine** that:
- Connects to LLM providers
- Executes tools (file ops, shell commands, web search)
- Manages agent reasoning
- Handles multi-step workflows

### Architecture

```
GakrCLI CLI
├── Provider Layer
│   ├── OpenAI API
│   ├── Anthropic Claude
│   ├── Google Gemini
│   ├── Ollama (local)
│   ├── Bedrock (AWS)
│   └── 10+ more providers
│
├── Tool Layer
│   ├── File Operations
│   │   ├── Read files
│   │   ├── Write files
│   │   └── Edit files
│   ├── Shell Commands
│   │   ├── Execute bash
│   │   └── Capture output
│   ├── Search Tools
│   │   ├── Grep search
│   │   ├── Glob patterns
│   │   └── Web search
│   └── Web Tools
│       ├── Fetch URLs
│       └── Parse content
│
├── Agent Layer
│   ├── Message processing
│   ├── Tool calling
│   ├── Reasoning loops
│   └── Context management
│
├── MCP Layer
│   ├── Model Context Protocol
│   ├── External tool integration
│   └── Custom data sources
│
└── Session Layer
    ├── History persistence
    ├── Cost tracking
    └── State management
```

### How GakrCLI Works

```
User Input (from Extension or Terminal)
    ↓
Parse Input & Context
├── Read workspace files
├── Get git context
└── Load project config
    ↓
Send to LLM Provider
├── Include system prompt
├── Add tool definitions
└── Stream response
    ↓
Process LLM Response
├── Extract text
├── Parse tool calls
└── Handle permissions
    ↓
Execute Tools
├── File operations
├── Shell commands
├── Web searches
└── MCP calls
    ↓
Collect Results
├── Capture output
├── Format results
└── Add to context
    ↓
Loop Until Done
├── Send results to LLM
├── Get next response
└── Execute more tools
    ↓
Final Output
├── Display to user
├── Save to history
└── Track costs
```

---

## Complete Data Flow

### Scenario: User Asks GakrCLI to Fix a Bug

```
1. USER OPENS CHAT PANEL
   ├── Presses Ctrl+Shift+L
   ├── VS Code Extension loads Chat Panel
   └── Session Manager restores previous context

2. USER TYPES MESSAGE
   ├── "Fix the login bug in auth.ts"
   ├── Extension captures message
   └── Adds workspace context (open files, selected code)

3. EXTENSION SENDS TO GAKRCLI
   ├── Spawns gakrcli subprocess
   ├── Passes message via stdin
   ├── Sets working directory to workspace
   └── Injects environment variables

4. GAKRCLI PROCESSES REQUEST
   ├── Reads workspace context
   ├── Loads .gakr-profile.json (provider config)
   ├── Connects to LLM (e.g., OpenAI)
   └── Sends prompt with tools available

5. LLM RESPONDS WITH PLAN
   ├── "I'll examine auth.ts and find the bug"
   ├── Calls tool: read_file("src/auth.ts")
   └── GakrCLI executes tool

6. GAKRCLI EXECUTES TOOLS
   ├── Reads auth.ts file
   ├── Sends content back to LLM
   ├── LLM analyzes code
   └── LLM identifies bug

7. LLM PROPOSES FIX
   ├── "The bug is in line 45"
   ├── Calls tool: edit_file("src/auth.ts", ...)
   └── GakrCLI executes edit

8. GAKRCLI STREAMS RESPONSE
   ├── Sends chunks to Extension
   ├── Extension parses chunks
   ├── Chat Panel displays in real-time
   └── Shows: "Fixed bug on line 45"

9. EXTENSION SHOWS DIFF
   ├── Displays changes in Diff Viewer
   ├── Shows before/after code
   ├── User can review changes
   └── User accepts or rejects

10. SESSION SAVED
    ├── Chat history persisted
    ├── Session metadata saved
    ├── Cost tracked
    └── Ready for next message
```

---

## Communication Protocols

### Extension ↔ GakrCLI (Subprocess)

**Method**: stdin/stdout pipes

```
Extension Process
    ↓
Spawn gakrcli subprocess
    ↓
Write message to stdin
    ↓
Read streaming output from stdout
    ↓
Parse and display in real-time
```

**Message Format**:
```json
{
  "type": "message",
  "content": "Fix the bug",
  "context": {
    "workspace": "/path/to/project",
    "openFiles": ["src/auth.ts"],
    "selectedCode": "..."
  }
}
```

### GakrCLI ↔ IDE Extension (WebSocket/SSE)

**Method**: WebSocket or Server-Sent Events

```
IDE Extension
    ↓
Connect to ws://127.0.0.1:[port]
    ↓
Send: { method: "reference_file", params: { path: "src/auth.ts" } }
    ↓
Receive: { result: "file content..." }
    ↓
Display in IDE
```

### GakrCLI ↔ LLM Provider (HTTP/API)

**Method**: REST API or streaming

```
GakrCLI
    ↓
POST /v1/chat/completions (OpenAI)
    ↓
Stream response chunks
    ↓
Parse tool calls
    ↓
Execute tools
    ↓
Send results back to LLM
```

---

## Configuration & Context

### Workspace Profile (.gakr-profile.json)

Located in workspace root:

```json
{
  "provider": "openai",
  "model": "gpt-4",
  "temperature": 0.7,
  "maxTokens": 4096,
  "systemPrompt": "You are a helpful coding assistant",
  "tools": {
    "allowFileWrite": true,
    "allowShellExec": true,
    "allowWebFetch": true
  }
}
```

**Used By**:
- Extension: Displays provider status
- GakrCLI: Configures LLM and tools
- IDE: Determines capabilities

### Environment Variables

**Set by Extension**:
```bash
GAKR_CODE_IDE_HOST_OVERRIDE=127.0.0.1
GAKR_CODE_SSE_PORT=8080
GAKR_CODE_USE_OPENAI=1  # if useOpenAIShim enabled
```

**Set by GakrCLI**:
```bash
ANTHROPIC_API_KEY=sk-...
OPENAI_API_KEY=sk-...
GEMINI_API_KEY=...
```

---

## Session Lifecycle

### Complete Session Flow

```
1. INITIALIZATION
   ├── User opens VS Code
   ├── Extension activates
   ├── Control Center loads
   └── Session Manager initializes

2. LAUNCH
   ├── User clicks "Launch GakrCLI"
   ├── Extension determines workspace
   ├── Creates terminal
   └── Runs: gakrcli

3. IDE DETECTION
   ├── GakrCLI starts
   ├── Scans for IDE lockfiles
   ├── Finds VS Code extension
   └── Connects via WebSocket

4. CHAT SESSION
   ├── User opens Chat Panel
   ├── Extension spawns gakrcli subprocess
   ├── User sends message
   ├── GakrCLI processes and streams response
   ├── Extension displays in real-time
   └── Session saved to history

5. TOOL EXECUTION
   ├── LLM calls tools
   ├── GakrCLI executes (file ops, shell, web)
   ├── Results sent back to LLM
   ├── LLM continues reasoning
   └── Cycle repeats until done

6. PERSISTENCE
   ├── Chat history saved
   ├── Session metadata stored
   ├── Cost tracked
   └── Ready to resume

7. CLEANUP
   ├── User closes chat
   ├── GakrCLI subprocess terminates
   ├── Session finalized
   └── Resources freed
```

---

## Key Features Enabled by Integration

### 1. Project-Aware Launch

```
User clicks "Launch GakrCLI"
    ↓
Extension detects:
├── Active file location
├── Workspace folder
└── Project structure
    ↓
Launches from most relevant directory
├── Active file directory (if in workspace)
├── Workspace root (if no active file)
└── VS Code default (if no workspace)
```

### 2. Context Sharing

```
Extension provides to GakrCLI:
├── Open files list
├── Selected code
├── Workspace path
├── Git context
├── Project config
└── Environment variables
```

### 3. Real-Time Streaming

```
GakrCLI streams response
    ↓
Extension receives chunks
    ↓
Chat Panel displays immediately
    ↓
User sees response as it's generated
```

### 4. Diff Viewing

```
GakrCLI proposes changes
    ↓
Extension captures diff
    ↓
Diff Viewer displays:
├── Before code
├── After code
├── Highlighted changes
└── Accept/reject buttons
```

### 5. Permission Control

```
GakrCLI wants to execute tool
    ↓
Extension checks permission mode:
├── default: Ask user
├── acceptEdits: Auto-approve edits
├── bypassPermissions: Auto-approve all
└── plan: Read-only mode
    ↓
Execute or prompt user
```

---

## Troubleshooting Connection Issues

### IDE Not Detected

```
Check:
1. IDE extension installed
2. IDE running
3. Lockfile exists: ls ~/.gakrcli/ide/
4. Port responding: netstat -an | grep [port]
5. Workspace matches current directory
```

### Extension Won't Launch GakrCLI

```
Check:
1. gakrcli installed: which gakrcli
2. In PATH: echo $PATH
3. Executable: ls -la $(which gakrcli)
4. Node.js 20+: node --version
5. Terminal permissions
```

### Chat Panel Not Responding

```
Check:
1. gakrcli subprocess running
2. LLM API key set
3. Network connectivity
4. Provider credentials valid
5. Check logs: ~/.gakrcli/logs/
```

---

## Summary

### Three-Layer Architecture

| Layer | Component | Purpose |
|-------|-----------|---------|
| **UI** | VS Code Extension | User interface, chat, control center |
| **Bridge** | IDE Integration | IDE detection, communication, context |
| **Engine** | GakrCLI CLI | LLM integration, tool execution, reasoning |

### Data Flow

```
User Input (Extension)
    ↓
GakrCLI Process (CLI)
    ↓
LLM Provider (API)
    ↓
Tool Execution (Files, Shell, Web)
    ↓
Results Back to LLM
    ↓
Display in Extension
    ↓
Save to Session
```

### Key Connections

- **Extension ↔ GakrCLI**: stdin/stdout pipes
- **GakrCLI ↔ IDE**: WebSocket/SSE
- **GakrCLI ↔ LLM**: REST API
- **Extension ↔ Workspace**: File system access

### Enabled Workflows

✓ Chat with AI in VS Code
✓ Reference files and code
✓ Review proposed changes
✓ Execute multi-step tasks
✓ Persist session history
✓ Control permissions
✓ Track costs
✓ Support multiple IDEs

---

## Getting Started

1. **Install Extension**: Search "GakrCLI" in VS Code Extensions
2. **Install CLI**: `npm install -g @gakr-gakr/gakrcli`
3. **Set API Key**: `export OPENAI_API_KEY=sk-...`
4. **Open Chat**: Press `Ctrl+Shift+L`
5. **Start Chatting**: Type your request

**Version**: GakrCLI v0.3.0 + Extension v0.2.0
**Status**: Published to VS Code Marketplace
