import { afterEach, expect, mock, test } from 'bun:test'
import * as fsPromises from 'fs/promises'
import { homedir } from 'os'
import { join } from 'path'

const originalEnv = { ...process.env }
const originalMacro = (globalThis as Record<string, unknown>).MACRO

afterEach(() => {
  process.env = { ...originalEnv }
  ;(globalThis as Record<string, unknown>).MACRO = originalMacro
  mock.restore()
})

async function importFreshInstallCommand() {
  return import(`../commands/install.tsx?ts=${Date.now()}-${Math.random()}`)
}

async function importFreshInstaller() {
  return import(`./nativeInstaller/installer.ts?ts=${Date.now()}-${Math.random()}`)
}

test('install command displays ~/.local/bin/gakrcli on non-Windows', async () => {
  mock.module('../utils/env.js', () => ({
    env: { platform: 'darwin' },
    getGlobalGakrcliFile: () => join(homedir(), '.gakrcli.json'),
    getHostPlatformForAnalytics: () => 'darwin',
    JETBRAINS_IDES: [],
  }))

  const { getInstallationPath } = await importFreshInstallCommand()

  expect(getInstallationPath()).toBe('~/.local/bin/gakrcli')
})

test('install command displays gakrcli.exe path on Windows', async () => {
  mock.module('../utils/env.js', () => ({
    env: { platform: 'win32' },
    getGlobalGakrcliFile: () => join(homedir(), '.gakrcli.json'),
    getHostPlatformForAnalytics: () => 'win32',
    JETBRAINS_IDES: [],
  }))

  const { getInstallationPath } = await importFreshInstallCommand()

  expect(getInstallationPath()).toBe(
    join(homedir(), '.local', 'bin', 'gakrcli.exe').replace(/\//g, '\\'),
  )
})

test('cleanupNpmInstallations removes both gakrcli and legacy claude local install dirs', async () => {
  const removedPaths: string[] = []
  ;(globalThis as Record<string, unknown>).MACRO = {
    PACKAGE_URL: '@gakr-gakr/gakrcli',
  }

  mock.module('fs/promises', () => ({
    ...fsPromises,
    rm: async (path: string) => {
      removedPaths.push(path)
    },
  }))

  mock.module('./execFileNoThrow.js', () => ({
    execFileNoThrowWithCwd: async () => ({
      code: 1,
      stderr: 'npm ERR! code E404',
    }),
  }))

  mock.module('./envUtils.js', () => ({
    getgakrcliConfigHomeDir: () => join(homedir(), '.gakrcli'),
    isEnvTruthy: (value: string | undefined) => value === '1',
  }))

  const { cleanupNpmInstallations } = await importFreshInstaller()
  await cleanupNpmInstallations()

  expect(removedPaths).toContain(join(homedir(), '.gakrcli', 'local'))
  expect(removedPaths).toContain(join(homedir(), '.claude', 'local'))
})
