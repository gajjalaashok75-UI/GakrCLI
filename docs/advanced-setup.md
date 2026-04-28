# Gakr Advanced Setup (v0.2.6)

This guide is for users who want source builds, Bun workflows, provider profiles, diagnostics, or more control over runtime behavior.

## Install Options

### Option A: npm

```bash
npm install -g @gakr-gakr/gakrcli
```

### Option B: From source with Bun

Use Bun `1.3.11` or newer for source builds on Windows. Older Bun versions can fail during `bun run build`.

```bash
git clone https://github.com/gakr-gakr/gakr.git
cd gakr

bun install
bun run build
npm link
```

### Option C: Run directly with Bun

```bash
git clone https://github.com/gakr-gakr/gakr.git
cd gakr

bun install
bun run dev
```

## Provider Examples

### OpenAI

```bash
export GAKR_CODE_USE_OPENAI=1
export OPENAI_API_KEY=sk-...
export OPENAI_MODEL=gpt-4o  # or gpt-4.1, o1, o3-mini
```

### Codex via ChatGPT auth

`codexplan` maps to GPT-5.4 on the Codex backend with high reasoning.
`codexspark` maps to GPT-5.3 Codex Spark for faster loops.

If you use the in-app provider wizard, choose `Codex OAuth` to open ChatGPT sign-in in your browser and let GakrCLI store Codex credentials securely.

If you already use the Codex CLI, Gakr reads `~/.codex/auth.json` automatically. You can also point it elsewhere with `CODEX_AUTH_JSON_PATH` or override the token directly with `CODEX_API_KEY`.

```bash
export GAKR_CODE_USE_OPENAI=1
export OPENAI_MODEL=codexplan

# optional if you do not already have ~/.codex/auth.json
export CODEX_API_KEY=...

gakrcli
```

### DeepSeek

```bash
export GAKR_CODE_USE_OPENAI=1
export OPENAI_API_KEY=sk-...
export OPENAI_BASE_URL=https://api.deepseek.com/v1
export OPENAI_MODEL=deepseek-v4-flash
```

Use `deepseek-v4-pro` when you want the stronger model. `deepseek-chat` and `deepseek-reasoner` remain available as DeepSeek's legacy API aliases.

### NVIDIA NIMs

```bash
export GAKR_CODE_USE_NVIDIA=1
export NVIDIA_API_KEY=nvapi-...
export NVIDIA_MODEL=stepfun-ai/step-3.5-flash  # default
# optional: NVIDIA_BASE_URL (default: https://integrate.api.nvidia.com/v1)
```

### Google Gemini (Direct)

```bash
export GAKR_CODE_USE_GEMINI=1
export GEMINI_API_KEY=...
export GEMINI_MODEL=gemini-2.0-flash  # or gemini-2.5-flash, gemini-2.0-flash-lite
# optional: GEMINI_BASE_URL (default: https://generativelanguage.googleapis.com/v1beta/openai)
```

### GitHub Models (models.github.ai)

```bash
export GAKR_CODE_USE_GITHUB=1
export GITHUB_TOKEN=ghp_...  # or GH_TOKEN
export OPENAI_MODEL=openai/gpt-4.1  # or github:copilot, meta-llama/Llama-3.3-70B-Instruct-Turbo
```

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
export OPENAI_MODEL=google/gemini-2.0-flash-001  # or google/gemini-2.5-flash-preview
```

OpenRouter model availability changes over time. If a model stops working, try another current OpenRouter model before assuming the integration is broken.

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
| `OPENAI_MODEL` | Yes | Model name such as `gpt-4o`, `deepseek-v4-flash`, or `llama3.3:70b` |
| `OPENAI_BASE_URL` | No | API endpoint, defaults to `https://api.openai.com/v1` |

### Specialized Providers

| Variable | Required | Description |
|----------|----------|-------------|
| `GAKR_CODE_USE_GEMINI` | Gemini only | Set to `1` to enable Google Gemini |
| `GEMINI_API_KEY` | Gemini only | Your Google AI API key |
| `GEMINI_MODEL` | No | Gemini model (default: `gemini-2.0-flash`) |
| `GEMINI_BASE_URL` | No | Gemini API base URL (default: Google's endpoint) |
| `GAKR_CODE_USE_NVIDIA` | NVIDIA only | Set to `1` to enable NVIDIA NIMs |
| `NVIDIA_API_KEY` | NVIDIA only | Your NVIDIA API key (`nvapi-...`) |
| `NVIDIA_MODEL` | No | NVIDIA model (default: `stepfun-ai/step-3.5-flash`) |
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

# launch using persisted profile (.gakr-profile.json)
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
bun run dev:nvidia-nim

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

`dev:openai`, `dev:ollama`, `dev:atomic-chat`, `dev:codex`, `dev:gemini`, and `dev:nvidia-nim` run `doctor:runtime` first and only launch the app if checks pass.

For `dev:ollama`, make sure Ollama is running locally before launch.

For `dev:atomic-chat`, make sure Atomic Chat is running with a model loaded before launch.

For GitHub Models, Bedrock, Vertex, and Foundry, ensure your credentials are properly configured:
- **GitHub**: Personal Access Token with `models` scope (`GITHUB_TOKEN` or `GH_TOKEN`)
- **Bedrock**: AWS credentials (`AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_REGION`)
- **Vertex**: Google Cloud credentials (`GOOGLE_APPLICATION_CREDENTIALS` or `gcloud` auth) and `ANTHROPIC_VERTEX_PROJECT_ID`
- **Foundry**: Azure API key (`ANTHROPIC_FOUNDRY_API_KEY`) or `az login` for AD auth, and `ANTHROPIC_FOUNDRY_RESOURCE`
