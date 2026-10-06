/**
 * HTTP + SSE server for the GakrCLI-in-Chrome side panel.
 *
 * The side panel discovers this server's port from the native host
 * (`SERVER_STARTED`) and then talks plain HTTP to 127.0.0.1 on that port. The
 * route set here is dictated by `packages/chrome-extension` — every path and
 * response shape here has a caller there.
 *
 * Deliberately built on `node:http` rather than a framework: `src/` ships no
 * web framework today, and this surface is a fixed set of local-only routes.
 */

import { createServer, type IncomingMessage, type ServerResponse } from 'http'
import { mkdir, stat } from 'fs/promises'
import { join, resolve } from 'path'
import type { AddressInfo } from 'net'
import { getProjectsDir } from '../../envUtils.js'
import type { AgentActRequest, RealtimeEvent } from './contract.js'
import { AgentServerStore } from './store.js'
import { SessionRuntime, type ToolExecutor } from './runner.js'

/** Heartbeat interval; keeps proxies and the panel from idling the stream out. */
const SSE_HEARTBEAT_MS = 15_000

/** Cap on a single request body. Attachments arrive base64-encoded. */
const MAX_BODY_BYTES = 64 * 1024 * 1024

type RunTool = ToolExecutor

export class AgentServer {
  private readonly store = new AgentServerStore()
  private readonly runtimes = new Map<string, SessionRuntime>()
  private readonly server = createServer((req, res) => {
    void this.route(req, res)
  })
  private heartbeat: ReturnType<typeof setInterval> | null = null
  private boundPort: number | null = null

  constructor(private readonly runTool: RunTool) {}

  /** Start listening. Returns the port actually bound. */
  async listen(preferredPort: number): Promise<number> {
    await this.store.load()

    await new Promise<void>((resolvePromise, reject) => {
      const onError = (error: Error): void => {
        this.server.off('listening', onListening)
        reject(error)
      }
      const onListening = (): void => {
        this.server.off('error', onError)
        resolvePromise()
      }
      this.server.once('error', onError)
      this.server.once('listening', onListening)
      this.server.listen(preferredPort, '127.0.0.1')
    })

    const address = this.server.address() as AddressInfo
    this.boundPort = address.port

    this.heartbeat = setInterval(() => {
      for (const runtime of this.runtimes.values()) {
        runtime.emit({
          type: 'heartbeat',
          data: { timestamp: new Date().toISOString() },
        })
      }
    }, SSE_HEARTBEAT_MS)
    this.heartbeat.unref?.()

    return this.boundPort
  }

  get port(): number | null {
    return this.boundPort
  }

  async close(): Promise<void> {
    if (this.heartbeat) {
      clearInterval(this.heartbeat)
      this.heartbeat = null
    }
    for (const runtime of this.runtimes.values()) {
      await runtime.close()
    }
    this.runtimes.clear()
    await this.store.flush()
    await new Promise<void>(resolvePromise => {
      this.server.close(() => resolvePromise())
    })
  }

  // ------------------------------------------------------------- runtimes

  private runtimeFor(sessionId: string): SessionRuntime | undefined {
    const existing = this.runtimes.get(sessionId)
    if (existing) {
      return existing
    }
    const session = this.store.getSession(sessionId)
    if (!session) {
      return undefined
    }
    const runtime = new SessionRuntime(session, this.store, this.runTool)
    this.runtimes.set(sessionId, runtime)
    return runtime
  }

  // -------------------------------------------------------------- routing

  private async route(
    req: IncomingMessage,
    res: ServerResponse,
  ): Promise<void> {
    // Only loopback callers are expected; reject anything else outright.
    const remote = req.socket.remoteAddress ?? ''
    if (
      remote !== '127.0.0.1' &&
      remote !== '::1' &&
      remote !== '::ffff:127.0.0.1'
    ) {
      json(res, 403, { error: 'Local connections only' })
      return
    }

    const url = new URL(req.url ?? '/', 'http://127.0.0.1')
    const path = url.pathname
    const method = req.method ?? 'GET'

    try {
      await this.dispatch(req, res, method, path, url)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      if (!res.headersSent) {
        json(res, 500, { error: message })
      } else {
        res.end()
      }
    }
  }

  private async dispatch(
    req: IncomingMessage,
    res: ServerResponse,
    method: string,
    path: string,
    url: URL,
  ): Promise<void> {
    // -- health ----------------------------------------------------------
    if (method === 'GET' && path === '/ping') {
      json(res, 200, { status: 'ok', message: 'pong' })
      return
    }

    if (method === 'GET' && path === '/agent/engines') {
      // GakrCLI is the only engine actually implemented. `AgentCliPreference`
      // in mcp-chrome-shared also names claude/codex/cursor/qwen/glm, but no
      // adapter exists for them, so advertising them would offer a selection
      // that silently does nothing.
      json(res, 200, {
        engines: [{ name: 'gakrcli', supportsMcp: true }],
      })
      return
    }

    // -- projects --------------------------------------------------------
    if (path === '/agent/projects') {
      if (method === 'GET') {
        json(res, 200, { projects: this.store.listProjects() })
        return
      }
      if (method === 'POST') {
        const body = await readJson<{
          id?: string
          name: string
          rootPath: string
          description?: string
          preferredCli?: string
          selectedModel?: string
          useCcr?: boolean
          enableChromeMcp?: boolean
          allowCreate?: boolean
        }>(req)
        if (!body?.name || !body.rootPath) {
          json(res, 400, { error: 'name and rootPath are required' })
          return
        }
        const absolute = resolve(body.rootPath)
        const exists = await pathExists(absolute)
        if (!exists && !body.allowCreate) {
          json(res, 400, {
            error: `Directory does not exist: ${absolute}`,
          })
          return
        }
        if (!exists && body.allowCreate) {
          await mkdir(absolute, { recursive: true })
        }
        const project = this.store.upsertProject({
          id: body.id,
          name: body.name,
          rootPath: absolute,
          description: body.description,
          preferredCli: body.preferredCli as never,
          selectedModel: body.selectedModel,
          useCcr: body.useCcr,
          enableChromeMcp: body.enableChromeMcp,
        })
        json(res, 200, { project })
        return
      }
    }

    if (method === 'POST' && path === '/agent/projects/validate-path') {
      const body = await readJson<{ rootPath: string }>(req)
      if (!body?.rootPath) {
        json(res, 400, { valid: false, error: 'rootPath is required' })
        return
      }
      const absolute = resolve(body.rootPath)
      const exists = await pathExists(absolute)
      json(res, 200, {
        valid: true,
        absolute,
        exists,
        needsCreation: !exists,
      })
      return
    }

    if (method === 'POST' && path === '/agent/projects/default-root') {
      // The panel reads `data.path` and then POSTs it back to create the
      // project with `allowCreate: true`, so hand back a writable location
      // rather than the CLI's cwd.
      const body = await readJson<{ projectName?: string }>(req)
      const name = body?.projectName?.trim() || 'default'
      const dirPath = join(getProjectsDir(), slugify(name))
      await mkdir(dirPath, { recursive: true })
      json(res, 200, { path: dirPath })
      return
    }

    if (method === 'POST' && path === '/agent/projects/pick-directory') {
      // A native directory picker is not wired up; the panel already falls back
      // to manual entry when this 404s.
      json(res, 404, {
        error: 'Directory picker is not available in this build',
      })
      return
    }

    let match = path.match(/^\/agent\/projects\/([^/]+)\/open$/)
    if (method === 'POST' && match) {
      await this.openProject(res, match[1])
      return
    }

    match = path.match(/^\/agent\/projects\/([^/]+)\/sessions$/)
    if (match) {
      const projectId = decodeURIComponent(match[1])
      if (method === 'GET') {
        json(res, 200, { sessions: this.store.listSessions(projectId) })
        return
      }
      if (method === 'POST') {
        const body = await readJson<Record<string, unknown>>(req)
        if (!this.store.getProject(projectId)) {
          json(res, 404, { error: 'Project not found' })
          return
        }
        const session = this.store.createSession(projectId, {
          engineName: ((body?.engineName as string) ??
            'gakrcli') as never,
          name: body?.name as string | undefined,
          model: body?.model as string | undefined,
          permissionMode: body?.permissionMode as string | undefined,
        })
        json(res, 200, { session })
        return
      }
    }

    // -- project-scoped history ------------------------------------------
    match = path.match(/^\/agent\/chat\/([^/]+)\/messages$/)
    if (method === 'GET' && match) {
      const projectId = decodeURIComponent(match[1])
      const limit = Number(url.searchParams.get('limit') ?? '100')
      const messages = this.store.listProjectMessages(
        projectId,
        Number.isFinite(limit) ? limit : 100,
      )
      json(res, 200, {
        success: true,
        data: messages,
        totalCount: messages.length,
        pagination: { limit, offset: 0 },
      })
      return
    }

    // -- chat act / cancel / stream --------------------------------------
    match = path.match(/^\/agent\/chat\/([^/]+)\/act$/)
    if (method === 'POST' && match) {
      const sessionId = decodeURIComponent(match[1])
      const runtime = this.runtimeFor(sessionId)
      if (!runtime) {
        json(res, 404, { error: 'Session not found' })
        return
      }
      const body = await readJson<AgentActRequest>(req)
      if (!body?.instruction) {
        json(res, 400, { error: 'instruction is required' })
        return
      }
      const result = await runtime.act(body)
      json(res, 200, {
        requestId: result.requestId,
        sessionId,
        status: 'accepted',
      })
      return
    }

    match = path.match(/^\/agent\/chat\/([^/]+)\/cancel\/([^/]+)$/)
    if (method === 'DELETE' && match) {
      const sessionId = decodeURIComponent(match[1])
      const requestId = decodeURIComponent(match[2])
      const runtime = this.runtimeFor(sessionId)
      if (!runtime) {
        json(res, 404, { success: false, message: 'Session not found' })
        return
      }
      const cancelled = runtime.cancel(requestId)
      json(res, cancelled ? 200 : 404, {
        success: cancelled,
        ...(cancelled ? {} : { message: 'No matching active request' }),
      })
      return
    }

    match = path.match(/^\/agent\/chat\/([^/]+)\/stream$/)
    if (method === 'GET' && match) {
      this.streamSession(req, res, decodeURIComponent(match[1]))
      return
    }

    // -- sessions --------------------------------------------------------
    if (path === '/agent/sessions') {
      if (method === 'GET') {
        json(res, 200, { sessions: this.store.listSessions() })
        return
      }
    }

    match = path.match(/^\/agent\/sessions\/([^/]+)$/)
    if (match) {
      const sessionId = decodeURIComponent(match[1])
      if (method === 'GET') {
        const session = this.store.getSession(sessionId)
        if (!session) {
          json(res, 404, { error: 'Session not found' })
          return
        }
        json(res, 200, { session })
        return
      }
      if (method === 'PATCH') {
        const body = await readJson<Record<string, unknown>>(req)
        const session = this.store.updateSession(sessionId, body ?? {})
        if (!session) {
          json(res, 404, { error: 'Session not found' })
          return
        }
        json(res, 200, { session })
        return
      }
      if (method === 'DELETE') {
        const runtime = this.runtimes.get(sessionId)
        if (runtime) {
          await runtime.close()
          this.runtimes.delete(sessionId)
        }
        const deleted = this.store.deleteSession(sessionId)
        if (!deleted) {
          json(res, 404, { error: 'Session not found' })
          return
        }
        res.writeHead(204).end()
        return
      }
    }

    match = path.match(/^\/agent\/sessions\/([^/]+)\/history$/)
    if (method === 'GET' && match) {
      const sessionId = decodeURIComponent(match[1])
      json(res, 200, { messages: this.store.listMessages(sessionId) })
      return
    }

    match = path.match(/^\/agent\/sessions\/([^/]+)\/reset$/)
    if (method === 'POST' && match) {
      const sessionId = decodeURIComponent(match[1])
      const runtime = this.runtimes.get(sessionId)
      if (runtime) {
        await runtime.close()
        this.runtimes.delete(sessionId)
      }
      const result = this.store.resetSession(sessionId)
      if (!result) {
        json(res, 404, { error: 'Session not found' })
        return
      }
      json(res, 200, {
        ...result,
        session: this.store.getSession(sessionId),
      })
      return
    }

    match = path.match(/^\/agent\/sessions\/([^/]+)\/claude-info$/)
    if (method === 'GET' && match) {
      const sessionId = decodeURIComponent(match[1])
      const session = this.store.getSession(sessionId)
      if (!session) {
        json(res, 404, { error: 'Session not found' })
        return
      }
      json(res, 200, {
        managementInfo: session.managementInfo ?? null,
        sessionId,
        engineName: session.engineName,
      })
      return
    }

    match = path.match(/^\/agent\/sessions\/([^/]+)\/open$/)
    if (method === 'POST' && match) {
      const session = this.store.getSession(decodeURIComponent(match[1]))
      if (!session) {
        json(res, 404, { success: false, error: 'Session not found' })
        return
      }
      await this.openProjectRoot(res, session.projectId)
      return
    }

    // -- attachments -----------------------------------------------------
    if (method === 'GET' && path === '/agent/attachments/stats') {
      const stats = await this.store.collectAttachmentStats()
      json(res, 200, { success: true, ...stats })
      return
    }

    if (method === 'DELETE' && path === '/agent/attachments') {
      const body = await readJson<{ projectIds?: string[] }>(req)
      const projectIds = body?.projectIds
      const result = await this.store.clearAttachments(projectIds)
      json(res, 200, {
        success: true,
        scope: projectIds?.length ? 'selected' : 'all',
        ...result,
      })
      return
    }

    json(res, 404, { error: `No route for ${method} ${path}` })
  }

  // --------------------------------------------------------------- helpers

  /**
   * SSE stream for one session.
   *
   * The panel connects before POSTing `/act` and keeps the connection open for
   * the life of the session, so this registers a listener rather than
   * streaming a finite response.
   */
  private streamSession(
    req: IncomingMessage,
    res: ServerResponse,
    sessionId: string,
  ): void {
    const runtime = this.runtimeFor(sessionId)
    if (!runtime) {
      json(res, 404, { error: 'Session not found' })
      return
    }

    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      // Defeats proxy buffering that would otherwise hold tokens back.
      'X-Accel-Buffering': 'no',
    })
    res.flushHeaders?.()

    const send = (event: RealtimeEvent): void => {
      if (res.writableEnded) {
        return
      }
      res.write(`data: ${JSON.stringify(event)}\n\n`)
    }

    send({
      type: 'connected',
      data: {
        sessionId,
        transport: 'sse',
        timestamp: new Date().toISOString(),
      },
    })

    runtime.listeners.add(send)

    const cleanup = (): void => {
      runtime.listeners.delete(send)
    }
    req.on('close', cleanup)
    res.on('close', cleanup)
  }

  private async openProject(
    res: ServerResponse,
    projectId: string,
  ): Promise<void> {
    const project = this.store.getProject(projectId)
    if (!project) {
      json(res, 404, { success: false, error: 'Project not found' })
      return
    }
    await this.openProjectRoot(res, projectId)
  }

  private async openProjectRoot(
    res: ServerResponse,
    projectId: string,
  ): Promise<void> {
    const project = this.store.getProject(projectId)
    if (!project) {
      json(res, 404, { success: false, error: 'Project not found' })
      return
    }
    if (!(await pathExists(project.rootPath))) {
      json(res, 200, {
        success: false,
        error: `Project directory no longer exists: ${project.rootPath}`,
      })
      return
    }
    // The panel treats a 200 `{success:true}` as "opened"; the actual
    // hand-off to an editor/terminal is left to the CLI's own launchers.
    json(res, 200, { success: true })
  }

  }

/** Filesystem-safe directory name derived from a user-supplied project name. */
function slugify(name: string): string {
  const slug = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return slug || 'default'
}

function json(res: ServerResponse, status: number, body: unknown): void {
  const payload = JSON.stringify(body)
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(payload),
  })
  res.end(payload)
}

async function pathExists(path: string): Promise<boolean> {
  try {
    const info = await stat(path)
    return info.isDirectory()
  } catch {
    return false
  }
}

async function readJson<T>(req: IncomingMessage): Promise<T | undefined> {
  const chunks: Buffer[] = []
  let total = 0
  for await (const chunk of req) {
    const buf = chunk as Buffer
    total += buf.length
    if (total > MAX_BODY_BYTES) {
      throw new Error('Request body too large')
    }
    chunks.push(buf)
  }
  if (total === 0) {
    return undefined
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf-8')) as T
  } catch {
    return undefined
  }
}