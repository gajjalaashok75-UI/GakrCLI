# Gakr

**Version 0.2.8** — Any model. Every tool. Zero limits.

Gakr is a terminal-first coding-agent CLI that brings the powerful workflow to multiple LLM providers - Use OpenAI-compatible APIs, Gemini, GitHub Models, Codex OAuth, Codex, Ollama, Atomic Chat, and other supported backends while keeping one terminal-first workflow: prompts, tools, agents, MCP, slash commands, and streaming output.

The packaged command is `gakrcli`.

## What It Supports

### Provider Ecosystem

| Provider | Authentication | Key Features |
|----------|---------------|--------------|
| **Anthropic** | `ANTHROPIC_API_KEY` or `gakrcli auth login` | Native Claude models with full tool support |
| **OpenAI-compatible** | `OPENAI_API_KEY` | Works with OpenAI, OpenRouter, DeepSeek, Groq, Mistral, Together AI, Azure OpenAI, LM Studio, and any OpenAI-compatible local server |
| **Gemini** | `GEMINI_API_KEY` or `GOOGLE_API_KEY` | Google Gemini 2.0+ models |
| **GitHub Models** | `GITHUB_TOKEN` / `GH_TOKEN` | Free tier via GitHub's model marketplace |
| **NVIDIA NIMs** | `NVIDIA_API_KEY` | Enterprise-grade models via NIM endpoint |
| **Codex** | `CODEX_API_KEY` or `~/.codex/auth.json` | ChatGPT Codex backend with reasoning |
| **Ollama** | No API key | Local inference, full privacy |
| **Atomic Chat** | No API key | Apple Silicon local models |
| **Bedrock** | AWS credentials | Amazon Bedrock Claude models |
| **Vertex AI** | Google Cloud credentials | Claude on Google Cloud |
| **Foundry** | Anyscale credentials | Anthropic on Anyscale |

### Core Features

- **Tool Calling**: Read, write, edit files; execute bash commands; search with grep/glob; web search and fetch
- **Agent Workflows**: Autonomous multi-step reasoning with tool execution loops
- **MCP Integration**: Connect to external tools, data sources, and services via Model Context Protocol
- **Provider Profiles**: Saved configurations with `.gakr-profile.json` for project-specific settings
- **Streaming Output**: Real-time token display for responsive interaction
- **Cost Tracking**: Token usage and cost monitoring per session
- **Project Onboarding**: Automatic context extraction and history persistence
- **VS Code Extension**: Integrated Control Center and workspace awareness
- **Privacy-First**: No telemetry, no phone-home, verified privacy build

## Install

### Global Install (Recommended for Users)

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
git clone https://github.com/gakr-gakr/gakr.git
cd gakr
bun install
bun run build
npm link  # Optional: makes gakrcli available globally
```

**Requirements:**
- Bun 1.3.11+ (for TypeScript build and development scripts)
- Node.js 20+ (for running the built CLI)
- TypeScript 6+ (dev dependency)

**Helpful Commands:**

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

Set your provider configuration using environment variables, then run `gakrcli`. Choose your provider:

### Option 1: OpenAI (Quickest Cloud Setup)

**Get an API key** from [OpenAI Platform](https://platform.openai.com/api-keys).

Then set these variables:

macOS / Linux:

```bash
export GAKR_CODE_USE_OPENAI=1
export OPENAI_API_KEY=sk-your-key-here
export OPENAI_MODEL=gpt-4o  # or gpt-4.1, o3-mini, etc.
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
export ANTHROPIC_MODEL=claude-sonnet-4-5-20251014  # or claude-3-7-sonnet
gakrcli
```

Or use the guided login:

```bash
gakrcli auth login
```

### Option 4: Other Providers

For Gemini, GitHub Models, NVIDIA NIMs, Codex, DeepSeek, LM Studio, and more, see:

- **[Advanced Setup Guide](docs/advanced-setup.md)** — Full provider examples and configuration
- **[Provider Configuration Reference](docs/advanced-setup.md#provider-examples)** — All supported backends

---

## Inside Gakr

Once launched:

- **Start coding**: Just type your request naturally (e.g., "Refactor this function to be more readable")
- **Slash commands**: Type `/help` to see all commands
- **Provider setup**: `/provider` for guided saved-profile setup
- **GitHub Models**: `/onboard-github` for secure token onboarding
- **Settings**: `/settings` to view/modify configuration
- **Clear history**: `/clear` to start fresh

Gakr will automatically use tools (file operations, bash, grep, etc.) to accomplish your tasks. You'll see streaming output as it works.

---

## Project-Level Configuration

For project-specific settings, create `.gakr-profile.json` in your project root. This is automatically loaded when you start Gakr in that directory.

Example profile:

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

Initialize a profile interactively:

```bash
bun run profile:init
```

or

```bash
gakrcli /provider
```

## Provider Setup Paths

| Provider | Main setup paths | Notes |
| --- | --- | --- |
| Anthropic | `gakrcli auth login` or `ANTHROPIC_API_KEY` | Default mode when no third-party provider flag is enabled |
| OpenAI-compatible | env vars, `--provider openai`, `/provider`, `bun run profile:init -- --provider openai` | Works with OpenAI, OpenRouter, DeepSeek, Groq, Mistral, Together AI, Azure OpenAI, LM Studio, and compatible local `/v1` servers |
| Gemini | env vars, `--provider gemini`, `/provider`, `bun run profile:init -- --provider gemini` | Uses `GEMINI_API_KEY` or `GOOGLE_API_KEY` |
| GitHub Models | `--provider github`, `/onboard-github`, `GITHUB_TOKEN` / `GH_TOKEN` | Runtime default model falls back to `github:copilot -> openai/gpt-4.1` when `OPENAI_MODEL` is unset |
| NVIDIA NIMs | env vars, `/provider`, `bun run profile:init -- --provider nvidia` | Uses dedicated `NVIDIA_*` env vars and defaults to `https://integrate.api.nvidia.com/v1` |
| Codex | env vars, `/provider`, `bun run profile:init -- --provider codex`, `bun run dev:codex` | Reads `~/.codex/auth.json` by default or uses `CODEX_API_KEY` plus `CHATGPT_ACCOUNT_ID` / `CODEX_ACCOUNT_ID` |
| Ollama | env vars, `--provider ollama`, `/provider`, `bun run profile:init -- --provider ollama` | Local provider, no API key required |
| Atomic Chat | env vars, `bun run profile:init -- --provider atomic-chat`, `bun run dev:atomic-chat` | Uses local `http://127.0.0.1:1337/v1`; Atomic Chat must be running with a model loaded |
| Bedrock / Vertex / Foundry | env vars | Supported through the runtime provider layer |

Notes:

- The direct CLI `--provider` flag currently supports `anthropic`, `openai`, `gemini`, `github`, `bedrock`, `vertex`, and `ollama`.
- Saved provider profiles are stored in `.gakr-profile.json` in the current working directory and are loaded automatically on startup unless explicit provider env flags override them.
- `profile:recommend` and `profile:auto` currently choose between Ollama and OpenAI-compatible profiles based on availability and goal.

## Provider Profiles And Helpers

One-time profile bootstrap:

```bash
bun run profile:init
```

Examples:

```bash
bun run profile:init -- --provider openai --api-key sk-your-key --model gpt-4o
bun run profile:init -- --provider ollama --model qwen2.5-coder:7b
bun run profile:init -- --provider gemini --api-key your-key --model gemini-2.0-flash
bun run profile:init -- --provider nvidia --api-key nvapi-your-key
bun run profile:init -- --provider codex --model codexplan
bun run profile:init -- --provider atomic-chat
```

Recommendation helpers:

```bash
bun run profile:recommend -- --goal coding --benchmark
bun run profile:auto -- --goal latency
```

Launch through saved or explicit profiles:

```bash
bun run dev:profile
bun run dev:openai
bun run dev:gemini
bun run dev:ollama
bun run dev:codex
bun run dev:atomic-chat
```

`dev:profile`, `dev:openai`, `dev:gemini`, `dev:ollama`, `dev:codex`, and `dev:atomic-chat` run the runtime doctor before launching.

## Architecture Overview

Gakr is built with a modular, layered architecture emphasizing separation of concerns, testability, and extensibility.

### High-Level Structure

```
gakr/
├── src/
│   ├── entrypoints/     # CLI entrypoint (main.tsx)
│   ├── cli/             # CLI transport, I/O, update handler
│   ├── commands/        # Slash commands (/help, /provider, etc.)
│   ├── tools/           # Tool implementations (read_file, bash, grep, etc.)
│   ├── services/        # Provider integrations (OpenAI, Anthropic, etc.)
│   ├── assistant/       # Agent session management
│   ├── bridge/          # Remote execution (codespaces, web)
│   ├── query/           # QueryEngine — orchestrates LLM calls
│   ├── context/         # Context management and compression
│   ├── state/           # Global state (app state, settings)
│   ├── hooks/           # React hooks (if using Ink/React)
│   ├── components/      # React UI components
│   ├── screens/         # Full-screen UI views
│   ├── skills/          # Skill definitions (auto-improvement, etc.)
│   ├── types/           # TypeScript type definitions
│   ├── utils/           # Utility functions
│   ├── constants/       # Constants and configuration
│   ├── migrations/      # Database migrations (if any)
│   ├── plugins/         # Plugin system infrastructure
│   ├── keybindings/     # Vim/Emacs keybinding support
│   ├── outputStyles/    # Terminal styling and markup
│   ├── proactive/       # Proactive hints and suggestions
│   ├── moreright/       # Right-side panel UI (buddy, etc.)
│   ├── inks/            # Ink-based UI components
│   ├── upstreamproxy/   # Proxy for API requests
│   ├── voice/           # Voice input (disabled in open build)
│   ├── native-ts/       # Native module bindings
│   └── memdir/          # Memory directory abstraction
├── scripts/             # Build, provider, and maintenance scripts
├── bin/                 # CLI wrapper (gakrcli)
├── dist/                # Built output (cli.mjs)
├── vscode-extension/    # VS Code extension
├── docs/                # Documentation (user guides)
├── assets/              # Bundled assets (skills, rules, agents)
└── graphify/            # Auto-generated codebase knowledge graph
```

The project uses **React** (Ink) for terminal UI, **TypeScript** for type safety, **Bun** for build scripts, and **Commander** for CLI argument parsing. The provider layer uses a unified runtime that selects among multiple backends (OpenAI, Anthropic, etc.) via environment flags.

### Key Modules

- `src/entrypoints/main.tsx` — App startup, React renderer
- `src/commands.ts` — Slash command implementations
- `src/tools.ts` — Tool definitions and invocation
- `src/query.ts` — Query processing, tool loop
- `src/QueryEngine.ts` — LLM interaction, tool calling
- `src/AssistantSessionChooser.tsx` — Agent session management
- `src/context.ts` — Context window management
- `src/cost-tracker.ts` — Token tracking and cost estimation
- `src/history.ts` — Conversation persistence
- `src/services/api/` — Provider-specific API clients
- `src/bridge/` — Remote execution (VS Code, codespaces)
- `src/mcp/` — Model Context Protocol integration

The **graphify/** folder (auto-generated) contains a knowledge graph of the codebase with 11,805 nodes and 21,694 edges across 634 functional communities. It's a tool for navigating and understanding the code structure.

## Web Search And Fetch

`WebSearch` behavior depends on the active provider and model:

- Anthropic-native, Vertex, and Foundry backends keep native provider web search behavior.
- Codex responses mode uses the Codex `web_search` tool through the `/responses` API.
- On non-native providers with non-gakrcli models, Gakr falls back to DuckDuckGo scraping by default.

If `FIRECRAWL_API_KEY` is set, Gakr can use Firecrawl for non-native search/fetch flows:

```bash
export FIRECRAWL_API_KEY=your-key-here
```

`WebFetch` behavior:

- With Firecrawl enabled, it uses Firecrawl scrape-to-markdown.
- Without Firecrawl, it uses HTTP fetch plus HTML-to-Markdown conversion.
- Authenticated pages and JavaScript-heavy apps are still unreliable without a specialized MCP tool or Firecrawl.

## Diagnostics And Validation

Useful commands:

```bash
bun run smoke
bun run doctor:runtime
bun run doctor:runtime:json
bun run doctor:report
bun run hardening:check
bun run hardening:strict
```

`doctor:runtime` validates:

- Node version and build artifacts
- provider env configuration
- remote provider reachability
- Codex auth requirements
- local Ollama mode checks when applicable

## CLI Notes

Useful entry points exposed by the current CLI include:

- `gakrcli --help`
- `gakrcli auth`
- `gakrcli doctor`
- `gakrcli mcp`
- `gakrcli plugin`
- `gakrcli update`

Repo-local startup also loads a repo-root `.env` file before launching when one exists. That is convenient for source builds, but shell or system environment variables remain the portable setup path for global installs.

## VS Code Extension

This repo also includes a VS Code extension in [`vscode-extension/gakr-vscode`](vscode-extension/gakr-vscode) with:

- a Control Center activity view
- project-aware launch behavior
- workspace profile visibility for `.gakr-profile.json`
- a built-in `Gakr Terminal Black` theme

## Documentation

Beginner-friendly guides:

- [Non-Technical Setup](docs/non-technical-setup.md)
- [Windows Quick Start](docs/quick-start-windows.md)
- [macOS / Linux Quick Start](docs/quick-start-mac-linux.md)

Advanced and conceptual guides:

- [Advanced Setup](docs/advanced-setup.md) — Comprehensive provider configuration
- [Self-Improvement Architecture](docs/self-improvement-architecture.md) — How Gakr learns and optimizes
- [Android Install](ANDROID_INSTALL.md) — Run on Android (Termux)
- [Local Agent Playbook](PLAYBOOK.md) — Quick reference for daily use

## Security And Contributing

- [SECURITY.md](SECURITY.md)
- [CONTRIBUTING.md](CONTRIBUTING.md)

## Project Note

Gakr is an independent community project and is not affiliated with, endorsed by, or sponsored by Anthropic.

## License

See [LICENSE](LICENSE).
