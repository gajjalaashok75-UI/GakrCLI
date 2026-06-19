import { afterEach, beforeEach, expect, test } from 'bun:test'
import { mkdtemp, rm } from 'fs/promises'
import { join } from 'path'
import { tmpdir } from 'os'
import { call } from './wiki.js'
import {
  acquireSharedMutationLock,
  releaseSharedMutationLock,
} from '../../test/sharedMutationLock.js'

const tempDirs: string[] = []

beforeEach(async () => {
  await acquireSharedMutationLock('commands/wiki/wiki.test.ts')
})

afterEach(async () => {
  try {
    await Promise.all(tempDirs.splice(0).map(dir => rm(dir, { recursive: true, force: true })))
  } finally {
    releaseSharedMutationLock()
  }
})

async function makeProjectDir(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), 'gakrcli-wiki-command-'))
  tempDirs.push(dir)
  return dir
}

async function runWiki(cwd: string, args = ''): Promise<string> {
  let output = ''
  await call((message: string) => {
    output = message
  }, { cwd } as never, args)
  return output
}

test('/wiki status reports uninitialized wiki state', async () => {
  const cwd = await makeProjectDir()

  const output = await runWiki(cwd)

  expect(output).toContain('GakrCLI wiki is not initialized in this project.')
  expect(output).toContain('/wiki init')
})

test('/wiki help documents supported subcommands', async () => {
  const cwd = await makeProjectDir()

  const output = await runWiki(cwd, 'help')

  expect(output).toContain('Usage: /wiki [init|status|ingest <path>]')
  expect(output).toContain('/wiki ingest README.md')
})

test('/wiki init creates the wiki scaffold', async () => {
  const cwd = await makeProjectDir()

  const output = await runWiki(cwd, 'init')

  expect(output).toContain('Initialized GakrCLI wiki')
  expect(output).toContain(join('.gakrcli', 'wiki', 'schema.md'))
  expect(output).toContain(join('.gakrcli', 'wiki', 'pages', 'architecture.md'))
})
