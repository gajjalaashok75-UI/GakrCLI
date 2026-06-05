# Agent Swarm Usage

This page explains how to enable and use teammate swarms from the GakrCLI runtime.

## Availability

Agent teams are controlled by a runtime gate, not only by the build.

External/open builds need one of these:

```bash
GAKR_CODE_EXPERIMENTAL_AGENT_TEAMS=1 gakrcli
```

or:

```bash
gakrcli --agent-teams
```

Internal Ant builds are treated as enabled. A GrowthBook killswitch can still disable access.

When the gate is off, a normal Agent subagent can still run, but a request that includes a `team_name` for teammate spawning fails with an availability error.

## Choose A Teammate Mode

The `teammateMode` setting controls how teammates are spawned:

| Mode | Behavior |
| --- | --- |
| `auto` | Default. Use pane backends when available, otherwise use in-process teammates. |
| `tmux` | Force pane-style teammates through tmux or iTerm2/tmux support. Backend detection errors are shown to the user. |
| `in-process` | Force teammates to run inside the same process as the lead session. |

The setting is exposed by the Config tool and by config as:

```json
{
  "teammateMode": "auto"
}
```

Use `in-process` when tmux/iTerm2 is unavailable, when running non-interactively, or when a single-process team is enough. Use `tmux` when you want visible panes and independent process execution.

## CLI Flags

The CLI has hidden team-related flags used by spawned teammates and advanced workflows:

| Flag | Purpose |
| --- | --- |
| `--agent-teams` | Opts the current session into experimental agent teams. |
| `--teammate-mode <auto|tmux|in-process>` | Sets the teammate spawn mode for the session. |
| `--agent-id <id>` | Identity for a spawned teammate. Used with `--agent-name` and `--team-name`. |
| `--agent-name <name>` | Human-readable teammate name. |
| `--team-name <name>` | Team the teammate belongs to. |
| `--agent-color <color>` | UI color assigned to the teammate. |
| `--agent-type <type>` | Subagent type assigned to the teammate. |
| `--plan-mode-required` | Starts the teammate in plan permission mode. |
| `--parent-session-id <id>` | Links the teammate back to the lead session. |

`--agent-id`, `--agent-name`, and `--team-name` must be provided together. Normal users usually do not need to pass these identity flags manually; the spawn code adds them for pane teammates.

## Team Lifecycle

### 1. Create The Team

Use `TeamCreate` when the work should be split across multiple agents:

```json
{
  "team_name": "docs-refresh",
  "description": "Audit and update project documentation"
}
```

This creates:

- `~/.gakrcli/teams/{team-name}/config.json`
- `~/.gakrcli/tasks/{team-name}/`

The team has a shared task list. Team members use the same task tools to create, claim, update, and complete work.

### 2. Create And Assign Tasks

Use task tools for coordination:

| Tool | Use |
| --- | --- |
| `TaskCreate` | Create work items. |
| `TaskList` | See pending, active, blocked, and completed tasks. |
| `TaskGet` | Read one task in detail. |
| `TaskUpdate` | Assign owners, change status, add dependencies, or complete tasks. |

Assign work with `TaskUpdate` by setting `owner` to a teammate name. Prefer the teammate name from the team config, not the generated agent ID.

### 3. Spawn Teammates

A teammate is created through the Agent tool when both `team_name` and `name` are present.

Example:

```json
{
  "description": "Review docs for missing feature coverage",
  "prompt": "Inspect the docs and source references, then report missing swarm documentation sections.",
  "subagent_type": "explore",
  "team_name": "docs-refresh",
  "name": "researcher"
}
```

Useful Agent fields:

| Field | Meaning |
| --- | --- |
| `description` | Short UI/task description. |
| `prompt` | Full assignment for the teammate. |
| `subagent_type` | Agent profile, such as read-only explore/plan or a full-capability agent. |
| `model` | Optional teammate model override. |
| `team_name` | Team to join. |
| `name` | Human-readable teammate name used for messaging and ownership. |
| `mode` | Permission mode for the spawned teammate, including plan mode. |

If `name` is omitted, the Agent tool behaves like a normal subagent/context fork instead of adding a teammate to the team.

## Communication

Use `SendMessage` for every message that another agent needs to see.

Send to one teammate:

```json
{
  "to": "researcher",
  "message": "Please check whether coordinator mode is documented separately from teammate swarms."
}
```

Broadcast to all teammates:

```json
{
  "to": "*",
  "message": "Pause new edits and report current status."
}
```

Plain text in an assistant response is visible to the user, but not to teammates. The teammate prompt explicitly tells agents that SendMessage is the communication channel.

## Idle State

Teammates go idle after a turn. Idle means "waiting for input"; it does not mean the teammate has failed or disappeared.

The lead receives automatic teammate messages, including idle notifications and summaries. If a teammate needs more work, send another message or assign a task with `TaskUpdate`.

## Shutdown And Cleanup

Ask teammates to shut down through `SendMessage` with a shutdown request. After all active teammates have terminated, use `TeamDelete` to remove team resources.

`TeamDelete` removes:

- `~/.gakrcli/teams/{team-name}/`
- `~/.gakrcli/tasks/{team-name}/`
- Current session team context

`TeamDelete` fails while active members still exist. Shutdown first, delete second.

## Models

Teammate model selection follows this shape:

| Source | Behavior |
| --- | --- |
| Agent tool `model` | Explicit model for that teammate. |
| `inherit` | Uses the lead session model when available. |
| `teammateDefaultModel` | Configured default model for teammates. |
| Hardcoded fallback | Used when no model override or config default is present. |

The spawn path also forwards provider environment variables and selected CLI settings so pane teammates can use the same provider context as the lead.

## Plan Mode

When a teammate is spawned in plan mode, it must produce a plan and wait for approval before editing. The spawn command passes `--plan-mode-required`, and in-process teammates start with plan permission mode.

Use plan mode for risky, broad, or ambiguous assignments.

## Common Problems

| Problem | Likely cause | Fix |
| --- | --- | --- |
| Agent team unavailable | Runtime gate is off. | Start with `--agent-teams` or `GAKR_CODE_EXPERIMENTAL_AGENT_TEAMS=1`. |
| Spawn fails in `tmux` mode | tmux/iTerm2 backend is unavailable or misconfigured. | Use `teammateMode: "auto"` or `"in-process"`, or install/configure tmux/iTerm2 integration. |
| Teammate did not receive a message | Message was written as normal text. | Use `SendMessage`. |
| TeamDelete fails | Active teammates still exist. | Request shutdown, wait for termination, then delete. |
| Teammate spawned as a normal subagent | `name` was missing. | Include both `team_name` and `name`. |
| In-process teammate cannot spawn background work | This is intentionally blocked. | Use synchronous subagents or ask the lead to spawn another teammate. |
