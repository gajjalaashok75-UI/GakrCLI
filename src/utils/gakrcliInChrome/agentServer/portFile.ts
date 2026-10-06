/**
 * Port-file handshake between the agent server and the native host.
 *
 * The two run in different processes and neither can spawn the other: Chrome
 * spawns the native host, the user starts the CLI. A file in the shared config
 * directory is the whole coordination mechanism, which keeps the native host's
 * module graph free of the agent SDK.
 */

import { mkdir, readFile, rm, writeFile } from 'fs/promises'
import { join } from 'path'
import { getAgentServerStateDir } from './store.js'

function getPortFilePath(): string {
  return join(getAgentServerStateDir(), 'port.json')
}

/**
 * Read the port of a live agent server.
 *
 * Returns null when there is no server, or when the file is stale — a port file
 * left behind by a crashed process must not make the extension believe a server
 * is listening. Liveness is checked with signal 0, which probes without
 * delivering anything.
 */
export async function readPublishedPort(): Promise<number | null> {
  try {
    const raw = await readFile(getPortFilePath(), 'utf-8')
    const parsed = JSON.parse(raw) as { port?: unknown; pid?: unknown }
    const port = Number(parsed.port)
    if (!Number.isInteger(port) || port <= 0) {
      return null
    }
    const pid = Number(parsed.pid)
    if (Number.isInteger(pid) && pid > 0) {
      try {
        process.kill(pid, 0)
      } catch {
        return null
      }
    }
    return port
  } catch {
    return null
  }
}

export async function publishPort(port: number): Promise<void> {
  await mkdir(getAgentServerStateDir(), { recursive: true })
  await writeFile(
    getPortFilePath(),
    JSON.stringify({ port, pid: process.pid }),
    'utf-8',
  )
}

export async function clearPublishedPort(): Promise<void> {
  await rm(getPortFilePath(), { force: true })
}