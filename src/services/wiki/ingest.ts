import { appendFile, lstat, readFile, realpath, stat, writeFile } from 'fs/promises'
import { basename, extname, isAbsolute, relative, resolve } from 'path'
import { initializeWiki } from './init.js'
import { rebuildWikiIndex } from './indexBuilder.js'
import { getWikiPaths } from './paths.js'
import type { WikiIngestResult } from './types.js'
import {
  extractTitleFromText,
  sanitizeWikiSlug,
  summarizeText,
} from './utils.js'

function buildSourceNote(params: {
  title: string
  sourcePath: string
  ingestedAt: string
  summary: string
  excerpt: string
}): string {
  const { title, sourcePath, ingestedAt, summary, excerpt } = params

  return `# ${title}

## Source

- Path: \`${sourcePath}\`
- Ingested at: ${ingestedAt}

## Summary

${summary}

## Excerpt

\`\`\`
${excerpt}
\`\`\`

## Linked Pages

- [Architecture](../pages/architecture.md)
`
}

function buildLogEntry(sourcePath: string, title: string, ingestedAt: string): string {
  return `- ${ingestedAt}: Ingested \`${sourcePath}\` into source note "${title}"`
}

async function resolveContainedSourcePath(cwd: string, rawPath: string): Promise<string> {
  const candidatePath = isAbsolute(rawPath) ? rawPath : resolve(cwd, rawPath)
  const [canonicalCwd, canonicalSource] = await Promise.all([
    realpath(cwd),
    realpath(candidatePath),
  ])
  const relativePath = relative(canonicalCwd, canonicalSource)

  if (relativePath.startsWith('..') || isAbsolute(relativePath)) {
    throw new Error('Wiki ingest only supports files inside the current project.')
  }

  const sourceInfo = await lstat(canonicalSource)
  if (sourceInfo.isSymbolicLink()) {
    throw new Error('Wiki ingest does not support symbolic links.')
  }

  return canonicalSource
}

export async function ingestLocalWikiSource(
  cwd: string,
  rawPath: string,
): Promise<WikiIngestResult> {
  await initializeWiki(cwd)

  const resolvedPath = await resolveContainedSourcePath(cwd, rawPath)

  const fileInfo = await stat(resolvedPath)
  if (!fileInfo.isFile()) {
    throw new Error(`Not a file: ${resolvedPath}`)
  }

  const content = await readFile(resolvedPath, 'utf8')
  const relSourcePath = relative(cwd, resolvedPath).replace(/\\/g, '/')
  const ingestedAt = new Date().toISOString()
  const baseName = basename(resolvedPath, extname(resolvedPath))
  const title = extractTitleFromText(baseName, content)
  const summary = summarizeText(content)
  const excerpt = content.split('\n').slice(0, 20).join('\n').trim()
  const slug = sanitizeWikiSlug(`${baseName}-${Date.now()}`) || `source-${Date.now()}`

  const paths = getWikiPaths(cwd)
  const sourceNotePath = `${paths.sourcesDir}/${slug}.md`

  await writeFile(
    sourceNotePath,
    buildSourceNote({
      title,
      sourcePath: relSourcePath,
      ingestedAt,
      summary,
      excerpt,
    }),
    'utf8',
  )
  await appendFile(paths.logFile, `${buildLogEntry(relSourcePath, title, ingestedAt)}\n`, 'utf8')
  await rebuildWikiIndex(cwd)

  return {
    sourceFile: relSourcePath,
    sourceNote: relative(cwd, sourceNotePath).replace(/\\/g, '/'),
    summary,
    title,
  }
}
