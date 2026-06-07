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
