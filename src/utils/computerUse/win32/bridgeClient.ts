/**
 * Bridge Client — manages a long-lived subprocess for the Python Bridge
 * (bridge.py) used by Windows Computer Use operations.
 *
 * Speaks JSON lines over stdin/stdout. Keeping one process alive replaces
 * per-call PowerShell spawning (~1-5ms per call vs ~200-500ms per spawn).
 */

import { bunSpawn, bunSpawnSync } from '../bunCompat.js'

import type { Writable } from 'stream'

import { resolveBridgeScript } from './bridgeAsset.js'

interface BridgeRequest {
  id: number
  method: string
  params: Record<string, unknown>
}

interface BridgeResponse {
  id: number
  result?: unknown
  error?: string
}

let bridgeProc: ReturnType<typeof bunSpawn> | null = null
let requestId = 0
const pendingRequests = new Map<
  number,
  {
    resolve: (value: unknown) => void
    reject: (error: Error) => void
  }
>()
let outputBuffer = ''

/**
 * Tail of the bridge's stderr. Python tracebacks (missing module, COM failure,
 * bad HWND) land here; without this they are invisible, because a bridge that
 * dies mid-call yields no stdout and every layer collapses to "no data".
 */
let lastBridgeStderr = ''

const MAX_STDERR_TAIL = 2000

function setLastBridgeStderr(text: string): void {
  lastBridgeStderr = text.slice(-MAX_STDERR_TAIL)
}

/** Most recent bridge stderr output, for diagnostics. */
export function getLastBridgeStderr(): string {
  return lastBridgeStderr
}

/**
 * Spawn command for the bridge script.
 *
 * The bridge is Python (bridge.py): it drives Win32 through ctypes and does
 * capture via mss/PIL, which the previous koffi-based JS port could not
 * reproduce (its native addon aborts on load, and callSync then swallowed the
 * crash and reported an empty result). `-u` keeps the JSON-lines protocol
 * unbuffered, which is required for request/response over stdin.
 */
function bridgeCommand(scriptPath: string): string[] {
  return ['python', '-u', scriptPath]
}

/**
 * Start the bridge process if not already running.
 */
export function ensureBridge(): boolean {
  if (bridgeProc) return true
  try {
    const scriptPath = resolveBridgeScript()
    if (!scriptPath) return false
    bridgeProc = bunSpawn(bridgeCommand(scriptPath), {
      stdin: 'pipe',
      stdout: 'pipe',
      stderr: 'pipe',
      env: { ...process.env, PYTHONIOENCODING: 'utf-8', PYTHONUNBUFFERED: '1' },
    })

    // Drain stderr so Python warnings/tracebacks surface in diagnostics
    // instead of being discarded. Never left unconsumed, which would block.
    const errStream = (bridgeProc.stderr as ReadableStream<Uint8Array> | null)
    if (errStream) {
      const errReader = errStream.getReader()
      const errDecoder = new TextDecoder()
      const errLoop = async () => {
        try {
          while (true) {
            const { done, value } = await errReader.read()
            if (done) break
            if (value) setLastBridgeStderr(errDecoder.decode(value))
          }
        } catch {}
      }
      errLoop()
    }

    // Read stdout lines asynchronously
    const reader = (bridgeProc.stdout as ReadableStream<Uint8Array>).getReader()
    const readLoop = async () => {
      try {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          outputBuffer += new TextDecoder().decode(value)
          // Process complete lines
          let newlineIdx: number
          while ((newlineIdx = outputBuffer.indexOf('\n')) !== -1) {
            const line = outputBuffer.slice(0, newlineIdx).trim()
            outputBuffer = outputBuffer.slice(newlineIdx + 1)
            if (!line) continue
            try {
              const resp: BridgeResponse = JSON.parse(line)
              const pending = pendingRequests.get(resp.id)
              if (pending) {
                pendingRequests.delete(resp.id)
                if (resp.error) {
                  pending.reject(new Error(resp.error))
                } else {
                  pending.resolve(resp.result)
                }
              }
            } catch {}
          }
        }
      } catch {}
    }
    readLoop()

    return true
  } catch {
    bridgeProc = null
    return false
  }
}

/**
 * Send a request to the Python bridge and wait for the response.
 */
export async function call<T = unknown>(
  method: string,
  params: Record<string, unknown> = {},
  timeoutMs: number = 10000,
): Promise<T> {
  if (!ensureBridge()) {
    throw new Error('Python bridge not available')
  }

  const id = ++requestId
  const req: BridgeRequest = { id, method, params }

  return new Promise<T>((resolve, reject) => {
    pendingRequests.set(id, {
      resolve: resolve as (v: unknown) => void,
      reject,
    })

    // Timeout
    const timer = setTimeout(() => {
      pendingRequests.delete(id)
      reject(new Error(`Bridge call ${method} timed out after ${timeoutMs}ms`))
    }, timeoutMs)

    // Clear timeout on resolve/reject
    const origResolve = resolve as (v: unknown) => void
    const origReject = reject
    pendingRequests.set(id, {
      resolve: v => {
        clearTimeout(timer)
        origResolve(v)
      },
      reject: e => {
        clearTimeout(timer)
        origReject(e)
      },
    })

    try {
      const stdin = bridgeProc!.stdin
      if (stdin) {
        const writable = stdin as unknown as Writable
        writable.write(JSON.stringify(req) + '\n')
        if (typeof (writable as any).flush === 'function') {
          ;(writable as any).flush()
        }
      }
    } catch (err) {
      clearTimeout(timer)
      pendingRequests.delete(id)
      reject(new Error(`Bridge write failed: ${err}`))
    }
  })
}

/**
 * Synchronous call — blocks the event loop. Use sparingly.
 * Spawns a one-shot process for sync calls.
 */
export function callSync<T = unknown>(
  method: string,
  params: Record<string, unknown> = {},
  timeoutMs: number = 10000,
): T | null {
  // SECURITY: JSON is passed via stdin (not embedded in -c) to prevent code injection.
  try {
    const scriptPath = resolveBridgeScript()
    if (!scriptPath) return null
    const req = JSON.stringify({ id: 1, method, params })
    const result = bunSpawnSync({
      cmd: bridgeCommand(scriptPath),
      stdin: Buffer.from(req + '\n'),
      stdout: 'pipe',
      stderr: 'pipe',
      env: { ...process.env, PYTHONIOENCODING: 'utf-8' },
      timeout: timeoutMs,
    })
    const out = new TextDecoder().decode(result.stdout).trim()
    setLastBridgeStderr(new TextDecoder().decode(result.stderr ?? new Uint8Array()).trim())
    if (!out) return null
    const resp: BridgeResponse = JSON.parse(out)
    if (resp.error) throw new Error(resp.error)
    return resp.result as T
  } catch (err) {
    // Preserve the cause for the caller's error message; returning a bare
    // null is what previously made every bridge failure indistinguishable.
    if (err instanceof Error && !lastBridgeStderr) setLastBridgeStderr(err.message)
    return null
  }
}

/**
 * Kill the bridge process.
 */
export function stopBridge(): void {
  if (bridgeProc) {
    try {
      const stdin = bridgeProc.stdin
      if (stdin) {
        const writable = stdin as unknown as Writable
        if (typeof writable.end === 'function') {
          writable.end()
        }
      }
      bridgeProc.kill()
    } catch {}
    bridgeProc = null
  }
  pendingRequests.clear()
  outputBuffer = ''
}

// NOTE: No process exit handlers here — the platform-level win32.ts
// already registers exit/SIGINT/SIGTERM handlers that call cleanupAll(),
// which includes stopBridge(). Adding handlers here would cause double
// cleanup and duplicate process.exit() calls.
