# GakrCLI Advanced Setup (v0.5.1)

This guide is for users who want source builds, Bun workflows, provider profiles, diagnostics, or more control over runtime behavior.

## Install Options

### Option A: npm (Recommended)

```bash
npm install -g @gakr-gakr/gakrcli
```

### Option B: From source with Bun

Use Bun `1.3.11` or newer for source builds on Windows. Older Bun versions can fail during `bun run build`.

```bash
git clone https://github.com/gajjalaashok75-UI/GakrCLI.git
cd gakrcli

bun install
bun run build
npm link
```

### Option C: Run directly with Bun

```bash
git clone https://github.com/gajjalaashok75-UI/GakrCLI.git
cd gakrcli

bun install
bun run dev
```

## Provider Examples

### OpenAI

```bash
export GAKR_CODE_USE_OPENAI=1
export OPENAI_API_KEY=sk-...
export OPENAI_MODEL=gpt-4o  # or another model supported by your provider
```

### DeepSeek

```bash
export GAKR_CODE_USE_OPENAI=1
export OPENAI_API_KEY=sk-...
export OPENAI_BASE_URL=https://api.deepseek.com/v1
export OPENAI_MODEL=deepseek-chat
```

Use `deepseek-reasoner` when you want DeepSeek's reasoning model.

### NVIDIA NIMs

```bash
export GAKR_CODE_USE_NVIDIA=1
export NVIDIA_API_KEY=nvapi-...
export NVIDIA_MODEL=nvidia/llama-3.1-nemotron-70b-instruct  # default
# optional: NVIDIA_BASE_URL (default: https://integrate.api.nvidia.com/v1)
```

### Google Gemini (Direct)

```bash
export GAKR_CODE_USE_GEMINI=1
export GEMINI_API_KEY=...
export GEMINI_MODEL=gemini-3-flash-preview  # default; use another Gemini model if needed
# optional: GEMINI_BASE_URL (default: https://generativelanguage.googleapis.com/v1beta/openai)
```

### GitHub Models (models.github.ai)

```bash
export GAKR_CODE_USE_GITHUB=1
export GITHUB_TOKEN=ghp_...  # or GH_TOKEN
export OPENAI_MODEL=openai/gpt-4.1  # or github:copilot, meta-llama/Llama-3.3-70B-Instruct-Turbo
```

### Anthropic (Claude)

```bash
export ANTHROPIC_API_KEY=sk-ant-...
export ANTHROPIC_MODEL=claude-sonnet-4-6
```

Or use the guided login:

```bash
/login
```

### Ollama (Local)

```bash
# First install and start Ollama
ollama pull llama3.2:3b  # or qwen2.5-coder:7b, codellama:7b

export GAKR_CODE_USE_OPENAI=1
export OPENAI_BASE_URL=http://localhost:11434/v1
export OPENAI_MODEL=llama3.2:3b
```

### Atomic Chat (Apple Silicon)

```bash
# Ensure Atomic Chat is running with a model loaded
export GAKR_CODE_USE_OPENAI=1
export OPENAI_BASE_URL=http://127.0.0.1:1337/v1
export OPENAI_MODEL=<model-loaded-in-atomic-chat>
```

### Azure OpenAI

```bash
export GAKR_CODE_USE_OPENAI=1
export OPENAI_API_KEY=your-azure-key
export OPENAI_BASE_URL=https://your-resource.openai.azure.com/openai/deployments/your-deployment
export OPENAI_MODEL=gpt-4o
```

### AWS Bedrock

```bash
export GAKR_CODE_USE_BEDROCK=1
export AWS_ACCESS_KEY_ID=...
export AWS_SECRET_ACCESS_KEY=...
export AWS_REGION=us-east-1
export ANTHROPIC_MODEL=claude-sonnet-4-6
```

### Google Vertex AI

```bash
export GAKR_CODE_USE_VERTEX=1
export GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json
export ANTHROPIC_MODEL=claude-sonnet-4-6
```

## Advanced Configuration

### Project Profiles

Create `.gakrcli-profile.json` in your project root:

```json
{
  "provider": "openai-compatible",
  "apiKey": "sk-...",
  "baseURL": "https://api.openai.com/v1",
  "model": "gpt-4o",
  "temperature": 0.7,
  "maxTokens": 8000,
  "skills": ["typescript-expert", "react-atlas"],
  "agents": ["code-reviewer", "security-reviewer"],
  "mcpServers": {
    "filesystem": {
      "command": "npx",
      "args": ["@modelcontextprotocol/server-filesystem", "."]
    }
  }
}
```

### Global Settings

Configure global settings in `~/.gakrcli/settings.json`:

```json
{
  "defaultModel": "gpt-4o",
  "temperature": 0.7,
  "maxTokens": 8000,
  "enabledPlugins": {
    "typescript-expert@builtin": true,
    "security-review@builtin": true
  },
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

### MCP Server Configuration

Configure MCP servers in your settings:

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
    },
    "web": {
      "command": "npx",
      "args": ["@modelcontextprotocol/server-web"]
    }
  }
}
```

### Custom Authentication Headers

For providers requiring non-standard authentication:

```bash
export GAKR_CODE_USE_OPENAI=1
export OPENAI_BASE_URL=https://api.custom-provider.com/v1
export OPENAI_AUTH_HEADER=X-API-Key
export OPENAI_AUTH_SCHEME=raw
export OPENAI_AUTH_HEADER_VALUE=your-custom-key
export OPENAI_MODEL=custom-model
```

### API Format Selection

Switch between Chat Completions and Responses API formats:

```bash
export OPENAI_API_FORMAT=responses  # or chat_completions (default)
```

## Development Commands

### Build and Test

```bash
bun run build              # Build the CLI
bun run dev                # Build and run with hot reload
bun run smoke              # Quick build + version check
bun run typecheck          # TypeScript type checking
bun test                   # Run test suite
bun run test:coverage      # Run tests with coverage
```

### Diagnostics

```bash
bun run doctor:runtime     # System diagnostics
bun run doctor:runtime:json # JSON output for automation
bun run doctor:report      # Save report to file
bun run verify:privacy     # Verify no telemetry
```

### Quality Checks

```bash
bun run hardening:check    # Build + runtime checks
bun run hardening:strict   # Typecheck + hardening
```

## Environment Variables Reference

### Provider Selection

| Variable | Description | Example |
|----------|-------------|---------|
| `GAKR_CODE_USE_OPENAI` | Enable OpenAI-compatible providers | `1` |
| `GAKR_CODE_USE_ANTHROPIC` | Enable Anthropic (default if no other provider) | `1` |
| `GAKR_CODE_USE_GEMINI` | Enable Google Gemini | `1` |
| `GAKR_CODE_USE_GITHUB` | Enable GitHub Models | `1` |
| `GAKR_CODE_USE_NVIDIA` | Enable NVIDIA NIMs | `1` |
| `GAKR_CODE_USE_BEDROCK` | Enable AWS Bedrock | `1` |
| `GAKR_CODE_USE_VERTEX` | Enable Google Vertex AI | `1` |

### OpenAI-Compatible Configuration

| Variable | Description | Example |
|----------|-------------|---------|
| `OPENAI_API_KEY` | API key for OpenAI-compatible providers | `sk-...` |
| `OPENAI_BASE_URL` | Base URL for API requests | `https://api.openai.com/v1` |
| `OPENAI_MODEL` | Model to use | `gpt-4o` |
| `OPENAI_API_FORMAT` | API format (chat_completions or responses) | `chat_completions` |
| `OPENAI_AUTH_HEADER` | Custom auth header name | `X-API-Key` |
| `OPENAI_AUTH_SCHEME` | Auth scheme (bearer or raw) | `bearer` |
| `OPENAI_AUTH_HEADER_VALUE` | Custom auth header value | `your-key` |

### Anthropic Configuration

| Variable | Description | Example |
|----------|-------------|---------|
| `ANTHROPIC_API_KEY` | Anthropic API key | `sk-ant-...` |
| `ANTHROPIC_MODEL` | Claude model to use | `claude-sonnet-4-6` |

### Other Provider Configuration

| Variable | Description | Example |
|----------|-------------|---------|
| `GEMINI_API_KEY` | Google Gemini API key | `AI...` |
| `GEMINI_MODEL` | Gemini model to use | `gemini-3-flash-preview` |
| `NVIDIA_API_KEY` | NVIDIA API key | `nvapi-...` |
| `NVIDIA_MODEL` | NVIDIA model to use | `nvidia/llama-3.1-nemotron-70b-instruct` |
| `GITHUB_TOKEN` | GitHub token for GitHub Models | `ghp_...` |

### Feature Flags

| Variable | Description | Example |
|----------|-------------|---------|
| `WEB_SEARCH_PROVIDER` | Web search provider | `tavily`, `ddg`, `auto` |
| `FIRECRAWL_API_KEY` | Firecrawl API key for web scraping | `fc-...` |
| `GAKR_CODE_SIMPLE` | Enable simple/bare mode | `1` |
| `GAKR_CODE_DEBUG` | Enable debug mode | `1` |

## Troubleshooting

### Common Issues

**"Command not found: gakrcli"**
- Install globally: `npm install -g @gakr-gakr/gakrcli`
- Check PATH if using source build

**"ripgrep (rg) not found"**
- macOS: `brew install ripgrep`
- Ubuntu/Debian: `sudo apt-get install ripgrep`
- Windows: `winget install ripgrep`

**"Connection refused" (Ollama)**
- Start Ollama: `ollama serve`
- Pull model: `ollama pull llama3.2:3b`

**"Invalid API key"**
- Verify API key is correct and active
- Check environment variable name matches provider

**Windows Input Prompt Hang**
- Update to GakrCLI 0.5.1 or later
- Ensure all dependencies are installed

### Debug Mode

Enable debug mode for troubleshooting:

```bash
export GAKR_CODE_DEBUG=1
gakrcli
```

### Health Checks

Run comprehensive health checks:

```bash
gakrcli doctor
gakrcli doctor --json  # For automation
```

## Performance Optimization

### Local Models

- Use appropriate model size for your hardware
- Ensure sufficient RAM (8GB+ for 3B models, 16GB+ for 7B models)
- Use SSD storage for better model loading
- Close memory-intensive applications

### Cloud Models

- Choose faster models for interactive work
- Use cheaper models for batch processing
- Monitor token usage with `/cost` command
- Set appropriate context limits

### Network Optimization

- Use CDN-backed providers when available
- Configure appropriate timeouts
- Use connection pooling for high-volume usage

## Security Considerations

### API Key Management

- Store API keys in environment variables, not code
- Use different keys for different environments
- Rotate keys regularly
- Monitor API key usage

### MCP Security

- Review MCP servers before installation
- Use principle of least privilege for MCP server access
- Monitor MCP server activity
- Keep MCP servers updated

### Sandboxing

- Use built-in sandboxing features
- Configure appropriate permission levels
- Monitor file system access
- Review shell command execution

## Integration Examples

### CI/CD Integration

```yaml
# GitHub Actions example
- name: Run GakrCLI Analysis
  env:
    GAKR_CODE_USE_OPENAI: 1
    OPENAI_API_KEY: ${{ secrets.OPENAI_API_KEY }}
    OPENAI_MODEL: gpt-4o
  run: |
    npm install -g @gakr-gakr/gakrcli
    gakrcli "Analyze this codebase for security issues and generate a report"
```

### Docker Integration

```dockerfile
FROM node:20-alpine

RUN npm install -g @gakr-gakr/gakrcli
RUN apk add --no-cache ripgrep

ENV GAKR_CODE_USE_OPENAI=1
ENV OPENAI_MODEL=gpt-4o

WORKDIR /app
COPY . .

CMD ["gakrcli"]
```

### VS Code Integration

The GakrCLI VS Code extension provides:
- Control Center activity view
- Project-aware launch behavior
- Workspace profile visibility
- Built-in terminal theme

Install from the VS Code marketplace or build from source in `vscode-extension/`.

## Support

- **Issues**: [GitHub Issues](https://github.com/gajjalaashok75-UI/GakrCLI/issues)
- **Discussions**: [GitHub Discussions](https://github.com/gajjalaashok75-UI/GakrCLI/discussions)
- **Documentation**: [docs/](../)

### AWS Bedrock

```bash
export GAKR_CODE_USE_BEDROCK=1
export AWS_REGION=us-east-1  # or your preferred region
export ANTHROPIC_MODEL=claude-opus-4  # or claude-sonnet-4.5, claude-haiku-4.5
# Uses AWS credentials from ~/.aws/credentials or environment variables (AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY)
```

### Google Vertex AI

```bash
export GAKR_CODE_USE_VERTEX=1
export ANTHROPIC_VERTEX_PROJECT_ID=your-project-id
export CLOUD_ML_REGION=us-central1  # optional, default varies
export ANTHROPIC_MODEL=claude-opus-4  # or claude-sonnet-4.5, claude-haiku-4.5
# Uses Google Cloud credentials from gcloud auth or GOOGLE_APPLICATION_CREDENTIALS
```

### Azure Foundry

```bash
export GAKR_CODE_USE_FOUNDRY=1
export ANTHROPIC_FOUNDRY_RESOURCE=your-resource-name
# OR: ANTHROPIC_FOUNDRY_BASE_URL=https://your-resource.services.ai.azure.com
export ANTHROPIC_FOUNDRY_API_KEY=...  # or use Azure AD auth
export ANTHROPIC_MODEL=claude-opus-4  # or claude-sonnet-4.5, claude-haiku-4.5
```

### Google Gemini via OpenRouter

```bash
export GAKR_CODE_USE_OPENAI=1
export OPENAI_API_KEY=sk-or-...
export OPENAI_BASE_URL=https://openrouter.ai/api/v1
export OPENAI_MODEL=google/gemini-2.5-flash
```

OpenRouter model availability changes over time. If a model stops working, choose another current Gemini model from OpenRouter before assuming the integration is broken.

### Ollama

```bash
ollama pull llama3.2:3b  # or llama3.2:7b, qwen2.5-coder:7b, codellama:7b

export GAKR_CODE_USE_OPENAI=1
export OPENAI_BASE_URL=http://localhost:11434/v1
export OPENAI_MODEL=llama3.2:3b
```

### Atomic Chat (local, Apple Silicon)

```bash
export GAKR_CODE_USE_OPENAI=1
export OPENAI_BASE_URL=http://127.0.0.1:1337/v1
export OPENAI_MODEL=your-model-name
```

No API key is needed for Atomic Chat local models.

Or use the profile launcher:

```bash
bun run dev:atomic-chat
```

Download Atomic Chat from [atomic.chat](https://atomic.chat/). The app must be running with a model loaded before launching.

### LM Studio

```bash
export GAKR_CODE_USE_OPENAI=1
export OPENAI_BASE_URL=http://localhost:1234/v1
export OPENAI_MODEL=your-model-name
```

### Together AI

```bash
export GAKR_CODE_USE_OPENAI=1
export OPENAI_API_KEY=...
export OPENAI_BASE_URL=https://api.together.xyz/v1
export OPENAI_MODEL=meta-llama/Llama-3.3-70B-Instruct-Turbo
```

### Groq

```bash
export GAKR_CODE_USE_OPENAI=1
export OPENAI_API_KEY=gsk_...
export OPENAI_BASE_URL=https://api.groq.com/openai/v1
export OPENAI_MODEL=llama-3.3-70b-versatile
```

### Mistral

```bash
export GAKR_CODE_USE_OPENAI=1
export OPENAI_API_KEY=...
export OPENAI_BASE_URL=https://api.mistral.ai/v1
export OPENAI_MODEL=mistral-large-latest
```

### Azure OpenAI

```bash
export GAKR_CODE_USE_OPENAI=1
export OPENAI_API_KEY=your-azure-key
export OPENAI_BASE_URL=https://your-resource.openai.azure.com/openai/deployments/your-deployment/v1
export OPENAI_MODEL=gpt-4o
```

## Environment Variables

### OpenAI-Compatible Providers

| Variable | Required | Description |
|----------|----------|-------------|
| `GAKR_CODE_USE_OPENAI` | Yes | Set to `1` to enable OpenAI-compatible providers (OpenAI, DeepSeek, Together AI, Groq, Mistral, Azure, LM Studio, etc.) |
| `OPENAI_API_KEY` | Yes* | Your API key (`*` not needed for local models like Ollama or Atomic Chat) |
| `OPENAI_MODEL` | Yes | Model name such as `gpt-4o`, `deepseek-chat`, or `llama3.3:70b` |
| `OPENAI_BASE_URL` | No | API endpoint, defaults to `https://api.openai.com/v1` |

### Specialized Providers

| Variable | Required | Description |
|----------|----------|-------------|
| `GAKR_CODE_USE_GEMINI` | Gemini only | Set to `1` to enable Google Gemini |
| `GEMINI_API_KEY` | Gemini only | Your Google AI API key |
| `GEMINI_MODEL` | No | Gemini model (default: `gemini-3-flash-preview`) |
| `GEMINI_BASE_URL` | No | Gemini API base URL (default: Google's endpoint) |
| `GAKR_CODE_USE_NVIDIA` | NVIDIA only | Set to `1` to enable NVIDIA NIMs |
| `NVIDIA_API_KEY` | NVIDIA only | Your NVIDIA API key (`nvapi-...`) |
| `NVIDIA_MODEL` | No | NVIDIA model (default: `nvidia/llama-3.1-nemotron-70b-instruct`) |
| `NVIDIA_BASE_URL` | No | NVIDIA API base URL (default: `https://integrate.api.nvidia.com/v1`) |
| `GAKR_CODE_USE_GITHUB` | GitHub only | Set to `1` to enable GitHub Models |
| `GITHUB_TOKEN` or `GH_TOKEN` | GitHub only | GitHub Personal Access Token with models access |
| `GAKR_CODE_USE_BEDROCK` | Bedrock only | Set to `1` to enable AWS Bedrock |
| `AWS_REGION` or `AWS_DEFAULT_REGION` | Bedrock optional | AWS region (default: `us-east-1`) |
| `ANTHROPIC_MODEL` | Bedrock/Vertex/Foundry | Model name for Anthropic models on 3P providers |
| `GAKR_CODE_USE_VERTEX` | Vertex only | Set to `1` to enable Google Vertex AI |
| `ANTHROPIC_VERTEX_PROJECT_ID` | Vertex required | Your GCP project ID |
| `CLOUD_ML_REGION` | Vertex optional | Default GCP region |
| `GAKR_CODE_USE_FOUNDRY` | Foundry only | Set to `1` to enable Azure Foundry |
| `ANTHROPIC_FOUNDRY_RESOURCE` | Foundry or `ANTHROPIC_FOUNDRY_BASE_URL` | Azure resource name or full base URL |
| `ANTHROPIC_FOUNDRY_API_KEY` | Foundry optional | API key, or use Azure AD authentication |

### Codex

| Variable | Required | Description |
|----------|----------|-------------|
| `CODEX_API_KEY` | Codex only | Codex or ChatGPT access token override |
| `CODEX_AUTH_JSON_PATH` | Codex only | Path to `~/.codex/auth.json` if not default |
| `CODEX_HOME` | Codex only | Alternative Codex home directory |

### Miscellaneous

| Variable | Required | Description |
|----------|----------|-------------|
| `ANTHROPIC_MODEL` | Optional | Override model for first-party or 3P (Bedrock/Vertex/Foundry) |
| `OPENAI_MODEL` | Optional | Override model for OpenAI-compatible providers (takes priority over `ANTHROPIC_MODEL`) |
| `GAKR_DISABLE_CO_AUTHORED_BY` | No | Suppress the `Co-Authored-By` trailer in generated git commits |

## Runtime Hardening

Use these commands to validate your setup and catch mistakes early:

```bash
# quick startup sanity check
bun run smoke

# validate provider env + reachability
bun run doctor:runtime

# print machine-readable runtime diagnostics
bun run doctor:runtime:json

# persist a diagnostics report to reports/doctor-runtime.json
bun run doctor:report

# full local hardening check (smoke + runtime doctor)
bun run hardening:check

# strict hardening (includes project-wide typecheck)
bun run hardening:strict
```

Notes:

- `doctor:runtime` fails fast if `GAKR_CODE_USE_OPENAI=1` with a placeholder key or a missing key for non-local providers.
- Local providers such as `http://localhost:11434/v1`, `http://10.0.0.1:11434/v1`, and `http://127.0.0.1:1337/v1` can run without `OPENAI_API_KEY`.
- Codex profiles validate `CODEX_API_KEY` or the Codex CLI auth file and probe `POST /responses` instead of `GET /models`.

## Provider Launch Profiles

Use profile launchers to avoid repeated environment setup:

```bash
# one-time profile bootstrap (prefers viable local Ollama, otherwise OpenAI)
bun run profile:init

# preview the best provider/model for your goal
bun run profile:recommend -- --goal coding --benchmark

# auto-apply the best available local/openai provider/model for your goal
bun run profile:auto -- --goal latency

# codex bootstrap (defaults to codexplan and ~/.codex/auth.json)
bun run profile:codex

# openai bootstrap with explicit key
bun run profile:init -- --provider openai --api-key sk-...

# ollama bootstrap with custom model
bun run profile:init -- --provider ollama --model llama3.2:3b

# ollama bootstrap with intelligent model auto-selection
bun run profile:init -- --provider ollama --goal coding

# gemini bootstrap
bun run profile:init -- --provider gemini --api-key YOUR_GEMINI_KEY

# nvidia-nim bootstrap
bun run profile:init -- --provider nvidia-nim --api-key nvapi-...

# atomic-chat bootstrap (auto-detects running model)
bun run profile:init -- --provider atomic-chat

# codex bootstrap with a fast model alias
bun run profile:init -- --provider codex --model codexspark

# launch using persisted profile (.gakrcli-profile.json)
bun run dev:profile

# codex profile (uses CODEX_API_KEY or ~/.codex/auth.json)
bun run dev:codex

# OpenAI profile (requires OPENAI_API_KEY in your shell)
bun run dev:openai

# Ollama profile (defaults: localhost:11434, llama3.2:3b)
bun run dev:ollama

# Gemini profile
bun run dev:gemini

# NVIDIA profile
bun run scripts/provider-launch.ts nvidia-nim

# Atomic Chat profile (Apple Silicon local LLMs at 127.0.0.1:1337)
bun run dev:atomic-chat
```

`profile:recommend` ranks installed Ollama models for `latency`, `balanced`, or `coding`, and `profile:auto` can persist the recommendation directly.

If no profile exists yet, `dev:profile` uses the same goal-aware defaults when picking the initial model.

Use `--provider ollama` when you want a local-only path. Auto mode falls back to OpenAI when no viable local chat model is installed.

Use `--provider atomic-chat` when you want Atomic Chat as the local Apple Silicon provider.

Use `profile:codex` or `--provider codex` when you want the ChatGPT Codex backend.

Use `--provider gemini` or `--provider nvidia-nim` for those services.

**Note**: For GitHub Models, AWS Bedrock, Google Vertex AI, and Azure Foundry, configure the required environment variables directly (see the provider examples above) and run `gakrcli`. These providers are not yet supported by the automated profile bootstrap.

`dev:openai`, `dev:ollama`, `dev:atomic-chat`, `dev:codex`, and `dev:gemini` are package scripts. For NVIDIA NIM, use `bun run scripts/provider-launch.ts nvidia-nim`.

For `dev:ollama`, make sure Ollama is running locally before launch.

For `dev:atomic-chat`, make sure Atomic Chat is running with a model loaded before launch.

For GitHub Models, Bedrock, Vertex, and Foundry, ensure your credentials are properly configured:
- **GitHub**: Personal Access Token with `models` scope (`GITHUB_TOKEN` or `GH_TOKEN`)
- **Bedrock**: AWS credentials (`AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_REGION`)
- **Vertex**: Google Cloud credentials (`GOOGLE_APPLICATION_CREDENTIALS` or `gcloud` auth) and `ANTHROPIC_VERTEX_PROJECT_ID`
- **Foundry**: Azure API key (`ANTHROPIC_FOUNDRY_API_KEY`) or `az login` for AD auth, and `ANTHROPIC_FOUNDRY_RESOURCE`
