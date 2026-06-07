import { afterEach, expect, test } from 'bun:test'
import { mkdir, mkdtemp, rm, writeFile } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'
import { initializeWikiKnowledge } from './knowledgeGraph.js'
import { queryWikiKnowledge } from './query.js'

const tempDirs: string[] = []

afterEach(async () => {
  await Promise.all(
    tempDirs.splice(0).map(dir => rm(dir, { recursive: true, force: true })),
  )
})

async function makeProjectDir(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), 'gakrcli-wiki-query-'))
  tempDirs.push(dir)
  return dir
}

async function makeIndexedProject(): Promise<string> {
  const cwd = await makeProjectDir()
  await mkdir(join(cwd, 'src'), { recursive: true })
  await writeFile(
    join(cwd, 'src', 'main.ts'),
    "import { helper } from './helper'\n\nexport function main() {\n  return helper()\n}\n",
    'utf8',
  )
  await writeFile(
    join(cwd, 'src', 'helper.ts'),
    'export function helper() {\n  return 1\n}\n',
    'utf8',
  )
  await initializeWikiKnowledge(cwd)
  return cwd
}

async function makeGraphProject(graph: object): Promise<string> {
  const cwd = await makeProjectDir()
  const graphDir = join(cwd, '.gakrcli', 'wiki', 'graph')
  await mkdir(graphDir, { recursive: true })
  await writeFile(join(graphDir, 'graph.json'), JSON.stringify(graph), 'utf8')
  return cwd
}

test('queryWikiKnowledge returns a Graphify-style BFS subgraph', async () => {
  const cwd = await makeIndexedProject()

  const result = await queryWikiKnowledge(cwd, 'main')

  expect(result).toContain('Wiki query: main')
  expect(result).toContain('Traversal: BFS depth=2')
  expect(result).toContain('NODE main')
  expect(result).toContain('src=src/main.ts')
})

test('queryWikiKnowledge strips punctuation from query terms', async () => {
  const cwd = await makeIndexedProject()

  const result = await queryWikiKnowledge(cwd, 'main()?')

  expect(result).toContain('NODE main')
})

test('queryWikiKnowledge supports explicit DFS and context filters', async () => {
  const cwd = await makeIndexedProject()

  const result = await queryWikiKnowledge(cwd, 'who calls main', {
    mode: 'dfs',
    contextFilters: ['call'],
    depth: 3,
  })

  expect(result).toContain('Traversal: DFS depth=3')
  expect(result).toContain('Context: call (explicit)')
})

test('queryWikiKnowledge answers caller questions with incoming call edges', async () => {
  const cwd = await makeGraphProject({
    nodes: [
      { id: 'fn:updateWikiKnowledge', label: 'updateWikiKnowledge', source_file: 'src/services/wiki/knowledgeGraph.ts' },
      { id: 'fn:caller', label: 'target', source_file: 'src/commands/wiki/wiki.tsx' },
      { id: 'term:calls', label: 'calls', source_file: 'docs/notes.md' },
    ],
    links: [
      { source: 'fn:caller', target: 'fn:updateWikiKnowledge', relation: 'calls', confidence: 'EXTRACTED' },
      { source: 'term:calls', target: 'fn:caller', relation: 'mentions', confidence: 'EXTRACTED' },
    ],
  })

  const result = await queryWikiKnowledge(cwd, 'who calls updateWikiKnowledge', {
    contextFilters: ['call'],
  })

  expect(result).toContain('Start: ["updateWikiKnowledge"]')
  expect(result).toContain('Direction: incoming')
  expect(result).toContain('NODE target')
  expect(result).toContain('EDGE target --calls [EXTRACTED]--> updateWikiKnowledge')
})

test('queryWikiKnowledge prefers connected source matches over isolated short exact matches', async () => {
  const cwd = await makeGraphProject({
    nodes: [
      { id: 'doc:auth', label: 'Auth', source_file: 'docs/auth.md' },
      { id: 'file:src/utils/auth.ts', label: 'src/utils/auth.ts', source_file: 'src/utils/auth.ts' },
      { id: 'fn:getAuthToken', label: 'getAuthToken', source_file: 'src/utils/auth.ts' },
    ],
    links: [
      { source: 'file:src/utils/auth.ts', target: 'fn:getAuthToken', relation: 'contains', confidence: 'EXTRACTED' },
    ],
  })

  const result = await queryWikiKnowledge(cwd, 'auth flow')

  expect(result).toContain('Start: ["src/utils/auth.ts"')
  expect(result).toContain('NODE getAuthToken')
})

test('queryWikiKnowledge expands starting point questions to entrypoint terms', async () => {
  const cwd = await makeGraphProject({
    nodes: [
      { id: 'type:Point', label: 'Point', source_file: 'src/geometry.ts' },
      { id: 'fn:main', label: 'main', source_file: 'src/main.ts' },
      { id: 'file:src/main.ts', label: 'src/main.ts', source_file: 'src/main.ts' },
    ],
    links: [
      { source: 'fn:main', target: 'file:src/main.ts', relation: 'defined_in', confidence: 'EXTRACTED' },
    ],
  })

  const result = await queryWikiKnowledge(cwd, 'starting point')

  expect(result).toContain('Start: [')
  expect(result).toContain('"main"')
  expect(result).toContain('NODE src/main.ts')
})

test('queryWikiKnowledge reports no matches', async () => {
  const cwd = await makeIndexedProject()

  const result = await queryWikiKnowledge(cwd, 'DefinitelyMissingSymbol')

  expect(result).toBe('No matching nodes found for query: DefinitelyMissingSymbol')
})

test('queryWikiKnowledge requires an initialized wiki graph', async () => {
  const cwd = await makeProjectDir()

  await expect(queryWikiKnowledge(cwd, 'main')).rejects.toThrow('Wiki graph is missing')
})
