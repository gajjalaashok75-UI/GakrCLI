# GakrCLI Provider Reference

This page documents the provider presets exposed by GakrCLI 0.5.6. The easiest setup path is still the in-app provider wizard:

```text
/provider
```

Provider profiles are stored in GakrCLI settings and can be reused by the CLI, SDK, and VS Code extension.

## Provider Presets

| Preset | Type | Credentials | Default endpoint or notes |
| --- | --- | --- | --- |
| `anthropic` | Native Anthropic | `ANTHROPIC_API_KEY` | Optional `ANTHROPIC_BASE_URL`, `ANTHROPIC_MODEL`. |
| `openai` | OpenAI-compatible | `OPENAI_API_KEY` | Uses OpenAI API by default. |
| `gemini` | Gemini | `GEMINI_API_KEY` or `GOOGLE_API_KEY` | Supports direct Gemini routing. |
| `deepseek` | OpenAI-compatible vendor | `DEEPSEEK_API_KEY` | `https://api.deepseek.com/v1`. |
| `bankr` | OpenAI-compatible vendor | `BNKR_API_KEY` | `https://llm.bankr.bot/v1`. |
| `moonshotai` | OpenAI-compatible vendor | `MOONSHOT_API_KEY` | `https://api.moonshot.ai/v1`. |
| `kimi-code` | OpenAI-compatible gateway | `KIMI_API_KEY` | `https://api.kimi.com/coding/v1`. |
| `minimax` | OpenAI-compatible vendor | `MINIMAX_API_KEY` | `https://api.minimax.io/v1`. |
| `mistral` | Mistral | `MISTRAL_API_KEY` | `https://api.mistral.ai/v1`. |
| `nvidia-nim` | OpenAI-compatible gateway | `NVIDIA_API_KEY` | `https://integrate.api.nvidia.com/v1`. |
| `xai` | OpenAI-compatible vendor | `XAI_API_KEY` or OAuth profile | `https://api.x.ai/v1`. |
| `xiaomi-mimo` | OpenAI-compatible vendor | `MIMO_API_KEY` | `https://api.xiaomimimo.com/v1`. |
| `zai` | OpenAI-compatible vendor | `OPENAI_API_KEY` | `https://api.z.ai/api/coding/paas/v4`. |
| `azure-openai` | OpenAI-compatible gateway | `AZURE_OPENAI_API_KEY` | Use your Azure OpenAI resource/deployment URL. |
| `dashscope-cn` | OpenAI-compatible gateway | `DASHSCOPE_API_KEY` | `https://coding.dashscope.aliyuncs.com/v1`. |
| `dashscope-intl` | OpenAI-compatible gateway | `DASHSCOPE_API_KEY` | `https://coding-intl.dashscope.aliyuncs.com/v1`. |
| `github` | GitHub Copilot / GitHub Models | `GITHUB_TOKEN` or `GH_TOKEN` | `https://api.githubcopilot.com`. |
| `groq` | OpenAI-compatible gateway | `GROQ_API_KEY` | `https://api.groq.com/openai/v1`. |
| `hicap` | OpenAI-compatible gateway | `HICAP_API_KEY` | `https://api.hicap.ai/v1`. |
| `openrouter` | OpenAI-compatible gateway | `OPENROUTER_API_KEY` | `https://openrouter.ai/api/v1`. |
| `together` | OpenAI-compatible gateway | `TOGETHER_API_KEY` | `https://api.together.xyz/v1`. |
| `venice` | OpenAI-compatible vendor | `VENICE_API_KEY` | `https://api.venice.ai/api/v1`. |
| `bedrock` | AWS Bedrock | AWS credential chain | Set `GAKR_CODE_USE_BEDROCK=1`. |
| `vertex` | Google Vertex AI | Google ADC credentials | Set `GAKR_CODE_USE_VERTEX=1`. |
| `ollama` | Local OpenAI-compatible | none | `http://localhost:11434/v1`; optional dummy key `ollama`. |
| `lmstudio` | Local OpenAI-compatible | none | `http://localhost:1234/v1`; optional dummy key `lmstudio`. |
| `atomic-chat` | Local OpenAI-compatible | none | `http://127.0.0.1:1337/v1`. |
| `custom` | OpenAI-compatible | optional `OPENAI_API_KEY` | Requires `OPENAI_BASE_URL` and usually `OPENAI_MODEL`. |

## Common Environment Variables

| Variable | Purpose |
| --- | --- |
| `GAKR_CODE_USE_OPENAI=1` | Enable the OpenAI-compatible route. |
| `OPENAI_API_KEY` | API key for OpenAI-compatible providers. |
| `OPENAI_BASE_URL` or `OPENAI_API_BASE` | Base URL for OpenAI-compatible providers. |
| `OPENAI_MODEL` | Active model for OpenAI-compatible providers. |
| `ANTHROPIC_API_KEY` | Anthropic API key. |
| `ANTHROPIC_MODEL` | Anthropic model override. |
| `GAKR_CODE_USE_GEMINI=1` | Enable Gemini routing. |
| `GEMINI_API_KEY` or `GOOGLE_API_KEY` | Gemini credentials. |
| `GEMINI_MODEL` | Gemini model override. |
| `GAKR_CODE_USE_GITHUB=1` | Enable GitHub provider routing. |
| `GITHUB_TOKEN` or `GH_TOKEN` | GitHub provider token. |
| `GAKR_CODE_USE_NVIDIA=1` | Enable NVIDIA NIM routing. |
| `NVIDIA_API_KEY` | NVIDIA NIM key. |
| `GAKR_CODE_USE_BEDROCK=1` | Enable AWS Bedrock routing. |
| `GAKR_CODE_USE_VERTEX=1` | Enable Google Vertex AI routing. |

## OpenAI-Compatible Examples

DeepSeek:

```bash
export GAKR_CODE_USE_OPENAI=1
export OPENAI_API_KEY=sk-your-key
export OPENAI_BASE_URL=https://api.deepseek.com/v1
export OPENAI_MODEL=deepseek-chat
```

OpenRouter:

```bash
export GAKR_CODE_USE_OPENAI=1
export OPENAI_API_KEY=sk-or-your-key
export OPENAI_BASE_URL=https://openrouter.ai/api/v1
export OPENAI_MODEL=openai/gpt-4o
```

Ollama:

```bash
ollama pull llama3.2:3b
export GAKR_CODE_USE_OPENAI=1
export OPENAI_BASE_URL=http://localhost:11434/v1
export OPENAI_MODEL=llama3.2:3b
```

LM Studio:

```bash
export GAKR_CODE_USE_OPENAI=1
export OPENAI_BASE_URL=http://localhost:1234/v1
export OPENAI_MODEL=your-loaded-model-name
export OPENAI_API_KEY=lmstudio
```

Custom provider with a custom auth header:

```bash
export GAKR_CODE_USE_OPENAI=1
export OPENAI_BASE_URL=https://api.example.com/v1
export OPENAI_MODEL=example-model
export OPENAI_AUTH_HEADER=X-API-Key
export OPENAI_AUTH_SCHEME=raw
export OPENAI_AUTH_HEADER_VALUE=your-secret
```

## Diagnostics

Run:

```bash
bun run doctor:runtime
```

For installed CLI users:

```bash
gakrcli
/provider
```

If the provider is local, confirm the server is running and that `/v1/models` responds. If the provider is hosted, confirm the API key, base URL, model name, and account quota.
