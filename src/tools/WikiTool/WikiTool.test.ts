import { afterEach, expect, test } from 'bun:test'
import { mkdir, mkdtemp, rm, writeFile } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'
import { getAllBaseTools } from '../../tools.js'
import { runWithCwdOverride } from '../../utils/cwd.js'
import { WikiTool, WIKI_TOOL_NAME } from './WikiTool.js'

const tempDirs: string[] = []

afterEach(async () => {
  await Promise.all(
    tempDirs.splice(0).map(dir => rm(dir, { recursive: true, force: true })),
  )
})

async function makeGraphProject(): Promise<string> {
  const cwd = await mkdtemp(join(tmpdir(), 'gakrcli-wiki-tool-'))
  tempDirs.push(cwd)
  const graphDir = join(cwd, '.gakrcli', 'wiki', 'graph')
  await mkdir(graphDir, { recursive: true })
  await writeFile(
    join(graphDir, 'graph.json'),
    JSON.stringify({
      nodes: [
        { id: 'fn:main', label: 'main', source_file: 'src/main.ts', source_location: 'L1' },
        { id: 'fn:startServer', label: 'startServer', source_file: 'src/server.ts', source_location: 'L5' },
      ],
      links: [
        { source: 'fn:main', target: 'fn:startServer', relation: 'calls', confidence: 'EXTRACTED' },
      ],
    }),
    'utf8',
  )
  return cwd
}

test('WikiTool is bundled as an always-available base tool', () => {
  const tools = getAllBaseTools()

  expect(tools.some(tool => tool.name === WIKI_TOOL_NAME)).toBe(true)
})

test('WikiTool queries the current project wiki graph', async () => {
  const cwd = await makeGraphProject()

  const result = await runWithCwdOverride(cwd, () =>
    WikiTool.call(
      { query: 'main', budget: 500 },
      {} as never,
      undefined as never,
      undefined as never,
    ),
  )

  expect(result.data.mode).toBe('query')
  expect(result.data.request).toBe('main')
  expect(result.data.result).toContain('Wiki query: main')
  expect(result.data.result).toContain('NODE main')
  expect(result.data.result).toContain('EDGE main --calls [EXTRACTED]--> startServer')
})

test('WikiTool routes reserved search input through graph traversal', async () => {
  const cwd = await makeGraphProject()

  const result = await runWithCwdOverride(cwd, () =>
    WikiTool.call(
      { search: 'startServer', mode: 'dfs', budget: 500 },
      {} as never,
      undefined as never,
      undefined as never,
    ),
  )

  expect(result.data.mode).toBe('search')
  expect(result.data.request).toBe('startServer')
  expect(result.data.result).toContain('Traversal: DFS')
  expect(result.data.result).toContain('NODE startServer')
})

test('WikiTool validates that exactly one request field is provided', async () => {
  await expect(
    WikiTool.validateInput?.({ query: 'main', explain: 'main' }, {} as never),
  ).resolves.toEqual({
    result: false,
    message: 'Provide exactly one of query, search, or explain.',
    errorCode: 1,
  })
})

test('WikiTool maps graph output to model-facing tool_result text', () => {
  const block = WikiTool.mapToolResultToToolResultBlockParam(
    { mode: 'query', request: 'main', result: 'NODE main' },
    'tool-use-1',
  )

  expect(block).toEqual({
    tool_use_id: 'tool-use-1',
    type: 'tool_result',
    content: 'NODE main',
  })
})
