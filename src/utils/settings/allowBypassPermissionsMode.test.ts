import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { mkdir, mkdtemp, rm, writeFile } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'
import {
  getFlagSettingsInline,
  getOriginalCwd,
  setFlagSettingsInline,
  setOriginalCwd,
} from '../../bootstrap/state.js'
import {
  acquireSharedMutationLock,
  releaseSharedMutationLock,
} from '../../test/sharedMutationLock.js'
import { resetSettingsCache } from './settingsCache.js'

let originalConfigDir: string | undefined
let originalCwd: string
let originalFlagSettings: Record<string, unknown> | null
let testDir: string | undefined

beforeEach(async () => {
  await acquireSharedMutationLock('utils/settings/allowBypassPermissionsMode.test.ts')
  originalConfigDir = process.env.GAKR_CONFIG_DIR
  originalCwd = getOriginalCwd()
  originalFlagSettings = getFlagSettingsInline()
  testDir = await mkdtemp(join(tmpdir(), 'gakr-settings-allow-bypass-'))
  process.env.GAKR_CONFIG_DIR = join(testDir, 'config')
  setOriginalCwd(join(testDir, 'project'))
  setFlagSettingsInline(null)
  resetSettingsCache()
})

afterEach(async () => {
  try {
    if (originalConfigDir === undefined) {
      delete process.env.GAKR_CONFIG_DIR
    } else {
      process.env.GAKR_CONFIG_DIR = originalConfigDir
    }
    setOriginalCwd(originalCwd)
    setFlagSettingsInline(originalFlagSettings)
    resetSettingsCache()
    if (testDir) {
      await rm(testDir, { recursive: true, force: true })
      testDir = undefined
    }
  } finally {
    releaseSharedMutationLock()
  }
})

describe('SettingsSchema allowBypassPermissionsMode', () => {
  test('accepts allowBypassPermissionsMode: true', async () => {
    const { SettingsSchema } = await import('./types.js')
    const result = SettingsSchema().safeParse({
      permissions: { allowBypassPermissionsMode: true },
    })
    expect(result.success).toBe(true)
  })

  test('accepts allowBypassPermissionsMode: false', async () => {
    const { SettingsSchema } = await import('./types.js')
    const result = SettingsSchema().safeParse({
      permissions: { allowBypassPermissionsMode: false },
    })
    expect(result.success).toBe(true)
  })

  test('rejects non-boolean allowBypassPermissionsMode', async () => {
    const { SettingsSchema } = await import('./types.js')
    const result = SettingsSchema().safeParse({
      permissions: { allowBypassPermissionsMode: 'yes' },
    })
    expect(result.success).toBe(false)
  })
})

describe('SettingsSchema effortLevel', () => {
  test('accepts max effort level', async () => {
    const { SettingsSchema } = await import('./types.js')
    const result = SettingsSchema().safeParse({
      effortLevel: 'max',
    })

    expect(result.success).toBe(true)
  })
})

describe('hasAllowBypassPermissionsMode', () => {
  test('returns true for trusted flag settings', async () => {
    setFlagSettingsInline({
      permissions: { allowBypassPermissionsMode: true },
    })
    resetSettingsCache()

    const { hasAllowBypassPermissionsMode } = await import('./settings.js')

    expect(hasAllowBypassPermissionsMode()).toBe(true)
  })

  test('ignores project settings', async () => {
    const projectDir = getOriginalCwd()
    await mkdir(join(projectDir, '.gakrcli'), { recursive: true })
    await writeFile(
      join(projectDir, '.gakrcli', 'settings.json'),
      JSON.stringify({ permissions: { allowBypassPermissionsMode: true } }),
      'utf8',
    )
    resetSettingsCache()

    const { hasAllowBypassPermissionsMode } = await import('./settings.js')

    expect(hasAllowBypassPermissionsMode()).toBe(false)
  })
})

describe('initializeToolPermissionContext allowBypassPermissionsMode', () => {
  test('makes bypass permissions mode available from trusted settings', async () => {
    setFlagSettingsInline({
      permissions: { allowBypassPermissionsMode: true },
    })
    resetSettingsCache()

    const { initializeToolPermissionContext } = await import(
      '../permissions/permissionSetup.js'
    )
    const { toolPermissionContext } = await initializeToolPermissionContext({
      allowedToolsCli: [],
      disallowedToolsCli: [],
      permissionMode: 'default',
      allowDangerouslySkipPermissions: false,
      addDirs: [],
    })

    expect(toolPermissionContext.isBypassPermissionsModeAvailable).toBe(true)
  })
})
