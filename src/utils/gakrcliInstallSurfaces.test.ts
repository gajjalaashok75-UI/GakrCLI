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

test('cleanupNpmInstallations removes the gakrcli local install dir', async () => {
  const removedPaths: string[] = []
  const uninstalledPackages: string[] = []
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
    execSyncWithDefaults_DEPRECATED: () => '',
    execFileNoThrow: async (_cmd: string, args: string[]) => {
      uninstalledPackages.push(args[2] ?? '')
      return {
        code: 1,
        stderr: 'npm ERR! code E404',
      }
    },
    execFileNoThrowWithCwd: async (_cmd: string, args: string[]) => {
      uninstalledPackages.push(args[2] ?? '')
      return {
        code: 1,
        stderr: 'npm ERR! code E404',
      }
    },
  }))

  const { cleanupNpmInstallations } = await importFreshInstaller()
  await cleanupNpmInstallations()

  expect(removedPaths).toContain(join(homedir(), '.gakrcli', 'local'))
  expect(removedPaths).not.toContain(join(homedir(), '.claude', 'local'))
  expect(uninstalledPackages).toEqual([
    '@anthropic-ai/claude-code',
    '@gakr-gakr/gakrcli',
  ])
})
