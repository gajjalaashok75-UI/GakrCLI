import { afterEach, beforeEach, expect, mock, test } from 'bun:test'
import * as fsPromises from 'fs/promises'
import { homedir } from 'os'
import { join } from 'path'
import {
  acquireSharedMutationLock,
  releaseSharedMutationLock,
} from '../test/sharedMutationLock.js'
import * as realEnv from './env.js'
import * as realEnvUtils from './envUtils.js'
import * as realExecFileNoThrow from './execFileNoThrow.js'

const originalEnv = { ...process.env }
const originalMacro = (globalThis as Record<string, unknown>).MACRO

beforeEach(async () => {
  await acquireSharedMutationLock('utils/gakrcliInstallSurfaces.test.ts')
})

afterEach(() => {
  try {
    process.env = { ...originalEnv }
    if (originalMacro === undefined) {
      delete (globalThis as Record<string, unknown>).MACRO
    } else {
      ;(globalThis as Record<string, unknown>).MACRO = originalMacro
    }
    mock.restore()
    mock.module('../utils/env.js', () => realEnv)
    mock.module('./envUtils.js', () => realEnvUtils)
    mock.module('./execFileNoThrow.js', () => realExecFileNoThrow)
  } finally {
    releaseSharedMutationLock()
  }
})

async function importFreshInstallCommand() {
  return import(`../commands/install.tsx?ts=${Date.now()}-${Math.random()}`)
}

async function importFreshInstaller() {
  return import(`./nativeInstaller/installer.ts?ts=${Date.now()}-${Math.random()}`)
}

async function mockEnvPlatform(platform: 'darwin' | 'win32') {
  const actualEnvModule = await import(`./env.js?ts=${Date.now()}-${Math.random()}`)
  mock.module('../utils/env.js', () => ({
    ...actualEnvModule,
    env: {
      ...actualEnvModule.env,
      platform,
    },
  }))
}

test('install command displays ~/.local/bin/gakrcli on non-Windows', async () => {
  await mockEnvPlatform('darwin')

  const { getInstallationPath } = await importFreshInstallCommand()

  expect(getInstallationPath()).toBe('~/.local/bin/gakrcli')
})

test('install command displays gakrcli.exe path on Windows', async () => {
  await mockEnvPlatform('win32')

  const { getInstallationPath } = await importFreshInstallCommand()

  expect(getInstallationPath()).toBe(
    join(homedir(), '.local', 'bin', 'gakrcli.exe').replace(/\//g, '\\'),
  )
})

test('cleanupNpmInstallations removes the gakrcli local install dir', async () => {
  const removedPaths: string[] = []
  ;(globalThis as Record<string, unknown>).MACRO = {
    PACKAGE_URL: '@gakr-gakr/gakrcli',
  }
  process.env.GAKR_CONFIG_DIR = join(homedir(), '.gakrcli')

  mock.module('fs/promises', () => ({
    ...fsPromises,
    rm: async (path: string) => {
      removedPaths.push(path)
    },
  }))

  mock.module('./execFileNoThrow.js', () => ({
    ...realExecFileNoThrow,
    execFileNoThrowWithCwd: async () => ({
      code: 1,
      stderr: 'npm ERR! code E404',
    }),
  }))

  mock.module('./envUtils.js', () => ({
    ...realEnvUtils,
    getClaudeConfigHomeDir: () => join(homedir(), '.gakrcli'),
    isEnvTruthy: (value: string | undefined) => value === '1',
  }))

  const { cleanupNpmInstallations } = await importFreshInstaller()
  await cleanupNpmInstallations()

  expect(removedPaths).toContain(join(homedir(), '.gakrcli', 'local'))
  expect(removedPaths).not.toContain(join(homedir(), '.claude', 'local'))
  
})
