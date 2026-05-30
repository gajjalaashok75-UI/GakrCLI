# GakrCLI SDK Guide

This file documents the public GakrCLI SDK exposed by this package. It is based on the current codebase, especially `package.json`, `src/entrypoints/sdk/index.ts`, `src/entrypoints/sdk.d.ts`, `src/entrypoints/sdk/query.ts`, `src/entrypoints/sdk/v2.ts`, `src/entrypoints/sdk/sessions.ts`, and the SDK tests under `tests/sdk/`.

`references/` is intentionally not used here.

## What The SDK Is

The GakrCLI SDK lets another Node.js application run GakrCLI's coding-agent engine without launching the interactive terminal UI. It is useful when you want to embed GakrCLI in an app, service, IDE integration, automation worker, test harness, or custom agent host.

The SDK gives you:

- A headless `query()` API for one prompt or an async stream of prompts.
- An `unstable_v2_*` session API for persistent multi-turn conversations.
- Session transcript functions for listing, reading, renaming, tagging, forking, and deleting sessions.
- Permission callbacks so the host controls tool execution.
- MCP server support, including stdio, SSE, HTTP, and in-process SDK-defined tools.
- Typed response messages for assistant output, result summaries, system events, permission events, retries, task progress, tool progress, and more.
- Error classes for authentication, billing, rate limit, invalid request, server, and max-output-token failures.

The SDK is bundled separately from the CLI as `dist/sdk.mjs`. It is designed to avoid importing React, Ink, or terminal UI code.

## Import Path

Use the SDK subpath export:

```ts
import {
  query,
  queryAsync,
  unstable_v2_createSession,
  unstable_v2_resumeSession,
  unstable_v2_prompt,
  listSessions,
  getSessionInfo,
  getSessionMessages,
  renameSession,
  tagSession,
  forkSession,
  deleteSession,
  tool,
  createSdkMcpServer,
} from '@gakr-gakr/gakrcli/sdk'
```

Do not import from the package root. The package intentionally exposes `./sdk`, not `"."`.

## Runtime Requirements

- Node.js `>=20.0.0`.
- ESM imports. The package has `"type": "module"`.
- A valid model/provider setup. The SDK initializes the same underlying GakrCLI engine and may require the same auth/config environment as the CLI.
- Always pass `options.cwd` when creating a query or v2 session.

## Main Ways To Use The SDK

There are four main usage styles:

1. `query()` for a normal async-iterable query.
2. `queryAsync()` when you want SDK initialization to finish before the `Query` object is returned.
3. `unstable_v2_createSession()` or `unstable_v2_resumeSession()` for persistent multi-turn sessions.
4. `unstable_v2_prompt()` for a one-shot convenience call that returns only the final result message.

Use session helper functions separately when you need transcript management.

## Classic Query API

`query()` starts a headless agent run and returns a `Query` object immediately.

```ts
const q = query({
  prompt: 'Explain this repository structure.',
  options: {
    cwd: process.cwd(),
  },
})

for await (const message of q) {
  if (message.type === 'assistant') {
    for (const block of message.message.content) {
      if ((block as any).type === 'text') {
        console.log((block as any).text)
      }
    }
  }

  if (message.type === 'result') {
    console.log('Final result:', message.subtype)
    if (message.subtype === 'success') {
      console.log(message.result)
    }
  }
}
```

`queryAsync()` has the same runtime behavior, but awaits SDK initialization first:

```ts
const q = await queryAsync({
  prompt: 'What commands are available?',
  options: { cwd: process.cwd() },
})
```

### Query Options

The public `QueryOptions` include:

- `cwd`: Required working directory.
- `additionalDirectories`: Extra directories available to the agent.
- `model`: Model name to use.
- `sessionId`: Resume an existing session by ID.
- `resume`: Alias-like resume strategy value used as the effective session ID.
- `continue`: Resume the most recent session for the current `cwd`.
- `fork` or `forkSession`: Fork the session before resuming.
- `resumeSessionAt`: Resume up to a specific message UUID.
- `permissionMode`: Tool permission mode.
- `abortController`: Cancels the query.
- `allowDangerouslySkipPermissions`: Enables bypass permission mode.
- `disallowedTools`: Tool names to blanket deny.
- `hooks`: Hook configuration.
- `mcpServers`: SDK-scoped MCP server configs.
- `settings.env`: Environment overrides.
- `env`: Environment overrides that take precedence over `settings.env`.
- `canUseTool`: Direct permission callback.
- `onPermissionRequest`: Async permission request callback.
- `systemPrompt`: String, `{ type: 'custom', content }`, or `{ type: 'preset', preset, append }`.
- `agents`: Inline agent definitions.
- `settingSources`: Settings sources to load.
- `includePartialMessages`: When `true`, yields token stream events as `stream_event` messages.
- `stderr`: Callback for stderr output.

### Query Object Methods

A `Query` has:

- `sessionId`: Available immediately.
- `[Symbol.asyncIterator]()` to read `SDKMessage` values.
- `setModel(model)`: Change model for future work.
- `setPermissionMode(mode)`: Change permission behavior.
- `close()`: Interrupt, abort, clean up MCP clients, and release resources.
- `interrupt()`: Interrupt the current operation and deny pending permission prompts.
- `respondToPermission(toolUseId, decision)`: Resolve a pending tool permission.
- `rewindFiles()`: Synchronous check for whether file rewind is possible.
- `rewindFilesAsync()`: Performs file rewind and returns changed files/diff stats.
- `supportedCommands()`: Returns currently known MCP/plugin command names.
- `supportedModels()`: Returns the current model as an array, or `[]`.
- `supportedAgents()`: Returns active agent type names.
- `mcpServerStatus()`: Returns MCP client status records.
- `accountInfo()`: Returns account info including `apiKeySource`.
- `setMaxThinkingTokens(tokens)`: Enables thinking when `tokens > 0`; disables it when `0`.

Call `close()` when a query will not be consumed or when you are done early.

### Headless Runtime Control

`Query` also exposes a host/runtime control surface for IDEs and other embedded clients. These methods are intended to replace child-process control wrappers when the host already runs the SDK in-process.

- `getRuntimeState()`: Returns one snapshot with session id, cwd, runtime status, active provider/profile/model, model catalog, permission mode, reasoning config, fast mode, slash commands, agents, MCP status, plugins, account info, and latest usage/cost.
- `getSettings()` / `applySettings(settings)`: Read current effective settings and apply supported runtime changes.
- `listProviders()` / `listProviderProfiles()` / `getActiveProviderProfile()` / `setActiveProviderProfile(profileId)`: Read and switch provider/profile state.
- `listModels()` / `discoverModels()` / `setModel(model)`: Read configured models and switch the active model.
- `getPermissionMode()` / `setPermissionMode(mode)`: Read and change permission mode.
- `getReasoningConfig()` / `setReasoningEffort(effort)` / `setMaxThinkingTokens(tokens)`: Read and change thinking/reasoning behavior.
- `getFastModeState()` / `setFastMode(enabled)`: Read and toggle fast mode.
- `getContextUsage()` / `getUsageSummary()`: Read context usage and the latest observed result usage/cost.
- `listSlashCommands()` / `runSlashCommand(command, args)`: Read command metadata and classify headless command execution. UI-backed JSX/TUI commands return `requires_ui`.
- `listMcpServers()` / `setMcpServers(servers)` / `toggleMcpServer(name, enabled)` / `reconnectMcpServer(name)`: Read and mutate SDK-managed MCP state.
- `listPlugins()` / `setPluginEnabled(name, enabled)` / `reloadPlugins()`: Read and mutate plugin state where existing plugin operations support headless execution.

Example:

```ts
const q = query({
  prompt: promptStream,
  options: { cwd: process.cwd(), includePartialMessages: true },
})

const runtime = await q.getRuntimeState()
console.log(runtime.model, runtime.permissionMode, runtime.fastModeState.state)

await q.applySettings({
  model: 'claude-sonnet-4-6',
  permissionMode: 'plan',
  effort: 'low',
  fastMode: true,
})

const context = await q.getContextUsage()
console.log(context.totalTokens, context.maxTokens)
```

## Streaming User Prompts

`query()` can accept an `AsyncIterable<SDKUserMessage>` instead of a string. Each yielded user message is sent into the engine.

```ts
async function* prompts() {
  yield {
    type: 'user',
    message: { role: 'user', content: 'First question' },
    parent_tool_use_id: null,
  }

  yield {
    type: 'user',
    message: { role: 'user', content: 'Follow up with more detail' },
    parent_tool_use_id: null,
  }
}

const q = query({
  prompt: prompts(),
  options: { cwd: process.cwd() },
})

for await (const msg of q) {
  console.log(msg.type)
}
```

## V2 Persistent Session API

The v2 API is marked unstable in the code. Use it when you want a long-lived session object with retained conversation state.

```ts
const session = unstable_v2_createSession({
  cwd: process.cwd(),
})

try {
  for await (const msg of session.sendMessage('Remember: my app uses Bun.')) {
    console.log(msg.type)
  }

  for await (const msg of session.sendMessage('What runtime did I mention?')) {
    if (msg.type === 'result' && msg.subtype === 'success') {
      console.log(msg.result)
    }
  }
} finally {
  session.close()
}
```

A v2 `SDKSession` has:

- `sessionId`
- `sendMessage(content)`
- `getMessages()`
- `interrupt()`
- `close()`
- `respondToPermission(toolUseId, decision)`

Important: call `close()` when finished. The implementation keeps buffers, pending permission prompts, timeout queues, agent queues, MCP clients, and engine references until closed.

### Resume A V2 Session

```ts
const session = await unstable_v2_resumeSession(existingSessionId, {
  cwd: process.cwd(),
})

try {
  console.log(session.getMessages())

  for await (const msg of session.sendMessage('Continue from here.')) {
    console.log(msg.type)
  }
} finally {
  session.close()
}
```

If the session ID is valid but no transcript exists, the SDK creates a session object with empty messages. Invalid UUIDs throw.

### One-Shot V2 Prompt

`unstable_v2_prompt()` creates a session, sends one message, collects the final `result` message, closes the session, and returns that final message.

```ts
const result = await unstable_v2_prompt('Summarize the project.', {
  cwd: process.cwd(),
})

if (result.subtype === 'success') {
  console.log(result.result)
} else {
  console.error(result.errors)
}
```

It throws if the run finishes without a result message, for example if it is aborted before producing one.

## Permissions

The SDK is secure by default. If you do not provide `canUseTool` or `onPermissionRequest`, tool uses are denied by default.

### Permission Modes

`permissionMode` accepts:

- `default`: Standard permission behavior.
- `plan`: Planning mode.
- `auto-accept`: Alias for `acceptEdits`.
- `acceptEdits`: Auto-accept edit operations.
- `bypass-permissions` or `bypassPermissions`: Bypass mode. This requires bypass availability, usually through `allowDangerouslySkipPermissions`.

You can also use `disallowedTools` to deny tools by name.

```ts
const q = query({
  prompt: 'Inspect files but do not run shell commands.',
  options: {
    cwd: process.cwd(),
    disallowedTools: ['Bash'],
    canUseTool: async () => ({ behavior: 'allow' }),
  },
})
```

### Direct Permission Callback

Use `canUseTool` when your host can decide immediately.

```ts
const q = query({
  prompt: 'Read package.json and explain the scripts.',
  options: {
    cwd: process.cwd(),
    canUseTool: async (name, input, options) => {
      if (name === 'Bash') {
        return { behavior: 'deny', message: 'Shell is disabled in this host.' }
      }

      return { behavior: 'allow' }
    },
  },
})
```

Allowed decisions may include `updatedInput`.

```ts
return {
  behavior: 'allow',
  updatedInput: { path: '/safe/path' },
}
```

If `canUseTool` throws, the SDK denies that tool call and includes the callback error message in the denial.

### Async Permission Request Callback

Use `onPermissionRequest` when a UI or external host needs to ask the user.

```ts
let activeQuery: ReturnType<typeof query>

activeQuery = query({
  prompt: 'Make the requested change.',
  options: {
    cwd: process.cwd(),
    onPermissionRequest: (request) => {
      console.log('Tool wants permission:', request.tool_name, request.input)

      activeQuery.respondToPermission(request.tool_use_id, {
        behavior: 'allow',
        decisionClassification: 'user_temporary',
      })
    },
  },
})
```

A permission request looks like:

```ts
{
  type: 'permission_request',
  request_id: string,
  tool_name: string,
  tool_use_id: string,
  input: Record<string, unknown>,
  uuid: string,
  session_id: string,
}
```

The default timeout is 30 seconds. If the host does not respond in time, the SDK emits a `permission_timeout` event internally and denies by default.

Permission responses are:

```ts
{ behavior: 'allow', updatedInput?: Record<string, unknown> }
```

or:

```ts
{ behavior: 'deny', message: string, interrupt?: boolean }
```

The `decisionClassification` field can be `user_temporary`, `user_permanent`, or `user_reject`.

## MCP Support

The SDK supports MCP servers through `mcpServers`. Wrap server configs with `createSdkMcpServer()` so they get `scope: 'session'`.

Supported config forms:

```ts
// stdio
createSdkMcpServer({
  type: 'stdio',
  command: 'npx',
  args: ['-y', '@modelcontextprotocol/server-filesystem', process.cwd()],
})

// SSE
createSdkMcpServer({
  type: 'sse',
  url: 'http://localhost:3001/sse',
  headers: { Authorization: 'Bearer token' },
})

// HTTP
createSdkMcpServer({
  type: 'http',
  url: 'http://localhost:3001/mcp',
})

// In-process SDK tools
createSdkMcpServer({
  type: 'sdk',
  name: 'local-tools',
  tools: [],
})
```

### In-Process SDK Tools

Use `tool()` to define tools directly in your SDK host process.

```ts
const echo = tool(
  'echo',
  'Echo back text',
  {
    type: 'object',
    properties: {
      text: { type: 'string' },
    },
    required: ['text'],
  },
  async (args: { text: string }) => ({
    content: [{ type: 'text', text: args.text }],
  }),
  {
    annotations: { readOnlyHint: true },
    searchHint: 'echo text',
    alwaysLoad: true,
  },
)

const q = query({
  prompt: 'Use echo to say hello.',
  options: {
    cwd: process.cwd(),
    mcpServers: {
      local: createSdkMcpServer({
        type: 'sdk',
        name: 'local',
        tools: [echo],
      }),
    },
    canUseTool: async () => ({ behavior: 'allow' }),
  },
})
```

For `type: 'sdk'`, the implementation creates in-process tools without creating external MCP clients.

Use `q.mcpServerStatus()` to inspect connected, failed, pending, needs-auth, or disabled MCP server states.

## Session Transcript Functions

These functions manage JSONL session transcripts.

### `listSessions(options?)`

Returns `Promise<SDKSessionInfo[]>`.

When `dir` is provided, it lists sessions for that project directory and git worktrees. Without `dir`, it lists across projects. Supports `limit`, `offset`, and `includeWorktrees`.

```ts
const sessions = await listSessions({
  dir: process.cwd(),
  limit: 20,
})
```

`SDKSessionInfo` includes:

```ts
{
  sessionId: string,
  summary: string,
  lastModified: number,
  fileSize?: number,
  customTitle?: string,
  firstPrompt?: string,
  gitBranch?: string,
  cwd?: string,
  tag?: string,
  createdAt?: number,
}
```

### `getSessionInfo(sessionId, options?)`

Returns `Promise<SDKSessionInfo | undefined>`. It returns `undefined` when the session file is not found, is a sidechain session, or has no extractable summary.

```ts
const info = await getSessionInfo(sessionId, { dir: process.cwd() })
```

Invalid session IDs throw.

### `getSessionMessages(sessionId, options?)`

Returns `Promise<SessionMessage[]>`. Missing sessions return `[]`.

```ts
const messages = await getSessionMessages(sessionId, {
  dir: process.cwd(),
  includeSystemMessages: false,
  limit: 50,
  offset: 0,
})
```

Each message looks like:

```ts
{
  role: 'user' | 'assistant' | 'system',
  content: unknown,
  timestamp?: string,
  uuid?: string,
  parentUuid?: string | null,
}
```

The function rebuilds the current conversation chain using `parentUuid` links and skips sidechain entries.

### `renameSession(sessionId, title, options?)`

Appends a `custom-title` entry to the session transcript.

```ts
await renameSession(sessionId, 'Useful Debugging Session', {
  dir: process.cwd(),
})
```

Throws if the ID is invalid or the session does not exist.

### `tagSession(sessionId, tag, options?)`

Appends a tag entry. Pass `null` to clear the tag.

```ts
await tagSession(sessionId, 'important', { dir: process.cwd() })
await tagSession(sessionId, null, { dir: process.cwd() })
```

### `forkSession(sessionId, options?)`

Copies a session into a new transcript with fresh UUIDs and remapped parent chains.

```ts
const forked = await forkSession(sessionId, {
  dir: process.cwd(),
  upToMessageId: someMessageUuid,
  title: 'Forked Investigation',
})

console.log(forked.sessionId)
```

Returns:

```ts
{ sessionId: string }
```

Forked sessions preserve title/tag metadata but do not copy undo history/file-history snapshots.

### `deleteSession(sessionId, options?)`

Deletes the session JSONL file.

```ts
await deleteSession(sessionId, { dir: process.cwd() })
```

Throws if the ID is invalid or the session file is missing.

## SDK Message Responses

The SDK yields `SDKMessage` values. The union is generated from schemas and includes many message types. The most important ones are below.

### Assistant Message

```ts
{
  type: 'assistant',
  message: {
    role: 'assistant',
    content: unknown[],
  },
  parent_tool_use_id: string | null,
  error?: 'authentication_failed' | 'billing_error' | 'rate_limit' | 'invalid_request' | 'server_error' | 'unknown' | 'max_output_tokens',
  uuid: string,
  session_id: string,
}
```

Assistant content commonly contains text blocks and tool-use blocks.

### User Message

```ts
{
  type: 'user',
  message: {
    role: 'user',
    content: string | unknown[],
  },
  parent_tool_use_id: string | null,
  isSynthetic?: boolean,
  tool_use_result?: unknown,
  priority?: 'now' | 'next' | 'later',
  timestamp?: string,
  uuid?: string,
  session_id?: string,
}
```

### Result Message

Every completed query turn should produce a final `result` message unless the run is aborted before completion.

Success:

```ts
{
  type: 'result',
  subtype: 'success',
  duration_ms: number,
  duration_api_ms: number,
  is_error: boolean,
  num_turns: number,
  result: string,
  stop_reason: string | null,
  total_cost_usd: number,
  usage: Record<string, number>,
  modelUsage: Record<string, {
    inputTokens: number,
    outputTokens: number,
    cacheReadInputTokens: number,
    cacheCreationInputTokens: number,
    webSearchRequests: number,
    costUSD: number,
    contextWindow: number,
    maxOutputTokens: number,
  }>,
  permission_denials: Array<{
    tool_name: string,
    tool_use_id: string,
    tool_input: Record<string, unknown>,
  }>,
  structured_output?: unknown,
  fast_mode_state?: 'off' | 'cooldown' | 'on',
  uuid: string,
  session_id: string,
}
```

Error result:

```ts
{
  type: 'result',
  subtype: 'error_during_execution' | 'error_max_turns' | 'error_max_budget_usd' | 'error_max_structured_output_retries',
  duration_ms: number,
  duration_api_ms: number,
  is_error: boolean,
  num_turns: number,
  stop_reason: string | null,
  total_cost_usd: number,
  usage: Record<string, number>,
  modelUsage: Record<string, ModelUsage>,
  permission_denials: SDKPermissionDenial[],
  errors: string[],
  fast_mode_state?: 'off' | 'cooldown' | 'on',
  uuid: string,
  session_id: string,
}
```

### Init System Message

The engine may emit an init message with environment and capability info:

```ts
{
  type: 'system',
  subtype: 'init',
  apiKeySource: 'user' | 'project' | 'org' | 'temporary' | 'oauth' | 'none',
  gakr_code_version: string,
  cwd: string,
  tools: string[],
  mcp_servers: Array<{ name: string, status: string }>,
  model: string,
  permissionMode: 'default' | 'acceptEdits' | 'bypassPermissions' | 'plan' | 'dontAsk',
  slash_commands: string[],
  output_style: string,
  skills: string[],
  plugins: Array<{ name: string, path: string, source?: string }>,
  uuid: string,
  session_id: string,
}
```

### Partial Streaming Message

Only emitted when `includePartialMessages: true`.

```ts
{
  type: 'stream_event',
  event: Record<string, unknown>,
  parent_tool_use_id: string | null,
  uuid: string,
  session_id: string,
}
```

### Other Message Types

The generated union also includes:

- `system` messages with subtypes such as `compact_boundary`, `status`, `api_retry`, `local_command_output`, `hook_started`, `hook_progress`, `hook_response`, `files_persisted`, `task_notification`, `task_started`, `task_progress`, `session_state_changed`, and `elicitation_complete`.
- `tool_progress`
- `auth_status`
- `tool_use_summary`
- `rate_limit_event`
- `prompt_suggestion`
- `permission_request`

Always branch on `message.type` and, for system messages, `message.subtype`.

## Error Classes

The SDK exports:

- `AbortError`
- `GakrcliError`
- `SDKError`
- `SDKAuthenticationError`
- `SDKBillingError`
- `SDKRateLimitError`
- `SDKInvalidRequestError`
- `SDKServerError`
- `SDKMaxOutputTokensError`
- `sdkErrorFromType(errorType, message?)`

`SDKRateLimitError` includes:

```ts
{
  resetsAt?: number,
  rateLimitType?: string,
}
```

Example:

```ts
try {
  const result = await unstable_v2_prompt('Hello', { cwd: process.cwd() })
  console.log(result)
} catch (error) {
  if (error instanceof SDKRateLimitError) {
    console.error('Rate limited until:', error.resetsAt)
  } else {
    throw error
  }
}
```

## Abort And Cleanup

Use an `AbortController` to cancel in-flight work.

```ts
const abortController = new AbortController()

const q = query({
  prompt: 'Long task',
  options: {
    cwd: process.cwd(),
    abortController,
  },
})

setTimeout(() => abortController.abort(), 5_000)

try {
  for await (const msg of q) {
    console.log(msg.type)
  }
} finally {
  q.close()
}
```

For v2 sessions, call `session.close()` in a `finally` block.

## Environment Overrides

You can pass environment variables through either `settings.env` or top-level `env`. Top-level `env` takes precedence.

```ts
const q = query({
  prompt: 'Use this provider config.',
  options: {
    cwd: process.cwd(),
    settings: {
      env: {
        PROVIDER_A: 'from-settings',
      },
    },
    env: {
      PROVIDER_A: 'from-top-level',
      REMOVE_ME: undefined,
    },
  },
})
```

An `undefined` value means "unset this inherited environment variable" for the query.

## Custom System Prompt

```ts
query({
  prompt: 'Review the code.',
  options: {
    cwd: process.cwd(),
    systemPrompt: {
      type: 'custom',
      content: 'You are a strict TypeScript reviewer.',
    },
  },
})
```

For preset prompts, the SDK currently uses the `append` value:

```ts
query({
  prompt: 'Plan the migration.',
  options: {
    cwd: process.cwd(),
    systemPrompt: {
      type: 'preset',
      preset: 'default',
      append: '\nFocus on low-risk migration steps.',
    },
  },
})
```

## Inline Agents

`query()` accepts an `agents` object. Each entry becomes an agent definition injected into the engine.

```ts
const q = query({
  prompt: 'Ask the test-writer agent for coverage advice.',
  options: {
    cwd: process.cwd(),
    agents: {
      'test-writer': {
        description: 'Writes focused tests for changed behavior.',
        prompt: 'You write minimal, high-value tests.',
        tools: ['Read', 'Grep'],
        disallowedTools: ['Bash'],
        model: 'default',
        maxTurns: 3,
      },
    },
  },
})
```

If agent loading or injection fails, the SDK continues and can emit:

```ts
{
  type: 'agent_load_failure',
  stage: 'definitions' | 'injection',
  error_message: string,
}
```

## File Rewind

After a query that edits files, you can check whether the session has a file-history snapshot and then rewind.

```ts
const check = q.rewindFiles()

if (check.canRewind) {
  const rewind = await q.rewindFilesAsync()
  console.log(rewind.filesChanged, rewind.insertions, rewind.deletions)
}
```

Return shape:

```ts
{
  canRewind: boolean,
  error?: string,
  filesChanged?: string[],
  insertions?: number,
  deletions?: number,
}
```

## Practical Patterns

### Collect Only Final Text

```ts
async function ask(prompt: string): Promise<string> {
  const q = await queryAsync({
    prompt,
    options: {
      cwd: process.cwd(),
      canUseTool: async () => ({ behavior: 'deny', message: 'Read-only mode' }),
    },
  })

  let final = ''
  for await (const msg of q) {
    if (msg.type === 'result' && msg.subtype === 'success') {
      final = msg.result
    }
  }

  return final
}
```

### Resume Or Continue A Session

```ts
const resumed = query({
  prompt: 'Continue and finish the TODO list.',
  options: {
    cwd: process.cwd(),
    sessionId,
    canUseTool: async () => ({ behavior: 'allow' }),
  },
})

const latest = query({
  prompt: 'Continue the latest session in this project.',
  options: {
    cwd: process.cwd(),
    continue: true,
    canUseTool: async () => ({ behavior: 'allow' }),
  },
})
```

### Fork Before Continuing

```ts
const q = query({
  prompt: 'Try an alternative implementation.',
  options: {
    cwd: process.cwd(),
    sessionId,
    fork: true,
    canUseTool: async () => ({ behavior: 'allow' }),
  },
})

console.log('Fork session id:', q.sessionId)
```

The final resolved session ID may be updated when iteration begins, especially for `continue` and fork flows.

### Read-Only Host

```ts
const q = query({
  prompt: 'Explain the code without changing anything.',
  options: {
    cwd: process.cwd(),
    permissionMode: 'plan',
    disallowedTools: ['Bash', 'Edit', 'Write'],
    canUseTool: async (name) => {
      if (['Read', 'Grep', 'Glob'].includes(name)) {
        return { behavior: 'allow' }
      }
      return { behavior: 'deny', message: `${name} is disabled in read-only mode.` }
    },
  },
})
```

## Quick API Reference

Functions:

- `query({ prompt, options }) => Query`
- `queryAsync({ prompt, options }) => Promise<Query>`
- `unstable_v2_createSession(options) => SDKSession`
- `unstable_v2_resumeSession(sessionId, options) => Promise<SDKSession>`
- `unstable_v2_prompt(message, options) => Promise<SDKResultMessage>`
- `listSessions(options?) => Promise<SDKSessionInfo[]>`
- `getSessionInfo(sessionId, options?) => Promise<SDKSessionInfo | undefined>`
- `getSessionMessages(sessionId, options?) => Promise<SessionMessage[]>`
- `renameSession(sessionId, title, options?) => Promise<void>`
- `tagSession(sessionId, tag | null, options?) => Promise<void>`
- `forkSession(sessionId, options?) => Promise<{ sessionId: string }>`
- `deleteSession(sessionId, options?) => Promise<void>`
- `tool(name, description, inputSchema, handler, extras?) => SdkMcpToolDefinition`
- `createSdkMcpServer(config) => config & { scope: 'session' }`

Core types:

- `SDKMessage`
- `SDKUserMessage`
- `SDKResultMessage`
- `QueryOptions`
- `Query`
- `SDKSessionOptions`
- `SDKSession`
- `PermissionResult`
- `SDKPermissionRequestMessage`
- `SDKPermissionTimeoutMessage`
- `SDKSessionInfo`
- `SessionMessage`
- `McpServerStatus`
- `RewindFilesResult`

## Current Limitations And Notes

- The v2 API is explicitly named `unstable_v2_*`; treat it as subject to change.
- Root package import is intentionally unavailable; use `@gakr-gakr/gakrcli/sdk`.
- `supportedModels()` currently returns the active model only, not a full catalog.
- SDK tool execution is denied by default unless the host supplies `canUseTool` or `onPermissionRequest`.
- MCP connection failures are logged and the query continues without those MCP tools.
- `type: 'sdk'` MCP servers are in-process and do not create MCP clients.
- `rewindFiles()` only works when the engine has file-history snapshots for assistant messages.
- `unstable_v2_prompt()` returns only the final result message, not the full stream.
