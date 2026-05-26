# GakrCLI

**Version 0.5.3** — Any model. Every tool. Zero limits.

GakrCLI is a terminal-first AI coding agent that brings powerful LLM workflows to your command line. Use OpenAI, Anthropic, Gemini, DeepSeek, Ollama, and 200+ other models while keeping one unified terminal workflow: prompts, tools, agents, MCP integration, slash commands, and streaming output.

The packaged command is `gakrcli`.

## What It Supports

### Provider Ecosystem

| Provider | Authentication | Key Features |
|----------|---------------|--------------|
| **Anthropic** | `ANTHROPIC_API_KEY` or `/login` inside GakrCLI | Native Claude models with full tool support |
| **OpenAI-compatible** | `OPENAI_API_KEY` | Works with OpenAI, OpenRouter, DeepSeek, Groq, Mistral, Together AI, Azure OpenAI, LM Studio, and any OpenAI-compatible local server |
| **Gemini** | `GEMINI_API_KEY` or `GOOGLE_API_KEY` | Google Gemini 2.0+ models with native integration |
| **GitHub Models** | `GITHUB_TOKEN` / `GH_TOKEN` | Free tier access via GitHub's model marketplace |
| **NVIDIA NIMs** | `NVIDIA_API_KEY` | Enterprise-grade models via NVIDIA's inference microservices |
| **DeepSeek** | `OPENAI_API_KEY` + `OPENAI_BASE_URL` | DeepSeek chat and reasoning models through the OpenAI-compatible route |
| **Ollama** | No API key | Local inference with complete privacy |
| **Atomic Chat** | No API key | Apple Silicon optimized local models |
| **Bedrock** | AWS credentials | Amazon Bedrock Claude models |
| **Vertex AI** | Google Cloud credentials | Claude on Google Cloud Platform |
| **Azure OpenAI** | Azure credentials | OpenAI models via Azure |

### Core Features

#### 🛠️ **Comprehensive Tool Suite**
- **File Operations**: Read, write, edit files with intelligent diff display
- **Shell Integration**: Execute bash/PowerShell commands with sandboxing
- **Search & Navigation**: Advanced grep, glob, and ripgrep integration
- **Web Capabilities**: Web search and fetch with content extraction
- **Code Analysis**: LSP integration for intelligent code understanding
- **Image Processing**: Image search, generation, and analysis
- **Task Management**: Background task execution and monitoring

#### 🤖 **Agent Workflows**
- **Multi-step Reasoning**: Autonomous tool execution loops
- **Specialized Agents**: 20+ built-in agents (architect, code-reviewer, security-reviewer, etc.)
- **Agent Routing**: Route different agents to different models for cost optimization
- **Team Coordination**: Multi-agent collaboration and task delegation

#### 🔌 **MCP Integration (Model Context Protocol)**
- **External Tools**: Connect to databases, APIs, and services
- **Resource Access**: Dynamic resource loading and management
- **Server Management**: Built-in MCP server discovery and configuration
- **Authentication**: OAuth and API key management for MCP servers

#### 📦 **Plugin System**
- **Built-in Plugins**: Extensible plugin architecture with 100+ bundled skills
- **Custom Plugins**: Create and share custom functionality
- **Skill Library**: Comprehensive skill library covering development, data science, DevOps, and more
- **Hot Reloading**: Dynamic plugin loading without restart

#### ⚙️ **Advanced Configuration**
- **Provider Profiles**: Guided saved provider profiles managed by `/provider`, plus legacy single-profile fallback support
- **Settings Management**: Hierarchical settings with user, project, and managed overrides
- **Environment Variables**: Flexible configuration via environment variables
- **Keybindings**: Vim and Emacs keybinding support

#### 🔒 **Security & Privacy**
- **Privacy-First**: No telemetry, no phone-home, verified privacy build
- **Sandboxing**: Secure command execution with configurable permissions
- **Permission System**: Granular tool permission management
- **Credential Management**: Secure storage of API keys and tokens

#### 💰 **Cost & Performance**
- **Token Tracking**: Real-time token usage and cost monitoring
- **Context Management**: Intelligent context window optimization
- **Streaming Output**: Real-time response display
- **Caching**: Intelligent caching for improved performance

## Install

### Global Install (Recommended)

```bash
npm install -g @gakr-gakr/gakrcli
```

Then run:

```bash
gakrcli
```

**Requirements:**
- Node.js 20 or newer
- ripgrep (`rg`) installed and in PATH

### Source Build (For Development)

```bash
git clone https://github.com/gajjalaashok75-UI/GakrCLI.git
cd gakrcli
bun install
bun run build
npm link  # Optional: makes gakrcli available globally
```

**Requirements:**
- Bun 1.3.11+ (for TypeScript build and development scripts)
- Node.js 20+ (for running the built CLI)
- TypeScript 6+ (dev dependency)

**Development Commands:**

```bash
bun run dev              # Build and run locally with hot reload
bun run smoke            # Quick build + version check
bun run doctor:runtime   # System diagnostics and provider validation
bun run verify:privacy   # Verify no telemetry/phone-home
bun run typecheck        # TypeScript type checking
bun test                 # Run test suite
```

### Troubleshooting

If `gakrcli` reports that `ripgrep` / `rg` is missing:
- **macOS**: `brew install ripgrep`
- **Ubuntu/Debian**: `sudo apt-get install ripgrep`
- **Windows**: `winget install ripgrep` or download from [ripgrep.org](https://ripgrep.org)
- Verify with: `rg --version`

After installing, restart your terminal.

## Quick Start

### Option 1: OpenAI (Fastest Cloud Setup)

**Get an API key** from [OpenAI Platform](https://platform.openai.com/api-keys).

macOS / Linux:
```bash
export GAKR_CODE_USE_OPENAI=1
export OPENAI_API_KEY=sk-your-key-here
export OPENAI_MODEL=gpt-4o  # or another model supported by your provider
gakrcli
```

Windows PowerShell:
```powershell
$env:GAKR_CODE_USE_OPENAI="1"
$env:OPENAI_API_KEY="sk-your-key-here"
$env:OPENAI_MODEL="gpt-4o"
gakrcli
```

### Option 2: Ollama (Local, No API Key)

1. [Install Ollama](https://ollama.com/download) and pull a model:

```bash
ollama pull llama3.2:3b  # or qwen2.5-coder:7b, codellama:7b, etc.
```

2. Set environment variables:

macOS / Linux:
```bash
export GAKR_CODE_USE_OPENAI=1
export OPENAI_BASE_URL=http://localhost:11434/v1
export OPENAI_MODEL=llama3.2:3b
gakrcli
```

Windows PowerShell:
```powershell
$env:GAKR_CODE_USE_OPENAI="1"
$env:OPENAI_BASE_URL="http://localhost:11434/v1"
$env:OPENAI_MODEL="llama3.2:3b"
gakrcli
```

### Option 3: Anthropic (Claude)

**Get an API key** from [Anthropic Console](https://console.anthropic.com/).

```bash
export ANTHROPIC_API_KEY=sk-ant-your-key-here
export ANTHROPIC_MODEL=claude-sonnet-4-6
gakrcli
```

Or use the guided login inside GakrCLI:
```bash
/login
```

### Option 4: DeepSeek (Cost-Effective)

**Get an API key** from [DeepSeek Platform](https://platform.deepseek.com/).

```bash
export GAKR_CODE_USE_OPENAI=1
export OPENAI_API_KEY=sk-your-deepseek-key
export OPENAI_BASE_URL=https://api.deepseek.com/v1
export OPENAI_MODEL=deepseek-chat  # or deepseek-reasoner
gakrcli
```

### Option 5: Other Providers

For Gemini, GitHub Models, NVIDIA NIMs, Azure OpenAI, and more, see:
- **[Advanced Setup Guide](docs/advanced-setup.md)** — Complete provider configuration
- **[Provider Configuration Reference](docs/advanced-setup.md#provider-examples)** — All supported backends

## Usage

### Basic Interaction

Once launched:
- **Start coding**: Type your request naturally (e.g., "Refactor this function to be more readable")
- **Slash commands**: Type `/help` to see all available commands
- **Provider setup**: `/provider` for guided configuration
- **Settings**: `/config` (alias `/settings`) to view or modify configuration
- **Clear history**: `/clear` to start fresh

### Key Slash Commands

| Command | Description |
|---------|-------------|
| `/help` | Show all available commands |
| `/provider` | Configure provider settings |
| `/config` | View and modify settings (also available as `/settings`) |
| `/skills` | Browse available skills |
| `/agents` | List available agents |
| `/mcp` | Manage MCP servers |
| `/plugin` | Manage plugins |
| `/tasks` | View background tasks |
| `/cost` | Show token usage and costs |
| `/clear` | Clear conversation history |

### Agent Routing

GakrCLI can route different agents to different models for cost optimization:

Add to `~/.gakrcli/settings.json`:
```json
{
  "agentModels": {
    "deepseek-chat": {
      "base_url": "https://api.deepseek.com/v1",
      "api_key": "sk-your-key"
    },
    "gpt-4o": {
      "base_url": "https://api.openai.com/v1",
      "api_key": "sk-your-key"
    }
  },
  "agentRouting": {
    "code-reviewer": "deepseek-chat",
    "architect": "gpt-4o",
    "security-reviewer": "gpt-4o",
    "default": "deepseek-chat"
  }
}
```

### Project-Level Configuration

Prefer `/provider` for guided profile creation. The legacy single-profile JSON format is still supported as `.gakrcli-profile.json`:

```json
{
  "provider": "openai-compatible",
  "apiKey": "sk-...",
  "baseURL": "https://api.openai.com/v1",
  "model": "gpt-4o",
  "temperature": 0.7,
  "maxTokens": 8000,
  "skills": ["typescript-expert", "react-atlas"],
  "agents": ["code-reviewer", "security-reviewer"]
}
```

Open provider management interactively:
```bash
/provider
```

## Available Tools

GakrCLI includes 30+ built-in tools:

### File Operations
- **FileReadTool**: Read files with syntax highlighting
- **FileWriteTool**: Create new files
- **FileEditTool**: Edit existing files with intelligent diffs
- **GlobTool**: Find files using glob patterns
- **GrepTool**: Search file contents with regex

### Shell & System
- **BashTool**: Execute bash commands (Linux/macOS)
- **PowerShellTool**: Execute PowerShell commands (Windows)
- **MonitorTool**: Monitor system resources
- **SleepTool**: Add delays in workflows

### Web & Search
- **WebSearchTool**: Search the web with DuckDuckGo
- **WebFetchTool**: Fetch and extract web page content
- **ImageSearchTool**: Search for images
- **VideoSearchTool**: Search for videos

### Development
- **LSPTool**: Language Server Protocol integration
- **AgentTool**: Delegate tasks to specialized agents
- **TaskCreateTool**: Create background tasks
- **SkillTool**: Execute specialized skills

### MCP Integration
- **MCPTool**: Execute MCP server tools
- **ListMcpResourcesTool**: List available MCP resources
- **ReadMcpResourceTool**: Read MCP resource content
- **McpAuthTool**: Authenticate with MCP servers

## Available Skills

GakrCLI includes 100+ specialized skills organized by domain:

### Development
- **typescript-expert**: Advanced TypeScript patterns and best practices
- **react-atlas**: Comprehensive React development
- **python-atlas**: Python development and data science
- **rust-pro**: Modern Rust development
- **nodejs-backend-patterns**: Node.js backend architecture

### DevOps & Infrastructure
- **docker-expert**: Container optimization and deployment
- **git-advanced-workflows**: Advanced Git operations
- **cloudflare-workers-expert**: Edge computing with Cloudflare
- **vercel-deployment**: Deployment automation

### AI & Data Science
- **ai-engineer**: LLM application development
- **data-scientist**: Advanced analytics and ML
- **vector-database-engineer**: Vector search and RAG
- **langchain-architecture**: LangChain development
- **pytorch-patterns**: Deep learning with PyTorch

### Security & Testing
- **security-review**: Security analysis and hardening
- **ethical-hacking-methodology**: Penetration testing
- **tdd-workflow**: Test-driven development
- **e2e-testing**: End-to-end testing with Playwright

### Content & Design
- **article-writing**: Technical writing and documentation
- **image-generation**: AI image creation
- **video-generation**: AI video creation
- **chart-visualization**: Data visualization

## Available Agents

GakrCLI includes 20+ specialized agents:

### Architecture & Planning
- **architect**: System design and technical decisions
- **planner**: Task breakdown and project planning
- **codebase-auditor**: Comprehensive code analysis

### Code Quality
- **code-reviewer**: Code review and quality assessment
- **security-reviewer**: Security analysis and recommendations
- **performance-optimizer**: Performance analysis and optimization
- **refactor-cleaner**: Code refactoring and cleanup

### Language Specialists
- **typescript-reviewer**: TypeScript-specific code review
- **python-reviewer**: Python code analysis
- **rust-reviewer**: Rust code review
- **java-reviewer**: Java code analysis
- **kotlin-reviewer**: Kotlin code review

### Infrastructure
- **devops-engineer**: CI/CD and infrastructure
- **database-reviewer**: Database design and optimization
- **ml-engineer**: Machine learning workflows

### Testing & Documentation
- **tdd-guide**: Test-driven development guidance
- **e2e-runner**: End-to-end test execution
- **doc-updater**: Documentation maintenance

## MCP Integration

GakrCLI has first-class support for the Model Context Protocol (MCP):

### Built-in MCP Servers
- **File System**: Access local files and directories
- **Git**: Git repository operations
- **Database**: SQL database connections
- **Web**: HTTP requests and web scraping
- **Cloud**: AWS, GCP, Azure integrations

### MCP Configuration

Add MCP servers to your settings:

```json
{
  "mcpServers": {
    "filesystem": {
      "command": "npx",
      "args": ["@modelcontextprotocol/server-filesystem", "/path/to/allowed/files"]
    },
    "git": {
      "command": "npx",
      "args": ["@modelcontextprotocol/server-git", "--repository", "."]
    },
    "postgres": {
      "command": "npx",
      "args": ["@modelcontextprotocol/server-postgres"],
      "env": {
        "POSTGRES_CONNECTION_STRING": "postgresql://user:pass@localhost/db"
      }
    }
  }
}
```

### MCP Commands

```bash
gakrcli mcp list              # List configured MCP servers
gakrcli mcp add <name> <cmd>  # Add a server
gakrcli mcp doctor [name]     # Diagnose MCP issues
```

## Architecture Overview

GakrCLI is built with a modular, layered architecture:

### High-Level Structure

```
gakrcli/
├── src/
│   ├── entrypoints/     # CLI entry points
│   ├── tools/           # Tool implementations (30+ tools)
│   ├── skills/          # Skill definitions (100+ skills)
│   ├── agents/          # Agent definitions (20+ agents)
│   ├── services/        # Provider integrations and services
│   ├── plugins/         # Plugin system infrastructure
│   ├── integrations/    # Provider and model integrations
│   ├── utils/           # Utility functions and helpers
│   └── components/      # React UI components (Ink-based)
├── assets/              # Bundled assets (skills, agents, rules)
├── docs/                # Documentation
└── dist/                # Built output
```

### Key Technologies

- **React (Ink)**: Terminal UI framework
- **TypeScript**: Type safety and developer experience
- **Bun**: Build system and package management
- **Commander**: CLI argument parsing
- **MCP SDK**: Model Context Protocol integration
- **Anthropic SDK**: Native Claude integration
- **OpenAI SDK**: OpenAI and compatible providers

## Diagnostics & Validation

Useful diagnostic commands:

```bash
gakrcli doctor                    # Comprehensive system check
gakrcli doctor --json            # JSON output for automation
bun run doctor:runtime           # Runtime diagnostics
bun run verify:privacy           # Privacy verification
bun run smoke                    # Quick smoke test
```

The doctor command validates:
- Node.js version and dependencies
- Provider configuration and connectivity
- Tool availability (ripgrep, git, etc.)
- MCP server status
- Plugin system health

## VS Code Extension

GakrCLI includes a VS Code extension with:
- **Control Center**: Activity view for GakrCLI management
- **Project Awareness**: Automatic workspace detection
- **Profile Management**: Workspace profile status and quick access
- **Terminal Integration**: Seamless terminal launching
- **Theme Support**: Built-in "GakrCLI Terminal Black" theme

## Documentation

### Beginner Guides
- [Non-Technical Setup](docs/non-technical-setup.md)
- [Windows Quick Start](docs/quick-start-windows.md)
- [macOS / Linux Quick Start](docs/quick-start-mac-linux.md)

### Advanced Guides
- [Advanced Setup](docs/advanced-setup.md) — Comprehensive provider configuration
- [Self-Improvement Architecture](docs/self-improvement-architecture.md) — How GakrCLI learns
- [Android Install](ANDROID_INSTALL.md) — Run on Android (Termux)
- [Local Agent Playbook](PLAYBOOK.md) — Daily usage reference

### Integration Guides
- [MCP Integration](docs/integrations/overview.md) — Model Context Protocol setup
- [Plugin Development](docs/integrations/how-to/) — Creating custom plugins
- [API Reference](docs/integrations/reference-samples.md) — SDK and API documentation

## Security & Contributing

- [SECURITY.md](SECURITY.md) — Security policy and reporting
- [CONTRIBUTING.md](CONTRIBUTING.md) — Contribution guidelines
- [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md) — Community standards

## License

See [LICENSE](LICENSE).

## Project Note

GakrCLI is an independent community project and is not affiliated with or endorsed by Anthropic, OpenAI, or any other AI provider.
