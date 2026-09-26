/**
 * Runs under Node (no `Bun` global) and exercises every shim branch the
 * Computer Use backends depend on. Output is a single JSON line the parent
 * test parses. See `bunCompat.node.test.ts`.
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import {
  bunEmbeddedFiles,
  bunFile,
  bunSpawn,
  bunSpawnSync,
} from '../../bunCompat.ts'

// `readFileSync` (not a global) keeps the fixture honest: if removing the Bun
// global somehow failed, the `hasBun` assertion below would catch it.
const hasBun = typeof Bun !== 'undefined'

const sync = bunSpawnSync({
  cmd: ['node', '-e', 'process.stdout.write("sync-ok")'],
  stdout: 'pipe',
  stderr: 'pipe',
})

const async = bunSpawn(['node', '-e', 'process.stdout.write("async-ok")'], {
  stdout: 'pipe',
  stderr: 'pipe',
})
const asyncOut = await new Response(async.stdout).text()
const asyncCode = await async.exited

const withStdin = bunSpawn(
  ['node', '-e', 'process.stdin.on("data", d => process.stdout.write("echo:" + d))'],
  { stdin: 'pipe', stdout: 'pipe', stderr: 'pipe' },
)
withStdin.stdin.write('payload')
withStdin.stdin.end()
const stdinOut = await new Response(withStdin.stdout).text()

let fileReadOk = false
try {
  const text = await bunFile(resolve(import.meta.dirname, '../../../../../package.json')).text()
  fileReadOk = text.includes('"name"')
} catch {
  fileReadOk = false
}

console.log(
  'BUN_COMPAT_NODE_RESULT ' +
    JSON.stringify({
      hasBun,
      spawnSyncStdout: new TextDecoder().decode(sync.stdout),
      spawnSyncExitCode: sync.exitCode,
      spawnSyncSuccess: sync.success,
      spawnStdout: asyncOut,
      spawnExited: asyncCode,
      stdinEcho: stdinOut.trim(),
      fileReadOk,
      embeddedFilesAbsent: bunEmbeddedFiles() === undefined,
    }),
)

// Satisfy no-unused-import lint without affecting behaviour.
void readFileSync
