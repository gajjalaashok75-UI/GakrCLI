import { randomBytes } from 'node:crypto';
import { WebSocket } from 'ws';
import type { PtySessionEntry, ClientRole, ClientEntry, TerminalHistoryReplay, HistoryChunk } from './types.js';
import { createTerminalHistoryStore } from './historyStore.js';
import {
  destroyPtySession,
  resizePtySession,
  spawnGakrCliChrome,
  writeToPtySession,
} from './ptySession.js';

const PTY_SESSION_TIMEOUT = 30 * 60 * 1000;

const sessionManagerMap = new Map<string, PtySessionEntry>();
let sessionAttachCounter = 0;

function generateSessionId(): string {
  return `term_${Date.now()}_${randomBytes(8).toString('hex')}`;
}

export function getOrCreateSession(
  sessionId: string | null,
  launchDir: string,
  cols: number,
  rows: number
): { session: PtySessionEntry; isNew: boolean } {
  const key = sessionId || 'default';
  
  let existingSession = sessionManagerMap.get(key);
  
  if (existingSession) {
    if (existingSession.timeoutId) {
      clearTimeout(existingSession.timeoutId);
      existingSession.timeoutId = null;
    }
    return { session: existingSession, isNew: false };
  }

  const newSessionId = sessionId || generateSessionId();
  
  const newSession: PtySessionEntry = {
    pty: null as any,
    clients: new Map(),
    buffer: [],
    timeoutId: null,
    sessionId: newSessionId,
  };

  sessionManagerMap.set(newSessionId, newSession);
  return { session: newSession, isNew: true };
}

export function initializeSessionPty(
  session: PtySessionEntry,
  launchDir: string,
  cols: number,
  rows: number,
  onData: (data: string) => void,
  onExit: (exitCode: { exitCode: number | null; signal: string | null }) => void
): void {
  const ptyProcess = spawnGakrCliChrome({
    sessionId: session.sessionId,
    launchDir,
    cols,
    rows,
  });

  session.pty = ptyProcess;

  ptyProcess.onData((chunk: string) => {
    onData(chunk);
  });

  ptyProcess.onExit(({ exitCode, signal }) => {
    // node-pty reports the signal as a number; the wire protocol uses a name.
    onExit({
      exitCode: exitCode ?? null,
      signal: signal !== undefined ? String(signal) : null,
    });
  });
}

export function attachClient(
  session: PtySessionEntry,
  ws: WebSocket
): ClientRole {
  const attachedAt = ++sessionAttachCounter;
  const entry: ClientEntry = {
    role: 'observer',
    roleAnnounced: false,
    attachedAt,
  };
  // Drop sockets that already closed but whose close handler has not run yet.
  // Without this, a reconnect that wins the race against the previous socket's
  // close event would attach as an observer with no owner, so input would be
  // silently dropped.
  for (const socket of session.clients.keys()) {
    if (socket.readyState !== WebSocket.OPEN) {
      session.clients.delete(socket);
    }
  }

  session.clients.set(ws, entry);

  if (session.clients.size === 1) {
    entry.role = 'owner';
  }

  return entry.role;
}

export function detachClient(
  session: PtySessionEntry,
  ws: WebSocket,
  sessionId: string
): void {
  const client = session.clients.get(ws);
  if (!client) {
    return;
  }
  session.clients.delete(ws);

  if (session.clients.size === 0) {
    session.timeoutId = setTimeout(() => {
      const currentSession = sessionManagerMap.get(sessionId);
      if (currentSession !== session || currentSession.clients.size > 0) {
        return;
      }
      const historyStore = createTerminalHistoryStore();
      historyStore.deleteSession(sessionId);
      destroyPtySession(session);
      sessionManagerMap.delete(sessionId);
    }, PTY_SESSION_TIMEOUT);
  }
}

export function getSessionRole(session: PtySessionEntry, ws: WebSocket): ClientRole {
  return session.clients.get(ws)?.role ?? 'observer';
}

export function canWrite(session: PtySessionEntry, ws: WebSocket): boolean {
  return getSessionRole(session, ws) === 'owner';
}

export function canResize(session: PtySessionEntry, ws: WebSocket): boolean {
  return getSessionRole(session, ws) === 'owner';
}

export function getSession(sessionId: string): PtySessionEntry | undefined {
  return sessionManagerMap.get(sessionId);
}

export function getAllSessions(): PtySessionEntry[] {
  return Array.from(sessionManagerMap.values());
}

export function deleteSession(sessionId: string): void {
  const session = sessionManagerMap.get(sessionId);
  if (session) {
    if (session.timeoutId) {
      clearTimeout(session.timeoutId);
    }
    destroyPtySession(session);
    const historyStore = createTerminalHistoryStore();
    historyStore.deleteSession(sessionId);
    sessionManagerMap.delete(sessionId);
  }
}

export function writeInput(session: PtySessionEntry, data: string): void {
  writeToPtySession(session, data);
}

export function resizeSession(session: PtySessionEntry, cols: number, rows: number): void {
  resizePtySession(session, cols, rows);
}

export function appendToBuffer(session: PtySessionEntry, data: string): void {
  if (session.buffer.length < 5000) {
    session.buffer.push(data);
  } else {
    session.buffer.shift();
    session.buffer.push(data);
  }
}

export function getBuffer(session: PtySessionEntry): string[] {
  return session.buffer;
}

export function clearBuffer(session: PtySessionEntry): void {
  session.buffer = [];
}

export function replayHistory(sessionId: string): TerminalHistoryReplay {
  const historyStore = createTerminalHistoryStore();
  return historyStore.readSession(sessionId);
}

export function persistChunk(sessionId: string, data: string): void {
  const historyStore = createTerminalHistoryStore();
  historyStore.appendChunk(sessionId, data);
}

export function startHistorySession(sessionId: string): void {
  const historyStore = createTerminalHistoryStore();
  historyStore.startSession(sessionId);
}