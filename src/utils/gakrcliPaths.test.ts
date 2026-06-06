import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test'
import * as fsPromises from 'fs/promises'
import { homedir } from 'os'
import { join } from 'path'
import {
  acquireSharedMutationLock,
  releaseSharedMutationLock,
} from '../test/sharedMutationLock.js'

const originalEnv = { ...process.env }
const originalArgv = [...process.argv]

async function importFreshEnvUtils() {
  return import(`./envUtils.ts?ts=${Date.now()}-${Math.random()}`)
}

async function importFreshSettings() {
  return import(`./settings/settings.ts?ts=${Date.now()}-${Math.random()}`)
}

async function importFreshLocalInstaller() {
  return import(`./localInstaller.ts?ts=${Date.now()}-${Math.random()}`)
}

async function importFreshPlans() {
  return import(`./plans.ts?ts=${Date.now()}-${Math.random()}`)
}

beforeEach(async () => {
  await acquireSharedMutationLock('gakrcliPaths.test.ts')
})

afterEach(() => {
  try {
    process.env = { ...originalEnv }
    process.argv = [...originalArgv]
    mock.restore()
  } finally {
    releaseSharedMutationLock()
  }
})

describe('GakrCLI paths', () => {
  test('defaults user config home to ~/.gakrcli', async () => {
    delete process.env.GAKR_CONFIG_DIR
    const { resolveGakrcliConfigHomeDir } = await importFreshEnvUtils()

    expect(
      resolveGakrcliConfigHomeDir({
        homeDir: homedir(),
      }),
    ).toBe(join(homedir(), '.gakrcli'))
  })

  test('hard-cuts user config home to ~/.gakrcli by default', async () => {
    delete process.env.GAKR_CONFIG_DIR
    const { resolveGakrcliConfigHomeDir } = await importFreshEnvUtils()

    expect(
      resolveGakrcliConfigHomeDir({
        homeDir: homedir(),
      }),
    ).toBe(join(homedir(), '.gakrcli'))
  })

  test('uses GAKR_CONFIG_DIR override when provided', async () => {
    process.env.GAKR_CONFIG_DIR = '/tmp/custom-gakrcli'
    const { getgakrcliConfigHomeDir, resolveGakrcliConfigHomeDir } =
      await importFreshEnvUtils()

    expect(getgakrcliConfigHomeDir()).toBe('/tmp/custom-gakrcli')
    expect(
      resolveGakrcliConfigHomeDir({
        configDirEnv: '/tmp/custom-gakrcli',
      }),
    ).toBe('/tmp/custom-gakrcli')
  })

  test('defaults workspace projects under ~/.gakrcli/workspace', async () => {
    delete process.env.GAKR_CONFIG_DIR
    delete process.env.GAKRCLI_WORKSPACE_DIR
    delete process.env.GAKR_WORKSPACE_DIR
    const { getGakrcliWorkspaceDir, getProjectsDir } =
      await importFreshEnvUtils()

    expect(getGakrcliWorkspaceDir()).toBe(
      join(homedir(), '.gakrcli', 'workspace'),
    )
    expect(getProjectsDir()).toBe(
      join(homedir(), '.gakrcli', 'workspace', 'projects'),
    )
  })

  test('workspace override controls projects directory', async () => {
    process.env.GAKR_CONFIG_DIR = '/tmp/custom-gakrcli'
    const workspaceOverride = join(homedir(), 'custom-workspace')
    process.env.GAKRCLI_WORKSPACE_DIR = workspaceOverride
    const { getGakrcliWorkspaceDir, getProjectsDir } =
      await importFreshEnvUtils()

    expect(getGakrcliWorkspaceDir()).toBe(workspaceOverride)
    expect(getProjectsDir()).toBe(join(workspaceOverride, 'projects'))
  })

  test('default plans directory uses ~/.gakrcli/plans', async () => {
    delete process.env.GAKR_CONFIG_DIR
    const { getDefaultPlansDirectory } = await importFreshPlans()

    expect(getDefaultPlansDirectory({ homeDir: homedir() })).toBe(
      join(homedir(), '.gakrcli', 'plans'),
    )
  })

  test('default plans directory respects explicit GAKR_CONFIG_DIR', async () => {
    const { getDefaultPlansDirectory } = await importFreshPlans()

    expect(
      getDefaultPlansDirectory({ configDirEnv: '/tmp/custom-gakrcli' }),
    ).toBe(join('/tmp/custom-gakrcli', 'plans'))
  })

  test('default plans directory normalizes generated path to NFC', async () => {
    const { getDefaultPlansDirectory } = await importFreshPlans()

    expect(
      getDefaultPlansDirectory({ homeDir: '/tmp/cafe\u0301' }),
    ).toBe(join('/tmp/caf\u00e9', '.gakrcli', 'plans'))
  })

  test('default plans directory normalizes explicit GAKR_CONFIG_DIR to NFC', async () => {
    const { getDefaultPlansDirectory } = await importFreshPlans()

    expect(
      getDefaultPlansDirectory({ configDirEnv: '/tmp/cafe\u0301-gakrcli' }),
    ).toBe(join('/tmp/caf\u00e9-gakrcli', 'plans'))
  })

  test('project and local settings paths use .gakrcli', async () => {
    const { getRelativeSettingsFilePathForSource } = await importFreshSettings()

    expect(getRelativeSettingsFilePathForSource('projectSettings')).toBe(
      '.gakrcli/settings.json',
    )
    expect(getRelativeSettingsFilePathForSource('localSettings')).toBe(
      '.gakrcli/settings.local.json',
    )
  })

  test('local installer uses gakrcli wrapper path', async () => {
    process.env.GAKR_CONFIG_DIR = join(homedir(), '.gakrcli')
    const { getLocalGakrcliPath } = await importFreshLocalInstaller()

    expect(getLocalGakrcliPath()).toBe(
      join(homedir(), '.gakrcli', 'local', 'gakrcli'),
    )
  })

  test('local installation detection matches .gakrcli path', async () => {
    const { isManagedLocalInstallationPath } =
      await importFreshLocalInstaller()

    expect(
      isManagedLocalInstallationPath(
        `${join(homedir(), '.gakrcli', 'local')}/node_modules/.bin/gakrcli`,
      ),
    ).toBe(true)
  })

  test('local installation detection does not match legacy .claude path', async () => {
    const { isManagedLocalInstallationPath } =
      await importFreshLocalInstaller()

    expect(
      isManagedLocalInstallationPath(
        `${join(homedir(), '.claude', 'local')}/node_modules/.bin/gakrcli`,
      ),
    ).toBe(false)
  })

  test('candidate local install dirs include only the gakrcli path', async () => {
    const { getCandidateLocalInstallDirs } = await importFreshLocalInstaller()

    expect(
      getCandidateLocalInstallDirs({
        configHomeDir: join(homedir(), '.gakrcli'),
      }),
    ).toEqual([join(homedir(), '.gakrcli', 'local')])
  })

  test('legacy local installs are ignored when they expose only the claude binary', async () => {
    mock.module('fs/promises', () => ({
      ...fsPromises,
      access: async (path: string) => {
        if (
          path ===
          join(homedir(), '.claude', 'local', 'node_modules', '.bin', 'claude')
        ) {
          return
        }
        throw Object.assign(new Error('ENOENT'), { code: 'ENOENT' })
      },
    }))

    const { getDetectedLocalInstallDir, localInstallationExists } =
      await importFreshLocalInstaller()

    expect(await localInstallationExists()).toBe(false)
    expect(await getDetectedLocalInstallDir()).toBe(null)
  })
})
