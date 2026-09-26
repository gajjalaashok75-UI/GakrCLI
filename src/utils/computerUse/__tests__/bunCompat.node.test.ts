/**
 * Node-path check for `bunCompat`.
 *
 * The main test suite runs under Bun, where the compat layer delegates to the
 * real Bun globals — so those tests never exercise the code that actually ships.
 * Production runs under Node (`bin/gakrcli` → `node dist/cli.mjs`).
 *
 * This spawns a separate Node process with no `Bun` global and asserts the shim
 * provides working `spawnSync` / `spawn` / `file`. This is the exact failure
 * mode behind the Windows "apps are not installed" bug: `listInstalled()` called
 * `Bun.spawnSync`, hit `ReferenceError: Bun is not defined` under Node, caught
 * it, and returned `[]`.
 */
import { expect, test } from 'bun:test'
import { spawnSync } from 'node:child_process'
import { resolve } from 'node:path'

const FIXTURE = resolve(
  import.meta.dirname,
  'fixtures/bunCompatUnderNode.fixture.ts',
)

test('bunCompat works in a Node process with no Bun global', () => {
  // `process.execPath` is Bun when this suite runs under `bun test`, so invoke
  // the real Node from PATH — the runtime production actually uses.
  const result = spawnSync('node', [FIXTURE], {
    encoding: 'utf8',
    timeout: 30_000,
    cwd: resolve(import.meta.dirname, '../../../..'),
  })

  if (result.error) throw result.error
  if (result.status !== 0) {
    throw new Error(
      `fixture exited with ${result.status}\nstdout:\n${result.stdout}\nstderr:\n${result.stderr}`,
    )
  }

  const line = result.stdout
    .split('\n')
    .find(l => l.startsWith('BUN_COMPAT_NODE_RESULT '))
  expect(line).toBeDefined()

  const payload = JSON.parse(line!.slice('BUN_COMPAT_NODE_RESULT '.length))
  expect(payload).toEqual({
    hasBun: false,
    spawnSyncStdout: 'sync-ok',
    spawnSyncExitCode: 0,
    spawnSyncSuccess: true,
    spawnStdout: 'async-ok',
    spawnExited: 0,
    stdinEcho: 'echo:payload',
    fileReadOk: true,
    embeddedFilesAbsent: true,
  })
})
