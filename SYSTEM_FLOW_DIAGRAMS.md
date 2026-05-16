# GakrCLI System Flow Diagrams

## 1. Complete System Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                          VS CODE EDITOR                                 │
│                                                                          │
│  ┌────────────────────────────────────────────────────────────────┐    │
│  │  GakrCLI VS Code Extension (v0.2.0)                           │    │
│  │                                                                │    │
│  │  Activity Bar (Left Sidebar)                                 │    │
│  │  ├── Control Center View                                     │    │
│  │  │   ├── Status Display                                      │    │
│  │  │   ├── Launch Buttons                                      │    │
│  │  │   └── Configuration Links                                 │    │
│  │  │                                                            │    │
│  │  └── Chat Panel View                                         │    │
│  │      ├── Message Display                                     │    │
│  │      ├── Input Field                                         │    │
│  │      ├── Session History                                     │    │
│  │      └── Diff Viewer                                         │    │
│  │                                                                │    │
│  │  Keyboard Shortcuts                                          │    │
│  │  ├── Ctrl+Shift+L: Open Chat                                │    │
│  │  ├── Ctrl+Alt+K: Reference Files                            │    │
│  │  └── Cmd+Esc: Quick Launch                                  │    │
│  └────────────────────────────────────────────────────────────────┘    │
│                                                                          │
│  ┌────────────────────────────────────────────────────────────────┐    │
│  │  Integrated Terminal                                           │    │
│  │  $ gakrcli                                                     │    │
│  │  > Waiting for input...                                        │    │
│  └────────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────────┘
                                  ↕
                    (stdin/stdout pipes)
                                  ↕
┌─────────────────────────────────────────────────────────────────────────┐
│                    IDE INTEGRATION LAYER                                │
│                                                                          │
│  IDE Detection & Communication                                         │
│  ├── Scan: ~/.gakrcli/ide/[port].lock                                 │
│  ├── Validate: Process running, port responding, workspace match      │
│  ├── Connect: WebSocket (ws://) or SSE (http://)                      │
│  └── Features: File reference, quick launch, diff viewing             │
│                                                                          │
│  Supported IDEs                                                        │
│  ├── VS Code Family: VS Code, Cursor, Windsurf                        │
│  └── JetBrains: IntelliJ, PyCharm, WebStorm, etc.                     │
└─────────────────────────────────────────────────────────────────────────┘
                                  ↕
                    (WebSocket/SSE or HTTP)
                                  ↕
┌─────────────────────────────────────────────────────────────────────────┐
│                    GAKRCLI CLI TOOL (v0.5.1)                            │
│                                                                          │
│  ┌─────────────────────────────────────────────────────────────┐       │
│  │ Input Processing                                            │       │
│  │ ├── Parse user message                                      │       │
│  │ ├── Load workspace context                                  │       │
│  │ ├── Read .gakrcli-profile.json                                │       │
│  │ └── Prepare system prompt                                   │       │
│  └─────────────────────────────────────────────────────────────┘       │
│                                  ↓                                      │
│  ┌─────────────────────────────────────────────────────────────┐       │
│  │ LLM Provider Integration                                    │       │
│  │ ├── OpenAI (GPT-4, GPT-3.5)                                │       │
│  │ ├── Anthropic (Claude)                                      │       │
│  │ ├── Google (Gemini)                                         │       │
│  │ ├── Ollama (Local)                                          │       │
│  │ ├── Bedrock (AWS)                                           │       │
│  │ └── 10+ more providers                                      │       │
│  └─────────────────────────────────────────────────────────────┘       │
│                                  ↓                                      │
│  ┌─────────────────────────────────────────────────────────────┐       │
│  │ Tool Execution Engine                                       │       │
│  │ ├── File Operations (read, write, edit)                    │       │
│  │ ├── Shell Commands (bash, sh)                              │       │
│  │ ├── Search Tools (grep, glob)                              │       │
│  │ ├── Web Tools (fetch, search)                              │       │
│  │ └── MCP Integration (custom tools)                         │       │
│  └─────────────────────────────────────────────────────────────┘       │
│                                  ↓                                      │
│  ┌─────────────────────────────────────────────────────────────┐       │
│  │ Agent Reasoning Loop                                        │       │
│  │ ├── Process LLM response                                    │       │
│  │ ├── Parse tool calls                                        │       │
│  │ ├── Execute tools                                           │       │
│  │ ├── Collect results                                         │       │
│  │ └── Send back to LLM (loop until done)                     │       │
│  └─────────────────────────────────────────────────────────────┘       │
│                                  ↓                                      │
│  ┌─────────────────────────────────────────────────────────────┐       │
│  │ Output & Persistence                                        │       │
│  │ ├── Stream response to Extension                            │       │
│  │ ├── Save to session history                                 │       │
│  │ ├── Track costs                                             │       │
│  │ └── Update IDE with changes                                 │       │
│  └─────────────────────────────────────────────────────────────┘       │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 2. User Interaction Flow

```
START: User Opens VS Code
  │
  ├─→ Extension Activates
  │   ├─→ Load Control Center
  │   ├─→ Check gakrcli installed
  │   ├─→ Read workspace profile
  │   └─→ Display status
  │
  ├─→ User Clicks "Launch GakrCLI"
  │   ├─→ Determine workspace
  │   ├─→ Create terminal
  │   ├─→ Run: gakrcli
  │   └─→ Terminal opens
  │
  ├─→ GakrCLI Starts
  │   ├─→ Detect IDE
  │   ├─→ Connect to IDE extension
  │   └─→ Ready for input
  │
  ├─→ User Presses Ctrl+Shift+L
  │   ├─→ Open Chat Panel
  │   ├─→ Load session history
  │   └─→ Display previous messages
  │
  ├─→ User Types Message
  │   ├─→ "Fix the login bug"
  │   ├─→ Extension captures context
  │   └─→ Adds open files, selected code
  │
  ├─→ Extension Sends to GakrCLI
  │   ├─→ Spawn subprocess
  │   ├─→ Pass message via stdin
  │   └─→ Set working directory
  │
  ├─→ GakrCLI Processes
  │   ├─→ Parse message
  │   ├─→ Load context
  │   ├─→ Connect to LLM
  │   └─→ Send prompt
  │
  ├─→ LLM Responds
  │   ├─→ Generate response
  │   ├─→ Call tools
  │   └─→ Stream chunks
  │
  ├─→ GakrCLI Executes Tools
  │   ├─→ Read files
  │   ├─→ Execute commands
  │   ├─→ Search code
  │   └─→ Collect results
  │
  ├─→ GakrCLI Streams Response
  │   ├─→ Send chunks to Extension
  │   ├─→ Extension parses
  │   └─→ Chat Panel displays
  │
  ├─→ User Sees Response
  │   ├─→ Real-time streaming
  │   ├─→ Tool execution shown
  │   └─→ Diff viewer displays changes
  │
  ├─→ User Reviews Changes
  │   ├─→ Accept changes
  │   ├─→ Reject changes
  │   └─→ Request modifications
  │
  ├─→ Session Saved
  │   ├─→ Chat history persisted
  │   ├─→ Session metadata stored
  │   └─→ Cost tracked
  │
  └─→ Ready for Next Message
      └─→ Loop back to "User Types Message"
```

---

## 3. IDE Detection & Connection

```
GakrCLI Starts
  │
  ├─→ Scan IDE Lockfiles
  │   ├─→ Check: ~/.gakrcli/ide/
  │   ├─→ List all .lock files
  │   └─→ Sort by modification time
  │
  ├─→ For Each Lockfile
  │   │
  │   ├─→ Read Lockfile
  │   │   ├─→ Parse JSON
  │   │   ├─→ Extract: port, workspace, PID, IDE name
  │   │   └─→ Get: transport (ws or sse), auth token
  │   │
  │   ├─→ Validate Lockfile
  │   │   ├─→ Check: Is process running? (check PID)
  │   │   ├─→ Check: Is port responding? (test connection)
  │   │   ├─→ Check: Is workspace matching? (check cwd)
  │   │   └─→ Check: Is IDE parent process? (check ancestry)
  │   │
  │   ├─→ If Valid
  │   │   ├─→ Determine host IP
  │   │   │   ├─→ Normal: 127.0.0.1
  │   │   │   ├─→ WSL: Gateway IP (172.17.0.1)
  │   │   │   └─→ Override: GAKR_CODE_IDE_HOST_OVERRIDE
  │   │   │
  │   │   ├─→ Build connection URL
  │   │   │   ├─→ WebSocket: ws://127.0.0.1:[port]
  │   │   │   └─→ SSE: http://127.0.0.1:[port]/sse
  │   │   │
  │   │   ├─→ Connect to IDE
  │   │   │   ├─→ Establish connection
  │   │   │   ├─→ Send auth token (if present)
  │   │   │   └─→ Register as client
  │   │   │
  │   │   └─→ IDE Features Enabled
  │   │       ├─→ Reference files (Ctrl+Alt+K)
  │   │       ├─→ Quick launch (Cmd+Esc)
  │   │       ├─→ View diffs
  │   │       └─→ Workspace awareness
  │   │
  │   └─→ If Invalid
  │       ├─→ Skip this lockfile
  │       ├─→ Mark for cleanup
  │       └─→ Continue to next
  │
  └─→ Connection Complete
      ├─→ IDE connected and ready
      ├─→ Features available
      └─→ Ready for user input
```

---

## 4. Chat Message Processing

```
User Sends Message
  │
  ├─→ Extension Captures
  │   ├─→ Get message text
  │   ├─→ Get workspace context
  │   ├─→ Get open files
  │   ├─→ Get selected code
  │   └─→ Get git context
  │
  ├─→ Extension Spawns GakrCLI
  │   ├─→ Create subprocess
  │   ├─→ Set working directory
  │   ├─→ Set environment variables
  │   └─→ Connect stdin/stdout
  │
  ├─→ GakrCLI Receives Message
  │   ├─→ Parse input
  │   ├─→ Load workspace config
  │   ├─→ Read .gakrcli-profile.json
  │   ├─→ Prepare system prompt
  │   └─→ Build LLM request
  │
  ├─→ Send to LLM Provider
  │   ├─→ Include: message, context, tools
  │   ├─→ Stream: response chunks
  │   └─→ Handle: tool calls
  │
  ├─→ LLM Responds
  │   ├─→ Generate text
  │   ├─→ Call tools
  │   └─→ Stream chunks
  │
  ├─→ GakrCLI Processes Response
  │   ├─→ Parse chunks
  │   ├─→ Extract tool calls
  │   ├─→ Execute tools
  │   │   ├─→ File operations
  │   │   ├─→ Shell commands
  │   │   ├─→ Web searches
  │   │   └─→ MCP calls
  │   ├─→ Collect results
  │   └─→ Send back to LLM
  │
  ├─→ GakrCLI Streams to Extension
  │   ├─→ Send chunks via stdout
  │   ├─→ Include: text, tool calls, results
  │   └─→ Stream in real-time
  │
  ├─→ Extension Parses Stream
  │   ├─→ Read chunks
  │   ├─→ Parse JSON
  │   ├─→ Extract: text, tools, diffs
  │   └─→ Update UI
  │
  ├─→ Chat Panel Displays
  │   ├─→ Show text in real-time
  │   ├─→ Show tool execution
  │   ├─→ Show results
  │   ├─→ Show diffs
  │   └─→ Update as chunks arrive
  │
  ├─→ User Reviews
  │   ├─→ Read response
  │   ├─→ Review changes
  │   ├─→ Accept or reject
  │   └─→ Ask follow-up
  │
  └─→ Session Saved
      ├─→ Save message
      ├─→ Save response
      ├─→ Save metadata
      └─→ Ready for next message
```

---

## 5. Tool Execution Flow

```
LLM Decides to Execute Tool
  │
  ├─→ Tool Call: read_file("src/auth.ts")
  │   │
  │   ├─→ GakrCLI Receives Call
  │   ├─→ Validate: File exists, in workspace
  │   ├─→ Check: Permissions allowed
  │   ├─→ Execute: Read file content
  │   ├─→ Return: File content to LLM
  │   └─→ LLM: Analyzes content
  │
  ├─→ Tool Call: execute_bash("npm test")
  │   │
  │   ├─→ GakrCLI Receives Call
  │   ├─→ Validate: Command safe
  │   ├─→ Check: Permissions allowed
  │   ├─→ Execute: Run command
  │   ├─→ Capture: stdout, stderr, exit code
  │   ├─→ Return: Results to LLM
  │   └─→ LLM: Interprets results
  │
  ├─→ Tool Call: edit_file("src/auth.ts", ...)
  │   │
  │   ├─→ GakrCLI Receives Call
  │   ├─→ Validate: File exists, in workspace
  │   ├─→ Check: Permissions allowed (acceptEdits mode)
  │   ├─→ Execute: Apply edits
  │   ├─→ Create: Diff for review
  │   ├─→ Return: Confirmation to LLM
  │   ├─→ Send: Diff to Extension
  │   └─→ Extension: Shows in Diff Viewer
  │
  ├─→ Tool Call: web_search("login bug fix")
  │   │
  │   ├─→ GakrCLI Receives Call
  │   ├─→ Execute: Search web
  │   ├─→ Fetch: Top results
  │   ├─→ Parse: Content
  │   ├─→ Return: Results to LLM
  │   └─→ LLM: Uses for context
  │
  └─→ Loop Until Done
      ├─→ LLM generates next response
      ├─→ May call more tools
      ├─→ Or provide final answer
      └─→ Stream to Extension
```

---

## 6. Session Persistence

```
Chat Session Lifecycle
  │
  ├─→ Session Start
  │   ├─→ Generate session ID
  │   ├─→ Create session directory
  │   ├─→ Initialize message array
  │   └─→ Set start timestamp
  │
  ├─→ User Sends Message
  │   ├─→ Add to message array
  │   ├─→ Save to disk
  │   ├─→ Execute in GakrCLI
  │   └─→ Stream response
  │
  ├─→ Receive Response
  │   ├─→ Parse chunks
  │   ├─→ Add to message array
  │   ├─→ Save to disk
  │   ├─→ Display in Chat Panel
  │   └─→ Track cost
  │
  ├─→ Tool Execution
  │   ├─→ Log tool calls
  │   ├─→ Log results
  │   ├─→ Save to session
  │   └─→ Display in UI
  │
  ├─→ Session Pause
  │   ├─→ Save current state
  │   ├─→ Close subprocess
  │   ├─→ Keep session data
  │   └─→ Ready to resume
  │
  ├─→ Session Resume
  │   ├─→ Load session data
  │   ├─→ Restore messages
  │   ├─→ Display history
  │   ├─→ Spawn new subprocess
  │   └─→ Ready for next message
  │
  ├─→ Session End
  │   ├─→ Save final state
  │   ├─→ Calculate total cost
  │   ├─→ Archive session
  │   └─→ Clean up resources
  │
  └─→ Session Storage
      ├─→ Location: ~/.gakrcli/sessions/
      ├─→ Format: JSON
      ├─→ Contains:
      │   ├─→ Session ID
      │   ├─→ Messages
      │   ├─→ Metadata
      │   ├─→ Cost tracking
      │   └─→ Timestamps
      └─→ Accessible: Via "Resume Session" command
```

---

## 7. Permission & Safety Flow

```
Tool Execution Request
  │
  ├─→ Check Permission Mode
  │   │
  │   ├─→ Mode: "default"
  │   │   ├─→ Prompt user for every tool
  │   │   ├─→ Show: Tool name, parameters
  │   │   ├─→ User: Approve or deny
  │   │   └─→ Execute: Based on choice
  │   │
  │   ├─→ Mode: "acceptEdits"
  │   │   ├─→ File edit? → Auto-approve
  │   │   ├─→ Shell command? → Prompt user
  │   │   ├─→ Web fetch? → Prompt user
  │   │   └─→ Other? → Prompt user
  │   │
  │   ├─→ Mode: "bypassPermissions"
  │   │   ├─→ All tools → Auto-approve
  │   │   ├─→ No prompts
  │   │   └─→ Execute immediately
  │   │
  │   └─→ Mode: "plan"
  │       ├─→ All tools → Deny
  │       ├─→ Read-only mode
  │       └─→ No file modifications
  │
  ├─→ If Approved
  │   ├─→ Execute tool
  │   ├─→ Capture results
  │   ├─→ Send to LLM
  │   └─→ Continue
  │
  └─→ If Denied
      ├─→ Skip tool
      ├─→ Notify LLM
      ├─→ LLM: Try alternative
      └─→ Continue
```

---

## 8. Error Handling & Recovery

```
Error Occurs
  │
  ├─→ GakrCLI Error
  │   ├─→ Parse error
  │   ├─→ Tool execution failed
  │   ├─→ LLM API error
  │   ├─→ Network error
  │   │
  │   ├─→ Log error
  │   ├─→ Send to Extension
  │   ├─→ Display in Chat
  │   └─→ Suggest recovery
  │
  ├─→ Extension Error
  │   ├─→ Subprocess crashed
  │   ├─→ Webview error
  │   ├─→ File system error
  │   │
  │   ├─→ Log error
  │   ├─→ Show error message
  │   ├─→ Offer retry
  │   └─→ Suggest troubleshooting
  │
  ├─→ IDE Connection Error
  │   ├─→ Connection lost
  │   ├─→ Port not responding
  │   ├─→ Lockfile stale
  │   │
  │   ├─→ Cleanup stale lockfile
  │   ├─→ Attempt reconnect
  │   ├─→ Fallback to terminal mode
  │   └─→ Notify user
  │
  ├─→ Recovery Strategies
  │   ├─→ Retry: Automatic retry with backoff
  │   ├─→ Fallback: Use alternative method
  │   ├─→ Cleanup: Remove stale files
  │   ├─→ Restart: Restart subprocess
  │   └─→ Manual: User intervention
  │
  └─→ Continue or Abort
      ├─→ If recoverable: Continue
      ├─→ If not: Abort gracefully
      └─→ Preserve session state
```

---

## Summary

These diagrams show:

1. **Complete System**: All three layers and their connections
2. **User Interaction**: Step-by-step user workflow
3. **IDE Detection**: How GakrCLI finds and connects to IDE
4. **Message Processing**: Complete chat message flow
5. **Tool Execution**: How tools are called and executed
6. **Session Persistence**: How conversations are saved
7. **Permissions**: How safety and permissions are enforced
8. **Error Handling**: How errors are caught and recovered

All components work together to provide a seamless AI-powered coding experience in VS Code.
