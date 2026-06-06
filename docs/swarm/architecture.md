# Agent Swarm Architecture

This page describes the source-level behavior behind teammate swarms.

## Source Map

| Area | Important files |
| --- | --- |
| Runtime gate | `src/utils/agentSwarmsEnabled.ts` |
| Agent spawn tool | `src/tools/AgentTool/AgentTool.tsx` |
| Shared spawn implementation | `src/tools/shared/spawnMultiAgent.ts` |
| Swarm utilities | `src/utils/swarm/` |
| Backends | `src/utils/swarm/backends/` |
| In-process execution | `src/utils/swarm/spawnInProcess.ts`, `src/utils/swarm/inProcessRunner.ts` |
| Teammate identity | `src/utils/teammate.ts`, `src/utils/teammateContext.ts` |
| Team files | `src/utils/swarm/teamHelpers.ts` |
| Mailbox protocol | `src/utils/teammateMailbox.ts` |
| Team tools | `src/tools/TeamCreateTool/`, `src/tools/TeamDeleteTool/` |
| Messaging | `src/tools/SendMessageTool/` |

## Runtime Gate

`isAgentSwarmsEnabled()` decides whether named teammate teams can be used.

The gate is enabled when:

- The user type is internal Ant.
- `GAKR_CODE_EXPERIMENTAL_AGENT_TEAMS=1` is present.
- The CLI session was started with `--agent-teams`.

The gate can still be blocked by the GrowthBook killswitch. If the gate is false, Agent tool calls that try to spawn a teammate with `team_name` fail. Normal non-team subagents are still available.

## Team Identity

The active team identity comes from two places:

| Source | Used by |
| --- | --- |
| AsyncLocalStorage teammate context | In-process teammates. |
| Dynamic team context from CLI flags | Pane teammates launched as child processes. |

The main identity fields are:

- `agentId`
- `agentName`
- `teamName`
- `color`
- `planModeRequired`
- `parentSessionId`
- `isInProcess`

Helper functions such as `getAgentName()`, `getTeamName()`, `isTeammate()`, and `isTeamLead()` resolve from the active context.

## Spawn Decision

The Agent tool separates normal subagents from teammates:

| Input shape | Result |
| --- | --- |
| `team_name` and `name` | Spawn named teammate. |
| `name` with current app team context | Spawn named teammate in current team. |
| No `name` | Run a normal subagent/context fork. |
| Teammate tries to spawn a teammate | Error. The roster is flat. |
| In-process teammate tries background agent | Error. Background spawning is blocked. |

The spawn implementation creates or updates team state, resolves the backend, starts the teammate, and registers task state for the UI.

## Backend Types

Backends implement teammate execution in different ways.

| Backend | Type | Behavior |
| --- | --- | --- |
| tmux | Pane backend | Creates or reuses tmux sessions, windows, and panes. |
| iTerm2 | Pane backend | Uses iTerm2 integration where available, with tmux fallback. |
| in-process | Teammate executor | Runs the teammate in the same process with its own context and AbortController. |

Pane backends expose pane operations such as create, send input, terminate, kill, and status. In-process teammates expose spawn, sendMessage, terminate, kill, and isActive through an executor interface.

## Backend Selection

`detectAndGetBackend()` chooses pane support in this order:

1. If running inside tmux, use the native tmux backend.
2. If running inside iTerm2 and the `it2` command is available, use the iTerm2 backend.
3. If running inside iTerm2 without `it2`, use tmux fallback when tmux is available and surface iTerm2 setup guidance.
4. If tmux is available outside iTerm2, use tmux external session mode.
5. Otherwise, report install/setup instructions.

`isInProcessEnabled()` decides whether to bypass pane detection:

| Condition | Result |
| --- | --- |
| Non-interactive session | In-process enabled. |
| `teammateMode: "in-process"` | In-process enabled. |
| `teammateMode: "tmux"` | In-process disabled. |
| `teammateMode: "auto"` and previous pane fallback happened | In-process enabled. |
| `teammateMode: "auto"` outside tmux/iTerm2 | In-process enabled. |

When `auto` mode tries panes and detection fails, the code can mark an in-process fallback and continue. When `tmux` is forced, the backend error is shown instead.

## Pane Spawn Flow

For pane teammates, `spawnMultiAgent.ts`:

1. Ensures the team file exists.
2. Generates a unique teammate name if the requested name already exists.
3. Creates an agent ID and color.
4. Detects tmux/iTerm2 backend support.
5. Creates or focuses the swarm pane.
6. Builds a child command with teammate identity flags.
7. Forwards selected provider, proxy, config, permission, model, plugin, and browser settings.
8. Sends the initial prompt through the mailbox.
9. Registers an `in_process_teammate` task entry for UI/task tracking.

The spawned command includes identity and control flags such as:

```bash
--agent-id <id>
--agent-name <name>
--team-name <team>
--agent-color <color>
--parent-session-id <id>
--plan-mode-required
--agent-type <type>
```

`GAKR_CODE_TEAMMATE_COMMAND` can override the spawned command. The environment always includes team-related values such as `GAKR_CODE_EXPERIMENTAL_AGENT_TEAMS=1` and `GAKR_CODE_PROVIDER_MANAGED_BY_HOST=1`.

## In-Process Spawn Flow

For in-process teammates, the code:

1. Creates a teammate context with AsyncLocalStorage.
2. Creates an independent AbortController.
3. Registers the teammate as active team state.
4. Starts `runInProcessQuery()` in the same process.
5. Uses the mailbox for communication, but avoids duplicating the initial prompt as a separate welcome message.
6. Cleans up team membership when the teammate exits or is killed.

The independent AbortController is important: interrupting the lead query should not automatically abort active teammates.

## Team Files

Teams are stored under the GakrCLI teams directory. User-facing prompts describe the paths as:

- `~/.gakrcli/teams/{team-name}/config.json`
- `~/.gakrcli/tasks/{team-name}/`

The team config contains:

- Team name and description.
- Lead agent/session identifiers.
- Hidden pane IDs.
- Team allowed paths.
- Member records.

Member records include fields such as:

- `agentId`
- `name`
- `agentType`
- `model`
- `prompt`
- `color`
- `planModeRequired`
- `joinedAt`
- `tmuxPaneId`
- `cwd`
- `worktreePath`
- `sessionId`
- `backendType`
- `isActive`
- `mode`

The team file is the discovery point for teammates. Agents should use the human-readable `name` field for messages and task ownership.

## Mailbox Protocol

Team communication is file-backed and lock-protected. Each teammate has an inbox under the team directory.

Messages include:

- Sender.
- Text.
- Timestamp.
- Read state.
- Optional color.
- Optional summary.

Plain teammate messages can be formatted as `<teammate-message ...>` for delivery into the conversation. Structured protocol messages cover:

- Idle notification.
- Permission request and response.
- Sandbox permission request and response.
- Shutdown request, approval, and rejection.
- Plan approval request and response.
- Task assignment.
- Team permission update.
- Mode set request.

The SendMessage tool hides most of the protocol details from users and agents. Agents should normally send plain text instructions, questions, and status updates.

## Permission Flow

Swarm workers and teammates can request permission from the lead. The permission path may:

1. Try classifier-based auto-approval for safe tool uses when the relevant classifier gate is enabled.
2. Forward the request through mailbox/protocol messages.
3. Wait for the lead/user approval.
4. Resume or reject the teammate action based on the response.

Plan-mode approval uses the same general idea: the teammate asks for approval, then continues after approval or revises after rejection.

## Task And UI Tracking

Teams map one-to-one with task lists. The task list is used for owner assignment, dependencies, and completion state. The runtime also registers teammate state so the UI can display active, idle, killed, and completed teammate activity.

Even pane teammates can have task state registered in the lead process so the lead has one place to track the team.

## Limits And Intentional Constraints

- Teammates cannot spawn more teammates.
- In-process teammates cannot spawn background agents.
- TeamDelete fails while active teammates exist.
- Teammate identity flags must be internally consistent.
- Normal assistant text is not a team message.
- The system is built around named teammates, not anonymous worker IDs.
- Pane backends depend on tmux/iTerm2 availability.
- In-process teammates share the leader process resources and MCP connections.
