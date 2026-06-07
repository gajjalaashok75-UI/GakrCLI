# `/wiki` Command Reference

`/wiki` manages a local, project-scoped knowledge base at `.gakrcli/wiki`.
It follows the LLM Wiki pattern and adds a Graphify-style local graph layer:
raw inputs remain separate, generated source notes capture what was read,
durable wiki pages accumulate synthesis, and `graph/` stores a project graph for
low-token codebase understanding.

## Commands

```text
/wiki [init [--force] [path]|update [path]|query <question>|status|ingest <path>]
```

| Command | Purpose |
| --- | --- |
| `/wiki` | Show wiki status. |
| `/wiki status` | Show wiki status. |
| `/wiki init` | Create the wiki scaffold and local graph knowledge base if missing. |
| `/wiki init --force [path]` | Reinitialize and force-rebuild the local graph knowledge base. |
| `/wiki update [path]` | Refresh an existing wiki graph for `.` or a target path. |
| `/wiki query <question>` | Query the wiki graph with Graphify-style BFS/DFS traversal. |
| `/wiki ingest <path>` | Read a local project file and create a generated source note. |
| `/wiki help` | Show command help. |

The command is registered as an immediate local JSX command in
`src/commands/wiki/index.ts`, so it runs locally and returns a system-display
message instead of sending the request to the model.

Use a project-root `.wikiignore` file to exclude files and folders from wiki
graph knowledge. It uses the same pattern style as `.gitignore`.

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
      graph/
        graph.json
        GRAPH_REPORT.md
        graph.html
        manifest.json
        wiki/
          index.md
          Community_0.md
```

| Path | Purpose |
| --- | --- |
| `.gakrcli/wiki/raw/` | Immutable curated inputs copied or dropped in by the user. |
| `.gakrcli/wiki/sources/` | Generated source notes created by `/wiki ingest`. |
| `.gakrcli/wiki/pages/` | Durable topic, entity, concept, comparison, and architecture pages. |
| `.gakrcli/wiki/schema.md` | Operating contract for future wiki maintenance. |
| `.gakrcli/wiki/index.md` | Content-oriented catalog of pages and source notes. |
| `.gakrcli/wiki/log.md` | Append-only chronological history with parseable headings. |
| `.gakrcli/wiki/graph/graph.json` | Machine-readable graph of files, symbols, headings, and imports. |
| `.gakrcli/wiki/graph/GRAPH_REPORT.md` | Low-token summary of central nodes, communities, and suggested questions. |
| `.gakrcli/wiki/graph/wiki/` | Generated markdown community pages for graph navigation. |
| `.gakrcli/wiki/graph/manifest.json` | Indexed file hashes and metadata for later update/query phases. |

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

`/wiki init` calls `initializeWikiKnowledge(cwd)` from
`src/services/wiki/knowledgeGraph.ts`.

It creates the base wiki scaffold if needed:

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

File creation uses exclusive writes, so existing wiki files are preserved. If the
main wiki scaffold already exists (`schema.md`, `index.md`, and `log.md`),
plain `/wiki init` reports that initialization is already done and does not
rebuild graph artifacts.

Use `/wiki init --force` to reinitialize and force-rebuild graph artifacts,
similar in spirit to `python -m graphify update . --force`, but implemented
locally in TypeScript with no Python package dependency:

```text
.gakrcli/wiki/graph/graph.json
.gakrcli/wiki/graph/GRAPH_REPORT.md
.gakrcli/wiki/graph/graph.html
.gakrcli/wiki/graph/manifest.json
.gakrcli/wiki/graph/wiki/index.md
.gakrcli/wiki/graph/wiki/Community_*.md
```

The scan honors `.gitignore` and `.wikiignore` from the project root, plus built-in
ignores for generated folders such as `.gakrcli/wiki/`, `node_modules/`, `dist/`,
`build/`, `coverage/`, caches, and `graphify-out/`.

## `/wiki update [path]`

`/wiki update` calls `updateWikiKnowledge(cwd, target)` from
`src/services/wiki/knowledgeGraph.ts`.

It refreshes graph artifacts for an existing wiki and defaults to the current
project directory:

```text
/wiki update
/wiki update .
/wiki update src
/wiki update src/services/wiki/knowledgeGraph.ts
```

The command requires `.gakrcli/wiki/` and `graph/graph.json` to already exist and
fails with guidance to run `/wiki init` first when the graph has not been
initialized. This mirrors Graphify's `graphify update <path>` role as a no-LLM,
code-graph refresh after file changes.

The target path must stay inside the current project. The target is used as the
change scope: if manifest hashes for that path are unchanged, graph artifacts are
left untouched and the command reports that no graph changes were detected. If
the target changed, the saved scan root from `graph/manifest.json` is rebuilt so
the graph keeps representing the full initialized corpus rather than shrinking
to only the updated folder or file.

## `/wiki query <question>`

`/wiki query` calls `queryWikiKnowledge(cwd, question, options)` from
`src/services/wiki/query.ts`.

It loads `.gakrcli/wiki/graph/graph.json` and returns a compact, Graphify-style
subgraph instead of reading raw source files:

```text
/wiki query "starting point"
/wiki query "who calls updateWikiKnowledge" --context call
/wiki query "auth flow" --dfs --budget 3000
```

The query flow mirrors Graphify's CLI query path:

- split the natural-language question into searchable terms
- score graph nodes by exact, prefix, substring, and source-file matches
- down-weight common terms with IDF-style weighting
- pick the top one to three seed nodes
- traverse with BFS by default, or DFS with `--dfs`
- skip expanding high-degree hub nodes as transit
- render `NODE` and `EDGE` lines with source files, source locations,
  communities, relations, and confidence tags
- cap output with `--budget N` so results stay token friendly

Supported flags:

| Flag | Purpose |
| --- | --- |
| `--dfs` | Use DFS traversal for chain/path-style questions. |
| `--bfs` | Force BFS traversal. BFS is the default. |
| `--depth N` | Traversal depth, clamped from 1 to 6. |
| `--budget N` | Approximate output token budget. |
| `--context C` | Restrict traversal to a context/relation such as `call` or `import`. |

## `/wiki status`

`/wiki` and `/wiki status` call `getWikiStatus(cwd)` from
`src/services/wiki/status.ts`.

Status reports:

- wiki root path
- raw file count under `raw/`
- Markdown page count under `pages/`
- generated source-note count under `sources/`
- whether `schema.md`, `index.md`, and `log.md` are present
- whether graph artifacts are present
- graph node, edge, and community counts when `graph.json` exists
- last update timestamp across core wiki files
- graph freshness compared with the manifest; if codebase files changed, status
  tells the user to run `/wiki update`
- a reminder that `.wikiignore` can exclude noisy files from wiki graph knowledge

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
| `src/services/wiki/knowledgeGraph.test.ts` | Graph build, `.wikiignore`, target scans, forced rebuilds. |
| `src/services/wiki/status.test.ts` | Uninitialized state, raw/page/source/graph counts, timestamps. |
| `src/services/wiki/ingest.test.ts` | Source note generation, parseable log entries, rebuilt index. |
| `src/commands/wiki/wiki.test.ts` | `/wiki status` and `/wiki init` dispatch behavior. |
