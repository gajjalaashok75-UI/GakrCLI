import { WebSocketServer, WebSocket, type RawData } from 'ws';
import type { Server as HttpServer } from 'node:http';
import { randomBytes } from 'node:crypto';
import { TERMINAL_WS_PATH } from './discoveryServer.js';
import type {
  WsIncomingMessage,
  WsOutgoingMessage,
  TerminalBackendConfig,
  HistoryChunk,
} from './types.js';
import {
  getOrCreateSession,
  initializeSessionPty,
  attachClient,
  detachClient,
  getSessionRole,
  canWrite,
  canResize,
  writeInput,
  resizeSession,
  appendToBuffer,
  getBuffer,
  clearBuffer,
  replayHistory,
  persistChunk,
  startHistorySession,
  deleteSession,
} from './sessionManager.js';

export interface WsServerDependencies {
  config: TerminalBackendConfig;
}

function sendToClient(ws: WebSocket, payload: WsOutgoingMessage): void {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(payload));
  }
}

function validateAuthToken(config: TerminalBackendConfig, token: string | null): boolean {
  return token === config.authToken;
}

function validateOrigin(config: TerminalBackendConfig, origin: string | undefined): boolean {
  if (!config.allowedOrigin) {
    // No origin restriction configured - allow but warn
    console.warn('[TerminalBackend] No allowedOrigin configured, accepting all origins');
    return true;
  }
  if (!origin) {
    console.warn('[TerminalBackend] Connection rejected: missing Origin header');
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
    let currentWs: WebSocket | null = ws;

    ws.on('message', async (rawMessage: RawData) => {
      try {
        const message = parseWsMessage(rawMessage);
        if (!message) {
          sendToClient(ws, { type: 'error', message: 'Invalid message format' });
          return;
        }

        if (message.type === 'init') {
          const cols = typeof message.cols === 'number' && message.cols > 0 ? message.cols : 120;
          const rows = typeof message.rows === 'number' && message.rows > 0 ? message.rows : 35;
          const requestedSessionId = typeof message.sessionId === 'string' && message.sessionId.length > 0 ? message.sessionId : null;

          const { session, isNew } = getOrCreateSession(requestedSessionId, config.launchDir, cols, rows);
          currentSessionId = session.sessionId;

          if (isNew) {
            startHistorySession(session.sessionId);
            
            initializeSessionPty(
              session,
              config.launchDir,
              cols,
              rows,
              (chunk: string) => {
                appendToBuffer(session, chunk);
                persistChunk(session.sessionId, chunk);
                
                const outputMsg: WsOutgoingMessage = { type: 'output', data: chunk };
                session.clients.forEach((_client, socket) => {
                  sendToClient(socket, outputMsg);
                });
              },
              (exitCode) => {
                const exitMsg: WsOutgoingMessage = { 
                  type: 'exit', 
                  code: exitCode.exitCode, 
                  signal: exitCode.signal 
                };
                session.clients.forEach((_client, socket) => {
                  sendToClient(socket, exitMsg);
                });
                
                if (session.timeoutId) {
                  clearTimeout(session.timeoutId);
                }
                deleteSession(session.sessionId);
              }
            );

            const historyReplay = replayHistory(session.sessionId);
            if (historyReplay.hadContent) {
              const historyMsg: WsOutgoingMessage = { 
                type: 'history', 
                chunks: historyReplay.chunks 
              };
              sendToClient(ws, historyMsg);
            }

            const role = attachClient(session, ws);
            sendToClient(ws, { type: 'attached', role, sessionId: session.sessionId });
            
            const welcomeMsg = `\x1b[36m[Terminal backend started - session: ${session.sessionId}]\x1b[0m\r\n`;
            sendToClient(ws, { type: 'output', data: welcomeMsg });
          } else {
            const historyReplay = replayHistory(session.sessionId);
            if (historyReplay.hadContent) {
              const historyMsg: WsOutgoingMessage = { 
                type: 'history', 
                chunks: historyReplay.chunks 
              };
              sendToClient(ws, historyMsg);
            }

            const role = attachClient(session, ws);
            sendToClient(ws, { type: 'attached', role, sessionId: session.sessionId });
            
            const reconnectMsg = `\x1b[36m[Reconnected to session: ${session.sessionId}]\x1b[0m\r\n`;
            sendToClient(ws, { type: 'output', data: reconnectMsg });
            
            // The persisted history already contains every chunk that is in
            // the in-memory buffer, so replaying both would duplicate output.
            if (!historyReplay.hadContent) {
              getBuffer(session).forEach((chunk) => {
                sendToClient(ws, { type: 'output', data: chunk });
              });
            }
          }
          return;
        }

        if (!currentSessionId) {
          sendToClient(ws, { type: 'error', message: 'Session not initialized. Send init first.' });
          return;
        }

        const session = getOrCreateSession(currentSessionId, config.launchDir, 120, 35).session;

        if (message.type === 'input') {
          if (canWrite(session, ws)) {
            writeInput(session, message.data);
          }
          return;
        }

        if (message.type === 'resize') {
          if (canResize(session, ws)) {
            resizeSession(session, message.cols, message.rows);
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
        if (ws.readyState === WebSocket.OPEN) {
          sendToClient(ws, { type: 'error', message: errorMsg });
        }
      }
    });

    ws.on('close', () => {
      if (currentSessionId) {
        const session = getOrCreateSession(currentSessionId, config.launchDir, 120, 35).session;
        detachClient(session, ws, currentSessionId);
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