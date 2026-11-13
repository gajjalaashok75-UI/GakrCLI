import type { AddressInfo } from 'node:net';
import { setChromeSurfaceActive } from '../../../bootstrap/state.js';
import { getConfiguredChromeExtensionId } from '../setup.js';
import type { TerminalBackendConfig, DiscoveryInfo } from './types.js';
import { createWsServer, generateAuthToken } from './wsServer.js';
import { publishDiscovery, clearDiscovery, getDiscoveryDirPath } from './discovery.js';
import {
  TERMINAL_DISCOVERY_PATH,
  TERMINAL_DISCOVERY_PORT_BASE,
  TERMINAL_WS_PATH,
  createDiscoveryHttpServer,
  listenWithPortFallback,
} from './discoveryServer.js';
import { createTerminalHistoryStore } from './historyStore.js';

export interface RunTerminalBackendOptions {
  launchDir: string;
  port?: number;
  host?: string;
}

export async function runTerminalBackend(options: RunTerminalBackendOptions): Promise<void> {
  setChromeSurfaceActive(true);

  const host = options.host ?? '127.0.0.1';
  const basePort = options.port ?? TERMINAL_DISCOVERY_PORT_BASE;
  const authToken = generateAuthToken();
  const startedAt = new Date().toISOString();

  // Determine allowed extension origin
  const configured = getConfiguredChromeExtensionId();
  const allowedOrigin = configured.id ? `chrome-extension://${configured.id}` : undefined;

  if (!allowedOrigin) {
    console.warn(
      '[TerminalBackend] No Chrome extension id configured. Discovery will refuse all origins; ' +
        'run /chrome (or set GAKR_CHROME_EXTENSION_ID) to authorize the extension.',
    );
  }

  const config: TerminalBackendConfig = {
    port: basePort,
    host,
    launchDir: options.launchDir,
    authToken,
    allowedOrigin,
  };

  const httpServer = createDiscoveryHttpServer({ authToken, allowedOrigin, startedAt });
  const actualPort = await listenWithPortFallback(httpServer, host, basePort);
  config.port = actualPort;

  const wss = createWsServer(config, httpServer);

  const addressInfo = httpServer.address() as AddressInfo | null;
  const boundPort = addressInfo && typeof addressInfo === 'object' ? addressInfo.port : actualPort;
  config.port = boundPort;

  const discoveryInfo: DiscoveryInfo = {
    port: boundPort,
    pid: process.pid,
    startedAt,
    authToken,
  };

  publishDiscovery(discoveryInfo);

  const historyStore = createTerminalHistoryStore();
  historyStore.sweepExpired();

  console.log(`[TerminalBackend] Started on ws://${host}:${boundPort}${TERMINAL_WS_PATH}`);
  console.log(`[TerminalBackend] Discovery endpoint: http://${host}:${boundPort}${TERMINAL_DISCOVERY_PATH}`);
  console.log(`[TerminalBackend] Launch directory: ${options.launchDir}`);
  console.log(`[TerminalBackend] Discovery published to ${getDiscoveryDirPath()}/port.json`);

  const shutdown = (): void => {
    console.log('[TerminalBackend] Shutting down...');
    clearDiscovery();
    wss.close();
    httpServer.close(() => {
      console.log('[TerminalBackend] HTTP/WebSocket server closed');
      process.exit(0);
    });

    setTimeout(() => {
      console.error('[TerminalBackend] Forced shutdown after timeout');
      process.exit(1);
    }, 5000);
  };

  process.once('SIGINT', shutdown);
  process.once('SIGTERM', shutdown);

  await new Promise<void>((resolve) => {
    httpServer.on('close', () => {
      resolve();
    });
  });
}
