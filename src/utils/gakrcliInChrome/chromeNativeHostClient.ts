/**
 * Client side of the native-host socket, used by the agent server.
 *
 * The native host is the socket *server* (Chrome spawns it); this module is a
 * *client* that connects in to request browser tool calls. One connection is
 * kept open and multiplexed with `requestId` correlation so concurrent tool
 * calls do not receive each other's results.
 */

import { connect, type Socket } from 'net'
import { randomUUID } from 'crypto'
import { jsonParse, jsonStringify } from '../slowOperations.js'
import { getAllSocketPaths } from './common.js'

/** Chrome's own tool-call budget is 30s; fail just before it does. */
const TOOL_TIMEOUT_MS = 30_000
const MAX_MESSAGE_SIZE = 1024 * 1024

type PendingCall = {
  resolve: (value: unknown) => void
  reject: (error: Error) => void
  timer: ReturnType<typeof setTimeout>
}

let socket: Socket | null = null
let connecting: Promise<Socket> | null = null
let buffer = Buffer.alloc(0)
const pending = new Map<string, PendingCall>()

/** Connect to whichever native-host socket exists, reusing it if present. */
async function getSocket(): Promise<Socket> {
  if (socket && !socket.destroyed) {
    return socket
  }
  if (connecting) {
    return connecting
  }

  connecting = (async () => {
    const paths = getAllSocketPaths()
    if (paths.length === 0) {
      throw new Error(
        'No GakrCLI Chrome native host is running. Is Chrome open with the extension enabled?',
      )
    }

    let lastError: Error | null = null
    for (const path of paths) {
      try {
        const candidate = await new Promise<Socket>((resolve, reject) => {
          const conn = connect(path)
          conn.once('connect', () => resolve(conn))
          conn.once('error', reject)
        })
        attach(candidate)
        socket = candidate
        return candidate
      } catch (error) {
        lastError = error as Error
      }
    }
    throw lastError ?? new Error('Could not connect to the Chrome native host')
  })()

  try {
    return await connecting
  } finally {
    connecting = null
  }
}

function attach(conn: Socket): void {
  buffer = Buffer.alloc(0)

  conn.on('data', (data: Buffer) => {
    buffer = Buffer.concat([buffer, data])
    while (buffer.length >= 4) {
      const length = buffer.readUInt32LE(0)
      if (length === 0 || length > MAX_MESSAGE_SIZE) {
        conn.destroy()
        return
      }
      if (buffer.length < 4 + length) {
        break
      }
      const body = buffer.subarray(4, 4 + length).toString('utf-8')
      buffer = buffer.subarray(4 + length)

      let message: {
        responseToRequestId?: string
        payload?: { status?: string; data?: unknown; error?: string }
      }
      try {
        message = jsonParse(body)
      } catch {
        continue
      }

      const requestId = message.responseToRequestId
      if (!requestId) {
        continue
      }
      const call = pending.get(requestId)
      if (!call) {
        continue
      }
      pending.delete(requestId)
      clearTimeout(call.timer)

      if (message.payload?.status === 'error') {
        call.reject(
          new Error(message.payload.error ?? 'Extension tool call failed'),
        )
      } else {
        call.resolve(message.payload?.data)
      }
    }
  })

  conn.on('close', () => {
    if (socket === conn) {
      socket = null
    }
    // Nothing will answer these any more; fail them fast rather than waiting
    // out the full timeout.
    for (const [, call] of pending) {
      clearTimeout(call.timer)
      call.reject(new Error('Native host connection closed'))
    }
    pending.clear()
  })

  conn.on('error', () => {
    // Handled by the close handler above.
  })
}

function frame(body: string): Buffer {
  const payload = Buffer.from(body, 'utf-8')
  const header = Buffer.alloc(4)
  header.writeUInt32LE(payload.length, 0)
  return Buffer.concat([header, payload])
}

/**
 * Run one browser tool in the extension by its `chrome_*` name.
 *
 * Uses the extension's own tool names rather than the 18-name surface in
 * `@gakr-gakr/gakrcli-for-chrome-mcp` — the two vocabularies do not overlap, and
 * the extension is the side that actually implements them.
 */
export async function callExtensionTool(
  name: string,
  args: Record<string, unknown>,
): Promise<unknown> {
  const conn = await getSocket()
  const requestId = randomUUID()

  return new Promise<unknown>((resolve, reject) => {
    const timer = setTimeout(() => {
      pending.delete(requestId)
      reject(new Error(`Extension tool ${name} timed out after 30s`))
    }, TOOL_TIMEOUT_MS)
    timer.unref?.()

    pending.set(requestId, { resolve, reject, timer })

    conn.write(
      frame(
        jsonStringify({
          requestId,
          method: 'call_tool',
          params: { name, args },
        }),
      ),
    )
  })
}

/** Close the shared connection; used on shutdown. */
export function closeNativeHostConnection(): void {
  socket?.destroy()
  socket = null
}