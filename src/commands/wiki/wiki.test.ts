import { expect, mock, test } from 'bun:test'
import { mkdtemp, rm } from 'fs/promises'
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
