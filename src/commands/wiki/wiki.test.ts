import { expect, mock, test } from 'bun:test'
import { mkdir, mkdtemp, rm, writeFile } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'
import { runWithCwdOverride } from '../../utils/cwd.js'
import { call } from './wiki.js'

test('/wiki status dispatches to status instead of generic help', async () => {
  const cwd = await mkdtemp(join(tmpdir(), 'gakrcli-wiki-command-'))
  const onDone = mock(() => {})

  try {
    await runWithCwdOverride(cwd, () => call(onDone as never, {} as never, 'status'))

    expect(onDone).toHaveBeenCalledWith(
      expect.stringContaining('GakrCLI wiki is not initialized in this project.'),
      { display: 'system' },
    )
  } finally {
    await rm(cwd, { recursive: true, force: true })
  }
})

test('/wiki init builds the graph knowledge base', async () => {
  const cwd = await mkdtemp(join(tmpdir(), 'gakrcli-wiki-command-'))
  const onDone = mock(() => {})

  try {
    await mkdir(join(cwd, 'src'), { recursive: true })
    await writeFile(join(cwd, 'src', 'main.ts'), 'export function main() {}\n', 'utf8')

    await runWithCwdOverride(cwd, () => call(onDone as never, {} as never, 'init'))

    expect(onDone).toHaveBeenCalledWith(
      expect.stringContaining('Graph nodes:'),
      { display: 'system' },
    )
    expect(onDone).toHaveBeenCalledWith(
      expect.stringContaining('.gakrcli/wiki/graph/graph.json'),
      { display: 'system' },
    )
  } finally {
    await rm(cwd, { recursive: true, force: true })
  }
})

test('/wiki init reports already initialized unless forced', async () => {
  const cwd = await mkdtemp(join(tmpdir(), 'gakrcli-wiki-command-'))
  const onDone = mock(() => {})

  try {
    await mkdir(join(cwd, 'src'), { recursive: true })
    await writeFile(join(cwd, 'src', 'main.ts'), 'export function main() {}\n', 'utf8')

    await runWithCwdOverride(cwd, () => call(onDone as never, {} as never, 'init'))
    await runWithCwdOverride(cwd, () => call(onDone as never, {} as never, 'init'))

    expect(onDone).toHaveBeenCalledWith(
      expect.stringContaining('GakrCLI wiki is already initialized'),
      { display: 'system' },
    )
    expect(onDone).toHaveBeenCalledWith(
      expect.stringContaining('/wiki init --force'),
      { display: 'system' },
    )
  } finally {
    await rm(cwd, { recursive: true, force: true })
  }
})

test('/wiki init --force rebuilds an existing graph knowledge base', async () => {
  const cwd = await mkdtemp(join(tmpdir(), 'gakrcli-wiki-command-'))
  const onDone = mock(() => {})

  try {
    await mkdir(join(cwd, 'src'), { recursive: true })
    await writeFile(join(cwd, 'src', 'main.ts'), 'export function main() {}\n', 'utf8')

    await runWithCwdOverride(cwd, () => call(onDone as never, {} as never, 'init'))
    await writeFile(join(cwd, 'src', 'main.ts'), 'export function forcedMain() {}\n', 'utf8')
    await runWithCwdOverride(cwd, () => call(onDone as never, {} as never, 'init --force'))

    expect(onDone).toHaveBeenCalledWith(
      expect.stringContaining('Wiki scaffold already existed. Graph artifacts were rebuilt.'),
      { display: 'system' },
    )
  } finally {
    await rm(cwd, { recursive: true, force: true })
  }
})

test('/wiki update refreshes an existing graph knowledge base', async () => {
  const cwd = await mkdtemp(join(tmpdir(), 'gakrcli-wiki-command-'))
  const onDone = mock(() => {})

  try {
    await mkdir(join(cwd, 'src'), { recursive: true })
    await writeFile(join(cwd, 'src', 'main.ts'), 'export function main() {}\n', 'utf8')

    await runWithCwdOverride(cwd, () => call(onDone as never, {} as never, 'init'))
    await writeFile(join(cwd, 'src', 'main.ts'), 'export function updatedMain() {}\n', 'utf8')
    await runWithCwdOverride(cwd, () => call(onDone as never, {} as never, 'update .'))

    expect(onDone).toHaveBeenCalledWith(
      expect.stringContaining('Updated GakrCLI wiki graph'),
      { display: 'system' },
    )
    expect(onDone).toHaveBeenCalledWith(
      expect.stringContaining('Target: .'),
      { display: 'system' },
    )
    expect(onDone).toHaveBeenCalledWith(
      expect.stringContaining('Changed: yes'),
      { display: 'system' },
    )
  } finally {
    await rm(cwd, { recursive: true, force: true })
  }
})

test('/wiki update reports when no graph changes are detected', async () => {
  const cwd = await mkdtemp(join(tmpdir(), 'gakrcli-wiki-command-'))
  const onDone = mock(() => {})

  try {
    await mkdir(join(cwd, 'src'), { recursive: true })
    await writeFile(join(cwd, 'src', 'main.ts'), 'export function main() {}\n', 'utf8')

    await runWithCwdOverride(cwd, () => call(onDone as never, {} as never, 'init'))
    await runWithCwdOverride(cwd, () => call(onDone as never, {} as never, 'update .'))

    expect(onDone).toHaveBeenCalledWith(
      expect.stringContaining('No wiki graph changes detected'),
      { display: 'system' },
    )
    expect(onDone).toHaveBeenCalledWith(
      expect.stringContaining('Changed: no'),
      { display: 'system' },
    )
  } finally {
    await rm(cwd, { recursive: true, force: true })
  }
})

test('/wiki status reports stale graph freshness after source changes', async () => {
  const cwd = await mkdtemp(join(tmpdir(), 'gakrcli-wiki-command-'))
  const onDone = mock(() => {})

  try {
    await mkdir(join(cwd, 'src'), { recursive: true })
    await writeFile(join(cwd, 'src', 'main.ts'), 'export function main() {}\n', 'utf8')

    await runWithCwdOverride(cwd, () => call(onDone as never, {} as never, 'init'))
    await writeFile(
      join(cwd, 'src', 'main.ts'),
      'export function changedMain() { return 1 }\n',
      'utf8',
    )
    await runWithCwdOverride(cwd, () => call(onDone as never, {} as never, 'status'))

    expect(onDone).toHaveBeenCalledWith(
      expect.stringContaining('Graph freshness: Codebase files have changes'),
      { display: 'system' },
    )
    expect(onDone).toHaveBeenCalledWith(
      expect.stringContaining('Run /wiki update'),
      { display: 'system' },
    )
  } finally {
    await rm(cwd, { recursive: true, force: true })
  }
})

test('/wiki update requires init first', async () => {
  const cwd = await mkdtemp(join(tmpdir(), 'gakrcli-wiki-command-'))
  const onDone = mock(() => {})

  try {
    await runWithCwdOverride(cwd, () => call(onDone as never, {} as never, 'update .'))

    expect(onDone).toHaveBeenCalledWith(
      expect.stringContaining('Wiki command failed: Wiki is not initialized. Run /wiki init first.'),
      { display: 'system' },
    )
  } finally {
    await rm(cwd, { recursive: true, force: true })
  }
})
