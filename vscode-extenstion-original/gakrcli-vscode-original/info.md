# GakrCLI Capabilities, Tools, And Agents

Current package version: `0.5.2`

GakrCLI is a terminal-first AI coding agent. It combines provider routing, file and shell tools, MCP integration, slash commands, skills, agents, session history, and cost tracking in one CLI.

## Main Capabilities

- Multi-provider LLM support through Anthropic, Codex, OpenAI-compatible APIs, Gemini, GitHub Models/Copilot, NVIDIA NIM, Mistral, Ollama, Atomic Chat, Bedrock, Vertex AI, and other configured routes.
- Tool-driven coding workflows: read, edit, and write files; search code; run shell commands; inspect diagnostics; fetch web content; use MCP tools and resources.
- Saved provider profiles through `/provider`, with startup profile handling under the GakrCLI config directory and legacy single-profile fallback support.
- Built-in slash commands for provider setup, model selection, MCP, plugins, skills, agents, config, cost, review, commit, and diagnostics.
- Bundled skills and agents loaded from `assets/` at runtime. These are intentionally excluded from repo-doc audits unless the task is specifically about skills or agents.
- Web landing page under `web/` and a VS Code companion extension under `vscode-extension/gakrcli-vscode/`.

## Important Commands

```bash
gakrcli                 # start interactive mode
gakrcli --version       # print installed version
gakrcli doctor          # runtime diagnostics
```

Inside the interactive CLI:

```text
/help          show commands
/provider      manage saved provider profiles
/model         switch model
/config        manage settings
/mcp           manage MCP servers
/plugin        manage plugins
/skills        browse skills
/agents        browse agents
/review        review current changes
/commit        create a git commit
/cost          show usage and cost
```

## Common Provider Environment

### OpenAI-Compatible

```bash
export GAKR_CODE_USE_OPENAI=1
export OPENAI_API_KEY=sk-your-key
export OPENAI_BASE_URL=https://api.openai.com/v1
export OPENAI_MODEL=gpt-4o
```

### Ollama

```bash
ollama pull llama3.2:3b
export GAKR_CODE_USE_OPENAI=1
export OPENAI_BASE_URL=http://localhost:11434/v1
export OPENAI_MODEL=llama3.2:3b
```

### Gemini

```bash
export GAKR_CODE_USE_GEMINI=1
export GEMINI_API_KEY=your-key
export GEMINI_MODEL=gemini-3-flash-preview
```

### NVIDIA NIM

```bash
export GAKR_CODE_USE_NVIDIA=1
export NVIDIA_API_KEY=nvapi-your-key
export NVIDIA_MODEL=nvidia/llama-3.1-nemotron-70b-instruct
```

## Source Development

```bash
bun install
bun run build
bun run dev
```

Useful validation:

```bash
bun run typecheck
bun test
bun run smoke
bun run doctor:runtime
bun run verify:privacy
```

## Repository Map

- `src/entrypoints/` - CLI, MCP, SDK, and initialization entrypoints.
- `src/commands/` - slash commands and local command handlers.
- `src/tools/` - built-in tool implementations.
- `src/integrations/` - provider, gateway, model, route, and generated integration metadata.
- `src/services/` - runtime services such as API clients, wiki, voice, and tool summaries.
- `src/components/` - Ink terminal UI components.
- `src/bridge/` - remote bridge and session transport support.
- `scripts/` - build, provider bootstrap/launch, diagnostics, privacy verification, and artifact generation.
- `python/` - experimental Python provider/router support and tests.
- `web/` - Vite/React landing page.
- `vscode-extension/gakrcli-vscode/` - VS Code companion extension.

## Security Notes

- Keep real provider keys out of Markdown, examples, tests, and screenshots.
- Store keys in environment variables, secure storage, or provider profiles created through `/provider`.
- Run `bun run verify:privacy` before release-oriented pushes.
