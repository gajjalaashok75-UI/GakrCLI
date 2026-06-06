# Coordinator Mode

Coordinator mode is a separate multi-agent mode from teammate swarms. It is compiled into the open build by the `COORDINATOR_MODE` feature flag, but it only activates when the relevant runtime environment is set.

## What It Does

Coordinator mode turns the current session into a coordinator that delegates work to async `worker` agents. The coordinator is responsible for:

- Breaking a request into independent worker assignments.
- Spawning workers with the Agent tool.
- Continuing workers with SendMessage.
- Stopping workers with TaskStop.
- Combining real worker results into the final answer.

Worker results are delivered back as task notifications. The coordinator prompt explicitly warns not to fabricate worker results.

## Activation

Build-time requirement:

```ts
COORDINATOR_MODE: true
```

Runtime activation:

```bash
GAKR_CODE_COORDINATOR_MODE=1 gakrcli
```

Session resume can also match a stored coordinator/non-coordinator mode by updating `GAKR_CODE_COORDINATOR_MODE` in process state.

## Coordinator Versus Swarm

| Topic | Coordinator mode | Agent teammate swarm |
| --- | --- | --- |
| Main unit | Async `worker` task agents. | Named teammate agents in a team. |
| Team file | Not the core mechanism. | Central config under `~/.gakrcli/teams/{team}/`. |
| Task list | Worker orchestration through task notifications. | Shared team task list under `~/.gakrcli/tasks/{team}/`. |
| Activation | `GAKR_CODE_COORDINATOR_MODE`. | `--agent-teams` or `GAKR_CODE_EXPERIMENTAL_AGENT_TEAMS=1`. |
| Agent identity | Worker tasks. | Human-readable teammate names. |
| Best for | Parallel research, implementation, and verification phases. | Longer collaborative workflows with persistent named teammates. |

## Worker Agent Type

Coordinator mode defines a built-in `worker` agent type derived from the general-purpose agent. It also keeps access to built-in general, explore, and plan agents.

The coordinator prompt tells the model to use:

```json
{
  "subagent_type": "worker"
}
```

for worker delegation.

## Tool Boundaries

The coordinator itself has a small tool surface:

- `Agent`
- `TaskStop`
- `SendMessage`
- `SyntheticOutput`

Workers receive the broader async worker tool set, including file read/search tools, web search/fetch tools where available, task/todo tools, edit/write tools, notebooks, LSP tools, and shell tools such as Bash or PowerShell.

The exact tool set still depends on the build, runtime settings, permissions, and available tools.

## Recommended Workflow

1. Spawn independent workers in parallel when the work can be split.
2. Use clear worker prompts with expected output and constraints.
3. Continue workers through SendMessage when they need follow-up.
4. Stop irrelevant or stuck workers with TaskStop.
5. Verify results before summarizing.
6. Report only what came back from workers or what the coordinator independently verified.

Coordinator mode is best when a task has distinct phases, such as:

- Research several files or subsystems at once.
- Implement a change while another worker checks tests or docs.
- Compare independent approaches.
- Run read-only verification after an implementation worker finishes.

## Permission Behavior

Coordinator workers can request permissions. Permission handling can use hooks and classifier decisions before falling back to interactive approval. The coordinator should treat permission responses as part of worker orchestration rather than direct user-facing final output.

## When To Use Swarm Instead

Use a teammate swarm instead of coordinator mode when:

- You need named teammates such as `researcher`, `builder`, and `verifier`.
- The agents should share a team task list.
- You want team lifecycle operations with TeamCreate and TeamDelete.
- You want a longer-running group that can exchange direct messages.
- You need pane or in-process teammate behavior.

Use coordinator mode when the user mainly needs parallel delegation and aggregation, not a persistent team.
