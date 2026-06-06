<div align="center">

<img src="assets/gakrcli-logo.png" alt="GakrCLI" width="400" height="400">

# GakrCLI

**Version 0.5.6**

Any model. Every tool. One terminal-first coding agent.

</div>

GakrCLI is an AI coding agent for the command line and for embedded hosts such as the GakrCLI VS Code extension. It can inspect a workspace, edit files, run shell commands with permissions, manage multi-turn sessions, use MCP tools, route work to specialized agents, and stream results from many model providers.

The published npm package is `@gakr-gakr/gakrcli`. The executable command is `gakrcli`.

## Install

```bash
npm install -g @gakr-gakr/gakrcli@0.5.6
gakrcli
```

Requirements:

- Node.js 20 or newer.
- `rg` / ripgrep in `PATH` for best search performance.
- A configured provider, unless you use a local provider such as Ollama, LM Studio, or Atomic Chat.

Install ripgrep:

```bash
# macOS
brew install ripgrep

# Windows
winget install BurntSushi.ripgrep.MSVC

# Ubuntu/Debian
sudo apt-get install ripgrep
```

## Quick Start

Launch GakrCLI and run the provider wizard:

```bash
gakrcli
```

Then type:

```text
/provider
```

You can also configure providers with environment variables.

### OpenAI

```bash
export GAKR_CODE_USE_OPENAI=1
export OPENAI_API_KEY=sk-your-key
export OPENAI_MODEL=gpt-4o
gakrcli
```

PowerShell:

```powershell
$env:GAKR_CODE_USE_OPENAI="1"
$env:OPENAI_API_KEY="sk-your-key"
$env:OPENAI_MODEL="gpt-4o"
gakrcli
```

### Anthropic Claude

```bash
export ANTHROPIC_API_KEY=sk-ant-your-key
export ANTHROPIC_MODEL=claude-sonnet-4-6
gakrcli
```

You can also use `/login` inside GakrCLI when the hosted auth flow is available.

### Google Gemini

```bash
export GAKR_CODE_USE_GEMINI=1
export GEMINI_API_KEY=AIza-your-key
export GEMINI_MODEL=gemini-2.0-flash
gakrcli
```

### Ollama

```bash
ollama pull llama3.2:3b
export GAKR_CODE_USE_OPENAI=1
export OPENAI_BASE_URL=http://localhost:11434/v1
export OPENAI_MODEL=llama3.2:3b
gakrcli
```

### DeepSeek

```bash
export GAKR_CODE_USE_OPENAI=1
export OPENAI_API_KEY=sk-your-deepseek-key
export OPENAI_BASE_URL=https://api.deepseek.com/v1
export OPENAI_MODEL=deepseek-chat
gakrcli
```

## Provider List

GakrCLI 0.5.6 supports native providers, OpenAI-compatible vendors, gateways, and local runtimes. Use `/provider` for guided setup or set the documented environment variables manually.

- Anthropic Claude: `ANTHROPIC_API_KEY`, optional `ANTHROPIC_MODEL`.
- OpenAI: `GAKR_CODE_USE_OPENAI=1`, `OPENAI_API_KEY`, optional `OPENAI_MODEL`.
- Google Gemini: `GAKR_CODE_USE_GEMINI=1`, `GEMINI_API_KEY`, optional `GEMINI_MODEL`.
- DeepSeek: `DEEPSEEK_API_KEY` or OpenAI-compatible env with `OPENAI_BASE_URL=https://api.deepseek.com/v1`.
- Bankr: `BNKR_API_KEY`.
- Moonshot AI: `MOONSHOT_API_KEY`.
- Moonshot Kimi Code: `KIMI_API_KEY`.
- MiniMax: `MINIMAX_API_KEY`.
- Mistral AI: `GAKR_CODE_USE_MISTRAL=1`, `MISTRAL_API_KEY`, optional `MISTRAL_MODEL`.
- NVIDIA NIM: `GAKR_CODE_USE_NVIDIA=1`, `NVIDIA_API_KEY`, optional `NVIDIA_MODEL`.
- xAI: `XAI_API_KEY` or xAI OAuth profile support where configured.
- Xiaomi MiMo: `MIMO_API_KEY`.
- Z.AI: OpenAI-compatible env, usually `OPENAI_API_KEY` plus the Z.AI base URL.
- Azure OpenAI: `AZURE_OPENAI_API_KEY` plus an Azure OpenAI base URL/deployment.
- Alibaba DashScope China and International: `DASHSCOPE_API_KEY`.
- GitHub Copilot / GitHub Models: `GAKR_CODE_USE_GITHUB=1`, `GITHUB_TOKEN` or `GH_TOKEN`.
- Groq: `GROQ_API_KEY`.
- Hicap: `HICAP_API_KEY`.
- OpenRouter: `OPENROUTER_API_KEY`.
- Together AI: `TOGETHER_API_KEY`.
- Venice: `VENICE_API_KEY`.
- AWS Bedrock: `GAKR_CODE_USE_BEDROCK=1` with normal AWS credentials.
- Google Vertex AI: `GAKR_CODE_USE_VERTEX=1` with normal Google ADC credentials.
- Ollama: local OpenAI-compatible endpoint at `http://localhost:11434/v1`.
- LM Studio: local OpenAI-compatible endpoint at `http://localhost:1234/v1`.
- Atomic Chat: local OpenAI-compatible endpoint at `http://127.0.0.1:1337/v1`.
- Custom OpenAI-compatible: `GAKR_CODE_USE_OPENAI=1`, `OPENAI_BASE_URL`, optional `OPENAI_API_KEY`, `OPENAI_MODEL`.

See [docs/PROVIDERS.md](docs/PROVIDERS.md) and [docs/advanced-setup.md](docs/advanced-setup.md) for full examples.

## Core Features

- Workspace-aware chat that can read, write, edit, search, run commands, and summarize results.
- Multi-provider routing with saved profiles, slash-command switching, and local model support.
- Permission modes for default operation, planning, accepting edits, bypassing checks, and denying prompts.
- Shell execution with sandbox integration, command result annotation, and Windows/PowerShell compatibility fixes.
- Compact tool-call transcript rendering in the VS Code webview.
- Hidden reasoning display controls that show only a live thinking indicator while reasoning is active.
- Live context usage and autocompact state through the SDK runtime control surface.
- Markdown rendering for lists, tables, code blocks, inline code, links, and generated summaries.
- MCP support for stdio, HTTP, SSE, and SDK-defined tools.
- Session persistence, resume, fork, tag, rename, and delete helpers.
- Privacy-oriented builds with `verify:privacy` and no telemetry bundle leakage.
- SDK export at `@gakr-gakr/gakrcli/sdk` for IDEs and custom hosts.

## Available Tools

GakrCLI exposes tool families rather than forcing every provider to implement its own tool contract.

| Tool family | What it does |
| --- | --- |
| File read/write/edit | Read files, create files, apply precise replacements, and produce compact edit results. |
| Search and navigation | Use glob, grep, ripgrep, repository scans, and symbol-aware context helpers. |
| Shell | Run Bash, PowerShell, npm, bun, git, test, and build commands through the permission/sandbox layer. |
| Task and planning | Track todos, plans, multi-step work, and long-running task status. |
| Web and fetch | Fetch web pages or search when enabled by provider/runtime policy. |
| MCP | Call external MCP tools and read MCP resources exposed by configured servers. |
| IDE/SDK tools | Surface diagnostics, file mentions, editor selections, diffs, and VS Code permission prompts. |
| Agent tools | Delegate work to specialized agents and collect their findings back into the conversation. |

## Agents

Bundled agents live under `assets/agents` and can be routed to different models for cost, speed, or quality.

- `architect`: system design, architecture tradeoffs, and integration plans.
- `backend-specialist`: APIs, services, databases, and server-side implementation.
- `frontend-specialist`: React, UI behavior, accessibility, and visual polish.
- `code-reviewer`: bug/risk review with file and line focused findings.
- `security-reviewer`: security, privacy, dependency, and secret-leak review.
- `build-error-resolver`: failing build/test diagnosis and repair.
- `performance-optimizer`: performance bottlenecks and runtime improvements.
- `planner`: multi-step implementation planning.
- `doc-updater`: README, changelog, release notes, and documentation cleanup.
- `test-engineer`: focused and broad test strategy.

Use `/agents` to browse the local catalog and configure routing.

## Skills

Bundled skills live under `assets/skills` and provide repeatable workflows for common engineering tasks. They help agents apply consistent steps without re-explaining the process every time.

Useful skill areas include:

- App and frontend building.
- Architecture and system design.
- Bash and shell workflow.
- Bug hunting and debugging.
- Deep research and documentation updates.
- Docker, DevOps, and deployment support.
- Testing, release checks, and package publishing.
- Code review, security review, and performance cleanup.

Use `/skills` to browse installed skills and `/plugins` for plugin-managed additions.

## Common Commands

Inside GakrCLI:

| Command | Purpose |
| --- | --- |
| `/help` | Show commands and usage help. |
| `/provider` | Create, update, and switch provider profiles. |
| `/model` | Switch the active model. |
| `/config` or `/settings` | View or edit settings. |
| `/agents` | Browse specialized agents. |
| `/skills` | Browse bundled and installed skills. |
| `/mcp` | Manage MCP servers. |
| `/plugins` | Manage plugins. |
| `/resume` | Resume a previous session. |
| `/compact` | Compact conversation context. |
| `/cost` | Show usage/cost information when available. |
| `/clear` | Start a clean conversation. |

## SDK

The SDK lets IDEs and custom hosts run GakrCLI without scraping terminal output. The VS Code extension uses this path for native chat, live context usage, autocompact status, compact tool rows, permissions, and session state.

Import the SDK subpath:

```ts
import { query, unstable_v2_createSession } from '@gakr-gakr/gakrcli/sdk'

const q = query({
  prompt: 'Review this project and summarize the risks.',
  options: { cwd: process.cwd() },
})

for await (const message of q) {
  console.log(message.type)
}
```

Current SDK-facing improvements in 0.5.6:

- Stable context usage snapshots for active, new, and resumed sessions.
- Autocompact status events for compacting and compacted transcript markers.
- Tool-call input and output fragments that can be rendered compactly by hosts.
- Improved edit matching for whitespace-heavy files.
- Shell sandbox failure annotation that does not break Bash tool rendering.
- Assistant turn helpers that keep thinking blocks hidden while preserving activity state.

Read [docs/GAKRCLI_SDK.md](docs/GAKRCLI_SDK.md) for the full SDK guide.

## VS Code Extension

The GakrCLI VS Code extension is published separately as `gakrcli-vscode` version `0.2.4`.

It uses the GakrCLI SDK runtime for the native webview flow and falls back to terminal mode when requested. See [vscode-extension/gakrcli-vscode/README.md](vscode-extension/gakrcli-vscode/README.md), [vscode-extension/gakrcli-vscode/docs/USER_GUIDE.md](vscode-extension/gakrcli-vscode/docs/USER_GUIDE.md), and [vscode-extension/gakrcli-vscode/docs/ARCHITECTURE.md](vscode-extension/gakrcli-vscode/docs/ARCHITECTURE.md).

## Development

```bash
git clone https://github.com/gajjalaashok75-UI/GakrCLI.git
cd GakrCLI
bun install
bun run build
bun test
```

Useful checks:

```bash
bun run build
bun run smoke
bun run verify:privacy
bun run doctor:runtime
bun run integrations:check
npm pack --dry-run
```

The TypeScript typecheck is useful during development, but this repository currently has known broader typecheck debt outside the publication smoke path.

## Publish Notes

The npm package is guarded by both the `files` allow-list in `package.json` and `.npmignore`. The publishable package should include:

- `bin/gakrcli.js`
- `dist/cli.mjs`
- `dist/sdk.mjs`
- bundled `assets/`, including the README logo, agents, skills, and rules
- SDK type declarations
- `README.md`
- `LICENSE`

It should not include `.env`, `.gakrcli`, `.vscode`, source tests, workspace transcripts, VSIX files, node_modules, or local build caches.

Publish order for this release:

1. Build and dry-pack root `@gakr-gakr/gakrcli@0.5.6`.
2. Publish the root npm package.
3. Refresh the VS Code extension lockfile against the published `@gakr-gakr/gakrcli@0.5.6`.
4. Build and package `gakrcli-vscode@0.2.4` as a VSIX.

## Documentation

- [Documentation index](docs/README.md)
- [Provider reference](docs/PROVIDERS.md)
- [Advanced setup](docs/advanced-setup.md)
- [Windows quick start](docs/quick-start-windows.md)
- [macOS/Linux quick start](docs/quick-start-mac-linux.md)
- [Non-technical setup](docs/non-technical-setup.md)
- [SDK guide](docs/GAKRCLI_SDK.md)
- [Integration architecture](docs/integrations/overview.md)
- [Project structure](docs/architecture/project-structure.md)
- [System flow diagrams](docs/SYSTEM_FLOW_DIAGRAMS.md)
- [Complete system architecture](docs/architecture/COMPLETE_SYSTEM_ARCHITECTURE.md)
- [VS Code extension reference](vscode-extension/gakrcli-vscode/docs/REFERENCE.md)

## License

See [LICENSE](LICENSE).
