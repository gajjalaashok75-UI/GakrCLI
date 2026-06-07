import { afterEach, expect, test } from 'bun:test'
import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'
import { initializeWikiKnowledge, updateWikiKnowledge } from './knowledgeGraph.js'
import { getWikiPaths } from './paths.js'

const tempDirs: string[] = []

afterEach(async () => {
  await Promise.all(
    tempDirs.splice(0).map(dir => rm(dir, { recursive: true, force: true })),
  )
})

async function makeProjectDir(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), 'gakrcli-wiki-graph-'))
  tempDirs.push(dir)
  return dir
}

async function readGraph(cwd: string): Promise<{
  nodes: Array<{ id: string; label: string; source_file: string; file_type?: string }>
  links: Array<{ source: string; target: string; relation: string }>
}> {
  return JSON.parse(await readFile(getWikiPaths(cwd).graphJsonFile, 'utf8'))
}

test('initializeWikiKnowledge builds graph artifacts from project files', async () => {
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
  await writeFile(join(cwd, 'README.md'), '# Project Notes\n\nArchitecture overview.\n', 'utf8')

  const result = await initializeWikiKnowledge(cwd)
  const paths = getWikiPaths(cwd)
  const graph = await readGraph(cwd)

  expect(result.indexedFiles).toBeGreaterThanOrEqual(3)
  expect(result.nodeCount).toBeGreaterThanOrEqual(5)
  expect(result.edgeCount).toBeGreaterThanOrEqual(3)
  expect(result.graphFiles).toContain('.gakrcli/wiki/graph/graph.json')
  expect(await readFile(paths.graphReportFile, 'utf8')).toContain('## God Nodes')
  expect(await readFile(paths.graphWikiIndexFile, 'utf8')).toContain('# Knowledge Graph Index')
  expect(await readFile(paths.graphHtmlFile, 'utf8')).toContain('GakrCLI Wiki Graph')
  expect(graph.nodes.some(node => node.label === 'main')).toBe(true)
  expect(graph.nodes.some(node => node.label === 'helper')).toBe(true)
  expect(graph.nodes.some(node => node.label === 'Project Notes')).toBe(true)
  expect(graph.links.some(link => link.relation === 'imports_from')).toBe(true)
})

test('initializeWikiKnowledge respects .wikiignore and default ignored folders', async () => {
  const cwd = await makeProjectDir()
  await mkdir(join(cwd, 'src'), { recursive: true })
  await mkdir(join(cwd, 'ignored'), { recursive: true })
  await mkdir(join(cwd, 'node_modules', 'package'), { recursive: true })
  await writeFile(join(cwd, '.wikiignore'), 'ignored/\n', 'utf8')
  await writeFile(join(cwd, 'src', 'visible.ts'), 'export function visible() {}\n', 'utf8')
  await writeFile(join(cwd, 'ignored', 'hidden.ts'), 'export function hidden() {}\n', 'utf8')
  await writeFile(
    join(cwd, 'node_modules', 'package', 'dependency.ts'),
    'export function dependency() {}\n',
    'utf8',
  )

  await initializeWikiKnowledge(cwd)
  const graph = await readGraph(cwd)
  const sources = graph.nodes.map(node => node.source_file)

  expect(sources.some(source => source === 'src/visible.ts')).toBe(true)
  expect(sources.some(source => source.includes('ignored/hidden.ts'))).toBe(false)
  expect(sources.some(source => source.includes('node_modules/'))).toBe(false)
})

test('initializeWikiKnowledge skips unsupported noise files like Graphify collect_files', async () => {
  const cwd = await makeProjectDir()
  await mkdir(join(cwd, 'src'), { recursive: true })
  await mkdir(join(cwd, 'worked', 'demo'), { recursive: true })
  await writeFile(join(cwd, 'src', 'visible.ts'), 'export function visible() {}\n', 'utf8')
  await writeFile(join(cwd, '.dockerignore'), 'node_modules\n', 'utf8')
  await writeFile(join(cwd, 'Dockerfile'), 'FROM node:22\n', 'utf8')
  await writeFile(join(cwd, 'logo.svg'), '<svg />\n', 'utf8')
  await writeFile(join(cwd, 'worked', 'demo', 'graph.json'), '{"nodes":[],"links":[]}\n', 'utf8')
  await writeFile(join(cwd, 'worked', 'demo', 'manifest.json'), '{}\n', 'utf8')
  await writeFile(join(cwd, 'worked', 'demo', 'graph.html'), '<html></html>\n', 'utf8')

  await initializeWikiKnowledge(cwd)
  const graph = await readGraph(cwd)
  const sources = graph.nodes.map(node => node.source_file)

  expect(sources.some(source => source === 'src/visible.ts')).toBe(true)
  expect(sources.some(source => source === '.dockerignore')).toBe(false)
  expect(sources.some(source => source === 'Dockerfile')).toBe(false)
  expect(sources.some(source => source === 'logo.svg')).toBe(false)
  expect(sources.some(source => source.startsWith('worked/demo/'))).toBe(false)
})

test('initializeWikiKnowledge can scan a target folder with project-root ignores', async () => {
  const cwd = await makeProjectDir()
  await mkdir(join(cwd, 'src', 'feature'), { recursive: true })
  await mkdir(join(cwd, 'src', 'skip'), { recursive: true })
  await writeFile(join(cwd, '.wikiignore'), 'src/skip/\n', 'utf8')
  await writeFile(
    join(cwd, 'src', 'feature', 'entry.ts'),
    'export class FeatureEntry {}\n',
    'utf8',
  )
  await writeFile(join(cwd, 'src', 'skip', 'ignored.ts'), 'export class Ignored {}\n', 'utf8')
  await writeFile(join(cwd, 'outside.ts'), 'export class Outside {}\n', 'utf8')

  await initializeWikiKnowledge(cwd, 'src')
  const graph = await readGraph(cwd)
  const sources = graph.nodes.map(node => node.source_file)

  expect(sources.some(source => source === 'src/feature/entry.ts')).toBe(true)
  expect(sources.some(source => source === 'outside.ts')).toBe(false)
  expect(sources.some(source => source === 'src/skip/ignored.ts')).toBe(false)
})

test('initializeWikiKnowledge deduplicates repeated call and import edges', async () => {
  const cwd = await makeProjectDir()
  await mkdir(join(cwd, 'src'), { recursive: true })
  await writeFile(
    join(cwd, 'src', 'main.ts'),
    "import { helper } from './helper'\nimport { helper as helperAgain } from './helper'\n\nexport function main() {\n  helper()\n  helper()\n  helperAgain()\n}\n",
    'utf8',
  )
  await writeFile(join(cwd, 'src', 'helper.ts'), 'export function helper() {}\n', 'utf8')

  await initializeWikiKnowledge(cwd)
  const graph = await readGraph(cwd)
  const keys = graph.links.map(link => `${link.source}|${link.target}|${link.relation}`)

  expect(new Set(keys).size).toBe(keys.length)
})

test('initializeWikiKnowledge emits Graphify-style rationale and class relation edges', async () => {
  const cwd = await makeProjectDir()
  await mkdir(join(cwd, 'src'), { recursive: true })
  await writeFile(
    join(cwd, 'src', 'models.py'),
    'class Base:\n    pass\n\n# Coordinates orchestration for the app.\nclass App(Base):\n    """Keep startup logic close to the model."""\n    def run(self):\n        return None\n',
    'utf8',
  )

  await initializeWikiKnowledge(cwd)
  const graph = await readGraph(cwd)

  expect(graph.links.some(link => link.relation === 'method')).toBe(true)
  expect(graph.links.some(link => link.relation === 'inherits')).toBe(true)
  expect(graph.links.some(link => link.relation === 'rationale_for')).toBe(true)
  expect(graph.nodes.some(node => node.file_type === 'rationale')).toBe(true)
})

test('initializeWikiKnowledge emits local import, implements, and re-export edges', async () => {
  const cwd = await makeProjectDir()
  await mkdir(join(cwd, 'src'), { recursive: true })
  await writeFile(
    join(cwd, 'src', 'contracts.ts'),
    'export interface Runnable {\n  run(): void\n}\n',
    'utf8',
  )
  await writeFile(
    join(cwd, 'src', 'worker.ts'),
    "import { Runnable } from './contracts'\n\nexport class Worker implements Runnable {\n  delegate?: Runnable\n  run() {}\n}\n",
    'utf8',
  )
  await writeFile(join(cwd, 'src', 'index.ts'), "export { Worker } from './worker'\n", 'utf8')

  await initializeWikiKnowledge(cwd)
  const graph = await readGraph(cwd)

  expect(graph.links.some(link => link.relation === 'imports_from')).toBe(true)
  expect(graph.links.some(link => link.relation === 'imports')).toBe(true)
  expect(graph.links.some(link => link.relation === 'implements')).toBe(true)
  expect(graph.links.some(link => link.relation === 're_exports')).toBe(true)
  expect(graph.links.some(link => link.relation === 'uses')).toBe(true)
})

test('initializeWikiKnowledge force-rebuilds graph artifacts on repeated init', async () => {
  const cwd = await makeProjectDir()
  await mkdir(join(cwd, 'src'), { recursive: true })
  await writeFile(join(cwd, 'src', 'main.ts'), 'export function oldName() {}\n', 'utf8')

  await initializeWikiKnowledge(cwd)
  await writeFile(join(cwd, 'src', 'main.ts'), 'export function newName() {}\n', 'utf8')
  const second = await initializeWikiKnowledge(cwd)
  const graph = await readGraph(cwd)

  expect(second.alreadyExisted).toBe(true)
  expect(graph.nodes.some(node => node.label === 'newName')).toBe(true)
  expect(graph.nodes.some(node => node.label === 'oldName')).toBe(false)
})

test('updateWikiKnowledge refreshes an initialized wiki graph for current directory', async () => {
  const cwd = await makeProjectDir()
  await mkdir(join(cwd, 'src'), { recursive: true })
  await writeFile(join(cwd, 'src', 'main.ts'), 'export function oldName() {}\n', 'utf8')

  await initializeWikiKnowledge(cwd)
  await writeFile(join(cwd, 'src', 'main.ts'), 'export function newName() {}\n', 'utf8')
  const result = await updateWikiKnowledge(cwd, '.')
  const graph = await readGraph(cwd)

  expect(result.updatedTarget).toBe('.')
  expect(result.changed).toBe(true)
  expect(result.alreadyExisted).toBe(true)
  expect(graph.nodes.some(node => node.label === 'newName')).toBe(true)
  expect(graph.nodes.some(node => node.label === 'oldName')).toBe(false)
})

test('updateWikiKnowledge uses target path as change scope while preserving graph corpus', async () => {
  const cwd = await makeProjectDir()
  await mkdir(join(cwd, 'src', 'feature'), { recursive: true })
  await writeFile(join(cwd, 'src', 'feature', 'entry.ts'), 'export function entry() {}\n', 'utf8')
  await writeFile(join(cwd, 'outside.ts'), 'export function outside() {}\n', 'utf8')

  await initializeWikiKnowledge(cwd)
  await writeFile(join(cwd, 'src', 'feature', 'entry.ts'), 'export function changedEntry() {}\n', 'utf8')
  const result = await updateWikiKnowledge(cwd, 'src/feature')
  const graph = await readGraph(cwd)
  const sources = graph.nodes.map(node => node.source_file)

  expect(result.updatedTarget).toBe('src/feature')
  expect(result.changed).toBe(true)
  expect(sources.some(source => source === 'src/feature/entry.ts')).toBe(true)
  expect(sources.some(source => source === 'outside.ts')).toBe(true)
  expect(graph.nodes.some(node => node.label === 'changedEntry')).toBe(true)
})

test('updateWikiKnowledge leaves graph artifacts untouched when target has no changes', async () => {
  const cwd = await makeProjectDir()
  await mkdir(join(cwd, 'src'), { recursive: true })
  await writeFile(join(cwd, 'src', 'main.ts'), 'export function main() {}\n', 'utf8')

  await initializeWikiKnowledge(cwd)
  const paths = getWikiPaths(cwd)
  const before = await stat(paths.graphJsonFile)
  const result = await updateWikiKnowledge(cwd, '.')
  const after = await stat(paths.graphJsonFile)

  expect(result.changed).toBe(false)
  expect(after.mtimeMs).toBe(before.mtimeMs)
})

test('updateWikiKnowledge ignores changes outside the requested target', async () => {
  const cwd = await makeProjectDir()
  await mkdir(join(cwd, 'src', 'feature'), { recursive: true })
  await writeFile(join(cwd, 'src', 'feature', 'entry.ts'), 'export function entry() {}\n', 'utf8')
  await writeFile(join(cwd, 'outside.ts'), 'export function outside() {}\n', 'utf8')

  await initializeWikiKnowledge(cwd)
  const paths = getWikiPaths(cwd)
  const before = await stat(paths.graphJsonFile)
  await writeFile(join(cwd, 'outside.ts'), 'export function changedOutside() {}\n', 'utf8')
  const result = await updateWikiKnowledge(cwd, 'src/feature')
  const after = await stat(paths.graphJsonFile)
  const graph = await readGraph(cwd)

  expect(result.changed).toBe(false)
  expect(after.mtimeMs).toBe(before.mtimeMs)
  expect(graph.nodes.some(node => node.label === 'outside')).toBe(true)
  expect(graph.nodes.some(node => node.label === 'changedOutside')).toBe(false)
})

test('updateWikiKnowledge detects deleted files inside the requested target', async () => {
  const cwd = await makeProjectDir()
  await mkdir(join(cwd, 'src'), { recursive: true })
  await writeFile(join(cwd, 'src', 'keep.ts'), 'export function keep() {}\n', 'utf8')
  await writeFile(join(cwd, 'src', 'remove.ts'), 'export function removeMe() {}\n', 'utf8')

  await initializeWikiKnowledge(cwd)
  await rm(join(cwd, 'src', 'remove.ts'))
  const result = await updateWikiKnowledge(cwd, 'src')
  const graph = await readGraph(cwd)

  expect(result.changed).toBe(true)
  expect(graph.nodes.some(node => node.label === 'keep')).toBe(true)
  expect(graph.nodes.some(node => node.label === 'removeMe')).toBe(false)
})

test('updateWikiKnowledge requires an initialized wiki', async () => {
  const cwd = await makeProjectDir()
  await writeFile(join(cwd, 'main.ts'), 'export function main() {}\n', 'utf8')

  await expect(updateWikiKnowledge(cwd)).rejects.toThrow('Wiki is not initialized')
})

test('initializeWikiKnowledge splits oversized communities for navigation', async () => {
  const cwd = await makeProjectDir()
  await mkdir(join(cwd, 'src', 'wide'), { recursive: true })

  for (let index = 0; index < 120; index += 1) {
    await writeFile(
      join(cwd, 'src', 'wide', `module-${index}.ts`),
      `export function feature${index}() { return ${index} }\n`,
      'utf8',
    )
  }

  const result = await initializeWikiKnowledge(cwd)

  expect(result.communityCount).toBeGreaterThan(1)
  expect(result.communityCount).toBeGreaterThanOrEqual(3)
})
