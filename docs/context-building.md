# GakrCLI Context Building

This document describes how GakrCLI builds the model context: startup workspace files, system prompt sections, user/project memory, attachments, tool results, and what changes after later turns.

## Big Picture

Each model call is built from these layers:

1. **System prompt**: static GakrCLI behavior, tool-use rules, safety rules, output style, dynamic environment info, MCP instructions, memory mechanics, and optional feature-gated sections.
2. **System context**: git status and optional cache-breaker context appended to the system prompt.
3. **User context**: workspace files, GAKRCLI.md/rules files, auto-memory index files, and current date, inserted as a hidden meta user message.
4. **Conversation history**: prior user messages, assistant messages, tool calls, tool results, attachments, compact summaries, and synthetic reminders.
5. **Current turn attachments**: files mentioned with `@`, IDE selection, queued task notifications, skill/MCP deltas, relevant memories, reminders, diagnostics, and other per-turn context.
6. **Tool schemas**: available tools, MCP tools, agents, and permissions are sent beside messages and prompt text.

The main entry points are:

- Startup workspace seeding: `src/setup.ts` -> `ensureGakrcliWorkspace()`
- System prompt: `src/constants/prompts.ts` -> `getSystemPrompt()`
- User/system context: `src/context.ts` -> `getUserContext()` and `getSystemContext()`
- Instruction and workspace file loading: `src/utils/gakrclimd.ts`
- Auto-memory mechanics: `src/memdir/paths.ts` and `src/memdir/memdir.ts`
- Attachments: `src/utils/attachments.ts`
- Query loop and tool continuation: `src/query.ts`
- SDK/headless orchestration: `src/QueryEngine.ts`

## Where Context Building Starts

For the normal CLI path, context building starts in two stages:

1. `main.tsx` calls `setup(...)`.
2. `setup()` calls `ensureGakrcliWorkspace()` before most runtime setup.
3. Later, when the first model call is needed, `query()` receives `systemPrompt`, `systemContext`, `userContext`, tools, and the current message list.
4. `query()` computes a `fullSystemPrompt` with `appendSystemContext(...)` for context accounting and compaction inputs. In the current main streaming call, `deps.callModel` receives `promptWithArc` as the direct `systemPrompt` argument, so verify the API path before assuming `systemContext` is serialized into every provider request.
5. Before calling the model, `query()` prepends `userContext` to the messages with `prependUserContext(...)`.

The practical call chain is:

```text
main.tsx
  -> setup(...)
     -> ensureGakrcliWorkspace()
        -> create ~/.gakrcli/workspace
        -> create ~/.gakrcli/workspace/projects
        -> seed GAKRCLI.md, RULEBOOK.md, SOUL.md, IDENTITY.md, USER.md, MEMORY.md
        -> seed BOOTSTRAP.md only until first-run setup completes

main.tsx / QueryEngine.ts
  -> getSystemPrompt(...)
     -> static GakrCLI rules
     -> dynamic env/memory/MCP/output-style sections

  -> getSystemContext()
     -> git status snapshot and optional cache breaker

  -> getUserContext()
     -> getMemoryFiles()
        -> ensureGakrcliWorkspace()
        -> read workspace files from getWorkspaceBootstrapPaths()
        -> read user/project/local GAKRCLI.md and rules
        -> read auto-memory entrypoints when enabled
     -> getgakrcliMds(...)
        -> render workspace files as <GAKRCLI_WORKSPACE>
        -> render other instruction/memory files
     -> add currentDate

query.ts
  -> appendSystemContext(systemPrompt, systemContext) for accounting/compaction
  -> prependUserContext(messagesForQuery, userContext)
  -> callModel({ systemPrompt, messages, tools, ... })
```

The important detail is that `setup()` creates the workspace, but `getUserContext()` is what reads the workspace files and turns them into model context. `getMemoryFiles()` also calls `ensureGakrcliWorkspace()` again, so direct SDK/headless paths still get the workspace initialized before reading.

## First Startup

`setup()` calls `ensureGakrcliWorkspace()` before most runtime setup. This creates:

- `~/.gakrcli/workspace/`
- `~/.gakrcli/workspace/projects/`
- workspace markdown files from `assets/workspace/`
- workspace state at `~/.gakrcli/workspace/.gakrcli/workspace-state.json`

The workspace context files are:

- `GAKRCLI.md`
- `RULEBOOK.md`
- `SOUL.md`
- `IDENTITY.md`
- `USER.md`
- `BOOTSTRAP.md`
- `MEMORY.md`

There is intentionally no `BOOT.md` in this GakrCLI flow.

Each packaged workspace file includes its canonical home location, such as:

```text
~/.gakrcli/workspace/GAKRCLI.md
~/.gakrcli/workspace/RULEBOOK.md
~/.gakrcli/workspace/MEMORY.md
```

Those location notes are part of the prompt contract. They tell the model and the auto-update memory flow which root workspace file should be edited when a fact belongs globally instead of under a project-specific memory directory.

### BOOTSTRAP.md

`BOOTSTRAP.md` is the first-run setup file. It is seeded only when setup has not completed.

During the first run, `BOOTSTRAP.md` is loaded into workspace context and tells the model to learn the workspace assistant identity, user details, soul/behavior preferences, durable rules, and then delete `BOOTSTRAP.md` in the same turn.

After `BOOTSTRAP.md` is deleted, `ensureGakrcliWorkspace()` records `setupCompletedAt` and does not recreate it. On later runs it is absent from disk, so it is not loaded into context.

If the model saves both assistant identity and user identity but forgets to delete `BOOTSTRAP.md`, the next `ensureGakrcliWorkspace()` pass treats that as completed bootstrap only when `IDENTITY.md` has a completed `- **Name:** ...` line and `USER.md` has either a completed `- **Name:** ...` line or a completed `- **What to call them:** ...` line. It then deletes `BOOTSTRAP.md`, records `setupCompletedAt`, and stops loading bootstrap context.

The order entry in `gakrclimd.ts`:

```ts
['bootstrap.md', 60]
```

is only a sort rule for `BOOTSTRAP.md` while that file exists. It does not force the file into every turn.

## Workspace Persistent Storage

The persistent base is:

```text
~/.gakrcli/workspace
```

Project/session scoped state is under:

```text
~/.gakrcli/workspace/projects/<sanitized-project-root>/
```

Auto-memory for a project defaults to:

```text
~/.gakrcli/workspace/projects/<sanitized-git-root-or-project-root>/memory/
```

The auto-memory entrypoint is:

```text
~/.gakrcli/workspace/projects/<project>/memory/MEMORY.md
```

That is separate from workspace root `~/.gakrcli/workspace/MEMORY.md`, which is cross-project workspace memory loaded with the other workspace files.

Workspace root files can also be updated directly when the durable information belongs across projects:

- `RULEBOOK.md`: stable rules, autonomy boundaries, memory policy, and harness-vs-assistant interpretation
- `MEMORY.md`: curated cross-project memory
- `USER.md`: durable user profile and collaboration preferences
- `IDENTITY.md`: assistant name, nature, avatar, and identity
- `SOUL.md`: assistant personality, tone, values, and working style
- `GAKRCLI.md`: workspace overview and broad operating instructions

The memory prompt tells the model to update these workspace files instead of duplicating global facts in project auto-memory. Project-specific facts stay under `~/.gakrcli/workspace/projects/<project>/memory/`. `BOOTSTRAP.md` is part of first-run setup, not a durable memory target.

The canonical root workspace update targets are:

```text
~/.gakrcli/workspace/GAKRCLI.md
~/.gakrcli/workspace/RULEBOOK.md
~/.gakrcli/workspace/SOUL.md
~/.gakrcli/workspace/IDENTITY.md
~/.gakrcli/workspace/USER.md
~/.gakrcli/workspace/MEMORY.md
```

`BOOTSTRAP.md` is also located at `~/.gakrcli/workspace/BOOTSTRAP.md` while first-run setup is active, but it is not a durable update target after setup completes.

## System Prompt Build

`getSystemPrompt()` builds an array of prompt sections.

In normal mode, the static/cacheable part includes:

- GakrCLI identity and intro
- basic system/tool rules
- task execution rules
- safety and confirmation guidance
- tool-use guidance
- tone/style
- output efficiency

Then the dynamic section adds:

- session-specific guidance
- auto-memory mechanics from `loadMemoryPrompt()`
- environment info such as cwd/date/model context
- language setting
- output style setting
- MCP server instructions, unless using MCP instruction deltas
- scratchpad instructions
- function-result clearing rules
- tool-result summarization rules
- feature-gated token budget / brief / numeric length sections

In bare/simple mode, the system prompt is much smaller: identity, cwd, and date.

If the SDK caller supplies a custom system prompt, the default prompt is replaced. If `GAKR_COWORK_MEMORY_PATH_OVERRIDE` is also set, GakrCLI still injects memory mechanics so the model knows how to use the provided memory directory.

## System Context

`getSystemContext()` creates context appended to the system prompt with `appendSystemContext()`.

It may include:

- git status snapshot
- current branch
- default/main branch
- git user
- recent commits
- optional cache breaker

Git status is skipped in remote mode and when git instructions are disabled.

This is cached for the conversation, so it is a startup snapshot, not a live status feed.

## User Context

`getUserContext()` creates a map inserted before the conversation as a hidden meta user message through `prependUserContext()`.

The generated hidden message has this shape:

```text
<system-reminder>
As you answer the user's questions, you can use the following context:

# gakrcliMd
...

# currentDate
Today's date is YYYY-MM-DD.

IMPORTANT: this context may or may not be relevant...
</system-reminder>
```

User context normally contains:

- `gakrcliMd`: rendered instructions/memory files
- `currentDate`: local date

`gakrcliMd` is disabled when:

- `GAKR_CODE_DISABLE_GAKR_MDS` is truthy
- bare mode is active and there are no explicit added instruction directories

## Real First-Call Example

This is a representative first model call for a normal interactive session in:

```text
C:\Users\gajja\Documents\data-science\Gakrcli
```

Assume these files exist:

```text
C:\Users\gajja\.gakrcli\workspace\GAKRCLI.md
C:\Users\gajja\.gakrcli\workspace\RULEBOOK.md
C:\Users\gajja\.gakrcli\workspace\SOUL.md
C:\Users\gajja\.gakrcli\workspace\IDENTITY.md
C:\Users\gajja\.gakrcli\workspace\USER.md
C:\Users\gajja\.gakrcli\workspace\MEMORY.md
C:\Users\gajja\.gakrcli\workspace\BOOTSTRAP.md
C:\Users\gajja\Documents\data-science\Gakrcli\GAKRCLI.md
```

The model request is shaped like this:

```ts
callModel({
  systemPrompt: [
    "# Identity\nYou are an interactive agent...",
    "# System Rules\n...",
    "# Doing Tasks\n...",
    "# Actions\n...",
    "# Using Your Tools\n...",
    "# Tone and style\n...",
    "# Output efficiency\n...",
    "Here is useful information about the environment you are running in:\n<env>\nPrimary working directory: C:\\Users\\gajja\\Documents\\data-science\\Gakrcli\nIs a git repository: true\nPlatform: win32\nOS Version: ...\n</env>\n...",
    "gitStatus: This is the git status at the start of the conversation...\n\nCurrent branch: <current-branch>\n\nMain branch (you will usually use this for PRs): <default-branch>\n\nStatus:\n...\n\nRecent commits:\n..."
  ],
  messages: [
    {
      role: "user",
      isMeta: true,
      content: `<system-reminder>
As you answer the user's questions, you can use the following context:
# gakrcliMd
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

## C:\\Users\\gajja\\.gakrcli\\workspace\\GAKRCLI.md

# GAKRCLI.md - Your Workspace
This folder is home. Treat it that way.
...

## C:\\Users\\gajja\\.gakrcli\\workspace\\RULEBOOK.md

# RULEBOOK.md - Workspace Rules
GakrCLI is the command-line interface, agent harness, and orchestration runtime.
...

## C:\\Users\\gajja\\.gakrcli\\workspace\\SOUL.md

# SOUL.md - Who You Are
...

## C:\\Users\\gajja\\.gakrcli\\workspace\\IDENTITY.md

# IDENTITY.md - Who Am I?
...

## C:\\Users\\gajja\\.gakrcli\\workspace\\USER.md

# USER.md - About The User
...

## C:\\Users\\gajja\\.gakrcli\\workspace\\BOOTSTRAP.md

# BOOTSTRAP.md - First Run
This is a fresh workspace. Time to set the assistant identity.
...

## C:\\Users\\gajja\\.gakrcli\\workspace\\MEMORY.md

# MEMORY.md - Durable Memory
...

</GAKRCLI_WORKSPACE>

Contents of C:\\Users\\gajja\\Documents\\data-science\\Gakrcli\\GAKRCLI.md (project instructions, checked into the codebase):

<project instructions...>

# currentDate
Today's date is YYYY-MM-DD.

      IMPORTANT: this context may or may not be relevant to your tasks. You should not respond to this context unless it is highly relevant to your task.
</system-reminder>
`
    },
    {
      role: "user",
      content: "check the context-building doc and also where that is context build starts and all and then i want a real example full context that building ok"
    }
  ],
  tools: [
    {
      name: "Read",
      description: "...",
      input_schema: { type: "object", properties: { ... } }
    },
    {
      name: "Edit",
      description: "...",
      input_schema: { type: "object", properties: { ... } }
    }
  ],
  options: {
    model: "<current main loop model>",
    mcpTools: [],
    agents: ["general-purpose", "..."],
    querySource: "user"
  }
})
```

The exact system prompt sections and tool schemas vary by enabled tools, feature flags, MCP servers, provider, model, and settings. The ordering above is the stable shape: system prompt first, system context appended to it, hidden user context prepended to messages, then the real user message.

To inspect the exact live context for a local run, use prompt/debug dumping rather than committing the dump to this repo. A literal full dump can contain private workspace identity, user profile, memory, project rules, git status, and tool schemas.

### After Bootstrap Is Deleted

After the model deletes:

```text
C:\Users\gajja\.gakrcli\workspace\BOOTSTRAP.md
```

the next loaded `gakrcliMd` block no longer contains:

```text
BOOTSTRAP.md: first-run workspace setup...

## C:\Users\gajja\.gakrcli\workspace\BOOTSTRAP.md
...
```

The workspace block still contains `GAKRCLI.md`, `RULEBOOK.md`, `SOUL.md`, `IDENTITY.md`, `USER.md`, and `MEMORY.md`.

### After A Tool Call

If the assistant reads a file, the next continuation call includes the prior assistant tool call and a tool result message in conversation history:

```ts
messages: [
  { role: "user", isMeta: true, content: "<system-reminder>...same user context...</system-reminder>" },
  { role: "user", content: "check the context-building doc..." },
  {
    role: "assistant",
    content: [
      { type: "text", text: "I will inspect the doc and code path." },
      { type: "tool_use", name: "Read", input: { file_path: "docs/context-building.md" } }
    ]
  },
  {
    role: "user",
    content: [
      {
        type: "tool_result",
        tool_use_id: "...",
        content: "# GakrCLI Context Building\n..."
      }
    ]
  }
]
```

`query()` then may add fresh attachments before the continuation, such as diagnostics, nested memory, relevant auto-memory, hook results, or date-change reminders. Those attachments are also model-facing user messages, usually wrapped as hidden reminders.

## Instruction File Loading

`getMemoryFiles()` loads instruction files in priority order. Later files are higher priority.

The major categories are:

- **Managed**: policy/global managed instructions
- **User**: private user-level instructions and `~/.gakrcli/rules/*.md`
- **Workspace**: `~/.gakrcli/workspace/*.md`
- **Project**: `GAKRCLI.md`, `.gakrcli/GAKRCLI.md`, and `.gakrcli/rules/*.md` discovered from root to cwd
- **Local**: private project-local instructions
- **AutoMem/TeamMem**: auto-memory entrypoints when enabled

Workspace files are loaded by first calling `ensureGakrcliWorkspace()`, then reading the workspace paths from `getWorkspaceBootstrapPaths()`.

Workspace context is rendered as:

```text
## GakrCLI Workspace Context

GakrCLI loaded these user-editable workspace files...

<GAKRCLI_WORKSPACE>
# Project Context
...
## /home/user/.gakrcli/workspace/SOUL.md
...
</GAKRCLI_WORKSPACE>
```

Special hints are added only if the matching file is present:

- `SOUL.md`: persona/tone/working style
- `RULEBOOK.md`: stable workspace rules and harness-vs-assistant interpretation
- `MEMORY.md`: durable cross-project memory
- `BOOTSTRAP.md`: first-run setup

So after `BOOTSTRAP.md` is deleted, the bootstrap hint and file content disappear.

## Auto-Memory

Auto-memory is enabled by default unless disabled by env/settings/simple mode/remote storage constraints.

`loadMemoryPrompt()` adds the behavioral rules for saving memory:

- where the memory directory is
- how to distinguish project auto-memory from root workspace files
- when to save or update memory
- memory types
- what not to save
- how to write topic files and update `MEMORY.md`
- how to search past context

By default, auto-memory path is:

```text
~/.gakrcli/workspace/projects/<sanitized-canonical-project-root>/memory/
```

The project key uses the canonical git root when available, so worktrees of the same repo share the same memory directory.

If `autoMemoryDirectory` is set in trusted settings or `GAKR_COWORK_MEMORY_PATH_OVERRIDE` is set, those override the default.

Auto-memory content is not all injected every turn. The `MEMORY.md` index may be loaded into instruction context, and relevant topic files can be surfaced later as attachments.

### Main Agent Versus Auto-Update Memory Fork

The main agent and the background memory extraction agent start from the same cache-critical context, but they use it for different jobs.

The main agent context includes:

- the system prompt from `getSystemPrompt()`
- `systemContext` from `getSystemContext()`, including the startup git snapshot when enabled
- `userContext` from `getUserContext()`, including rendered workspace/project instruction files, workspace `MEMORY.md`, project/team memory entrypoints, and `currentDate`
- the active conversation messages after compaction/collapse projection
- current-turn and continuation attachments such as tool results, IDE context, relevant memory topic files, diagnostics, queued commands, skill/MCP deltas, and reminders
- the live `ToolUseContext`, including the available tools, MCP tools, agents, model/provider options, permission state, file-read state, and runtime callbacks

The auto-update memory fork is launched from `initExtractMemories()` after a completed main query loop. It receives `createCacheSafeParams(context)`, which copies the parent's:

- `systemPrompt`
- `userContext`
- `systemContext`
- `toolUseContext`
- model-facing parent `messages`

`runForkedAgent()` then creates the fork request as:

```text
initialMessages = parent model-facing messages + extraction prompt message
query({
  messages: initialMessages,
  systemPrompt: parent systemPrompt,
  userContext: parent userContext,
  systemContext: parent systemContext,
  toolUseContext: isolated clone of parent toolUseContext,
  querySource: "extract_memories"
})
```

So the fork sees the same workspace files, root `MEMORY.md`, project/team `MEMORY.md` indexes, current date, system prompt, tool schemas, and conversation prefix that the main agent used. It also sees one extra user prompt from `src/services/extractMemories/prompts.ts` that tells it to analyze only the recent messages and update persistent memory.

The fork is intentionally different in these ways:

- It appends a memory-extraction instruction instead of answering the user.
- Its mutable tool state is isolated with `createSubagentContext()`, so file-read state, tool decisions, nested-memory triggers, and abort handling do not mutate the main loop directly.
- Permission prompts are avoided for the background fork; it uses `createAutoMemCanUseTool()` to allow only the memory-safe read/search/write operations it needs.
- It skips transcript recording (`skipTranscript: true`) so the background write pass does not race with or pollute the main conversation transcript.
- It has a hard `maxTurns: 10` cap.
- It skips running when the main agent already wrote memory files in the same message range.

The fork should not create dated session files such as `DD-MM-YYYY.md` or `YYYY-MM-DD.md`. It should update semantic topic files under the project private memory directory, the team memory directory when enabled, and the relevant `MEMORY.md` index. Cross-project durable facts still belong in root workspace files such as `~/.gakrcli/workspace/MEMORY.md`, `USER.md`, or `RULEBOOK.md`.

## Current User Turn

For each user prompt, `processUserInput()` builds the user message and immediate attachments. This can include:

- `@` mentioned files
- MCP resources
- agent mentions
- skill discovery from the prompt
- slash-command generated content
- permission/model changes from slash commands

The user message and these attachments are persisted to the session transcript before the model call, so the session can resume even if the process dies before the assistant response.

## Attachments

Attachments are synthetic context messages. Most render as hidden `<system-reminder>` user messages.

Attachment sources include:

- queued commands and task notifications
- date change
- ultrathink effort
- deferred tool/agent/MCP instruction deltas
- output style
- selected/opened IDE files
- edited file snippets
- nested instruction files
- relevant auto-memory files
- skill listing and skill discovery
- diagnostics and LSP diagnostics
- todo/task reminders
- plan-mode reminders
- auto-mode reminders
- token and budget usage
- teammate mailbox messages
- companion/buddy context

Some attachments are first-turn or event-driven. Others are inserted after tool calls before continuation so the model sees new state in the next API loop.

### Relevant Memories

Relevant memories are selected from auto-memory topic files. They are capped and rendered as hidden reminders with stable headers. This lets GakrCLI surface only likely-useful memory instead of dumping the entire memory directory every turn.

### Nested Memory

Nested memory is loaded when a file or directory path triggers additional scoped instruction files. It is rendered as:

```text
Contents of <path>:

<content>
```

## Tool Calls And Continuations

When the model emits tool-use blocks, `query.ts` executes the tools.

The flow is:

1. Assistant response streams and tool-use blocks are collected.
2. Tools run through `StreamingToolExecutor` or `runTools()`.
3. Tool outputs become `tool_result` user messages.
4. Hook results or errors can also become attachments.
5. Tool results are appended to the active message list.
6. GakrCLI may add new attachments based on changed state.
7. If more work is needed, the query loop calls the model again with the updated messages.

This is why context after tool runs contains both the assistant's tool call and the tool result. The model can then reason over the actual output in the next loop.

Tool results can be compressed, summarized, collapsed, or removed from direct context depending on size, model limits, and enabled compaction features.

## After Several Turns

As the session grows, context includes:

- the original hidden user context message
- human user messages
- assistant messages
- tool-use blocks
- tool-result messages
- attachments from prior turns
- compact/microcompact/context-collapse boundary messages
- generated summaries
- file edit/read state used for deduplication and stale-file detection

GakrCLI does not rebuild the entire static context from scratch on every small event. It uses memoization and cache-safe sections to avoid unnecessary prompt cache misses.

Examples:

- Git status is a startup snapshot.
- `currentDate` in user context is cached; date changes are sent as tail attachments.
- MCP instructions can be sent as deltas instead of changing the system prompt.
- Agent lists can be sent as deltas instead of changing tool descriptions.

## Compaction And Context Limits

Before each model call, `query.ts` may apply:

- microcompact
- context collapse
- auto-compact
- reactive compact on overflow
- blocking-limit checks

Compaction can replace older history with summary messages and attachments. The full UI/transcript may retain more than what is sent to the model; the query path projects a smaller model-facing view.

After compaction, the model sees:

- system prompt
- current user/system context
- compact summary/boundary messages
- preserved recent messages
- new attachments and tool results

This keeps long sessions usable while preserving important state.

## What Is In Context On First Run

On a fresh install, the model sees:

- normal system prompt
- memory mechanics prompt
- system context such as git status
- hidden user context containing workspace files
- `BOOTSTRAP.md` content
- empty/new workspace `IDENTITY.md`, `USER.md`, `RULEBOOK.md`, `SOUL.md`, and `MEMORY.md`
- current date
- current user prompt
- any attachments from the prompt

The model should follow `BOOTSTRAP.md`, update identity/user/rulebook/soul/memory files as appropriate, and delete `BOOTSTRAP.md` when setup is complete.

## What Is In Context After Bootstrap

After `BOOTSTRAP.md` is deleted:

- `BOOTSTRAP.md` is not reseeded
- no bootstrap hint is rendered
- no bootstrap content is loaded
- workspace `GAKRCLI.md`, `RULEBOOK.md`, `SOUL.md`, `IDENTITY.md`, `USER.md`, and `MEMORY.md` continue to load
- project auto-memory continues under `~/.gakrcli/workspace/projects/<project>/memory/`
- later turns may surface relevant memory topic files as attachments

## Important Distinctions

Workspace root memory:

```text
~/.gakrcli/workspace/MEMORY.md
```

Cross-project durable workspace memory.

Project auto-memory:

```text
~/.gakrcli/workspace/projects/<project>/memory/MEMORY.md
```

Project-scoped typed memory index and topic files.

Session transcripts:

```text
~/.gakrcli/workspace/projects/<project>/<session-id>.jsonl
```

Conversation history used for resume, stats, and past-session lookup.

Tool-result storage:

Stored under project/session state as needed for large or persisted tool outputs.

## Practical Debug Checklist

To inspect context behavior:

1. Check seeded workspace files:

   ```bash
   ls ~/.gakrcli/workspace
   ```

2. Check project/session storage:

   ```bash
   ls ~/.gakrcli/workspace/projects
   ```

3. Check whether first-run bootstrap is active:

   ```bash
   test -f ~/.gakrcli/workspace/BOOTSTRAP.md && echo bootstrap-active
   ```

4. Check project auto-memory:

   ```bash
   find ~/.gakrcli/workspace/projects -path "*/memory/*" -maxdepth 5
   ```

5. If `BOOTSTRAP.md` was deleted and comes back, inspect:

   ```text
   ~/.gakrcli/workspace/.gakrcli/workspace-state.json
   ```

   It should have `bootstrapSeededAt` and eventually `setupCompletedAt`.

6. If workspace files are not entering context, inspect:

   - `getUserContext()` in `src/context.ts`
   - `getMemoryFiles()` in `src/utils/gakrclimd.ts`
   - `ensureGakrcliWorkspace()` in `src/utils/workspace.ts`

## Summary

GakrCLI context is not one file or one prompt. It is a layered runtime build:

- system prompt for behavior
- system context for environment snapshot
- user context for workspace/user/project instructions
- auto-memory prompt for persistence behavior
- conversation history for continuity
- attachments for fresh state
- tool results for action feedback
- compaction to keep long sessions under model limits

The OpenClaw-style workspace now gives GakrCLI persistent identity and memory through `~/.gakrcli/workspace/`, while project-scoped sessions and memory live under `~/.gakrcli/workspace/projects/`.
