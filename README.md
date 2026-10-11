<div align="center">

# GakrCLI

**Version 0.6.1**

Any model. Every tool. One terminal-first coding agent.

</div>

## What is GakrCLI

GakrCLI is an AI coding agent that runs in your terminal. Point it at a workspace and it reads files, edits them, runs shell commands with your permission, searches code, drives a browser, and streams answers from whichever model you choose. The same engine runs headless for embedded hosts like the GakrCLI VS Code extension.

It is not tied to one vendor. You install one CLI, bring your own API key or local model, and switch between them whenever you want. The npm package is `@gakr-gakr/gakrcli` and the command is `gakrcli`.

## Main features

- **Any model**: OpenAI-compatible APIs, Gemini, GitHub Models, Codex, Ollama, Atomic Chat, Bedrock, Vertex, and many more routes.
- **Full coding tools**: bash, file read/write/edit, grep, glob, sub-agents, tasks, MCP servers, and web tools.
- **Built-in browser**: a Playwright Chromium the agent can navigate, click, and type in, with screenshots and PDF export.
- **Streaming output**: tokens and tool progress show up as they happen.
- **Memory**: durable project memory with a full-text index and per-session rolling summaries.
- **Repo map**: a git-aware, PageRank-ranked map of tracked files, so context respects `.gitignore`.
- **Vision input**: URL and base64 images on vision-capable models.
- **Flexible model picker**: `/model` merges every configured provider's catalog and lets you type in an unlisted model.
- **Background sessions**: kick off a long task and keep working, then check logs or stop it later.
- **Headless gRPC**: drive the engine from other apps and CI over a stream.
- **VS Code extension**: chat panel, native diff viewer, `@`-mentions, and session history in the editor.

## Why use it

- One agent across cloud APIs and local backends, so moving from OpenAI to Ollama does not mean learning a second tool.
- Providers and models are managed inside the app with `/provider` and `/model`, so profiles persist instead of living in copy-pasted shell scripts.
- The whole coding loop is in one place: tools, sub-agents, MCP servers, permissions, and sessions.
- The same engine runs in the terminal, as a headless gRPC service, or inside the VS Code extension.

## Quick start

### Install from npm

```bash
npm install -g @gakr-gakr/gakrcli@latest
gakrcli
```

Requires Node.js 22 or newer.

### Install from the repo

```bash
git clone https://github.com/gajjalaashok75-UI/GakrCLI.git
cd GakrCLI
bun install
bun run build
node dist/cli.mjs
```

To get the `gakrcli` command from a local checkout, run `npm link` in the repo root after building.

### Start and connect a model

Run `gakrcli` inside your project. On first run, `/provider` walks you through a provider and stores a profile you can reuse.

Fastest OpenAI setup on macOS / Linux:

```bash
export GAKR_CODE_USE_OPENAI=1
export OPENAI_API_KEY=sk-your-key
export OPENAI_MODEL=gpt-4o
gakrcli
```

Windows PowerShell:

```powershell
$env:GAKR_CODE_USE_OPENAI="1"
$env:OPENAI_API_KEY="sk-your-key"
$env:OPENAI_MODEL="gpt-4o"
gakrcli
```

Fastest local setup with Ollama:

```bash
export GAKR_CODE_USE_OPENAI=1
export OPENAI_BASE_URL=http://localhost:11434/v1
export OPENAI_MODEL=qwen2.5-coder:7b
gakrcli
```

### One-shot prompts

You do not have to open the interactive session. Pass a prompt directly:

```bash
gakrcli "hello are you there"
gakrcli -p "summarize this repo" > summary.txt
```

A bare prompt opens the session already seeded with it. With `-p` (or `--print`), GakrCLI answers once and exits, which is what you want in scripts and pipes. Add `--output-format json` or `stream-json` when another program reads the output.

More guides:

- [Non-technical setup](docs/non-technical-setup.md)
- [Windows quick start](docs/quick-start-windows.md)
- [macOS / Linux quick start](docs/quick-start-mac-linux.md)
- [Advanced setup and source builds](docs/advanced-setup.md)

## How to use it

Start `gakrcli` in your project folder and type a request in plain language. The agent decides which tools to call. Anything sensitive, like writing files or running shell commands, asks for permission first.

```
explain what this repo does
add tests for the parser in src/parser.ts
find every place we call the old auth API
commit these changes
```

Commands worth knowing inside the app:

| Command | What it does |
| --- | --- |
| `/provider` | Guided provider setup and saved profiles |
| `/model` | Pick or type a model; press `r` to refresh discovery |
| `/help` | List every slash command |
| `/compact` | Shrink the conversation context |
| `/resume` | Reopen a past session |
| `/daemon` | Manage background sessions and the daemon |

Permission modes control how much the agent can do without asking: Default, Accept Edits, Plan, Bypass, and Full Access.

## Tools, skills, and slash commands

Three building blocks do most of the work:

- **Tools** are what the agent acts with: bash, file read/write/edit, grep, glob, web search and fetch, the browser, MCP servers, and sub-agents. The model chooses them, and you approve the risky ones.
- **Slash commands** are how you steer. Type `/` or `/help` in the REPL for the full list. Along with the session commands above, there are commands for agents (`/agents`), skills (`/skills`), memory (`/memory`), MCP (`/mcp`), plugins (`/plugin`), settings (`/config`), cost (`/cost`, `/usage`), and diagnostics (`/doctor`, `/status`).
- **Skills** are small instruction packs for a recurring task. List them with `/skills` and run one by name, for example `/verify`, `/simplify`, or `/remember`. Use `/skill-search` to find community skills and `/skill-learning` to turn a session into a new one.

## Sub-agents

A sub-agent is a separate agent the main one spawns for a focused job, then reports back. It keeps your main context small and lets work run in parallel.

- Built-in agents cover common jobs: `Explore` for searching a codebase, `Plan` for outlining an approach, `general-purpose` for multi-step work, and a read-only `verification` agent that audits a change before it is called done.
- Each sub-agent gets its own context and transcript, so a long search does not crowd your session.
- They can run in the background, and can work in a git worktree so parallel edits do not collide.
- Point different agents at different models to control cost. See the agent routing section below.
- Configure which agents exist with `/agents`.

## Memory

GakrCLI remembers useful things across sessions so you do not repeat yourself.

- Project memory lives in `memory/**` with a `MEMORY.md` index, and a SQLite full-text index (`memory.db`) makes it searchable by relevance.
- Each session also keeps a rolling summary, and both are searched to surface context for a new prompt.
- Extraction and consolidation run in the background after turns, so memory improves without you managing it.
- Edit or review it with `/memory`, and force a fresh summary with `/summary`.

## Providers and models

GakrCLI ships with a long list of provider presets and manages them the same way everywhere. Configure one with `/provider` or with environment variables.

Supported options include OpenAI-compatible servers (OpenAI, OpenRouter, DeepSeek, Groq, Mistral, LM Studio, and others), Gemini, GitHub Models, Codex and Codex OAuth, Ollama, Atomic Chat, Fireworks AI, xAI, Xiaomi MiMo, NEAR AI, Bedrock, Vertex, and more. The full list with credentials and endpoints is in [docs/PROVIDERS.md](docs/PROVIDERS.md).

Switch models with `/model`. The picker de-duplicates the merged catalog, shows the discovery status line, and ends with an `Enter model name…` row so you can use a model the catalog does not know. For those custom or self-hosted models, you can declare per-token prices in settings so cost and budget checks stay accurate.

### Route agents to different models

You can send specific agents to specific models, which is useful for cutting cost or splitting work by model strength. Add this to `~/.gakrcli.json`:

```json
{
  "agentModels": {
    "mini": { "model": "gpt-5-mini" }
  },
  "agentRouting": {
    "verification": "mini",
    "Plan": "gpt-4o"
  }
}
```

`agentRouting` keys match entries in `agentModels`. Omit `base_url` and `api_key` to reuse the current provider's endpoint and key with a different model. When nothing matches, the global provider stays the fallback. Built-in agents such as `verification`, `Explore`, and `Plan` are routable by name, so `"agentRouting": { "verification": "mini" }` runs the read-only verifier on a cheaper model while the main session keeps its own.

> **Note:** `api_key` values in settings are stored in plaintext. Keep that file private and out of version control.

### Provider caveats

- Anthropic-specific features may not exist on other providers.
- Tool quality depends on the model. Smaller local models struggle with long multi-step tool flows.
- Some providers cap output lower than the CLI defaults; GakrCLI adapts where it can.
- When `GAKR_CODE_USE_GITHUB=1`, GakrCLI serializes sub-agent execution by default to limit Copilot Premium Request usage. Tuning is done through the `GITHUB_COPILOT_*` variables, documented in `.env.example`.

## Built-in browser

GakrCLI ships a browser tool that drives a real Chromium session through Playwright. The agent can navigate, click, type, fill forms, scroll to text, take screenshots, save a page as PDF, and read console and network logs. It runs headless by default. Set `webBrowser.headless` to `false` in settings to watch a real window, which needs a display server.

While the browser is active, a live panel shows the current page and a `browser (<host>)` pill appears in the REPL footer. Recordings are saved under `.agent_tmp/browser_observations`. Each action has a 300 second timeout that drops to 30 seconds on the last retry before the session resets.

For automating your own Chrome, see [docs/gakrcli-in-chrome](docs/gakrcli-in-chrome).

## Background sessions and daemon

Long tasks do not have to block your terminal. Start a session in the background, follow its logs, and stop it when you are done:

```bash
gakrcli --bg --name "fix-tests" "run the test suite and fix the failures"
gakrcli logs fix-tests -f
gakrcli kill fix-tests
```

Inside the REPL, `/daemon` manages the same thing with `status`, `start`, `stop`, `bg`, `attach`, `logs`, and `kill` subcommands.

## Web search and fetch

On non-Anthropic models, `WebSearch` uses DuckDuckGo by default, so GPT-4o, DeepSeek, Gemini, and Ollama get free web search out of the box. DuckDuckGo works by scraping, so it can be rate-limited or blocked.

For something more reliable, set a Firecrawl key:

```bash
export FIRECRAWL_API_KEY=your-key
```

With Firecrawl enabled, `WebSearch` uses its search API and `WebFetch` uses its scrape endpoint, which handles JavaScript-rendered pages correctly. The free tier includes 500 credits, and the key is optional.

## Headless gRPC server

You can run GakrCLI as a headless gRPC service and drive it from other apps, CI pipelines, or your own UI. Real-time text, tool calls, and permission prompts stream over a bidirectional connection.

```bash
npm run dev:grpc      # start on localhost:50051
npm run dev:grpc:cli  # test client, in a second terminal
```

| Variable | Default | Description |
| --- | --- | --- |
| `GRPC_PORT` | `50051` | Port to listen on |
| `GRPC_HOST` | `localhost` | Bind address; `0.0.0.0` exposes all interfaces |

The proto file lives at `src/proto/gakrcli.proto`, so you can generate a client in Python, Go, Rust, or any other language. See [docs/grpc-server.md](docs/grpc-server.md).

## VS Code extension

The repo includes an extension in [`vscode-extension/gakrcli-vscode`](vscode-extension/gakrcli-vscode) that turns the CLI into an editor experience: a streaming chat panel, a native diff viewer with Accept/Reject, `@`-mentions, session history, git worktree sessions, and a provider-aware control center. It also supports Microsoft Foundry / Azure OpenAI configuration through VS Code Secret Storage.

The extension is a UI wrapper. Providers, tools, MCP, and slash commands all live in the CLI, so upgrading the brain is just `gakrcli@latest` with no extension reinstall. See the [extension README](vscode-extension/gakrcli-vscode/README.md).

## Build and test

```bash
bun install
bun run build
node dist/cli.mjs
```

Handy scripts: `bun run dev`, `bun test`, `bun run test:coverage`, `bun run smoke`, `bun run doctor:runtime`, `bun run verify:privacy`, and `bun run benchmark:startup`.

## Repository layout

- `src/` - core CLI and runtime
- `scripts/` - build, verification, and maintenance
- `docs/` - setup, architecture, and contributor docs
- `vscode-extension/gakrcli-vscode/` - VS Code extension
- `python/` - standalone Python helpers and tests
- `bin/` - CLI launcher entrypoints

## Community and contributing

- [GitHub Discussions](https://github.com/gajjalaashok75-UI/gakrcli/discussions) for Q&A and ideas
- [GitHub Issues](https://github.com/gajjalaashok75-UI/gakrcli/issues) for bugs and feature requests
- [SECURITY.md](SECURITY.md) to report a security issue

Contributions are welcome. For larger changes, open an issue first so the scope is clear. Before a PR, run `bun run build`, `bun run smoke`, and focused `bun test ...` runs for what you touched.

## Debug mode

When a local install or a source build misbehaves, start with the health checks:

```bash
gakrcli doctor          # check auto-updater health
bun run doctor:runtime  # full runtime check from a source checkout
```

Then turn on debug logging:

```bash
gakrcli --debug                    # debug to the console
gakrcli --debug "api,hooks"        # filter by category
gakrcli --debug-to-stderr          # keep stdout clean for pipes
gakrcli --debug-file ./debug.log   # write to a specific file
gakrcli --verbose                  # more detail from config
```

Logs go to `~/.gakrcli/debug/<sessionId>.txt` (or `$GAKR_CONFIG_DIR/debug/`), with a `latest` symlink pointing at the current one. Inside the REPL, `/doctor` runs the same runtime check.

## License

MIT. See [LICENSE](LICENSE).
