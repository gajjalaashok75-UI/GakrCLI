# Permission System

GakrCLI's permission system controls what tools the AI can execute and when the user is prompted. It mirrors the [GakrCLI CLI permission system](https://github.com/gajjalaashok75-UI/gakrcli) exactly.

## Permission Modes

The extension has 5 modes, matching the CLI:

| Mode | Description |
|---|---|
| **Default** | Standard behavior; prompts for dangerous operations |
| **Accept Edits** | Auto-accepts file edit operations in the workspace |
| **Plan** | Analysis only; tool execution is blocked |
| **Bypass** | Skips normal permission prompts while preserving hard safety prompts |
| **Full Access** | Skips normal permission prompts and hard safety-check prompts |

### Mode Details

**Default**: Every tool invocation that isn't in the auto-approve list triggers the permission dialog. The user can allow once, allow for the session, or deny.

**Accept Edits**: File edit tools (Write, Edit, MultiEdit, FileEditTool, FileWriteTool, NotebookEditTool) are auto-approved. All other tools still prompt.

**Plan**: All tool execution is blocked. The AI can read and analyze but cannot write files or run commands. Used for code review and planning.

**Bypass**: Normal permission prompts are skipped (tools auto-approve) but hard safety checks (dangerous commands, sensitive operations) still prompt. Requires `gakrcli.allowDangerouslySkipPermissions` to be enabled.

**Full Access**: All permission prompts are skipped — including hard safety checks. This is the most permissive mode.

## Permission Dialog

When a tool requires approval, the dialog shows:

1. **Tool type** and its input (file path + content for Write, command for Bash, etc.)
2. **Risk level** indicator badge
3. **Five options**:

| Option | Action | Key |
|---|---|---|
| Yes | Allow this one time | Enter |
| Yes, allow all during this session | Always allow for session | S |
| Yes, and enable Full Access for this session | Allow + switch to Full Access | F |
| No, provide reason | Deny with custom reason text | R |
| No | Deny | D |

## Session Rules

"Always Allow for Session" creates an in-memory rule that persists for the current VS Code session only. **These rules are NOT persisted across restarts** — each extension restart starts fresh. This ensures the `default` mode truly means "ask before each tool use" across sessions.

## Permission Flow

```
AI requests tool use
  │
  ▼
CLI: hasPermissionsToUseTool()
  │
  ▼
CLI sends can_use_tool control request via WebSocket
  │
  ▼
Extension Host:
  ┌─ PermissionHandler.checkAutoApprove()
  │   ├─ bypassPermissions? → auto-approve
  │   ├─ fullAccess? → auto-approve (permanent decision)
  │   ├─ acceptEdits + file tool? → auto-approve
  │   ├─ session rule exists? → auto-approve
  │   └─ null → show dialog
  │
  ▼
PermissionDialog shown in webview
  │
  ▼
User responds → handlePermissionResponse()
  ├─ allowed + alwaysAllow → add session rule
  ├─ allowed → send allow to CLI
  ├─ denied + reason → send deny with reason
  └─ fullAccess → allow + set mode to fullAccess
```

## Tool Categories

### File Edit Tools (auto-approved in Accept Edits mode)
- Write
- Edit
- MultiEdit
- FileEditTool
- FileWriteTool
- NotebookEditTool

### All Other Tools (prompt in Default mode)
- Read
- Bash
- WebFetch
- WebSearch
- Grep
- Glob
- And any MCP tools

## CLI Settings

The CLI also maintains its own always-allow rules in `~/.gakrcli/settings.local.json` via `permissions.allow` patterns (e.g., `"Bash(bun run:*)"`). These are permanent CLI-level rules, separate from the extension's in-memory session rules.

## Security Notes

- **Full Access** mode skips hard safety checks — use with caution
- **Bypass** mode preserves hard safety checks — recommended over Full Access for regular use
- Session rules reset on VS Code restart — no stale approvals carry over
- Denial reasons are sent back to the AI so it can adjust its approach
