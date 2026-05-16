# Build And Run Notes

These notes are safe to commit. Do not store real API keys or OAuth tokens in this file.

## Local Development

```powershell
bun install
bun run build
node dist/cli.mjs --version
```

Optional global link while developing:

```powershell
npm link
gakrcli --version
```

## Common Provider Runs

### Codex

GakrCLI defaults to the Codex-compatible backend when Codex credentials are available. Use `/provider` for guided setup, or provide `CODEX_API_KEY` / `CODEX_AUTH_JSON_PATH`.

### OpenAI-Compatible

```powershell
$env:GAKR_CODE_USE_OPENAI="1"
$env:OPENAI_API_KEY="sk-your-key"
$env:OPENAI_BASE_URL="https://api.openai.com/v1"
$env:OPENAI_MODEL="gpt-4o"
gakrcli
```

### Ollama

```powershell
ollama pull llama3.2:3b
$env:GAKR_CODE_USE_OPENAI="1"
$env:OPENAI_BASE_URL="http://localhost:11434/v1"
$env:OPENAI_MODEL="llama3.2:3b"
gakrcli
```

### NVIDIA NIM

The current default NVIDIA NIM model in code is `nvidia/llama-3.1-nemotron-70b-instruct`.

```powershell
$env:GAKR_CODE_USE_NVIDIA="1"
$env:NVIDIA_API_KEY="nvapi-your-key"
$env:NVIDIA_MODEL="nvidia/llama-3.1-nemotron-70b-instruct"
$env:NVIDIA_BASE_URL="https://integrate.api.nvidia.com/v1"
gakrcli
```

## Validation

```powershell
bun run smoke
bun run typecheck
bun test
bun run doctor:runtime
bun run verify:privacy
```

The root test script ignores `references/**` and `dist/**`.
