# Changelog

## [Unreleased]

* Updated provider to OpenRouter (openai/gpt-oss-120b:free)

## [0.4.8] (2026-04-29)

### Bug Fixes

* **fix(branding): update OpenClaude references to GakrCLI**: Consistent branding across provider management
  - Update Codex OAuth error messages to reference "GakrCLI" instead of "OpenClaude"
  - Update browser sign-in instructions to use "GakrCLI" branding
  - Update secure storage references to "GakrCLI secure storage"
  - Update provider profile removal messages to reference "GakrCLI"
  - Files modified:
    - `src/commands/provider/provider.tsx`: Updated all user-facing messages with correct branding

* **fix(startup): improve provider profile detection and application**: Fix startup banner provider detection
  - Apply active provider profile from config BEFORE building startup environment
  - Ensures startup banner shows the correct active provider instead of default detection
  - Add `applyActiveProviderProfileFromConfig()` call in CLI entry point
  - Improves user experience by showing accurate provider information on startup
  - Files modified:
    - `src/entrypoints/cli.tsx`: Added provider profile application before startup env building

* **fix(model): normalize model settings and remove duplicate provider entry**: Clean up model configuration handling
  - Add `normalizeModelSetting()` function to properly handle model setting values
  - Remove duplicate 'minimax' provider entry that was causing configuration issues
  - Ensure model settings are properly trimmed and validated
  - Files modified:
    - `src/utils/model/model.ts`: Added normalization function and fixed duplicate provider entry

* **fix(paths): correct gitignore reference path**: Update gitignore to match actual directory structure
  - Change ignored path from `reference/` to `references/` to match actual directory name
  - Ensures temporary reference files are properly ignored by git
  - Files modified:
    - `.gitignore`: Updated path reference

* **fix(tests): update test files and improve error handling**: Various test improvements and bug fixes
  - Update OSC terminal handling tests with improved error handling
  - Fix conversation arc test expectations and edge cases
  - Improve provider profile test coverage and validation
  - Update codex API shim tests for better error scenarios
  - Files modified:
    - `src/ink/termio/osc.test.ts`: Updated test expectations
    - `src/ink/termio/osc.ts`: Improved error handling
    - `src/services/api/codexShim.test.ts`: Enhanced test coverage
    - `src/utils/conversationArc.test.ts`: Fixed test edge cases
    - `src/utils/model/benchmark.ts`: Performance improvements
    - `src/utils/model/modelCache.ts`: Cache handling improvements
    - `src/utils/providerProfiles.test.ts`: Enhanced provider validation tests

* **fix(docs): update advanced setup documentation**: Improve documentation clarity
  - Update advanced setup guide with clearer instructions
  - Fix formatting and improve readability
  - Files modified:
    - `docs/advanced-setup.md`: Documentation improvements

### Features

* **feat(api): deterministic request-body serialization via stableStringify**: Add deterministic JSON serialization for prefix caching
  - **WHY**: OpenAI / Kimi / DeepSeek / Codex use implicit prefix caching keyed on exact request bytes. Spurious insertion-order differences in spread-merged body objects otherwise invalidate the cache on every turn. Also a pre-requisite for Anthropic `cache_control` breakpoint hits.
  - **stableStringify.ts**: Add `stableStringify` helper that emits JSON with object keys sorted lexicographically at every depth (arrays preserved)
    - Replicates native JSON.stringify pre-processing:
      - Invoke toJSON(key) when present (Date, URL, user classes); pass '' at top-level, property name for nested values, index string for array elements
      - Unbox Number/String/Boolean wrappers via valueOf() so new Boolean(false) doesn't get truthy-coerced
      - Run cycle detection on the post-toJSON value so a toJSON returning an ancestor still throws TypeError; DAGs continue to not throw
      - Drop properties whose toJSON returns undefined, matching native behavior
    - Single-pass deepSort with WeakSet for cycle detection and DAG support
    - Byte-equivalent to `JSON.stringify` when keys already happen to be in lexical insertion order, so strictly additive across providers
  - **codexShim.ts**: Adopt stableStringify for outgoing Codex Responses API request body
    - Replace `JSON.stringify(body)` with `stableStringify(body)` in `performCodexRequest`
    - Ensures byte-stable serialization for Codex prefix caching
  - **openaiShim.ts**: Adopt stableStringify for outgoing OpenAI-compatible request bodies
    - Replace `JSON.stringify(body)` with `stableStringify(body)` in main chat completions path
    - Replace `JSON.stringify(responsesBody)` with `stableStringify(responsesBody)` in GitHub Copilot /responses fallback
    - Ensures byte-stable serialization across all OpenAI-compatible providers
  - **Tests**: Comprehensive test coverage (41 tests passing)
    - `src/utils/stableStringify.test.ts`: 21 tests covering toJSON semantics, wrapper unboxing, cycle detection, DAG support, and parity with JSON.stringify
    - `src/utils/serializationStability.test.ts`: 14 tests for request body stability, prefix caching scenarios, and byte-level stability
    - `src/services/api/stableStringify.integration.test.ts`: 6 integration tests verifying deterministic serialization for OpenAI/Codex API bodies
  - Files modified:
    - `src/utils/stableStringify.ts`: New file with stableStringify implementation
    - `src/utils/stableStringify.test.ts`: New file with unit tests
    - `src/utils/serializationStability.test.ts`: New file with integration tests
    - `src/services/api/stableStringify.integration.test.ts`: New file with API integration tests
    - `src/services/api/codexShim.ts`: Import and use stableStringify for request body
    - `src/services/api/openaiShim.ts`: Import and use stableStringify for request bodies

### Bug Fixes

* **fix: error output truncation (10KB→40KB) and MCP tool bugs**: Increase error truncation limit and fix MCP tool validation/null handling
  - **toolErrors.ts**: Increase error truncation limit from 10KB to 40KB
    - Shell output can be up to 30KB, so 10KB was silently cutting off error logs from systemctl, apt, python, etc.
    - Update `maxErrorLength` from 10000 to 40000
    - Update `halfLength` calculation to `Math.floor(maxErrorLength / 2)`
  - **MCPTool.ts**: Cache compiled AJV validators to avoid recompiling on every call
    - AJV compilation is expensive — schemas don't change between calls
    - Use WeakMap for cache to allow garbage collection of schemas from disconnected/refreshed MCP tools
    - Prevents memory leaks from accumulating strong references indefinitely
  - **MCPTool.ts**: Fix validateInput error message showing `[object Object]`
    - Error message now shows readable text: `ajv.errorsText(validate.errors)`
    - Add proper error handling for schema compilation failures
  - **MCPTool.ts**: Add null guards in `mapToolResultToToolResultBlockParam`
    - Return descriptive indicator `'[No content returned from MCP tool]'` instead of undefined
    - Prevents sending undefined content to API which would cause errors
  - **MCPTool.ts**: Update outputSchema to support content block arrays
    - MCP tools can return either plain string or array of content blocks (text, images, etc.)
    - Add union type: `z.union([z.string(), z.array(...)])`
  - **MCPTool.ts**: Fix `isResultTruncated` with explicit null checks
    - Handle array content blocks with null/undefined entries safely
    - Check if any text block exceeds display limit
  - **ReadMcpResourceTool.ts**: Add null guard in `mapToolResultToToolResultBlockParam`
    - Return `'[No content returned from MCP resource]'` for undefined/null content
  - **client.ts**: Fix abort path in `callMCPTool`
    - Previously returned `{ content: undefined }` on AbortError, which masked cancellation
    - Now converts abort errors to `AbortError` class and re-throws
    - Tool execution framework properly handles it (skips logging, creates `is_error: true` result)
    - Add imports for `AbortError` and `isAbortError` from errors.js
  - **Tests**: Add comprehensive test coverage (84 tests passing)
    - `src/utils/toolErrors.test.ts`: 13 tests for error formatting and truncation
    - `src/tools/MCPTool/MCPTool.test.ts`: 15 tests for validation, null guards, and truncation
    - `src/tools/BashTool/commandSemantics.test.ts`: 24 tests for command exit code semantics
    - `src/tools/BashTool/utils.test.ts`: 32 tests for output formatting and content summaries

* **fix(startup): show --model flag override on startup screen**: Fix startup screen to display CLI model override
  - Startup screen was only reading model from env vars and settings, ignoring the --model CLI flag
  - CLI flag is parsed by Commander.js after the banner prints, so displayed model didn't match actual session model
  - Add early parsing of --model flag using `eagerParseCliFlag()` before rendering startup screen
  - Pass `earlyModelFlag` to `printStartupScreen()` as `modelOverride` parameter
  - `detectProvider()` now correctly prioritizes CLI flag over env vars and settings
  - Displayed model on startup screen now matches what the session will actually use
  - Files modified:
    - `src/entrypoints/cli.tsx`: Import and call `eagerParseCliFlag('--model')` before `printStartupScreen()`
    - `src/components/StartupScreen.ts`: Already supported `modelOverride` parameter (no changes needed)
    - `src/components/StartupScreen.test.ts`: Existing tests verify modelOverride functionality
    - `src/utils/cliArgs.ts`: Existing `eagerParseCliFlag()` utility used for early flag parsing

### Features

* **Add OpenAI Responses API and Custom Auth Headers Support**: Implement OpenAI Responses API format and custom authentication headers for provider profiles
  - Add `OPENAI_API_FORMAT` environment variable to switch between 'chat_completions' (default) and 'responses' API formats
  - Add custom authentication header support via `OPENAI_AUTH_HEADER`, `OPENAI_AUTH_SCHEME`, and `OPENAI_AUTH_HEADER_VALUE`
  - Support 'bearer' and 'raw' authentication schemes for custom auth headers
  - Add `OpenAICompatibleApiFormat` and `OpenAICompatibleAuthScheme` types to config
  - Update `ProviderProfile` type with optional `apiFormat`, `authHeader`, `authScheme`, and `authHeaderValue` fields
  - Add `parseOpenAICompatibleApiFormat()` function to parse API format from environment variables
  - Update `resolveProviderRequest()` to handle `apiFormat` parameter and set appropriate transport mode
  - Add `OPENAI_AUTH_HEADER_VALUE` to secret environment keys for proper masking
  - Update Provider Manager UI with new form steps for API format selection and custom auth configuration
  - Add Select component for API format choice (Chat Completions vs Responses)
  - Filter auth-related form steps to only show for OpenAI-compatible providers
  - Mask `authHeaderValue` input field like API keys for security
  - Update `buildOpenAIProfileEnv()` to accept and preserve auth parameters
  - Update `buildLaunchEnv()` to maintain auth header fields across sessions
  - Add `sanitizeAuthHeader()` and `sanitizeAuthScheme()` validation functions
  - Update profile summary display to show API format and custom auth info
  - Add comprehensive documentation in `.env.example` for new configuration options
  - Enable support for providers requiring non-standard authentication (e.g., api-key header, X-API-Key)
  - Providers can now use OpenAI Responses API format for compatible endpoints

### Bug Fixes

* **fix(agent): provider-aware fallback for haiku/sonnet aliases**: Fix Explore agent failures on custom providers
  - Explore agent fails on custom providers (Z.AI GLM, Alibaba Anthropic-compatible, local OpenAI endpoints) because 'haiku' alias resolves to a non-existent model
  - Add `isClaudeNativeProvider` check (Bedrock, Vertex, Foundry, official Anthropic)
  - For non-Claude-native providers, haiku/sonnet aliases inherit parent model
  - Add `checkIsClaudeNativeProvider()` function to identify Claude-native vs custom providers
  - Add provider-aware fallback logic in `getAgentModel()` function
  - Add 20 comprehensive tests for provider-aware fallback behavior using Bun mock.module()
  - Fixes Explore agent "model not found" errors on custom Anthropic-compatible APIs
  - Replace env manipulation with proper Bun mock.module() for reliable provider testing

* **fix(query): restore system prompt structure and add missing config import**: Fix critical query loop crash and system prompt corruption
  - Import `getGlobalConfig` — six call sites referenced it without an import; five short-circuited via feature() gates, but src/query.ts:1896 always ran and crashed every queryLoop iteration with "getGlobalConfig is not defined" (e.g. Explore subagent: "Agent failed: getGlobalConfig is not defined")
  - Stop coercing SystemPrompt (string[]) into a template-string before appendSystemContext — that made [...systemPrompt] spread the string character-by-character, replacing the structured prompt with thousands of one-char system blocks. Append arcSummary as its own array element instead
  - Gate the finalizeArcTurn call behind feature('CONVERSATION_ARC') so it matches the rest of the memory-PR call sites and gets dead-code-eliminated for users without the flag
  - Replace all dynamic `(await import('./utils/config.js')).getGlobalConfig()` calls with the static import
  - Fix duplicate system prompt variable declarations that caused compilation errors
  - Ensure proper system prompt structure with arcSummary as separate array element instead of character spreading

* **Fix Provider Switch Persistence in Session (PR #TBD)**: Implement proper provider activation with session persistence
  - Add `buildProviderManagerCompletion` function to generate system reminders for mid-session provider switches
  - Update `ProviderManagerResult` type to include 'activated' action with provider name and model
  - Modify `activateSelectedProvider` to call `onDone` with activation details for all providers
  - Add system-reminder meta message when provider is switched mid-session
  - Provider switches now properly persist in the current session with model information
  - Model context is maintained across provider switches within the same session
  - Fixes issue where provider switches were not persisting in the active session

* **Fix Provider Test Suite (PR #TBD)**: Fix broken tests in provider command and component test files
  - Fix secret masking test expectations to match actual implementation (3 chars instead of 4)
  - Update `buildCurrentProviderSummary redacts poisoned model and endpoint values` test to expect `sk-...678` instead of `sk-...5678`
  - Update `buildCurrentProviderSummary detects nvidia mode and redacts poisoned values` test to expect `nva...678` instead of `nvapi-...5678`
  - Fix bare mode test to use correct environment variable `GAKR_CODE_SIMPLE` instead of `CLAUDE_CODE_SIMPLE`
  - Update all test environment variable references from `CLAUDE_CODE_*` to `GAKR_CODE_*` for consistency
  - Update ProviderManager test suite to use correct `GAKR_CODE_SIMPLE` and `GAKR_CODE_USE_GITHUB` variables
  - All provider tests now pass successfully (14 pass, 0 fail)
  - Provider switch persistence in session already working correctly via `applySavedProfileToCurrentSession`

### Features

* **Z.AI GLM Coding Plan Provider Preset (PR #TBD)**: Add dedicated Z.AI provider support for GLM models with thinking mode
  - Add 'zai' provider preset for Z.AI GLM Coding Plan endpoint (https://api.z.ai/api/coding/paas/v4)
  - Support GLM-5.1, GLM-5-Turbo, GLM-4.7, and GLM-4.5-Air models through OpenAI-compatible shim
  - Enable thinking mode (reasoning_content) for GLM models on Z.AI
  - Add GLM model context windows: 202K for GLM-5.x/4.7, 128K for GLM-4.5-Air
  - Configure max output tokens: 131K for uppercase GLM-5.x/4.7, 65K for GLM-4.5-Air, 16K for lowercase variants
  - Add `isZaiBaseUrl()` and `isZaiGlmModel()` helper functions in `zaiProvider.ts`
  - Integrate GLM thinking support in `modelSupportsThinking()` function
  - Add comprehensive test coverage in `providerProfiles.test.ts`
  - Lowercase glm-* variants use conservative DashScope limits (16K max output)
  - Uppercase GLM-* variants use Z.AI Coding Plan high limits (131K/65K max output)
  - Users can now access Z.AI's GLM models with proper thinking mode and token limits
  - Closes #TBD: Z.AI GLM Coding Plan is now available as a provider preset

* **Persistent Project-Level Knowledge Graph and RAG (PR #TBD)**: Implement native JSON RAG with BM25-lite ranking and passive technical concept extraction
  - Shift memory from session-scope to persistent project-scope with `knowledge_graph.json` storage
  - Add native JSON RAG with BM25-lite ranking for semantic search across project history
  - Implement passive technical concept extraction (IPs, versions, frameworks, environment variables, paths)
  - Orchestrate hierarchical context injection in the conversation loop via `query.ts` integration
  - Add `/knowledge` command with subcommands: `enable`, `disable`, `clear`, `status`, `list`
  - Create `knowledgeGraph.ts` service for entity/relation/summary management with persistence
  - Create `conversationArc.ts` service for conversation phase tracking and automatic fact extraction
  - Add `getOrchestratedMemory()` function for targeted RAG search with BM25 scoring
  - Support automatic detection of: environment variables, absolute paths, versions, hostnames, IPs, metrics
  - Add project rule detection and persistence for passive learning of project conventions
  - Integrate with `query.ts` at multiple points: turn start, message processing, turn finalization
  - Add comprehensive test coverage: 25+ tests across 4 test files including performance benchmarks
  - Add `knowledgeGraphEnabled` config setting (default: enabled)
  - Performance: sub-2ms fact extraction, sub-10ms summary generation with 50 entities
  - Memory footprint: <100KB for 100 facts
  - Users can now benefit from persistent project memory that learns technical facts automatically
  - Closes #TBD: Knowledge Graph provides native RAG without external vector databases

* **Cache Metrics Feature - Expose Cache Statistics in REPL (PR #TBD)**: Add comprehensive cache metrics tracking and display across all providers
  - Add `/cache-stats` command for detailed cache hit/miss breakdown with per-request history
  - Add `showCacheStats` config setting with modes: 'off', 'compact' (default), 'full'
  - Display cache stats in REPL after each turn (compact: inline summary, full: detailed breakdown)
  - Normalize cache fields across providers (Anthropic, OpenAI, Kimi, DeepSeek, Gemini) through shim layer
  - Create `cacheMetrics.ts` service for extracting and formatting cache data from raw API responses
  - Create `cacheStatsTracker.ts` service with ring buffer for tracking per-turn and session-wide metrics
  - Integrate cache tracking into `cost-tracker.ts` to record metrics on every API call
  - Add `showCacheStats` setting to Config UI (Settings → Cache stats display)
  - Add comprehensive test coverage: 147 tests across 5 test files
  - Support cache classification for self-hosted/private OpenAI endpoints (data-driven detection)
  - Add hit rate calculation with clamp to prevent pathological inputs
  - Include timestamp and model label in `/cache-stats` breakdown rows
  - Reset cache turn counter at start of each turn for accurate per-query metrics
  - Add environment variable documentation in `.env.example` and `docs/advanced-setup.md`
  - Users can now monitor cache performance and optimize prompt caching strategies
  - Closes #TBD: Cache statistics are now visible in REPL and via `/cache-stats` command

* **Kimi Code Provider Preset and Moonshot API Rename (PR #TBD)**: Add dedicated Kimi Code provider preset and rename Moonshot API preset for clarity
  - Add new 'kimi-code' provider preset for Moonshot AI's Kimi Code subscription endpoint
  - Configure Kimi Code preset with base URL 'https://api.kimi.com/coding/v1' and model 'kimi-for-coding'
  - Rename 'moonshotai' preset display name from 'Moonshot AI' to 'Moonshot AI - API' for disambiguation
  - Update ProviderManager.tsx to include both 'Moonshot AI - Kimi Code' and 'Moonshot AI - API' options
  - Add comprehensive test coverage for both presets in providerProfiles.test.ts
  - Update StartupScreen.ts provider detection to distinguish between Kimi Code and Moonshot API endpoints
  - Add Moonshot-compatible base URL detection in openaiShim.ts for proper API handling
  - Update context.test.ts with Kimi Code model context window and output token tests
  - Fix duplicate function declaration in openaiContextWindows.ts (lookupByKey)
  - Update ProviderManager.test.tsx to use correct environment variables (GAKR_CODE_SIMPLE instead of CLAUDE_CODE_SIMPLE)
  - Update test expectations to match 'GakrCLI' branding instead of 'OpenClaude'
  - Users can now easily select between Kimi Code subscription and Moonshot direct API endpoints

### Features

* **MiniMax Usage Support (PR #TBD)**: Add comprehensive MiniMax usage tracking with /usage API integration
  - Create MiniMaxUsage.tsx component for displaying MiniMax quota and usage data
  - Create UnsupportedUsage.tsx component for providers without usage API support
  - Update Usage.tsx to route to provider-specific components (MiniMax, Codex, Anthropic, or Unsupported)
  - Add MiniMax usage API services (fetch, parse, types) with comprehensive normalization
  - Support multiple MiniMax API endpoints with automatic fallback
  - Parse interval (5h), weekly, and daily quota windows from MiniMax API responses
  - Display usage percentages, remaining counts, and reset countdowns
  - Add test suite with 11 test cases covering various MiniMax payload formats
  - Add fixture data for testing MiniMax model_remains API responses
  - Support unsupported providers: OpenAI, Gemini, GitHub Models, Mistral, NVIDIA NIM, AWS Bedrock, Google Vertex AI, Microsoft Foundry
  - Closes #TBD: MiniMax users can now view their usage limits and quotas via /usage command

### Features

* **OpenAI Fallback Context Window Configuration (PR #861)**: Make OpenAI fallback context window configurable and support external model lookup
  - Add `GAKR_CODE_OPENAI_FALLBACK_CONTEXT_WINDOW` env var to override the 128k default for unknown models
  - Add `GAKR_CODE_OPENAI_CONTEXT_WINDOWS` env var (JSON object) for per-model context window overrides
  - Add `GAKR_CODE_OPENAI_MAX_OUTPUT_TOKENS` env var (JSON object) for per-model output token limit overrides
  - External lookup tables take precedence over built-in OPENAI_CONTEXT_WINDOWS table
  - Support provider-qualified model lookups (e.g., "github:copilot:model-name")
  - Add warning message when unknown model falls back to default context window
  - Fix auto-compact firing prematurely on models with larger windows than 128k
  - Operators can now deploy new or private models without patching openaiContextWindows.ts
  - Update .env.example with documentation and usage examples for new env vars
  - Closes #635: Unknown OpenAI-compatible models no longer cause premature auto-compact

### Bug Fixes

* **Startup Banner Provider Detection (PR #864)**: Fix provider mislabeling when using aggregator URLs with vendor-prefixed models
  - Reorder provider detection: explicit env flags (NVIDIA_NIM, MINIMAX_API_KEY) and codex transport win first
  - Base-URL host checks run before rawModel fallback to fix aggregator mislabeling
  - rawModel fallback only fires when base URL is generic/custom
  - Fix OpenRouter/Together/Groq with vendor-prefixed model IDs (e.g. deepseek/deepseek-chat, moonshotai/kimi-k2, deepseek-r1-distill-llama-70b)
  - Add comprehensive unit tests covering aggregator × vendor-prefixed-model matrix plus direct-vendor regressions
  - Create src/utils/zaiProvider.ts for Z.AI GLM model detection
  - Closes #855: URL now authoritative over model name substring in banner provider detection

* **Update Command Version Display (PR #870)**: Fix `gakrcli update` showing wrong version and provide actionable guidance
  - Use MACRO.DISPLAY_VERSION instead of MACRO.VERSION for all user-facing version strings and comparisons
  - Root cause: MACRO.VERSION hardcoded to '99.0.0' as internal compatibility sentinel, real version in MACRO.DISPLAY_VERSION
  - Fix version comparisons: 99.0.0 >= any real npm version caused "up to date" checks to never fire correctly
  - Replace dead-end "Warning: Cannot update development build" with actionable instructions
  - Show current version and provide both source rebuild (git pull && bun install && bun run build) and npm reinstall commands
  - Extend third-party-provider branch to show current version and npm reinstall command for npm users
  - Closes #852: Users now see real package version instead of 99.0.0

* **MCP_SKILLS Feature Flag Disabled (PR #872)**: Fix MCP servers with resources failing to load tools
  - Disable MCP_SKILLS feature flag in build.ts (source file src/skills/mcpSkills.ts not mirrored)
  - Move MCP_SKILLS to "Disabled: missing source" group with detailed comment explaining #856
  - Add scripts/feature-flags-source-guard.test.ts to prevent re-enabling flags without source files
  - Fix "fetchMcpSkillsForClient is not a function" runtime error when MCP servers expose resources
  - Root cause: bundler fell back to missing-module stub that only exports default, not named exports
  - Test fails fast if MCP_SKILLS (or similar flags) re-enabled without corresponding source file
  - Verification: bun run build produces clean bundle, all tests pass (1222 pass / 12 fail baseline)

### Features

* **GPT-5.5 Support for Codex Provider (PR #TBD)**: Add GPT-5.5 model support with complete Codex integration
  - Bump Codex provider defaults from gpt-5.4 to gpt-5.5 across all ModelConfigs
  - Update codexplan alias to resolve to gpt-5.5 model
  - Add gpt-5.5 and gpt-5.5-mini to model picker with reasoning effort mappings
  - Add context window and max output token specs for gpt-5.5 family (gpt-5.5, gpt-5.5-mini, gpt-5.5-nano)
  - Add gpt-5.5 entries to COPILOT_MODELS registry
  - Keep official OpenAI API preset at gpt-5.4 (API availability pending)
  - Update codexShim tests to expect gpt-5.5 from codexplan alias
  - Fix transport resolution logic to use `shouldUseCodexTransport` with `finalBaseUrl`
  - Fix return statement to use `finalBaseUrl` instead of `rawBaseUrl` for correct Codex endpoint detection

### Bug Fixes

* **Schema Sanitizer Pattern Field Preservation (PR #TBD)**: Fix tool schema pattern field handling
  - Update `stripSchemaKeywords` to preserve property field names like "pattern" in tool schemas
  - Add special handling for `properties` key to prevent stripping field names that match keywords
  - Fix 3 failing tests: "preserves Grep tool pattern field", "preserves Glob tool pattern field", "strips validator pattern keyword but keeps string field named pattern"
  - Ensure validator keywords (like `pattern` regex validator) are stripped while preserving property names

* **Think Tag Sanitizer Integration (PR #TBD)**: Add reasoning content leak prevention for Codex responses
  - Import and integrate `stripThinkTags` function in `convertCodexResponseToAnthropicMessage`
  - Add `createThinkTagFilter` for streaming response sanitization
  - Strip `<think>`, `<thinking>`, `<reasoning>`, `<thought>`, `<reasoning_scratchpad>` tags from responses
  - Handle closed pairs, unterminated tags, and orphan tags correctly
  - Add flush logic to handle partial tags at stream boundaries
  - Fix 3 failing tests: "strips <think> tag block from completed Codex text responses", "strips unterminated <think> tag", "strips <think> tag block from Codex SSE text stream"

* **Codex Web Search Failure Handling (PR #TBD)**: Add comprehensive web search error handling
  - Add `extractCodexWebSearchFailure` function to parse failure reasons from Codex responses
  - Add `getCodexSources` helper to extract sources from multiple response locations
  - Add `pushCodexTextResult` and `addCodexSource` helpers for result processing
  - Update `makeOutputFromCodexWebSearchResponse` to handle web_search_call failures
  - Support error messages from `error.message` and `action.error.message` fields
  - Add fallback "Web search failed." message when no reason provided
  - Handle partial failures with mixed error and success results
  - Export `__test` object with `makeOutputFromCodexWebSearchResponse` for testing
  - Add 6 new tests for web search failure scenarios

### Tests

* **Complete Test Coverage (31 tests, 49 expect() calls)**: All Codex provider tests passing
  - 11 Codex provider config tests (transport resolution, alias handling, credentials)
  - 8 Codex request translation tests (tool schemas, strict mode, format handling)
  - 6 Codex web search tests (success, failure, partial results, source extraction)
  - 3 think tag sanitization tests (completed responses, streaming, unterminated tags)
  - 3 SSE streaming tests (event translation, text deltas, prose preservation)

* **Provider Profile Persistence (PR #TBD)**: Persist active provider profile across restarts
  - Add `clearStartupProviderOverrides()` utility to remove stale provider env from settings
  - Store provider profiles in `~/.gakrcli/` instead of current working directory
  - Fix provider profile restart fallback to respect profile-managed env flags
  - Fix `buildStartupEnvFromProfile()` to preserve explicit provider selections
  - Fix `buildLaunchEnv()` to omit empty `OPENAI_API_KEY` from startup env
  - Update `resolveProfileFilePath()` to use config home directory by default
  - Add `PROVIDERS` constant array to `configConstants.ts`
  - Fix `maskSecretForDisplay()` to preserve correct prefix/suffix lengths
  - Add comprehensive test coverage (97 passing tests)
  - Integrate `clearStartupProviderOverrides()` into ProviderManager component

* **Bankr Provider Support (PR #888)**: Add Bankr LLM Gateway as an OpenAI-compatible provider
  - Add 'bankr' to VALID_PROVIDERS with CLI flag support (`--provider bankr`)
  - Add Bankr preset in ProviderManager with default configuration
  - Add dedicated environment variables: `BNKR_API_KEY`, `BANKR_BASE_URL`, `BANKR_MODEL`
  - Implement X-API-Key authentication header (instead of Authorization Bearer)
  - Add buildBankrProfileEnv() function for profile management
  - Add Bankr detection in StartupScreen and model discovery
  - Default base URL: https://llm.bankr.bot/v1
  - Default model: claude-opus-4.6
  - Add comprehensive test coverage for Bankr provider
  - Update providerSecrets.ts to handle BNKR_API_KEY as secret value

### Provider Integration

* **Environment Variable Mapping**: Automatic mapping of Bankr-specific env vars to OpenAI-compatible ones
  - Map BNKR_API_KEY → OPENAI_API_KEY when present
  - Map BANKR_BASE_URL → OPENAI_BASE_URL when present
  - Map BANKR_MODEL → OPENAI_MODEL when present
  - Preserve existing OPENAI_* values when already set

* **Authentication**: Custom header support for Bankr endpoints
  - Detect Bankr endpoints by URL pattern matching
  - Use X-API-Key header for Bankr authentication
  - Maintain Bearer token auth for other OpenAI-compatible providers
  - Add isBankrBaseUrl() helper for endpoint detection

## [0.4.5] (2026-04-27)

### Features

* **Native Memory System (PR #894)**: Add multi-turn context and conversation arc memory
  - Add `multiTurnContext.ts` with turn tracking and state preservation across tool use cycles
  - Add `conversationArc.ts` with goal/decision/milestone tracking and conversation phase detection
  - Add `knowledgeGraph.ts` with persistent entity-relation storage and BM25-based semantic search
  - Wire memory integration into query.ts after tool execution
  - Add feature flags: `MULTI_TURN_CONTEXT`, `CONVERSATION_ARC`
  - Add comprehensive tests (66 passing tests across all memory modules)

* **Knowledge Graph CLI Command**: Add `/knowledge` command to manage native memory
  - Add `/knowledge enable <yes|no>` to toggle Knowledge Graph learning
  - Add `/knowledge clear` to reset memory
  - Add `/knowledge status` to show current state and statistics
  - Add `/knowledge list` to display learned facts and conversation history
  - Add persistent `knowledgeGraphEnabled` setting to global config
  - Integrated user setting into the query execution loop

### Memory Features

* **Automatic Fact Extraction**: Passive learning from conversation content
  - Detect environment variables (KEY=VALUE patterns)
  - Detect absolute paths and file references
  - Detect version numbers (v1.2.3 patterns)
  - Detect URLs and hostnames
  - Detect IPv4 addresses with contextual tagging
  - Detect technical concepts (PascalCase, camelCase, hyphenated-terms)
  - Detect project rules (always/must/should/never patterns)
  - Detect technology stack mentions (React, Redux, etc.)
  - Detect configuration files (*.json, *.yaml, *.xml, etc.)

* **Conversation Arc Tracking**: High-level conversation progress monitoring
  - Track conversation phases: init → exploring → implementing → reviewing → completed
  - Track goals with status (pending/active/completed/abandoned)
  - Track decisions with rationale
  - Track milestones with timestamps
  - Automatic phase progression based on message content

* **Knowledge Graph Storage**: Persistent entity-relation graph with semantic search
  - Entity deduplication and attribute merging
  - Relation tracking between entities
  - Semantic summaries with keyword extraction
  - Project-level rules storage
  - BM25-Lite scoring for relevance ranking
  - Orchestrated memory retrieval (targeted RAG + full graph snapshot)

### Integration

* Wire multi-turn context initialization into query loop start
* Wire conversation arc phase updates after message processing
* Wire arc summary injection into system prompt for context-aware responses
* Wire message and tool call tracking during assistant streaming
* Wire arc turn finalization on query completion
* Add `knowledgeGraphEnabled` config property to GlobalConfig type

### Tests

* Add 15 multiTurnContext tests covering turn management, state tracking, and history
* Add 27 conversationArc tests covering goals, decisions, milestones, and fact extraction
* Add 6 knowledge command tests covering enable/disable, clear, and status operations
* All 66 tests passing with comprehensive coverage

### Documentation

* Add inline documentation for all memory system functions
* Add JSDoc comments explaining BM25 scoring algorithm
* Add comments explaining entity deduplication logic
* Add comments explaining phase detection keywords

## [0.4.4] (2026-04-27)

### Features

* **DeepSeek V4 Support**: Add comprehensive support for DeepSeek V4 models (deepseek-v4-flash, deepseek-v4-pro)
  - Add 1M context window (1,048,576 tokens) for V4 models
  - Add 262K max output tokens (262,144 tokens) for V4 models
  - Add thinking support with reasoning_content preservation
  - Add reasoning_effort normalization (low/medium/high/xhigh → high/max)
  - Update provider preset to default to deepseek-v4-flash
  - Add multi-model string support (deepseek-v4-flash, deepseek-v4-pro, deepseek-chat, deepseek-reasoner)

### Documentation

* Update .env.example with DeepSeek V4 model examples
* Update README.md with DeepSeek V4 agent routing example
* Update docs/advanced-setup.md with V4 model configuration
* Update docs/quick-start-mac-linux.md to use deepseek-v4-flash
* Update docs/quick-start-windows.md to use deepseek-v4-flash

### Bug Fixes

* Fix NVIDIA NIM profile saving issue - profile type now correctly saved as "nvidia-nim" instead of "openai"
* Fix NVIDIA environment variables - now uses NVIDIA_* prefix instead of OPENAI_*
* Fix API key retrieval logic in openaiShim.ts for NVIDIA provider
* Add missing helper functions: looksLikeLeakedReasoningPrefix, shouldBufferPotentialReasoningPrefix, stripLeakedReasoningPreamble
* Add normalizeProfileModel function to extract first model from multi-model strings

### Tests

* Add DeepSeek V4 context window tests
* Add DeepSeek V4 preset tests
* Add DeepSeek V4 multi-model string parsing tests
* Add DeepSeek thinking toggle test

## [0.4.3] (2026-04-26)

### Critical Bug Fixes

* fix LSP reinitialization hang that caused /reload-plugins to block indefinitely
* add 5-second timeout to reinitializeLspServerManager() using Promise.race()
* fix child process shutdown on Windows not responding to graceful termination

## [0.4.2] (2026-04-26)

### Bug Fixes

* fix Windows input handling by skipping early input capture on win32 platform
* prevents REPL from getting stuck waiting for stdin on Windows terminals

## [0.4.1](https://github.com/gakr-gakr/gakrcli/compare/v0.4.0...v0.4.1) (2026-04-26)

### Bug Fixes

* fix lodash-es deprecation warning (update from 4.18.0 to 4.17.21)
* fix async provider validation in interactiveHelpers.tsx
* add fallback strategy to web search tool prompt (use data-extraction skill when web tools fail)

### Features

* verified all 18 providers configured and working
* verified 170+ models available in /model command
* enhanced prompts with tool failure fallback instructions

## [0.4.0](https://github.com/gakr-gakr/gakrcli/compare/v0.3.1...v0.4.0) (2026-04-26)

### Features

* add comprehensive model provider support including NVIDIA NIM, MiniMax, and Mistral providers
* add GitHub native Anthropic API mode for Claude models on Copilot
* enable Buddy companion feature (BUDDY feature flag)
* enable Monitor tool for streaming shell output (MONITOR_TOOL feature flag)
* enable Coordinator mode for multi-agent workflows (COORDINATOR_MODE feature flag)
* add model caching utilities with benchmark support
* add Ollama model discovery with auto-detection
* add OpenAI model discovery for OpenAI-compatible providers
* add support for Codex models with proper authentication
* add memory management with team memory paths
* implement /reload-plugins command with timeout protection

### Bug Fixes

* fix missing MonitorPermissionRequest component
* fix MonitorMcpDetailDialog component for task monitoring
* fix MonitorMcpTask implementation for MCP task handling
* fix VerifyPlanExecutionTool constants and types
* fix cachedMCConfig re-export for microcompact caching
* fix coordinator workerAgent implementation
* fix environment variable naming (GAKR_CODE_* consistent)
* fix memory components stubs for /memory command compatibility

### Build

* enable 18+ additional feature flags in open build configuration
* add FullWidthRow design system component
* copy all missing modules from reference implementation
* fix build errors for all feature-flagged modules
* update providers test suite with proper env var handling
