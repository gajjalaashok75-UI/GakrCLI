import { afterEach, expect, test } from 'bun:test'
import { mkdir, mkdtemp, rm, writeFile } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'
import { initializeWiki } from './init.js'
import { initializeWikiKnowledge } from './knowledgeGraph.js'
import { getWikiPaths } from './paths.js'
import { getWikiStatus } from './status.js'

const tempDirs: string[] = []

afterEach(async () => {
  await Promise.all(
    tempDirs.splice(0).map(dir => rm(dir, { recursive: true, force: true })),
  )
})

async function makeProjectDir(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), 'gakrcli-wiki-status-'))
  tempDirs.push(dir)
  return dir
}

test('getWikiStatus reports uninitialized wiki state', async () => {
  const cwd = await makeProjectDir()
  const status = await getWikiStatus(cwd)

  expect(status.initialized).toBe(false)
  expect(status.rawSourceCount).toBe(0)
  expect(status.pageCount).toBe(0)
  expect(status.sourceCount).toBe(0)
  expect(status.graphInitialized).toBe(false)
  expect(status.graphNodeCount).toBeNull()
  expect(status.graphEdgeCount).toBeNull()
  expect(status.graphCommunityCount).toBeNull()
  expect(status.hasGraphReport).toBe(false)
  expect(status.hasGraphHtml).toBe(false)
  expect(status.hasGraphWikiIndex).toBe(false)
  expect(status.hasSchema).toBe(false)
  expect(status.hasIndex).toBe(false)
  expect(status.hasLog).toBe(false)
  expect(status.graphFreshness).toBe('unknown')
  expect(status.graphFreshnessMessage).toBeNull()
})

test('getWikiStatus counts pages and sources for initialized wiki', async () => {
  const cwd = await makeProjectDir()
  await initializeWiki(cwd)
  const paths = getWikiPaths(cwd)

  await mkdir(join(paths.rawDir, 'articles'), { recursive: true })
  await writeFile(join(paths.rawDir, 'articles', 'source.txt'), 'Raw source\n', 'utf8')
  await writeFile(join(paths.pagesDir, 'runtime.md'), '# Runtime\n', 'utf8')
  await writeFile(join(paths.sourcesDir, 'notes.md'), '# Notes\n', 'utf8')
  await mkdir(paths.graphWikiDir, { recursive: true })
  await writeFile(
    paths.graphJsonFile,
    JSON.stringify({
      nodes: [{ id: 'a', community: 0 }, { id: 'b', community: 1 }],
      links: [{ source: 'a', target: 'b' }],
    }),
    'utf8',
  )
  await writeFile(paths.graphReportFile, '# Report\n', 'utf8')
  await writeFile(paths.graphHtmlFile, '<html></html>\n', 'utf8')
  await writeFile(paths.graphWikiIndexFile, '# Graph Wiki\n', 'utf8')

  const status = await getWikiStatus(cwd)

  expect(status.initialized).toBe(true)
  expect(status.rawSourceCount).toBe(1)
  expect(status.pageCount).toBe(2)
  expect(status.sourceCount).toBe(1)
  expect(status.graphInitialized).toBe(true)
  expect(status.graphNodeCount).toBe(2)
  expect(status.graphEdgeCount).toBe(1)
  expect(status.graphCommunityCount).toBe(2)
  expect(status.hasGraphReport).toBe(true)
  expect(status.hasGraphHtml).toBe(true)
  expect(status.hasGraphWikiIndex).toBe(true)
  expect(status.hasSchema).toBe(true)
  expect(status.hasIndex).toBe(true)
  expect(status.hasLog).toBe(true)
  expect(status.lastUpdatedAt).not.toBeNull()
  expect(status.graphFreshness).toBe('unknown')
  expect(status.graphFreshnessMessage).toBeNull()
})

test('getWikiStatus reports stale graph freshness when indexed files change', async () => {
  const cwd = await makeProjectDir()
  await mkdir(join(cwd, 'src'), { recursive: true })
  await writeFile(join(cwd, 'src', 'main.ts'), 'export function main() {}\n', 'utf8')

  await initializeWikiKnowledge(cwd)
  const fresh = await getWikiStatus(cwd)

  expect(fresh.graphFreshness).toBe('up_to_date')
  expect(fresh.graphFreshnessMessage).toContain('up to date')

  await writeFile(
    join(cwd, 'src', 'main.ts'),
    'export function changedMain() { return 1 }\n',
    'utf8',
  )
  const stale = await getWikiStatus(cwd)

  expect(stale.graphFreshness).toBe('stale')
  expect(stale.graphFreshnessMessage).toContain('Codebase files have changes')
  expect(stale.graphFreshnessMessage).toContain('Run /wiki update')
})
