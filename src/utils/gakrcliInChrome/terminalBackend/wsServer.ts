import { WebSocketServer, WebSocket, type RawData } from 'ws';
import type { Server as HttpServer } from 'node:http';
import { randomBytes } from 'node:crypto';
import { TERMINAL_WS_PATH } from './discoveryServer.js';
import type {
  WsIncomingMessage,
  WsOutgoingMessage,
  TerminalBackendConfig,
} from './types.js';
import {
  getOrCreateSession,
  getSession,
  hasPty,
  initializeSessionPty,
  attachClient,
  detachClient,
  canWrite,
  canResize,
  writeInput,
  resizeSession,
  appendToBuffer,
  getBuffer,
  replayHistory,
  persistChunk,
  startHistorySession,
  deleteSession,
} from './sessionManager.js';

function sendToClient(ws: WebSocket, payload: WsOutgoingMessage): void {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(payload));
  }
}

function validateAuthToken(config: TerminalBackendConfig, token: string | null): boolean {
  return token !== null && token === config.authToken;
}

/**
 * The upgrade must prove it is the configured extension origin. There is no
 * permissive fallback: without a configured extension id the backend refuses
 * every connection, exactly like the discovery endpoint, so an unconfigured
 * backend never becomes an unauthenticated terminal.
 */
function validateOrigin(config: TerminalBackendConfig, origin: string | undefined): boolean {
  if (!config.allowedOrigin) {
    return false;
  }
  return origin === config.allowedOrigin;
}

function parseWsMessage(rawMessage: RawData): WsIncomingMessage | null {
  try {
    const text = rawMessage.toString('utf8');
    const parsed = JSON.parse(text);
    if (!parsed || typeof parsed.type !== 'string') {
      return null;
    }
    return parsed as WsIncomingMessage;
  } catch {
    return null;
  }
}

function readDimension(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0
    ? Math.floor(value)
    : fallback;
}

export function createWsServer(
  config: TerminalBackendConfig,
  server: HttpServer,
): WebSocketServer {
  // Shares the discovery HTTP server: no second listening socket, and upgrade
  // requests are only accepted on the terminal path.
  const wss = new WebSocketServer({
    server,
    path: TERMINAL_WS_PATH,
    maxPayload: 1024 * 1024,
  });

  console.log(
    `[TerminalBackend] WebSocket listening on ws://${config.host}:${config.port}${TERMINAL_WS_PATH}`,
  );

  wss.on('connection', (ws: WebSocket, req) => {
    const url = new URL(req.url || '', `http://${config.host}:${config.port}`);
    const token = url.searchParams.get('token');
    const origin = req.headers.origin;

    if (!validateAuthToken(config, token)) {
      ws.close(4001, 'Unauthorized: Invalid or missing authentication token');
      return;
    }

    if (!validateOrigin(config, origin)) {
      ws.close(4003, 'Forbidden: Invalid origin');
      return;
    }

    console.log('[TerminalBackend] Client connected');

    let currentSessionId: string | null = null;

    const broadcast = (payload: WsOutgoingMessage): void => {
      if (currentSessionId === null) {
        return;
      }
      const session = getSession(currentSessionId);
      if (!session) {
        return;
      }
      session.clients.forEach((_client, socket) => sendToClient(socket, payload));
    };

    ws.on('message', (rawMessage: RawData) => {
      try {
        const message = parseWsMessage(rawMessage);
        if (!message) {
          sendToClient(ws, { type: 'error', message: 'Invalid message format' });
          return;
        }

        if (message.type === 'init') {
          const cols = readDimension(message.cols, 120);
          const rows = readDimension(message.rows, 35);
          const requestedSessionId =
            typeof message.sessionId === 'string' && message.sessionId.length > 0
              ? message.sessionId
              : null;

          const { session } = getOrCreateSession(requestedSessionId, config.launchDir, cols, rows);

          // Re-init to a different session: detach this socket from the old
          // entry so it stops counting toward that PTY's occupancy.
          if (currentSessionId !== null && currentSessionId !== session.sessionId) {
            const previous = getSession(currentSessionId);
            if (previous) {
              const { changes } = detachClient(previous, ws, currentSessionId);
              changes.forEach((change) =>
                sendToClient(change.ws, { type: 'role_changed', role: change.role }),
              );
            }
          }
          currentSessionId = session.sessionId;

          if (!hasPty(session)) {
            startHistorySession(session.sessionId);
            initializeSessionPty(
              session,
              config.launchDir,
              cols,
              rows,
              (chunk: string) => {
                appendToBuffer(session, chunk);
                persistChunk(session.sessionId, chunk);
                broadcast({ type: 'output', data: chunk });
              },
              (exitCode) => {
                broadcast({ type: 'exit', code: exitCode.exitCode, signal: exitCode.signal });
                deleteSession(session.sessionId);
              },
            );
          } else if (session.timeoutId) {
            // A reattach cancels the idle reap that a full detach armed.
            clearTimeout(session.timeoutId);
            session.timeoutId = null;
          }

          const { role, changes } = attachClient(session, ws);
          sendToClient(ws, { type: 'attached', role, sessionId: session.sessionId });
          changes.forEach((change) =>
            sendToClient(change.ws, { type: 'role_changed', role: change.role }),
          );

          const historyReplay = replayHistory(session.sessionId);
          if (historyReplay.hadContent) {
            sendToClient(ws, { type: 'history', chunks: historyReplay.chunks });
          } else {
            // No persisted history for this session yet: replay whatever the
            // in-memory buffer holds so a mid-session reconnect is not blank.
            getBuffer(session).forEach((chunk) =>
              sendToClient(ws, { type: 'output', data: chunk }),
            );
          }

          const note = historyReplay.hadContent
            ? `\x1b[36m[Reattached to session: ${session.sessionId}]\x1b[0m\r\n`
            : `\x1b[36m[Terminal session: ${session.sessionId}]\x1b[0m\r\n`;
          sendToClient(ws, { type: 'output', data: note });
          return;
        }

        if (currentSessionId === null) {
          sendToClient(ws, { type: 'error', message: 'Session not initialized. Send init first.' });
          return;
        }

        // A non-init frame is only valid for the session this socket attached
        // to. Never create a session here: an input/resize/close for an
        // unknown id must not resurrect a PTY with default dimensions.
        const session = getSession(currentSessionId);
        if (!session) {
          sendToClient(ws, { type: 'error', message: 'Session is no longer active.' });
          return;
        }

        if (message.type === 'input') {
          if (canWrite(session, ws) && typeof message.data === 'string') {
            writeInput(session, message.data);
          }
          return;
        }

        if (message.type === 'resize') {
          if (canResize(session, ws)) {
            resizeSession(
              session,
              readDimension(message.cols, 80),
              readDimension(message.rows, 24),
            );
          }
          return;
        }

        if (message.type === 'ping') {
          sendToClient(ws, { type: 'pong' });
          return;
        }
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        console.error('[TerminalBackend] WebSocket error:', errorMsg);
        sendToClient(ws, { type: 'error', message: errorMsg });
      }
    });

    ws.on('close', () => {
      if (currentSessionId !== null) {
        const session = getSession(currentSessionId);
        if (session) {
          const { changes } = detachClient(session, ws, currentSessionId);
          changes.forEach((change) =>
            sendToClient(change.ws, { type: 'role_changed', role: change.role }),
          );
        }
      }
      console.log('[TerminalBackend] Client disconnected');
    });

    ws.on('error', (error) => {
      console.error('[TerminalBackend] WebSocket error:', error);
    });
  });

  wss.on('error', (error) => {
    console.error('[TerminalBackend] WebSocket server error:', error);
  });

  return wss;
}

export function generateAuthToken(): string {
  return randomBytes(32).toString('hex');
}
