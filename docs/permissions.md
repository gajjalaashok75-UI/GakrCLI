# Permission System

Complete reference for GakrCLI's permission architecture — modes, rule engine, prompt UI, extension integration, and runtime behavior.

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Permission Modes](#2-permission-modes)
3. [Permission Behaviors & Rules](#3-permission-behaviors--rules)
4. [Rule Matching Engine](#4-rule-matching-engine)
5. [Permission Check Pipeline](#5-permission-check-pipeline)
6. [Permission Prompt UI (Terminal/CLI)](#6-permission-prompt-ui-terminalcli)
7. [Interactive Permission Handler](#7-interactive-permission-handler)
8. [Coordinator Permission Handler](#8-coordinator-permission-handler)
9. [VSCode Extension Permission System](#9-vscode-extension-permission-system)
10. [Permission Explainer (AI-Powered)](#10-permission-explainer-ai-powered)
11. [Denial Tracking](#11-denial-tracking)
12. [Dangerous Mode Confirmation](#12-dangerous-mode-confirmation)
13. [Permission Rule Parser](#13-permission-rule-parser)
14. [Runtime Permission Updates](#14-runtime-permission-updates)
15. [Permission Logging & Analytics](#15-permission-logging--analytics)
16. [Permissions Command](#16-permissions-command)
17. [Key Source Files](#17-key-source-files)

---

## 1. Architecture Overview

The permission system has three layers:

```
┌─────────────────────────────────────────────────────────┐
│                    CLI / Terminal                        │
│  ┌─────────────┐  ┌──────────────┐  ┌────────────────┐  │
│  │ Rule Engine │  │ Permission   │  │ Interactive    │  │
│  │ (permissions│  │ Context      │  │ Handler (4-way │  │
│  │  .ts)       │  │ (Permission  │  │ race: user/    │  │
│  │             │  │  Context.ts) │  │ bridge/channel/│  │
│  │             │  │              │  │ hook/classifier)│  │
│  └─────────────┘  └──────────────┘  └────────────────┘  │
│                                                          │
│  ┌──────────────────────────────────────────────────┐    │
│  │ Permission Prompt UI (React/Ink components)      │    │
│  │ - PermissionScaffold / PermissionDialog           │    │
│  │ - Tool-specific permission requests               │    │
│  │ - PermissionRuleExplanation                       │    │
│  │ - AI permission explainer                         │    │
│  └──────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────┘
                            │
                            │ control_request (NDJSON)
                            ▼
┌─────────────────────────────────────────────────────────┐
│              VSCode Extension Host                      │
│  ┌─────────────────┐  ┌──────────────────────────────┐  │
│  │ PermissionHandler│  │ PermissionRules              │  │
│  │ (auto-approve    │  │ (session always-allow store) │  │
│  │  checks +        │  └──────────────────────────────┘  │
│  │  forward to      │                                     │
│  │  webview)        │                                     │
│  └─────────────────┘                                     │
│           │                                              │
│           ▼                                              │
│  ┌──────────────────────────────────────────────┐       │
│  │ Webview UI                                   │       │
│  │ - PermissionModeIndicator (badge)             │       │
│  │ - ModeSelector (dropdown)                    │       │
│  │ - PermissionDialog (allow/deny/always-allow)  │       │
│  └──────────────────────────────────────────────┘       │
└─────────────────────────────────────────────────────────┘
```

**Three layers of permission checking:**

1. **Local (rule engine)** — Synchronous check against configured rules
2. **Hook (pre-tool)** — Asynchronous hooks can override the decision
3. **Classifier (AI)** — For bash commands, async AI classifier can auto-approve

---

## 2. Permission Modes

### Mode Types

Defined in `src/types/permissions.ts` and `src/utils/permissions/PermissionMode.ts`.

| Mode | Enum Value | Symbol | Color | Behavior |
|------|-----------|--------|-------|----------|
| **Default** | `default` | (none) | `text` (blue) | Standard prompts for dangerous operations |
| **Accept Edits** | `acceptEdits` | `▶▶` | `autoAccept` (yellow) | Auto-accept file edits; other tools still prompt |
| **Plan** | `plan` | `⏸` | `planMode` (purple) | Read-only analysis; writes blocked |
| **Auto** | `auto` | `▶▶` | `warning` (amber) | AI classifier auto-decides (requires `TRANSCRIPT_CLASSIFIER` feature flag) |
| **Bypass Permissions** | `bypassPermissions` | `▶▶` | `error` (red) | Skips all confirm prompts; hard safety prompts preserved |
| **Full Access** | `fullAccess` | `▶▶` | `error` (red) | Skips everything including safety checks |
| **Don't Ask** | `dontAsk` | `▶▶` | `warning` (orange) | Converts `ask` → `deny` instead of prompting |

### Mode Configurations

```typescript
const PERMISSION_MODE_CONFIG: Partial<Record<PermissionMode, PermissionModeConfig>> = {
  default:      { title: 'Default',          shortTitle: 'Default', symbol: '',       color: 'text',       external: 'default' },
  plan:         { title: 'Plan Mode',        shortTitle: 'Plan',    symbol: PAUSE_ICON, color: 'planMode',   external: 'plan' },
  acceptEdits:  { title: 'Accept edits',     shortTitle: 'Accept',  symbol: '▶▶',      color: 'autoAccept', external: 'acceptEdits' },
  bypassPermissions: { title: 'Bypass Permissions', shortTitle: 'Bypass', symbol: '▶▶', color: 'error',  external: 'bypassPermissions' },
  fullAccess:   { title: 'Full Access',      shortTitle: 'Full',    symbol: '▶▶',      color: 'error',      external: 'fullAccess' },
  dontAsk:      { title: "Don't Ask",        shortTitle: 'DontAsk', symbol: '▶▶',      color: 'error',      external: 'dontAsk' },
  auto:         { title: 'Auto mode',        shortTitle: 'Auto',    symbol: '▶▶',      color: 'warning',    external: 'default' },
}
```

### Mode Selection

Users can switch modes via:

1. **CLI** — `/permissions` command then Mode tab
2. **Webview** — PermissionModeIndicator dropdown
3. **Settings** — `permissionMode` in `settings.json`
4. **CLI flag** — `--permission-mode <mode>`
5. **Plan mode** — AI can request EnterPlanMode / ExitPlanMode

### Manageable Modes

Not all modes are exposed to the mode-change UI:

```typescript
export type ManageablePermissionMode = Extract<
  PermissionMode,
  'default' | 'acceptEdits' | 'plan' | 'auto' | 'bypassPermissions' | 'fullAccess'
>
```

`dontAsk` is valid at the settings/config level but not shown in the mode-selector UI.

### Mode Descriptions (as shown in the UI)

| Mode | Description |
|------|-------------|
| `default` | Standard behavior; prompts for dangerous operations. |
| `acceptEdits` | Auto-accept file edit operations in the workspace. |
| `plan` | Analysis only; tool execution is blocked. |
| `auto` | Use classifier-driven approvals when available. |
| `bypassPermissions` | Skip normal permission prompts while preserving hard safety prompts. |
| `fullAccess` | Skip normal permission prompts and hard safety-check prompts. |

### VSCode Extension Modes

The VSCode extension side (permissionHandler.ts) supports a subset:
- `default` — Standard prompting
- `bypassPermissions` — Auto-allow all (gated by `allowDangerouslySkipPermissions` setting)
- `dontAsk` — Auto-allow all
- `acceptEdits` — Auto-allow file edits only

---

## 3. Permission Behaviors & Rules

### Three Behaviors

Every tool invocation resolves to one of three outcomes:

| Behavior | Meaning | Return Type | Typical Scenario |
|----------|---------|-------------|------------------|
| **allow** | Auto-approved, user not prompted | `PermissionAllowDecision` | `Read` tool reading known project files |
| **ask** | Permission prompt shown to user | `PermissionAskDecision` | `Bash` executing an unknown command |
| **deny** | Immediately rejected | `PermissionDenyDecision` | Tool on the deny list |

### Rule Sources (Priority Order: highest wins)

Rules are loaded from 8 sources, defined in `PERMISSION_RULE_SOURCES`:

```
 1. userSettings     — ~/.gakrcli/settings.json (global, cross-project)
 2. projectSettings  — .gakrcli/settings.json (team-shared, checked in)
 3. localSettings    — .gakrcli/settings.local.json (gitignored, personal)
 4. flagSettings     --settings CLI argument
 5. policySettings   — Enterprise-managed policy (admin-enforced, immutable)
 6. cliArg           --allow / --deny CLI arguments
 7. command          — Skill tool's allowedTools whitelist
 8. session          — User-granted "Always allow" in current session
```

Higher-numbered sources override lower-numbered ones.

### Rule Data Structure

```typescript
type PermissionRule = {
  source: PermissionRuleSource   // Which layer this comes from
  ruleBehavior: 'allow' | 'ask' | 'deny'
  ruleValue: {
    toolName: string             // e.g. "Bash", "mcp__server1__tool"
    ruleContent?: string         // e.g. "git *", "src/**" (command/pattern)
  }
}
```

### Managed Policy Rules

When `policySettings.allowManagedPermissionRulesOnly` is `true`, only rules from `policySettings` are respected. The "Always allow" option is hidden from permission dialogs, and users cannot add/edit/delete rules.

---

## 4. Rule Matching Engine

Located in `src/utils/permissions/permissions.ts`, the rule matching engine supports three dimensions of matching:

### 1. Tool Name Matching

```typescript
// Exact match: rule "Bash" → matches Bash tool
// MCP server match: rule "mcp__server1" → matches all tools from that server
// Wildcard match: rule "mcp__server1__*" → glob-style tool name matching
```

MCP tools use `getToolNameForPermissionCheck()` to determine their match name. Both prefixed (`mcp__server__tool`) and unprefixed patterns are supported.

### 2. Command Pattern Matching (Bash)

BashTool's `checkPermissions()` parses the command via `preparePermissionMatcher()`:

```json
{ "tool": "Bash", "ruleContent": "git *" }
→ matches "git commit -m 'fix'", "git push", etc.
```

Commands are parsed through AST (tree-sitter bash) in `readOnlyValidation.ts`, extracting the first subcommand for matching.

### 3. Path Matching (File Tools)

Read/Edit/Write tools implement `getPath()` to extract the file path, then match against `ruleContent` as a glob pattern:

```json
{ "tool": "Edit", "ruleContent": "src/**" }
→ matches "src/utils/foo.ts"
```

### Rule Value Format

Rules are stored as strings in the format:

- `"ToolName"` — Matches the entire tool
- `"ToolName(content)"` — Matches tool with specific content

Examples:
- `Bash` — All Bash commands
- `Bash(git *)` — Specific Bash command pattern
- `Edit(src/**)` — File path pattern
- `Write` — All Write tool invocations

---

## 5. Permission Check Pipeline

The full pipeline runs in `hasPermissionsToUseTool()` (permissions.ts). Steps execute in order; the first decisive result wins:

```
Step 1a: Blanket deny check
  → Tool name fully matches a deny rule? → DENY

Step 1b: Blanket allow check (server-wide)
  → toolAlwaysAllowedRule() matches? → ALLOW (no prompt)

Step 1c: Tool's own checkPermissions()
  Each tool implements custom logic:
  - BashTool: readOnlyValidation → sandbox → AST parse → pattern match
  - FileEditTool: path whitelist check
  - SkillTool: safe properties whitelist + exact/prefix matching
  → Returns PermissionResult

Step 1d: Tool denied permission
  → Tool's checkPermissions returned deny? → DENY (with message)

Step 1e: Tool requires user interaction
  → Tools like AskUserQuestion? → ASK (user must respond)

Step 1f: fullAccess mode bypass
  → Mode is fullAccess? → ALLOW completely

Step 1g: Content-specific ask rules
  → Input matches an ask rule? → ASK

Step 1h: Safety checks
  → blockedPath? → ASK with blocked path warning

Step 2: Mode-based bypass
  bypassPermissions mode? → ALLOW
  fullAccess mode? → ALLOW
  plan mode + bypass available? → DENY (plan is read-only)

Step 3: Always-allowed rule check
  → Tool name matches allow rule? → ALLOW

Step 4: Passthrough → ask conversion
  → Tool returned passthrough? → ASK (convert to user prompt)

Step 5: Mode-specific handling
  dontAsk mode? → DENY (convert ask to deny)
  auto mode (feature flagged)? → ASK with classifier pending
  shouldAvoidPermissionPrompts (headless)? → run hooks or deny
  otherwise → ASK (show permission dialog)
```

### Rule Analysis Logic

The permission check primarily works with three rule lists:

- **alwaysAllowRules** — Tools/patterns that auto-approve
- **alwaysAskRules** — Tools/patterns that always prompt
- **alwaysDenyRules** — Tools/patterns that always reject

For each rule list, `getAllowRules()`, `getAskRules()`, and `getDenyRules()` aggregate rules from all 8 sources.

Shadowed rule detection (`shadowedRuleDetection.ts`) identifies rules that are overridden by a higher-priority contradictory rule from a different source.

---

## 6. Permission Prompt UI (Terminal/CLI)

The terminal permission dialog is rendered using the Ink React framework.

### Core Components

#### PermissionScaffold (`PermissionScaffold.tsx`)

Wraps the permission dialog with consistent layout:
- Title and subtitle
- Worker badge (for sub-agents)
- Header section
- Rule explanation (when applicable)
- Child content (the actual prompt)

#### PermissionDialog (`PermissionDialog.tsx`)

Base dialog container with theming:
- Color-coded border (based on tool/risk type)
- Title right section (for extra controls)
- Inner padding

#### PermissionPrompt (`PermissionPrompt.tsx`)

The interactive permission choice component:
- Renders a title, header, question ("Do you want to proceed?")
- Shows a Select with options (allow/deny/always-allow variants)
- Supports feedback input mode (Tab to amend)
- Keybinding support for quick selection
- Dangerous mode confirmation integration
- Escape to cancel

Key props:
```typescript
type PermissionPromptProps<T extends string> = {
  toolUseConfirm: ToolUseConfirm
  title: string
  header: React.ReactNode
  question?: string | ReactNode
  options: PermissionPromptOption<T>[]
  onSelect: (value: T, feedback?: string) => void
  onCancel?: () => void
  toolType?: 'tool' | 'command' | 'edit' | 'read'
}
```

#### Tool-Specific Permission Requests

Each tool has a dedicated permission request component registered via `permissionComponentForTool()`:

| Tool | Component |
|------|-----------|
| Bash | `BashPermissionRequest` |
| FileEdit | `FileEditPermissionRequest` |
| FileWrite | `FileWritePermissionRequest` |
| Write | `FilesystemPermissionRequest` |
| PowerShell | `PowerShellPermissionRequest` |
| WebFetch | `WebFetchPermissionRequest` |
| Skill | `SkillPermissionRequest` |
| Read | `FilesystemPermissionRequest` |
| AskUserQuestion | `AskUserQuestionPermissionRequest` |
| EnterPlanMode | `EnterPlanModePermissionRequest` |
| ExitPlanMode | `ExitPlanModePermissionRequest` |
| NotebookEdit | `NotebookEditPermissionRequest` |
| ReviewArtifact | `ReviewArtifactPermissionRequest` (feature-gated) |
| Workflow | `WorkflowPermissionRequest` (feature-gated) |
| Monitor | `MonitorPermissionRequest` (feature-gated) |
| (fallback) | `FallbackPermissionRequest` |

Permission options per tool include:
- **Allow once** — Approve this single invocation
- **Allow with feedback** — Approve and provide instructions
- **Always allow** — Add to session allow rules
- **Always allow for this project/tool** — Persist to settings
- **Deny** — Reject this invocation
- **Deny with feedback** — Reject and provide guidance

#### PermissionRuleExplanation

Shown inside the permission scaffold to explain why a permission check was triggered:
- Which rule matched (if any)
- Which source defined the rule
- Whether it's a blocked path warning

#### WorkerBadge

Shows when the tool is being executed by a sub-agent (coordinated or delegated agent), indicating which agent is requesting the action.

### Feedback Input Mode

Users can press Tab to enter "amend" mode, providing text feedback along with their approval/rejection:
- **Accept feedback**: "tell GakrCLI what to do next"
- **Reject feedback**: "tell GakrCLI what to do differently"

This feedback is passed back to the AI as a message, helping guide its next action.

---

## 7. Interactive Permission Handler

Located in `src/hooks/toolPermission/handlers/interactiveHandler.ts`, this handles the main-agent permission flow.

### 4-Way Race Resolution

The interactive handler sets up a race between up to 4 approval sources. The first to respond wins; all others are discarded:

```
┌─────────────────────────────────────────────┐
│             Interactive Handler              │
│                                              │
│  ┌──────────────────────────────────────┐   │
│  │  Resolution Race (claim() wins)      │   │
│  │                                      │   │
│  │  1. Local User Dialog ───────────────┤   │
│  │     (onAllow / onReject / onAbort)   │   │
│  │                                      │   │
│  │  2. Bridge (CCR/Remote Control) ─────┤   │
│  │     (bridgeCallbacks.onResponse)     │   │
│  │                                      │   │
│  │  3. Channel (Telegram/iMessage) ─────┤   │
│  │     (channelCallbacks.onResponse)    │   │
│  │                                      │   │
│  │  4. Permission Request Hooks ────────┤   │
│  │     (ctx.runHooks)                   │   │
│  │                                      │   │
│  │  5. Bash Classifier (async) ─────────┤   │
│  │     (executeAsyncClassifierCheck)    │   │
│  └──────────────────────────────────────┘   │
└─────────────────────────────────────────────┘
```

### Key Implementation Details

- **Resolve-once guard** (`createResolveOnce`): Atomic `claim()` marks the race as won. Prevents double-resolution when multiple sources respond simultaneously.
- **Watchdog suspension**: The idle/hard-max timeout watchdog is suspended while the dialog is shown, so user think-time isn't counted against the timeout. Resumed on claim.
- **Classifier indicator**: When a bash classifier check is pending, a "classifier running" indicator is shown in the dialog header.
- **User interaction grace period**: A 200ms grace period after dialog opens prevents accidental keypresses from canceling the classifier prematurely.
- **Checkmark transition**: On classifier auto-approval, a checkmark overlay is shown (3s if terminal focused, 1s if not). User can dismiss with Esc.
- **Bridge integration**: When connected to gakrcli.ai (CCR), permission requests are forwarded there. The remote response races against local interaction.
- **Channel relay**: MCP channels (Telegram, iMessage) receive permission notifications. Users can approve/deny from their phone. Replies are intercepted before enqueue as conversation turns.

### Permission Context

The `PermissionContext` object (`PermissionContext.ts`) provides:

| Method | Purpose |
|--------|---------|
| `pushToQueue(item)` | Add a ToolUseConfirm to the queue
| `removeFromQueue()` | Remove the current item
| `updateQueueItem(patch)` | Update the current item (e.g., classifier status)
| `runHooks(permissionMode, suggestions, input)` | Execute permission request hooks
| `handleUserAllow(input, updates, feedback)` | Process user approval
| `handleHookAllow(input, updates)` | Process hook-based approval
| `persistPermissions(updates)` | Persist permission updates to settings
| `buildAllow(input, opts)` | Build an allow decision
| `buildDeny(message, reason)` | Build a deny decision
| `cancelAndAbort(feedback, isAbort)` | Cancel and optionally abort
| `logDecision(args, opts)` | Log the decision for analytics
| `tryClassifier(pendingCheck, input)` | Attempt classifier approval

### Queue System

The `ToolUseConfirm` queue (backed by React state) tracks all pending permission dialogs. Each item contains:

```typescript
type ToolUseConfirm = {
  assistantMessage: AssistantMessage
  tool: Tool
  description: string
  input: Record<string, unknown>
  toolUseContext: ToolUseContext
  toolUseID: string
  permissionResult: PermissionAskDecision
  permissionPromptStartTimeMs: number
  classifierCheckInProgress?: boolean  // Bash classifier feature
  classifierAutoApproved?: boolean     // Auto-approve transition
  classifierMatchedRule?: string       // Which rule matched
  onUserInteraction: () => void
  onDismissCheckmark: () => void
  onAbort: () => void
  onAllow: (input, updates, feedback, contentBlocks) => Promise<void>
  onReject: (feedback, contentBlocks) => void
  recheckPermission: () => Promise<void>
}
```

---

## 8. Coordinator Permission Handler

Located in `src/hooks/toolPermission/handlers/coordinatorHandler.ts`, for coordinator (non-root) agent workers.

Unlike the interactive handler's race model, the coordinator handler runs automated checks **sequentially** and only falls through to the dialog if both fail:

```
Step 1: Permission Hooks (ctx.runHooks)
  → Returns decision? → use it
  
Step 2: Bash Classifier (ctx.tryClassifier)
  → Returns decision? → use it

Step 3: Fall through to interactive dialog
  → Return null → caller shows dialog
```

Errors in automated checks are logged but don't propagate — the dialog is always the fallback.

---

## 9. VSCode Extension Permission System

### PermissionHandler (Extension Host)

Located in `vscode-extension/gakrcli-vscode/src/permissions/permissionHandler.ts`.

The handler:
1. Receives `control_request` (subtype `can_use_tool`) from the CLI via NDJSON
2. Checks auto-approve conditions locally
3. Forwards non-auto-approved requests to the webview
4. Handles webview responses and sends `control_response` back to CLI

```
CLI ──control_request──→ PermissionHandler
                              │
                    ┌─────────▼──────────┐
                    │ checkAutoApprove() │
                    └─────┬──────┬───────┘
                     yes  │      │  no
                          ▼      ▼
                    send auto-   forward to
                    response    webview UI
                                    │
                          ┌─────────▼──────────┐
                          │  user responds     │
                          │ (allow/deny/always)│
                          └─────────┬──────────┘
                                    ▼
                          send control_response
```

### Auto-Approve Logic (checkAutoApprove)

```typescript
private checkAutoApprove(request): PermissionResult | null {
  // bypassPermissions mode → auto-allow everything
  // dontAsk mode → auto-allow everything
  // acceptEdits mode → auto-allow file edit tools only
  // Session "always allow" rules → auto-allow
  // Otherwise → null (needs prompting)
}
```

### PermissionRules (Session Store)

`vscode-extension/gakrcli-vscode/src/permissions/permissionRules.ts`

A `Set<string>` backed by VSCode `workspaceState` for "always allow" rules in the current session:
- `add(toolName)` — Add rule and persist
- `remove(toolName)` — Remove rule
- `has(toolName)` — Check for rule
- Persisted under key `gakrcli.permissionRules.alwaysAllow`

### Webview Permission Flow

**Permission Request from CLI** (`permissionRequests.ts`):
- `getPermissionRequestFromCliOutput()` — Parses CLI `control_request` NDJSON
- File edit tools are excluded (handled by DiffManager)
- AskUserQuestion is routed to the clarification dialog

**Webview UI Components**:
- `PermissionModeIndicator.tsx` — Badge showing current mode, clickable to open mode selector
- `ModeSelector.tsx` — Dropdown with 5 mode options, each with label+description+color
- Colors map to VSCode theme variables (`vscode-charts-*`)

| Mode | Color |
|------|-------|
| Default | Blue (`#4fc3f7`) |
| Plan | Purple (`#ce93d8`) |
| Accept Edits | Yellow (`#fff176`) |
| Bypass | Red (`#ef9a9a`) |
| Don't Ask | Orange (`#ffcc80`) |

**Permission Mode tab appears in status bar / input area** with:
- Shield icon
- "Permission: Default" label
- Chevron for dropdown
- Glass-style menu on click

---

## 10. Permission Explainer (AI-Powered)

Located in `src/utils/permissions/permissionExplainer.ts`.

When a permission dialog is shown, an AI (Haiku) is asked to explain the command in the background. The explanation enriches the dialog with:

```typescript
type PermissionExplanation = {
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH'    // Risk classification
  explanation: string                       // What the command does
  reasoning: string                         // Why the AI is running it
  risk: string                              // What could go wrong (< 15 words)
}
```

### Flow

```
1. Permission dialog displayed for a tool
2. generatePermissionExplanation() called with tool name, input, message context
3. Calls sideQuery() with a structured output tool (explain_command)
4. Returns null if:
   - Feature disabled (permissionExplainerEnabled config)
   - Request aborted
   - API error
5. On success: explanation displayed in the permission dialog header
```

### System Prompt

```
Analyze shell commands and explain what they do, why you're running them,
and potential risks.
```

### Risk Classification

| Risk | Numeric | Examples |
|------|---------|---------|
| LOW | 1 | Safe dev workflows, reads, builds |
| MEDIUM | 2 | Recoverable changes, edits, installs |
| HIGH | 3 | Dangerous/irreversible, deletes, FORMAT, RM |

Feature is enabled by default; users can opt out via `"permissionExplainerEnabled": false` in settings.

---

## 11. Denial Tracking

Located in `src/utils/permissions/denialTracking.ts`, prevents AI from repeatedly requesting the same denied operation.

```typescript
const DENIAL_LIMITS = {
  maxConsecutive: 3,   // Same tool type, consecutive denials
  maxTotal: 20,        // Total denials across session
}
```

### Behavior

1. `recordDenial(toolUseID)` — Records a denial, increments counter for that tool type
2. `shouldFallbackToPrompting()` — Returns true if consecutive denials >= 3 or total >= 20
3. When limit hit: System injects a message:
   ```
   Your previous tool call `<tool>` was rejected.
   ```
4. AI must change strategy — avoids infinite loop of requesting the same blocked operation
5. `recordSuccess()` — Resets consecutive count on success
6. `resetDenialTracking()` — Clears all denial state

### Headless Mode

In headless/non-interactive mode, denial tracking throws an `AbortError` instead of falling back to prompting.

---

## 12. Dangerous Mode Confirmation

Located in `src/components/permissions/useDangerousModeConfirmation.tsx`

When entering dangerous modes (`bypassPermissions` or `fullAccess`), a confirmation dialog is shown:

### BypassPermissionsModeDialog

```typescript
title: "WARNING: GakrCLI running in Bypass Permissions mode"
content:
  "In [mode] mode, GakrCLI will not ask for your approval
   before running potentially dangerous commands.
   This mode should only be used in a sandboxed container/VM that has
   restricted internet access and can easily be restored if damaged.
   By proceeding, you accept all responsibility for actions taken while
   running in [mode] mode."
options:
  - "No, exit" (default, cancels)
  - "Yes, I accept" (red, confirms)
```

### Persistence

Once accepted, `persistDangerousModeAcceptance()` stores the acceptance state so the prompt is not redisplayed for the same mode within the session.

### Startup Check

`getStartupDangerousPermissionPromptState()` checks at startup whether a dangerous mode was set via config/CLI. If so, the dialog is shown before the session begins.

---

## 13. Permission Rule Parser

Located in `src/utils/permissions/permissionRuleParser.ts`

### Rule String Format

```
ToolName           → Matches all invocations of this tool
ToolName(content)  → Matches tool with specific content
```

### Examples

| String | Parsed Value |
|--------|-------------|
| `Bash` | `{ toolName: "Bash" }` |
| `Bash(git *)` | `{ toolName: "Bash", ruleContent: "git *" }` |
| `Bash(python -c "print\\(1\\)")` | `{ toolName: "Bash", ruleContent: 'python -c "print(1)"' }` |
| `Edit(src/**)` | `{ toolName: "Edit", ruleContent: "src/**" }` |

### Legacy Name Aliases

Old tool names are mapped to current canonical names:

| Legacy | Current |
|--------|---------|
| `Task` | `AgentTool` |
| `KillShell` | `TaskStop` |
| `AgentOutputTool` | `TaskOutput` |
| `BashOutputTool` | `TaskOutput` |
| `Brief` | (feature-gated) |

### Escaped Content

- `\(` and `\)` in content → unescaped to `(` and `)`
- `\\` → `\`
- Escaping order: backslash first, then parentheses
- Unescaping order: parentheses first, then backslash

---

## 14. Runtime Permission Updates

Permissions can be updated dynamically during a session via `PermissionUpdate` operations.

### Update Types

```typescript
type PermissionUpdate =
  | { type: 'addRules',       destination, rules: PermissionRule[], behavior }
  | { type: 'replaceRules',   destination, rules: PermissionRule[], behavior }
  | { type: 'removeRules',    destination, rules: PermissionRule[], behavior }
  | { type: 'setMode',        destination, mode: PermissionMode }
  | { type: 'addDirectories', destination, directories: string[] }
  | { type: 'removeDirectories', destination, directories: string[] }
```

### Destinations

```typescript
type PermissionUpdateDestination = 'session' | 'localSettings'
```

- `session` — Ephemeral, for this session only
- `localSettings` — Persisted to `.gakrcli/settings.local.json`

### Flow

1. User selects "Always allow" in permission dialog
2. `applyPermissionUpdate()` applies changes to the in-memory context
3. `persistPermissionUpdate()` writes to the settings file (if destination is `localSettings`)
4. `applyPermissionModeChange()` transitions the mode on `ToolPermissionContext`

### Mode Change Flow

```typescript
async function requestPermissionModeChange({ mode, toolPermissionContext, onApply, ... }):
  1. getPermissionModeChangeRequestDecision() → validates mode change
     - blocked: mode not available (e.g., bypass without setting)
     - confirm: needs dangerous mode dialog
     - approved: safe to apply
  2. If confirm: show dangerous mode dialog, then retry with skipDangerousModePrompt=true
  3. If approved: call onApply()
```

---

## 15. Permission Logging & Analytics

Located in `src/hooks/toolPermission/permissionLogging.ts`

### Events

Every permission decision generates analytics events:

**Approval Events:**
| Event | When |
|-------|------|
| `tengu_tool_use_granted_in_config` | Auto-approved by allowlist in settings |
| `tengu_tool_use_granted_by_classifier` | Auto-approved by AI classifier |
| `tengu_tool_use_granted_in_prompt_permanent` | User approved with "always allow" |
| `tengu_tool_use_granted_in_prompt_temporary` | User approved once |
| `tengu_tool_use_granted_by_permission_hook` | Permission hook approved |

**Rejection Events:**
| Event | When |
|-------|------|
| `tengu_tool_use_denied_in_config` | Denied by denylist in settings |
| `tengu_tool_use_rejected_in_prompt` | User/hook rejected |

**Other Permission Events:**
| Event | When |
|-------|------|
| `tengu_tool_use_cancelled` | Tool use cancelled (Escape) |
| `tengu_permission_request_escape` | Escape pressed on permission dialog |
| `tengu_accept_submitted` | Accept with feedback submitted |
| `tengu_reject_submitted` | Reject with feedback submitted |
| `tengu_accept_feedback_mode_entered` | User entered accept feedback mode |
| `tengu_reject_feedback_mode_entered` | User entered reject feedback mode |
| `tengu_accept_feedback_mode_collapsed` | User collapsed accept feedback mode |
| `tengu_reject_feedback_mode_collapsed` | User collapsed reject feedback mode |
| `tengu_bypass_permissions_mode_dialog_shown` | Bypass mode warning shown |
| `tengu_bypass_permissions_mode_dialog_accept` | Bypass mode accepted |
| `tengu_permission_explainer_generated` | AI explanation generated |
| `tengu_permission_explainer_error` | AI explanation failed |

### Decision Persistence

Decisions are stored on the `ToolUseContext.toolDecisions` map:

```typescript
toolUseContext.toolDecisions.set(toolUseID, {
  source: 'user_temporary' | 'user_permanent' | 'hook' | 'classifier' | ...,
  decision: 'accept' | 'reject',
  timestamp: Date.now(),
})
```

---

## 16. Permissions Command

Activated via the `/permissions` slash command.

### Component: PermissionRuleList

Located in `src/commands/permissions/permissions.tsx` and `src/components/permissions/rules/PermissionRuleList.tsx`.

### Tabs

| Tab | Component | Description |
|-----|-----------|-------------|
| **Mode** | `PermissionModeTab` | Switch permission mode, shows dangerous mode warnings |
| **Recently Denied** | `RecentDenialsTab` | View/manage recently denied operations, approve or retry |
| **Allow** | `PermissionRulesTab` | View/search/delete allowed tool rules |
| **Ask** | `PermissionRulesTab` | View/search/delete always-ask rules |
| **Deny** | `PermissionRulesTab` | View/search/delete always-deny rules |
| **Workspace** | `WorkspaceTab` | Manage workspace directories and trusted paths |

### Mode Tab (`PermissionModeTab.tsx`)

- Lists available permission modes with descriptions
- Shows current mode with "(current)" badge
- Color-coded options
- Status messages for blocked mode changes
- "Dangerous modes may require a one-time confirmation" hint

### Rules Tabs

- **Search**: Type to filter rules by name/pattern
- **Add**: "Add a new rule…" option opens rule input dialog
- **View**: Select a rule to see full details (source, behavior, pattern)
- **Delete**: Confirmation dialog before removal
- **Policy rules**: Managed/policy rules show as read-only with "Contact your system administrator" message

### Navigation

```
Tab headers: ←/→ to switch
Content: ↑/↓ to navigate, Enter to select
Search: Type any key to start searching, Esc to clear
Exit: Ctrl+C twice, or Esc on empty/cancel
```

---

## 17. Key Source Files

### Core Types & Constants

| File | Purpose |
|------|---------|
| `src/types/permissions.ts` | PermissionMode, PermissionBehavior, PermissionRule types |
| `src/utils/permissions/PermissionMode.ts` | Mode titles, colors, symbols, schemas, utilities |
| `src/utils/permissions/PermissionRule.ts` | PermissionRule type, sources |
| `src/utils/permissions/PermissionResult.ts` | PermissionDecision result types |
| `src/utils/permissions/PermissionUpdateSchema.ts` | PermissionUpdate type definitions |
| `src/modes/types.ts` | GakrCLIMode with permission defaults |

### Rules & Matching

| File | Purpose |
|------|---------|
| `src/utils/permissions/permissions.ts` | Main rule engine: hasPermissionsToUseTool, checkRuleBasedPermissions, rule aggregation |
| `src/utils/permissions/permissionsLoader.ts` | Rule loading from settings files |
| `src/utils/permissions/permissionRuleParser.ts` | Rule string parsing, escaped content, legacy aliases |
| `src/utils/permissions/shadowedRuleDetection.ts` | Detects conflicting rules across sources |
| `src/utils/permissions/PermissionUpdate.ts` | Apply/persist permission updates |

### Permission Handlers

| File | Purpose |
|------|---------|
| `src/hooks/toolPermission/PermissionContext.ts` | Permission context creation, queue ops, handler factory |
| `src/hooks/toolPermission/handlers/interactiveHandler.ts` | Main-agent 4-way race permission flow |
| `src/hooks/toolPermission/handlers/coordinatorHandler.ts` | Coordinator worker sequential permission flow |

### CLI Permission UI

| File | Purpose |
|------|---------|
| `src/components/permissions/PermissionPrompt.tsx` | Generic permission prompt component |
| `src/components/permissions/PermissionRequest.tsx` | Tool-specific request dispatcher |
| `src/components/permissions/PermissionScaffold.tsx` | Permission dialog layout scaffold |
| `src/components/permissions/PermissionDialog.tsx` | Base dialog component |
| `src/components/permissions/PermissionRuleExplanation.tsx` | Rule match explanation display |
| `src/components/permissions/BashPermissionRequest/` | Bash-specific permission UI |
| `src/components/permissions/FileEditPermissionRequest/` | File edit permission UI |
| `src/components/permissions/FileWritePermissionRequest/` | File write permission UI |
| `src/components/permissions/FilesystemPermissionRequest/` | Read/glob permission UI |
| `src/components/permissions/usePermissionModeChangeRequest.tsx` | Hook for mode change with dangerous mode confirmation |
| `src/components/permissions/useDangerousModeConfirmation.tsx` | Hook for dangerous mode dialog flow |
| `src/components/BypassPermissionsModeDialog.tsx` | Bypass/full access mode warning dialog |

### Permission Rules Management UI

| File | Purpose |
|------|---------|
| `src/commands/permissions/permissions.tsx` | /permissions command entry |
| `src/components/permissions/rules/PermissionRuleList.tsx` | Main permissions management UI |
| `src/components/permissions/rules/PermissionModeTab.tsx` | Mode switching tab |
| `src/components/permissions/rules/PermissionRuleInput.tsx` | Rule creation input |
| `src/components/permissions/rules/AddPermissionRules.tsx` | Add rules flow |
| `src/components/permissions/rules/RecentDenialsTab.tsx` | Recently denied operations |
| `src/components/permissions/rules/permissionModeOptions.tsx` | Mode descriptions and option generation |

### Permission Explainer

| File | Purpose |
|------|---------|
| `src/utils/permissions/permissionExplainer.ts` | AI-powered command explanation generation |

### Denial Tracking

| File | Purpose |
|------|---------|
| `src/utils/permissions/denialTracking.ts` | Consecutive denial tracking, dead-loop prevention |

### Permission Logging

| File | Purpose |
|------|---------|
| `src/hooks/toolPermission/permissionLogging.ts` | Centralized analytics/OTel logging |

### VSCode Extension

| File | Purpose |
|------|---------|
| `vscode-extension/gakrcli-vscode/src/permissions/permissionHandler.ts` | Extension host permission coordinator |
| `vscode-extension/gakrcli-vscode/src/permissions/permissionRules.ts` | Session always-allow rules store |
| `vscode-extension/gakrcli-vscode/webview/src/components/input/PermissionModeIndicator.tsx` | Mode indicator badge |
| `vscode-extension/gakrcli-vscode/webview/src/components/input/ModeSelector.tsx` | Mode dropdown selector |
| `vscode-extension/gakrcli-vscode/webview/src/utils/permissionRequests.ts` | Permission request parsing utilities |

### Settings & Validation

| File | Purpose |
|------|---------|
| `src/utils/settings/permissionValidation.ts` | Permission setting validation |
| `src/utils/permissions/permissionModeChange.ts` | Mode change request orchestration |
| `src/utils/permissions/permissionSetup.ts` | Mode change decision, live context updates |
| `src/utils/permissions/dangerousModePrompt.ts` | Dangerous mode startup prompt state |

### Tool Hooks

| File | Purpose |
|------|---------|
| `src/services/tools/toolHooks.ts` | Pre/post tool permission hooks execution |
| `src/tools/BashTool/bashPermissions.ts` | Bash-specific classifier checks |

---

---

## 18. CLI Arguments

### Permission-Related Flags

| Flag | Type | Description |
|------|------|-------------|
| `--permission-mode <mode>` | String | Permission mode for the session. One of: `default`, `acceptEdits`, `plan`, `auto`, `bypassPermissions`, `fullAccess`, `dontAsk` |
| `--dangerously-skip-permissions` | Boolean | Bypass all permission checks. Recommended only for sandboxes with no internet access |
| `--allow-dangerously-skip-permissions` | Boolean | Enable bypassing all permission checks as an *option* (without it being enabled by default). Recommended only for sandboxes with no internet access |
| `--allowedTools, --allowed-tools <tools...>` | String[] | Comma or space-separated list of tool names to allow (e.g. `"Bash(git:*) Edit"`) |
| `--disallowedTools, --disallowed-tools <tools...>` | String[] | Comma or space-separated list of tool names to deny (e.g. `"Bash(git:*) Edit"`) |
| `--tools <tools...>` | String[] | Specify the list of available tools from the built-in set. Use `""` to disable all tools, `"default"` to use all tools, or specify tool names (e.g. `"Bash,Edit,Read"`) |
| `--permission-prompt-tool <tool>` | String | MCP tool to use for permission prompts (only works with `--print`) |
| `--settings <file-or-json>` | String | Path to a settings JSON file or a JSON string to load additional settings from |
| `--add-dir <directories...>` | String[] | Additional directories to allow tool access to |

### SSH-Specific Flags

When using `gakrcli ssh`, the following flags are forwarded to the remote CLI:

| Flag | Description |
|------|-------------|
| `--permission-mode <mode>` | Permission mode on the remote host |
| `--dangerously-skip-permissions` | Bypass permissions on the remote host |
| `--allowed-tools <tools...>` | Allow list on the remote host |
| `--disallowed-tools <tools...>` | Deny list on the remote host |

### Session Control Flags

| Flag | Description |
|------|-------------|
| `-c, --continue` | Continue the most recent conversation in the current directory |
| `-r, --resume [value]` | Resume a conversation by session ID, or open interactive picker |
| `--fork-session` | When resuming, create a new session ID instead of reusing the original (use with `--resume` or `--continue`) |
| `--max-budget-usd <amount>` | Maximum dollar amount to spend on API calls (only works with `--print`) |
| `--max-turns <turns>` | Maximum number of agentic turns in non-interactive mode (only works with `--print`) |
| `--session-id <uuid>` | Use a specific session ID for the conversation (must be a valid UUID) |

### Permission Mode Preferences (Settings)

In `settings.json`, the following keys control permission behavior:

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `permissionMode` | string | `"default"` | Default permission mode for new sessions |
| `allowDangerouslySkipPermissions` | boolean | `false` | Allow bypass/full-access mode as an option |
| `autoCompactEnabled` | boolean | `true` | Enable automatic conversation compaction |
| `permissionExplainerEnabled` | boolean | `true` | Enable AI-powered permission explanations |
| `allowedTools` | string[] | `[]` | Global always-allow rules |
| `disallowedTools` | string[] | `[]` | Global always-deny rules |
| `addDir` | string[] | `[]` | Additional trusted directories |

---

## 19. Keybindings

### Permission Dialog Keybindings (Confirmation Context)

Triggered when a permission dialog is shown.

| Key | Action | Description |
|-----|--------|-------------|
| `y` / `enter` | `confirm:yes` | Approve the current permission request |
| `n` / `escape` | `confirm:no` | Deny the current permission request |
| `up` / `down` | `confirm:previous` / `confirm:next` | Navigate permission options |
| `tab` | `confirm:nextField` | Cycle through fields (e.g., feedback input) |
| `shift+tab` | `confirm:cycleMode` | Cycle permission mode in applicable dialogs |
| `space` | `confirm:toggle` | Toggle checkbox/option |
| `ctrl+e` | `confirm:toggleExplanation` | Toggle AI-powered permission explanation view |
| `ctrl+d` | `permission:toggleDebug` | Toggle permission debug info overlay |

### Mode Cycle Keybinding

| Key | Action | Context | Description |
|-----|--------|---------|-------------|
| `shift+tab` | `chat:cycleMode` | Chat | Cycle through available permission modes |
| `meta+m` | `chat:cycleMode` | Chat | Fallback on Windows without VT mode support |

### Command Bindings (via keybinding schema)

Users can bind keyboard shortcuts to slash commands including permission-related ones via the `command:` prefix:

| Keybinding Value | Command | Description |
|------------------|---------|-------------|
| `command:permissions` | `/permissions` | Open permission rules manager |
| `command:compact` | `/compact` | Trigger manual context compaction |
| `command:ctx` | `/ctx` | Show context window visualization |
| `command:set-context-window` | `/set-context-window` | Set context window override |

Example keybindings.json entry:
```json
{
  "context": "Global",
  "bindings": {
    "ctrl+p ctrl+p": "command:permissions"
  }
}
```

### Mode Cycle Behavior

When `chat:cycleMode` is triggered:
1. Current mode is displayed in the mode indicator
2. Next available mode from the cycle is applied
3. A notification shows the new mode name
4. If entering a dangerous mode (`bypassPermissions` / `fullAccess`), the dangerous mode confirmation dialog is shown first
5. If the mode change is blocked (e.g., `bypassPermissions` not enabled `allowDangerouslySkipPermissions`), a status message explains why

*This document covers the permission system as of GakrCLI v0.5.6. Source files referenced are relative to the repository root.*
