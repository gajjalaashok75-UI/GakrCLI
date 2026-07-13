# Context System

Complete reference for GakrCLI's context architecture — how context is built, measured, displayed, compacted, and managed across the full stack.

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Context Building Pipeline](#2-context-building-pipeline)
3. [Context Window Resolution](#3-context-window-resolution)
4. [Token Counting & Estimation](#4-token-counting--estimation)
5. [Context Display in UI (Status Line)](#5-context-display-in-ui-status-line)
6. [Built-in Status Line](#6-built-in-status-line)
7. [Context Visualization Command](#7-context-visualization-command)
8. [Request Size Breakdown](#8-request-size-breakdown)
9. [Token Warning Component](#9-token-warning-component)
10. [Auto-Compact System](#10-auto-compact-system)
11. [Manual Compaction](#11-manual-compaction)
12. [Context Collapse (Feature-Flagged)](#12-context-collapse-feature-flagged)
13. [MicroCompact](#13-microcompact)
14. [Session Memory Compaction](#14-session-memory-compaction)
15. [Reactive Compact](#15-reactive-compact)
16. [Context Partitioning](#16-context-partitioning)
17. [Incremental Token Counter](#17-incremental-token-counter)
18. [Context Window Overrides](#18-context-window-overrides)
19. [1M Context Support](#19-1m-context-support)
20. [Key Source Files](#20-key-source-files)

---

## 1. Architecture Overview

The context system has four layers:

```
┌──────────────────────────────────────────────────────────────────┐
│                    Context Building                              │
│  ┌──────────────┐  ┌──────────────┐  ┌───────────────────────┐  │
│  │ System       │  │ User Context │  │ System Prompt Builder │  │
│  │ Context (git │  │ (GAKRCLI.md, │  │ (prompts + arc        │  │
│  │ status,      │  │ memory files,│  │  summary + tools      │  │
│  │ cache breaker)│  │ date)       │  │  instructions)        │  │
│  └──────────────┘  └──────────────┘  └───────────────────────┘  │
│                           │                                      │
│                           ▼                                      │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │                  Query Pipeline                          │   │
│  │  messages → compact boundary → context-collapse project  │   │
│  │  → microcompact → messagesForQuery → prependUserContext  │   │
│  │  → callModel({systemPrompt, messages, tools, ...})       │   │
│  └──────────────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌──────────────────────────────────────────────────────────────────┐
│              Token Measurement & Tracking                        │
│  ┌───────────────┐  ┌──────────────┐  ┌──────────────────────┐  │
│  │ Incremental   │  │ Usage from   │  │ Token Warning State  │  │
│  │ Token Counter │  │ API Response │  │ (thresholds: warning │  │
│  │ (content-     │  │ (input +     │  │  / error / blocking) │  │
│  │  aware cache) │  │  output +    │  │                      │  │
│  │               │  │  cache)      │  │                      │  │
│  └───────────────┘  └──────────────┘  └──────────────────────┘  │
└──────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌──────────────────────────────────────────────────────────────────┐
│              Context Management (Compaction)                     │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐   │
│  │ Auto-Compact │  │ Manual       │  │ Session Memory       │   │
│  │ (triggers at │  │ /compact cmd │  │ Compaction           │   │
│  │ threshold)   │  │              │  │                      │   │
│  └──────────────┘  └──────────────┘  └──────────────────────┘   │
│  ┌──────────────┐  ┌──────────────┐                              │
│  │ MicroCompact │  │ Context      │                              │
│  │ (pre-filter) │  │ Collapse     │                              │
│  └──────────────┘  └──────────────┘                              │
└──────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌──────────────────────────────────────────────────────────────────┐
│              Context UI Display                                  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐   │
│  │ StatusLine   │  │ Builtin      │  │ TokenWarning (inline │   │
│  │ (custom via  │  │ StatusLine   │  │  warning bar below   │   │
│  │  hook)       │  │ (model · ctx │  │  prompt input)       │   │
│  │              │  │  % · cost ·  │  │                      │   │
│  │              │  │  rate limit) │  │                      │   │
│  └──────────────┘  └──────────────┘  └──────────────────────┘   │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ /ctx command:  Context Window visualization with 30-char │   │
│  │ horizontal bar chart showing every category              │   │
│  └──────────────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────────┘
```

---

## 2. Context Building Pipeline

### Entry Point

The context for each API call is assembled in `src/query.ts` (the main query loop). The flow:

```
REPL.tsx
  → getSystemPrompt()       — Base system prompt
  → getUserContext()         — GAKRCLI.md + memory files + date
  → getSystemContext()       — Git status + cache breaker
  → buildEffectiveSystemPrompt()  — Merge with custom/append prompts
  → query({
       messages,
       systemPrompt,
       userContext,
       systemContext,
       ...
     })
```

### Three Context Components

#### 1. System Context (`src/context.ts:getSystemContext`)

Cached per conversation. Contains:
- **Git status** — branch, main branch, user name, status output (truncated at 2000 chars), recent 5 commits. Skipped in CCR (remote) mode or when git instructions are disabled.
- **Cache breaker** — Optional system prompt injection for cache-breaking (feature-flagged `BREAK_CACHE_COMMAND`, internal-only).

```typescript
// Shape returned
{
  gitStatus: string    // Git status block (or null)
  cacheBreaker: string // Optional injection (or null)
}
```

Memoized via `memoize()` — only computed once per conversation. Cache cleared when `setSystemPromptInjection()` is called.

#### 2. User Context (`src/context.ts:getUserContext`)

Cached per conversation. Contains:
- **GAKRCLI.md content** — Workspace files, project instructions, memory files (filtered via `filterInjectedMemoryFiles()`). Can be disabled via `GAKR_CODE_DISABLE_GAKR_MDS` env var or `--bare` mode.
- **Current date** — ISO date string for the model.

```typescript
// Shape returned
{
  gakrcliMd: string   // Concatenated workspace context (or null)
  currentDate: string // "Today's date is 2026-07-13."
}
```

#### 3. System Prompt (`src/constants/prompts.ts:getSystemPrompt`)

The base system prompt built from templates, including:
- Tool definitions
- Agent definitions
- Permission modes
- Workspace directories
- MCP client instructions
- Dynamic boundaries

Then `buildEffectiveSystemPrompt()` merges in:
- Custom system prompt (`customSystemPrompt`)
- Append system prompt (`appendSystemPrompt`)
- Main thread agent definition
- Conversation arc summary

### Query Pipeline

In `query.ts`, before the API call, the message array is transformed:

```
messages
  → getMessagesAfterCompactBoundary()   — Strip snip-hidden content
  → contextCollapse.projectView()       — Project collapsed views (feature-flagged)
  → microcompactMessages()              — Remove trivial tool pairs
  → autoCompactIfNeeded()               — Summarize if context is full
  → prependUserContext(messages, userContext) — Add hidden user context
  → callModel({ systemPrompt, messages, tools, ... })
```

Important: `fullSystemPrompt` (used for context accounting and compaction) includes `appendSystemContext(systemPrompt, systemContext)`, but the final API call passes `systemPrompt: promptWithArc` which may differ. The hidden user context is always prepended immediately before the model call.

---

## 3. Context Window Resolution

Located in `src/utils/context.ts`.

### Resolution Priority (highest wins)

```
1. GAKR_CODE_MAX_CONTEXT_TOKENS (internal env var, Ant-only)
2. Session override (set via /set-context-window command)
3. [1m] suffix in model name → 1,000,000 tokens
4. Integration runtime limits (3P providers)
   └─ Known model → resolveModelRuntimeLimits()
   └─ Unknown model → OPENAI_FALLBACK_CONTEXT_WINDOW (128k)
5. Model capability (getModelCapability().max_input_tokens)
   └─ If ≥100k and 1M is disabled → capped to 200k
6. Beta header (CONTEXT_1M_BETA_HEADER) + modelSupports1M() → 1M
7. Sonnet 1M experiment (GrowthBook flag) → 1M
8. Ant model metadata (USER_TYPE === 'ant')
9. MODEL_CONTEXT_WINDOW_DEFAULT = 200,000
```

### Constants

| Constant | Value | Purpose |
|----------|-------|---------|
| `MODEL_CONTEXT_WINDOW_DEFAULT` | 200,000 | Default for all models |
| `OPENAI_FALLBACK_CONTEXT_WINDOW` | 128,000 | Fallback for unknown 3P models |
| `COMPACT_MAX_OUTPUT_TOKENS` | 20,000 | Max output for compact operations |
| `MAX_OUTPUT_TOKENS_DEFAULT` | 32,000 | Default max output |
| `MAX_OUTPUT_TOKENS_UPPER_LIMIT` | 64,000 | Upper limit for most models |
| `CAPPED_DEFAULT_MAX_TOKENS` | 8,000 | Cap for slot-reservation optimization |
| `ESCALATED_MAX_TOKENS` | 64,000 | Escalated on first 400 error |
| `MIN_CONTEXT_WINDOW_OVERRIDE` | 33,000 | Minimum allowed override |

### Model-specific Max Output Tokens

The `getModelMaxOutputTokens()` function returns `{ default, upperLimit }`:

| Model | Default | Upper Limit |
|-------|---------|-------------|
| opus-4-6 | 64,000 | 128,000 |
| sonnet-4-6 | 32,000 | 128,000 |
| opus-4-5 / sonnet-4 / haiku-4 | 32,000 | 64,000 |
| opus-4-1 / opus-4 | 32,000 | 32,000 |
| claude-3-opus | 4,096 | 4,096 |
| claude-3-sonnet | 8,192 | 8,192 |
| claude-3-haiku | 4,096 | 4,096 |
| 3-5-sonnet / 3-5-haiku | 8,192 | 8,192 |
| 3-7-sonnet | 32,000 | 64,000 |
| 3P providers | 32,000 | (context window - 1) |
| Unknown (fallback) | 32,000 | 64,000 |

The `CAPPED_DEFAULT_MAX_TOKENS` (8k) override is applied in `gakrcli.ts:getMaxOutputTokensForModel` to avoid over-reserving slot capacity. If the model hits the cap, `query.ts` escalates to `ESCALATED_MAX_TOKENS` (64k) and retries.

---

## 4. Token Counting & Estimation

### Sources of Token Counts

#### A. API Response Usage (Authoritative)

From the Anthropic SDK response `usage` field:

```typescript
type Usage = {
  input_tokens: number
  output_tokens: number
  cache_creation_input_tokens?: number
  cache_read_input_tokens?: number
  // For Ant-only server-side tool loops:
  iterations?: Array<{ input_tokens: number; output_tokens: number }>
}
```

#### B. Rough Token Estimation (Local Fallback)

`roughTokenCountEstimation(content)` in `src/services/tokenEstimation.ts`:
- Approximately: `content.length / 4` characters ≈ tokens
- Used when API response usage is unavailable (e.g., streaming, estimated messages)

#### C. Token Counting API (Accurate via Haiku)

`countMessagesTokensWithAPI(messages, tools)` attempts the Anthropic token counting API endpoint. Falls back through:
1. **Token counting API** — Direct API call, returns exact count
2. **Haiku fallback** — `countTokensViaHaikuFallback()` — Calls Haiku model to count tokens (slower but accurate)
3. **Local estimation** — `estimateTokensLocally()` — Uses `roughTokenCountEstimation()` + tool schema overhead

#### D. Incremental Token Counter

`IncrementalTokenCounter` in `src/utils/incrementalTokenCounter.ts` provides O(1) cached token counting with content-aware invalidation:

```typescript
class IncrementalTokenCounter {
  getCount(messages)    // O(1) cached, O(n) on miss
  invalidate(messages)  // Force recalculate
  estimate(messages)    // Read-only estimate (no caching)
  getRemainingBudget(messages, contextWindow)
  getStats()            // Hit rate, average, etc.
}
```

Uses SHA-256 content hashing for cache validation. Incrementally estimates new messages when the prefix hasn't changed.

### Token Count Functions (in `src/utils/tokens.ts`)

| Function | Purpose |
|----------|---------|
| `getTokenCountFromUsage(usage)` | Total tokens from API usage (input + cache + output) |
| `getTokenUsage(message)` | Extract usage from an assistant message |
| `tokenCountFromLastAPIResponse(messages)` | Total from most recent API response |
| `finalContextTokensFromLastResponse(messages)` | Final context window size (for budget counting) — excludes cache tokens; prefers `iterations[-1]` |
| `messageTokenCountFromLastAPIResponse(messages)` | Output tokens only from last response |
| `getCurrentUsage(messages)` | Current usage with fallback estimation for zero-usage messages |
| `tokenCountWithEstimation(messages)` | **Canonical context size function** — last API usage + estimates for subsequent messages |
| `getAssistantMessageContentLength(message)` | Character length of assistant message content |
| `extractThinkingTokens(message)` | Breakdown of thinking vs output tokens |
| `getUnreportedSessionUsage(messages)` | Token usage from zero-usage messages not yet reported to API |
| `doesMostRecentAssistantMessageExceed200k(messages)` | Quick check for 200k+ context |

### `tokenCountWithEstimation()` — The Canonical Function

This is the **primary function** for measuring context size when checking thresholds (auto-compact, session memory init, etc.):

```typescript
export function tokenCountWithEstimation(messages: readonly Message[]): number {
  // 1. Walk backwards to find the most recent API response with usage data
  // 2. For parallel tool calls: walk back past sibling records sharing
  //    the same message.id to include interleaved tool_results
  // 3. Return: last API usage + incremental counter estimate for subsequent messages
}
```

### Token Usage History Tracking

The `TokenUsageTracker` class provides session-level analytics:

| Method | Purpose |
|--------|---------|
| `record(usage)` | Record a token usage event |
| `getAnalytics()` | Summary: totals, averages, cache hit rate, most-used model |
| `getRecent(windowMs)` | Recent entries within time window |
| `clear()` | Reset history |

---

## 5. Context Display in UI (Status Line)

### Custom Status Line Hook

`StatusLine.tsx` builds the input for a user-configured custom status line command. The data is passed as JSON to the user's `statusLine` hook command.

#### Context Window Data Shape

```typescript
context_window: {
  total_input_tokens: number          // Cumulative input
  total_output_tokens: number         // Cumulative output
  total_tokens_are_estimated?: boolean // True if includes estimated unreported usage
  context_window_size: number         // Model's total context window
  current_usage: {                    // Last API response usage
    input_tokens: number
    output_tokens: number
    cache_creation_input_tokens: number
    cache_read_input_tokens: number
  } | null
  used_percentage: number | null      // 0-100
  remaining_percentage: number | null // 100 - used
}
```

#### Calculation

In the status line builder:

```typescript
// 1. Resolve token totals (merge reported + estimated unreported usage)
const resolvedTokenTotals = resolveStatusLineTokenTotals(
  getTotalInputTokens(),
  getTotalOutputTokens(),
  getUnreportedSessionUsage(messages),
)

// 2. Get context window size for current model
const contextWindowSize = getContextWindowForModel(runtimeModel, getSdkBetas())

// 3. Calculate percentages
const contextPercentages = calculateContextPercentages(currentUsage, contextWindowSize)
// Returns: { used: number|null, remaining: number|null }
```

The percentage calculation:

```typescript
function calculateContextPercentages(currentUsage, contextWindowSize) {
  const totalInputTokens = currentUsage.input_tokens
    + currentUsage.cache_creation_input_tokens
    + currentUsage.cache_read_input_tokens

  const usedPercentage = Math.round((totalInputTokens / contextWindowSize) * 100)
  const clampedUsed = Math.min(100, Math.max(0, usedPercentage))

  return { used: clampedUsed, remaining: 100 - clampedUsed }
}
```

---

## 6. Built-in Status Line

`BuiltinStatusLine.tsx` renders the default status bar when no custom status line hook is configured.

### Format

```
{model} · ctx {pct}% · ${cost} · {rateLimit} {pct}%
```

Example: `claude-sonnet-4-6 · ctx 42% · $0.83 · 5h 12%`

### Context Percentage Display

- Displayed as `ctx {pct}%` (e.g., `ctx 42%`)
- Omitted before the first assistant turn (no data available)
- Color-coded based on threshold:
  - `≥ 90%` → red (error)
  - `≥ 70%` → yellow (warning)
  - `< 70%` → default color

### Segment Prioritization

When terminal width is limited, segments are dropped in priority order (highest number first):

| Segment | Priority | Description |
|---------|----------|-------------|
| model | 0 | Always shown (highest priority) |
| context | 1 | `ctx {pct}%` |
| cost | 2 | Session cost in USD |
| rateLimit | 3 | Worst rate-limit window (dropped first) |

### Built-in Status Display

```
┌─────────────────────────────────────────────────────────────────────┐
│ $ claude-sonnet-4-6 · ctx 42% · $0.83 · 5h 12%                    │
│ > _                                                                 │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 7. Context Visualization Command

The `/ctx` command (aliased as `/ctx_viz`, `/context-viz`) displays a comprehensive context window report. Defined in `src/commands/ctx_viz/index.ts`.

### Report Structure

```
┌─────────────────────────────────────────────────────────────┐
│  ► Context Window: claude-sonnet-4-6                       │
│                                                             │
│  Window Capacity                                            │
│    • Context window:     200,000 tokens                     │
│    • Effective context:  180,000 tokens                     │
│    • Max output:         32,000 tokens                      │
│    • Auto-compact at:    167,000 tokens                     │
│                                                             │
│  Current Context (what the model sees)                      │
│    Total: 85,234 / 200,000 tokens (43% used)                │
│                                                             │
│       85,234  █████████████░                  43%  Free space│
│       13,000  ██░░░░░░░░░░░                   7%  Autocompact│
│       45,000  ███████░░░░░░                  23%  Messages  │
│       12,000  ██░░░░░░░░░░░                   6%  System    │
│        8,000  █░░░░░░░░░░░░                   4%  Tool      │
│        5,000  █░░░░░░░░░░░░                   3%  Memory fi │
│        ...                                               ...│
│                                                             │
│  Last API Response                                          │
│    • Input:        42,000 tokens                            │
│    • Output:       1,234 tokens                             │
│    • Cache read:   15,000 tokens                            │
│                                                             │
│  Session Token Usage                                        │
│         85,000  █████████████░░░░░  70%  Input              │
│         35,000  █████░░░░░░░░░░░░░  29%  Output             │
│         1,000   ░░░░░░░░░░░░░░░░░░   1%  Cache read         │
│        Total: 121,000 tokens                                │
│                                                             │
│  Per-Model Session Totals                                   │
│    claude-sonnet-4-6: 85,000 in, 35,000 out, 1,000 cache   │
│                                                             │
│  Session Summary                                            │
│    • Cost:          $0.8345                                 │
│    • API duration:  2m 34s                                  │
│    • Wall duration: 5m 12s                                  │
│    • Code changes:  +120 / -45 lines                        │
│                                                             │
│  ℹ Run /context for detailed grid view, /cost for pricing, │
│    /stats for history                                       │
└─────────────────────────────────────────────────────────────┘
```

### Context Categories

The command uses `analyzeContextUsage()` from `src/utils/analyzeContext.ts` to categorize context usage:

| Category | Description |
|----------|-------------|
| System prompt | The base system instructions |
| Memory files | Injected memory/workspace files |
| Custom agents | Loaded agent definitions |
| Skills | Slash command frontmatter |
| System tools | Built-in tool schemas (always-loaded) |
| System tools (deferred) | Deferred tool schemas |
| MCP tools | MCP server tool schemas |
| Messages | Conversation history |
| Free space | Unused context window |
| Autocompact buffer | Reserved space (13k tokens) |
| Compact buffer | Manual compact reserve (3k tokens) |

### Collection

`collectCtxData()` gathers:

```typescript
{
  contextData: ContextData       // Category breakdown + percentages
  contextWindow: number           // Model's total window
  effectiveContext: number        // Minus output reservation
  autoCompactThreshold: number    // Effective minus 13k buffer
  maxOutput: { default, upperLimit }
  canonicalName: string
  autoCompactEnabled: boolean
  sessionInput / sessionOutput / sessionCacheRead / sessionCacheCreation: number
  sessionCost: number
  sessionApiDuration / sessionWallDuration: number
  linesAdded / linesRemoved: number
  modelUsageMap: Record<string, ModelUsage>
}
```

---

## 8. Request Size Breakdown

Located in `src/utils/requestSizeBreakdown.ts`. Provides a detailed breakdown of what contributes to the API request body size.

### Contributors

| Contributor | Kind | Description |
|-------------|------|-------------|
| System prompt | `system_prompt` | Base instructions |
| Tool schemas | `tool_schemas` | Built-in tool definitions |
| MCP server {name} | `mcp_tool_schemas` | Per-server MCP tool definitions |
| Conversation history | `conversation_history` | User + assistant messages |
| Tool calls | `tool_calls` | Tool invocation content |
| Tool results | `tool_results` | Tool output content |
| Attachments/media | `attachments` | Image/file/media attachments |
| Memory files | `memory` | Injected memory files |
| Custom agents | `agents` | Agent definitions |
| Skills | `skills` | Slash command frontmatter |
| Other request content | `other` | Unaccounted tokens |

Each contributor shows:
- Token count
- Byte estimate (tokens × 4)
- Optional detail (e.g., "Top calls: Bash 2,340, Read 890")

### `createRequestSizeReport()`

Generates a `RequestSizeReport` from `ContextData`:

```typescript
type RequestSizeReport = {
  estimatedTokens: number
  estimatedBytes: number
  contributors: RequestSizeContributor[]
  topContributors: RequestSizeContributor[]  // Top 10
}
```

---

## 9. Token Warning Component

`TokenWarning.tsx` renders an inline warning in the prompt input area when context usage approaches the limit.

### States

| State | Condition | Display |
|-------|-----------|---------|
| **Normal** | `tokenUsage < warningThreshold` | Nothing rendered |
| **Warning** | `tokenUsage >= warningThreshold` | Yellow: `{pct}% until auto-compact` |
| **Error** | `tokenUsage >= errorThreshold` | Red: `Context low ({pct}% remaining) · Run /compact to compact & continue` |
| **Blocking** | `tokenUsage >= blockingLimit` | Auto-compact triggered (or blocked) |

### Thresholds

```
autoCompactThreshold = effectiveContextWindow - AUTOCOMPACT_BUFFER_TOKENS (13k)
warningThreshold    = autoCompactThreshold - WARNING_THRESHOLD_BUFFER_TOKENS (20k)
errorThreshold      = autoCompactThreshold - ERROR_THRESHOLD_BUFFER_TOKENS (20k)
blockingLimit       = effectiveContextWindow - MANUAL_COMPACT_BUFFER_TOKENS (3k)
```

Since `WARNING_THRESHOLD_BUFFER_TOKENS` and `ERROR_THRESHOLD_BUFFER_TOKENS` are both 20k, the warning and error thresholds are currently identical. The color difference (warning vs error) comes from the state calculation in `calculateTokenWarningState()`.

### Warning Display Logic

```
If auto-compact enabled:
  "{pct}% until auto-compact"
If auto-compact disabled and below blocking limit:
  "Context low ({pct}% remaining) · Run /compact to compact & continue"
If auto-compact disabled and at blocking limit:
  "Context at limit ({pct}% remaining) · Run /compact to compact & continue"
```

### Compact Warning Suppression

After a successful compaction, warnings are suppressed via `useCompactWarningSuppression()` hook. This prevents redundant warnings immediately after the user has already managed context.

---

## 10. Auto-Compact System

Located in `src/services/compact/autoCompact.ts`.

### When Auto-Compact Triggers

`shouldAutoCompact()` checks:

1. **Recursion guard**: Skip if query source is `session_memory` or `compact`
2. **Context-collapse guard**: Skip if query source is `marble_origami`
3. **Feature enabled**: `isAutoCompactEnabled()` — checks env vars `DISABLE_COMPACT`, `DISABLE_AUTO_COMPACT`, and user config `autoCompactEnabled`
4. **Reactive-only mode**: Skip proactive compaction if GrowthBook flag `tengu_cobalt_raccoon` is enabled
5. **Token threshold**: `tokenCountWithEstimation(messages) >= getAutoCompactThreshold(model)`
6. **Force reason**: Can be overridden by `'memory-pressure'` or `'message-count'`
7. **Circuit breaker**: Skip if `MAX_CONSECUTIVE_AUTOCOMPACT_FAILURES` (3) exceeded and cooldown (5 min) not elapsed

### Circuit Breaker

```typescript
const MAX_CONSECUTIVE_AUTOCOMPACT_FAILURES = 3
const AUTOCOMPACT_FAILURE_COOLDOWN_MS = 5 * 60 * 1000  // 5 minutes
```

After 3 consecutive failures, auto-compact is skipped for 5 minutes (half-open after cooldown).

### Effective Context Window

```typescript
function getEffectiveContextWindowSize(model: string): number {
  // Model context window - max output tokens (capped at 20k for summary)
  // Env override: GAKR_CODE_AUTO_COMPACT_WINDOW
  // Floor: at least 33k (20k reserved + 13k buffer)
}
```

### Auto-Compact Flow

```
Auto-compact triggered
  → trySessionMemoryCompaction(messages)  — Attempt session memory first
  → microcompactMessages(messages)        — Pre-filter trivial pairs
  → compactConversation(messages, context, cacheSafeParams)
     → Fork agent to summarize conversation
     → Replace summarized portion with compact boundary message
  → runPostCompactCleanup()               — Reset collapse state
  → notifyCompaction()                    — Update cache break detection
  → markPostCompaction()                  — Set post-compact flag
```

---

## 11. Manual Compaction

Triggered via the `/compact` slash command. Defined in `src/commands/compact/compact.ts`.

### Flow

```
/compact [custom instructions]
  → getMessagesAfterCompactBoundary(messages)
  → trySessionMemoryCompaction(messages)  — If no custom instructions
     ├─ Success → return
     └─ Fall through → microcompactMessages()
       → compactConversation() or reactiveCompactOnPromptTooLong()
         → getUserContext.cache.clear()
         → runPostCompactCleanup()
         → notifyCompaction()
         → markPostCompaction()
```

### Error States

| Error | Message |
|-------|---------|
| Empty messages | "No messages to compact" |
| Too few messages | "Not enough messages to compact" |
| Incomplete response | "Incomplete response during compaction" |
| User abort | "Compaction canceled." |
| General error | "Error during compaction: {error}" |

### Compaction Progress

Progress events during compaction:
1. `hooks_start` — Pre-compact hooks executing
2. `compact_start` — Compaction beginning
3. `compact_end` — Compaction complete

---

## 12. Context Collapse (Feature-Flagged)

`feature('CONTEXT_COLLAPSE')` enables the context collapse system — an alternative to traditional compaction that summarizes older messages in-place without removing them.

### Concepts

- **Span**: A contiguous range of messages targeted for collapse
- **Staged span**: A span selected for collapse, waiting for the collapse agent
- **Committed collapse**: A span that has been collapsed (replaced by summary)
- **Projected view**: Messages with collapsed spans replaced by their summaries

### Key Operations

| Operation | Description |
|-----------|-------------|
| `projectView(messages)` | Replace collapsed spans with summaries for API view |
| `getStats()` | Current collapse statistics |
| `resetContextCollapse()` | Clear all collapse state |
| `isContextCollapseEnabled()` | Check if collapse mode is active |

### UI Display

When collapse mode is active, the TokenWarning component shows:
```
{collapsed} / {total} summarized
```

Or on error:
```
{collapsed} / {total} summarized · collapse errors: {n}
```

---

## 13. MicroCompact

Located in `src/services/compact/microCompact.ts`.

A lightweight pre-processing step that runs before full compaction. Removes trivial tool-use/tool-result pairs from the conversation that don't contribute meaningful context:

- File read operations where content matches expected stubs
- Tool searches returning empty results
- Other trivial or redundant tool pairs

Reduces the token count before the main compaction passes, making them more efficient.

---

## 14. Session Memory Compaction

Located in `src/services/compact/sessionMemoryCompact.ts`.

### Flow

1. Check if session memory is available and has enough context
2. Use session memory to compact conversation instead of traditional summarization
3. Faster than traditional compaction since it reuses existing memory
4. Falls through to traditional compaction if session memory is unavailable
5. Tried first in both auto-compact and `/compact` flows
6. Not attempted when custom `/compact` instructions are provided

### Cache Reset

After any compaction (session memory, traditional, reactive):
- `getUserContext.cache.clear()` — User context is recalculated
- `runPostCompactCleanup()` — Collapse state is reset
- `suppressCompactWarning()` — Warning is suppressed until next threshold breach

---

## 15. Reactive Compact

`feature('REACTIVE_COMPACT')` enables an alternative compaction strategy that reacts to `prompt_too_long` API errors rather than proactively compacting.

### Behavior

```typescript
if (feature('REACTIVE_COMPACT')) {
  if (getFeatureValue_CACHED_MAY_BE_STALE('tengu_cobalt_raccoon', false)) {
    // Skip proactive auto-compact entirely
    // Let reactive compact handle prompt_too_long errors
  }
}
```

### Flow on Prompt Too Long

1. API returns `prompt_too_long` error
2. `reactiveCompactOnPromptTooLong()` is called from the error handler
3. Attempts to compact the conversation just enough to fit
4. Retries the API call with compacted messages
5. Supported from both auto-compact path and manual `/compact` command

---

## 16. Context Partitioning

Located in `src/utils/contextPartitioning.ts`.

Splits conversation context into priority zones for intelligent retention decisions:

### Zones

| Zone | Max Tokens | Retention | Priority | Description |
|------|-----------|-----------|----------|-------------|
| `system` | 8,000 | keep_all | 1 (highest) | System messages |
| `recent` | 50,000 | keep_all | 4 | Last N messages |
| `important` | 30,000 | prune_least_important | 3 | Error/important content |
| `background` | 10,000 | prune_oldest | 2 | Everything else |

### Classification

Messages are classified into zones based on:
- **system role** → system zone
- **Contains error/fail/important keywords** → important zone
- **Long content (>2000 chars) or tool_use** → important zone
- **Recent messages** (last N) → recent zone
- **Everything else** → background zone

### Partition Result

```typescript
type PartitionedContext = {
  zones: Map<PriorityZone, Message[]>
  totalTokens: number
  zoneTokens: Map<PriorityZone, number>
  canFitInWindow: boolean
}
```

---

## 17. Incremental Token Counter

`IncrementalTokenCounter` in `src/utils/incrementalTokenCounter.ts` provides high-performance token counting.

### Performance

| Scenario | Complexity | Description |
|----------|-----------|-------------|
| Cache hit | O(1) | Same message count + same content hash |
| Incremental | O(n_new) | Messages appended, prefix unchanged |
| Full miss | O(n) | New content detected, full recount |
| Empty | O(1) | No messages, returns 0 |

### Cache Validation

Uses SHA-256 hash of concatenated message content. The hash is truncated to 16 characters (64 bits of entropy) — sufficient for collision avoidance in a single session.

### Hit Rate Tracking

```typescript
getStats(): {
  hits: number       // Cache hits
  misses: number     // Cache misses
  totalTokens: number // Cumulative counted
  averageTokens: number
  hitRate: number    // Percentage
}
```

### Factory Methods

| Factory | Budget | Auto-Invalidate | Multiplier | Use Case |
|---------|--------|-----------------|------------|----------|
| `realtime()` | 50,000 | true | 1.1 | Live streaming |
| `batch()` | 200,000 | false | 1.0 | Offline processing |
| `lightweight()` | 10,000 | true | 1.2 | Quick estimates |

---

## 18. Context Window Overrides

### Session-Scoped Override

Set via `/set-context-window <tokens>`:

```typescript
setSessionContextWindowOverride(model, tokens)
// Constraints: positive integer, minimum 33,000
getSessionContextWindowOverride(model)
clearSessionContextWindowOverride(model?) // Clear specific or all
getSessionContextWindowOverrides()        // Return all as Map
```

Normalizes model names (lowercase, strip provider prefix) for canonical lookup.

### Environment Variable Overrides

| Variable | Scope | Effect |
|----------|-------|--------|
| `GAKR_CODE_MAX_CONTEXT_TOKENS` | Ant-only | Cap effective context window |
| `GAKR_CODE_OPENAI_FALLBACK_CONTEXT_WINDOW` | All | Fallback for unknown 3P models (default: 128k) |
| `GAKR_CODE_AUTO_COMPACT_WINDOW` | All | Cap context window for auto-compact decisions |
| `GAKR_AUTOCOMPACT_PCT_OVERRIDE` | Test | Override auto-compact threshold as percentage |
| `GAKR_CODE_BLOCKING_LIMIT_OVERRIDE` | Test | Override blocking limit |
| `GAKR_CODE_DISABLE_1M_CONTEXT` | All | Force-disable 1M context |
| `GAKR_CODE_MAX_OUTPUT_TOKENS` | All | Override max output tokens |
| `DISABLE_COMPACT` | All | Disable all compaction |
| `DISABLE_AUTO_COMPACT` | All | Disable only auto-compact |

### CLI Commands

| Command | Effect |
|---------|--------|
| `/set-context-window <tokens>` | Set session override for current model |
| `/clear-context-window` | Clear all session overrides |
| `/ctx` | Display context usage report |
| `/compact` | Manually compact conversation |

---

## 19. 1M Context Support

### Detection

1M context is available for:
- Models with `[1m]` suffix in the name (explicit opt-in)
- `claude-sonnet-4` / `opus-4-6` / `opus-4-7` with `CONTEXT_1M_BETA_HEADER` beta
- Sonnet 4.6 with GrowthBook treatment flag `coral_reef_sonnet`

### Disable

Completely disable 1M context via environment variable:
```
GAKR_CODE_DISABLE_1M_CONTEXT=1
```

This is used by C4E admins for HIPAA compliance.

### Resolution Order

If `modelSupports1M()` returns true (and not disabled):

```
1. [1m] suffix → 1,000,000
2. CONTEXT_1M_BETA_HEADER in betas → 1,000,000 (for supported models)
3. Sonnet 1M experiment (GrowthBook) → 1,000,000
```

### Output Tokens with 1M

When 1M context is active, max output tokens remain at the model's standard limit (not scaled with context window). The effective context for auto-compact decisions still subtracts the output reservation.

---

## 20. Key Source Files

### Context Building

| File | Purpose |
|------|---------|
| `src/context.ts` | System context (git status), user context (GAKRCLI.md + date) |
| `src/utils/context.ts` | Context window resolution, percentage calculation |
| `src/constants/prompts.ts` | System prompt templates |
| `src/utils/systemPrompt.ts` | Effective system prompt builder |
| `src/utils/api.ts` | `prependUserContext()`, `appendSystemContext()` |

### Token Counting

| File | Purpose |
|------|---------|
| `src/utils/tokens.ts` | Token count functions, usage extraction, estimation, TokenUsageTracker |
| `src/utils/incrementalTokenCounter.ts` | High-performance cached token counter |
| `src/services/tokenEstimation.ts` | Rough token estimation (`roughTokenCountEstimation()`) |
| `src/utils/analyzeContext.ts` | Context analysis by category (system, tools, messages, etc.) |

### Context Display

| File | Purpose |
|------|---------|
| `src/components/StatusLine.tsx` | StatusLine input builder for custom hooks |
| `src/components/BuiltinStatusLine.tsx` | Default status line (model · ctx % · cost · rate limit) |
| `src/components/TokenWarning.tsx` | Inline context warning/error display |
| `src/commands/ctx_viz/index.ts` | `/ctx` command definition |
| `src/commands/ctx_viz/ctx-noninteractive.ts` | `/ctx` report renderer |
| `src/types/statusLine.ts` | StatusLine input type definition |

### Compaction

| File | Purpose |
|------|---------|
| `src/services/compact/autoCompact.ts` | Auto-compact triggers, thresholds, circuit breaker |
| `src/services/compact/compact.ts` | Core compact conversation logic |
| `src/services/compact/microCompact.ts` | Lightweight pre-compact filtering |
| `src/services/compact/sessionMemoryCompact.ts` | Session-memory-based compaction |
| `src/services/compact/reactiveCompact.ts` | Prompt-too-long reactive compaction |
| `src/services/compact/postCompactCleanup.ts` | Post-compaction state reset |
| `src/services/compact/compactWarningState.ts` | Compact warning suppression |

### Context Collapse

| File | Purpose |
|------|---------|
| `src/services/contextCollapse/index.ts` | Collapse system: spans, stats, enable check |
| `src/services/contextCollapse/operations.ts` | `projectView()`, collapse operations |

### Context Partitioning

| File | Purpose |
|------|---------|
| `src/utils/contextPartitioning.ts` | Priority zone partitioning |
| `src/utils/relevancePruning.ts` | Relevance-based message pruning |

### Request Size Breakdown

| File | Purpose |
|------|---------|
| `src/utils/requestSizeBreakdown.ts` | Detailed request size contributors |
| `src/utils/requestSizeBreakdown.test.ts` | Tests for request size breakdown |

### Query Loop

| File | Purpose |
|------|---------|
| `src/query.ts` | Main query loop — assembles context, manages compaction |
| `src/screens/REPL.tsx` | REPL screen — calls context builders before query |

### Commands

| File | Purpose |
|------|---------|
| `src/commands/compact/compact.ts` | `/compact` command |
| `src/commands/ctx_viz/index.ts` | `/ctx` command registration |
| `src/commands/set-context-window/set-context-window.ts` | `/set-context-window` |
| `src/commands/clear-context-window/clear-context-window.ts` | `/clear-context-window` |
| `src/commands/force-snip.ts` | `/force-snip` for urgent context reduction |
| `src/commands/break-cache/index.ts` | `/break-cache` command |

---

---

## 21. CLI Arguments

### Session Flags

| Flag | Type | Description |
|------|------|-------------|
| `-c, --continue` | Boolean | Continue the most recent conversation in the current directory |
| `-r, --resume [value]` | String/Boolean | Resume a conversation by session ID, or open interactive picker with optional search term |
| `--fork-session` | Boolean | When resuming, create a new session ID instead of reusing the original (use with `--resume` or `--continue`) |
| `--from-pr [value]` | String/Boolean | Resume a session linked to a PR by PR number/URL |
| `--no-session-persistence` | Boolean | Disable session persistence — sessions will not be saved to disk and cannot be resumed (only works with `--print`) |
| `--resume-session-at <message-id>` | String | When resuming, only messages up to and including the specified assistant message (use with `--resume` in print mode) |
| `--rewind-files <user-message-id>` | String | Restore files to state at the specified user message and exit (requires `--resume`) |
| `--session-id <uuid>` | String | Use a specific session ID for the conversation (must be a valid UUID) |
| `-n, --name <name>` | String | Set a display name for this session (shown in `/resume` and terminal title) |
| `--prefill <text>` | String | Pre-fill the prompt input with text without submitting it |

### Model & Provider Flags

| Flag | Description |
|------|-------------|
| `--model <model>` | Model for the current session (e.g. `'sonnet'`, `'opus'`, full name like `'claude-sonnet-4-6'`) |
| `--provider <provider>` | AI provider (anthropic, openai, gemini, github, bedrock, vertex, ollama) |
| `--effort <level>` | Effort level: low, medium, high, xhigh, max |
| `--betas <betas...>` | Beta headers to include in API requests |
| `--fallback-model <model>` | Enable automatic fallback when default model is overloaded |

### Context-Related Flags

| Flag | Description |
|------|-------------|
| `--system-prompt <prompt>` | Custom system prompt for the session |
| `--system-prompt-file <file>` | Read system prompt from a file |
| `--append-system-prompt <prompt>` | Append a custom system prompt to the default |
| `--append-system-prompt-file <file>` | Read system prompt from a file and append |
| `--add-dir <directories...>` | Additional directories to allow tool access to (also adds to GAKRCLI.md context) |
| `--bare` | Minimal mode: skip hooks, LSP, plugin sync, attribution, auto-memory, GAKRCLI.md auto-discovery |
| `--settings <file-or-json>` | Path to a settings JSON file or a JSON string to load additional settings from |
| `--max-budget-usd <amount>` | Maximum dollar amount to spend on API calls (only works with `--print`) |
| `--max-turns <turns>` | Maximum number of agentic turns in non-interactive mode |
| `--task-budget <tokens>` | API-side task budget in tokens (`output_config.task_budget`) |
| `--thinking <mode>` | Thinking mode: enabled, adaptive, disabled |
| `--max-thinking-tokens <tokens>` | Maximum thinking tokens (deprecated, use `--thinking`) |
| `--output-format <format>` | Output format with `--print`: text, json, stream-json |
| `--input-format <format>` | Input format with `--print`: text, stream-json |
| `--replay-user-messages` | Re-emit user messages from stdin back on stdout for acknowledgment |

### Model-Specific Context Details

Context window size behavior varies by model/provider:

| Provider | Context Resolution |
|----------|-------------------|
| **Anthropic (firstParty)** | Model capabilities → beta headers → 200k default |
| **OpenAI** | `openaiContextWindows.ts` lookup → `OPENAI_FALLBACK_CONTEXT_WINDOW` (128k default, overridable via `GAKR_CODE_OPENAI_FALLBACK_CONTEXT_WINDOW`) |
| **Bedrock** | `resolveModelRuntimeLimits()` → model metadata |
| **Vertex** | `resolveModelRuntimeLimits()` → model metadata |
| **Gemini** | `getModelCapability().max_input_tokens` |
| **GitHub Models** | Integration metadata lookup |
| **Ollama (local)** | `getModelCapability().max_input_tokens` or 128k fallback |

### Environment Variable Reference

| Variable | Affects | Default | Description |
|----------|---------|---------|-------------|
| `GAKR_CODE_MAX_CONTEXT_TOKENS` | All | — | Cap effective context window (Ant-internal) |
| `GAKR_CODE_OPENAI_FALLBACK_CONTEXT_WINDOW` | 3P models | 128,000 | Fallback window for unknown 3P models |
| `GAKR_CODE_AUTO_COMPACT_WINDOW` | Auto-compact | — | Cap context window for auto-compact decisions |
| `GAKR_AUTOCOMPACT_PCT_OVERRIDE` | Auto-compact | — | Override threshold as percentage (test helper) |
| `GAKR_CODE_BLOCKING_LIMIT_OVERRIDE` | Blocking | — | Override blocking limit (test helper) |
| `GAKR_CODE_DISABLE_1M_CONTEXT` | 1M support | — | Force-disable 1M context (HIPAA compliance) |
| `GAKR_CODE_MAX_OUTPUT_TOKENS` | Max output | — | Override max output tokens |
| `DISABLE_COMPACT` | Compaction | — | Disable all compaction |
| `DISABLE_AUTO_COMPACT` | Compaction | — | Disable only auto-compact |
| `GAKR_CODE_SIMPLE` | All | — | Minimal mode (set by `--bare`) |

---

## 22. Keybindings

### Context-Related Keybindings

| Key | Action | Context | Description |
|-----|--------|---------|-------------|
| `ctrl+o` | `app:toggleTranscript` | Global | Toggle transcript viewer to inspect conversation history |
| `ctrl+l` | `app:redraw` | Global | Redraw the terminal screen |
| `ctrl+r` | `history:search` | Global | Search conversation history |
| `up` / `down` | `history:previous` / `history:next` | Chat | Navigate input history |
| `ctrl+s` | `chat:stash` | Chat | Stash current message for later (preserves context) |
| `ctrl+_` / `ctrl+shift+-` | `chat:undo` | Chat | Undo last message or action |
| `ctrl+x ctrl+e` / `ctrl+g` | `chat:externalEditor` | Chat | Open external editor for composing long messages |
| `ctrl+c` (press twice) | `chat:cancel` | Chat | Cancel current generation (preserves partial context) |

### Command Bindings (via keybinding schema)

Users can bind keyboard shortcuts to context-related slash commands:

| Keybinding Value | Command | Description |
|------------------|---------|-------------|
| `command:ctx` | `/ctx` | Show context window usage visualization |
| `command:compact` | `/compact` | Trigger manual conversation compaction |
| `command:force-snip` | `/force-snip` | Urgent context reduction |
| `command:set-context-window` | `/set-context-window` | Set context window override |
| `command:clear-context-window` | `/clear-context-window` | Clear context window overrides |
| `command:break-cache` | `/break-cache` | Break prompt cache |
| `command:stats` | `/stats` | View session statistics |
| `command:cost` | `/cost` | View cost breakdown |
| `command:resume` | `/resume` | Resume previous conversation |

Example keybindings.json entry:
```json
{
  "context": "Global",
  "bindings": {
    "ctrl+k ctrl+c": "command:compact",
    "ctrl+k ctrl+v": "command:ctx"
  }
}
```

### Compact Warning Keybinding

When a TokenWarning bar is displayed showing context usage, the warning auto-suppresses after:
1. A successful compaction (manual or auto)
2. The user acknowledges the warning by pressing **Escape** (implied via Transcript context's `escape` → `transcript:exit`)
3. The compact warning suppression hook (`useCompactWarningSuppression`) clears after the next successful API turn

### Available Slash Commands Reference

| Command | Aliases | Description | Non-Interactive |
|---------|---------|-------------|-----------------|
| `/ctx` | `/ctx_viz`, `/context-viz` | Show context window usage and token breakdown | Yes |
| `/compact` | — | Compact and summarize conversation to free context | Yes |
| `/force-snip` | — | Urgent context reduction (last resort) | — |
| `/resume` | — | Select and resume a previous conversation | — |
| `/stats` | — | View session statistics | — |
| `/cost` | — | View cost breakdown | — |
| `/set-context-window <tokens>` | — | Set context window override for current model | — |
| `/clear-context-window` | — | Clear all context window overrides | — |
| `/break-cache` | — | Break the prompt cache | — |
| `/model` | — | Switch model (changes context window size) | — |
| `/settings` | — | Open settings (context-related settings available) | — |

*This document covers the context system as of GakrCLI v0.5.6. Source files referenced are relative to the repository root.*
