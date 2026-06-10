import { afterEach, expect, test } from 'bun:test'
import { mkdirSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { setOriginalCwd } from '../bootstrap/state.js'
import { setGakrcliConfigHomeDirForTesting } from './envUtils.js'
import { detectIDEs } from './ide.js'

const originalCwd = process.cwd()

afterEach(() => {
  setOriginalCwd(originalCwd)
  setGakrcliConfigHomeDirForTesting(undefined)
})

const testIfWindows = process.platform === 'win32' ? test : test.skip

testIfWindows(
  'detectIDEs matches VS Code lockfile workspace paths case-insensitively on Windows',
  async () => {
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

      setGakrcliConfigHomeDirForTesting(configDir)
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
