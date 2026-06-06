# Main Agent Context

This document is the concrete model-facing context contract for the main GakrCLI agent. It answers: when a normal CLI turn reaches the model, what system prompt, dynamic context, hidden user context, messages, attachments, and tool schemas are actually assembled?

For the broader lifecycle explanation, see [context-building.md](context-building.md). This file focuses on the real request shape used by the main agent.

## Short Answer

The main agent does not receive one single `context.md` file. It receives a layered API request:

```ts
deps.callModel({
  systemPrompt: promptWithArc,
  messages: prependUserContext(messagesForQuery, userContext),
  tools: toolUseContext.options.tools,
  thinkingConfig: toolUseContext.options.thinkingConfig,
  signal: toolUseContext.abortController.signal,
  options: {
    model: currentModel,
    fastMode,
    querySource,
    agents,
    allowedAgentTypes,
    mcpTools,
    hasPendingMcpServers,
    providerOverride,
    taskBudget,
    fetchOverride,
  },
})
```

Before this call, `query.ts` builds:

- `fullSystemPrompt = appendSystemContext(systemPrompt, systemContext)` for context accounting and compaction.
- `promptWithArc = systemPrompt` plus optional conversation arc summary.
- `messagesForQuery` after compact-boundary filtering, optional context-collapse projection, microcompact, autocompact, and current attachments.
- `prependUserContext(messagesForQuery, userContext)` as the actual message array sent to `callModel`.

Important implementation detail: the `fullSystemPrompt` variable is used for context-limit and compaction paths, but the final `deps.callModel` call passes `systemPrompt: promptWithArc`. As of the current code, `systemContext` is accounted and passed into compaction/fork context, but it is not directly passed as the `systemPrompt` argument in the main `deps.callModel` call from `query.ts`. The hidden user context is definitely prepended in `query.ts` immediately before the model call.

## Primary Code Path

Normal interactive CLI path:

```text
src/main.tsx
  -> setup(...)
     -> ensureGakrcliWorkspace()

src/screens/REPL.tsx
  -> getSystemPrompt(...)
  -> getUserContext()
  -> getSystemContext()
  -> buildEffectiveSystemPrompt(...)
  -> query({
       messages,
       systemPrompt,
       userContext,
       systemContext,
       toolUseContext,
       canUseTool,
       querySource,
     })

src/query.ts
  -> project/collapse/compact message history into model-facing messagesForQuery
  -> appendSystemContext(systemPrompt, systemContext) for full prompt accounting
  -> prependUserContext(messagesForQuery, userContext)
  -> deps.callModel(...)

src/services/api/gakrcli.ts
  -> normalize messages for API
  -> build/filter/defer tool schemas
  -> prepend attribution header and CLI system-prompt prefix
  -> split system prompt into cache blocks
  -> call provider with { system, messages, tools, betas, max_tokens, ... }
```

Key source files:

- `src/setup.ts`: creates persistent workspace files through `ensureGakrcliWorkspace()`.
- `src/screens/REPL.tsx`: gathers default prompt, user context, system context, coordinator context, terminal focus context, and custom prompt options.
- `src/constants/prompts.ts`: builds the default system prompt array.
- `src/utils/systemPrompt.ts`: chooses override, coordinator, main-thread agent, custom, or default prompt.
- `src/context.ts`: builds `systemContext` and `userContext`.
- `src/utils/api.ts`: appends system context and prepends hidden user context.
- `src/utils/gakrclimd.ts`: discovers and renders instruction, workspace, project, and memory files.
- `src/utils/workspace.ts`: seeds `~/.gakrcli/workspace/*.md`.
- `src/query.ts`: builds the model-facing turn and runs tool continuations.
- `src/commands/context/*`: `/context` mirrors the pre-API context transforms for usage reporting.

## System Prompt Selection

`buildEffectiveSystemPrompt()` chooses the system prompt in this order:

1. `overrideSystemPrompt`, if present. This replaces all other prompts.
2. Coordinator mode prompt, when coordinator mode is active and there is no main-thread agent.
3. Main-thread agent prompt, when the user selected a main-thread agent.
4. `customSystemPrompt`, usually from CLI/SDK options.
5. Default GakrCLI prompt from `getSystemPrompt()`.

`appendSystemPrompt` is appended at the end unless `overrideSystemPrompt` is active.

In proactive mode, a main-thread agent prompt is appended to the default prompt instead of replacing it.

## Default System Prompt Blocks

In normal mode, `getSystemPrompt()` returns an array of string blocks. The stable order is:

```text
[
  simple intro,
  system rules,
  doing tasks,
  executing actions with care,
  using your tools,
  tone and style,
  output efficiency,
  optional "__SYSTEM_PROMPT_DYNAMIC_BOUNDARY__",
  session guidance,
  memory mechanics,
  optional internal model override,
  environment,
  optional language preference,
  optional output style,
  optional MCP server instructions,
  optional scratchpad instructions,
  optional function-result clearing,
  tool-result summarization guidance,
  optional numeric length anchors,
  optional token budget guidance,
  optional brief/proactive guidance,
]
```

The dynamic boundary appears only when global prompt-cache scope is enabled. It lets API request code split static prompt content from dynamic prompt content.

In simple mode (`GAKR_CODE_SIMPLE`), the prompt is much smaller:

```text
You operate inside GakrCLI, an open-source command-line interface, agent harness,
and orchestration runtime for coding agents. Your assistant identity may be
defined by workspace files such as IDENTITY.md and SOUL.md.

CWD: <cwd>
Date: <session-start-date>
```

## System Context

`getSystemContext()` returns a key/value map. `appendSystemContext()` serializes it as:

```text
gitStatus: <git snapshot>
cacheBreaker: [CACHE_BREAKER: <debug value>]
```

`gitStatus` includes:

- startup note that status is a snapshot
- current branch
- default/main branch
- git user, when available
- `git status --short`, truncated at 2000 chars
- last 5 commits

Git status is skipped when remote mode is active or git instructions are disabled. The value is memoized for the conversation, so it does not update live after file edits.

Current code caveat: `systemContext` is included in context accounting and compaction inputs. In the main `query.ts` streaming call, the direct `systemPrompt` argument remains `promptWithArc`; check this area before assuming the git snapshot is serialized into the provider request for every path.

## User Context

`getUserContext()` returns:

```ts
{
  gakrcliMd?: string,
  currentDate: "Today's date is YYYY-MM-DD.",
}
```

`prependUserContext()` turns that map into the first model-facing message:

```text
<system-reminder>
As you answer the user's questions, you can use the following context:
# gakrcliMd
<rendered instruction and memory files>
# currentDate
Today's date is YYYY-MM-DD.

      IMPORTANT: this context may or may not be relevant to your tasks. You should not respond to this context unless it is highly relevant to your task.
</system-reminder>
```

That message is a meta user message inserted before the real conversation messages. In tests, `prependUserContext()` is disabled.

`gakrcliMd` is omitted when:

- `GAKR_CODE_DISABLE_GAKR_MDS` is truthy.
- bare mode is active and there are no explicit added instruction directories.

## `gakrcliMd` Contents

`getMemoryFiles()` loads files in this broad order:

1. Managed global instructions and managed `.gakrcli/rules/*.md`.
2. User instructions and user `.gakrcli/rules/*.md`.
3. Workspace files from `~/.gakrcli/workspace/`.
4. Project `GAKRCLI.md`, `.gakrcli/GAKRCLI.md`, and `.gakrcli/rules/*.md`, walking from root down to cwd.
5. Local `gakrcli.local.md`.
6. Explicit `--add-dir` instruction files when enabled.
7. Auto-memory entrypoint `MEMORY.md`, when auto-memory is enabled.
8. Team memory entrypoint, when team memory is enabled.

Workspace files are rendered together as:

```text
Codebase and user instructions are shown below. Be sure to adhere to these instructions. IMPORTANT: These instructions OVERRIDE any default behavior and you MUST follow them exactly as written.

## GakrCLI Workspace Context

GakrCLI loaded these user-editable workspace files from the active workspace. GakrCLI is the CLI, agent harness, and orchestration runtime; the workspace files define the assistant identity, operating style, user profile, bootstrap state, rules, and durable memory. Internalize and follow them unless higher-priority instructions override.

<GAKRCLI_WORKSPACE>

# Project Context

The following workspace context files have been loaded:
SOUL.md: persona, tone, and working style. Follow it unless higher-priority instructions override.
RULEBOOK.md: stable workspace rules, including how to interpret the GakrCLI harness versus the assistant identity.
MEMORY.md: durable user preferences, decisions, and cross-project memory. Keep following it throughout the session unless higher-priority instructions override.
BOOTSTRAP.md: first-run workspace setup is active. If it is present, follow it before replying normally; do not wait for the user to ask. Once assistant identity and user identity are saved, delete BOOTSTRAP.md in the same turn.

## <absolute path to GAKRCLI.md>
<file content>

## <absolute path to RULEBOOK.md>
<file content>

## <absolute path to SOUL.md>
<file content>

## <absolute path to IDENTITY.md>
<file content>

## <absolute path to USER.md>
<file content>

## <absolute path to BOOTSTRAP.md>
<file content, only during first-run bootstrap>

## <absolute path to MEMORY.md>
<file content>

</GAKRCLI_WORKSPACE>
```

The workspace file order is fixed:

```text
GAKRCLI.md
AGENTS.md legacy compatibility, if present
RULEBOOK.md
SOUL.md
IDENTITY.md
USER.md
BOOTSTRAP.md
MEMORY.md
```

`BOOTSTRAP.md` only appears until first-run setup is complete.

## Persistent Workspace Files

`ensureGakrcliWorkspace()` creates:

```text
~/.gakrcli/workspace/
~/.gakrcli/workspace/projects/
~/.gakrcli/workspace/GAKRCLI.md
~/.gakrcli/workspace/RULEBOOK.md
~/.gakrcli/workspace/SOUL.md
~/.gakrcli/workspace/IDENTITY.md
~/.gakrcli/workspace/USER.md
~/.gakrcli/workspace/BOOTSTRAP.md
~/.gakrcli/workspace/MEMORY.md
~/.gakrcli/workspace/.gakrcli/workspace-state.json
```

The packaged templates live in `assets/workspace/`. If packaged templates are unavailable, fallback templates in `src/utils/workspace.ts` are used.

`BOOTSTRAP.md` is one-shot. It stops being seeded when:

- workspace state has `setupCompletedAt`; or
- `BOOTSTRAP.md` was deleted after being seeded; or
- `IDENTITY.md` has a completed name and `USER.md` has a completed name or "what to call them", in which case `ensureGakrcliWorkspace()` deletes stale bootstrap automatically.

## Main Agent First-Call Shape

A normal first user turn in this repo is shaped like this:

```ts
{
  systemPrompt: [
    "x-anthropic-billing-header: cc_version=...; cc_entrypoint=...;", // API layer
    "You are GakrCLI, an open-source coding agent and CLI.",          // API layer
    "# Intro / identity / cyber-risk rule ...",
    "# System ...",
    "# Doing tasks ...",
    "# Executing actions with care ...",
    "# Using your tools ...",
    "# Tone and style ...",
    "# Output efficiency ...",
    "__SYSTEM_PROMPT_DYNAMIC_BOUNDARY__", // only when enabled
    "# Session guidance ...",
    "# Memory ...",
    "# Environment\nYou have been invoked in the following environment:\n - Primary working directory: C:\\Users\\gajja\\Documents\\data-science\\Gakrcli\n - Is a git repository: true\n - Platform: win32\n - Shell: ...\n - OS Version: ...\n - You are powered by ...",
    "# MCP Server Instructions ...", // only when connected MCP servers provide instructions
    "# Scratchpad Directory ...", // only when enabled
    "When working with tool results, write down any important information you might need later in your response, as the original tool result may be cleared later.",
  ],
  messages: [
    {
      role: "user",
      isMeta: true,
      content: "<system-reminder>...# gakrcliMd...# currentDate...</system-reminder>",
    },
    {
      role: "user",
      content: "<the user's actual prompt>",
    },
    {
      role: "user",
      isMeta: true,
      content: "<system-reminder>The following skills are available for use with the Skill tool:\n\n- skill-name: description...</system-reminder>",
    },
  ],
  tools: [
    {
      name: "<tool name>",
      description: "<tool prompt>",
      input_schema: { type: "object", properties: { /* schema */ } },
      strict: true,          // optional
      cache_control: {},     // optional
      defer_loading: true,   // optional for deferred tool loading
    },
  ],
  options: {
    model: "<runtime main-loop model>",
    querySource: "<query source, usually repl_main_thread for the interactive main agent>",
    agents: "<active agent definitions>",
    allowedAgentTypes: "<allowed agent types>",
    mcpTools: "<prefetched MCP tools>",
    providerOverride: "<optional provider override>",
  },
}
```

The exact text and tool schemas vary by build flags, settings, provider, selected model, MCP servers, permission mode, active agents, output style, language setting, memory state, and feature gates.

## Live `/context` Example

The pasted run from this workspace showed:

```text
Model: stepfun-ai/step-3.7-flash
Context: 39.4k / 128k tokens (31%)
System prompt: 7.6k tokens
Custom agents: 2.7k tokens
Memory files: 8.2k tokens
Skills: 20.8k tokens
Free space: 55.6k tokens
Autocompact buffer: 33k tokens
```

That output is produced by `/context`, which reports the model-facing API view after context projection. It is not a raw transcript dump.

How to read those categories:

- `System prompt`: effective prompt blocks plus system-context accounting used by the analyzer.
- `Custom agents`: available non-built-in agent definitions, such as project agents from `assets/agents`.
- `Memory files`: loaded `~/.gakrcli/rules`, root workspace files, project auto-memory indexes, and team memory indexes.
- `Skills`: available skill frontmatter/listing metadata. This is not the full body of every `SKILL.md`; full skill instructions are loaded when the Skill tool invokes a matching skill.
- `Free space`: remaining context before buffers.
- `Autocompact buffer`: reserved space so the session can compact before hard overflow.

## Attachments And Later Turns

After the first user message, additional context can enter as model-facing messages. Most are synthetic user messages, often wrapped in `<system-reminder>`.

Common attachment sources:

- files mentioned with `@`
- IDE selection/open file context
- queued commands and task notifications
- MCP resource content
- agent mentions
- skill listing or skill discovery deltas
- MCP instruction deltas
- relevant auto-memory files
- nested instruction files for a path the agent is reading/editing
- diagnostics and LSP context
- hook output
- todo/task reminders
- date-change reminders
- plan-mode, auto-mode, or budget reminders
- companion/buddy context
- teammate mailbox context

Initial skill availability is also an attachment. `getSkillListingAttachments()` sends a hidden reminder like:

```text
The following skills are available for use with the Skill tool:

- <skill-name>: <description and when-to-use text>
```

The listing is capped to about 1% of the model context window by `src/tools/SkillTool/prompt.ts`. If skill search is enabled, user/project/plugin skills may be discovered dynamically instead of all being listed up front.

Tool calls add more context through normal conversation history:

```ts
[
  { role: "assistant", content: [{ type: "tool_use", name: "FileRead", input: { file_path } }] },
  { role: "user", content: [{ type: "tool_result", tool_use_id, content: "<tool output>" }] },
]
```

Large tool results may later be compressed, summarized, snipped, collapsed, or removed from direct context depending on context pressure and feature flags.

## Compaction And API View

The visible transcript is not always the same as the model-facing message list.

Before each API call, `query.ts` can apply:

- compact-boundary filtering
- context-collapse `projectView`
- microcompact
- autocompact
- reactive compact after prompt-too-long failures
- tool-result clearing/summarization

The `/context` command intentionally mirrors the pre-API transforms so it reports what the model sees, not raw terminal scrollback.

## Tool Schemas

Tools are sent beside messages and system prompt. `toolToAPISchema()` converts each runtime `Tool` to:

```ts
{
  name,
  description: await tool.prompt(...),
  input_schema,
  strict?,
  eager_input_streaming?,
  defer_loading?,
  cache_control?,
}
```

Tool schemas are cached by `getToolSchemaCache()` to avoid prompt-cache churn. MCP schemas are sanitized so `required` only references existing `properties`. Swarm fields are filtered out when swarms are disabled.

## Main Agent Versus Subagents

This file describes the main REPL agent. Subagents and agent-tool calls can have different prompts:

- Built-in and custom agents can replace or augment the default prompt.
- `enhanceSystemPromptWithEnvDetails()` adds subagent-specific notes, absolute-path guidance, and environment details.
- Forked background jobs, such as memory extraction, receive parent cache-safe context plus an extra task-specific user prompt.
- Coordinator mode replaces the default main prompt with the coordinator prompt when enabled.

## How To Inspect The Real Local Request

Use the runtime debug/dump paths instead of committing a literal dump. Literal request dumps can contain private workspace files, user profile, memories, git status, tool schemas, MCP content, and conversation history.

Useful inspection points:

- `/context`: shows model-facing context usage after API-view transforms.
- `src/services/api/dumpPrompts.ts`: captures recent API request bodies for internal/debug flows.
- `src/commands/context/context-noninteractive.ts`: shared data path for `/context` and SDK context usage.
- `src/utils/api.ts`: `prependUserContext()` shows the exact hidden user-context wrapper.
- `src/context.ts`: `getSystemContext()` and `getUserContext()` show the current top-level context keys.

## Maintenance Checklist

Update this file when any of these change:

- `getSystemPrompt()` block order or section names.
- `buildEffectiveSystemPrompt()` priority rules.
- `appendSystemContext()` or `prependUserContext()` serialization.
- `getMemoryFiles()` discovery order.
- workspace template filenames or bootstrap lifecycle.
- query pre-API transforms in `query.ts`.
- `/context` analysis behavior.
- tool schema serialization in `toolToAPISchema()`.
