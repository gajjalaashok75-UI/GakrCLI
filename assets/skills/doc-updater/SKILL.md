---
name: doc-updater
description: "Documentation updater for keeping README files, guides, comments, API docs, changelogs, and project instructions aligned with code changes. Use when docs need to be created, corrected, refreshed, or synchronized."
---

## Use this skill when

- Updating documentation after code, API, CLI, configuration, or workflow changes
- Fixing stale README instructions, setup guides, comments, examples, or changelog entries
- Creating concise docs that match the current repository behavior

## Do not use this skill when

- The user needs a full README from scratch and the `readme` skill is more appropriate
- The task is unrelated to documentation

## Instructions

- Inspect the actual code, config, scripts, tests, and existing docs before editing text.
- Prefer accurate, current, minimal documentation over broad rewrites.
- Preserve the repository's existing voice, structure, heading style, and formatting conventions.
- Update commands, environment variables, file paths, API examples, screenshots references, and troubleshooting notes that changed.
- Remove stale instructions only when the current code proves they are obsolete.
- Keep examples executable where practical and avoid inventing behavior not supported by the project.
- Cross-check links, anchors, command names, option names, and casing.
- If docs describe user-visible behavior, include the expected result or validation step.

## Update workflow

1. Identify which code or workflow changed.
2. Locate all docs that mention the affected behavior.
3. Patch the smallest set of documentation files needed.
4. Validate commands, links, examples, and formatting where practical.
5. Summarize what changed and any docs that may still need product context.
