import { readdir, readFile, stat } from 'fs/promises'
import { checkWikiKnowledgeFreshness } from './knowledgeGraph.js'
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

async function readGraphCounts(path: string): Promise<{
  nodeCount: number | null
  edgeCount: number | null
  communityCount: number | null
}> {
  try {
    const graph = JSON.parse(await readFile(path, 'utf8')) as {
      nodes?: Array<{ community?: unknown }>
      links?: unknown[]
    }
    const communities = new Set(
      (graph.nodes ?? [])
        .map(node => node.community)
        .filter(community => community !== undefined),
    )

    return {
      nodeCount: Array.isArray(graph.nodes) ? graph.nodes.length : null,
      edgeCount: Array.isArray(graph.links) ? graph.links.length : null,
      communityCount: communities.size > 0 ? communities.size : null,
    }
  } catch {
    return {
      nodeCount: null,
      edgeCount: null,
      communityCount: null,
    }
  }
}

export async function getWikiStatus(cwd: string): Promise<WikiStatus> {
  const paths = getWikiPaths(cwd)

  const [
    hasRoot,
    hasSchema,
    hasIndex,
    hasLog,
    hasGraphJson,
    hasGraphReport,
    hasGraphHtml,
    hasGraphWikiIndex,
    graphCounts,
    rawSourceCount,
    pages,
    sources,
  ] =
    await Promise.all([
      pathExists(paths.root),
      pathExists(paths.schemaFile),
      pathExists(paths.indexFile),
      pathExists(paths.logFile),
      pathExists(paths.graphJsonFile),
      pathExists(paths.graphReportFile),
      pathExists(paths.graphHtmlFile),
      pathExists(paths.graphWikiIndexFile),
      readGraphCounts(paths.graphJsonFile),
      countFiles(paths.rawDir),
      listMarkdownFiles(paths.pagesDir),
      listMarkdownFiles(paths.sourcesDir),
    ])
  const freshness = hasGraphJson ? await checkWikiKnowledgeFreshness(cwd) : null
  const changedCount = freshness
    ? freshness.addedFiles + freshness.modifiedFiles + freshness.deletedFiles
    : 0
  const graphFreshness = !freshness?.checked
    ? 'unknown'
    : freshness.changed
      ? 'stale'
      : 'up_to_date'
  const graphFreshnessMessage = !freshness?.checked
    ? null
    : freshness.changed
      ? `Codebase files have changes (${changedCount}: ${freshness.addedFiles} added, ${freshness.modifiedFiles} modified, ${freshness.deletedFiles} deleted). Run /wiki update to update the wiki.`
      : 'Wiki graph is up to date with the indexed codebase files.'

  return {
    initialized: hasRoot && hasSchema && hasIndex && hasLog,
    root: paths.root,
    rawSourceCount,
    pageCount: pages.length,
    sourceCount: sources.length,
    graphInitialized: hasGraphJson,
    graphNodeCount: graphCounts.nodeCount,
    graphEdgeCount: graphCounts.edgeCount,
    graphCommunityCount: graphCounts.communityCount,
    hasGraphReport,
    hasGraphHtml,
    hasGraphWikiIndex,
    hasSchema,
    hasIndex,
    hasLog,
    lastUpdatedAt: await getLastUpdatedAt([
      paths.schemaFile,
      paths.indexFile,
      paths.logFile,
      paths.graphJsonFile,
      paths.graphReportFile,
      paths.graphHtmlFile,
      paths.graphWikiIndexFile,
      ...pages,
      ...sources,
    ]),
    graphFreshness,
    graphFreshnessMessage,
  }
}
