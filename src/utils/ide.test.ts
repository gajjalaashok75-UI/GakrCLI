import { afterEach, expect, test } from 'bun:test'
import { mkdirSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { setOriginalCwd } from '../bootstrap/state.js'
import { setGakrCLIConfigHomeDirForTesting } from './envUtils.js'
import { detectIDEs } from './ide.js'
import {
  acquireSharedMutationLock,
  releaseSharedMutationLock,
} from '../test/sharedMutationLock.js'

const originalCwd = process.cwd()

afterEach(() => {
  setOriginalCwd(originalCwd)
  setGakrCLIConfigHomeDirForTesting(undefined)
  releaseSharedMutationLock()
})

test.skipIf(process.platform === 'win32')(
  'detectIDEs matches VS Code lockfile workspace paths case-insensitively on Windows',
  async () => {
    await acquireSharedMutationLock('src/utils/ide.test.ts')
    const configDir = join(tmpdir(), `gakrcli-ide-test-${Date.now()}`)
    const ideDir = join(configDir, 'ide')
    mkdirSync(ideDir, { recursive: true })

    try {
      writeFileSync(
        join(ideDir, '49152.lock'),
        JSON.stringify({
          workspaceFolders: [
            'C:\\Users\\gajja\\Documents\\data-science\\Gakrcli',
          ],
          pid: process.ppid,
          ideName: 'VS Code',
          transport: 'sse',
        }),
      )

      setGakrCLIConfigHomeDirForTesting(configDir)
      setOriginalCwd('C:\\Users\\gajja\\Documents\\data-science\\gakrcli')

      const ides = await detectIDEs(false)

      expect(ides).toHaveLength(1)
      expect(ides[0]?.name).toBe('VS Code')
      expect(ides[0]?.isValid).toBe(true)
      expect(ides[0]?.port).toBe(49152)
    } finally {
      rmSync(configDir, { recursive: true, force: true })
    }
  },
)
