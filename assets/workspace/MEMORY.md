# MEMORY.md - Durable Memory

Use this file for durable cross-project memories.

Store stable facts, preferences, decisions, lessons, and recurring project context. Do not store secrets unless the user explicitly asks and the storage is appropriate.

This is the overall workspace memory for all projects. Project-specific memory lives under `projects/<project>/memory/`.

## Workspace Location

- Location: `~/.gakrcli/workspace/MEMORY.md`
- Scope: workspace-wide, loaded across projects
- Update this file for curated memories that should apply across all projects.

Before changing this file, read it first and make a specific update.
