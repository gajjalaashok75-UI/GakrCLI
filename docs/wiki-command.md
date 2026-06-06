# `/wiki` Command Reference

This document describes the current `/wiki` command implementation in GakrCLI. It is based on the command entry point in `src/commands/wiki/` and the backing wiki service in `src/services/wiki/`.

## Executive Summary

`/wiki` manages a local, project-scoped Markdown knowledge base stored at `.gakrcli/wiki` inside the current working directory. It is intended to preserve durable project knowledge outside of transient chat history.

The command currently supports three intended operations:

| Operation | Command | Purpose |
| --- | --- | --- |
| Initialize | `/wiki init` | Create the wiki scaffold under `.gakrcli/wiki`. |
| Inspect | `/wiki` | Report whether the wiki exists and count pages and sources. |
| Ingest | `/wiki ingest <path>` | Convert a local project file into a source note and refresh the index. |

The command is registered as an immediate local JSX slash command, so it runs locally and returns a system-display message instead of sending a prompt to the model.

Key source files:

- `src/commands/wiki/index.ts:3` defines the slash command metadata.
- `src/commands/wiki/wiki.tsx:77` parses arguments and dispatches subcommands.
- `src/services/wiki/init.ts:112` creates the wiki scaffold.
- `src/services/wiki/status.ts:53` computes wiki status.
- `src/services/wiki/ingest.ts:69` ingests local source files.
- `src/services/wiki/indexBuilder.ts:31` rebuilds `index.md`.

## Command Registration

`/wiki` is registered in two layers:

1. `src/commands/wiki/index.ts:3` exports the command object:

```ts
{
  type: 'local-jsx',
  name: 'wiki',
  description: 'Initialize, inspect, and ingest sources into the GakrCLI project wiki',
  argumentHint: '[init|status|ingest <path>]',
  immediate: true,
  load: () => import('./wiki.js'),
}
```

2. `src/commands.ts:174` imports it, and `src/commands.ts:355` adds it to the built-in command list.

Important behavior:

- `type: 'local-jsx'` means the command executes in the CLI runtime, not as a model prompt.
- `immediate: true` means it can run immediately from the REPL command path.
- `load` lazy-loads `src/commands/wiki/wiki.tsx` only when the command is invoked.

## Syntax

```text
/wiki [init|status|ingest <path>]
```

Supported invocations:

| Input | Behavior |
| --- | --- |
| `/wiki` | Show initialized state, counts, core file presence, and last update time. |
| `/wiki status` | Currently renders help because `status` is handled as a common info argument before the explicit status branch. |
| `/wiki init` | Create the wiki scaffold if files do not already exist. |
| `/wiki ingest README.md` | Ingest `README.md` into `.gakrcli/wiki/sources/`. |
| `/wiki help` | Show usage text. |
| `/wiki --help` | Show usage text through common help argument handling. |

Unknown subcommands return an "Unknown wiki subcommand" message followed by the help text.

Current caveat: `renderHelp()` advertises `/wiki status`, but `runWikiCommand()` checks `COMMON_HELP_ARGS` and `COMMON_INFO_ARGS` before checking `normalized === 'status'`. Because `COMMON_INFO_ARGS` includes `status` in `src/constants/xml.ts`, the explicit status branch is unreachable for `/wiki status` in the current implementation. Bare `/wiki` still reaches the status path.

## Runtime Flow

The main runtime flow lives in `runWikiCommand()` at `src/commands/wiki/wiki.tsx:77`.

```text
User enters /wiki ...
  -> command metadata lazy-loads wiki.tsx
  -> call(onDone, context, args)
  -> runWikiCommand(onDone, args)
  -> getCwd()
  -> parse first whitespace-separated token as subcommand
  -> dispatch to status, init, ingest, help, or unknown-command handling
  -> send a system-display result through onDone(...)
```

Errors are caught in `call()` at `src/commands/wiki/wiki.tsx:119`. The command logs the original error with `logError(error)` and returns:

```text
Wiki command failed: <error message>
```

If the thrown value is not an `Error`, it reports:

```text
Wiki command failed: Unexpected wiki command error
```

## Wiki Filesystem Layout

`getWikiPaths()` in `src/services/wiki/paths.ts:7` builds all paths from the current working directory:

```text
<cwd>/
  .gakrcli/
    wiki/
      schema.md
      index.md
      log.md
      pages/
        architecture.md
      sources/
        <ingested-source-note>.md
```

Path meanings:

| Path | Purpose |
| --- | --- |
| `.gakrcli/wiki/` | Project wiki root. |
| `.gakrcli/wiki/schema.md` | Wiki goals, structure, and page rules. |
| `.gakrcli/wiki/index.md` | Top-level navigation for pages and source notes. |
| `.gakrcli/wiki/log.md` | Append-only update log. |
| `.gakrcli/wiki/pages/` | Durable topic pages. |
| `.gakrcli/wiki/pages/architecture.md` | Bootstrap architecture page. |
| `.gakrcli/wiki/sources/` | Generated source notes from `/wiki ingest`. |

## `/wiki init`

`/wiki init` calls `initializeWiki(cwd)` from `src/services/wiki/init.ts:112`.

It creates these directories with recursive `mkdir`:

```text
.gakrcli/wiki
.gakrcli/wiki/pages
.gakrcli/wiki/sources
```

It then attempts to create these files:

```text
.gakrcli/wiki/schema.md
.gakrcli/wiki/index.md
.gakrcli/wiki/log.md
.gakrcli/wiki/pages/architecture.md
```

The file writes use `flag: 'wx'`, so existing files are preserved. If a file already exists, initialization skips it instead of overwriting it.

Returned result shape:

```ts
type WikiInitResult = {
  root: string
  createdFiles: string[]
  createdDirectories: string[]
  alreadyExisted: boolean
}
```

Displayed output:

- Always starts with `Initialized GakrCLI wiki at <root>`.
- If all scaffold files already existed, it adds `Wiki already existed. No new files were created.`
- Otherwise, it lists each newly created file.

Design intent:

- Initialization is idempotent.
- Existing user-maintained wiki files are not overwritten.
- The scaffold gives both humans and future automation a stable wiki shape.

## `/wiki status`

Bare `/wiki` calls `getWikiStatus(cwd)` from `src/services/wiki/status.ts:53`.

The advertised `/wiki status` form currently renders help for the dispatch-order reason described in the syntax section. If the dispatcher is corrected later, this section should apply to both `/wiki` and `/wiki status`.

Status checks:

| Field | How it is computed |
| --- | --- |
| `initialized` | True only when root, schema, index, and log all exist. |
| `pageCount` | Recursive count of `.md` files under `pages/`. |
| `sourceCount` | Recursive count of `.md` files under `sources/`. |
| `hasSchema` | Whether `schema.md` exists. |
| `hasIndex` | Whether `index.md` exists. |
| `hasLog` | Whether `log.md` exists. |
| `lastUpdatedAt` | Newest modification time among schema, index, log, pages, and sources. |

If the wiki is not initialized, output says:

```text
GakrCLI wiki is not initialized in this project.

Run /wiki init to create <root>.
```

If initialized, output includes:

```text
GakrCLI wiki status

Root: <root>
Pages: <count>
Sources: <count>
Schema: present|missing
Index: present|missing
Log: present|missing
Last updated: <iso timestamp>|unknown
```

## `/wiki ingest <path>`

`/wiki ingest <path>` calls `ingestLocalWikiSource(cwd, rawPath)` from `src/services/wiki/ingest.ts:69`.

The ingest flow:

1. Calls `initializeWiki(cwd)` first, so ingest can bootstrap the wiki automatically.
2. Resolves the input path relative to the current project unless it is absolute.
3. Canonicalizes both the project directory and source file with `realpath`.
4. Rejects files outside the current project.
5. Rejects symbolic links.
6. Verifies the resolved path is a regular file.
7. Reads the file as UTF-8.
8. Generates a title, summary, excerpt, and slug.
9. Writes a source note under `.gakrcli/wiki/sources/`.
10. Appends an entry to `.gakrcli/wiki/log.md`.
11. Rebuilds `.gakrcli/wiki/index.md`.

Security and containment checks live in `resolveContainedSourcePath()` at `src/services/wiki/ingest.ts:49`.

Rejected inputs:

| Case | Error |
| --- | --- |
| File outside the current project | `Wiki ingest only supports files inside the current project.` |
| Symbolic link | `Wiki ingest does not support symbolic links.` |
| Directory or non-file path | `Not a file: <resolved path>` |
| Missing path argument | `Usage: /wiki ingest <local-file-path>` |

Generated source note format:

````md
# <title>

## Source

- Path: `<project-relative-source-path>`
- Ingested at: <iso timestamp>

## Summary

<summary>

## Excerpt

```
<first 20 lines of source file>
```

## Linked Pages

- [Architecture](../pages/architecture.md)
````

Displayed output:

```text
Ingested <source file> into the GakrCLI wiki.

Title: <title>
Source note: <relative source note path>
Summary: <summary>
```

## Title, Summary, Excerpt, And Slug Rules

Helper functions live in `src/services/wiki/utils.ts`.

Title extraction:

- `extractTitleFromText()` at `src/services/wiki/utils.ts:22` uses the first non-empty line of the file.
- Leading Markdown heading markers are stripped.
- If no usable line exists, the filename without extension is used.

Summary generation:

- `summarizeText()` at `src/services/wiki/utils.ts:9` collapses whitespace.
- Empty content becomes `No summary available.`
- Content longer than 280 characters is truncated and marked with an ellipsis.
- This is a simple deterministic summary, not an LLM-generated synthesis.

Excerpt generation:

- The ingest service takes the first 20 lines of the source file.
- Leading and trailing whitespace are trimmed from the excerpt block.

Slug generation:

- `sanitizeWikiSlug()` at `src/services/wiki/utils.ts:1` lowercases the value.
- Non-alphanumeric runs become hyphens.
- Leading and trailing hyphens are removed.
- Repeated hyphens are collapsed.
- The ingest slug is based on `<baseName>-<Date.now()>`, making repeated ingests of the same file produce separate source notes.

## Index Rebuild Behavior

`rebuildWikiIndex(cwd)` in `src/services/wiki/indexBuilder.ts:31` regenerates `.gakrcli/wiki/index.md`.

It:

- Recursively lists Markdown files under `pages/`.
- Recursively lists Markdown files under `sources/`.
- Sorts file paths before rendering links.
- Uses the first `# ` heading as the display title for pages.
- Uses the source note filename as the display title for source notes.
- Rewrites the full `index.md` file.

Generated index shape:

```md
# <project-name> Wiki

This wiki is maintained by GakrCLI as a durable project knowledge layer.

## Core Pages

- [Architecture](./pages/architecture.md)

## Sources

- [<source-note-slug>](./sources/<source-note-slug>.md)

## Recent Updates

- See [log.md](./log.md)
```

## Current Limitations

The current `/wiki` command is an MVP-style local wiki manager. It does not yet:

- Generate model-written wiki pages from source notes.
- Merge ingested facts into existing topic pages.
- Deduplicate repeated ingests of the same file.
- Support deleting source notes.
- Support remote URLs or external sources.
- Support binary files.
- Parse frontmatter or structured metadata from source files.
- Validate Markdown links after index rebuild.
- Expose subcommands for listing individual pages or opening the wiki.

These limitations are useful to keep in mind when extending the command. The existing implementation is deliberately conservative: local files only, no symlinks, no overwrite during init, and deterministic source-note generation.

## Tests

The service layer has focused tests:

| Test file | Coverage |
| --- | --- |
| `src/services/wiki/init.test.ts` | Scaffold creation and idempotent initialization. |
| `src/services/wiki/status.test.ts` | Uninitialized state, initialized counts, and update timestamp. |
| `src/services/wiki/ingest.test.ts` | Source note generation, log/index updates, and outside-project rejection. |

Useful test commands:

```bash
bun test src/services/wiki/init.test.ts
bun test src/services/wiki/status.test.ts
bun test src/services/wiki/ingest.test.ts
```

Or run the full JavaScript/TypeScript suite through the project test command if available:

```bash
npm test
```

## Maintenance Checklist

Update this document when any of these change:

- `/wiki` gains or removes subcommands.
- The `/wiki status` dispatch caveat is fixed.
- The wiki directory layout changes.
- `WikiInitResult`, `WikiStatus`, or `WikiIngestResult` changes.
- Ingest accepts new source types or changes containment rules.
- Index generation changes link format or sort behavior.
- Tests move from service-only coverage to command-level coverage.
