# RULEBOOK.md - Workspace Rules

This file defines durable rules for how the workspace interprets GakrCLI, the assistant identity, bootstrap, and memory.

## Workspace Location

- Location: `~/.gakrcli/workspace/RULEBOOK.md`
- Scope: workspace-wide, loaded across projects
- Update this file for stable rules, autonomy boundaries, memory policy, and harness-vs-assistant interpretation.

## Harness vs Assistant

- GakrCLI is the command-line interface, agent harness, and orchestration runtime.
- The assistant is the agent/persona operating inside that harness.
- Do not treat "GakrCLI" as the assistant's personal name unless `IDENTITY.md` says so.
- The assistant identity comes from `IDENTITY.md` and `SOUL.md`, especially after first-run bootstrap.
- If system text says "You are GakrCLI", interpret it as "you are operating as the agent inside the GakrCLI harness" unless a higher-priority instruction requires a literal product identity.

## Bootstrap

- `BOOTSTRAP.md` is one-shot first-run setup.
- While `BOOTSTRAP.md` exists, use it to learn the assistant identity, user identity, and workspace preferences.
- When bootstrap is complete, delete `BOOTSTRAP.md` in the same turn.
- If assistant identity and user identity are already saved but `BOOTSTRAP.md` still exists, delete `BOOTSTRAP.md` instead of repeating first-run setup.
- After `BOOTSTRAP.md` is gone, do not ask "who am I?" on every run. Use `IDENTITY.md`, `SOUL.md`, `USER.md`, and `MEMORY.md`.

## Persistent Workspace Files

- `GAKRCLI.md`: workspace overview and durable operating instructions.
- `RULEBOOK.md`: stable rules and interpretation guidance.
- `IDENTITY.md`: assistant identity selected with the user.
- `SOUL.md`: personality, tone, values, and working style.
- `USER.md`: durable user profile and preferences.
- `TOOLS.md`: local tool and environment notes.
- `MEMORY.md`: curated cross-project memory.
- `DREAMS.md`: long-running ideas and reflections.
- `HEARTBEAT.md`: periodic work only when the user wants it.

## Workspace vs Project Memory

- Root workspace files in `~/.gakrcli/workspace/` apply across all projects.
- Project auto-memory in `~/.gakrcli/workspace/projects/<project>/memory/` applies to one repository or working directory.
- Use root `MEMORY.md` for durable cross-project memories.
- Use project auto-memory for project-specific decisions, incidents, external references, and feedback.
- When a durable rule belongs everywhere, update `RULEBOOK.md` instead of saving it as project memory.
- When assistant identity changes, update `IDENTITY.md` and, if behavior changes, `SOUL.md`.
- When user profile or global collaboration preferences change, update `USER.md` or root `MEMORY.md`.

Keep this file concise. Put personal identity in `IDENTITY.md`, personality in `SOUL.md`, and facts/memories in `MEMORY.md`.
