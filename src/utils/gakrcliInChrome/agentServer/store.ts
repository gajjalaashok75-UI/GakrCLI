/**
 * Persistent store for the GakrCLI-in-Chrome agent server.
 *
 * Holds the three entities the side panel browses (projects, sessions,
 * messages) plus the on-disk attachment cache. State lives in a single JSON
 * file under `~/.gakrcli/chrome/agent-server/` so a server restart does not lose
 * the user's projects.
 *
 * Writes are debounced: `/agent/chat/:id/act` persists every streamed message,
 * and writing on each delta would make streaming crawl.
 */

import { randomUUID } from 'crypto'
import {
  mkdir,
  readFile,
  rm,
  readdir,
  stat,
  writeFile,
} from 'fs/promises'
import { homedir } from 'os'
import { join } from 'path'
import { getGakrCLIConfigHomeDir } from '../../envUtils.js'
import { jsonParse, jsonStringify } from '../../slowOperations.js'
import type {
  AgentCliPreference,
  AgentMessage,
  AgentProject,
  AgentSession,
  AgentStoredMessage,
  CreateAgentSessionInput,
  UpdateAgentSessionInput,
} from './contract.js'

/** How long to coalesce writes before flushing to disk. */
const WRITE_DEBOUNCE_MS = 400

type StoreShape = {
  projects: AgentProject[]
  sessions: AgentSession[]
  messages: AgentStoredMessage[]
}

export function getAgentServerStateDir(): string {
  return join(getGakrCLIConfigHomeDir(), 'chrome', 'agent-server')
}

function getStateFilePath(): string {
  return join(getAgentServerStateDir(), 'state.json')
}

/** Per-project directory holding attachments uploaded from the side panel. */
export function getAttachmentsRootDir(): string {
  return join(getAgentServerStateDir(), 'attachments')
}

export function getProjectAttachmentsDir(projectId: string): string {
  return join(getAttachmentsRootDir(), projectId)
}

function emptyState(): StoreShape {
  return { projects: [], sessions: [], messages: [] }
}

/**
 * Projects + sessions + messages, persisted as one JSON document.
 *
 * Reads are served from memory; writes are debounced and best-effort. A failed
 * write must not take down the server — losing history is bad, but so is
 * dropping the user's in-flight chat because the disk is full.
 */
export class AgentServerStore {
  private state: StoreShape = emptyState()
  private loaded = false
  private writeTimer: ReturnType<typeof setTimeout> | null = null
  private writeChain: Promise<void> = Promise.resolve()

  async load(): Promise<void> {
    if (this.loaded) {
      return
    }
    this.loaded = true
    try {
      const raw = await readFile(getStateFilePath(), 'utf-8')
      const parsed = jsonParse(raw) as Partial<StoreShape>
      this.state = {
        projects: Array.isArray(parsed.projects) ? parsed.projects : [],
        sessions: Array.isArray(parsed.sessions) ? parsed.sessions : [],
        messages: Array.isArray(parsed.messages) ? parsed.messages : [],
      }
    } catch {
      // Missing or corrupt state file: start clean rather than refusing to boot.
      this.state = emptyState()
    }
  }

  /** Queue a debounced write. Safe to call on every streamed delta. */
  private persist(): void {
    if (this.writeTimer) {
      return
    }
    this.writeTimer = setTimeout(() => {
      this.writeTimer = null
      void this.flush()
    }, WRITE_DEBOUNCE_MS)
    // Do not hold the event loop open just for a pending debounce.
    this.writeTimer.unref?.()
  }

  async flush(): Promise<void> {
    if (this.writeTimer) {
      clearTimeout(this.writeTimer)
      this.writeTimer = null
    }
    const snapshot = jsonStringify(this.state, null, 2)
    // Serialize writes so two flushes cannot interleave on the same file.
    this.writeChain = this.writeChain.then(async () => {
      try {
        await mkdir(getAgentServerStateDir(), { recursive: true })
        await writeFile(getStateFilePath(), snapshot, 'utf-8')
      } catch {
        // Best-effort persistence.
      }
    })
    return this.writeChain
  }

  // ---------------------------------------------------------------- projects

  listProjects(): AgentProject[] {
    return [...this.state.projects].sort((a, b) =>
      (b.lastActiveAt ?? b.updatedAt).localeCompare(
        a.lastActiveAt ?? a.updatedAt,
      ),
    )
  }

  getProject(id: string): AgentProject | undefined {
    return this.state.projects.find(p => p.id === id)
  }

  createProject(input: {
    name: string
    rootPath: string
    description?: string
    preferredCli?: AgentCliPreference
    selectedModel?: string
    allowCreate?: boolean
  }): AgentProject {
    const now = new Date().toISOString()
    const project: AgentProject = {
      id: randomUUID(),
      name: input.name,
      rootPath: input.rootPath,
      description: input.description,
      preferredCli: input.preferredCli,
      selectedModel: input.selectedModel,
      enableChromeMcp: true,
      createdAt: now,
      updatedAt: now,
      lastActiveAt: now,
    }
    this.state.projects.push(project)
    this.persist()
    return project
  }

  /**
   * Upsert a project. The panel POSTs the same shape for both "create" and
   * "save preferences" — presence of `id` decides which one this is.
   */
  upsertProject(input: {
    id?: string
    name: string
    rootPath: string
    description?: string
    preferredCli?: AgentCliPreference
    selectedModel?: string
    useCcr?: boolean
    enableChromeMcp?: boolean
  }): AgentProject {
    if (input.id) {
      const existing = this.getProject(input.id)
      if (existing) {
        Object.assign(existing, {
          name: input.name,
          rootPath: input.rootPath,
          description: input.description ?? existing.description,
          preferredCli: input.preferredCli ?? existing.preferredCli,
          selectedModel: input.selectedModel ?? existing.selectedModel,
          useCcr: input.useCcr ?? existing.useCcr,
          enableChromeMcp: input.enableChromeMcp ?? existing.enableChromeMcp,
          updatedAt: new Date().toISOString(),
        })
        this.persist()
        return existing
      }
    }
    return this.createProject(input)
  }

  touchProject(id: string): void {
    const project = this.getProject(id)
    if (project) {
      project.lastActiveAt = new Date().toISOString()
      this.persist()
    }
  }

  // ---------------------------------------------------------------- sessions

  listSessions(projectId?: string): AgentSession[] {
    const sessions = projectId
      ? this.state.sessions.filter(s => s.projectId === projectId)
      : this.state.sessions
    return [...sessions].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  }

  getSession(id: string): AgentSession | undefined {
    return this.state.sessions.find(s => s.id === id)
  }

  createSession(
    projectId: string,
    input: CreateAgentSessionInput,
  ): AgentSession {
    const now = new Date().toISOString()
    const session: AgentSession = {
      id: randomUUID(),
      projectId,
      engineName: input.engineName,
      name: input.name,
      model: input.model,
      permissionMode: input.permissionMode ?? 'default',
      allowDangerouslySkipPermissions:
        input.allowDangerouslySkipPermissions ?? false,
      systemPromptConfig: input.systemPromptConfig,
      optionsConfig: input.optionsConfig,
      createdAt: now,
      updatedAt: now,
    }
    this.state.sessions.push(session)
    this.touchProject(projectId)
    this.persist()
    return session
  }

  updateSession(
    id: string,
    updates: UpdateAgentSessionInput,
  ): AgentSession | undefined {
    const session = this.getSession(id)
    if (!session) {
      return undefined
    }
    // The panel sends explicit nulls to clear a field.
    for (const [key, value] of Object.entries(updates)) {
      if (value === undefined) {
        continue
      }
      // biome-ignore lint/suspicious/noExplicitAny: targeted field assignment
      ;(session as any)[key] = value
    }
    session.updatedAt = new Date().toISOString()
    this.persist()
    return session
  }

  deleteSession(id: string): boolean {
    const index = this.state.sessions.findIndex(s => s.id === id)
    if (index === -1) {
      return false
    }
    this.state.sessions.splice(index, 1)
    this.state.messages = this.state.messages.filter(m => m.sessionId !== id)
    this.persist()
    return true
  }

  /**
   * Clear a conversation: drop messages, forget the engine session id so the
   * next turn starts a fresh engine session rather than resuming the old one.
   */
  resetSession(
    id: string,
  ): { deletedMessages: number; clearedEngineSessionId: boolean } | undefined {
    const session = this.getSession(id)
    if (!session) {
      return undefined
    }
    const before = this.state.messages.length
    this.state.messages = this.state.messages.filter(m => m.sessionId !== id)
    const deletedMessages = before - this.state.messages.length
    const hadEngineSession = Boolean(session.engineSessionId)
    session.engineSessionId = undefined
    session.preview = undefined
    session.updatedAt = new Date().toISOString()
    this.persist()
    return { deletedMessages, clearedEngineSessionId: hadEngineSession }
  }

  // ---------------------------------------------------------------- messages

  listMessages(sessionId: string, limit?: number): AgentStoredMessage[] {
    const messages = this.state.messages.filter(m => m.sessionId === sessionId)
    const ordered = [...messages].sort((a, b) =>
      (a.createdAt ?? '').localeCompare(b.createdAt ?? ''),
    )
    return limit ? ordered.slice(-limit) : ordered
  }

  /** Project-scoped history, used by `/agent/chat/:projectId/messages`. */
  listProjectMessages(
    projectId: string,
    limit?: number,
  ): AgentStoredMessage[] {
    const messages = this.state.messages.filter(
      m => m.projectId === projectId,
    )
    const ordered = [...messages].sort((a, b) =>
      (a.createdAt ?? '').localeCompare(b.createdAt ?? ''),
    )
    return limit ? ordered.slice(-limit) : ordered
  }

  addMessage(message: Omit<AgentStoredMessage, 'id' | 'createdAt'> & {
    id?: string
    createdAt?: string
  }): AgentStoredMessage {
    const stored: AgentStoredMessage = {
      ...message,
      id: message.id ?? randomUUID(),
      createdAt: message.createdAt ?? new Date().toISOString(),
    }
    this.state.messages.push(stored)
    // First user message doubles as the session preview in the session list.
    const session = this.getSession(stored.sessionId)
    if (session && stored.role === 'user' && !session.preview) {
      session.preview = stored.content.slice(0, 120)
    }
    this.persist()
    return stored
  }

  /** Replace a message in place — used to collapse streamed deltas. */
  updateMessage(
    id: string,
    patch: Partial<AgentStoredMessage>,
  ): AgentStoredMessage | undefined {
    const message = this.state.messages.find(m => m.id === id)
    if (!message) {
      return undefined
    }
    Object.assign(message, patch)
    this.persist()
    return message
  }

  // ------------------------------------------------------------- attachments

  /**
   * Per-project attachment cache usage.
   *
   * Directories that no longer correspond to a project are reported as orphans
   * rather than deleted: the panel shows them so the user can reclaim the
   * space deliberately.
   */
  async collectAttachmentStats(): Promise<{
    rootDir: string
    totalFiles: number
    totalBytes: number
    projects: Array<{
      projectId: string
      projectName?: string
      dirPath: string
      exists: boolean
      fileCount: number
      totalBytes: number
      lastModifiedAt?: string
      existsInDb: boolean
    }>
    orphanProjectIds: string[]
  }> {
    const rootDir = getAttachmentsRootDir()
    const known = new Map(this.state.projects.map(p => [p.id, p]))
    const results: Array<{
      projectId: string
      projectName?: string
      dirPath: string
      exists: boolean
      fileCount: number
      totalBytes: number
      lastModifiedAt?: string
      existsInDb: boolean
    }> = []
    const orphanProjectIds: string[] = []

    let entries: string[] = []
    try {
      entries = await readdir(rootDir)
    } catch {
      entries = []
    }

    for (const projectId of entries) {
      const dirPath = join(rootDir, projectId)
      const usage = await measureDir(dirPath)
      const project = known.get(projectId)
      if (!project) {
        orphanProjectIds.push(projectId)
      }
      results.push({
        projectId,
        projectName: project?.name,
        dirPath,
        exists: usage.exists,
        fileCount: usage.fileCount,
        totalBytes: usage.totalBytes,
        lastModifiedAt: usage.lastModifiedAt,
        existsInDb: Boolean(project),
      })
    }

    return {
      rootDir,
      totalFiles: results.reduce((sum, r) => sum + r.fileCount, 0),
      totalBytes: results.reduce((sum, r) => sum + r.totalBytes, 0),
      projects: results,
      orphanProjectIds,
    }
  }

  async clearAttachments(projectIds?: string[]): Promise<{
    removedFiles: number
    removedBytes: number
    results: Array<{
      projectId: string
      dirPath: string
      existed: boolean
      removedFiles: number
      removedBytes: number
    }>
  }> {
    const stats = await this.collectAttachmentStats()
    const targets = projectIds?.length
      ? stats.projects.filter(p => projectIds.includes(p.projectId))
      : stats.projects

    const results: Array<{
      projectId: string
      dirPath: string
      existed: boolean
      removedFiles: number
      removedBytes: number
    }> = []

    for (const target of targets) {
      let existed = false
      try {
        await rm(target.dirPath, { recursive: true, force: true })
        existed = target.exists
      } catch {
        // Treat as not removed; report what we know.
      }
      results.push({
        projectId: target.projectId,
        dirPath: target.dirPath,
        existed,
        removedFiles: target.fileCount,
        removedBytes: target.totalBytes,
      })
    }

    return {
      removedFiles: results.reduce((s, r) => s + r.removedFiles, 0),
      removedBytes: results.reduce((s, r) => s + r.removedBytes, 0),
      results,
    }
  }
}

async function measureDir(dirPath: string): Promise<{
  exists: boolean
  fileCount: number
  totalBytes: number
  lastModifiedAt?: string
}> {
  try {
    const info = await stat(dirPath)
    if (!info.isDirectory()) {
      return { exists: false, fileCount: 0, totalBytes: 0 }
    }
    let fileCount = 0
    let totalBytes = 0
    const walk = async (current: string): Promise<void> => {
      let entries: import('fs').Dirent[]
      try {
        entries = await readdir(current, { withFileTypes: true })
      } catch {
        return
      }
      for (const entry of entries) {
        const full = join(current, entry.name)
        if (entry.isDirectory()) {
          await walk(full)
        } else {
          try {
            const fileInfo = await stat(full)
            fileCount += 1
            totalBytes += fileInfo.size
          } catch {
            // Skip files that vanished mid-walk.
          }
        }
      }
    }
    await walk(dirPath)
    return {
      exists: true,
      fileCount,
      totalBytes,
      lastModifiedAt: new Date(info.mtimeMs).toISOString(),
    }
  } catch {
    return { exists: false, fileCount: 0, totalBytes: 0 }
  }
}

/** Convert a stored message into the shape the SSE stream carries. */
export function storedToAgentMessage(m: AgentStoredMessage): AgentMessage {
  return {
    id: m.id,
    sessionId: m.sessionId,
    role: m.role,
    content: m.content,
    messageType: m.messageType,
    cliSource: m.cliSource ?? undefined,
    requestId: m.requestId,
    createdAt: m.createdAt ?? new Date().toISOString(),
    metadata: m.metadata,
  }
}

/** Default project root offered when the panel asks for one. */
export function getDefaultProjectRoot(): string {
  return homedir()
}