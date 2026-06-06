import { mkdir, writeFile } from 'fs/promises'
import { basename, relative } from 'path'
import { getWikiPaths } from './paths.js'
import type { WikiInitResult } from './types.js'

function buildSchemaTemplate(projectName: string): string {
  return `# GakrCLI Wiki Schema

This wiki stores durable, human-readable project knowledge for ${projectName}.
The wiki is a persistent LLM-maintained knowledge layer, not a one-time RAG
answer cache.

## Goals

- Keep useful project knowledge in markdown, not only in chat history
- Compile knowledge once and keep it current as new sources arrive
- Prefer synthesized, cross-linked facts over raw copy-paste
- Keep source attribution explicit
- Make pages easy for both humans and agents to update
- Preserve contradictions, stale claims, and open questions instead of hiding them

## Structure

- \`raw/\`: immutable curated inputs copied or dropped in by the user
- \`sources/\`: generated source notes and summaries created from raw/project files
- \`pages/\`: durable topic, entity, concept, comparison, and architecture pages
- \`index.md\`: content-oriented catalog of wiki pages and source notes
- \`log.md\`: append-only chronological update log with parseable headings
- \`schema.md\`: this operating contract for future wiki-maintenance sessions

## Page Rules

- Keep pages focused on one topic
- Use stable headings such as:
  - \`## Summary\`
  - \`## Key Facts\`
  - \`## Relationships\`
  - \`## Contradictions\`
  - \`## Open Questions\`
  - \`## Sources\`
- Add or update facts only when they are grounded in project files or explicit source notes
- Prefer editing an existing page over creating duplicates
- Link related pages with relative markdown links
- Keep source references visible enough that future answers can cite them

## Workflows

### Ingest

When a new source is added, read it, write or update a source note, update
relevant pages, refresh \`index.md\`, and append a dated \`ingest\` entry to
\`log.md\`. A single useful source may update many pages.

### Query

When answering a question, read \`index.md\` first, open relevant pages and
source notes, synthesize an answer with citations, and file durable discoveries
back into \`pages/\` when they should compound over time.

### Lint

Periodically check for stale claims, contradictions, orphan pages, missing
cross-references, missing concept/entity pages, and useful follow-up sources.
`
}

function buildIndexTemplate(projectName: string): string {
  return `# ${projectName} Wiki

This wiki is maintained by GakrCLI as a durable project knowledge layer.
Read this file first, then drill into the linked pages and source notes.

## Core Pages

- [Architecture](./pages/architecture.md) - High-level architecture notes and open questions.

## Sources

- Raw curated inputs live in [raw/](./raw/)
- Generated source notes live in [sources/](./sources/)

## Recent Updates

- See [log.md](./log.md)
`
}

function buildLogTemplate(timestamp: string): string {
  return `# Wiki Update Log

## [${timestamp}] init | Wiki initialized

- Created the initial GakrCLI wiki scaffold.
`
}

function buildArchitectureTemplate(projectName: string): string {
  return `# Architecture

## Summary

High-level architecture notes for ${projectName}.

## Key Facts

- This page is the starting point for durable architecture knowledge.

## Relationships

- Link this page to major subsystems as the wiki grows.

## Contradictions

- None recorded yet.

## Open Questions

- What are the most important runtime subsystems?
- Which files best represent the system architecture?

## Sources

- Wiki bootstrap
`
}

async function ensureFile(
  filePath: string,
  content: string,
  createdFiles: string[],
): Promise<void> {
  try {
    await writeFile(filePath, content, { encoding: 'utf8', flag: 'wx' })
    createdFiles.push(filePath)
  } catch (error: unknown) {
    if (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      error.code === 'EEXIST'
    ) {
      return
    }
    throw error
  }
}

export async function initializeWiki(cwd: string): Promise<WikiInitResult> {
  const paths = getWikiPaths(cwd)
  const createdDirectories: string[] = []
  const createdFiles: string[] = []

  for (const dir of [paths.root, paths.rawDir, paths.pagesDir, paths.sourcesDir]) {
    await mkdir(dir, { recursive: true })
    createdDirectories.push(dir)
  }

  const projectName = basename(cwd)
  const timestamp = new Date().toISOString()

  await ensureFile(paths.schemaFile, buildSchemaTemplate(projectName), createdFiles)
  await ensureFile(paths.indexFile, buildIndexTemplate(projectName), createdFiles)
  await ensureFile(paths.logFile, buildLogTemplate(timestamp), createdFiles)
  await ensureFile(
    `${paths.pagesDir}/architecture.md`,
    buildArchitectureTemplate(projectName),
    createdFiles,
  )

  return {
    root: paths.root,
    createdFiles: createdFiles.map(file => relative(cwd, file)),
    createdDirectories: createdDirectories.map(dir => relative(cwd, dir)),
    alreadyExisted: createdFiles.length === 0,
  }
}
