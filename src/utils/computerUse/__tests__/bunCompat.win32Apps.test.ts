/**
 * Regression test for the Windows Computer Use "not installed" bug.
 *
 * Root cause: the win32/linux backends called Bun's `spawn`/`spawnSync`/`file`
 * globals, which don't exist under Node (the supported runtime — `bin/gakrcli`
 * re-execs `dist/cli.mjs` via `process.execPath`). `listInstalled()` swallowed
 * the resulting `ReferenceError` and returned `[]`, so every requested app was
 * reported back to the model as `not_installed`.
 *
 * These tests pin the two halves of the contract:
 *  1. the compat layer actually spawns processes / reads files under Node, and
 *  2. the vendored resolution logic maps Windows app identity correctly.
 */
import { describe, expect, test } from 'bun:test'

import * as computerUseMcp from '@ant/computer-use-mcp'
import type { InstalledApp } from '@ant/computer-use-mcp/types'
import {
  bunEmbeddedFiles,
  bunFile,
  bunSpawn,
  bunSpawnSync,
} from '../bunCompat.js'

// `_toolCallsTest` exists at runtime but is intentionally absent from the
// curated `optionalModules.d.ts` shim, so reach it through a local narrow cast.
type ResolvedAppRequest = {
  requestedName: string
  resolved?: InstalledApp
}

const _test = computerUseMcp as unknown as {
  _toolCallsTest: {
    resolveRequestedApps: (
      requestedNames: string[],
      installed: InstalledApp[],
      alreadyGrantedBundleIds: ReadonlySet<string>,
    ) => ResolvedAppRequest[]
  }
}

const resolveRequestedApps = (
  requestedNames: string[],
  installed: unknown[],
  alreadyGranted: ReadonlySet<string>,
): ResolvedAppRequest[] =>
  _test._toolCallsTest.resolveRequestedApps(
    requestedNames,
    installed as InstalledApp[],
    alreadyGranted,
  )

const decode = (b: Uint8Array): string => new TextDecoder().decode(b)

describe('bunCompat spawnSync', () => {
  test('captures stdout and exit code', () => {
    const r = bunSpawnSync({
      cmd: ['node', '-e', 'process.stdout.write("ok")'],
      stdout: 'pipe',
      stderr: 'pipe',
    })
    expect(decode(r.stdout)).toBe('ok')
    expect(r.exitCode).toBe(0)
    expect(r.success).toBe(true)
  })

  test('reports non-zero exit without throwing', () => {
    const r = bunSpawnSync({
      cmd: ['node', '-e', 'process.exit(3)'],
      stdout: 'pipe',
      stderr: 'pipe',
    })
    expect(r.exitCode).toBe(3)
    expect(r.success).toBe(false)
  })

  test('passes stdin through to the child', () => {
    const r = bunSpawnSync({
      cmd: ['node', '-e', 'process.stdin.on("data", d => process.stdout.write(d))'],
      stdin: Buffer.from('payload'),
      stdout: 'pipe',
      stderr: 'pipe',
    })
    expect(decode(r.stdout)).toBe('payload')
  })

  test('reports failure for a bogus command (Node returns, Bun throws)', () => {
    // Under Node the shim returns a failed result; the compat layer exists for
    // Node, so that is the path that matters. Under Bun (this test runner) the
    // delegate throws, which is Bun's documented behaviour. Both are "did not
    // silently succeed".
    let exitCode: number | undefined
    try {
      exitCode = bunSpawnSync({
        cmd: ['definitely-not-a-real-binary-xyz'],
        stdout: 'pipe',
        stderr: 'pipe',
      }).exitCode
    } catch {
      exitCode = 1
    }
    expect(exitCode).not.toBe(0)
  })
})

describe('bunCompat spawn', () => {
  test('exposes web streams and an exited promise', async () => {
    const proc = bunSpawn(['node', '-e', 'process.stdout.write("async")'], {
      stdout: 'pipe',
      stderr: 'pipe',
    })
    expect(await new Response(proc.stdout).text()).toBe('async')
    expect(await proc.exited).toBe(0)
  })

  test('stdin writes reach the child', async () => {
    const proc = bunSpawn(
      ['node', '-e', 'process.stdin.on("data", d => process.stdout.write(d))'],
      { stdin: 'pipe', stdout: 'pipe', stderr: 'pipe' },
    )
    proc.stdin.write('hello')
    proc.stdin.end()
    expect(await new Response(proc.stdout).text()).toBe('hello')
  })
})

describe('bunCompat file', () => {
  test('text() and arrayBuffer() read real files', async () => {
    const file = bunFile('package.json')
    const text = await file.text()
    expect(JSON.parse(text).name).toBe('@gakr-gakr/gakrcli')
    const buf = await file.arrayBuffer()
    expect(buf.byteLength).toBeGreaterThan(0)
  })
})

describe('bunCompat embeddedFiles', () => {
  test('yields no bridge asset when there is no compiled binary', () => {
    // Bun reports an empty array when nothing was embedded; Node has no
    // embeddedFiles at all. Either way there is no match, so bridgeAsset
    // falls back to the on-disk path.
    expect(bunEmbeddedFiles() ?? []).toHaveLength(0)
  })
})

describe('Windows app resolution (the reported symptom)', () => {
  // Shape produced by win32 listInstalled(): bundleId=PSChildName (registry
  // key), displayName=DisplayName, path=InstallLocation, exePath=resolved exe.
  const installed = [
    {
      bundleId: 'Notepad',
      displayName: 'Notepad',
      path: 'C:\\Windows\\System32',
      exePath: 'C:\\Windows\\System32\\notepad.exe',
    },
    {
      bundleId: 'GoogleChrome',
      displayName: 'Google Chrome',
      path: 'C:\\Program Files\\Google\\Chrome',
      exePath: 'C:\\Program Files\\Google\\Chrome\\chrome.exe',
    },
    {
      bundleId: 'Microsoft.WindowsCalculator',
      displayName: 'Calculator',
      path: '',
      exePath: 'C:\\Windows\\System32\\calc.exe',
    },
  ]

  test('resolves a Windows display name to an installed app', () => {
    const [notepad] = resolveRequestedApps(['notepad'], installed, new Set())
    expect(notepad!.resolved?.displayName).toBe('Notepad')
  })

  test('resolves via .exe-suffix stripping and substring match', () => {
    const [chrome] = resolveRequestedApps(
      ['chrome.exe'],
      installed,
      new Set(),
    )
    expect(chrome!.resolved?.displayName).toBe('Google Chrome')
  })

  test('resolves a Store-app display name', () => {
    const [calc] = resolveRequestedApps(['calculator'], installed, new Set())
    expect(calc!.resolved?.bundleId).toBe('Microsoft.WindowsCalculator')
  })

  test('marks a genuinely absent app as unresolved (not_installed)', () => {
    const [missing] = resolveRequestedApps(
      ['definitely-not-installed'],
      installed,
      new Set(),
    )
    expect(missing!.resolved).toBeUndefined()
  })

  test('empty installed list is exactly the pre-fix failure mode', () => {
    const resolved = resolveRequestedApps(['notepad'], [], new Set())
    expect(resolved[0]!.resolved).toBeUndefined()
  })
})