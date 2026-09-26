/**
 * Runtime shims for the Bun globals used by the Computer Use backends.
 *
 * GakrCLI's supported runtime is Node (see `bin/gakrcli`, which re-execs
 * `dist/cli.mjs` under `process.execPath`). `bun` is only the *build* tool.
 * The Computer Use backends were written against Bun's `spawn`/`spawnSync`/
 * `file`/`embeddedFiles` APIs, which do not exist under Node — every call
 * threw `ReferenceError: Bun is not defined`.
 *
 * Most call sites swallowed that error and degraded (e.g. `listInstalled()`
 * caught it and returned `[]`), which surfaced to the model as every app
 * being "not installed" and made Computer Use unusable on Windows.
 *
 * When running under Bun these delegate to the real globals so native
 * behaviour is preserved; otherwise they implement the subset of the Bun API
 * the Computer Use code actually uses, on top of `node:child_process`/`node:fs`.
 */

import { spawn as nodeSpawn, spawnSync as nodeSpawnSync } from 'node:child_process'
import { readFile as nodeReadFile } from 'node:fs/promises'
import { Readable } from 'node:stream'

const hasBun = typeof Bun !== 'undefined'

// ---------------------------------------------------------------------------
// spawnSync
// ---------------------------------------------------------------------------

export type SpawnSyncOptions = {
  cmd: string[]
  stdout?: 'pipe' | 'ignore' | 'inherit'
  stderr?: 'pipe' | 'ignore' | 'inherit'
  stdin?: string | Uint8Array
  env?: Record<string, string | undefined>
  cwd?: string
  timeout?: number
}

export type SpawnSyncResult = {
  stdout: Uint8Array
  stderr: Uint8Array
  exitCode: number
  success: boolean
}

const EMPTY = new Uint8Array(0)

function toBytes(value: string | Uint8Array | null | undefined): Uint8Array {
  if (value == null) return EMPTY
  return typeof value === 'string' ? new TextEncoder().encode(value) : value
}

export function bunSpawnSync(options: SpawnSyncOptions): SpawnSyncResult {
  if (hasBun) {
    return (Bun as unknown as { spawnSync: (o: unknown) => SpawnSyncResult }).spawnSync(options)
  }

  const [file, ...args] = options.cmd
  if (file === undefined) {
    return { stdout: EMPTY, stderr: EMPTY, exitCode: 1, success: false }
  }

  const result = nodeSpawnSync(file, args, {
    // Node's sync API reads stdin from `input`, not a `stdin: 'pipe'` handle.
    // stdio[0] must stay 'pipe' for `input` to be honoured.
    input: options.stdin,
    // Callers that discard output (`ignore`) shouldn't pay to buffer it.
    stdio: [
      'pipe',
      options.stdout ?? 'pipe',
      options.stderr ?? 'pipe',
    ] as ('pipe' | 'ignore' | 'inherit')[],
    env: options.env as NodeJS.ProcessEnv | undefined,
    cwd: options.cwd,
    timeout: options.timeout,
    windowsHide: true,
    maxBuffer: 64 * 1024 * 1024,
  })

  return {
    stdout: result.stdout ?? EMPTY,
    stderr: result.stderr ?? EMPTY,
    exitCode: result.status ?? (result.error ? 1 : 0),
    success: result.status === 0,
  }
}

// ---------------------------------------------------------------------------
// spawn
// ---------------------------------------------------------------------------

export type SpawnOptions = {
  stdout?: 'pipe' | 'ignore' | 'inherit'
  stderr?: 'pipe' | 'ignore' | 'inherit'
  stdin?: 'pipe' | 'ignore' | 'inherit'
  env?: Record<string, string | undefined>
  cwd?: string
}

type BunProcLike = {
  stdout: ReadableStream<Uint8Array>
  stderr: ReadableStream<Uint8Array>
  stdin: NodeJS.WritableStream
  exited: Promise<number>
  kill: () => void
  pid: number
}

export function bunSpawn(cmd: string[], options: SpawnOptions = {}): BunProcLike {
  if (hasBun) {
    return (Bun as unknown as { spawn: (c: string[], o: unknown) => BunProcLike }).spawn(cmd, options)
  }

  const [file, ...args] = cmd
  const proc = nodeSpawn(file!, args, {
    stdio: [
      options.stdin ?? 'pipe',
      options.stdout ?? 'pipe',
      options.stderr ?? 'pipe',
    ],
    env: options.env as NodeJS.ProcessEnv | undefined,
    cwd: options.cwd,
    windowsHide: true,
  })

  // Bun exposes web streams; Node exposes node streams. Bridge so callers can
  // keep using `.getReader()` / `new Response(stream).text()` unchanged.
  const toWeb = (
    stream: NodeJS.ReadableStream | null,
  ): ReadableStream<Uint8Array> =>
    stream
      ? (Readable.toWeb(stream as Readable) as unknown as ReadableStream<Uint8Array>)
      : new ReadableStream()

  return {
    stdout: toWeb(proc.stdout),
    stderr: toWeb(proc.stderr),
    stdin: proc.stdin as unknown as NodeJS.WritableStream,
    exited: new Promise<number>(resolve => {
      proc.on('close', code => resolve(code ?? 0))
      proc.on('error', () => resolve(1))
    }),
    kill: () => {
      try {
        proc.kill()
      } catch {}
    },
    pid: proc.pid ?? 0,
  }
}

// ---------------------------------------------------------------------------
// file
// ---------------------------------------------------------------------------

export type BunFileLike = {
  arrayBuffer: () => Promise<ArrayBuffer>
  text: () => Promise<string>
}

export function bunFile(path: string): BunFileLike {
  if (hasBun) {
    return (Bun as unknown as { file: (p: string) => BunFileLike }).file(path)
  }
  return {
    arrayBuffer: async () => {
      const buf = await nodeReadFile(path)
      return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer
    },
    text: () => nodeReadFile(path, 'utf-8'),
  }
}

// ---------------------------------------------------------------------------
// embeddedFiles (Bun compile-time assets)
// ---------------------------------------------------------------------------

/**
 * Assets embedded via `Bun.embeddedFiles` when built into a standalone binary.
 * Under Node there is no compiled binary, so there is nothing to extract and
 * `bridgeAsset` falls back to the on-disk path.
 */
export function bunEmbeddedFiles(): Array<{ name: string }> | undefined {
  if (!hasBun) return undefined
  const embedded = (Bun as unknown as { embeddedFiles?: Array<{ name: string }> })
    .embeddedFiles
  return Array.isArray(embedded) ? embedded : undefined
}
