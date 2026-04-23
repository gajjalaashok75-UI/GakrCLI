# Gakr — Capabilities, Tools & Agents (v0.2.6)

## Overview

Gakr is a terminal-first coding-agent CLI that brings the powerful Claude Code workflow to multiple LLM providers. It supports tool calling, streaming responses, file operations, MCP (Model Context Protocol), and multi-step agent reasoning.

---

## Core Capabilities

### 1. **Tool-Driven Development**
- **File Operations**: Read, write, edit files with streaming support
- **Shell/Bash**: Execute terminal commands and capture output
- **Search**: `grep` for pattern matching, glob patterns for file discovery
- **Web Tools**: WebSearch (DuckDuckGo fallback, Firecrawl optional) and WebFetch
- **Image Support**: URL and base64 image inputs for vision-capable models
- **Interactive Workflows**: Multi-step tool loops with model calls and follow-ups

### 2. **Agent Workflows**
- Autonomous multi-step reasoning and tool execution
- Tool calling loops with streaming output
- Task management and progress tracking
- Slash commands for quick actions (`/help`, `/provider`, `/clear`, etc.)

### 3. **Multi-Provider Support**
- **Anthropic**: Native Claude models via `ANTHROPIC_API_KEY`
- **OpenAI-compatible**: OpenAI, OpenRouter, DeepSeek, Groq, Mistral, Together AI, Azure OpenAI, LM Studio, local `/v1` servers
- **Gemini**: Google Gemini 2.0+ via `GEMINI_API_KEY`
- **GitHub Models**: Free tier via `GITHUB_TOKEN`
- **NVIDIA NIMs**: Enterprise models via `NVIDIA_API_KEY`
- **Codex**: ChatGPT Codex backend (uses `~/.codex/auth.json` or `CODEX_API_KEY`)
- **Ollama**: Local inference, no API key
- **Atomic Chat**: Apple Silicon local models
- **Bedrock**: Amazon Bedrock Claude models
- **Vertex AI**: Claude on Google Cloud
- **Foundry**: Anthropic on Anyscale

### 4. **Provider Profiles**
- Guided setup via `/provider` command
- Saved `.gakr-profile.json` for persistent configuration
- Agent routing: assign different agents to different models for cost/quality optimization
- Environment variable configuration
- `profile:init`, `profile:recommend`, `profile:auto` helpers

### 5. **Code-Specific Features**
- Project onboarding and context extraction
- Cost tracking per session (token usage, spend)
- Interactive REPL-style sessions
- Assistant session chooser
- History persistence
- Git integration (commit, PR creation)

### 6. **Advanced Features**
- MCP (Model Context Protocol) integration
- Privacy-first: no telemetry, no phone-home (verified with `bun run verify:privacy`)
- Bridge mode for remote execution (codespaces, web)
- Bootstrap state management
- Vim keybindings support
- Proactive hints and optimization suggestions
- VS Code extension with Control Center

---

## Tools Available

### File Tools
| Tool | Purpose |
|------|---------|
| `read_file` | Read file contents |
| `write_file` | Create or overwrite files |
| `edit_file` | Edit specific sections of files |
| `glob` | Find files matching patterns |

### System Tools
| Tool | Purpose |
|------|---------|
| `bash` | Execute shell commands |
| `grep` | Search file contents by pattern |

### Web Tools
| Tool | Purpose |
|------|---------|
| `WebSearch` | Search the web (DuckDuckGo or Firecrawl) |
| `WebFetch` | Fetch and parse web pages |

### Agent/Task Tools
| Tool | Purpose |
|------|---------|
| `Task` | Create and manage background tasks |
| `Agent` | Invoke sub-agents for specialized work |

### Model Context Protocol
| Feature | Purpose |
|---------|---------|
| `MCP` | Connect to external tools, services, and data sources |
| `Server` | Run MCP servers for custom integrations |

---

## Subagents/Agents

Subagents are specialized AI personalities invoked for specific tasks:

| Agent | Specialization |
|-------|----------------|
| `Explore` | Fast codebase exploration and Q&A |
| `Plan` | Complex feature planning |
| `Architect` | System design and architecture |
| `TDD-Guide` | Test-driven development |
| `Code-Reviewer` | Code quality and security review |
| `Security-Reviewer` | Vulnerability detection |
| `Build-Error-Resolver` | Compilation and build errors |
| `Doc-Updater` | Documentation generation |
| `Refactor-Cleaner` | Dead code removal |
| `Performance-Optimizer` | Performance tuning |
| `Database-Reviewer` | Database design review |
| `DevOps-Engineer` | Infrastructure and deployment |
| `E2E-Runner` | End-to-end testing |
| `ML-Engineer` | Machine learning workflows |

**Total Known Agents: 14+**

---

## Tools Count

### Built-in Tools
- **File Operations**: 4 (read, write, edit, glob)
- **System Tools**: 2 (bash, grep)
- **Web Tools**: 2 (search, fetch)
- **Agent/Task Tools**: 2+ (Task, Agent dispatch)
- **MCP Integration**: Dynamic (configurable servers)

**Total Core Tools: 10+**

Additional tools available via:
- MCP servers (unlimited)
- Custom provider integrations
- Language-specific tools (depends on model capabilities)

---

## Slash Commands

| Command | Purpose |
|---------|---------|
| `/help` | Show available commands |
| `/provider` | Interactive provider setup |
| `/onboard-github` | GitHub Models authentication |
| `/clear` | Clear session history |
| `/tasks` | List active tasks |
| `/agents` | Manage agent routing |
| `/settings` | View/modify configuration |
| `/attach` | Attach existing session |
| `/export` | Export conversation/results |
| `/commit` | Create git commit with changes |
| `/review` | Code review of unstaged changes |
| `/brief` | Start a brief session |

---

## Configuration

### Environment Variables (Common)

```bash
# Provider selection (pick one)
GAKR_CODE_USE_OPENAI=1          # OpenAI-compatible providers
GAKR_CODE_USE_GEMINI=1          # Google Gemini
GAKR_CODE_USE_NVIDIA=1          # NVIDIA NIMs
GAKR_CODE_USE_GITHUB=1          # GitHub Models
GAKR_CODE_USE_BEDROCK=1         # AWS Bedrock
GAKR_CODE_USE_VERTEX=1          # Google Vertex AI
GAKR_CODE_USE_FOUNDRY=1         # Azure Foundry

# OpenAI-compatible (for OpenAI, OpenRouter, DeepSeek, Groq, Mistral, Together AI, LM Studio, Ollama, Atomic Chat, etc.)
OPENAI_API_KEY="sk-..."
OPENAI_MODEL="model-name"
OPENAI_BASE_URL="https://..."    # optional, defaults to https://api.openai.com/v1

# Specialized providers
ANTHROPIC_API_KEY="sk-ant-..."   # Anthropic (Claude)
GEMINI_API_KEY="..."
NVIDIA_API_KEY="nvapi-..."
GITHUB_TOKEN="ghp_..."           # or GH_TOKEN

# Cloud credentials (Bedrock/Vertex/Foundry)
AWS_ACCESS_KEY_ID="..."
AWS_SECRET_ACCESS_KEY="..."
GOOGLE_APPLICATION_CREDENTIALS="path/to/service-account.json"

# Optional tweaks
GAKR_DISABLE_CO_AUTHORED_BY=1    # Suppress Co-Authored-By in commits
FIRECRAWL_API_KEY="..."          # Advanced web scraping
GAKR_DEBUG=1                     # Enable debug logging
```

### Profile File
Location: `~/.gakr-profile.json` or project-local `.gakr-profile.json`

Example:
```json
{
  "provider": "openai-compatible",
  "apiKey": "sk-...",
  "baseURL": "https://api.openai.com/v1",
  "model": "gpt-4o",
  "temperature": 0.7,
  "maxTokens": 8000
}
```

### Advanced Settings
Location: `~/.gakrcli/settings.json`

```json
{
  "agentModels": {
    "model-1": { "base_url": "...", "api_key": "..." },
    "model-2": { "base_url": "...", "api_key": "..." }
  },
  "agentRouting": {
    "Explore": "model-1",
    "Plan": "model-2",
    "default": "model-1"
  }
}
```

---

## Session Features

### Memory & Persistence
- **Session History**: Automatically saved per project
- **Cost Tracking**: Tokens/cost per session and cumulative
- **Project Context**: Extracted on startup
- **Bootstrap State**: Persistent project onboarding info

### Interactive Elements
- **REPL Mode**: Query-response loop
- **Streaming Output**: Real-time token display
- **Progress Indicators**: Visual feedback during tool execution
- **Error Handling**: Detailed error messages and recovery suggestions

---

## Architecture

```
gakr/
├── src/
│   ├── entrypoints/cli.tsx          # Main CLI entrypoint
│   ├── commands.ts                  # Command implementations
│   ├── tools.ts                     # Tool definitions
│   ├── Task.ts / tasks.ts           # Task management
│   ├── QueryEngine.ts               # Query processing
│   ├── cost-tracker.ts              # Cost tracking
│   ├── history.ts                   # Session history
│   ├── assistant/                   # Agent session management
│   ├── bridge/                      # Remote execution
│   ├── services/                    # Provider integrations
│   ├── tools/                       # Tool implementations
│   ├── commands/                    # Command implementations
│   ├── skills/                      # Skill definitions
│   ├── state/                       # State management
│   └── utils/                       # Utilities
├── scripts/
│   ├── build.ts                     # Build script
│   ├── provider-discovery.ts        # Auto-detect providers
│   ├── provider-launch.ts           # Launch provider
│   ├── system-check.ts              # Health check
│   └── verify-no-phone-home.ts      # Privacy verification
├── bin/
│   └── gakr                        # CLI wrapper
└── dist/
    └── cli.mjs                      # Compiled output
```

---

## Developer Commands

| Command | Purpose |
|---------|---------|
| `npm run build` | Build TypeScript to ESM |
| `npm run dev` | Build and run locally |
| `npm run typecheck` | Type checking |
| `npm run smoke` | Quick build + version check |
| `npm run verify:privacy` | Verify no telemetry |
| `npm run doctor:runtime` | System diagnostics |
| `npm run hardening:strict` | Full validation |

---

## Performance & Limits

### Token Handling
- Streaming support for low-latency interaction
- Adaptive output limits per provider
- Cost tracking to prevent overspend

### Concurrency
- Single-session execution (sequential tool calls)
- Task queue for background work
- Agent dispatch supports parallel subagent execution

### Storage
- Project directory: unlimited file access
- Session memory: persistent per project
- Cache: LRU cache for provider responses

---

## Security & Privacy

- ✅ **No Telemetry**: Verified with automated checks
- ✅ **No Phone-Home**: Stripped from Anthropic source
- ✅ **Local Option**: Full support for local Ollama/Atomic Chat
- ✅ **Credential Management**: Environment variables + profile storage
- ✅ **No Tracking**: No usage metrics or analytics

---

## Supported Models

### Excellent (Full tool calling)
- GPT-4, GPT-4o, GPT-4.1, o3-mini (OpenAI)
- Claude 3.5 Sonnet, Claude 3.7 Sonnet, Claude Opus 4 (Anthropic)
- DeepSeek Chat (DeepSeek)
- Gemini 2.0, Gemini 2.5 (Google)
- NVIDIA NIMs (stepfun models)
- Codex (Codex backend)

### Good (Partial tool support)
- Llama 2 70B+, Llama 3.2, Qwen 2.5 Coder
- Mistral Large
- Groq's models
- LM Studio compatible

### Limited (No/poor tool calling)
- Small models <7B
- deepseek-r1:1.5b
- Base instruct models without tool training

---

## Getting Started

### Quick Start (OpenAI-Compatible)
```bash
export GAKR_CODE_USE_OPENAI=1
export OPENAI_API_KEY=sk-your-key
export OPENAI_MODEL=gpt-4o
gakr
```

### Quick Start (Local Ollama)
```bash
export GAKR_CODE_USE_OPENAI=1
export OPENAI_BASE_URL=http://localhost:11434/v1
export OPENAI_MODEL=qwen2.5-coder:7b
gakr
```

### Inside Gakr
- Type `/help` for command list
- Type `/provider` for guided setup
- Ask questions normally and let the agent handle tools

---

## Resources

- 📖 **README**: Quick start and provider setup
- 📘 **Advanced Setup**: Custom providers and configurations
- 🔐 **Security**: Digital signature verification and privacy guarantees
- 🐛 **Issues**: Report problems on GitHub

---

**Gakr v0.2.5** — Any model. Every tool. Zero limits.
- Bridge mode for remote execution
- Bootstrap state management
- Vim keybindings support
- Voice input (internal feature, disabled in open build)

---

## Tools Available

### File Tools
| Tool | Purpose |
|------|---------|
| `read_file` | Read file contents |
| `write_file` | Create or overwrite files |
| `edit_file` | Edit specific sections of files |
| `glob` | Find files matching patterns |

### System Tools
| Tool | Purpose |
|------|---------|
| `bash` | Execute shell commands |
| `grep` | Search file contents by pattern |

### Web Tools
| Tool | Purpose |
|------|---------|
| `WebSearch` | Search the web (DuckDuckGo or Firecrawl) |
| `WebFetch` | Fetch and parse web pages |

### Agent/Task Tools
| Tool | Purpose |
|------|---------|
| `Task` | Create and manage background tasks |
| `Agent` | Invoke sub-agents for specialized work |

### Model Context Protocol
| Feature | Purpose |
|---------|---------|
| `MCP` | Connect to external tools, services, and data sources |
| `Server` | Run MCP servers for custom integrations |

---

## Subagents/Agents

Subagents are specialized AI personalities invoked for specific tasks:

| Agent | Specialization |
|-------|-----------------|
| `Explore` | Fast codebase exploration and Q&A |
| `Plan` | Complex feature planning |
| `Architect` | System design and architecture |
| `TDD-Guide` | Test-driven development |
| `Code-Reviewer` | Code quality and security review |
| `Security-Reviewer` | Vulnerability detection |
| `Build-Error-Resolver` | Compilation and build errors |
| `Doc-Updater` | Documentation generation |

**Total Known Agents: 8+**

---

## Tools Count

### Built-in Tools
- **File Operations**: 4 (read, write, edit, glob)
- **System Tools**: 2 (bash, grep)
- **Web Tools**: 2 (search, fetch)
- **Agent/Task Tools**: 2+ (Task, Agent dispatch)
- **MCP Integration**: Dynamic (configurable servers)

**Total Core Tools: 10+**

Additional tools available via:
- MCP servers (unlimited)
- Custom provider integrations
- Language-specific tools (depends on model capabilities)

---

## Slash Commands

| Command | Purpose |
|---------|---------|
| `/help` | Show available commands |
| `/provider` | Interactive provider setup |
| `/onboard-github` | GitHub Models authentication |
| `/clear` | Clear session history |
| `/tasks` | List active tasks |
| `/agents` | Manage agent routing |
| `/settings` | View/modify configuration |
| `/attach` | Attach existing session |
| `/export` | Export conversation/results |

---

## Configuration

### Environment Variables
```bash
GAKR_CODE_USE_OPENAI=1                    # Use OpenAI-compatible provider
OPENAI_API_KEY="sk-..."                     # API key (if required)
OPENAI_BASE_URL="https://..."               # Custom endpoint
OPENAI_MODEL="model-name"                   # Model to use
FIRECRAWL_API_KEY="..."                     # Optional: Firecrawl for advanced web scraping
```

### Profile File
Location: `~/.gakr-profile.json`

Example:
```json
{
  "provider": "openai-compatible",
  "apiKey": "sk-...",
  "baseURL": "https://api.example.com/v1",
  "model": "model-name",
  "temperature": 0.7,
  "maxTokens": 8000
}
```

### Advanced Settings
Location: `~/.gakrcli/settings.json`

```json
{
  "agentModels": {
    "model-1": { "base_url": "...", "api_key": "..." },
    "model-2": { "base_url": "...", "api_key": "..." }
  },
  "agentRouting": {
    "Explore": "model-1",
    "Plan": "model-2",
    "default": "model-1"
  }
}
```

---

## Session Features

### Memory & Persistence
- **Session History**: Automatically saved per project
- **Cost Tracking**: Tokens/cost per session and cumulative
- **Project Context**: Extracted on startup
- **Bootstrap State**: Persistent project onboarding info

### Interactive Elements
- **REPL Mode**: Query-response loop
- **Streaming Output**: Real-time token display
- **Progress Indicators**: Visual feedback during tool execution
- **Error Handling**: Detailed error messages and recovery suggestions

---

## Architecture

```
gakr/
├── src/
│   ├── entrypoints/cli.tsx          # Main CLI entrypoint
│   ├── commands.ts                  # Command implementations
│   ├── tools.ts                     # Tool definitions
│   ├── Task.ts / tasks.ts           # Task management
│   ├── QueryEngine.ts               # Query processing
│   ├── cost-tracker.ts              # Cost tracking
│   ├── history.ts                   # Session history
│   ├── assistant/                   # Agent session management
│   ├── bridge/                      # Remote execution
│   ├── services/                    # Provider integrations
│   ├── tools/                       # Tool implementations
│   ├── commands/                    # Command implementations
│   ├── skills/                      # Skill definitions
│   ├── state/                       # State management
│   └── utils/                       # Utilities
├── scripts/
│   ├── build.ts                     # Build script
│   ├── provider-discovery.ts        # Auto-detect providers
│   ├── provider-launch.ts           # Launch provider
│   ├── system-check.ts              # Health check
│   └── verify-no-phone-home.ts      # Privacy verification
├── bin/
│   └── gakr                        # CLI wrapper
└── dist/
    └── cli.mjs                      # Compiled output
```

---

## Developer Commands

| Command | Purpose |
|---------|---------|
| `npm run build` | Build TypeScript to ESM |
| `npm run dev` | Build and run locally |
| `npm run typecheck` | Type checking |
| `npm run smoke` | Quick build + version check |
| `npm run verify:privacy` | Verify no telemetry |
| `npm run doctor:runtime` | System diagnostics |
| `npm run hardening:strict` | Full validation |

---

## Performance & Limits

### Token Handling
- Streaming support for low-latency interaction
- Adaptive output limits per provider
- Cost tracking to prevent overspend

### Concurrency
- Single-session execution (sequential tool calls)
- Task queue for background work
- Agent dispatch supports parallel subagent execution

### Storage
- Project directory: unlimited file access
- Session memory: persistent per project
- Cache: LRU cache for provider responses

---

## Security & Privacy

- ✅ **No Telemetry**: Verified with automated checks
- ✅ **No Phone-Home**: Stripped from Anthropic source
- ✅ **Local Option**: Full support for local Ollama/Atomic Chat
- ✅ **Credential Management**: Environment variables + profile storage
- ✅ **No Tracking**: No usage metrics or analytics

---

## Supported Models

### Excellent (Full tool calling)
- GPT-4, GPT-4o (OpenAI)
- gakrcli 3+ (Anthropic)
- gpt-oss-120b (Cloudflare)
- DeepSeek (with tool support)
- Gemini 2.0+

### Good (Partial tool support)
- Llama 2 70B+
- Mistral Large
- Groq's models
- LM Studio compatible

### Limited (No/poor tool calling)
- Small models <7B
- deepseek-r1:1.5b
- Base instruct models

---

## Getting Started

### Quick Start (OpenAI-Compatible)
```bash
export GAKR_CODE_USE_OPENAI=1
export OPENAI_API_KEY=sk-your-key
export OPENAI_MODEL=gpt-4o
gakr
```

### Quick Start (Local Ollama)
```bash
export GAKR_CODE_USE_OPENAI=1
export OPENAI_BASE_URL=http://localhost:11434/v1
export OPENAI_MODEL=qwen2.5-coder:7b
gakr
```

### Inside Gakr
- Type `/help` for command list
- Type `/provider` for guided setup
- Ask questions normally and let the agent handle tools

---

## Resources

- 📖 **README**: Quick start and provider setup
- 📘 **Advanced Setup**: Custom providers and configurations
- 🔐 **Security**: Digital signature verification and privacy guarantees
- 🐛 **Issues**: Report problems on GitHub

---

**Gakr v0.1.7** — Any model. Every tool. Zero limits.
