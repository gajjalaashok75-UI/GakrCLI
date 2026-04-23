# GakrCLI + VS Code Extension - Quick Start Integration Guide

## What You Have

✓ **GakrCLI CLI** (v0.3.0) - Published to npm
✓ **VS Code Extension** (v0.2.0) - Published to VS Code Marketplace
✓ **IDE Integration** - Automatic IDE detection and connection

---

## Installation (5 minutes)

### Step 1: Install GakrCLI CLI

```bash
npm install -g @gakr-gakr/gakrcli
```

Verify:
```bash
gakrcli --version
# Output: 0.3.0
```

### Step 2: Install VS Code Extension

**Option A: From VS Code**
1. Open VS Code
2. Press `Ctrl+Shift+X` (Extensions)
3. Search: "GakrCLI"
4. Click **Install**

**Option B: From Command Line**
```bash
code --install-extension gakr-gakr.gakrcli-vscode
```

Verify:
```bash
code --list-extensions | grep gakrcli
# Output: gakr-gakr.gakrcli-vscode
```

### Step 3: Set API Key

Choose your LLM provider:

**OpenAI:**
```bash
export OPENAI_API_KEY=sk-...
```

**Anthropic:**
```bash
export ANTHROPIC_API_KEY=sk-ant-...
```

**Google Gemini:**
```bash
export GEMINI_API_KEY=...
```

**Ollama (Local):**
```bash
# No API key needed, just run Ollama
ollama serve
```

### Step 4: Restart VS Code

Close and reopen VS Code to activate the extension.

---

## First Use (2 minutes)

### 1. Open Control Center

Look for the **torch icon** in the left sidebar (Activity Bar).

You should see:
```
GakrCLI Control Center
├── Status: ✓ Installed
├── Command: gakrcli
├── Workspace: /path/to/your/project
├── Profile: .gakr-profile.json (not found)
└── Provider: OpenAI (from environment)
```

### 2. Launch GakrCLI

Click **"Launch GakrCLI"** button.

A terminal opens with:
```
$ gakrcli
> Waiting for input...
```

### 3. Open Chat Panel

Press `Ctrl+Shift+L` (or `Cmd+Shift+L` on macOS).

Chat panel opens on the right side.

### 4. Start Chatting

Type your first message:
```
Fix the login bug in auth.ts
```

Press Enter.

GakrCLI will:
1. Read your workspace files
2. Connect to your LLM provider
3. Analyze the code
4. Propose fixes
5. Show changes in real-time

---

## How It Works (Simple Explanation)

### The Three Layers

```
┌─────────────────────────────────────┐
│  VS Code Extension (UI)             │
│  - Chat panel                       │
│  - Control center                   │
│  - Diff viewer                      │
└─────────────────────────────────────┘
           ↕ (stdin/stdout)
┌─────────────────────────────────────┐
│  GakrCLI CLI (Engine)               │
│  - Processes messages               │
│  - Calls LLM                        │
│  - Executes tools                   │
└─────────────────────────────────────┘
           ↕ (API calls)
┌─────────────────────────────────────┐
│  LLM Provider (AI)                  │
│  - OpenAI, Anthropic, Gemini, etc.  │
│  - Generates responses              │
│  - Calls tools                      │
└─────────────────────────────────────┘
```

### What Happens When You Send a Message

1. **You type** in Chat Panel
2. **Extension captures** your message + workspace context
3. **Extension spawns** gakrcli subprocess
4. **GakrCLI processes** your message
5. **GakrCLI calls** your LLM provider (OpenAI, etc.)
6. **LLM responds** with text and tool calls
7. **GakrCLI executes** tools (read files, run commands, etc.)
8. **GakrCLI streams** response back to Extension
9. **Extension displays** in real-time in Chat Panel
10. **Session saved** for later resume

---

## Key Features

### 1. Chat Panel (Ctrl+Shift+L)

```
┌─────────────────────────────────────┐
│ GakrCLI Chat                        │
├─────────────────────────────────────┤
│ You: Fix the login bug              │
│                                     │
│ Assistant: I'll analyze auth.ts...  │
│ [Tool: read_file("src/auth.ts")]   │
│ Found bug on line 45...             │
│ [Tool: edit_file(...)]              │
│ Fixed! Here's the change:           │
│ + const token = jwt.sign(...)       │
│ - const token = jwt.encode(...)     │
│                                     │
│ [Type your message...]              │
└─────────────────────────────────────┘
```

### 2. Control Center (Activity Bar)

```
┌─────────────────────────────────────┐
│ GakrCLI Control Center              │
├─────────────────────────────────────┤
│ Status: ✓ Installed                 │
│ Command: gakrcli                    │
│ Workspace: /path/to/project         │
│ Profile: .gakr-profile.json         │
│ Provider: OpenAI                    │
├─────────────────────────────────────┤
│ [Launch GakrCLI]                    │
│ [Launch in Workspace Root]          │
│ [Open Workspace Profile]            │
│ [Open Repository]                   │
│ [Open Setup Guide]                  │
└─────────────────────────────────────┘
```

### 3. Diff Viewer

When GakrCLI proposes changes:
```
Before:                    After:
const token =              const token =
  jwt.encode(...)            jwt.sign(...)
```

You can:
- ✓ Accept changes
- ✗ Reject changes
- ? Ask for modifications

### 4. IDE Integration

When running from IDE terminal:
- Reference files: `Ctrl+Alt+K`
- Quick launch: `Cmd+Esc`
- View diffs in IDE
- Workspace awareness

---

## Common Tasks

### Task 1: Fix a Bug

```
1. Open Chat Panel (Ctrl+Shift+L)
2. Type: "Fix the bug in auth.ts"
3. GakrCLI reads the file
4. LLM analyzes and proposes fix
5. Review changes in Diff Viewer
6. Accept or request modifications
```

### Task 2: Write New Code

```
1. Open Chat Panel
2. Type: "Create a login form component"
3. GakrCLI creates the file
4. Review in Diff Viewer
5. Accept to save
```

### Task 3: Refactor Code

```
1. Select code in editor
2. Open Chat Panel
3. Type: "Refactor this to use async/await"
4. GakrCLI refactors
5. Review and accept
```

### Task 4: Debug Issue

```
1. Open Chat Panel
2. Type: "Why is this API call failing?"
3. GakrCLI reads relevant files
4. Runs tests to debug
5. Proposes solution
```

### Task 5: Generate Documentation

```
1. Open Chat Panel
2. Type: "Generate JSDoc comments for this file"
3. GakrCLI adds documentation
4. Review and accept
```

---

## Configuration

### Workspace Profile (.gakr-profile.json)

Create in your project root:

```json
{
  "provider": "openai",
  "model": "gpt-4",
  "temperature": 0.7,
  "maxTokens": 4096,
  "systemPrompt": "You are a helpful coding assistant"
}
```

### Extension Settings

Open VS Code Settings (`Ctrl+,`):

```
GakrCLI: Launch Command
  Default: gakrcli
  
GakrCLI: Terminal Name
  Default: GakrCLI
  
GakrCLI: Use OpenAI Shim
  Default: false
  
GakrCLI: Permission Mode
  Default: acceptEdits
  Options: default, acceptEdits, bypassPermissions, plan
```

### Permission Modes

| Mode | Behavior |
|------|----------|
| `default` | Prompt for every tool use |
| `acceptEdits` | Auto-approve file edits, prompt for others |
| `bypassPermissions` | Auto-approve all operations |
| `plan` | Read-only mode, no modifications |

---

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl+Shift+L` | Open Chat Panel |
| `Ctrl+Alt+K` | Reference files/lines |
| `Cmd+Esc` | Quick launch |
| `Ctrl+`` | Open terminal |
| `Ctrl+Shift+P` | Command palette |

---

## Troubleshooting

### Extension Not Showing

**Problem**: Control Center doesn't appear

**Solution**:
```bash
# Reload VS Code
Ctrl+Shift+P → "Reload Window"

# Check extension installed
code --list-extensions | grep gakrcli
```

### GakrCLI Not Found

**Problem**: "gakrcli command not found"

**Solution**:
```bash
# Install globally
npm install -g @gakr-gakr/gakrcli

# Verify
which gakrcli
gakrcli --version

# Restart VS Code
```

### Chat Panel Won't Open

**Problem**: Error when opening chat

**Solution**:
```bash
# Check gakrcli installed
gakrcli --version

# Check Node.js version
node --version  # Should be 20+

# Restart VS Code
```

### API Key Not Working

**Problem**: "Invalid API key" error

**Solution**:
```bash
# Check API key set
echo $OPENAI_API_KEY

# Set correct key
export OPENAI_API_KEY=sk-...

# Restart VS Code
```

### IDE Not Detected

**Problem**: IDE features not working

**Solution**:
```bash
# Check lockfile exists
ls ~/.gakrcli/ide/

# Restart IDE
# Run from IDE terminal
gakrcli
```

---

## Next Steps

### 1. Create Workspace Profile

```bash
# In your project root
cat > .gakr-profile.json << 'EOF'
{
  "provider": "openai",
  "model": "gpt-4",
  "temperature": 0.7
}
EOF
```

### 2. Configure Extension Settings

Open VS Code Settings and customize:
- Launch command
- Terminal name
- Permission mode
- OpenAI shim

### 3. Try Different Providers

Experiment with:
- OpenAI (GPT-4)
- Anthropic (Claude)
- Google (Gemini)
- Ollama (Local)

### 4. Explore Advanced Features

- Session management
- Cost tracking
- MCP integration
- Custom tools

### 5. Read Full Documentation

- `COMPLETE_SYSTEM_ARCHITECTURE.md` - Deep dive
- `SYSTEM_FLOW_DIAGRAMS.md` - Visual flows
- `IDE_INTEGRATION_GUIDE.md` - IDE features
- `VSCODE_EXTENSION_GUIDE.md` - Extension details

---

## Support & Resources

### Documentation
- GitHub: https://github.com/gakr-gakr/gakr
- VS Code Marketplace: https://marketplace.visualstudio.com/items?itemName=gakr-gakr.gakrcli-vscode
- npm: https://www.npmjs.com/package/@gakr-gakr/gakrcli

### Commands
```bash
# Check system
gakrcli doctor:runtime

# Verify privacy
gakrcli verify:privacy

# List extensions
code --list-extensions

# Manual IDE selection
gakrcli /ide
```

### Logs
```bash
# Check logs
cat ~/.gakrcli/logs/

# Check sessions
ls ~/.gakrcli/sessions/

# Check IDE lockfiles
ls ~/.gakrcli/ide/
```

---

## Summary

**You now have:**

✓ GakrCLI CLI (v0.3.0) - AI-powered coding assistant
✓ VS Code Extension (v0.2.0) - Beautiful UI in VS Code
✓ IDE Integration - Automatic IDE detection
✓ Chat Panel - Real-time conversations
✓ Control Center - Status and quick actions
✓ Session Management - Persistent history
✓ Multi-provider Support - OpenAI, Anthropic, Gemini, Ollama, etc.

**To get started:**

1. Install both tools
2. Set API key
3. Open Chat Panel (Ctrl+Shift+L)
4. Start chatting!

**Happy coding! 🚀**
