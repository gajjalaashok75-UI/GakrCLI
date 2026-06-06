# Agent Swarms And Teams

This folder documents the swarm functionality in GakrCLI. In the codebase, "swarm" mostly means a team of named teammate agents that can collaborate with the current lead session.

There is also a separate coordinator mode that delegates work to async worker agents. It uses some of the same tools, but it is not the same runtime as teammate teams.

## What A Swarm Is

A swarm is a named team that contains:

- A lead session.
- One or more named teammates.
- A shared team config file.
- A shared task list.
- File-backed inboxes for messages between agents.

The lead creates the team, breaks work into tasks, spawns teammates with the Agent tool, assigns work, receives teammate messages, and shuts the team down when finished.

## Related Systems

| System | Main purpose | Main activation |
| --- | --- | --- |
| Agent teams | Named teammate agents that collaborate with the lead and each other. | Runtime agent-teams gate plus `TeamCreate` and `Agent` with `team_name` and `name`. |
| In-process teammates | Teammates running inside the same Node/Bun process as the lead. | `teammateMode: "in-process"` or automatic fallback. |
| Pane teammates | Teammates running in tmux or iTerm2 panes. | `teammateMode: "tmux"` or automatic pane detection. |
| Coordinator mode | Coordinator delegates async work to `worker` subagents. | `COORDINATOR_MODE` build flag plus `GAKR_CODE_COORDINATOR_MODE`. |

## Documentation Map

| Document | Use it for |
| --- | --- |
| [usage.md](usage.md) | Enabling swarms, creating a team, spawning teammates, messaging, task assignment, shutdown, and troubleshooting. |
| [architecture.md](architecture.md) | Backend selection, spawn flow, team files, mailboxes, permissions, environment forwarding, and limits. |
| [coordinator-mode.md](coordinator-mode.md) | Coordinator mode, worker agents, how it differs from teammate swarms, and when to use it. |

## Quick Example

1. Enable agent teams for an external build:

```bash
GAKR_CODE_EXPERIMENTAL_AGENT_TEAMS=1 gakrcli
```

or start with:

```bash
gakrcli --agent-teams
```

2. Ask the lead session to create a team and spawn teammates:

```text
Create a team named docs-refresh, make tasks for auditing docs, and spawn a researcher and verifier teammate.
```

3. The lead should use `TeamCreate`, `TaskCreate`, `Agent`, `TaskUpdate`, and `SendMessage` rather than plain terminal output for team coordination.

## Important Rules

- A teammate must have a `name` and a `team_name` to join a team.
- Normal text output from one agent is not visible to other agents. Use `SendMessage`.
- Refer to teammates by their human-readable `name`, not their UUID.
- Teammates cannot spawn more teammates. The team roster is flat.
- In-process teammates cannot spawn background agents.
- Team cleanup requires all teammates to shut down before `TeamDelete` can remove the team resources.
