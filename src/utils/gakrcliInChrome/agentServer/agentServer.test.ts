/**
 * Tests for the Chrome agent server's HTTP surface.
 *
 * These assert the contract the side panel depends on: the exact paths it
 * calls, and the response envelope it reads (`{session}`, `{project}`,
 * `{sessions}`, `{messages}`). A shape change here is a silent UI break in the
 * extension, which no typecheck would catch.
 */

import { afterEach, beforeEach, describe, expect, it } from 'bun:test'
import { mkdtemp, rm } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'
import { AgentServer } from './httpServer.js'
import { getAgentServerStateDir } from './store.js'

let tmpRoot: string
let server: AgentServer
let baseUrl: string

/** Point the store at a scratch dir so tests never touch the real one. */
function useScratchStateDir(): void {
  process.env.GAKR_CONFIG_DIR = tmpRoot
}

beforeEach(async () => {
  tmpRoot = await mkdtemp(join(tmpdir(), 'chrome-agent-server-test-'))
  useScratchStateDir()
  server = new AgentServer(async () => ({ ok: true }))
  const port = await server.listen(0)
  baseUrl = `http://127.0.0.1:${port}`
})

afterEach(async () => {
  await server.close()
  await rm(tmpRoot, { recursive: true, force: true })
  delete process.env.GAKR_CONFIG_DIR
})

describe('health and discovery', () => {
  it('answers /ping', async () => {
    const res = await fetch(`${baseUrl}/ping`)
    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({ status: 'ok' })
  })

  it('lists engines for the panel picker', async () => {
    const res = await fetch(`${baseUrl}/agent/engines`)
    expect(res.status).toBe(200)
    const body = (await res.json()) as { engines: Array<{ name: string }> }
    expect(Array.isArray(body.engines)).toBe(true)
    expect(body.engines.length).toBeGreaterThan(0)
  })
})

describe('projects', () => {
  it('creates a project and returns it under a `project` key', async () => {
    const res = await fetch(`${baseUrl}/agent/projects`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'demo', rootPath: tmpRoot }),
    })
    expect(res.status).toBe(200)
    const body = (await res.json()) as { project: { id: string; name: string } }
    expect(body.project.id).toBeTruthy()
    expect(body.project.name).toBe('demo')
  })

  it('rejects a create with no name', async () => {
    const res = await fetch(`${baseUrl}/agent/projects`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rootPath: tmpRoot }),
    })
    expect(res.status).toBe(400)
  })

  it('validates a path without creating it', async () => {
    const res = await fetch(`${baseUrl}/agent/projects/validate-path`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rootPath: join(tmpRoot, 'does-not-exist') }),
    })
    expect(res.status).toBe(200)
    const body = (await res.json()) as {
      valid: boolean
      absolute: string
      needsCreation: boolean
    }
    expect(body.valid).toBe(true)
    expect(body.needsCreation).toBe(true)
    expect(body.absolute).toContain('does-not-exist')
  })

  it('returns the default root under `path`, the key the panel reads', async () => {
    const res = await fetch(`${baseUrl}/agent/projects/default-root`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ projectName: 'Default' }),
    })
    expect(res.status).toBe(200)
    const body = (await res.json()) as { path?: string }
    // The panel does `data.path` and bails silently when it is missing, which
    // leaves it with no project and makes the New button a no-op.
    expect(typeof body.path).toBe('string')
    expect(body.path).toContain('default')
  })

  it('creates a project from the default root the way the panel does', async () => {
    const rootRes = await fetch(`${baseUrl}/agent/projects/default-root`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ projectName: 'default' }),
    })
    const { path: defaultRoot } = (await rootRes.json()) as { path: string }

    const res = await fetch(`${baseUrl}/agent/projects`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Default',
        rootPath: defaultRoot,
        allowCreate: true,
      }),
    })
    expect(res.status).toBe(200)
    const body = (await res.json()) as { project: { id: string } }
    expect(body.project.id).toBeTruthy()

    // With a project selected the panel's New button proceeds past its guard.
    const sessions = await fetch(
      `${baseUrl}/agent/projects/${body.project.id}/sessions`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ engineName: 'claude' }),
      },
    )
    expect(sessions.status).toBe(200)
  })

  it('lists created projects', async () => {
    await fetch(`${baseUrl}/agent/projects`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'listed', rootPath: tmpRoot }),
    })
    const res = await fetch(`${baseUrl}/agent/projects`)
    const body = (await res.json()) as { projects: Array<{ name: string }> }
    expect(body.projects.map(p => p.name)).toContain('listed')
  })
})

describe('sessions', () => {
  async function makeProject(): Promise<string> {
    const res = await fetch(`${baseUrl}/agent/projects`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'p', rootPath: tmpRoot }),
    })
    const body = (await res.json()) as { project: { id: string } }
    return body.project.id
  }

  it('creates a session under a project and lists it back', async () => {
    const projectId = await makeProject()

    const created = await fetch(
      `${baseUrl}/agent/projects/${projectId}/sessions`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ engineName: 'gakrcli' }),
      },
    )
    expect(created.status).toBe(200)
    const body = (await created.json()) as { session: { id: string } }
    expect(body.session.id).toBeTruthy()

    const listed = await fetch(
      `${baseUrl}/agent/projects/${projectId}/sessions`,
    )
    const listBody = (await listed.json()) as { sessions: Array<{ id: string }> }
    expect(listBody.sessions.map(s => s.id)).toContain(body.session.id)
  })

  it('404s when creating a session under an unknown project', async () => {
    const res = await fetch(`${baseUrl}/agent/projects/nope/sessions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ engineName: 'gakrcli' }),
    })
    expect(res.status).toBe(404)
  })

  it('patches and deletes a session', async () => {
    const projectId = await makeProject()
    const created = await fetch(
      `${baseUrl}/agent/projects/${projectId}/sessions`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ engineName: 'gakrcli' }),
      },
    )
    const { session } = (await created.json()) as { session: { id: string } }

    const patched = await fetch(`${baseUrl}/agent/sessions/${session.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'renamed' }),
    })
    const patchedBody = (await patched.json()) as {
      session: { name: string }
    }
    expect(patchedBody.session.name).toBe('renamed')

    const deleted = await fetch(`${baseUrl}/agent/sessions/${session.id}`, {
      method: 'DELETE',
    })
    expect(deleted.status).toBe(204)
  })

  it('returns history for a session', async () => {
    const res = await fetch(
      `${baseUrl}/agent/sessions/unknown-session/history`,
    )
    expect(res.status).toBe(200)
    const body = (await res.json()) as { messages: unknown[] }
    expect(Array.isArray(body.messages)).toBe(true)
  })
})

describe('chat', () => {
  it('404s /act for an unknown session', async () => {
    const res = await fetch(`${baseUrl}/agent/chat/nope/act`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ instruction: 'hi' }),
    })
    expect(res.status).toBe(404)
  })

  it('404s the SSE stream for an unknown session', async () => {
    const res = await fetch(`${baseUrl}/agent/chat/nope/stream`)
    expect(res.status).toBe(404)
  })

  it('opens an SSE stream that emits a connected event', async () => {
    const created = await fetch(`${baseUrl}/agent/projects`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'sse', rootPath: tmpRoot }),
    })
    const { project } = (await created.json()) as { project: { id: string } }

    const sessionRes = await fetch(
      `${baseUrl}/agent/projects/${project.id}/sessions`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ engineName: 'gakrcli' }),
      },
    )
    const { session } = (await sessionRes.json()) as { session: { id: string } }

    const controller = new AbortController()
    const streamRes = await fetch(
      `${baseUrl}/agent/chat/${session.id}/stream`,
      { signal: controller.signal },
    )
    expect(streamRes.status).toBe(200)
    expect(streamRes.headers.get('content-type')).toContain('text/event-stream')

    const reader = streamRes.body!.getReader()
    const { value } = await reader.read()
    const text = new TextDecoder().decode(value)
    expect(text).toContain('data: ')
    expect(text).toContain('"type":"connected"')
    expect(text).toContain(session.id)

    controller.abort()
  })
})

describe('attachments', () => {
  it('reports stats with a success flag', async () => {
    const res = await fetch(`${baseUrl}/agent/attachments/stats`)
    expect(res.status).toBe(200)
    const body = (await res.json()) as { success: boolean; rootDir: string }
    expect(body.success).toBe(true)
    expect(typeof body.rootDir).toBe('string')
  })
})

describe('state directory', () => {
  it('honours GAKR_CONFIG_DIR so tests stay isolated', () => {
    expect(getAgentServerStateDir().startsWith(tmpRoot)).toBe(true)
  })
})