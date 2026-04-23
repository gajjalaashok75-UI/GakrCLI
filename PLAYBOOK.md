# Gakr CLI Playbook — Version 0.2.6

Quick-reference for using Gakr with local models (Ollama, Atomic Chat) and cloud providers. Covers daily workflow, setup, troubleshooting, and command cheatsheet.

## 1. What You Have

- A CLI agent loop that can read/write files, run terminal commands, search code, browse web, and execute multi-step workflows.
- Provider profile system (`profile:init`, `dev:profile`) for saved configurations.
- Runtime diagnostics (`doctor:runtime`, `doctor:report`) and health checks.
- Preset shortcuts: `profile:fast` (llama3.2:3b), `profile:code` (qwen2.5-coder:7b).

## 2. Daily Start (Fast Path)

In your project root, run:

```bash
bun run dev:profile
```

For quick switches to preset models:

```bash
# low latency (llama3.2:3b) — fastest responses
bun run dev:fast

# coding-optimized (qwen2.5-coder:7b) — better code quality
bun run dev:code
```

If health checks pass, Gakr CLI launches immediately. If issues are found, `doctor:runtime` output will guide fixes.

## 3. One-Time Setup

### 3.1 Initialize a profile

Local model (Ollama):

```bash
bun run profile:init -- --provider ollama --model llama3.2:3b
```

Or let Gakr recommend a model based on your goal and hardware:

```bash
bun run profile:init -- --provider ollama --goal coding   # or: latency, balanced
```

Preview recommendations without saving:

```bash
bun run profile:recommend -- --provider ollama --goal coding --benchmark
```

Other profile providers supported: `openai`, `gemini`, `nvidia`, `codex`, `atomic-chat`.

### 3.2 Confirm profile

```bash
cat .gakr-profile.json   # or: Get-Content .gakr-profile.json (PowerShell)
```

### 3.3 Validate environment

```bash
bun run doctor:runtime
```

This checks Node version, Bun runtime, provider reachability, and required tools (rg).

## 4. Health and Diagnostics

### 4.1 Human-readable checks

```bash
bun run doctor:runtime
```

### 4.2 JSON output (for CI/automation)

```bash
bun run doctor:runtime:json
```

### 4.3 Save full report

```bash
bun run doctor:report
# Output: reports/doctor-runtime.json
```

### 4.4 Hardening

```bash
# Practical checks (build + runtime)
bun run hardening:check

# Strict checks (typecheck + practical)
bun run hardening:strict
```

## 5. Provider Profiles (Local + Cloud)

Run `bun run profile:init -- --provider <name>` to create a saved profile.

### 5.1 Local Providers (no API key)

**Ollama**

```bash
bun run profile:init -- --provider ollama --model llama3.2:3b
bun run dev:profile
```

Requires: Ollama running (`ollama serve`), model already pulled (`ollama pull <model>`).

**Atomic Chat** (Apple Silicon)

```bash
bun run profile:init -- --provider atomic-chat --model <model-id>
bun run dev:profile
```

Requires: Atomic Chat app running on 127.0.0.1:1337 with a model loaded.

### 5.2 Cloud Providers (API key required)

**OpenAI-compatible** (OpenAI, OpenRouter, DeepSeek, Groq, etc.)

```bash
bun run profile:init -- --provider openai --api-key sk-... --model gpt-4o
bun run dev:profile
```

**Gemini**

```bash
bun run profile:init -- --provider gemini --api-key <key> --model gemini-2.0-flash
bun run dev:profile
```

**NVIDIA NIMs**

```bash
bun run profile:init -- --provider nvidia --api-key <key> --model nvidia/llama-3.1-nemotron-70b-instruct
bun run dev:profile
```

**Codex**

```bash
bun run profile:init -- --provider codex --model codexplan
# Uses CODEX_API_KEY or ~/.codex/auth.json
bun run dev:profile
```

### 5.3 Special Modes (Environment Variables)

**Anthropic (Claude)** — no saved profile; configure via environment:

```bash
export ANTHROPIC_API_KEY=sk-ant-...
export ANTHROPIC_MODEL=claude-sonnet-4-5-20251014
bun run dev:profile   # auto-detects Anthropic credentials
```

Or use guided login:

```bash
gakrcli auth login
```

**GitHub Models** (free tier)

```bash
export GAKR_CODE_USE_GITHUB=1
export GITHUB_TOKEN=ghp_...   # or GH_TOKEN
bun run dev:profile
```

Default model: `openai/gpt-4.1` (via GitHub's model gateway).

**Other AWS/Google/Anyscale providers**

Set the corresponding env flags:

- `GAKR_CODE_USE_BEDROCK=1` (AWS Bedrock)
- `GAKR_CODE_USE_VERTEX=1` (Google Vertex AI)
- `GAKR_CODE_USE_FOUNDRY=1` (Anyscale Foundry)

These use the provider's native credential chains.

## 6. Troubleshooting Matrix

### 6.1 "Script not found: dev"

**Cause:** Running commands outside the Gakr project root.

**Fix:**

```bash
cd /path/to/gakrcli   # project root with package.json
bun run dev:profile
```

### 6.2 "ollama: command not found"

**Cause:** Ollama not installed or not in PATH.

**Fix:**
- Install: https://ollama.com/download or `winget install Ollama.Ollama` (Windows)
- Verify: `ollama --version`
- Restart terminal after install.

### 6.3 Provider reachability failed (localhost refused)

**Cause:** Ollama or Atomic Chat service not running.

**Fix:**
- Ollama: `ollama serve` (in a separate terminal)
- Atomic Chat: Launch the Atomic Chat app.

Then re-run: `bun run doctor:runtime`

### 6.4 "Missing API key" or "authentication required"

**Cause:** Provider requires a valid API key but none provided.

**Fix:**
- For cloud providers: pass `--api-key` to `profile:init` or set the appropriate environment variable.
- For local providers: ensure you're using `--provider ollama` and that Ollama is running.

### 6.5 "No viable Ollama chat model discovered"

**Cause:** Ollama is running but no chat model is pulled/loaded.

**Fix:**

```bash
ollama pull llama3.2:3b   # or your preferred model
```

Then re-run `profile:init` to create/update your profile with the new model.

### 6.6 "ripgrep (rg) not found"

**Cause:** `rg` is required but not installed.

**Fix:**
- macOS: `brew install ripgrep`
- Ubuntu/Debian: `sudo apt-get install ripgrep`
- Windows: `winget install ripgrep` or download from ripgrep.org
- Verify: `rg --version`

Restart terminal after installation.

### 6.7 "Placeholder key" or "SUA_CHAVE" errors

**Cause:** You used a placeholder value instead of a real key.

**Fix:**
- Replace with actual API key from your provider.
- For local providers (Ollama, Atomic Chat) no API key is needed; omit `--api-key`.

## 7. Recommended Models

### Local (Ollama) presets

- `llama3.2:3b` — fastest, low RAM (8GB+), good general purpose
- `qwen2.5-coder:7b` — optimized for code, best quality/size tradeoff
- `codellama:7b` — code specialist alternative
- Larger: `qwen2.5-coder:14b`, `llama3.1:8b` (need 16GB+ RAM)

Quick switch:

```bash
bun run profile:init -- --provider ollama --model qwen2.5-coder:7b
bun run dev:profile
```

Preset shortcuts:

```bash
bun run profile:fast   # -> llama3.2:3b
bun run profile:code   # -> qwen2.5-coder:7b
```

Goal-based auto-selection (picks best available model):

```bash
bun run profile:init -- --provider ollama --goal latency   # fastest available
bun run profile:init -- --provider ollama --goal balanced  # balanced speed/quality
bun run profile:init -- --provider ollama --goal coding    # optimize for code
```

### Cloud defaults

- OpenAI: `gpt-4o`, `gpt-4.1`, `o3-mini`
- Gemini: `gemini-2.0-flash`, `gemini-1.5-pro`
- NVIDIA: `nvidia/llama-3.1-nemotron-70b-instruct`
- Codex: `codexplan`
- GitHub Models: `openai/gpt-4.1` (via GitHub's gateway)

## 8. Practical Prompt Playbook (Copy/Paste)

## 8.1 Code understanding

- "Map this repository architecture and explain the execution flow from entrypoint to tool invocation."
- "Find the top 5 risky modules and explain why."

## 8.2 Refactoring

- "Refactor this module for clarity without behavior change, then run checks and summarize diff impact."
- "Extract shared logic from duplicated functions and add minimal tests."

## 8.3 Debugging

- "Reproduce the failure, identify root cause, implement fix, and validate with commands."
- "Trace this error path and list likely failure points with confidence levels."

## 8.4 Reliability

- "Add runtime guardrails and fail-fast messages for invalid provider env vars."
- "Create a diagnostic command that outputs JSON report for CI artifacts."

## 8.5 Review mode

- "Do a code review of unstaged changes, prioritize bugs/regressions, and suggest concrete patches."

## 9. Safe Working Rules

- Run `doctor:runtime` before debugging provider issues.
- Prefer `dev:profile` over manual env edits.
- Keep `.gakr-profile.json` local (already gitignored).
- Use `doctor:report` before asking for help so you have a reproducible snapshot.

## 10. Quick Recovery Checklist

When something breaks, run in order:

```bash
bun run doctor:runtime
bun run doctor:report
bun run smoke
```

If answers are very slow, check processor mode:

```bash
ollama ps
```

If `PROCESSOR` shows `CPU`, your setup is valid but latency will be higher for large models.

If local model mode is failing:

```bash
ollama --version
ollama serve
bun run doctor:runtime
bun run dev:profile
```

## 11. Command Reference

```bash
# Build & run
bun run dev              # build + run with hot reload (dev)
bun run start            # run built CLI
bun run dev:profile      # launch using saved profile (most common)

# Shortcuts
bun run dev:fast         # fast preset (llama3.2:3b + low-latency flags)
bun run dev:code         # coding preset (qwen2.5-coder:7b)
bun run dev:ollama       # force Ollama profile
bun run dev:openai       # force OpenAI profile

# Profile management
bun run profile:init -- --provider ollama --model <model>   # create profile
bun run profile:init -- --provider openai --api-key <key> --model gpt-4o
bun run profile:recommend -- --provider ollama --goal coding --benchmark
bun run profile:auto       # auto-select best provider and apply
bun run profile:fast       # preset: llama3.2:3b
bun run profile:code       # preset: qwen2.5-coder:7b

# Diagnostics
bun run doctor:runtime            # system checks
bun run doctor:runtime:json       # JSON output
bun run doctor:report             # save to reports/doctor-runtime.json

# Quality & verification
bun run smoke                     # build + version check
bun run hardening:check           # smoke + doctor
bun run hardening:strict          # typecheck + hardening:check
bun run typecheck                 # TypeScript check only
bun run verify:privacy            # ensure no telemetry

# Testing
bun test                          # run test suite
```

## 12. Success Criteria

Your setup is healthy when:

- `bun run doctor:runtime` passes provider and reachability checks.
- `bun run dev:profile` opens the CLI normally.
- Model shown in the UI matches your selected profile model.
