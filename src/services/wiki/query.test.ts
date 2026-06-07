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

test('queryWikiKnowledge reports no matches', async () => {
  const cwd = await makeIndexedProject()

  const result = await queryWikiKnowledge(cwd, 'DefinitelyMissingSymbol')

  expect(result).toBe('No matching nodes found for query: DefinitelyMissingSymbol')
})

test('queryWikiKnowledge requires an initialized wiki graph', async () => {
  const cwd = await makeProjectDir()

  await expect(queryWikiKnowledge(cwd, 'main')).rejects.toThrow('Wiki graph is missing')
})
