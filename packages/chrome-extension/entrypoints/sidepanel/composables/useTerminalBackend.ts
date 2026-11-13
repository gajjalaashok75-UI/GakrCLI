/**
 * Client for the GakrCLI terminal backend (`gakrcli --chrome-extension`).
 *
 * Flow: probe the loopback HTTP discovery endpoint, take the authenticated
 * WebSocket it returns, and stream terminal I/O to the real `gakrcli --chrome`
 * PTY. Deliberately independent of `useAgentServer` (HTTP + SSE) so the agent
 * server path keeps working unchanged during this migration.
 */
import { onUnmounted, ref } from 'vue';

export type TerminalBackendRole = 'owner' | 'observer';

export type TerminalConnectionState =
  | 'idle'
  | 'discovering'
  | 'connecting'
  | 'connected'
  | 'reconnecting'
  | 'disconnected'
  | 'exited'
  | 'error';

export interface TerminalHistoryChunk {
  ts: number;
  data: string;
}

export interface UseTerminalBackendHandlers {
  /** Live PTY output. */
  onOutput: (data: string) => void;
  /** Replayed output after a reconnect; the terminal should be reset first. */
  onHistory?: (chunks: TerminalHistoryChunk[]) => void;
  onExit?: (code: number | null, signal: string | null) => void;
  /** Current terminal size, used for `init` and reconnects. */
  getDimensions: () => { cols: number; rows: number };
}

/**
 * Discovery ports mirror TERMINAL_DISCOVERY_PORT_BASE / _ATTEMPTS in
 * src/utils/gakrcliInChrome/terminalBackend/discoveryServer.ts. The two live in
 * separate packages, so the range is duplicated here.
 */
const DISCOVERY_PORT_BASE = 64201;
const DISCOVERY_PORT_ATTEMPTS = 10;
const DISCOVERY_PATH = '/discover';
const DISCOVERY_TIMEOUT_MS = 1500;

const HEARTBEAT_INTERVAL_MS = 20_000;
const HEARTBEAT_TIMEOUT_MS = 45_000;
const MAX_RECONNECT_ATTEMPTS = 6;
const RECONNECT_BASE_DELAY_MS = 500;
const RECONNECT_MAX_DELAY_MS = 5_000;

const SESSION_STORAGE_KEY = 'gakrchrome.terminal.sessionId';

interface DiscoveryResult {
  port: number;
  token: string;
  wsPath: string;
}

type BackendMessage =
  | { type: 'output'; data: string }
  | { type: 'attached'; role: TerminalBackendRole; sessionId: string }
  | { type: 'exit'; code: number | null; signal: string | null }
  | { type: 'history'; chunks: TerminalHistoryChunk[] }
  | { type: 'error'; message: string }
  | { type: 'pong' };

function parseMessage(raw: string): BackendMessage | null {
  try {
    const parsed = JSON.parse(raw) as { type?: unknown };
    if (!parsed || typeof parsed.type !== 'string') {
      return null;
    }
    return parsed as BackendMessage;
  } catch {
    return null;
  }
}

async function probeDiscoveryPort(port: number): Promise<DiscoveryResult | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), DISCOVERY_TIMEOUT_MS);
  try {
    const response = await fetch(`http://127.0.0.1:${port}${DISCOVERY_PATH}`, {
      method: 'GET',
      signal: controller.signal,
      cache: 'no-store',
      credentials: 'omit',
      // Chrome omits `Origin` for extension-page fetches that use host
      // permissions, so the backend also accepts this asserted origin.
      headers: { 'X-Gakr-Terminal-Origin': `chrome-extension://${chrome.runtime.id}` },
    });
    if (!response.ok) {
      return null;
    }
    const body = (await response.json()) as { token?: unknown; wsPath?: unknown };
    if (typeof body.token !== 'string' || body.token.length === 0) {
      return null;
    }
    return {
      port,
      token: body.token,
      wsPath: typeof body.wsPath === 'string' ? body.wsPath : '/terminal',
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export function useTerminalBackend(handlers: UseTerminalBackendHandlers) {
  const state = ref<TerminalConnectionState>('idle');
  const errorMessage = ref<string | null>(null);
  const sessionId = ref<string | null>(null);
  const role = ref<TerminalBackendRole | null>(null);
  const backendPort = ref<number | null>(null);

  let socket: WebSocket | null = null;
  let heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  let lastMessageAt = 0;
  let reconnectAttempt = 0;
  let disposed = false;
  let intentionalClose = false;

  async function loadStoredSessionId(): Promise<string | null> {
    try {
      const stored = await chrome.storage.local.get(SESSION_STORAGE_KEY);
      const value = stored?.[SESSION_STORAGE_KEY];
      return typeof value === 'string' && value.length > 0 ? value : null;
    } catch {
      return null;
    }
  }

  async function persistSessionId(value: string | null): Promise<void> {
    try {
      if (value) {
        await chrome.storage.local.set({ [SESSION_STORAGE_KEY]: value });
      } else {
        await chrome.storage.local.remove(SESSION_STORAGE_KEY);
      }
    } catch {
      // Storage is best-effort; a lost id just means a fresh PTY next time.
    }
  }

  async function discover(): Promise<DiscoveryResult | null> {
    const probes: Promise<DiscoveryResult | null>[] = [];
    for (let offset = 0; offset < DISCOVERY_PORT_ATTEMPTS; offset += 1) {
      probes.push(probeDiscoveryPort(DISCOVERY_PORT_BASE + offset));
    }
    const results = await Promise.all(probes);
    return results.find((result): result is DiscoveryResult => result !== null) ?? null;
  }

  function clearReconnectTimer(): void {
    if (reconnectTimer !== null) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
  }

  function stopHeartbeat(): void {
    if (heartbeatTimer !== null) {
      clearInterval(heartbeatTimer);
      heartbeatTimer = null;
    }
  }

  function startHeartbeat(): void {
    stopHeartbeat();
    lastMessageAt = Date.now();
    heartbeatTimer = setInterval(() => {
      if (socket === null || socket.readyState !== WebSocket.OPEN) {
        return;
      }
      if (Date.now() - lastMessageAt > HEARTBEAT_TIMEOUT_MS) {
        // Half-open socket: force the close handler to run and reconnect.
        socket.close(4000, 'heartbeat timeout');
        return;
      }
      socket.send(JSON.stringify({ type: 'ping' }));
    }, HEARTBEAT_INTERVAL_MS);
  }

  function closeSocket(): void {
    if (socket !== null) {
      const current = socket;
      socket = null;
      try {
        current.close();
      } catch {
        // Already closed.
      }
    }
  }

  function scheduleReconnect(reason: string): void {
    if (disposed || intentionalClose) {
      return;
    }
    if (reconnectAttempt >= MAX_RECONNECT_ATTEMPTS) {
      state.value = 'error';
      errorMessage.value = `${reason} The terminal backend may have stopped. Start it with \`gakrcli --chrome-extension\`, then reconnect.`;
      return;
    }
    reconnectAttempt += 1;
    state.value = 'reconnecting';
    errorMessage.value = null;
    const delay = Math.min(
      RECONNECT_BASE_DELAY_MS * 2 ** (reconnectAttempt - 1),
      RECONNECT_MAX_DELAY_MS,
    );
    reconnectTimer = setTimeout(() => {
      reconnectTimer = null;
      void connect();
    }, delay);
  }

  function handleMessage(raw: string): void {
    const message = parseMessage(raw);
    if (message === null) {
      return;
    }

    switch (message.type) {
      case 'attached':
        role.value = message.role;
        if (message.sessionId !== sessionId.value) {
          sessionId.value = message.sessionId;
          void persistSessionId(message.sessionId);
        }
        reconnectAttempt = 0;
        errorMessage.value = null;
        state.value = 'connected';
        startHeartbeat();
        break;
      case 'output':
        handlers.onOutput(message.data);
        break;
      case 'history':
        if (handlers.onHistory) {
          handlers.onHistory(message.chunks);
        } else {
          message.chunks.forEach((chunk) => handlers.onOutput(chunk.data));
        }
        break;
      case 'exit':
        stopHeartbeat();
        state.value = 'exited';
        handlers.onExit?.(message.code, message.signal);
        break;
      case 'error':
        errorMessage.value = message.message;
        break;
      case 'pong':
        break;
      default:
        break;
    }
  }

  async function connect(): Promise<void> {
    if (disposed) {
      return;
    }
    clearReconnectTimer();
    intentionalClose = false;

    if (sessionId.value === null) {
      sessionId.value = await loadStoredSessionId();
    }
    if (disposed) {
      return;
    }

    closeSocket();
    stopHeartbeat();
    role.value = null;
    state.value = sessionId.value !== null ? 'reconnecting' : 'discovering';
    errorMessage.value = null;

    const discovery = await discover();
    if (disposed) {
      return;
    }
    if (discovery === null) {
      if (reconnectAttempt > 0) {
        scheduleReconnect('Could not discover the GakrCLI terminal backend.');
      } else {
        state.value = 'error';
        errorMessage.value =
          'GakrCLI terminal backend not found. Start it with `gakrcli --chrome-extension` in the directory you want the terminal to open in, then reconnect.';
      }
      return;
    }

    backendPort.value = discovery.port;
    state.value = 'connecting';

    const url = `ws://127.0.0.1:${discovery.port}${discovery.wsPath}?token=${encodeURIComponent(
      discovery.token,
    )}`;
    let nextSocket: WebSocket;
    try {
      nextSocket = new WebSocket(url);
    } catch {
      scheduleReconnect('Could not open the terminal WebSocket.');
      return;
    }
    socket = nextSocket;

    nextSocket.onopen = () => {
      if (socket !== nextSocket) {
        return;
      }
      const { cols, rows } = handlers.getDimensions();
      nextSocket.send(
        JSON.stringify({
          type: 'init',
          cols,
          rows,
          sessionId: sessionId.value ?? undefined,
        }),
      );
    };

    nextSocket.onmessage = (event: MessageEvent) => {
      lastMessageAt = Date.now();
      if (typeof event.data === 'string') {
        handleMessage(event.data);
      }
    };

    nextSocket.onerror = () => {
      // The close event that follows drives reconnection.
    };

    nextSocket.onclose = (event: CloseEvent) => {
      if (socket !== nextSocket) {
        return;
      }
      socket = null;
      stopHeartbeat();
      role.value = null;
      if (disposed || intentionalClose) {
        state.value = 'disconnected';
        return;
      }
      if (state.value === 'exited') {
        return;
      }
      if (event.code === 4001 || event.code === 4003) {
        // Rejected credentials/origin. A backend restart rotates the token, so
        // rediscovering on the next attempt is the right recovery.
        scheduleReconnect('The terminal backend rejected the connection.');
        return;
      }
      scheduleReconnect('Lost connection to the terminal backend.');
    };
  }

  function reconnect(): void {
    reconnectAttempt = 0;
    clearReconnectTimer();
    void connect();
  }

  async function startNewSession(): Promise<void> {
    sessionId.value = null;
    role.value = null;
    await persistSessionId(null);
    reconnectAttempt = 0;
    void connect();
  }

  function sendInput(data: string): void {
    if (socket !== null && socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({ type: 'input', data }));
    }
  }

  function resize(cols: number, rows: number): void {
    if (socket !== null && socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({ type: 'resize', cols, rows }));
    }
  }

  /**
   * Drop the client only. The PTY session stays alive on the backend (it has
   * its own idle timeout), so reopening the side panel can reattach to it.
   */
  function dispose(): void {
    disposed = true;
    intentionalClose = true;
    clearReconnectTimer();
    stopHeartbeat();
    closeSocket();
  }

  onUnmounted(() => {
    dispose();
  });

  return {
    state,
    errorMessage,
    sessionId,
    role,
    backendPort,
    connect,
    reconnect,
    startNewSession,
    sendInput,
    resize,
    dispose,
  };
}

export type UseTerminalBackend = ReturnType<typeof useTerminalBackend>;
