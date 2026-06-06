# `/wiki` Command Reference

`/wiki` manages a local, project-scoped Markdown knowledge base at `.gakrcli/wiki`.
It follows the LLM Wiki pattern: raw inputs remain separate, generated source notes
capture what was read, durable wiki pages accumulate synthesis, and `index.md` plus
`log.md` help humans and agents navigate the knowledge over time.

## Commands

```text
/wiki [init|status|ingest <path>]
```

| Command | Purpose |
| --- | --- |
| `/wiki` | Show wiki status. |
| `/wiki status` | Show wiki status. |
| `/wiki init` | Create the wiki scaffold in the current project. |
| `/wiki ingest <path>` | Read a local project file and create a generated source note. |
| `/wiki help` | Show command help. |

The command is registered as an immediate local JSX command in
`src/commands/wiki/index.ts`, so it runs locally and returns a system-display
message instead of sending the request to the model.

## Filesystem Layout

`getWikiPaths()` in `src/services/wiki/paths.ts` resolves the wiki layout from the
current working directory:

```text
<cwd>/
  .gakrcli/
    wiki/
      schema.md
      index.md
      log.md
      raw/
      pages/
        architecture.md
      sources/
        <generated-source-note>.md
```

| Path | Purpose |
| --- | --- |
| `.gakrcli/wiki/raw/` | Immutable curated inputs copied or dropped in by the user. |
| `.gakrcli/wiki/sources/` | Generated source notes created by `/wiki ingest`. |
| `.gakrcli/wiki/pages/` | Durable topic, entity, concept, comparison, and architecture pages. |
| `.gakrcli/wiki/schema.md` | Operating contract for future wiki maintenance. |
| `.gakrcli/wiki/index.md` | Content-oriented catalog of pages and source notes. |
| `.gakrcli/wiki/log.md` | Append-only chronological history with parseable headings. |

## LLM Wiki Contract

The generated `schema.md` tells future agents to treat the wiki as a persistent,
compounding knowledge layer rather than a transient retrieval cache.

Core rules:

- Compile knowledge once and keep it current as new sources arrive.
- Keep source attribution explicit.
- Prefer updating existing pages over creating duplicates.
- Track contradictions, stale claims, relationships, and open questions.
- Read `index.md` first, then drill into relevant pages and source notes.
- Append log entries as headings like `## [<iso timestamp>] ingest | <title>`.

## `/wiki init`

`/wiki init` calls `initializeWiki(cwd)` from `src/services/wiki/init.ts`.

It creates:

```text
.gakrcli/wiki/
.gakrcli/wiki/raw/
.gakrcli/wiki/pages/
.gakrcli/wiki/sources/
.gakrcli/wiki/schema.md
.gakrcli/wiki/index.md
.gakrcli/wiki/log.md
.gakrcli/wiki/pages/architecture.md
```

File creation uses exclusive writes, so existing wiki files are preserved. Running
`/wiki init` again is idempotent.

## `/wiki status`

`/wiki` and `/wiki status` call `getWikiStatus(cwd)` from
`src/services/wiki/status.ts`.

Status reports:

- wiki root path
- raw file count under `raw/`
- Markdown page count under `pages/`
- generated source-note count under `sources/`
- whether `schema.md`, `index.md`, and `log.md` are present
- last update timestamp across core wiki files

## `/wiki ingest <path>`

`/wiki ingest <path>` calls `ingestLocalWikiSource(cwd, rawPath)` from
`src/services/wiki/ingest.ts`.

The ingest flow:

1. Initializes the wiki if needed.
2. Resolves the input path inside the current project.
3. Rejects files outside the project.
4. Rejects symbolic links.
5. Reads the file as UTF-8.
6. Extracts a title, deterministic summary, and excerpt.
7. Writes a generated source note under `.gakrcli/wiki/sources/`.
8. Appends a parseable `ingest` entry to `log.md`.
9. Rebuilds `index.md`.

Generated source notes include source path, ingest timestamp, summary, excerpt,
and a link back to the architecture page.

Current ingest is deterministic and local-file only. It does not yet run an LLM
synthesis pass over `pages/`; the schema documents how a future agent should do
that maintenance when the wiki grows.

## Index And Log

`rebuildWikiIndex(cwd)` in `src/services/wiki/indexBuilder.ts` rewrites
`index.md` from the current `pages/` and `sources/` directories.

The index uses each Markdown file's first `#` heading as the display title. This
makes generated source notes appear by their human title instead of only by slug.

`log.md` is append-only. Entries use consistent headings so simple tools can scan
the history:

```text
## [2026-06-06T12:00:00.000Z] ingest | Design Notes
```

## Tests

Focused coverage lives in:

| Test file | Coverage |
| --- | --- |
| `src/services/wiki/init.test.ts` | Scaffold creation, schema content, log format, idempotency. |
| `src/services/wiki/status.test.ts` | Uninitialized state, raw/page/source counts, timestamps. |
| `src/services/wiki/ingest.test.ts` | Source note generation, parseable log entries, rebuilt index. |
| `src/commands/wiki/wiki.test.ts` | `/wiki status` dispatch behavior. |
