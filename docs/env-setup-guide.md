# Environment Setup Guide

This guide is generated from tracked references to environment variables in the GakrCLI repository plus `.env.example`. It is meant to be complete, so it includes normal user setup variables, internal/runtime toggles, host variables detected by the CLI, test-only variables, and variables that appear only inside documentation or bundled skill examples.

Inventory source: `git ls-files`, scanned for `process.env.*`, `process.env["NAME"]`, `Bun.env.*`, `Deno.env.get("NAME")`, `import.meta.env.*`, Python `os.environ` / `getenv`, plus assignment-style entries from `.env.example`.

## How To Set Variables

PowerShell, current session:

```powershell
$env:OPENAI_API_KEY = "sk-your-key"
$env:GAKR_CODE_USE_OPENAI = "1"
```

PowerShell, persistent user variable:

```powershell
[System.Environment]::SetEnvironmentVariable("OPENAI_API_KEY", "sk-your-key", "User")
```

macOS/Linux shell:

```bash
export OPENAI_API_KEY=sk-your-key
export GAKR_CODE_USE_OPENAI=1
```

Project `.env` example:

```dotenv
GAKR_CODE_USE_OPENAI=1
OPENAI_API_KEY=sk-your-key
OPENAI_BASE_URL=https://api.openai.com/v1
OPENAI_MODEL=gpt-4o
```

Only set variables you need. Many rows below are detected automatically by terminals, CI, cloud hosts, or tests.

## Common Provider Recipes

| Provider | Variables | Example |
| --- | --- | --- |
| Anthropic | `ANTHROPIC_API_KEY`, optional `ANTHROPIC_MODEL`, `ANTHROPIC_BASE_URL` | `ANTHROPIC_API_KEY=sk-ant-...` |
| OpenAI-compatible | `GAKR_CODE_USE_OPENAI`, `OPENAI_API_KEY`, `OPENAI_MODEL`, optional `OPENAI_BASE_URL` | `GAKR_CODE_USE_OPENAI=1`, `OPENAI_MODEL=gpt-4o` |
| Ollama | `GAKR_CODE_USE_OPENAI`, `OPENAI_BASE_URL`, `OPENAI_API_KEY`, `OPENAI_MODEL` | `OPENAI_BASE_URL=http://localhost:11434/v1`, `OPENAI_API_KEY=ollama` |
| LM Studio | `GAKR_CODE_USE_OPENAI`, `OPENAI_BASE_URL`, `OPENAI_MODEL`, optional `OPENAI_API_KEY` | `OPENAI_BASE_URL=http://localhost:1234/v1` |
| Gemini | `GAKR_CODE_USE_GEMINI`, `GEMINI_API_KEY` or `GOOGLE_API_KEY`, `GEMINI_MODEL`, optional `GEMINI_BASE_URL` | `GAKR_CODE_USE_GEMINI=1` |
| GitHub Models | `GAKR_CODE_USE_GITHUB`, `GITHUB_TOKEN` or `GH_TOKEN` | `GITHUB_TOKEN=ghp_...` |
| AWS Bedrock | `GAKR_CODE_USE_BEDROCK`, `AWS_REGION`, `AWS_DEFAULT_REGION`, optional `AWS_BEARER_TOKEN_BEDROCK`, `ANTHROPIC_BEDROCK_BASE_URL` | `AWS_REGION=us-east-1` |
| Vertex AI | `GAKR_CODE_USE_VERTEX`, `ANTHROPIC_VERTEX_PROJECT_ID`, `CLOUD_ML_REGION`, `GOOGLE_CLOUD_PROJECT`, optional `GOOGLE_APPLICATION_CREDENTIALS` | `CLOUD_ML_REGION=us-east5` |
| Mistral | `GAKR_CODE_USE_MISTRAL`, `MISTRAL_API_KEY`, optional `MISTRAL_MODEL`, `MISTRAL_BASE_URL` | `MISTRAL_API_KEY=...` |
| NVIDIA NIM | `GAKR_CODE_USE_OPENAI`, `NVIDIA_API_KEY`, `OPENAI_BASE_URL`, `OPENAI_MODEL` | `OPENAI_BASE_URL=https://integrate.api.nvidia.com/v1` |
| MiniMax | `GAKR_CODE_USE_OPENAI`, `MINIMAX_API_KEY`, `OPENAI_BASE_URL`, `OPENAI_MODEL` | `OPENAI_MODEL=MiniMax-M2.5` |

## Complete Inventory

Total distinct variable names found: 653.

### Provider and model setup

| Variable | Scope | Purpose | Example | Source |
| --- | --- | --- | --- | --- |
| `ANTHROPIC_API_KEY` | runtime + setup | Anthropic API key for the default Anthropic provider. | `replace-with-secret` | `.env.example` |
| `ANTHROPIC_AUTH_TOKEN` | runtime | Anthropic OAuth bearer token alternative used by authenticated provider flows. | `replace-with-secret` | `src/services/api/client.test.ts` |
| `ANTHROPIC_BASE_URL` | runtime + setup | Override Anthropic-compatible API base URL. | `https://example.com` | `.env.example` |
| `ANTHROPIC_BEDROCK_BASE_URL` | runtime + setup | URL/base endpoint override for the related service. Source: .env.example. | `https://example.com` | `.env.example` |
| `ANTHROPIC_BETAS` | runtime | Environment value read by GakrCLI or related tracked code. Source: src/utils/betas.ts. | `1` | `src/utils/betas.ts` |
| `ANTHROPIC_CUSTOM_HEADERS` | runtime | Environment value read by GakrCLI or related tracked code. Source: src/commands/model/model.test.tsx. | `1` | `src/commands/model/model.test.tsx` |
| `ANTHROPIC_CUSTOM_MODEL_OPTION` | runtime | Model selection or model metadata override. Source: src/utils/model/modelOptions.github.test.ts. | `model-id` | `src/utils/model/modelOptions.github.test.ts` |
| `ANTHROPIC_CUSTOM_MODEL_OPTION_DESCRIPTION` | runtime | Model selection or model metadata override. Source: src/utils/model/modelOptions.ts. | `model-id` | `src/utils/model/modelOptions.ts` |
| `ANTHROPIC_CUSTOM_MODEL_OPTION_NAME` | runtime | Model selection or model metadata override. Source: src/utils/model/modelOptions.ts. | `model-id` | `src/utils/model/modelOptions.ts` |
| `ANTHROPIC_DEFAULT_HAIKU_MODEL` | runtime | Model selection or model metadata override. Source: src/utils/model/model.ts. | `model-id` | `src/utils/model/model.ts` |
| `ANTHROPIC_DEFAULT_HAIKU_MODEL_DESCRIPTION` | runtime | Model selection or model metadata override. Source: src/utils/model/modelOptions.ts. | `model-id` | `src/utils/model/modelOptions.ts` |
| `ANTHROPIC_DEFAULT_HAIKU_MODEL_NAME` | runtime | Model selection or model metadata override. Source: src/utils/model/modelOptions.ts. | `model-id` | `src/utils/model/modelOptions.ts` |
| `ANTHROPIC_DEFAULT_OPUS_MODEL` | runtime | Model selection or model metadata override. Source: src/utils/model/model.ts. | `model-id` | `src/utils/model/model.ts` |
| `ANTHROPIC_DEFAULT_OPUS_MODEL_DESCRIPTION` | runtime | Model selection or model metadata override. Source: src/utils/model/modelOptions.ts. | `model-id` | `src/utils/model/modelOptions.ts` |
| `ANTHROPIC_DEFAULT_OPUS_MODEL_NAME` | runtime | Model selection or model metadata override. Source: src/utils/model/modelOptions.ts. | `model-id` | `src/utils/model/modelOptions.ts` |
| `ANTHROPIC_DEFAULT_SONNET_MODEL` | runtime | Model selection or model metadata override. Source: src/utils/model/model.ts. | `model-id` | `src/utils/model/model.ts` |
| `ANTHROPIC_DEFAULT_SONNET_MODEL_DESCRIPTION` | runtime | Model selection or model metadata override. Source: src/utils/model/modelOptions.ts. | `model-id` | `src/utils/model/modelOptions.ts` |
| `ANTHROPIC_DEFAULT_SONNET_MODEL_NAME` | runtime | Model selection or model metadata override. Source: src/utils/model/modelOptions.ts. | `model-id` | `src/utils/model/modelOptions.ts` |
| `ANTHROPIC_FOUNDRY_API_KEY` | runtime | API key for ANTHROPIC_FOUNDRY integration/provider. Source: src/services/api/client.ts. | `replace-with-secret` | `src/services/api/client.ts` |
| `ANTHROPIC_FOUNDRY_BASE_URL` | runtime | URL/base endpoint override for the related service. Source: src/utils/status.tsx. | `https://example.com` | `src/utils/status.tsx` |
| `ANTHROPIC_FOUNDRY_RESOURCE` | runtime | Environment value read by GakrCLI or related tracked code. Source: src/utils/status.tsx. | `1` | `src/utils/status.tsx` |
| `ANTHROPIC_MODEL` | runtime + setup | Override the main Anthropic model. | `model-id` | `.env.example` |
| `ANTHROPIC_SMALL_FAST_MODEL` | runtime | Model selection or model metadata override. Source: src/services/api/logging.ts. | `model-id` | `src/services/api/logging.ts` |
| `ANTHROPIC_SMALL_FAST_MODEL_AWS_REGION` | runtime | Model selection or model metadata override. Source: src/services/api/client.ts. | `model-id` | `src/services/api/client.ts` |
| `ANTHROPIC_UNIX_SOCKET` | runtime | Environment value read by GakrCLI or related tracked code. Source: src/utils/apiPreconnect.test.ts. | `1` | `src/utils/apiPreconnect.test.ts` |
| `ANTHROPIC_VERTEX_PROJECT_ID` | runtime + setup | Environment value read by GakrCLI or related tracked code. Source: .env.example. | `1` | `.env.example` |
| `AWS_BEARER_TOKEN_BEDROCK` | runtime + setup | Environment value read by GakrCLI or related tracked code. Source: .env.example. | `1` | `.env.example` |
| `AWS_DEFAULT_REGION` | runtime + setup | Environment value read by GakrCLI or related tracked code. Source: .env.example. | `us-east-1` | `.env.example` |
| `AWS_EXECUTION_ENV` | runtime | Environment value read by GakrCLI or related tracked code. Source: src/utils/env.ts. | `1` | `src/utils/env.ts` |
| `AWS_LAMBDA_FUNCTION_NAME` | runtime | Environment value read by GakrCLI or related tracked code. Source: src/utils/env.ts. | `128000` | `src/utils/env.ts` |
| `AWS_REGION` | runtime + setup | Environment value read by GakrCLI or related tracked code. Source: .env.example. | `us-east-1` | `.env.example` |
| `BNKR_API_KEY` | runtime | API key for BNKR integration/provider. Source: src/services/api/openaiShim.test.ts. | `replace-with-secret` | `src/services/api/openaiShim.test.ts` |
| `CHATGPT_ACCOUNT_ID` | runtime | Environment value read by GakrCLI or related tracked code. Source: src/commands/provider/provider.test.tsx. | `128000` | `src/commands/provider/provider.test.tsx` |
| `CLOUD_ML_REGION` | runtime + setup | Environment value read by GakrCLI or related tracked code. Source: .env.example. | `us-east-1` | `.env.example` |
| `CODEX_ACCOUNT_ID` | runtime | Environment value read by GakrCLI or related tracked code. Source: src/commands/provider/provider.test.tsx. | `128000` | `src/commands/provider/provider.test.tsx` |
| `CODEX_API_KEY` | runtime | API key for CODEX integration/provider. Source: scripts/provider-bootstrap.ts. | `replace-with-secret` | `scripts/provider-bootstrap.ts` |
| `CODEX_AUTH_PATH` | runtime | Environment value read by GakrCLI or related tracked code. Source: src/utils/providerAutoDetect.ts. | `C:\\path\\to\\value` | `src/utils/providerAutoDetect.ts` |
| `GCLOUD_PROJECT` | runtime | Environment value read by GakrCLI or related tracked code. Source: src/services/api/client.ts. | `1` | `src/services/api/client.ts` |
| `GEMINI_ACCESS_TOKEN` | runtime | Token for GEMINI_ACCESS authentication or session flow. Source: src/commands/provider/provider.tsx. | `replace-with-secret` | `src/commands/provider/provider.tsx` |
| `GEMINI_API_KEY` | runtime + setup | Gemini API key. | `replace-with-secret` | `.env.example` |
| `GEMINI_BASE_URL` | runtime + setup | URL/base endpoint override for the related service. Source: .env.example. | `https://example.com` | `.env.example` |
| `GEMINI_MODEL` | runtime + setup | Model selection or model metadata override. Source: .env.example. | `model-id` | `.env.example` |
| `GOOGLE_API_KEY` | runtime | Google API key fallback for Gemini-compatible flows. | `replace-with-secret` | `scripts/system-check.ts` |
| `GOOGLE_APPLICATION_CREDENTIALS` | runtime | Environment value read by GakrCLI or related tracked code. Source: src/services/api/client.ts. | `1` | `src/services/api/client.ts` |
| `GOOGLE_CLOUD_PROJECT` | runtime + setup | Environment value read by GakrCLI or related tracked code. Source: .env.example. | `1` | `.env.example` |
| `HICAP_API_KEY` | setup template | API key for HICAP integration/provider. Source: .env.example. | `replace-with-secret` | `.env.example` |
| `MIMO_API_KEY` | runtime | API key for MIMO integration/provider. Source: src/services/api/client.test.ts. | `replace-with-secret` | `src/services/api/client.test.ts` |
| `MINIMAX_API_KEY` | runtime + setup | API key for MINIMAX integration/provider. Source: .env.example. | `replace-with-secret` | `.env.example` |
| `MISTRAL_API_KEY` | runtime | API key for MISTRAL integration/provider. Source: scripts/system-check.ts. | `replace-with-secret` | `scripts/system-check.ts` |
| `MISTRAL_BASE_URL` | runtime | URL/base endpoint override for the related service. Source: scripts/system-check.ts. | `https://example.com` | `scripts/system-check.ts` |
| `MISTRAL_MODEL` | runtime | Model selection or model metadata override. Source: scripts/system-check.ts. | `model-id` | `scripts/system-check.ts` |
| `NVIDIA_API_KEY` | runtime + setup | API key for NVIDIA integration/provider. Source: .env.example. | `replace-with-secret` | `.env.example` |
| `NVIDIA_BASE_URL` | runtime | URL/base endpoint override for the related service. Source: src/components/ConsoleOAuthFlow.test.tsx. | `https://example.com` | `src/components/ConsoleOAuthFlow.test.tsx` |
| `NVIDIA_MODEL` | runtime | Model selection or model metadata override. Source: src/components/ConsoleOAuthFlow.test.tsx. | `model-id` | `src/components/ConsoleOAuthFlow.test.tsx` |
| `NVIDIA_NIM` | runtime | Environment value read by GakrCLI or related tracked code. Source: src/components/StartupScreen.test.ts. | `1` | `src/components/StartupScreen.test.ts` |
| `OPENAI_API_BASE` | runtime | Environment value read by GakrCLI or related tracked code. Source: src/commands/model/model.test.tsx. | `https://example.com` | `src/commands/model/model.test.tsx` |
| `OPENAI_API_FORMAT` | runtime + setup | Environment value read by GakrCLI or related tracked code. Source: .env.example. | `1` | `.env.example` |
| `OPENAI_API_KEY` | runtime + setup | OpenAI or OpenAI-compatible provider API key. | `replace-with-secret` | `.env.example` |
| `OPENAI_API_VERSION` | runtime | Environment value read by GakrCLI or related tracked code. Source: src/utils/model/openaiModelDiscovery.ts. | `1` | `src/utils/model/openaiModelDiscovery.ts` |
| `OPENAI_AUTH_HEADER` | runtime + setup | Environment value read by GakrCLI or related tracked code. Source: .env.example. | `1` | `.env.example` |
| `OPENAI_AUTH_HEADER_VALUE` | runtime + setup | Environment value read by GakrCLI or related tracked code. Source: .env.example. | `replace-with-secret` | `.env.example` |
| `OPENAI_AUTH_SCHEME` | runtime + setup | Environment value read by GakrCLI or related tracked code. Source: .env.example. | `1` | `.env.example` |
| `OPENAI_BASE_URL` | runtime + setup | OpenAI-compatible API base URL, including local gateways such as Ollama or LM Studio. | `https://example.com` | `.env.example` |
| `OPENAI_MODEL` | runtime + setup | OpenAI-compatible model id. | `model-id` | `.env.example` |
| `OPENAI_ORG` | runtime | Environment value read by GakrCLI or related tracked code. Source: src/components/ProviderManager.tsx. | `1` | `src/components/ProviderManager.tsx` |
| `OPENAI_ORGANIZATION` | runtime | Environment value read by GakrCLI or related tracked code. Source: src/components/ProviderManager.tsx. | `1` | `src/components/ProviderManager.tsx` |
| `OPENAI_PROJECT` | runtime | Environment value read by GakrCLI or related tracked code. Source: src/components/ProviderManager.tsx. | `1` | `src/components/ProviderManager.tsx` |
| `VENICE_API_KEY` | runtime | API key for VENICE integration/provider. Source: src/services/api/client.test.ts. | `replace-with-secret` | `src/services/api/client.test.ts` |
| `XAI_API_KEY` | runtime | API key for XAI integration/provider. Source: src/services/api/client.test.ts. | `replace-with-secret` | `src/services/api/client.test.ts` |
| `XAI_CREDENTIAL_SOURCE` | runtime | Environment value read by GakrCLI or related tracked code. Source: src/services/api/errors.openaiCompatibility.test.ts. | `1` | `src/services/api/errors.openaiCompatibility.test.ts` |

### Web search and fetch

| Variable | Scope | Purpose | Example | Source |
| --- | --- | --- | --- | --- |
| `BING_API_KEY` | runtime + setup | API key for BING integration/provider. Source: .env.example. | `replace-with-secret` | `.env.example` |
| `BRAVE_API_KEY` | runtime + setup | API key for BRAVE integration/provider. Source: .env.example. | `replace-with-secret` | `.env.example` |
| `EXA_API_KEY` | runtime + setup | API key for EXA integration/provider. Source: .env.example. | `replace-with-secret` | `.env.example` |
| `FIRECRAWL_API_KEY` | runtime + setup | API key for FIRECRAWL integration/provider. Source: .env.example. | `replace-with-secret` | `.env.example` |
| `FIRECRAWL_API_URL` | runtime + setup | URL/base endpoint override for the related service. Source: .env.example. | `https://example.com` | `.env.example` |
| `GOOGLE_CSE_ID` | setup template | Environment value read by GakrCLI or related tracked code. Source: .env.example. | `1` | `.env.example` |
| `JINA_API_KEY` | runtime + setup | API key for JINA integration/provider. Source: .env.example. | `replace-with-secret` | `.env.example` |
| `LINKUP_API_KEY` | runtime + setup | API key for LINKUP integration/provider. Source: .env.example. | `replace-with-secret` | `.env.example` |
| `MOJEEK_API_KEY` | runtime + setup | API key for MOJEEK integration/provider. Source: .env.example. | `replace-with-secret` | `.env.example` |
| `TAVILY_API_KEY` | runtime + setup | API key for TAVILY integration/provider. Source: .env.example. | `replace-with-secret` | `.env.example` |
| `WEB_AUTH_HEADER` | runtime | Environment value read by GakrCLI or related tracked code. Source: src/tools/WebSearchTool/providers/custom.test.ts. | `1` | `src/tools/WebSearchTool/providers/custom.test.ts` |
| `WEB_AUTH_SCHEME` | runtime | Environment value read by GakrCLI or related tracked code. Source: src/tools/WebSearchTool/providers/custom.test.ts. | `1` | `src/tools/WebSearchTool/providers/custom.test.ts` |
| `WEB_BODY_TEMPLATE` | runtime | Environment value read by GakrCLI or related tracked code. Source: src/tools/WebSearchTool/providers/custom.ts. | `1` | `src/tools/WebSearchTool/providers/custom.ts` |
| `WEB_CUSTOM_ALLOW_ARBITRARY_HEADERS` | runtime + setup | Environment value read by GakrCLI or related tracked code. Source: .env.example. | `1` | `.env.example` |
| `WEB_CUSTOM_ALLOW_HTTP` | runtime + setup | Environment value read by GakrCLI or related tracked code. Source: .env.example. | `1` | `.env.example` |
| `WEB_CUSTOM_ALLOW_PRIVATE` | runtime + setup | Environment value read by GakrCLI or related tracked code. Source: .env.example. | `1` | `.env.example` |
| `WEB_CUSTOM_MAX_BODY_KB` | runtime + setup | Environment value read by GakrCLI or related tracked code. Source: .env.example. | `128000` | `.env.example` |
| `WEB_CUSTOM_TIMEOUT_SEC` | runtime + setup | Environment value read by GakrCLI or related tracked code. Source: .env.example. | `60000` | `.env.example` |
| `WEB_HEADERS` | runtime | Environment value read by GakrCLI or related tracked code. Source: src/tools/WebSearchTool/providers/custom.ts. | `1` | `src/tools/WebSearchTool/providers/custom.ts` |
| `WEB_JSON_PATH` | runtime | Environment value read by GakrCLI or related tracked code. Source: src/tools/WebSearchTool/providers/custom.ts. | `C:\\path\\to\\value` | `src/tools/WebSearchTool/providers/custom.ts` |
| `WEB_KEY` | runtime + setup | Environment value read by GakrCLI or related tracked code. Source: .env.example. | `replace-with-secret` | `.env.example` |
| `WEB_METHOD` | runtime | Environment value read by GakrCLI or related tracked code. Source: src/tools/WebSearchTool/providers/custom.ts. | `1` | `src/tools/WebSearchTool/providers/custom.ts` |
| `WEB_PARAMS` | runtime | Environment value read by GakrCLI or related tracked code. Source: src/tools/WebSearchTool/providers/custom.ts. | `60000` | `src/tools/WebSearchTool/providers/custom.ts` |
| `WEB_PROVIDER` | runtime + setup | Environment value read by GakrCLI or related tracked code. Source: .env.example. | `1` | `.env.example` |
| `WEB_QUERY_PARAM` | runtime | Environment value read by GakrCLI or related tracked code. Source: src/tools/WebSearchTool/providers/custom.ts. | `1` | `src/tools/WebSearchTool/providers/custom.ts` |
| `WEB_SEARCH_API` | runtime | Environment value read by GakrCLI or related tracked code. Source: src/tools/WebSearchTool/providers/custom.test.ts. | `1` | `src/tools/WebSearchTool/providers/custom.test.ts` |
| `WEB_SEARCH_PROVIDER` | runtime + setup | Select web-search provider or auto fallback mode. | `1` | `.env.example` |
| `WEB_URL_TEMPLATE` | runtime | Environment value read by GakrCLI or related tracked code. Source: src/tools/WebSearchTool/providers/custom.test.ts. | `https://example.com` | `src/tools/WebSearchTool/providers/custom.test.ts` |
| `YOU_API_KEY` | runtime + setup | API key for YOU integration/provider. Source: .env.example. | `replace-with-secret` | `.env.example` |

### MCP and integrations

| Variable | Scope | Purpose | Example | Source |
| --- | --- | --- | --- | --- |
| `ENABLE_gakrcliAI_MCP_SERVERS` | runtime | Enable this experimental or optional GakrCLI feature. Source: src/services/mcp/gakrcliai.ts. | `1` | `src/services/mcp/gakrcliai.ts` |
| `ENABLE_MCP_LARGE_OUTPUT_FILES` | runtime | Enable this experimental or optional GakrCLI feature. Source: src/services/mcp/client.ts. | `C:\\path\\to\\value` | `src/services/mcp/client.ts` |
| `GAKR_AGENT_SDK_MCP_NO_PREFIX` | runtime | GakrCLI runtime, debug, profile, or workspace setting. Source: src/services/mcp/client.ts. | `1` | `src/services/mcp/client.ts` |
| `MAX_MCP_OUTPUT_TOKENS` | runtime | Environment value read by GakrCLI or related tracked code. Source: src/utils/mcpValidation.ts. | `128000` | `src/utils/mcpValidation.ts` |
| `MCP_CLIENT_SECRET` | runtime | Secret value used by the related integration or example. Source: src/services/mcp/auth.ts. | `replace-with-secret` | `src/services/mcp/auth.ts` |
| `MCP_OAUTH_CALLBACK_PORT` | runtime | Environment value read by GakrCLI or related tracked code. Source: src/services/mcp/oauthPort.ts. | `50051` | `src/services/mcp/oauthPort.ts` |
| `MCP_OAUTH_CLIENT_METADATA_URL` | runtime | URL/base endpoint override for the related service. Source: src/services/mcp/auth.ts. | `https://example.com` | `src/services/mcp/auth.ts` |
| `MCP_REMOTE_SERVER_CONNECTION_BATCH_SIZE` | runtime | Environment value read by GakrCLI or related tracked code. Source: src/services/mcp/client.ts. | `128000` | `src/services/mcp/client.ts` |
| `MCP_SERVER_CONNECTION_BATCH_SIZE` | runtime | Environment value read by GakrCLI or related tracked code. Source: src/services/mcp/client.ts. | `128000` | `src/services/mcp/client.ts` |
| `MCP_TIMEOUT` | runtime | Environment value read by GakrCLI or related tracked code. Source: src/services/mcp/client.ts. | `60000` | `src/services/mcp/client.ts` |
| `MCP_TOOL_TIMEOUT` | runtime | Environment value read by GakrCLI or related tracked code. Source: src/services/mcp/client.ts. | `60000` | `src/services/mcp/client.ts` |
| `MCP_XAA_IDP_CLIENT_SECRET` | runtime | Secret value used by the related integration or example. Source: src/commands/mcp/xaaIdpCommand.ts. | `replace-with-secret` | `src/commands/mcp/xaaIdpCommand.ts` |
| `TEAM_MEMORY_SYNC_URL` | runtime | URL/base endpoint override for the related service. Source: src/services/teamMemorySync/index.ts. | `https://example.com` | `src/services/teamMemorySync/index.ts` |

### GakrCLI runtime toggles

| Variable | Scope | Purpose | Example | Source |
| --- | --- | --- | --- | --- |
| `API_MAX_INPUT_TOKENS` | runtime | Environment value read by GakrCLI or related tracked code. Source: src/services/compact/apiMicrocompact.ts. | `128000` | `src/services/compact/apiMicrocompact.ts` |
| `API_TARGET_INPUT_TOKENS` | runtime | Environment value read by GakrCLI or related tracked code. Source: src/services/compact/apiMicrocompact.ts. | `128000` | `src/services/compact/apiMicrocompact.ts` |
| `API_TIMEOUT_MS` | runtime + setup | Environment value read by GakrCLI or related tracked code. Source: .env.example. | `60000` | `.env.example` |
| `BASH_MAX_OUTPUT_LENGTH` | runtime | Environment value read by GakrCLI or related tracked code. Source: src/utils/shell/outputLimits.ts. | `128000` | `src/utils/shell/outputLimits.ts` |
| `BUGHUNTER_DEV_BUNDLE_B64` | runtime | Environment value read by GakrCLI or related tracked code. Source: src/commands/review/reviewRemote.ts. | `1` | `src/commands/review/reviewRemote.ts` |
| `COREPACK_ENABLE_AUTO_PIN` | runtime | Environment value read by GakrCLI or related tracked code. Source: src/entrypoints/cli.tsx. | `1` | `src/entrypoints/cli.tsx` |
| `DISABLE_AUTO_COMPACT` | runtime | Disable this GakrCLI feature, command, or API behavior. Source: src/services/compact/autoCompact.ts. | `1` | `src/services/compact/autoCompact.ts` |
| `DISABLE_AUTOUPDATER` | runtime | Disable this GakrCLI feature, command, or API behavior. Source: src/migrations/migrateAutoUpdatesToSettings.ts. | `1` | `src/migrations/migrateAutoUpdatesToSettings.ts` |
| `DISABLE_BUG_COMMAND` | runtime | Disable this GakrCLI feature, command, or API behavior. Source: src/commands/feedback/index.ts. | `1` | `src/commands/feedback/index.ts` |
| `DISABLE_COMPACT` | runtime | Disable this GakrCLI feature, command, or API behavior. Source: src/commands/compact/index.ts. | `1` | `src/commands/compact/index.ts` |
| `DISABLE_COST_WARNINGS` | runtime | Disable this GakrCLI feature, command, or API behavior. Source: src/utils/billing.ts. | `1` | `src/utils/billing.ts` |
| `DISABLE_DOCTOR_COMMAND` | runtime | Disable this GakrCLI feature, command, or API behavior. Source: src/commands/doctor/index.ts. | `1` | `src/commands/doctor/index.ts` |
| `DISABLE_ERROR_REPORTING` | runtime | Disable this GakrCLI feature, command, or API behavior. Source: src/utils/log.ts. | `1` | `src/utils/log.ts` |
| `DISABLE_EXTRA_USAGE_COMMAND` | runtime | Disable this GakrCLI feature, command, or API behavior. Source: src/commands/extra-usage/index.ts. | `1` | `src/commands/extra-usage/index.ts` |
| `DISABLE_FEEDBACK_COMMAND` | runtime | Disable this GakrCLI feature, command, or API behavior. Source: src/commands/feedback/index.ts. | `1` | `src/commands/feedback/index.ts` |
| `DISABLE_GAKR_CODE_SM_COMPACT` | runtime | Disable this GakrCLI feature, command, or API behavior. Source: src/services/compact/sessionMemoryCompact.ts. | `1` | `src/services/compact/sessionMemoryCompact.ts` |
| `DISABLE_INSTALL_GITHUB_APP_COMMAND` | runtime | Disable this GakrCLI feature, command, or API behavior. Source: src/commands/install-github-app/index.ts. | `1` | `src/commands/install-github-app/index.ts` |
| `DISABLE_INSTALLATION_CHECKS` | runtime | Disable this GakrCLI feature, command, or API behavior. Source: src/hooks/notifs/useNpmDeprecationNotification.tsx. | `1` | `src/hooks/notifs/useNpmDeprecationNotification.tsx` |
| `DISABLE_INTERLEAVED_THINKING` | runtime | Disable this GakrCLI feature, command, or API behavior. Source: src/utils/betas.ts. | `1` | `src/utils/betas.ts` |
| `DISABLE_LOGIN_COMMAND` | runtime | Disable this GakrCLI feature, command, or API behavior. Source: src/commands/login/index.ts. | `1` | `src/commands/login/index.ts` |
| `DISABLE_LOGOUT_COMMAND` | runtime | Disable this GakrCLI feature, command, or API behavior. Source: src/commands/logout/index.ts. | `1` | `src/commands/logout/index.ts` |
| `DISABLE_PROMPT_CACHING` | runtime | Disable this GakrCLI feature, command, or API behavior. Source: src/services/api/gakrcli.promptCaching.test.ts. | `1` | `src/services/api/gakrcli.promptCaching.test.ts` |
| `DISABLE_PROMPT_CACHING_HAIKU` | runtime | Disable this GakrCLI feature, command, or API behavior. Source: src/services/api/gakrcli.ts. | `1` | `src/services/api/gakrcli.ts` |
| `DISABLE_PROMPT_CACHING_OPUS` | runtime | Disable this GakrCLI feature, command, or API behavior. Source: src/services/api/gakrcli.ts. | `1` | `src/services/api/gakrcli.ts` |
| `DISABLE_PROMPT_CACHING_SONNET` | runtime | Disable this GakrCLI feature, command, or API behavior. Source: src/services/api/gakrcli.ts. | `1` | `src/services/api/gakrcli.ts` |
| `DISABLE_TELEMETRY` | runtime | Disable this GakrCLI feature, command, or API behavior. Source: src/utils/privacyLevel.ts. | `1` | `src/utils/privacyLevel.ts` |
| `DISABLE_UPGRADE_COMMAND` | runtime | Disable this GakrCLI feature, command, or API behavior. Source: src/commands/upgrade/index.ts. | `1` | `src/commands/upgrade/index.ts` |
| `EMBEDDED_SEARCH_TOOLS` | runtime | Environment value read by GakrCLI or related tracked code. Source: src/utils/embeddedTools.ts. | `128000` | `src/utils/embeddedTools.ts` |
| `ENABLE_BETA_TRACING_DETAILED` | runtime | Enable this experimental or optional GakrCLI feature. Source: src/utils/telemetry/betaSessionTracing.ts. | `1` | `src/utils/telemetry/betaSessionTracing.ts` |
| `ENABLE_ENHANCED_TELEMETRY_BETA` | runtime | Enable this experimental or optional GakrCLI feature. Source: src/utils/telemetry/sessionTracing.ts. | `1` | `src/utils/telemetry/sessionTracing.ts` |
| `ENABLE_GAKR_CODE_SM_COMPACT` | runtime | Enable this experimental or optional GakrCLI feature. Source: src/services/compact/sessionMemoryCompact.ts. | `1` | `src/services/compact/sessionMemoryCompact.ts` |
| `ENABLE_LOCKLESS_UPDATES` | runtime | Enable this experimental or optional GakrCLI feature. Source: src/utils/nativeInstaller/installer.ts. | `1` | `src/utils/nativeInstaller/installer.ts` |
| `ENABLE_PID_BASED_VERSION_LOCKING` | runtime | Enable this experimental or optional GakrCLI feature. Source: src/utils/nativeInstaller/pidLock.ts. | `https://example.com` | `src/utils/nativeInstaller/pidLock.ts` |
| `ENABLE_PROMPT_CACHING_1H_BEDROCK` | runtime | Enable this experimental or optional GakrCLI feature. Source: src/services/api/gakrcli.ts. | `1` | `src/services/api/gakrcli.ts` |
| `ENABLE_SESSION_PERSISTENCE` | runtime | Enable this experimental or optional GakrCLI feature. Source: src/cli/print.ts. | `1` | `src/cli/print.ts` |
| `ENABLE_TOOL_SEARCH` | runtime | Enable this experimental or optional GakrCLI feature. Source: src/__tests__/doctorContextWarnings.test.ts. | `1` | `src/__tests__/doctorContextWarnings.test.ts` |
| `FALLBACK_FOR_ALL_PRIMARY_MODELS` | runtime | Model selection or model metadata override. Source: src/services/api/withRetry.ts. | `model-id` | `src/services/api/withRetry.ts` |
| `FORCE_AUTOUPDATE_PLUGINS` | runtime | Environment value read by GakrCLI or related tracked code. Source: src/utils/config.ts. | `1` | `src/utils/config.ts` |
| `FORCE_CODE_TERMINAL` | runtime | Environment value read by GakrCLI or related tracked code. Source: src/utils/ide.ts. | `1` | `src/utils/ide.ts` |
| `FORCE_VCR` | runtime | Environment value read by GakrCLI or related tracked code. Source: src/services/vcr.ts. | `1` | `src/services/vcr.ts` |
| `GAKR_AFTER_LAST_COMPACT` | runtime | GakrCLI runtime, debug, profile, or workspace setting. Source: src/services/api/sessionIngress.ts. | `1` | `src/services/api/sessionIngress.ts` |
| `GAKR_AGENT_SDK_CLIENT_APP` | runtime | GakrCLI runtime, debug, profile, or workspace setting. Source: src/services/api/client.ts. | `1` | `src/services/api/client.ts` |
| `GAKR_AGENT_SDK_DISABLE_BUILTIN_AGENTS` | runtime | GakrCLI runtime, debug, profile, or workspace setting. Source: src/tools/AgentTool/builtInAgents.ts. | `1` | `src/tools/AgentTool/builtInAgents.ts` |
| `GAKR_AGENT_SDK_VERSION` | runtime | GakrCLI runtime, debug, profile, or workspace setting. Source: src/services/analytics/metadata.ts. | `1` | `src/services/analytics/metadata.ts` |
| `GAKR_AUTO_BACKGROUND_TASKS` | runtime | GakrCLI runtime, debug, profile, or workspace setting. Source: src/tools/AgentTool/AgentTool.tsx. | `1` | `src/tools/AgentTool/AgentTool.tsx` |
| `GAKR_AUTOCOMPACT_FAILURE_COOLDOWN_MS` | runtime | GakrCLI runtime, debug, profile, or workspace setting. Source: src/services/compact/autoCompact.ts. | `60000` | `src/services/compact/autoCompact.ts` |
| `GAKR_AUTOCOMPACT_PCT_OVERRIDE` | runtime | GakrCLI runtime, debug, profile, or workspace setting. Source: src/query/autoCompactCooldown.test.ts. | `128000` | `src/query/autoCompactCooldown.test.ts` |
| `GAKR_BASH_MAINTAIN_PROJECT_WORKING_DIR` | runtime | GakrCLI runtime, debug, profile, or workspace setting. Source: src/utils/envUtils.ts. | `C:\\path\\to\\value` | `src/utils/envUtils.ts` |
| `GAKR_CHROME_PERMISSION_MODE` | runtime | GakrCLI runtime, debug, profile, or workspace setting. Source: src/utils/gakrcliInChrome/mcpServer.ts. | `1` | `src/utils/gakrcliInChrome/mcpServer.ts` |
| `GAKR_CODE_ABLATION_BASELINE` | runtime | GakrCLI runtime setting or host/session metadata. Source: src/entrypoints/cli.tsx. | `https://example.com` | `src/entrypoints/cli.tsx` |
| `GAKR_CODE_ACCESSIBILITY` | runtime | GakrCLI runtime setting or host/session metadata. Source: src/components/TextInput.tsx. | `1` | `src/components/TextInput.tsx` |
| `GAKR_CODE_ACCOUNT_TAGGED_ID` | runtime | GakrCLI runtime setting or host/session metadata. Source: src/utils/telemetryAttributes.ts. | `128000` | `src/utils/telemetryAttributes.ts` |
| `GAKR_CODE_ACCOUNT_UUID` | runtime | GakrCLI runtime setting or host/session metadata. Source: src/services/oauth/client.ts. | `128000` | `src/services/oauth/client.ts` |
| `GAKR_CODE_ACTION` | runtime | GakrCLI runtime setting or host/session metadata. Source: src/main.tsx. | `1` | `src/main.tsx` |
| `GAKR_CODE_ADDITIONAL_DIRECTORIES_GAKRCLI_MD` | runtime | GakrCLI runtime setting or host/session metadata. Source: src/utils/gakrclimd.ts. | `C:\\path\\to\\value` | `src/utils/gakrclimd.ts` |
| `GAKR_CODE_ADDITIONAL_PROTECTION` | runtime | GakrCLI runtime setting or host/session metadata. Source: src/services/api/client.ts. | `1` | `src/services/api/client.ts` |
| `GAKR_CODE_AGENT` | runtime | GakrCLI runtime setting or host/session metadata. Source: src/main.tsx. | `1` | `src/main.tsx` |
| `GAKR_CODE_AGENT_LIST_IN_MESSAGES` | runtime | GakrCLI runtime setting or host/session metadata. Source: src/tools/AgentTool/prompt.ts. | `1` | `src/tools/AgentTool/prompt.ts` |
| `GAKR_CODE_ALWAYS_ENABLE_EFFORT` | runtime | GakrCLI runtime setting or host/session metadata. Source: src/utils/effort.ts. | `1` | `src/utils/effort.ts` |
| `GAKR_CODE_API_BASE_URL` | runtime | URL/base endpoint override for the related service. Source: src/services/api/filesApi.ts. | `https://example.com` | `src/services/api/filesApi.ts` |
| `GAKR_CODE_API_KEY_FILE_DESCRIPTOR` | runtime | GakrCLI runtime setting or host/session metadata. Source: src/utils/auth.ts. | `C:\\path\\to\\value` | `src/utils/auth.ts` |
| `GAKR_CODE_API_KEY_HELPER_TTL_MS` | runtime | GakrCLI runtime setting or host/session metadata. Source: src/utils/auth.ts. | `60000` | `src/utils/auth.ts` |
| `GAKR_CODE_ATTRIBUTION_HEADER` | runtime | GakrCLI runtime setting or host/session metadata. Source: src/constants/system.ts. | `1` | `src/constants/system.ts` |
| `GAKR_CODE_AUTO_COMPACT_WINDOW` | runtime | GakrCLI runtime setting or host/session metadata. Source: src/services/compact/autoCompact.ts. | `1` | `src/services/compact/autoCompact.ts` |
| `GAKR_CODE_AUTO_CONNECT_IDE` | runtime | GakrCLI runtime setting or host/session metadata. Source: src/hooks/useIDEIntegration.tsx. | `1` | `src/hooks/useIDEIntegration.tsx` |
| `GAKR_CODE_AUTO_MODE_MODEL` | runtime | Model selection or model metadata override. Source: src/utils/permissions/yoloClassifier.ts. | `model-id` | `src/utils/permissions/yoloClassifier.ts` |
| `GAKR_CODE_BASE_REF` | runtime | GakrCLI runtime setting or host/session metadata. Source: src/utils/gitDiff.ts. | `https://example.com` | `src/utils/gitDiff.ts` |
| `GAKR_CODE_BASH_SANDBOX_SHOW_INDICATOR` | runtime | GakrCLI runtime setting or host/session metadata. Source: src/tools/BashTool/BashTool.tsx. | `1` | `src/tools/BashTool/BashTool.tsx` |
| `GAKR_CODE_BLOCKING_LIMIT_OVERRIDE` | runtime | GakrCLI runtime setting or host/session metadata. Source: src/services/compact/autoCompact.ts. | `128000` | `src/services/compact/autoCompact.ts` |
| `GAKR_CODE_BRIEF` | runtime | GakrCLI runtime setting or host/session metadata. Source: src/components/messages/UserPromptMessage.tsx. | `1` | `src/components/messages/UserPromptMessage.tsx` |
| `GAKR_CODE_BRIEF_UPLOAD` | runtime | GakrCLI runtime setting or host/session metadata. Source: src/tools/BriefTool/attachments.ts. | `1` | `src/tools/BriefTool/attachments.ts` |
| `GAKR_CODE_BUBBLEWRAP` | runtime | GakrCLI runtime setting or host/session metadata. Source: src/setup.ts. | `1` | `src/setup.ts` |
| `GAKR_CODE_CLIENT_CERT` | runtime | GakrCLI runtime setting or host/session metadata. Source: src/main.tsx. | `1` | `src/main.tsx` |
| `GAKR_CODE_CLIENT_KEY` | runtime | GakrCLI runtime setting or host/session metadata. Source: src/utils/apiPreconnect.test.ts. | `replace-with-secret` | `src/utils/apiPreconnect.test.ts` |
| `GAKR_CODE_CLIENT_KEY_PASSPHRASE` | runtime | Secret value used by the related integration or example. Source: src/utils/mtls.ts. | `replace-with-secret` | `src/utils/mtls.ts` |
| `GAKR_CODE_COMMIT_LOG` | runtime | GakrCLI runtime setting or host/session metadata. Source: src/ink/reconciler.ts. | `1` | `src/ink/reconciler.ts` |
| `GAKR_CODE_CONTAINER_ID` | runtime | GakrCLI runtime setting or host/session metadata. Source: src/services/analytics/metadata.ts. | `1` | `src/services/analytics/metadata.ts` |
| `GAKR_CODE_COORDINATOR_MODE` | runtime | GakrCLI runtime setting or host/session metadata. Source: src/coordinator/coordinatorMode.test.ts. | `1` | `src/coordinator/coordinatorMode.test.ts` |
| `GAKR_CODE_COWORKER_TYPE` | runtime | GakrCLI runtime setting or host/session metadata. Source: src/services/analytics/metadata.ts. | `1` | `src/services/analytics/metadata.ts` |
| `GAKR_CODE_CUSTOM_OAUTH_URL` | runtime | URL/base endpoint override for the related service. Source: src/constants/oauth.ts. | `https://example.com` | `src/constants/oauth.ts` |
| `GAKR_CODE_DATADOG_FLUSH_INTERVAL_MS` | runtime | GakrCLI runtime setting or host/session metadata. Source: src/services/analytics/datadog.ts. | `60000` | `src/services/analytics/datadog.ts` |
| `GAKR_CODE_DEBUG_LOG_LEVEL` | runtime | GakrCLI runtime setting or host/session metadata. Source: src/utils/debug.ts. | `1` | `src/utils/debug.ts` |
| `GAKR_CODE_DEBUG_LOGS_DIR` | runtime | GakrCLI runtime setting or host/session metadata. Source: src/utils/debug.ts. | `C:\\path\\to\\value` | `src/utils/debug.ts` |
| `GAKR_CODE_DEBUG_REPAINTS` | runtime | GakrCLI runtime setting or host/session metadata. Source: src/ink/reconciler.ts. | `1` | `src/ink/reconciler.ts` |
| `GAKR_CODE_DIAGNOSTICS_FILE` | runtime | GakrCLI runtime setting or host/session metadata. Source: src/utils/diagLogs.ts. | `C:\\path\\to\\value` | `src/utils/diagLogs.ts` |
| `GAKR_CODE_DISABLE_1M_CONTEXT` | runtime | Disable this GakrCLI feature, command, or API behavior. Source: src/utils/context.ts. | `1` | `src/utils/context.ts` |
| `GAKR_CODE_DISABLE_ADAPTIVE_THINKING` | runtime | Disable this GakrCLI feature, command, or API behavior. Source: src/services/api/gakrcli.ts. | `1` | `src/services/api/gakrcli.ts` |
| `GAKR_CODE_DISABLE_ADVISOR_TOOL` | runtime | Disable this GakrCLI feature, command, or API behavior. Source: src/utils/advisor.ts. | `1` | `src/utils/advisor.ts` |
| `GAKR_CODE_DISABLE_ATTACHMENTS` | runtime | Disable this GakrCLI feature, command, or API behavior. Source: src/utils/attachments.ts. | `1` | `src/utils/attachments.ts` |
| `GAKR_CODE_DISABLE_AUTO_MEMORY` | runtime | Disable this GakrCLI feature, command, or API behavior. Source: src/memdir/memdir.ts. | `1` | `src/memdir/memdir.ts` |
| `GAKR_CODE_DISABLE_BACKGROUND_TASKS` | runtime | Disable this GakrCLI feature, command, or API behavior. Source: src/components/SessionBackgroundHint.tsx. | `1` | `src/components/SessionBackgroundHint.tsx` |
| `GAKR_CODE_DISABLE_COMMAND_INJECTION_CHECK` | runtime | Disable this GakrCLI feature, command, or API behavior. Source: src/tools/BashTool/bashPermissions.test.ts. | `1` | `src/tools/BashTool/bashPermissions.test.ts` |
| `GAKR_CODE_DISABLE_CRON` | runtime | Disable this GakrCLI feature, command, or API behavior. Source: src/tools/ScheduleCronTool/prompt.ts. | `1` | `src/tools/ScheduleCronTool/prompt.ts` |
| `GAKR_CODE_DISABLE_EXPERIMENTAL_BETAS` | runtime | Disable this GakrCLI feature, command, or API behavior. Source: src/entrypoints/cli.tsx. | `1` | `src/entrypoints/cli.tsx` |
| `GAKR_CODE_DISABLE_FAST_MODE` | runtime | Disable this GakrCLI feature, command, or API behavior. Source: src/query/config.ts. | `1` | `src/query/config.ts` |
| `GAKR_CODE_DISABLE_FEEDBACK_SURVEY` | runtime | Disable this GakrCLI feature, command, or API behavior. Source: src/components/FeedbackSurvey/useFeedbackSurvey.tsx. | `1` | `src/components/FeedbackSurvey/useFeedbackSurvey.tsx` |
| `GAKR_CODE_DISABLE_FILE_CHECKPOINTING` | runtime | Disable this GakrCLI feature, command, or API behavior. Source: src/components/Settings/Config.tsx. | `C:\\path\\to\\value` | `src/components/Settings/Config.tsx` |
| `GAKR_CODE_DISABLE_GAKR_MDS` | runtime | Disable this GakrCLI feature, command, or API behavior. Source: src/context.ts. | `1` | `src/context.ts` |
| `GAKR_CODE_DISABLE_GIT_INSTRUCTIONS` | runtime | Disable this GakrCLI feature, command, or API behavior. Source: src/utils/gitSettings.ts. | `1` | `src/utils/gitSettings.ts` |
| `GAKR_CODE_DISABLE_LEGACY_MODEL_REMAP` | runtime | Model selection or model metadata override. Source: src/utils/model/model.ts. | `model-id` | `src/utils/model/model.ts` |
| `GAKR_CODE_DISABLE_MESSAGE_ACTIONS` | runtime | Disable this GakrCLI feature, command, or API behavior. Source: src/screens/REPL.tsx. | `1` | `src/screens/REPL.tsx` |
| `GAKR_CODE_DISABLE_MOUSE` | runtime | Disable this GakrCLI feature, command, or API behavior. Source: src/utils/fullscreen.ts. | `1` | `src/utils/fullscreen.ts` |
| `GAKR_CODE_DISABLE_MOUSE_CLICKS` | runtime | Disable this GakrCLI feature, command, or API behavior. Source: src/utils/fullscreen.ts. | `1` | `src/utils/fullscreen.ts` |
| `GAKR_CODE_DISABLE_NONESSENTIAL_TRAFFIC` | runtime | Disable this GakrCLI feature, command, or API behavior. Source: src/commands/model/model.test.tsx. | `1` | `src/commands/model/model.test.tsx` |
| `GAKR_CODE_DISABLE_NONSTREAMING_FALLBACK` | runtime | Disable this GakrCLI feature, command, or API behavior. Source: src/services/api/gakrcli.ts. | `1` | `src/services/api/gakrcli.ts` |
| `GAKR_CODE_DISABLE_OFFICIAL_MARKETPLACE_AUTOINSTALL` | runtime | Disable this GakrCLI feature, command, or API behavior. Source: src/utils/plugins/officialMarketplaceStartupCheck.ts. | `1` | `src/utils/plugins/officialMarketplaceStartupCheck.ts` |
| `GAKR_CODE_DISABLE_POLICY_SKILLS` | runtime | Disable this GakrCLI feature, command, or API behavior. Source: src/skills/loadSkillsDir.ts. | `1` | `src/skills/loadSkillsDir.ts` |
| `GAKR_CODE_DISABLE_PRECOMPACT_SKIP` | runtime | Disable this GakrCLI feature, command, or API behavior. Source: src/utils/sessionStorage.ts. | `1` | `src/utils/sessionStorage.ts` |
| `GAKR_CODE_DISABLE_TERMINAL_TITLE` | runtime | Disable this GakrCLI feature, command, or API behavior. Source: src/main.tsx. | `1` | `src/main.tsx` |
| `GAKR_CODE_DISABLE_THINKING` | runtime | Disable this GakrCLI feature, command, or API behavior. Source: src/services/api/gakrcli.ts. | `1` | `src/services/api/gakrcli.ts` |
| `GAKR_CODE_DISABLE_VIRTUAL_SCROLL` | runtime | Disable this GakrCLI feature, command, or API behavior. Source: src/components/Messages.tsx. | `1` | `src/components/Messages.tsx` |
| `GAKR_CODE_DONT_INHERIT_ENV` | runtime | GakrCLI runtime setting or host/session metadata. Source: src/utils/bash/ShellSnapshot.ts. | `1` | `src/utils/bash/ShellSnapshot.ts` |
| `GAKR_CODE_DUMP_AUTO_MODE` | runtime | GakrCLI runtime setting or host/session metadata. Source: src/utils/permissions/yoloClassifier.ts. | `1` | `src/utils/permissions/yoloClassifier.ts` |
| `GAKR_CODE_EAGER_FLUSH` | runtime | GakrCLI runtime setting or host/session metadata. Source: src/QueryEngine.ts. | `1` | `src/QueryEngine.ts` |
| `GAKR_CODE_EFFORT_LEVEL` | runtime | GakrCLI runtime setting or host/session metadata. Source: src/commands/effort/effort.tsx. | `1` | `src/commands/effort/effort.tsx` |
| `GAKR_CODE_EMIT_SESSION_STATE_EVENTS` | runtime | GakrCLI runtime setting or host/session metadata. Source: src/utils/sessionState.ts. | `1` | `src/utils/sessionState.ts` |
| `GAKR_CODE_EMIT_TOOL_USE_SUMMARIES` | runtime | GakrCLI runtime setting or host/session metadata. Source: src/query/config.ts. | `1` | `src/query/config.ts` |
| `GAKR_CODE_ENABLE_CFC` | runtime | Enable this experimental or optional GakrCLI feature. Source: src/utils/gakrcliInChrome/setup.ts. | `1` | `src/utils/gakrcliInChrome/setup.ts` |
| `GAKR_CODE_ENABLE_FINE_GRAINED_TOOL_STREAMING` | runtime | Enable this experimental or optional GakrCLI feature. Source: src/utils/api.ts. | `1` | `src/utils/api.ts` |
| `GAKR_CODE_ENABLE_PROMPT_SUGGESTION` | runtime | Enable this experimental or optional GakrCLI feature. Source: src/cli/print.ts. | `1` | `src/cli/print.ts` |
| `GAKR_CODE_ENABLE_SDK_FILE_CHECKPOINTING` | runtime | Enable this experimental or optional GakrCLI feature. Source: src/utils/fileHistory.ts. | `C:\\path\\to\\value` | `src/utils/fileHistory.ts` |
| `GAKR_CODE_ENABLE_TASKS` | runtime | Enable this experimental or optional GakrCLI feature. Source: src/utils/tasks.ts. | `1` | `src/utils/tasks.ts` |
| `GAKR_CODE_ENABLE_TELEMETRY` | runtime | Enable this experimental or optional GakrCLI feature. Source: src/utils/telemetry/instrumentation.ts. | `1` | `src/utils/telemetry/instrumentation.ts` |
| `GAKR_CODE_ENABLE_TOKEN_USAGE_ATTACHMENT` | runtime | Enable this experimental or optional GakrCLI feature. Source: src/utils/attachments.ts. | `1` | `src/utils/attachments.ts` |
| `GAKR_CODE_ENABLE_XAA` | runtime | Enable this experimental or optional GakrCLI feature. Source: src/services/mcp/xaaIdpLogin.ts. | `1` | `src/services/mcp/xaaIdpLogin.ts` |
| `GAKR_CODE_ENHANCED_TELEMETRY_BETA` | runtime | GakrCLI runtime setting or host/session metadata. Source: src/utils/telemetry/sessionTracing.ts. | `1` | `src/utils/telemetry/sessionTracing.ts` |
| `GAKR_CODE_ENTRYPOINT` | runtime | GakrCLI runtime setting or host/session metadata. Source: src/components/mcp/MCPRemoteServerMenu.tsx. | `1` | `src/components/mcp/MCPRemoteServerMenu.tsx` |
| `GAKR_CODE_ENVIRONMENT_KIND` | runtime | GakrCLI runtime setting or host/session metadata. Source: src/cli/remoteIO.ts. | `1` | `src/cli/remoteIO.ts` |
| `GAKR_CODE_ENVIRONMENT_RUNNER_VERSION` | runtime | GakrCLI runtime setting or host/session metadata. Source: src/cli/remoteIO.ts. | `1` | `src/cli/remoteIO.ts` |
| `GAKR_CODE_EXIT_AFTER_FIRST_RENDER` | runtime | GakrCLI runtime setting or host/session metadata. Source: src/cli/print.ts. | `1` | `src/cli/print.ts` |
| `GAKR_CODE_EXIT_AFTER_STOP_DELAY` | runtime | GakrCLI runtime setting or host/session metadata. Source: src/utils/idleTimeout.ts. | `60000` | `src/utils/idleTimeout.ts` |
| `GAKR_CODE_EXPERIMENTAL_AGENT_TEAMS` | runtime | GakrCLI runtime setting or host/session metadata. Source: src/tools/AgentTool/AgentTool.teammateModel.test.ts. | `60000` | `src/tools/AgentTool/AgentTool.teammateModel.test.ts` |
| `GAKR_CODE_EXTRA_BODY` | runtime | GakrCLI runtime setting or host/session metadata. Source: src/services/api/gakrcli.ts. | `1` | `src/services/api/gakrcli.ts` |
| `GAKR_CODE_EXTRA_METADATA` | runtime | GakrCLI runtime setting or host/session metadata. Source: src/services/api/gakrcli.ts. | `1` | `src/services/api/gakrcli.ts` |
| `GAKR_CODE_FILE_READ_MAX_OUTPUT_TOKENS` | runtime | GakrCLI runtime setting or host/session metadata. Source: src/tools/FileReadTool/limits.ts. | `128000` | `src/tools/FileReadTool/limits.ts` |
| `GAKR_CODE_FORCE_FULL_LOGO` | runtime | GakrCLI runtime setting or host/session metadata. Source: src/components/LogoV2/LogoV2.tsx. | `1` | `src/components/LogoV2/LogoV2.tsx` |
| `GAKR_CODE_FRAME_TIMING_LOG` | runtime | GakrCLI runtime setting or host/session metadata. Source: src/interactiveHelpers.tsx. | `1` | `src/interactiveHelpers.tsx` |
| `GAKR_CODE_GB_BASE_URL` | runtime | URL/base endpoint override for the related service. Source: src/services/analytics/growthbook.ts. | `https://example.com` | `src/services/analytics/growthbook.ts` |
| `GAKR_CODE_GIT_BASH_PATH` | runtime | GakrCLI runtime setting or host/session metadata. Source: src/utils/windowsPaths.ts. | `C:\\path\\to\\value` | `src/utils/windowsPaths.ts` |
| `GAKR_CODE_GLOB_HIDDEN` | runtime | GakrCLI runtime setting or host/session metadata. Source: src/utils/glob.ts. | `1` | `src/utils/glob.ts` |
| `GAKR_CODE_GLOB_NO_IGNORE` | runtime | GakrCLI runtime setting or host/session metadata. Source: src/utils/glob.ts. | `1` | `src/utils/glob.ts` |
| `GAKR_CODE_GLOB_TIMEOUT_SECONDS` | runtime | GakrCLI runtime setting or host/session metadata. Source: src/utils/ripgrep.ts. | `60000` | `src/utils/ripgrep.ts` |
| `GAKR_CODE_HOST_PLATFORM` | runtime | GakrCLI runtime setting or host/session metadata. Source: src/services/analytics/metadata.ts. | `1` | `src/services/analytics/metadata.ts` |
| `GAKR_CODE_IDE_HOST_OVERRIDE` | runtime | GakrCLI runtime setting or host/session metadata. Source: src/utils/ide.ts. | `1` | `src/utils/ide.ts` |
| `GAKR_CODE_IDE_SKIP_AUTO_INSTALL` | runtime | GakrCLI runtime setting or host/session metadata. Source: src/utils/ide.ts. | `1` | `src/utils/ide.ts` |
| `GAKR_CODE_IDE_SKIP_VALID_CHECK` | runtime | GakrCLI runtime setting or host/session metadata. Source: src/utils/ide.ts. | `1` | `src/utils/ide.ts` |
| `GAKR_CODE_IDLE_THRESHOLD_MINUTES` | runtime | GakrCLI runtime setting or host/session metadata. Source: src/screens/REPL.tsx. | `1` | `src/screens/REPL.tsx` |
| `GAKR_CODE_IDLE_TOKEN_THRESHOLD` | runtime | GakrCLI runtime setting or host/session metadata. Source: src/screens/REPL.tsx. | `1` | `src/screens/REPL.tsx` |
| `GAKR_CODE_INCLUDE_PARTIAL_MESSAGES` | runtime | GakrCLI runtime setting or host/session metadata. Source: src/main.tsx. | `1` | `src/main.tsx` |
| `GAKR_CODE_IS_COWORK` | runtime | GakrCLI runtime setting or host/session metadata. Source: src/QueryEngine.ts. | `1` | `src/QueryEngine.ts` |
| `GAKR_CODE_JSONL_TRANSCRIPT` | runtime | GakrCLI runtime setting or host/session metadata. Source: src/utils/permissions/yoloClassifier.ts. | `1` | `src/utils/permissions/yoloClassifier.ts` |
| `GAKR_CODE_MANAGED_SETTINGS_PATH` | runtime | GakrCLI runtime setting or host/session metadata. Source: src/utils/settings/managedPath.ts. | `C:\\path\\to\\value` | `src/utils/settings/managedPath.ts` |
| `GAKR_CODE_MAX_CONTEXT_TOKENS` | runtime | GakrCLI runtime setting or host/session metadata. Source: src/utils/context.ts. | `128000` | `src/utils/context.ts` |
| `GAKR_CODE_MAX_MARKDOWN_FILE_SIZE_BYTES` | runtime | GakrCLI runtime setting or host/session metadata. Source: src/utils/markdownConfigLoader.scaling.test.ts. | `128000` | `src/utils/markdownConfigLoader.scaling.test.ts` |
| `GAKR_CODE_MAX_OUTPUT_TOKENS` | runtime | GakrCLI runtime setting or host/session metadata. Source: src/query.ts. | `128000` | `src/query.ts` |
| `GAKR_CODE_MAX_RETRIES` | runtime + setup | GakrCLI runtime setting or host/session metadata. Source: .env.example. | `1` | `.env.example` |
| `GAKR_CODE_MAX_TOOL_USE_CONCURRENCY` | runtime + setup | GakrCLI runtime setting or host/session metadata. Source: .env.example. | `128000` | `.env.example` |
| `GAKR_CODE_MCP_INSTR_DELTA` | runtime | GakrCLI runtime setting or host/session metadata. Source: src/utils/mcpInstructionsDelta.ts. | `1` | `src/utils/mcpInstructionsDelta.ts` |
| `GAKR_CODE_MESSAGING_SOCKET` | runtime | GakrCLI runtime setting or host/session metadata. Source: src/utils/concurrentSessions.ts. | `1` | `src/utils/concurrentSessions.ts` |
| `GAKR_CODE_NEW_INIT` | runtime | GakrCLI runtime setting or host/session metadata. Source: src/commands/init.test.ts. | `1` | `src/commands/init.test.ts` |
| `GAKR_CODE_NO_FLICKER` | runtime | GakrCLI runtime setting or host/session metadata. Source: src/utils/fullscreen.ts. | `1` | `src/utils/fullscreen.ts` |
| `GAKR_CODE_OAUTH_CLIENT_ID` | runtime | GakrCLI runtime setting or host/session metadata. Source: src/constants/oauth.ts. | `1` | `src/constants/oauth.ts` |
| `GAKR_CODE_OAUTH_REFRESH_TOKEN` | runtime | Token for GAKR_CODE_OAUTH_REFRESH authentication or session flow. Source: src/cli/handlers/auth.ts. | `replace-with-secret` | `src/cli/handlers/auth.ts` |
| `GAKR_CODE_OAUTH_SCOPES` | runtime | GakrCLI runtime setting or host/session metadata. Source: src/cli/handlers/auth.ts. | `1` | `src/cli/handlers/auth.ts` |
| `GAKR_CODE_OAUTH_TOKEN` | runtime | Token for GAKR_CODE_OAUTH authentication or session flow. Source: src/utils/auth.ts. | `replace-with-secret` | `src/utils/auth.ts` |
| `GAKR_CODE_OAUTH_TOKEN_FILE_DESCRIPTOR` | runtime | GakrCLI runtime setting or host/session metadata. Source: src/utils/auth.ts. | `C:\\path\\to\\value` | `src/utils/auth.ts` |
| `GAKR_CODE_OPENAI_CONTEXT_WINDOWS` | setup template | GakrCLI runtime setting or host/session metadata. Source: .env.example. | `1` | `.env.example` |
| `GAKR_CODE_OPENAI_FALLBACK_CONTEXT_WINDOW` | runtime + setup | GakrCLI runtime setting or host/session metadata. Source: .env.example. | `1` | `.env.example` |
| `GAKR_CODE_OPENAI_MAX_OUTPUT_TOKENS` | setup template | GakrCLI runtime setting or host/session metadata. Source: .env.example. | `128000` | `.env.example` |
| `GAKR_CODE_ORGANIZATION_UUID` | runtime | GakrCLI runtime setting or host/session metadata. Source: src/services/oauth/client.ts. | `1` | `src/services/oauth/client.ts` |
| `GAKR_CODE_OTEL_FLUSH_TIMEOUT_MS` | runtime | GakrCLI runtime setting or host/session metadata. Source: src/utils/telemetry/instrumentation.ts. | `60000` | `src/utils/telemetry/instrumentation.ts` |
| `GAKR_CODE_OTEL_HEADERS_HELPER_DEBOUNCE_MS` | runtime | GakrCLI runtime setting or host/session metadata. Source: src/utils/auth.ts. | `60000` | `src/utils/auth.ts` |
| `GAKR_CODE_OTEL_SHUTDOWN_TIMEOUT_MS` | runtime | GakrCLI runtime setting or host/session metadata. Source: src/utils/telemetry/instrumentation.ts. | `60000` | `src/utils/telemetry/instrumentation.ts` |
| `GAKR_CODE_OVERRIDE_DATE` | runtime | GakrCLI runtime setting or host/session metadata. Source: src/constants/common.ts. | `1` | `src/constants/common.ts` |
| `GAKR_CODE_PERFETTO_TRACE` | runtime | GakrCLI runtime setting or host/session metadata. Source: src/utils/telemetry/perfettoTracing.ts. | `1` | `src/utils/telemetry/perfettoTracing.ts` |
| `GAKR_CODE_PERFETTO_WRITE_INTERVAL_S` | runtime | GakrCLI runtime setting or host/session metadata. Source: src/utils/telemetry/perfettoTracing.ts. | `60000` | `src/utils/telemetry/perfettoTracing.ts` |
| `GAKR_CODE_PLAN_MODE_INTERVIEW_PHASE` | runtime | GakrCLI runtime setting or host/session metadata. Source: src/utils/planModeV2.ts. | `1` | `src/utils/planModeV2.ts` |
| `GAKR_CODE_PLAN_MODE_REQUIRED` | runtime | GakrCLI runtime setting or host/session metadata. Source: src/utils/teammate.ts. | `1` | `src/utils/teammate.ts` |
| `GAKR_CODE_PLAN_V2_AGENT_COUNT` | runtime | GakrCLI runtime setting or host/session metadata. Source: src/utils/planModeV2.ts. | `128000` | `src/utils/planModeV2.ts` |
| `GAKR_CODE_PLAN_V2_EXPLORE_AGENT_COUNT` | runtime | GakrCLI runtime setting or host/session metadata. Source: src/utils/planModeV2.ts. | `128000` | `src/utils/planModeV2.ts` |
| `GAKR_CODE_PLUGIN_CACHE_DIR` | runtime | GakrCLI runtime setting or host/session metadata. Source: src/hooks/useManagePlugins.ts. | `C:\\path\\to\\value` | `src/hooks/useManagePlugins.ts` |
| `GAKR_CODE_PLUGIN_GIT_TIMEOUT_MS` | runtime | GakrCLI runtime setting or host/session metadata. Source: src/utils/plugins/marketplaceManager.ts. | `60000` | `src/utils/plugins/marketplaceManager.ts` |
| `GAKR_CODE_PLUGIN_SEED_DIR` | runtime | GakrCLI runtime setting or host/session metadata. Source: src/utils/plugins/pluginDirectories.ts. | `C:\\path\\to\\value` | `src/utils/plugins/pluginDirectories.ts` |
| `GAKR_CODE_PLUGIN_USE_ZIP_CACHE` | runtime | GakrCLI runtime setting or host/session metadata. Source: src/utils/plugins/zipCache.ts. | `1` | `src/utils/plugins/zipCache.ts` |
| `GAKR_CODE_POST_FOR_SESSION_INGRESS_V2` | runtime | GakrCLI runtime setting or host/session metadata. Source: src/cli/transports/transportUtils.ts. | `https://example.com` | `src/cli/transports/transportUtils.ts` |
| `GAKR_CODE_PROACTIVE` | runtime | GakrCLI runtime setting or host/session metadata. Source: src/cli/print.ts. | `1` | `src/cli/print.ts` |
| `GAKR_CODE_PROFILE_QUERY` | runtime | GakrCLI runtime setting or host/session metadata. Source: src/utils/queryProfiler.ts. | `C:\\path\\to\\value` | `src/utils/queryProfiler.ts` |
| `GAKR_CODE_PROFILE_STARTUP` | runtime | GakrCLI runtime setting or host/session metadata. Source: src/utils/headlessProfiler.ts. | `C:\\path\\to\\value` | `src/utils/headlessProfiler.ts` |
| `GAKR_CODE_PROVIDER_MANAGED_BY_HOST` | runtime | GakrCLI runtime setting or host/session metadata. Source: src/utils/managedEnv.ts. | `1` | `src/utils/managedEnv.ts` |
| `GAKR_CODE_PROVIDER_PROFILE_ENV_APPLIED` | runtime | GakrCLI runtime setting or host/session metadata. Source: src/utils/model/modelOptions.ts. | `C:\\path\\to\\value` | `src/utils/model/modelOptions.ts` |
| `GAKR_CODE_PROXY_RESOLVES_HOSTS` | runtime | GakrCLI runtime setting or host/session metadata. Source: src/utils/proxy.ts. | `1` | `src/utils/proxy.ts` |
| `GAKR_CODE_PWSH_PARSE_TIMEOUT_MS` | runtime | GakrCLI runtime setting or host/session metadata. Source: src/utils/powershell/parser.ts. | `60000` | `src/utils/powershell/parser.ts` |
| `GAKR_CODE_QUESTION_PREVIEW_FORMAT` | runtime | GakrCLI runtime setting or host/session metadata. Source: src/main.tsx. | `1` | `src/main.tsx` |
| `GAKR_CODE_REPL` | runtime | GakrCLI runtime setting or host/session metadata. Source: src/tools/REPLTool/constants.ts. | `1` | `src/tools/REPLTool/constants.ts` |
| `GAKR_CODE_RESUME_INTERRUPTED_TURN` | runtime | GakrCLI runtime setting or host/session metadata. Source: src/cli/print.ts. | `1` | `src/cli/print.ts` |
| `GAKR_CODE_SAVE_HOOK_ADDITIONAL_CONTEXT` | runtime | GakrCLI runtime setting or host/session metadata. Source: src/utils/sessionStorage.ts. | `1` | `src/utils/sessionStorage.ts` |
| `GAKR_CODE_SCROLL_SPEED` | runtime | GakrCLI runtime setting or host/session metadata. Source: src/components/ScrollKeybindingHandler.tsx. | `1` | `src/components/ScrollKeybindingHandler.tsx` |
| `GAKR_CODE_SHELL` | runtime | GakrCLI runtime setting or host/session metadata. Source: src/utils/Shell.ts. | `1` | `src/utils/Shell.ts` |
| `GAKR_CODE_SHELL_PREFIX` | runtime | GakrCLI runtime setting or host/session metadata. Source: src/services/mcp/client.ts. | `1` | `src/services/mcp/client.ts` |
| `GAKR_CODE_SIMPLE` | runtime | Enable simple/bare prompt and context mode. | `1` | `src/cli/handlers/xaiAuth.test.ts` |
| `GAKR_CODE_SKIP_BEDROCK_AUTH` | runtime | GakrCLI runtime setting or host/session metadata. Source: src/main.tsx. | `1` | `src/main.tsx` |
| `GAKR_CODE_SKIP_FAST_MODE_NETWORK_ERRORS` | runtime | GakrCLI runtime setting or host/session metadata. Source: src/utils/fastMode.ts. | `1` | `src/utils/fastMode.ts` |
| `GAKR_CODE_SKIP_FOUNDRY_AUTH` | runtime | GakrCLI runtime setting or host/session metadata. Source: src/services/api/client.ts. | `1` | `src/services/api/client.ts` |
| `GAKR_CODE_SKIP_PROMPT_HISTORY` | runtime | GakrCLI runtime setting or host/session metadata. Source: src/history.ts. | `1` | `src/history.ts` |
| `GAKR_CODE_SKIP_VERTEX_AUTH` | runtime | GakrCLI runtime setting or host/session metadata. Source: src/main.tsx. | `1` | `src/main.tsx` |
| `GAKR_CODE_SLOW_OPERATION_THRESHOLD_MS` | runtime | GakrCLI runtime setting or host/session metadata. Source: src/utils/slowOperations.ts. | `60000` | `src/utils/slowOperations.ts` |
| `GAKR_CODE_SSE_PORT` | runtime | GakrCLI runtime setting or host/session metadata. Source: src/hooks/useIDEIntegration.tsx. | `50051` | `src/hooks/useIDEIntegration.tsx` |
| `GAKR_CODE_STALL_TIMEOUT_MS_FOR_TESTING` | runtime | GakrCLI runtime setting or host/session metadata. Source: src/utils/nativeInstaller/download.ts. | `60000` | `src/utils/nativeInstaller/download.ts` |
| `GAKR_CODE_STREAMLINED_OUTPUT` | runtime | GakrCLI runtime setting or host/session metadata. Source: src/cli/print.ts. | `1` | `src/cli/print.ts` |
| `GAKR_CODE_SUBAGENT_MODEL` | runtime | Model selection or model metadata override. Source: src/tools/AgentTool/AgentTool.teammateModel.test.ts. | `model-id` | `src/tools/AgentTool/AgentTool.teammateModel.test.ts` |
| `GAKR_CODE_SUBPROCESS_ENV_SCRUB` | runtime | GakrCLI runtime setting or host/session metadata. Source: src/utils/subprocessEnv.ts. | `1` | `src/utils/subprocessEnv.ts` |
| `GAKR_CODE_SYNC_PLUGIN_INSTALL` | runtime | GakrCLI runtime setting or host/session metadata. Source: src/cli/print.ts. | `1` | `src/cli/print.ts` |
| `GAKR_CODE_SYNC_PLUGIN_INSTALL_TIMEOUT_MS` | runtime | GakrCLI runtime setting or host/session metadata. Source: src/cli/print.ts. | `60000` | `src/cli/print.ts` |
| `GAKR_CODE_SYNTAX_HIGHLIGHT` | runtime | GakrCLI runtime setting or host/session metadata. Source: src/components/StructuredDiff/colorDiff.ts. | `1` | `src/components/StructuredDiff/colorDiff.ts` |
| `GAKR_CODE_TAGS` | runtime | GakrCLI runtime setting or host/session metadata. Source: src/services/analytics/metadata.ts. | `1` | `src/services/analytics/metadata.ts` |
| `GAKR_CODE_TASK_LIST_ID` | runtime | GakrCLI runtime setting or host/session metadata. Source: src/main.tsx. | `1` | `src/main.tsx` |
| `GAKR_CODE_TERMINAL_RECORDING` | runtime | GakrCLI runtime setting or host/session metadata. Source: src/utils/asciicast.ts. | `1` | `src/utils/asciicast.ts` |
| `GAKR_CODE_TEST_FIXTURES_ROOT` | runtime | GakrCLI runtime setting or host/session metadata. Source: src/services/vcr.ts. | `C:\\path\\to\\value` | `src/services/vcr.ts` |
| `GAKR_CODE_TMPDIR` | runtime | GakrCLI runtime setting or host/session metadata. Source: src/utils/imagePaste.ts. | `C:\\path\\to\\value` | `src/utils/imagePaste.ts` |
| `GAKR_CODE_TMUX_PREFIX` | runtime | GakrCLI runtime setting or host/session metadata. Source: src/components/LogoV2/LogoV2.tsx. | `1` | `src/components/LogoV2/LogoV2.tsx` |
| `GAKR_CODE_TMUX_PREFIX_CONFLICTS` | runtime | GakrCLI runtime setting or host/session metadata. Source: src/components/LogoV2/LogoV2.tsx. | `1` | `src/components/LogoV2/LogoV2.tsx` |
| `GAKR_CODE_TMUX_SESSION` | runtime | GakrCLI runtime setting or host/session metadata. Source: src/components/LogoV2/LogoV2.tsx. | `1` | `src/components/LogoV2/LogoV2.tsx` |
| `GAKR_CODE_TMUX_TRUECOLOR` | runtime | GakrCLI runtime setting or host/session metadata. Source: src/ink/colorize.ts. | `1` | `src/ink/colorize.ts` |
| `GAKR_CODE_TOOL_FAILURE_LOOP_THRESHOLD` | runtime | GakrCLI runtime setting or host/session metadata. Source: src/query/toolFailureLoopGuard.ts. | `1` | `src/query/toolFailureLoopGuard.ts` |
| `GAKR_CODE_TWO_STAGE_CLASSIFIER` | runtime | GakrCLI runtime setting or host/session metadata. Source: src/utils/permissions/yoloClassifier.ts. | `1` | `src/utils/permissions/yoloClassifier.ts` |
| `GAKR_CODE_UNATTENDED_RETRY` | runtime + setup | GakrCLI runtime setting or host/session metadata. Source: .env.example. | `1` | `.env.example` |
| `GAKR_CODE_UNDERCOVER` | runtime | GakrCLI runtime setting or host/session metadata. Source: src/utils/undercover.ts. | `1` | `src/utils/undercover.ts` |
| `GAKR_CODE_USE_BEDROCK` | runtime + setup | Select the AWS Bedrock provider route. | `1` | `.env.example` |
| `GAKR_CODE_USE_COWORK_PLUGINS` | runtime | Enable/select this GakrCLI runtime provider or feature route. Source: src/utils/plugins/pluginDirectories.ts. | `1` | `src/utils/plugins/pluginDirectories.ts` |
| `GAKR_CODE_USE_FOUNDRY` | runtime | Enable/select this GakrCLI runtime provider or feature route. Source: src/commands/feedback/index.ts. | `1` | `src/commands/feedback/index.ts` |
| `GAKR_CODE_USE_GEMINI` | runtime + setup | Select the Gemini provider route. | `1` | `.env.example` |
| `GAKR_CODE_USE_GITHUB` | runtime + setup | Select the GitHub Models/Copilot-compatible provider route. | `1` | `.env.example` |
| `GAKR_CODE_USE_MISTRAL` | runtime | Enable/select this GakrCLI runtime provider or feature route. Source: scripts/system-check.ts. | `1` | `scripts/system-check.ts` |
| `GAKR_CODE_USE_NATIVE_FILE_SEARCH` | runtime | Enable/select this GakrCLI runtime provider or feature route. Source: src/tools/AgentTool/loadAgentsDir.test.ts. | `C:\\path\\to\\value` | `src/tools/AgentTool/loadAgentsDir.test.ts` |
| `GAKR_CODE_USE_NVIDIA` | runtime | Enable/select this GakrCLI runtime provider or feature route. Source: src/components/ConsoleOAuthFlow.test.tsx. | `1` | `src/components/ConsoleOAuthFlow.test.tsx` |
| `GAKR_CODE_USE_OPENAI` | runtime + setup | Select the OpenAI-compatible provider route. | `1` | `.env.example` |
| `GAKR_CODE_USE_POWERSHELL_TOOL` | runtime | Enable/select this GakrCLI runtime provider or feature route. Source: src/services/tips/tipRegistry.ts. | `1` | `src/services/tips/tipRegistry.ts` |
| `GAKR_CODE_USE_VERTEX` | runtime + setup | Select the Google Vertex provider route. | `1` | `.env.example` |
| `GAKR_CODE_USER_EMAIL` | runtime | GakrCLI runtime setting or host/session metadata. Source: src/services/oauth/client.ts. | `1` | `src/services/oauth/client.ts` |
| `GAKR_CODE_VERIFY_PLAN` | runtime | GakrCLI runtime setting or host/session metadata. Source: src/tools.ts. | `1` | `src/tools.ts` |
| `GAKR_CODE_WORKER_EPOCH` | runtime | GakrCLI runtime setting or host/session metadata. Source: src/cli/transports/ccrClient.ts. | `1` | `src/cli/transports/ccrClient.ts` |
| `GAKR_CODE_WORKSPACE_HOST_PATHS` | runtime | GakrCLI runtime setting or host/session metadata. Source: src/utils/telemetry/events.ts. | `C:\\path\\to\\value` | `src/utils/telemetry/events.ts` |
| `GAKR_CONFIG_DIR` | runtime | Override GakrCLI config directory. | `C:\\path\\to\\value` | `src/cli/handlers/xaiAuth.test.ts` |
| `GAKR_COWORK_MEMORY_EXTRA_GUIDELINES` | runtime | GakrCLI runtime, debug, profile, or workspace setting. Source: src/memdir/memdir.ts. | `1` | `src/memdir/memdir.ts` |
| `GAKR_COWORK_MEMORY_PATH_OVERRIDE` | runtime | GakrCLI runtime, debug, profile, or workspace setting. Source: src/memdir/paths.ts. | `C:\\path\\to\\value` | `src/memdir/paths.ts` |
| `GAKR_DEBUG` | runtime + setup | GakrCLI runtime, debug, profile, or workspace setting. Source: .env.example. | `1` | `.env.example` |
| `GAKR_DISABLE_CO_AUTHORED_BY` | runtime + setup | GakrCLI runtime, debug, profile, or workspace setting. Source: .env.example. | `1` | `.env.example` |
| `GAKR_DISABLE_EARLY_INPUT` | runtime | GakrCLI runtime, debug, profile, or workspace setting. Source: src/entrypoints/cli.tsx. | `1` | `src/entrypoints/cli.tsx` |
| `GAKR_DISABLE_STRICT_TOOLS` | runtime + setup | GakrCLI runtime, debug, profile, or workspace setting. Source: .env.example. | `1` | `.env.example` |
| `GAKR_DISABLE_TOOL_REMINDERS` | runtime + setup | GakrCLI runtime, debug, profile, or workspace setting. Source: .env.example. | `1` | `.env.example` |
| `GAKR_ENABLE_EXTENDED_KEYS` | runtime + setup | GakrCLI runtime, debug, profile, or workspace setting. Source: .env.example. | `1` | `.env.example` |
| `GAKR_ENABLE_LEGACY_WINDOWS_PASSWORDVAULT` | runtime | Secret value used by the related integration or example. Source: src/utils/secureStorage/platformStorage.test.ts. | `1` | `src/utils/secureStorage/platformStorage.test.ts` |
| `GAKR_ENABLE_STREAM_WATCHDOG` | runtime | GakrCLI runtime, debug, profile, or workspace setting. Source: src/services/api/gakrcli.ts. | `1` | `src/services/api/gakrcli.ts` |
| `GAKR_ENV_FILE` | runtime | GakrCLI runtime, debug, profile, or workspace setting. Source: src/utils/sessionEnvironment.ts. | `C:\\path\\to\\value` | `src/utils/sessionEnvironment.ts` |
| `GAKR_FEATURE_FLAGS_FILE` | runtime | GakrCLI runtime, debug, profile, or workspace setting. Source: scripts/no-telemetry-growthbook-stub.test.ts. | `C:\\path\\to\\value` | `scripts/no-telemetry-growthbook-stub.test.ts` |
| `GAKR_FORCE_DISPLAY_SURVEY` | runtime | GakrCLI runtime, debug, profile, or workspace setting. Source: src/components/FeedbackSurvey/useFeedbackSurvey.tsx. | `1` | `src/components/FeedbackSurvey/useFeedbackSurvey.tsx` |
| `GAKR_INTERNAL_FC_OVERRIDES` | runtime | GakrCLI runtime, debug, profile, or workspace setting. Source: src/services/analytics/growthbook.ts. | `1` | `src/services/analytics/growthbook.ts` |
| `GAKR_JOB_DIR` | runtime | GakrCLI runtime, debug, profile, or workspace setting. Source: src/query/stopHooks.ts. | `C:\\path\\to\\value` | `src/query/stopHooks.ts` |
| `GAKR_LOCAL_OAUTH_API_BASE` | runtime | GakrCLI runtime, debug, profile, or workspace setting. Source: src/constants/oauth.ts. | `https://example.com` | `src/constants/oauth.ts` |
| `GAKR_LOCAL_OAUTH_APPS_BASE` | runtime | GakrCLI runtime, debug, profile, or workspace setting. Source: src/constants/oauth.ts. | `https://example.com` | `src/constants/oauth.ts` |
| `GAKR_LOCAL_OAUTH_CONSOLE_BASE` | runtime | GakrCLI runtime, debug, profile, or workspace setting. Source: src/constants/oauth.ts. | `https://example.com` | `src/constants/oauth.ts` |
| `GAKR_LOG_TOKEN_USAGE` | runtime + setup | GakrCLI runtime, debug, profile, or workspace setting. Source: .env.example. | `1` | `.env.example` |
| `GAKR_MAX_MEMORY_MB` | runtime | GakrCLI runtime, debug, profile, or workspace setting. Source: bin/gakrcli.js. | `128000` | `bin/gakrcli.js` |
| `GAKR_MOCK_HEADERLESS_429` | runtime | GakrCLI runtime, debug, profile, or workspace setting. Source: src/services/mockRateLimits.ts. | `1` | `src/services/mockRateLimits.ts` |
| `GAKR_MODEL` | runtime | Model selection or model metadata override. Source: src/components/StartupScreen.test.ts. | `model-id` | `src/components/StartupScreen.test.ts` |
| `GAKR_MORERIGHT` | runtime | GakrCLI runtime, debug, profile, or workspace setting. Source: src/screens/REPL.tsx. | `1` | `src/screens/REPL.tsx` |
| `GAKR_PROFILE_GOAL` | runtime | GakrCLI runtime, debug, profile, or workspace setting. Source: scripts/provider-bootstrap.ts. | `C:\\path\\to\\value` | `scripts/provider-bootstrap.ts` |
| `GAKR_REPL_MODE` | runtime | GakrCLI runtime, debug, profile, or workspace setting. Source: src/tools/REPLTool/constants.ts. | `1` | `src/tools/REPLTool/constants.ts` |
| `GAKR_STREAM_IDLE_TIMEOUT_MS` | runtime | GakrCLI runtime, debug, profile, or workspace setting. Source: src/services/api/gakrcli.ts. | `60000` | `src/services/api/gakrcli.ts` |
| `GAKR_TEST_SESSIONS_DIR` | runtime | GakrCLI runtime, debug, profile, or workspace setting. Source: src/utils/sessionPersistence.test.ts. | `C:\\path\\to\\value` | `src/utils/sessionPersistence.test.ts` |
| `GAKR_TRUSTED_DEVICE_TOKEN` | runtime | Token for GAKR_TRUSTED_DEVICE authentication or session flow. Source: src/bridge/trustedDevice.ts. | `replace-with-secret` | `src/bridge/trustedDevice.ts` |
| `GAKR_USE_READABLE_STDIN` | runtime | GakrCLI runtime, debug, profile, or workspace setting. Source: src/ink/components/App.tsx. | `1` | `src/ink/components/App.tsx` |
| `GAKR_WORKSPACE_DIR` | runtime | GakrCLI runtime, debug, profile, or workspace setting. Source: src/utils/envUtils.ts. | `C:\\path\\to\\value` | `src/utils/envUtils.ts` |
| `MAX_STRUCTURED_OUTPUT_RETRIES` | runtime | Environment value read by GakrCLI or related tracked code. Source: src/QueryEngine.ts. | `1` | `src/QueryEngine.ts` |
| `MAX_THINKING_TOKENS` | runtime | Environment value read by GakrCLI or related tracked code. Source: src/main.tsx. | `128000` | `src/main.tsx` |
| `OPENGAKR_USE_READABLE_STDIN` | runtime | Environment value read by GakrCLI or related tracked code. Source: src/ink/components/App.tsx. | `1` | `src/ink/components/App.tsx` |
| `SLASH_COMMAND_TOOL_CHAR_BUDGET` | runtime | Environment value read by GakrCLI or related tracked code. Source: src/tools/SkillTool/prompt.ts. | `128000` | `src/tools/SkillTool/prompt.ts` |
| `TASK_MAX_OUTPUT_LENGTH` | runtime | Environment value read by GakrCLI or related tracked code. Source: src/utils/task/outputFormatting.ts. | `128000` | `src/utils/task/outputFormatting.ts` |
| `ULTRAPLAN_PROMPT_FILE` | runtime | Environment value read by GakrCLI or related tracked code. Source: src/commands/ultraplan.tsx. | `C:\\path\\to\\value` | `src/commands/ultraplan.tsx` |
| `USE_API_CLEAR_TOOL_RESULTS` | runtime | Environment value read by GakrCLI or related tracked code. Source: src/services/compact/apiMicrocompact.ts. | `1` | `src/services/compact/apiMicrocompact.ts` |
| `USE_API_CLEAR_TOOL_USES` | runtime | Environment value read by GakrCLI or related tracked code. Source: src/services/compact/apiMicrocompact.ts. | `1` | `src/services/compact/apiMicrocompact.ts` |
| `USE_API_CONTEXT_MANAGEMENT` | runtime | Environment value read by GakrCLI or related tracked code. Source: src/utils/betas.ts. | `1` | `src/utils/betas.ts` |
| `USE_BUILTIN_RIPGREP` | runtime | Environment value read by GakrCLI or related tracked code. Source: src/utils/ripgrep.ts. | `1` | `src/utils/ripgrep.ts` |
| `USE_CONNECTOR_TEXT_SUMMARIZATION` | runtime | Environment value read by GakrCLI or related tracked code. Source: src/utils/betas.ts. | `1` | `src/utils/betas.ts` |
| `USE_LOCAL_OAUTH` | runtime | Environment value read by GakrCLI or related tracked code. Source: src/constants/oauth.ts. | `1` | `src/constants/oauth.ts` |
| `USE_STAGING_OAUTH` | runtime | Environment value read by GakrCLI or related tracked code. Source: src/constants/oauth.ts. | `1` | `src/constants/oauth.ts` |
| `VCR_RECORD` | runtime | Environment value read by GakrCLI or related tracked code. Source: src/services/vcr.ts. | `1` | `src/services/vcr.ts` |

### Remote, bridge, and session ingress

| Variable | Scope | Purpose | Example | Source |
| --- | --- | --- | --- | --- |
| `CCR_ENABLE_BUNDLE` | runtime | Environment value read by GakrCLI or related tracked code. Source: src/utils/background/remote/remoteSession.ts. | `1` | `src/utils/background/remote/remoteSession.ts` |
| `CCR_FORCE_BUNDLE` | runtime | Environment value read by GakrCLI or related tracked code. Source: src/utils/background/remote/remoteSession.ts. | `1` | `src/utils/background/remote/remoteSession.ts` |
| `CCR_UPSTREAM_PROXY_ENABLED` | runtime | Environment value read by GakrCLI or related tracked code. Source: src/upstreamproxy/upstreamproxy.ts. | `1` | `src/upstreamproxy/upstreamproxy.ts` |
| `GAKR_BRIDGE_BASE_URL` | runtime | URL/base endpoint override for the related service. Source: src/bridge/bridgeConfig.ts. | `https://example.com` | `src/bridge/bridgeConfig.ts` |
| `GAKR_BRIDGE_OAUTH_TOKEN` | runtime | Token for GAKR_BRIDGE_OAUTH authentication or session flow. Source: src/bridge/bridgeConfig.ts. | `replace-with-secret` | `src/bridge/bridgeConfig.ts` |
| `GAKR_BRIDGE_SESSION_INGRESS_URL` | runtime | URL/base endpoint override for the related service. Source: src/bridge/bridgeMain.ts. | `https://example.com` | `src/bridge/bridgeMain.ts` |
| `GAKR_BRIDGE_USE_CCR_V2` | runtime | GakrCLI runtime, debug, profile, or workspace setting. Source: src/bridge/bridgeMain.ts. | `1` | `src/bridge/bridgeMain.ts` |
| `GAKR_CODE_CCR_MIRROR` | runtime | GakrCLI runtime setting or host/session metadata. Source: src/bridge/bridgeEnabled.ts. | `1` | `src/bridge/bridgeEnabled.ts` |
| `GAKR_CODE_REMOTE` | runtime | GakrCLI runtime setting or host/session metadata. Source: src/cli/print.ts. | `1` | `src/cli/print.ts` |
| `GAKR_CODE_REMOTE_ENVIRONMENT_TYPE` | runtime | GakrCLI runtime setting or host/session metadata. Source: src/services/analytics/metadata.ts. | `1` | `src/services/analytics/metadata.ts` |
| `GAKR_CODE_REMOTE_MEMORY_DIR` | runtime | GakrCLI runtime setting or host/session metadata. Source: src/memdir/paths.ts. | `C:\\path\\to\\value` | `src/memdir/paths.ts` |
| `GAKR_CODE_REMOTE_SEND_KEEPALIVES` | runtime | GakrCLI runtime setting or host/session metadata. Source: src/utils/sessionActivity.ts. | `1` | `src/utils/sessionActivity.ts` |
| `GAKR_CODE_REMOTE_SESSION_ID` | runtime | GakrCLI runtime setting or host/session metadata. Source: src/main.tsx. | `1` | `src/main.tsx` |
| `GAKR_CODE_SESSION_ACCESS_TOKEN` | runtime | Token for GAKR_CODE_SESSION_ACCESS authentication or session flow. Source: src/bridge/remoteBridgeCore.ts. | `replace-with-secret` | `src/bridge/remoteBridgeCore.ts` |
| `GAKR_CODE_SESSION_ID` | runtime | GakrCLI runtime setting or host/session metadata. Source: src/commands/clear/conversation.ts. | `1` | `src/commands/clear/conversation.ts` |
| `GAKR_CODE_SESSION_KIND` | runtime | GakrCLI runtime setting or host/session metadata. Source: src/utils/concurrentSessions.ts. | `1` | `src/utils/concurrentSessions.ts` |
| `GAKR_CODE_SESSION_LOG` | runtime | GakrCLI runtime setting or host/session metadata. Source: src/utils/concurrentSessions.ts. | `1` | `src/utils/concurrentSessions.ts` |
| `GAKR_CODE_SESSION_NAME` | runtime | GakrCLI runtime setting or host/session metadata. Source: src/utils/concurrentSessions.ts. | `1` | `src/utils/concurrentSessions.ts` |
| `GAKR_CODE_SESSIONEND_HOOKS_TIMEOUT_MS` | runtime | GakrCLI runtime setting or host/session metadata. Source: src/utils/hooks.ts. | `60000` | `src/utils/hooks.ts` |
| `GAKR_CODE_USE_CCR_V2` | runtime | Enable/select this GakrCLI runtime provider or feature route. Source: src/cli/print.ts. | `1` | `src/cli/print.ts` |
| `GAKR_CODE_WEBSOCKET_AUTH_FILE_DESCRIPTOR` | runtime | GakrCLI runtime setting or host/session metadata. Source: src/main.tsx. | `C:\\path\\to\\value` | `src/main.tsx` |
| `GAKR_SESSION_INGRESS_TOKEN_FILE` | runtime | GakrCLI runtime, debug, profile, or workspace setting. Source: src/utils/sessionIngressAuth.ts. | `https://example.com` | `src/utils/sessionIngressAuth.ts` |
| `LOCAL_BRIDGE` | runtime | Environment value read by GakrCLI or related tracked code. Source: src/utils/gakrcliInChrome/mcpServer.ts. | `1` | `src/utils/gakrcliInChrome/mcpServer.ts` |
| `SESSION_INGRESS_URL` | runtime | URL/base endpoint override for the related service. Source: src/commands/ultraplan.tsx. | `https://example.com` | `src/commands/ultraplan.tsx` |

### Debug, telemetry, and profiling

| Variable | Scope | Purpose | Example | Source |
| --- | --- | --- | --- | --- |
| `ANT_GAKR_CODE_METRICS_ENDPOINT` | runtime | URL/base endpoint override for the related service. Source: src/utils/telemetry/bigqueryExporter.ts. | `https://example.com` | `src/utils/telemetry/bigqueryExporter.ts` |
| `ANT_OTEL_EXPORTER_OTLP_ENDPOINT` | runtime | URL/base endpoint override for the related service. Source: src/utils/telemetry/instrumentation.ts. | `https://example.com` | `src/utils/telemetry/instrumentation.ts` |
| `ANT_OTEL_EXPORTER_OTLP_HEADERS` | runtime | Debug, telemetry, tracing, or profiling control. Source: src/utils/telemetry/instrumentation.ts. | `1` | `src/utils/telemetry/instrumentation.ts` |
| `ANT_OTEL_EXPORTER_OTLP_PROTOCOL` | runtime | Debug, telemetry, tracing, or profiling control. Source: src/utils/telemetry/instrumentation.ts. | `1` | `src/utils/telemetry/instrumentation.ts` |
| `ANT_OTEL_LOGS_EXPORTER` | runtime | Debug, telemetry, tracing, or profiling control. Source: src/utils/telemetry/instrumentation.ts. | `1` | `src/utils/telemetry/instrumentation.ts` |
| `ANT_OTEL_METRICS_EXPORTER` | runtime | Debug, telemetry, tracing, or profiling control. Source: src/utils/telemetry/instrumentation.ts. | `1` | `src/utils/telemetry/instrumentation.ts` |
| `ANT_OTEL_TRACES_EXPORTER` | runtime | Debug, telemetry, tracing, or profiling control. Source: src/utils/telemetry/instrumentation.ts. | `1` | `src/utils/telemetry/instrumentation.ts` |
| `BETA_TRACING_ENDPOINT` | runtime | URL/base endpoint override for the related service. Source: src/utils/telemetry/betaSessionTracing.ts. | `https://example.com` | `src/utils/telemetry/betaSessionTracing.ts` |
| `DATADOG_CLIENT_TOKEN` | runtime | Token for DATADOG_CLIENT authentication or session flow. Source: src/services/analytics/datadog.ts. | `replace-with-secret` | `src/services/analytics/datadog.ts` |
| `DEBUG` | runtime | Debug, telemetry, tracing, or profiling control. Source: src/utils/debug.ts. | `1` | `src/utils/debug.ts` |
| `DEBUG_SDK` | runtime | Debug, telemetry, tracing, or profiling control. Source: src/utils/debug.ts. | `1` | `src/utils/debug.ts` |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | runtime | URL/base endpoint override for the related service. Source: src/utils/telemetry/instrumentation.ts. | `https://example.com` | `src/utils/telemetry/instrumentation.ts` |
| `OTEL_EXPORTER_OTLP_HEADERS` | runtime | Debug, telemetry, tracing, or profiling control. Source: src/utils/telemetry/instrumentation.ts. | `1` | `src/utils/telemetry/instrumentation.ts` |
| `OTEL_EXPORTER_OTLP_LOGS_PROTOCOL` | runtime | Debug, telemetry, tracing, or profiling control. Source: src/utils/telemetry/instrumentation.ts. | `1` | `src/utils/telemetry/instrumentation.ts` |
| `OTEL_EXPORTER_OTLP_METRICS_PROTOCOL` | runtime | Debug, telemetry, tracing, or profiling control. Source: src/utils/telemetry/instrumentation.ts. | `1` | `src/utils/telemetry/instrumentation.ts` |
| `OTEL_EXPORTER_OTLP_METRICS_TEMPORALITY_PREFERENCE` | runtime | Debug, telemetry, tracing, or profiling control. Source: src/utils/telemetry/instrumentation.ts. | `1` | `src/utils/telemetry/instrumentation.ts` |
| `OTEL_EXPORTER_OTLP_PROTOCOL` | runtime | Debug, telemetry, tracing, or profiling control. Source: src/utils/telemetry/instrumentation.ts. | `1` | `src/utils/telemetry/instrumentation.ts` |
| `OTEL_EXPORTER_OTLP_TRACES_PROTOCOL` | runtime | Debug, telemetry, tracing, or profiling control. Source: src/utils/telemetry/instrumentation.ts. | `1` | `src/utils/telemetry/instrumentation.ts` |
| `OTEL_LOG_TOOL_CONTENT` | runtime | Debug, telemetry, tracing, or profiling control. Source: src/utils/telemetry/sessionTracing.ts. | `1` | `src/utils/telemetry/sessionTracing.ts` |
| `OTEL_LOG_TOOL_DETAILS` | runtime | Debug, telemetry, tracing, or profiling control. Source: src/services/analytics/metadata.ts. | `1` | `src/services/analytics/metadata.ts` |
| `OTEL_LOG_USER_PROMPTS` | runtime | Debug, telemetry, tracing, or profiling control. Source: src/utils/telemetry/events.ts. | `1` | `src/utils/telemetry/events.ts` |
| `OTEL_LOGS_EXPORT_INTERVAL` | runtime | Debug, telemetry, tracing, or profiling control. Source: src/services/analytics/firstPartyEventLogger.ts. | `60000` | `src/services/analytics/firstPartyEventLogger.ts` |
| `OTEL_LOGS_EXPORTER` | runtime | Debug, telemetry, tracing, or profiling control. Source: src/utils/telemetry/instrumentation.ts. | `1` | `src/utils/telemetry/instrumentation.ts` |
| `OTEL_METRIC_EXPORT_INTERVAL` | runtime | Debug, telemetry, tracing, or profiling control. Source: src/utils/telemetry/instrumentation.ts. | `60000` | `src/utils/telemetry/instrumentation.ts` |
| `OTEL_METRICS_EXPORTER` | runtime | Debug, telemetry, tracing, or profiling control. Source: src/utils/telemetry/instrumentation.ts. | `1` | `src/utils/telemetry/instrumentation.ts` |
| `OTEL_TRACES_EXPORT_INTERVAL` | runtime | Debug, telemetry, tracing, or profiling control. Source: src/utils/telemetry/instrumentation.ts. | `60000` | `src/utils/telemetry/instrumentation.ts` |
| `OTEL_TRACES_EXPORTER` | runtime | Debug, telemetry, tracing, or profiling control. Source: src/utils/telemetry/instrumentation.ts. | `1` | `src/utils/telemetry/instrumentation.ts` |

### Host, shell, terminal, and OS

| Variable | Scope | Purpose | Example | Source |
| --- | --- | --- | --- | --- |
| `ALACRITTY_LOG` | runtime | Standard host/shell/terminal environment read for detection or integration. Source: src/utils/env.ts. | `1` | `src/utils/env.ts` |
| `APPDATA` | runtime | Standard host/shell/terminal environment read for detection or integration. Source: src/commands/terminalSetup/terminalSetup.tsx. | `1` | `src/commands/terminalSetup/terminalSetup.tsx` |
| `BROWSER` | runtime | Standard host/shell/terminal environment read for detection or integration. Source: src/utils/browser.ts. | `1` | `src/utils/browser.ts` |
| `COLORFGBG` | runtime | Standard host/shell/terminal environment read for detection or integration. Source: src/utils/systemTheme.ts. | `1` | `src/utils/systemTheme.ts` |
| `COLORTERM` | runtime | Standard host/shell/terminal environment read for detection or integration. Source: src/native-ts/color-diff/index.ts. | `1` | `src/native-ts/color-diff/index.ts` |
| `ConEmuANSI` | runtime | Standard host/shell/terminal environment read for detection or integration. Source: src/ink/terminal.ts. | `1` | `src/ink/terminal.ts` |
| `ConEmuPID` | runtime | Standard host/shell/terminal environment read for detection or integration. Source: src/ink/terminal.ts. | `1` | `src/ink/terminal.ts` |
| `ConEmuTask` | runtime | Standard host/shell/terminal environment read for detection or integration. Source: src/ink/terminal.ts. | `1` | `src/ink/terminal.ts` |
| `EDITOR` | runtime | Standard host/shell/terminal environment read for detection or integration. Source: src/commands/memory/memory.tsx. | `1` | `src/commands/memory/memory.tsx` |
| `HOME` | runtime | Standard host/shell/terminal environment read for detection or integration. Source: src/utils/xdg.ts. | `1` | `src/utils/xdg.ts` |
| `KITTY_WINDOW_ID` | runtime | Standard host/shell/terminal environment read for detection or integration. Source: src/ink/terminal.ts. | `1` | `src/ink/terminal.ts` |
| `KONSOLE_VERSION` | runtime | Standard host/shell/terminal environment read for detection or integration. Source: src/utils/env.ts. | `1` | `src/utils/env.ts` |
| `LANG` | runtime | Standard host/shell/terminal environment read for detection or integration. Source: src/utils/formatBriefTimestamp.ts. | `1` | `src/utils/formatBriefTimestamp.ts` |
| `LC_ALL` | runtime | Standard host/shell/terminal environment read for detection or integration. Source: src/utils/formatBriefTimestamp.ts. | `1` | `src/utils/formatBriefTimestamp.ts` |
| `LC_TERMINAL` | runtime | Standard host/shell/terminal environment read for detection or integration. Source: src/ink/termio/osc.ts. | `1` | `src/ink/termio/osc.ts` |
| `LC_TIME` | runtime | Standard host/shell/terminal environment read for detection or integration. Source: src/utils/formatBriefTimestamp.ts. | `1` | `src/utils/formatBriefTimestamp.ts` |
| `LOCALAPPDATA` | runtime | Standard host/shell/terminal environment read for detection or integration. Source: src/utils/desktopDeepLink.ts. | `1` | `src/utils/desktopDeepLink.ts` |
| `MSYSTEM` | runtime | Standard host/shell/terminal environment read for detection or integration. Source: src/ink/clearTerminal.ts. | `1` | `src/ink/clearTerminal.ts` |
| `NoDefaultCurrentDirectoryInExePath` | runtime | Standard host/shell/terminal environment read for detection or integration. Source: src/main.tsx. | `C:\\path\\to\\value` | `src/main.tsx` |
| `PATH` | runtime | Standard host/shell/terminal environment read for detection or integration. Source: src/commands/terminalSetup/terminalSetup.tsx. | `C:\\path\\to\\value` | `src/commands/terminalSetup/terminalSetup.tsx` |
| `PWD` | runtime | Standard host/shell/terminal environment read for detection or integration. Source: src/utils/permissions/permissionSetup.ts. | `1` | `src/utils/permissions/permissionSetup.ts` |
| `SHELL` | runtime | Standard host/shell/terminal environment read for detection or integration. Source: src/constants/prompts.ts. | `1` | `src/constants/prompts.ts` |
| `SSH_CLIENT` | runtime | Standard host/shell/terminal environment read for detection or integration. Source: src/utils/env.ts. | `1` | `src/utils/env.ts` |
| `SSH_CONNECTION` | runtime | Standard host/shell/terminal environment read for detection or integration. Source: src/ink/termio/osc.test.ts. | `1` | `src/ink/termio/osc.test.ts` |
| `SSH_TTY` | runtime | Standard host/shell/terminal environment read for detection or integration. Source: src/utils/env.ts. | `1` | `src/utils/env.ts` |
| `STY` | runtime | Standard host/shell/terminal environment read for detection or integration. Source: src/ink/termio/osc.ts. | `1` | `src/ink/termio/osc.ts` |
| `TEMP` | runtime | Standard host/shell/terminal environment read for detection or integration. Source: src/utils/imagePaste.ts. | `1` | `src/utils/imagePaste.ts` |
| `TERM` | runtime | Standard host/shell/terminal environment read for detection or integration. Source: src/components/Spinner/utils.ts. | `1` | `src/components/Spinner/utils.ts` |
| `TERM_PROGRAM` | runtime | Standard host/shell/terminal environment read for detection or integration. Source: src/components/ScrollKeybindingHandler.tsx. | `1` | `src/components/ScrollKeybindingHandler.tsx` |
| `TERM_PROGRAM_VERSION` | runtime | Standard host/shell/terminal environment read for detection or integration. Source: src/ink/clearTerminal.ts. | `1` | `src/ink/clearTerminal.ts` |
| `TERMINAL` | runtime | Standard host/shell/terminal environment read for detection or integration. Source: src/utils/deepLink/terminalLauncher.ts. | `1` | `src/utils/deepLink/terminalLauncher.ts` |
| `TERMINAL_EMULATOR` | runtime | Standard host/shell/terminal environment read for detection or integration. Source: src/utils/env.ts. | `1` | `src/utils/env.ts` |
| `TERMINATOR_UUID` | runtime | Standard host/shell/terminal environment read for detection or integration. Source: src/utils/env.ts. | `1` | `src/utils/env.ts` |
| `TMPDIR` | runtime | Standard host/shell/terminal environment read for detection or integration. Source: src/utils/tmuxSocket.ts. | `C:\\path\\to\\value` | `src/utils/tmuxSocket.ts` |
| `TMUX` | runtime | Standard host/shell/terminal environment read for detection or integration. Source: src/ink/colorize.ts. | `1` | `src/ink/colorize.ts` |
| `TMUX_PANE` | runtime | Standard host/shell/terminal environment read for detection or integration. Source: src/utils/swarm/backends/detection.ts. | `1` | `src/utils/swarm/backends/detection.ts` |
| `USER` | runtime | Standard host/shell/terminal environment read for detection or integration. Source: src/commands/commit-push-pr.ts. | `1` | `src/commands/commit-push-pr.ts` |
| `USER_TYPE` | runtime | Standard host/shell/terminal environment read for detection or integration. Source: src/bootstrap/state.ts. | `1` | `src/bootstrap/state.ts` |
| `USERNAME` | runtime | Standard host/shell/terminal environment read for detection or integration. Source: src/utils/gakrcliInChrome/common.ts. | `1` | `src/utils/gakrcliInChrome/common.ts` |
| `USERPROFILE` | runtime | Standard host/shell/terminal environment read for detection or integration. Source: src/utils/file.ts. | `C:\\path\\to\\value` | `src/utils/file.ts` |
| `VISUAL` | runtime | Standard host/shell/terminal environment read for detection or integration. Source: src/commands/memory/memory.tsx. | `1` | `src/commands/memory/memory.tsx` |
| `VisualStudioVersion` | runtime | Standard host/shell/terminal environment read for detection or integration. Source: src/utils/env.ts. | `1` | `src/utils/env.ts` |
| `VSCODE_GIT_ASKPASS_MAIN` | runtime | Standard host/shell/terminal environment read for detection or integration. Source: src/commands/terminalSetup/terminalSetup.tsx. | `1` | `src/commands/terminalSetup/terminalSetup.tsx` |
| `VTE_VERSION` | runtime | Standard host/shell/terminal environment read for detection or integration. Source: src/ink/terminal.ts. | `1` | `src/ink/terminal.ts` |
| `WT_SESSION` | runtime | Standard host/shell/terminal environment read for detection or integration. Source: src/ink/bidi.ts. | `1` | `src/ink/bidi.ts` |
| `XDG_CONFIG_HOME` | runtime | Standard host/shell/terminal environment read for detection or integration. Source: src/commands/terminalSetup/terminalSetup.tsx. | `1` | `src/commands/terminalSetup/terminalSetup.tsx` |
| `ZED_TERM` | runtime | Standard host/shell/terminal environment read for detection or integration. Source: src/ink/terminal.ts. | `1` | `src/ink/terminal.ts` |

### CI, cloud, and hosted runtime detection

| Variable | Scope | Purpose | Example | Source |
| --- | --- | --- | --- | --- |
| `AZURE_FUNCTIONS_ENVIRONMENT` | runtime | Standard CI/cloud environment read for environment detection or telemetry metadata. Source: src/utils/env.ts. | `1` | `src/utils/env.ts` |
| `AZURE_OPENAI_API_VERSION` | runtime | Standard CI/cloud environment read for environment detection or telemetry metadata. Source: src/services/api/openaiShim.ts. | `1` | `src/services/api/openaiShim.ts` |
| `BUILDKITE` | runtime | Standard CI/cloud environment read for environment detection or telemetry metadata. Source: src/utils/env.ts. | `1` | `src/utils/env.ts` |
| `CF_PAGES` | runtime | Standard CI/cloud environment read for environment detection or telemetry metadata. Source: src/utils/env.ts. | `1` | `src/utils/env.ts` |
| `CI` | runtime | Standard CI/cloud environment read for environment detection or telemetry metadata. Source: assets/skills/e2e-testing/e2e-testing-patterns/resources/implementation-playbook.md. | `1` | `assets/skills/e2e-testing/e2e-testing-patterns/resources/implementation-playbook.md` |
| `CIRCLECI` | runtime | Standard CI/cloud environment read for environment detection or telemetry metadata. Source: src/utils/env.ts. | `1` | `src/utils/env.ts` |
| `CODESPACES` | runtime | Standard CI/cloud environment read for environment detection or telemetry metadata. Source: src/utils/env.ts. | `1` | `src/utils/env.ts` |
| `DENO_DEPLOYMENT_ID` | runtime | Standard CI/cloud environment read for environment detection or telemetry metadata. Source: src/utils/env.ts. | `1` | `src/utils/env.ts` |
| `DYNO` | runtime | Standard CI/cloud environment read for environment detection or telemetry metadata. Source: src/utils/env.ts. | `1` | `src/utils/env.ts` |
| `FLY_APP_NAME` | runtime | Standard CI/cloud environment read for environment detection or telemetry metadata. Source: src/utils/env.ts. | `1` | `src/utils/env.ts` |
| `FLY_MACHINE_ID` | runtime | Standard CI/cloud environment read for environment detection or telemetry metadata. Source: src/utils/env.ts. | `1` | `src/utils/env.ts` |
| `GH_TOKEN` | runtime | GitHub CLI-compatible token fallback. | `replace-with-secret` | `scripts/system-check.ts` |
| `GITHUB_ACTION_INPUTS` | runtime | Standard CI/cloud environment read for environment detection or telemetry metadata. Source: src/main.tsx. | `1` | `src/main.tsx` |
| `GITHUB_ACTION_PATH` | runtime | Standard CI/cloud environment read for environment detection or telemetry metadata. Source: src/services/analytics/metadata.ts. | `C:\\path\\to\\value` | `src/services/analytics/metadata.ts` |
| `GITHUB_ACTIONS` | runtime | Standard CI/cloud environment read for environment detection or telemetry metadata. Source: src/main.tsx. | `1` | `src/main.tsx` |
| `GITHUB_ACTOR` | runtime | Standard CI/cloud environment read for environment detection or telemetry metadata. Source: src/utils/user.ts. | `1` | `src/utils/user.ts` |
| `GITHUB_ACTOR_ID` | runtime | Standard CI/cloud environment read for environment detection or telemetry metadata. Source: src/utils/user.ts. | `1` | `src/utils/user.ts` |
| `GITHUB_DEVICE_FLOW_CLIENT_ID` | runtime | Standard CI/cloud environment read for environment detection or telemetry metadata. Source: src/services/github/deviceFlow.ts. | `1` | `src/services/github/deviceFlow.ts` |
| `GITHUB_EVENT_NAME` | runtime | Standard CI/cloud environment read for environment detection or telemetry metadata. Source: src/services/analytics/metadata.ts. | `1` | `src/services/analytics/metadata.ts` |
| `GITHUB_REPOSITORY` | runtime | Standard CI/cloud environment read for environment detection or telemetry metadata. Source: src/utils/user.ts. | `1` | `src/utils/user.ts` |
| `GITHUB_REPOSITORY_ID` | runtime | Standard CI/cloud environment read for environment detection or telemetry metadata. Source: src/utils/user.ts. | `1` | `src/utils/user.ts` |
| `GITHUB_REPOSITORY_OWNER` | runtime | Standard CI/cloud environment read for environment detection or telemetry metadata. Source: src/utils/user.ts. | `1` | `src/utils/user.ts` |
| `GITHUB_REPOSITORY_OWNER_ID` | runtime | Standard CI/cloud environment read for environment detection or telemetry metadata. Source: src/utils/user.ts. | `1` | `src/utils/user.ts` |
| `GITHUB_TOKEN` | runtime + setup | GitHub token for GitHub model, GitHub app, or CI workflows. | `replace-with-secret` | `.env.example` |
| `GITLAB_CI` | runtime | Standard CI/cloud environment read for environment detection or telemetry metadata. Source: src/utils/env.ts. | `1` | `src/utils/env.ts` |
| `GITPOD_WORKSPACE_ID` | runtime | Standard CI/cloud environment read for environment detection or telemetry metadata. Source: src/utils/env.ts. | `1` | `src/utils/env.ts` |
| `K_SERVICE` | runtime | Standard CI/cloud environment read for environment detection or telemetry metadata. Source: src/utils/env.ts. | `1` | `src/utils/env.ts` |
| `KUBERNETES_SERVICE_HOST` | runtime | Standard CI/cloud environment read for environment detection or telemetry metadata. Source: src/utils/env.ts. | `1` | `src/utils/env.ts` |
| `NETLIFY` | runtime | Standard CI/cloud environment read for environment detection or telemetry metadata. Source: src/utils/env.ts. | `1` | `src/utils/env.ts` |
| `PROJECT_DOMAIN` | runtime | Standard CI/cloud environment read for environment detection or telemetry metadata. Source: src/utils/env.ts. | `1` | `src/utils/env.ts` |
| `RAILWAY_ENVIRONMENT_NAME` | runtime | Standard CI/cloud environment read for environment detection or telemetry metadata. Source: src/utils/env.ts. | `1` | `src/utils/env.ts` |
| `RAILWAY_SERVICE_NAME` | runtime | Standard CI/cloud environment read for environment detection or telemetry metadata. Source: src/utils/env.ts. | `1` | `src/utils/env.ts` |
| `RENDER` | runtime | Standard CI/cloud environment read for environment detection or telemetry metadata. Source: src/utils/env.ts. | `1` | `src/utils/env.ts` |
| `REPL_ID` | runtime | Standard CI/cloud environment read for environment detection or telemetry metadata. Source: src/utils/env.ts. | `1` | `src/utils/env.ts` |
| `REPL_SLUG` | runtime | Standard CI/cloud environment read for environment detection or telemetry metadata. Source: src/utils/env.ts. | `1` | `src/utils/env.ts` |
| `RUNNER_ENVIRONMENT` | runtime | Standard CI/cloud environment read for environment detection or telemetry metadata. Source: src/services/analytics/metadata.ts. | `1` | `src/services/analytics/metadata.ts` |
| `RUNNER_OS` | runtime | Standard CI/cloud environment read for environment detection or telemetry metadata. Source: src/services/analytics/metadata.ts. | `1` | `src/services/analytics/metadata.ts` |
| `SPACE_CREATOR_USER_ID` | runtime | Standard CI/cloud environment read for environment detection or telemetry metadata. Source: src/utils/env.ts. | `1` | `src/utils/env.ts` |
| `SWE_BENCH_INSTANCE_ID` | runtime | Standard CI/cloud environment read for environment detection or telemetry metadata. Source: src/services/analytics/metadata.ts. | `1` | `src/services/analytics/metadata.ts` |
| `SWE_BENCH_RUN_ID` | runtime | Standard CI/cloud environment read for environment detection or telemetry metadata. Source: src/services/analytics/metadata.ts. | `1` | `src/services/analytics/metadata.ts` |
| `SWE_BENCH_TASK_ID` | runtime | Standard CI/cloud environment read for environment detection or telemetry metadata. Source: src/services/analytics/metadata.ts. | `1` | `src/services/analytics/metadata.ts` |
| `VERCEL` | runtime | Standard CI/cloud environment read for environment detection or telemetry metadata. Source: src/utils/env.ts. | `1` | `src/utils/env.ts` |
| `WEBSITE_SITE_NAME` | runtime | Standard CI/cloud environment read for environment detection or telemetry metadata. Source: src/utils/env.ts. | `1` | `src/utils/env.ts` |
| `WEBSITE_SKU` | runtime | Standard CI/cloud environment read for environment detection or telemetry metadata. Source: src/utils/env.ts. | `1` | `src/utils/env.ts` |

### Other runtime variables

| Variable | Scope | Purpose | Example | Source |
| --- | --- | --- | --- | --- |
| `__CFBundleIdentifier` | runtime | Environment value read by GakrCLI or related tracked code. Source: src/main.tsx. | `1` | `src/main.tsx` |
| `ALLOW_ANT_COMPUTER_USE_MCP` | runtime | Environment value read by GakrCLI or related tracked code. Source: src/utils/computerUse/gates.ts. | `1` | `src/utils/computerUse/gates.ts` |
| `ANT_ONLY_BUILD` | runtime | Environment value read by GakrCLI or related tracked code. Source: src/utils/gakrcliInChrome/mcpServer.ts. | `1` | `src/utils/gakrcliInChrome/mcpServer.ts` |
| `APP_URL` | runtime | URL/base endpoint override for the related service. Source: src/utils/env.ts. | `https://example.com` | `src/utils/env.ts` |
| `ATOMIC_CHAT_BASE_URL` | runtime | URL/base endpoint override for the related service. Source: src/utils/providerDiscovery.ts. | `https://example.com` | `src/utils/providerDiscovery.ts` |
| `BAT_THEME` | runtime | Environment value read by GakrCLI or related tracked code. Source: src/native-ts/color-diff/index.ts. | `1` | `src/native-ts/color-diff/index.ts` |
| `BEDROCK_BASE_URL` | runtime | URL/base endpoint override for the related service. Source: src/utils/status.tsx. | `https://example.com` | `src/utils/status.tsx` |
| `CLAUBBIT` | runtime | Environment value read by GakrCLI or related tracked code. Source: src/interactiveHelpers.tsx. | `1` | `src/interactiveHelpers.tsx` |
| `COO_RUNNING_ON_HOMESPACE` | runtime | Environment value read by GakrCLI or related tracked code. Source: src/utils/envUtils.ts. | `1` | `src/utils/envUtils.ts` |
| `CURSOR_TRACE_ID` | runtime | Environment value read by GakrCLI or related tracked code. Source: src/utils/env.ts. | `1` | `src/utils/env.ts` |
| `DEMO_VERSION` | runtime | Environment value read by GakrCLI or related tracked code. Source: src/components/LogoV2/LogoV2.tsx. | `1` | `src/components/LogoV2/LogoV2.tsx` |
| `GAKRCLI_VSCODE_SDK_PATH` | runtime | Environment value read by GakrCLI or related tracked code. Source: vscode-extension/gakrcli-vscode/src/process/processManager.ts. | `C:\\path\\to\\value` | `vscode-extension/gakrcli-vscode/src/process/processManager.ts` |
| `GAKRCLI_WORKSPACE_DIR` | runtime | Override persistent GakrCLI workspace directory. | `C:\\path\\to\\value` | `src/utils/envUtils.ts` |
| `GAKRCLI_WORKSPACE_TEMPLATE_DIR` | runtime | Override workspace template seed directory. | `C:\\path\\to\\value` | `src/utils/workspace.test.ts` |
| `GNOME_TERMINAL_SERVICE` | runtime | Environment value read by GakrCLI or related tracked code. Source: src/utils/env.ts. | `1` | `src/utils/env.ts` |
| `GROWTHBOOK_CLIENT_KEY` | runtime | Environment value read by GakrCLI or related tracked code. Source: src/constants/keys.ts. | `replace-with-secret` | `src/constants/keys.ts` |
| `GRPC_HOST` | runtime | Environment value read by GakrCLI or related tracked code. Source: scripts/grpc-cli.ts. | `1` | `scripts/grpc-cli.ts` |
| `GRPC_PORT` | runtime | Environment value read by GakrCLI or related tracked code. Source: scripts/grpc-cli.ts. | `50051` | `scripts/grpc-cli.ts` |
| `HTTP_PROXY` | runtime | Environment value read by GakrCLI or related tracked code. Source: src/services/api/fetchWithProxyRetry.test.ts. | `1` | `src/services/api/fetchWithProxyRetry.test.ts` |
| `HTTPS_PROXY` | runtime | Environment value read by GakrCLI or related tracked code. Source: src/services/api/fetchWithProxyRetry.test.ts. | `1` | `src/services/api/fetchWithProxyRetry.test.ts` |
| `IS_DEMO` | runtime | Environment value read by GakrCLI or related tracked code. Source: src/commands.ts. | `1` | `src/commands.ts` |
| `IS_SANDBOX` | runtime | Environment value read by GakrCLI or related tracked code. Source: src/services/api/withRetry.ts. | `1` | `src/services/api/withRetry.ts` |
| `ITERM_SESSION_ID` | runtime | Environment value read by GakrCLI or related tracked code. Source: src/utils/swarm/backends/detection.ts. | `1` | `src/utils/swarm/backends/detection.ts` |
| `MONOREPO_ROOT_DIR` | runtime | Environment value read by GakrCLI or related tracked code. Source: src/utils/computerUse/gates.ts. | `C:\\path\\to\\value` | `src/utils/computerUse/gates.ts` |
| `MY_API_KEY` | runtime | API key for MY integration/provider. Source: src/entrypoints/sdk/shared.ts. | `replace-with-secret` | `src/entrypoints/sdk/shared.ts` |
| `MYPROVIDER_API_KEY` | runtime | API key for MYPROVIDER integration/provider. Source: src/tools/WebSearchTool/README_SEARCH_PROVIDERS.md. | `replace-with-secret` | `src/tools/WebSearchTool/README_SEARCH_PROVIDERS.md` |
| `NO_PROXY` | runtime | Environment value read by GakrCLI or related tracked code. Source: src/services/mcp/client.ts. | `1` | `src/services/mcp/client.ts` |
| `NODE_ENV` | runtime | Environment value read by GakrCLI or related tracked code. Source: assets/skills/API-Atlas/api-endpoint-builder/SKILL.md. | `1` | `assets/skills/API-Atlas/api-endpoint-builder/SKILL.md` |
| `NODE_EXTRA_CA_CERTS` | runtime | Environment value read by GakrCLI or related tracked code. Source: src/main.tsx. | `1` | `src/main.tsx` |
| `NODE_OPTIONS` | runtime | Environment value read by GakrCLI or related tracked code. Source: bin/gakrcli.js. | `1` | `bin/gakrcli.js` |
| `OLLAMA_BASE_URL` | runtime | URL/base endpoint override for the related service. Source: src/utils/model/ollamaModels.ts. | `https://example.com` | `src/utils/model/ollamaModels.ts` |
| `P4PORT` | runtime | Environment value read by GakrCLI or related tracked code. Source: src/utils/platform.ts. | `50051` | `src/utils/platform.ts` |
| `SAFEUSER` | runtime | Environment value read by GakrCLI or related tracked code. Source: src/commands/commit-push-pr.ts. | `1` | `src/commands/commit-push-pr.ts` |
| `SESSIONNAME` | runtime | Environment value read by GakrCLI or related tracked code. Source: src/utils/env.ts. | `1` | `src/utils/env.ts` |
| `SSL_CERT_FILE` | runtime | Environment value read by GakrCLI or related tracked code. Source: src/upstreamproxy/upstreamproxy.ts. | `C:\\path\\to\\value` | `src/upstreamproxy/upstreamproxy.ts` |
| `TEST_ENABLE_SESSION_PERSISTENCE` | runtime | Environment value read by GakrCLI or related tracked code. Source: src/utils/sessionStorage.ts. | `1` | `src/utils/sessionStorage.ts` |
| `TILIX_ID` | runtime | Environment value read by GakrCLI or related tracked code. Source: src/utils/env.ts. | `1` | `src/utils/env.ts` |
| `UV_THREADPOOL_SIZE` | runtime | Environment value read by GakrCLI or related tracked code. Source: src/services/mcp/client.ts. | `128000` | `src/services/mcp/client.ts` |
| `VERTEX_BASE_URL` | runtime | URL/base endpoint override for the related service. Source: src/utils/status.tsx. | `https://example.com` | `src/utils/status.tsx` |
| `VOICE_STREAM_BASE_URL` | runtime | URL/base endpoint override for the related service. Source: src/services/voiceStreamSTT.ts. | `https://example.com` | `src/services/voiceStreamSTT.ts` |
| `WSL_DISTRO_NAME` | runtime | Environment value read by GakrCLI or related tracked code. Source: src/hooks/useDiffInIDE.ts. | `1` | `src/hooks/useDiffInIDE.ts` |
| `XTERM_VERSION` | runtime | Environment value read by GakrCLI or related tracked code. Source: src/utils/env.ts. | `1` | `src/utils/env.ts` |

### Test-only variables

| Variable | Scope | Purpose | Example | Source |
| --- | --- | --- | --- | --- |
| `ANTHROPIC_DEFAULT_SONNET_MODEL_SUPPORTED_CAPABILITIES` | test-only | Used by tests or fixtures to exercise environment-dependent behavior. Source: src/utils/thinking.test.ts. | `model-id` | `src/utils/thinking.test.ts` |
| `BANKR_BASE_URL` | test-only | Used by tests or fixtures to exercise environment-dependent behavior. Source: src/services/api/openaiShim.test.ts. | `https://example.com` | `src/services/api/openaiShim.test.ts` |
| `BANKR_MODEL` | test-only | Used by tests or fixtures to exercise environment-dependent behavior. Source: src/services/api/openaiShim.test.ts. | `model-id` | `src/services/api/openaiShim.test.ts` |
| `CODEX_CREDENTIAL_SOURCE` | test-only | Used by tests or fixtures to exercise environment-dependent behavior. Source: src/utils/providerProfiles.test.ts. | `(usually set by environment)` | `src/utils/providerProfiles.test.ts` |
| `CODEX_OAUTH_CALLBACK_HOST` | test-only | Used by tests or fixtures to exercise environment-dependent behavior. Source: src/services/api/codexOAuth.test.ts. | `(usually set by environment)` | `src/services/api/codexOAuth.test.ts` |
| `CODEX_OAUTH_CALLBACK_PORT` | test-only | Used by tests or fixtures to exercise environment-dependent behavior. Source: src/services/api/codexOAuth.test.ts. | `50051` | `src/services/api/codexOAuth.test.ts` |
| `CODEX_OAUTH_CLIENT_ID` | test-only | Used by tests or fixtures to exercise environment-dependent behavior. Source: src/services/api/codexOAuth.test.ts. | `(usually set by environment)` | `src/services/api/codexOAuth.test.ts` |
| `COO_CREATOR` | test-only | Used by tests or fixtures to exercise environment-dependent behavior. Source: src/utils/user.test.ts. | `(usually set by environment)` | `src/utils/user.test.ts` |
| `DEEPSEEK_API_KEY` | test-only | Used by tests or fixtures to exercise environment-dependent behavior. Source: src/services/api/openaiShim.test.ts. | `replace-with-secret` | `src/services/api/openaiShim.test.ts` |
| `GAKR_CODE_ENABLE_HOOK_CHAINS` | test-only | Used by tests or fixtures to exercise environment-dependent behavior. Source: src/utils/hookChains.integration.test.ts. | `1` | `src/utils/hookChains.integration.test.ts` |
| `GAKR_CODE_GITHUB_TOKEN_HYDRATED` | test-only | Used by tests or fixtures to exercise environment-dependent behavior. Source: src/utils/githubModelsCredentials.hydrate.test.ts. | `(usually set by environment)` | `src/utils/githubModelsCredentials.hydrate.test.ts` |
| `GAKR_CODE_PROVIDER_PROFILE_ENV_APPLIED_ID` | test-only | Used by tests or fixtures to exercise environment-dependent behavior. Source: src/utils/model/modelOptions.xiaomi-mimo.test.ts. | `C:\\path\\to\\value` | `src/utils/model/modelOptions.xiaomi-mimo.test.ts` |
| `GAKRCLI_KNOWLEDGE_ORAMA` | test-only | Used by tests or fixtures to exercise environment-dependent behavior. Source: src/utils/knowledgeGraph.stress.test.ts. | `(usually set by environment)` | `src/utils/knowledgeGraph.stress.test.ts` |
| `GEMINI_AUTH_MODE` | test-only | Used by tests or fixtures to exercise environment-dependent behavior. Source: src/services/api/client.test.ts. | `(usually set by environment)` | `src/services/api/client.test.ts` |
| `GOOGLE_PROJECT_ID` | test-only | Used by tests or fixtures to exercise environment-dependent behavior. Source: src/utils/geminiAuth.test.ts. | `(usually set by environment)` | `src/utils/geminiAuth.test.ts` |
| `MOONSHOT_API_KEY` | test-only | Used by tests or fixtures to exercise environment-dependent behavior. Source: src/utils/providerValidation.test.ts. | `replace-with-secret` | `src/utils/providerValidation.test.ts` |
| `OPENROUTER_API_KEY` | test-only | Used by tests or fixtures to exercise environment-dependent behavior. Source: src/commands/model/model.test.tsx. | `replace-with-secret` | `src/commands/model/model.test.tsx` |
| `TOGETHER_API_KEY` | test-only | Used by tests or fixtures to exercise environment-dependent behavior. Source: src/integrations/discoveryService.test.ts. | `replace-with-secret` | `src/integrations/discoveryService.test.ts` |

### Example-only variables from docs and bundled skills

| Variable | Scope | Purpose | Example | Source |
| --- | --- | --- | --- | --- |
| `ADMIN_PASSWORD` | docs/example | Example variable found in documentation or bundled skill reference; not required by GakrCLI runtime. Source: assets/skills/e2e-testing/e2e-testing-patterns/resources/implementation-playbook.md. | `replace-with-secret` | `assets/skills/e2e-testing/e2e-testing-patterns/resources/implementation-playbook.md` |
| `ALLOWED_ORIGINS` | docs/example | Example variable found in documentation or bundled skill reference; not required by GakrCLI runtime. Source: assets/skills/nodejs-backend-patterns/resources/implementation-playbook.md. | `(usually set by environment)` | `assets/skills/nodejs-backend-patterns/resources/implementation-playbook.md` |
| `API_KEY` | docs/example | Example variable found in documentation or bundled skill reference; not required by GakrCLI runtime. Source: assets/rules/java/security.md. | `replace-with-secret` | `assets/rules/java/security.md` |
| `API_SECRET` | docs/example | Example variable found in documentation or bundled skill reference; not required by GakrCLI runtime. Source: assets/skills/frontend-atlas/ui-ux-designer/ui-ux-pro-max/data/stacks/nuxtjs.csv. | `replace-with-secret` | `assets/skills/frontend-atlas/ui-ux-designer/ui-ux-pro-max/data/stacks/nuxtjs.csv` |
| `API_URL` | docs/example | Example variable found in documentation or bundled skill reference; not required by GakrCLI runtime. Source: assets/skills/nextjs-turbopack/nextjs-app-router-patterns/resources/implementation-playbook.md. | `https://example.com` | `assets/skills/nextjs-turbopack/nextjs-app-router-patterns/resources/implementation-playbook.md` |
| `BROWSER_USE_API_KEY` | docs/example | Example variable found in documentation or bundled skill reference; not required by GakrCLI runtime. Source: assets/skills/data-extraction/reference/admin.py. | `replace-with-secret` | `assets/skills/data-extraction/reference/admin.py` |
| `BU_BROWSER_ID` | docs/example | Example variable found in documentation or bundled skill reference; not required by GakrCLI runtime. Source: assets/skills/data-extraction/reference/daemon.py. | `(usually set by environment)` | `assets/skills/data-extraction/reference/daemon.py` |
| `BU_CDP_WS` | docs/example | Example variable found in documentation or bundled skill reference; not required by GakrCLI runtime. Source: assets/skills/data-extraction/reference/daemon.py. | `(usually set by environment)` | `assets/skills/data-extraction/reference/daemon.py` |
| `DATABASE_URL` | docs/example | Example variable found in documentation or bundled skill reference; not required by GakrCLI runtime. Source: assets/skills/frontend-atlas/ui-ux-designer/ui-ux-pro-max/data/stacks/nextjs.csv. | `https://example.com` | `assets/skills/frontend-atlas/ui-ux-designer/ui-ux-pro-max/data/stacks/nextjs.csv` |
| `DB_HOST` | docs/example | Example variable found in documentation or bundled skill reference; not required by GakrCLI runtime. Source: assets/skills/backend-atlas/backend-dev-guidelines/resources/configuration.md. | `(usually set by environment)` | `assets/skills/backend-atlas/backend-dev-guidelines/resources/configuration.md` |
| `DB_HSOT` | docs/example | Example variable found in documentation or bundled skill reference; not required by GakrCLI runtime. Source: assets/skills/backend-atlas/backend-dev-guidelines/resources/configuration.md. | `(usually set by environment)` | `assets/skills/backend-atlas/backend-dev-guidelines/resources/configuration.md` |
| `DB_NAME` | docs/example | Example variable found in documentation or bundled skill reference; not required by GakrCLI runtime. Source: assets/skills/backend-atlas/backend-dev-guidelines/resources/configuration.md. | `(usually set by environment)` | `assets/skills/backend-atlas/backend-dev-guidelines/resources/configuration.md` |
| `DB_PASSWORD` | docs/example | Example variable found in documentation or bundled skill reference; not required by GakrCLI runtime. Source: assets/skills/backend-atlas/backend-dev-guidelines/resources/configuration.md. | `replace-with-secret` | `assets/skills/backend-atlas/backend-dev-guidelines/resources/configuration.md` |
| `DB_PORT` | docs/example | Example variable found in documentation or bundled skill reference; not required by GakrCLI runtime. Source: assets/skills/backend-atlas/backend-dev-guidelines/resources/configuration.md. | `50051` | `assets/skills/backend-atlas/backend-dev-guidelines/resources/configuration.md` |
| `DB_USER` | docs/example | Example variable found in documentation or bundled skill reference; not required by GakrCLI runtime. Source: assets/skills/backend-atlas/backend-dev-guidelines/resources/configuration.md. | `(usually set by environment)` | `assets/skills/backend-atlas/backend-dev-guidelines/resources/configuration.md` |
| `DISPLAY` | docs/example | Example variable found in documentation or bundled skill reference; not required by GakrCLI runtime. Source: assets/skills/data-extraction/reference/admin.py. | `(usually set by environment)` | `assets/skills/data-extraction/reference/admin.py` |
| `EMAIL_FROM` | docs/example | Example variable found in documentation or bundled skill reference; not required by GakrCLI runtime. Source: assets/skills/frontend-atlas/javascript-pro/javascript-testing-patterns/resources/implementation-playbook.md. | `(usually set by environment)` | `assets/skills/frontend-atlas/javascript-pro/javascript-testing-patterns/resources/implementation-playbook.md` |
| `EVENTBRITE_TOKEN` | docs/example | Example variable found in documentation or bundled skill reference; not required by GakrCLI runtime. Source: assets/skills/data-extraction/business-productivity/eventbrite/scraping.md. | `replace-with-secret` | `assets/skills/data-extraction/business-productivity/eventbrite/scraping.md` |
| `EXAMPLE_API_KEY` | docs/example | Example variable found in documentation or bundled skill reference; not required by GakrCLI runtime. Source: assets/skills/mcp-builder/reference/node_mcp_server.md. | `replace-with-secret` | `assets/skills/mcp-builder/reference/node_mcp_server.md` |
| `FRED_KEY` | docs/example | Example variable found in documentation or bundled skill reference; not required by GakrCLI runtime. Source: assets/skills/data-extraction/data-apis/fred/scraping.md. | `replace-with-secret` | `assets/skills/data-extraction/data-apis/fred/scraping.md` |
| `FRONTEND_URL` | docs/example | Example variable found in documentation or bundled skill reference; not required by GakrCLI runtime. Source: assets/skills/auth-implementation-patterns/resources/implementation-playbook.md. | `https://example.com` | `assets/skills/auth-implementation-patterns/resources/implementation-playbook.md` |
| `GIT_COMMIT_SHA` | docs/example | Example variable found in documentation or bundled skill reference; not required by GakrCLI runtime. Source: assets/skills/error-diagnostics-smart-debug/error-debugging-error-analysis/resources/implementation-playbook.md. | `(usually set by environment)` | `assets/skills/error-diagnostics-smart-debug/error-debugging-error-analysis/resources/implementation-playbook.md` |
| `GOOGLE_CLIENT_ID` | docs/example | Example variable found in documentation or bundled skill reference; not required by GakrCLI runtime. Source: assets/skills/auth-implementation-patterns/resources/implementation-playbook.md. | `(usually set by environment)` | `assets/skills/auth-implementation-patterns/resources/implementation-playbook.md` |
| `GOOGLE_CLIENT_SECRET` | docs/example | Example variable found in documentation or bundled skill reference; not required by GakrCLI runtime. Source: assets/skills/auth-implementation-patterns/resources/implementation-playbook.md. | `replace-with-secret` | `assets/skills/auth-implementation-patterns/resources/implementation-playbook.md` |
| `INSTANCE_ID` | docs/example | Example variable found in documentation or bundled skill reference; not required by GakrCLI runtime. Source: assets/skills/error-diagnostics-smart-debug/error-debugging-error-analysis/resources/implementation-playbook.md. | `(usually set by environment)` | `assets/skills/error-diagnostics-smart-debug/error-debugging-error-analysis/resources/implementation-playbook.md` |
| `JWT_REFRESH_SECRET` | docs/example | Example variable found in documentation or bundled skill reference; not required by GakrCLI runtime. Source: assets/skills/auth-implementation-patterns/resources/implementation-playbook.md. | `replace-with-secret` | `assets/skills/auth-implementation-patterns/resources/implementation-playbook.md` |
| `JWT_SECRET` | docs/example | Example variable found in documentation or bundled skill reference; not required by GakrCLI runtime. Source: assets/skills/auth-implementation-patterns/resources/implementation-playbook.md. | `replace-with-secret` | `assets/skills/auth-implementation-patterns/resources/implementation-playbook.md` |
| `KEYCLOAK_BASE_URL` | docs/example | Example variable found in documentation or bundled skill reference; not required by GakrCLI runtime. Source: assets/skills/backend-atlas/backend-dev-guidelines/resources/configuration.md. | `https://example.com` | `assets/skills/backend-atlas/backend-dev-guidelines/resources/configuration.md` |
| `LOG_LEVEL` | docs/example | Example variable found in documentation or bundled skill reference; not required by GakrCLI runtime. Source: assets/skills/nodejs-backend-patterns/resources/implementation-playbook.md. | `(usually set by environment)` | `assets/skills/nodejs-backend-patterns/resources/implementation-playbook.md` |
| `MONGODB_URI` | docs/example | Example variable found in documentation or bundled skill reference; not required by GakrCLI runtime. Source: assets/skills/nodejs-backend-patterns/resources/implementation-playbook.md. | `(usually set by environment)` | `assets/skills/nodejs-backend-patterns/resources/implementation-playbook.md` |
| `NUXT_PUBLIC_API_BASE` | docs/example | Example variable found in documentation or bundled skill reference; not required by GakrCLI runtime. Source: assets/skills/frontend-atlas/ui-ux-designer/ui-ux-pro-max/data/stacks/nuxtjs.csv. | `https://example.com` | `assets/skills/frontend-atlas/ui-ux-designer/ui-ux-pro-max/data/stacks/nuxtjs.csv` |
| `OPENID_HTTP_TIMEOUT_MS` | docs/example | Example variable found in documentation or bundled skill reference; not required by GakrCLI runtime. Source: assets/skills/backend-atlas/backend-dev-guidelines/resources/configuration.md. | `60000` | `assets/skills/backend-atlas/backend-dev-guidelines/resources/configuration.md` |
| `PAYMENT_API_KEY` | docs/example | Example variable found in documentation or bundled skill reference; not required by GakrCLI runtime. Source: assets/rules/java/security.md. | `replace-with-secret` | `assets/rules/java/security.md` |
| `PORT` | docs/example | Example variable found in documentation or bundled skill reference; not required by GakrCLI runtime. Source: assets/skills/backend-atlas/backend-dev-guidelines/resources/configuration.md. | `50051` | `assets/skills/backend-atlas/backend-dev-guidelines/resources/configuration.md` |
| `REDIS_HOST` | docs/example | Example variable found in documentation or bundled skill reference; not required by GakrCLI runtime. Source: assets/skills/nodejs-backend-patterns/resources/implementation-playbook.md. | `(usually set by environment)` | `assets/skills/nodejs-backend-patterns/resources/implementation-playbook.md` |
| `REDIS_PORT` | docs/example | Example variable found in documentation or bundled skill reference; not required by GakrCLI runtime. Source: assets/skills/nodejs-backend-patterns/resources/implementation-playbook.md. | `50051` | `assets/skills/nodejs-backend-patterns/resources/implementation-playbook.md` |
| `REDIS_URL` | docs/example | Example variable found in documentation or bundled skill reference; not required by GakrCLI runtime. Source: assets/skills/auth-implementation-patterns/resources/implementation-playbook.md. | `https://example.com` | `assets/skills/auth-implementation-patterns/resources/implementation-playbook.md` |
| `REFRESH_TOKEN_SECRET` | docs/example | Example variable found in documentation or bundled skill reference; not required by GakrCLI runtime. Source: assets/skills/nodejs-backend-patterns/resources/implementation-playbook.md. | `replace-with-secret` | `assets/skills/nodejs-backend-patterns/resources/implementation-playbook.md` |
| `SENTRY_DSN` | docs/example | Example variable found in documentation or bundled skill reference; not required by GakrCLI runtime. Source: assets/skills/error-diagnostics-smart-debug/error-debugging-error-analysis/resources/implementation-playbook.md. | `(usually set by environment)` | `assets/skills/error-diagnostics-smart-debug/error-debugging-error-analysis/resources/implementation-playbook.md` |
| `SESSION_SECRET` | docs/example | Example variable found in documentation or bundled skill reference; not required by GakrCLI runtime. Source: assets/skills/auth-implementation-patterns/resources/implementation-playbook.md. | `replace-with-secret` | `assets/skills/auth-implementation-patterns/resources/implementation-playbook.md` |
| `SMTP_HOST` | docs/example | Example variable found in documentation or bundled skill reference; not required by GakrCLI runtime. Source: assets/skills/frontend-atlas/javascript-pro/javascript-testing-patterns/resources/implementation-playbook.md. | `(usually set by environment)` | `assets/skills/frontend-atlas/javascript-pro/javascript-testing-patterns/resources/implementation-playbook.md` |
| `SMTP_PASS` | docs/example | Example variable found in documentation or bundled skill reference; not required by GakrCLI runtime. Source: assets/skills/frontend-atlas/javascript-pro/javascript-testing-patterns/resources/implementation-playbook.md. | `(usually set by environment)` | `assets/skills/frontend-atlas/javascript-pro/javascript-testing-patterns/resources/implementation-playbook.md` |
| `SMTP_USER` | docs/example | Example variable found in documentation or bundled skill reference; not required by GakrCLI runtime. Source: assets/skills/frontend-atlas/javascript-pro/javascript-testing-patterns/resources/implementation-playbook.md. | `(usually set by environment)` | `assets/skills/frontend-atlas/javascript-pro/javascript-testing-patterns/resources/implementation-playbook.md` |
| `TIMEOUT` | docs/example | Example variable found in documentation or bundled skill reference; not required by GakrCLI runtime. Source: assets/skills/backend-atlas/backend-dev-guidelines/resources/configuration.md. | `60000` | `assets/skills/backend-atlas/backend-dev-guidelines/resources/configuration.md` |
| `TIMEOUT_MS` | docs/example | Example variable found in documentation or bundled skill reference; not required by GakrCLI runtime. Source: assets/skills/backend-atlas/backend-dev-guidelines/resources/configuration.md. | `60000` | `assets/skills/backend-atlas/backend-dev-guidelines/resources/configuration.md` |
| `TRANSPORT` | docs/example | Example variable found in documentation or bundled skill reference; not required by GakrCLI runtime. Source: assets/skills/mcp-builder/reference/node_mcp_server.md. | `50051` | `assets/skills/mcp-builder/reference/node_mcp_server.md` |
| `WAYLAND_DISPLAY` | docs/example | Example variable found in documentation or bundled skill reference; not required by GakrCLI runtime. Source: assets/skills/data-extraction/reference/admin.py. | `(usually set by environment)` | `assets/skills/data-extraction/reference/admin.py` |
| `X_ACCESS_SECRET` | docs/example | Example variable found in documentation or bundled skill reference; not required by GakrCLI runtime. Source: assets/skills/data-extraction/x-api/SKILL.md. | `replace-with-secret` | `assets/skills/data-extraction/x-api/SKILL.md` |
| `X_ACCESS_TOKEN` | docs/example | Example variable found in documentation or bundled skill reference; not required by GakrCLI runtime. Source: assets/skills/data-extraction/x-api/SKILL.md. | `replace-with-secret` | `assets/skills/data-extraction/x-api/SKILL.md` |
| `X_API_KEY` | docs/example | Example variable found in documentation or bundled skill reference; not required by GakrCLI runtime. Source: assets/skills/data-extraction/x-api/SKILL.md. | `replace-with-secret` | `assets/skills/data-extraction/x-api/SKILL.md` |
| `X_API_SECRET` | docs/example | Example variable found in documentation or bundled skill reference; not required by GakrCLI runtime. Source: assets/skills/data-extraction/x-api/SKILL.md. | `replace-with-secret` | `assets/skills/data-extraction/x-api/SKILL.md` |
| `X_BEARER_TOKEN` | docs/example | Example variable found in documentation or bundled skill reference; not required by GakrCLI runtime. Source: assets/skills/data-extraction/x-api/SKILL.md. | `replace-with-secret` | `assets/skills/data-extraction/x-api/SKILL.md` |

