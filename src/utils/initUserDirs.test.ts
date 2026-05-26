import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'fs'
import { tmpdir } from 'os'
import { dirname, join } from 'path'
import { pathToFileURL } from 'url'

import { getPackageRoot, initUserDirs } from './initUserDirs.js'
import {
  acquireSharedMutationLock,
  releaseSharedMutationLock,
} from '../test/sharedMutationLock.js'

const tempRoots: string[] = []
let lockAcquired = false

function makeTempDir(prefix: string): string {
  const dir = mkdtempSync(join(tmpdir(), prefix))
  tempRoots.push(dir)
  return dir
}

function writeFile(path: string, content: string): void {
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, content, 'utf8')
}

beforeEach(async () => {
  await acquireSharedMutationLock('initUserDirs.test.ts')
  lockAcquired = true
})

afterEach(() => {
  try {
    for (const dir of tempRoots.splice(0)) {
      rmSync(dir, { recursive: true, force: true })
    }
  } finally {
    if (lockAcquired) {
      releaseSharedMutationLock()
      lockAcquired = false
    }
  }
})

describe('initUserDirs', () => {
  test('creates required ~/.gakrcli directories and syncs packaged defaults', () => {
    const packageRoot = makeTempDir('gakrcli-package-')
    const configHome = makeTempDir('gakrcli-config-')

    writeFile(join(packageRoot, 'package.json'), '{"name":"@gakr-gakr/gakrcli"}')
    writeFile(join(packageRoot, 'assets', 'agents', 'reviewer.md'), 'agent')
    writeFile(join(packageRoot, 'assets', 'rules', 'default.md'), 'rule')
    writeFile(
      join(packageRoot, 'assets', 'skills', 'typescript', 'SKILL.md'),
      'skill',
    )

    const result = initUserDirs({ configHome, packageRoot })

    for (const dir of [
      'agents',
      'cache',
      'commands',
      'logs',
      'memory',
      'output-styles',
      'projects',
      'rules',
      'sessions',
      'skills',
      'workflows',
    ]) {
      expect(existsSync(join(configHome, dir))).toBe(true)
    }

    expect(result.createdConfigFile).toBe(true)
    expect(result.syncedAssets).toEqual({
      agents: 1,
      rules: 1,
      skills: 1,
    })
    expect(readFileSync(join(configHome, 'agents', 'reviewer.md'), 'utf8')).toBe(
      'agent',
    )
    expect(readFileSync(join(configHome, 'rules', 'default.md'), 'utf8')).toBe(
      'rule',
    )
    expect(
      readFileSync(join(configHome, 'skills', 'typescript', 'SKILL.md'), 'utf8'),
    ).toBe('skill')
  })

  test('does not overwrite existing user files when syncing defaults', () => {
    const packageRoot = makeTempDir('gakrcli-package-')
    const configHome = makeTempDir('gakrcli-config-')

    writeFile(join(packageRoot, 'package.json'), '{"name":"@gakr-gakr/gakrcli"}')
    writeFile(join(packageRoot, 'assets', 'agents', 'reviewer.md'), 'default')
    writeFile(join(packageRoot, 'assets', 'rules', 'default.md'), 'rule')
    writeFile(
      join(packageRoot, 'assets', 'skills', 'typescript', 'SKILL.md'),
      'default skill',
    )
    writeFile(join(configHome, 'agents', 'reviewer.md'), 'user edit')

    const result = initUserDirs({ configHome, packageRoot })

    expect(result.syncedAssets.agents).toBe(0)
    expect(readFileSync(join(configHome, 'agents', 'reviewer.md'), 'utf8')).toBe(
      'user edit',
    )
  })

  test('finds the repository package root from a nested source file URL', () => {
    const root = getPackageRoot(import.meta.url)

    expect(existsSync(join(root, 'package.json'))).toBe(true)
    expect(existsSync(join(root, 'assets'))).toBe(true)
  })

  test('finds the package root from a bundled dist file URL', () => {
    const packageRoot = makeTempDir('gakrcli-global-package-')
    const distEntrypoint = join(packageRoot, 'dist', 'cli.mjs')

    writeFile(join(packageRoot, 'package.json'), '{"name":"@gakr-gakr/gakrcli"}')
    writeFile(join(packageRoot, 'assets', 'agents', 'reviewer.md'), 'agent')
    writeFile(distEntrypoint, '')

    expect(getPackageRoot(pathToFileURL(distEntrypoint).href)).toBe(packageRoot)
  })
})
