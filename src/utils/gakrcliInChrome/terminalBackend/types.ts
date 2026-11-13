import type { WebSocket } from 'ws';
import type { IPty } from 'node-pty';

export type ClientRole = 'owner' | 'observer';

export interface ClientEntry {
  role: ClientRole;
  roleAnnounced: boolean;
  attachedAt: number;
}

export interface PtySessionEntry {
  pty: IPty;
  clients: Map<WebSocket, ClientEntry>;
  buffer: string[];
  timeoutId: NodeJS.Timeout | null;
  sessionId: string;
}

export interface TerminalBackendConfig {
  port: number;
  host: string;
  launchDir: string;
  authToken: string;
  allowedOrigin?: string;
}

export interface DiscoveryInfo {
  /** Port serving both the HTTP discovery endpoint and the WebSocket upgrade. */
  port: number;
  pid: number;
  startedAt: string;
  authToken: string;
}

/** Body returned by GET /discover to a validated extension origin. */
export interface DiscoveryResponse {
  version: number;
  wsPath: string;
  token: string;
  pid: number;
  startedAt: string;
}

export type WsIncomingMessage =
  | { type: 'init'; cols?: number; rows?: number; sessionId?: string }
  | { type: 'input'; data: string }
  | { type: 'resize'; cols: number; rows: number }
  | { type: 'ping' };

export type WsOutgoingMessage =
  | { type: 'output'; data: string }
  | { type: 'attached'; role: ClientRole; sessionId: string }
  | { type: 'exit'; code: number | null; signal: string | null }
  | { type: 'history'; chunks: HistoryChunk[] }
  | { type: 'error'; message: string }
  | { type: 'pong' };

export interface HistoryChunk {
  ts: number;
  data: string;
}

export type TerminalHistoryChunk = HistoryChunk;

export interface TerminalHistoryReplay {
  hadContent: boolean;
  chunks: HistoryChunk[];
}