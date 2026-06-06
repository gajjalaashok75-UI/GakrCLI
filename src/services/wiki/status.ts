import { readdir, stat } from 'fs/promises'
import { getWikiPaths } from './paths.js'
import type { WikiStatus } from './types.js'

async function pathExists(path: string): Promise<boolean> {
  try {
    await stat(path)
    return true
  } catch {
    return false
  }
}

async function listMarkdownFiles(dir: string): Promise<string[]> {
  if (!(await pathExists(dir))) {
    return []
  }

  const entries = await readdir(dir, { withFileTypes: true })
  const files: string[] = []

  for (const entry of entries) {
    const fullPath = `${dir}/${entry.name}`
    if (entry.isDirectory()) {
      files.push(...(await listMarkdownFiles(fullPath)))
    } else if (entry.isFile() && entry.name.endsWith('.md')) {
      files.push(fullPath)
    }
  }

  return files
}

async function countFiles(dir: string): Promise<number> {
  if (!(await pathExists(dir))) {
    return 0
  }

  const entries = await readdir(dir, { withFileTypes: true })
  let count = 0

  for (const entry of entries) {
    const fullPath = `${dir}/${entry.name}`
    if (entry.isDirectory()) {
      count += await countFiles(fullPath)
    } else if (entry.isFile()) {
      count += 1
    }
  }

  return count
}

async function getLastUpdatedAt(pathsToCheck: string[]): Promise<string | null> {
  const mtimes: number[] = []

  for (const path of pathsToCheck) {
    try {
      const info = await stat(path)
      mtimes.push(info.mtimeMs)
    } catch {
      continue
    }
  }

  if (mtimes.length === 0) {
    return null
  }

  return new Date(Math.max(...mtimes)).toISOString()
}

export async function getWikiStatus(cwd: string): Promise<WikiStatus> {
  const paths = getWikiPaths(cwd)

  const [hasRoot, hasSchema, hasIndex, hasLog, rawSourceCount, pages, sources] =
    await Promise.all([
      pathExists(paths.root),
      pathExists(paths.schemaFile),
      pathExists(paths.indexFile),
      pathExists(paths.logFile),
      countFiles(paths.rawDir),
      listMarkdownFiles(paths.pagesDir),
      listMarkdownFiles(paths.sourcesDir),
    ])

  return {
    initialized: hasRoot && hasSchema && hasIndex && hasLog,
    root: paths.root,
    rawSourceCount,
    pageCount: pages.length,
    sourceCount: sources.length,
    hasSchema,
    hasIndex,
    hasLog,
    lastUpdatedAt: await getLastUpdatedAt([
      paths.schemaFile,
      paths.indexFile,
      paths.logFile,
      ...pages,
      ...sources,
    ]),
  }
}
