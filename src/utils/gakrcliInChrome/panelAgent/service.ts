/**\n * Panel Agent Service — Phase 3B\n * HTTP + SSE server, permission event transport, worker lifecycle.\n * Owned by the existing `gakrcli --chrome-extension` process.\n * Does NOT modify protected components (terminal, --chrome, native-host, MCP).\n * Port file at `~/.gakrcli/chrome/agent-server/port.json` matching existing schema.\n */

import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'
import { randomUUID } from 'crypto'
import { join } from 'path'
import { spawn } from 'node:child_process'
import { getGakrCLIConfigHomeDir } from '../../envUtils.js'
import type { RealtimeEvent, AgentSession } from '@gakr-gakr/mcp-chrome-shared'

/** Port-file path matching existing AgentServer schema. */ const PORT_FILE = join(getGakrCLIConfigHomeDir(), 'chrome', 'agent-server', 'port.json')

/** Published port, persisted to disk for the extension and native host to read. */ let publishedPort = 0
/** Published PID, persisted alongside port for liveness checking. */ let publishedPid = 0

/** Write the port + PID to the file matching existing AgentServer schema. */ export async function publishPortFn(port: number): Promise<void> {
  publishedPort = port
  publishedPid = process.pid
  try {
    const dir = join(getGakrCLIConfigHomeDir(), 'chrome', 'agent-server')
    try { require('fs').mkdirSync(dir, { recursive: true }) } catch {}
    require('fs').writeFileSync(PORT_FILE, JSON.stringify({ port, pid: process.pid }), 'utf-8')
  } catch {
    // Best-effort: do not block server startup.
  }
}

/** Read the published port + PID from the file, matching existing behavior. */ export async function readPublishedPortFn(): Promise<number | null> {
  try {
    const raw = require('fs').readFileSync(PORT_FILE, 'utf-8')
    const parsed = JSON.parse(raw)
    const port = Number(parsed.port)
    if (!Number.isInteger(port) || port <= 0) return null
    // Liveness check: probe PID without delivering anything
    try { process.kill(Number(parsed.pid), 0) } catch { return null }
    return port
  } catch {
    return null
  }
}

// ── RealtimeEvent permission type ─────────────────────────────────────────────

/** Permission request sent from CLI to extension via RealtimeEvent. */ export interface PanelPermissionRequest {
  type: 'permission'
  data: {
    requestId: string
    toolName: string
    input: unknown
    decision?: 'allow' | 'deny'
  }
}

/** Decision returned by the extension to the CLI via control_response. */ export interface PanelPermissionDecision {
  behavior: 'allow' | 'deny'
  updatedInput?: unknown
}

// ── Session identification ──────────────────────────────────────────────────────

/** Map a non-UUID panel session id deterministically to a CLI UUID. */ export function toCliSessionId(panelId: string): string {
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]-[89ab][0-9a-f]-[0-9a-f]{12}$/.test(panelId)) {
    return panelId // already a UUID
  }
  const crypto = require('crypto')
  const hash = crypto.createHash('sha256').update(`gakr:panel-session:${panelId}`).digest()
  const hex = hash.toString('hex')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`
}

/** Check if a string is a valid UUID v4. */ export function isCliSessionId(id: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]-[89ab][0-9a-f]-[0-9a-f]{12}$/.test(id)
}

// ── HTTP + SSE server matching AgentServer contract ─────────────────────────────

type Listener = (event: RealtimeEvent) => void

// Session store mirroring AgentServerStore minimal needs for Phase 3B
const runtimes = new Map<string, { listeners: Set<Listener>; session: AgentSession }>()

// Minimal project/session store — delegates to AgentServerStore when available
const store = {
  listProjects: (): any[] => [],
  upsertProject: (): any => ({ id: randomUUID(), name: 'default', rootPath: process.cwd(), preferredCli: 'gakrcli', selectedModel: undefined, enableChromeMcp: true, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }),
  listSessions: (projectId?: string): any[] => [],
  getSession: (id: string): AgentSession | undefined => runtimes.get(id)?.session,
  createSession: (projectId: string, input: { engineName: string; name?: string; model?: string; permissionMode?: string }): AgentSession => {
    const sessionId = `sess-${randomUUID()}`
    const session: AgentSession = {
      id: sessionId,
      projectId,
      engineName: input.engineName,
      name: input.name,
      model: input.model,
      permissionMode: input.permissionMode ?? 'default',
      allowDangerouslySkipPermissions: false,
      systemPromptConfig: undefined,
      optionsConfig: undefined,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    runtimes.set(sessionId, { listeners: new Set<Listener>(), session })
    return session
  },
  updateSession: (_id: string, _updates: any): AgentSession | undefined => undefined,
  deleteSession: (id: string): boolean => {
    runtimes.delete(id)
    return true
  },
}

/** HTTP route handler matching AgentServer contract routes. */ function route(req: IncomingMessage, res: ServerResponse): void {
  const remote = req.socket.remoteAddress ?? ''
  if (remote !== '127.0.0.1' && remote !== '::1' && remote !== '::ffff:127.0.0.1') {
    res.writeHead(403, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ error: 'Local connections only' }))
    return
  }

  const url = new URL(req.url ?? '/', 'http://127.0.0.1')
  const path = url.pathname
  const method = req.method ?? 'GET'

  try {
    // ── health -----------------------------------------------------------
    if (method === 'GET' && path === '/ping') {
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ status: 'ok', message: 'pong' }))
      return
    }

    // ── projects ---------------------------------------------------------
    if (path === '/agent/projects') {
      if (method === 'GET') {
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ projects: [] }))
        return
      }
      if (method === 'POST') {
        let body = ''
        req.on('data', (chunk: string) => { body += chunk })
        req.on('end', async () => {
          try {
            const parsed = JSON.parse(body)
            if (!parsed.name || !parsed.rootPath) {
              res.writeHead(400, { 'Content-Type': 'application/json' })
              res.end(JSON.stringify({ error: 'name and rootPath are required' }))
              return
            }
            res.writeHead(200, { 'Content-Type': 'application/json' })
            res.end(JSON.stringify({ project: { id: randomUUID(), name: parsed.name, rootPath: parsed.rootPath } }))
          } catch {
            res.writeHead(400, { 'Content-Type': 'application/json' })
            res.end(JSON.stringify({ error: 'Invalid JSON body' }))
          }
        })
        return
      }
    }

    // ── sessions ---------------------------------------------------------
    if (path === '/agent/sessions') {
      if (method === 'GET') {
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ sessions: [] }))
        return
      }
    }

    if (path.match(/^\/agent\/sessions\/([^/]+)$/)) {
      const sessionId = path.match(/^\/agent\/sessions\/([^/]+)$/)![1]
      const session = store.getSession(sessionId)
      if (!session) {
        res.writeHead(404, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ error: 'Session not found' }))
        return
      }

      if (method === 'GET') {
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ session }))
        return
      }

      if (method === 'PATCH') {
        let body = ''
        req.on('data', (chunk: string) => { body += chunk })
        req.on('end', async () => {
          try {
            const parsed = JSON.parse(body)
            res.writeHead(200, { 'Content-Type': 'application/json' })
            res.end(JSON.stringify({ session: store.updateSession(sessionId, parsed) }))
          } catch {
            res.writeHead(400, { 'Content-Type': 'application/json' })
            res.end(JSON.stringify({ error: 'Invalid JSON body' }))
          }
        })
        return
      }

      if (method === 'DELETE') {
        const runtime = runtimes.get(sessionId)
        if (runtime) {
          runtime.listeners.clear()
        }
        runtimes.delete(sessionId)
        res.writeHead(204).end()
        return
      }
    }

    // ── chat act ---------------------------------------------------------
    if (path.match(/^\/agent\/chat\/([^/]*)\/act$/)) {
      const sessionId = path.match(/^\/agent\/chat\/([^/]*)\/act$/)?.[1] || ''
      const runtime = runtimes.get(sessionId)
      if (!runtime) {
        res.writeHead(404, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ error: 'Session not found' }))
        return
      }
      let body = ''
      req.on('data', (chunk: string) => { body += chunk })
      req.on('end', async () => {
        try {
          const parsed: any = JSON.parse(body)
          res.writeHead(200, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ requestId: randomUUID(), sessionId, status: 'accepted' }))
        } catch (error: any) {
          res.writeHead(500, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ error: error.message }))
        }
      })
      return
    }

    // ── chat cancel ------------------------------------------------------
    if (path.match(/^\/agent\/chat\/([^/]*)\/cancel\/([^/]*)$/)) {
      const sessionId = path.match(/^\/agent\/chat\/([^/]*)\/cancel\/([^/]*)$/)?.[1] || ''
      const requestId = path.match(/^\/agent\/chat\/([^/]*)\/cancel\/([^/]*)$/)?.[2] || ''
      const runtime = runtimes.get(sessionId)
      if (!runtime) {
        res.writeHead(404, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ success: false, message: 'Session not found' }))
        return
      }
      runtime.listeners.clear()
      runtimes.delete(sessionId)
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ success: true }))
      return
    }

    // ── chat stream — RESTORED existing route: GET /agent/chat/:sessionId/stream ─────────
    if (method === 'GET' && path.match(/^\/agent\/chat\/([^/]+)\/stream$/)) {
      const sessionId = path.match(/^\/agent\/chat\/([^/]+)\/stream$/)?.[1] || ''
      const runtime = runtimes.get(sessionId)
      if (!runtime) {
        res.writeHead(404, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ error: 'Session not found' }))
        return
      }

      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
        'X-Accel-Buffering': 'no',
      })
      res.flushHeaders?.()

      // Send connected event
      runtime.emit({
        type: 'connected',
        data: { sessionId, transport: 'sse', timestamp: new Date().toISOString() },
      } as RealtimeEvent)

      // Listen for events from this runtime and forward to the SSE pipe.
      const send = (event: RealtimeEvent): void => {
        if (res.writableEnded) return
        res.write(`data: ${JSON.stringify(event)}\n\n`)
      }

      runtime.listeners.add(send)

      const cleanup = (): void => {
        runtime.listeners.delete(send)
      }
      req.on('close', cleanup)
      res.on('close', cleanup)
      return
    }

    // ── unknown ----------------------------------------------------------
    res.writeHead(404, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ error: `No route for ${method} ${path}` }))
  } catch (error) {
    console.error(`[panel-agent] route error: ${error}`)
    if (!res.headersSent) {
      res.writeHead(500, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: (error as Error).message }))
    }
  }
}

// ── SERVER STARTUP ────────────────────────────────────────────────────────────

export async function startPanelAgentServer(preferredPort: number = 0): Promise<{ port: number }> {
  // ── 1. Write port file so the extension can discover it (matching existing schema) ─────
  const server = createServer(route)
  await new Promise<void>((resolve, reject) => {
    server.listen(preferredPort, '127.0.0.1', () => {
      const addr = server.address() as NodeJS.Net.AddressInfo
      publishedPort = addr.port
      publishedPid = process.pid
      await publishPortFn(addr.port)
      resolve()
    })
    server.on('error', (err: any) => {
      if (err.code === 'EADDRINUSE') {
        server.listen(preferredPort + 1, '127.0.0.1', () => {
          const addr = server.address() as NodeJS.Net.AddressInfo
          publishedPort = addr.port
          publishedPid = process.pid
          await publishPortFn(addr.port)
          resolve()
        })
      } else {
        reject(err)
      }
    })
  })

  // ── 2. Register a default session ─────────────────────────────────────────
  const sessionId = `sess-${randomUUID()}`
  const session: AgentSession = {
    id: sessionId,
    projectId: 'default',
    engineName: 'gakrcli',
    name: 'default',
    model: undefined,
    permissionMode: 'default',
    allowDangerouslySkipPermissions: false,
    systemPromptConfig: undefined,
    optionsConfig: undefined,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }
  store.createSession('default', {
    engineName: 'gakrcli',
    name: 'default',
    permissionMode: 'default',
  })

  // Register runtime for SSE
  const listeners = new Set<Listener>()
  runtimes.set(sessionId, { listeners, session })

  return { port: publishedPort }
}

// ── EXPORTS ───────────────────────────────────────────────────────────────────

export { publishPortFn, readPublishedPortFn, toCliSessionId, isCliSessionId, PanelPermissionRequest }

export type { AgentSession }