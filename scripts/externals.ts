/**
 * Shared external dependency lists for CLI and SDK bundles.
 *
 * Used by build.ts and validate-externals.ts.
 * When adding a new dependency to package.json, check if it should be
 * added here (large packages, native modules, or packages with many exports).
 */

// Packages that should be kept external in ALL bundles (CLI + SDK)
// TODO(v2): remove these Bedrock/smithy typings once dynamic imports land.
export const COMMON_EXTERNALS: string[] = [
  // Native image processing
  'sharp',
  // Agent Client Protocol SDK
  '@agentclientprotocol/sdk',
  // MCP bridge
  '@anthropic-ai/mcpb',
  // Cloud provider SDKs
  '@aws-sdk/client-bedrock',
  '@aws-sdk/client-bedrock-runtime',
  '@aws-sdk/client-sts',
  '@aws-sdk/credential-provider-node',
  '@aws-sdk/credential-providers',
  '@azure/identity',
  'google-auth-library',
  // AWS Smithy client runtime
  '@smithy/core',
  '@smithy/node-http-handler',
  // OpenAI SDK (large provider client)
  'openai',
  // Firecrawl web-crawl client (large, dynamically imported)
  '@mendable/firecrawl-js',
  // @vscode/ripgrep ships a platform-specific binary alongside its
  // index.js and resolves the path via __dirname at runtime. Bundling
  // would freeze the build host's absolute path into dist/cli.mjs, so we
  // keep it external and rely on the npm package being installed.
  '@vscode/ripgrep',
  // highlight.js registers 190+ language grammars at require time (~50MB).
  // Keeping it external avoids bloating the CLI bundle.
  'highlight.js',
  // web-tree-sitter ships a WASM file alongside its JS and resolves the
  // path via require.resolve at runtime; bundling would freeze the build
  // host's absolute path, so keep it external.
  'web-tree-sitter',
  // tree-sitter-wasms ships per-language .wasm files resolved via
  // require.resolve at runtime — same bundling concern as web-tree-sitter.
  'tree-sitter-wasms',
  // Orama search engine
  '@orama/orama',
  '@orama/plugin-data-persistence',
  // Bun runtime and package manager
  'bun',
  'byn',
  // Chrome extension MCP — dynamically imported at runtime
  '@gakr-gakr/gakrcli-for-chrome-mcp',
  // Browser automation (WebBrowserTool) — playwright-core resolves native
  // helpers like chromium-bidi at runtime; bundling freezes the build host
  // paths, so keep it external and rely on the npm package being installed.
  'playwright',
  // Observability / feature flags
  '@growthbook/growthbook',
  '@langfuse/otel',
  '@langfuse/tracing',
  '@opentelemetry/api',
  '@opentelemetry/api-logs',
  '@opentelemetry/instrumentation',
  '@opentelemetry/resources',
  '@opentelemetry/sdk-logs',
  '@opentelemetry/sdk-trace-base',
  '@opentelemetry/semantic-conventions',
  '@opentelemetry/exporter-trace-otlp-grpc',
  '@opentelemetry/core',
  '@opentelemetry/sdk-metrics',
  '@opentelemetry/exporter-logs-otlp-grpc',
  '@opentelemetry/exporter-logs-otlp-http',
  '@opentelemetry/exporter-logs-otlp-proto',
  '@opentelemetry/exporter-metrics-otlp-grpc',
  '@opentelemetry/exporter-metrics-otlp-http',
  '@opentelemetry/exporter-metrics-otlp-proto',
  '@opentelemetry/exporter-prometheus',
  '@opentelemetry/exporter-trace-otlp-http',
  '@opentelemetry/exporter-trace-otlp-proto',
  // Markdown rendering
  'streamdown',
  'he',
  // Sentry telemetry
  '@sentry/node',
  // Doubao speech recognition (native ASR client)
  'doubaoime-asr',
]

// Additional packages external only in the SDK bundle (TUI + heavy deps)
export const SDK_ONLY_EXTERNALS: string[] = [
  'react',
  'react-reconciler',
  '@anthropic-ai/sdk',
  '@modelcontextprotocol/sdk',
]

// Packages kept external but NOT listed in package.json dependencies.
// These are dynamically imported at runtime — they're optional and resolved
// from transitive deps or installed by users who need that provider/protocol.
export const OPTIONAL_RUNTIME_EXTERNALS: string[] = [
  // Cloud provider SDKs (dynamically imported per-provider)
  // Vendor-specific AWS/OpenAI/Bedrock/Foundry packages are loaded on demand.
  // First-party AWS SDKs: base client, runtime transport, STS, credential providers.
  '@aws-sdk/client-bedrock',
  '@aws-sdk/client-bedrock-runtime',
  '@aws-sdk/client-sts',
  '@aws-sdk/credential-providers',
  '@azure/identity',
  // Loaded through the `new Function` indirection in
  // src/utils/optionalRuntimeModule.ts (see RUNTIME_INDIRECTION_ONLY_EXTERNALS
  // below for the two that must stay OUT of the bundle externals).
  '@anthropic-ai/bedrock-sdk',
  '@anthropic-ai/foundry-sdk',
  // Vertex/Gemini auth: importOptionalRuntimeModule in src/services/api/client.ts
  // and src/utils/geminiAuth.ts.
  'google-auth-library',
]

/**
 * The subset of OPTIONAL_RUNTIME_EXTERNALS that source code reaches ONLY through
 * the `new Function('return import(specifier)')` indirection in
 * src/utils/optionalRuntimeModule.ts — never with a statically visible
 * `import`/`import()`.
 *
 * These must stay OUT of CLI_EXTERNALS/SDK_EXTERNALS. Listing one as external
 * would tell esbuild the specifier exists, re-exposing the package's own static
 * imports (@anthropic-ai/bedrock-sdk statically imports
 * @aws-sdk/client-bedrock-runtime) and hoisting that AWS tree into the bundle —
 * the exact outcome the indirection exists to prevent.
 *
 * They are also the reason validate-externals.ts needs a third exemption
 * category: they are shipped `dependencies` that are legitimately neither
 * external nor bundled, so the dependency-coverage check would otherwise report
 * them missing.
 */
export const RUNTIME_INDIRECTION_ONLY_EXTERNALS: string[] = [
  '@anthropic-ai/bedrock-sdk',
  '@anthropic-ai/foundry-sdk',
]

// Computed full lists
export const CLI_EXTERNALS: string[] = COMMON_EXTERNALS
export const SDK_EXTERNALS: string[] = [...COMMON_EXTERNALS, ...SDK_ONLY_EXTERNALS]

// Packages intentionally bundled (not external, not flagged by validation)
// These are small utilities that are fine to inline into the output bundle.
export const INTENTIONALLY_BUNDLED: string[] = [
  // Test utilities (bundled, not external)
  // Anthropic provider variants (bundled, not the main SDK).
  // NOTE: @anthropic-ai/bedrock-sdk and @anthropic-ai/foundry-sdk are NOT here —
  // they are loaded through the runtime-import indirection, so they are neither
  // bundled nor external. See RUNTIME_INDIRECTION_ONLY_EXTERNALS.
  '@anthropic-ai/sandbox-runtime',
  '@anthropic-ai/vertex-sdk',
  // CLI / TUI utilities
  '@alcalzone/ansi-tokenize',
  '@commander-js/extra-typings',
  'bidi-js',
  'chalk',
  'cli-boxes',
  'cli-highlight',
  'commander',
  'emoji-regex',
  'env-paths',
  'figures',
  'get-east-asian-width',
  'indent-string',
  'strip-ansi',
  'supports-hyperlinks',
  'wrap-ansi',
  // Data formats
  'jsonc-parser',
  'yaml',
  'marked',
  'turndown',
  'xss',
  // Data utilities
  'ajv',
  'auto-bind',
  'diff',
  'fflate',
  'fuse.js',
  'ignore',
  'lodash-es',
  'lru-cache',
  'p-map',
  'picomatch',
  'proper-lockfile',
  'qrcode',
  'semver',
  'shell-quote',
  'signal-exit',
  'type-fest',
  // Networking
  'axios',
  'cross-spawn',
  'duck-duck-scrape',
  'execa',
  'https-proxy-agent',
  'tree-kill',
  'undici',
  'ws',
  // React ecosystem (react/react-reconciler are SDK_ONLY_EXTERNALS, bundled in CLI)
  'react',
  'react-compiler-runtime',
  'react-reconciler',
  'usehooks-ts',
  // Anthropic SDK (external in SDK bundle, bundled in CLI)
  '@anthropic-ai/sdk',
  // MCP SDK (external in SDK bundle, bundled in CLI)
  '@modelcontextprotocol/sdk',
  // Schema validation
  'zod',
    // gRPC (bundled into CLI, not external)
  '@grpc/grpc-js',
  '@grpc/proto-loader',
  // Language server protocol
  'vscode-languageserver-protocol',
  'vscode-jsonrpc',
  'vscode-languageserver-types',
  // File watching
  'chokidar',
  // Graph algorithms (repo map PageRank)
  'graphology',
  'graphology-metrics',
  // Tokenizer for repo map token budgeting
  'js-tiktoken',
]
