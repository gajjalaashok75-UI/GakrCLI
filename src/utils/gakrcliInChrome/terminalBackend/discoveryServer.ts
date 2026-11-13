import http from 'node:http';
import type { DiscoveryResponse } from './types.js';

/**
 * HTTP discovery endpoint for the terminal backend.
 *
 * The Chrome extension cannot read files in ~/.gakrcli, and the native host
 * protocol is a protected component, so the extension asks the backend over
 * loopback HTTP where the authenticated WebSocket lives.
 *
 * Security model:
 * - bound to 127.0.0.1 only (see runTerminalBackend);
 * - the Host header must be `127.0.0.1:<port this server is actually bound to>`,
 *   which defeats DNS-rebinding (a rebinding hostname still sends its own Host);
 * - the caller must prove it is the configured extension origin. Chrome grants
 *   extension pages host-permission access to loopback and, on that path,
 *   omits the Origin header entirely, so the check accepts either an exact
 *   `Origin` header or the extension-asserted `X-Gakr-Terminal-Origin` header,
 *   and rejects any request whose `Sec-Fetch-Site` says it came from a page;
 * - CORS is echoed for that one origin only (never `*`), so other web origins
 *   cannot read the body, and the token is only ever written to a validated
 *   caller (a web page's preflight would also be refused - only GET is allowed);
 * - the endpoint carries no terminal input/output - that is WebSocket only.
 */

export const TERMINAL_DISCOVERY_PORT_BASE = 64201;
export const TERMINAL_DISCOVERY_PORT_ATTEMPTS = 10;
export const TERMINAL_DISCOVERY_PATH = '/discover';
export const TERMINAL_WS_PATH = '/terminal';
export const TERMINAL_DISCOVERY_VERSION = 1;

/** Extension-asserted origin, because Chrome omits `Origin` on extension fetches. */
export const TERMINAL_ORIGIN_HEADER = 'x-gakr-terminal-origin';

export interface DiscoveryHttpServerOptions {
  authToken: string;
  allowedOrigin?: string;
  startedAt: string;
}

type DiscoveryError =
  | 'method_not_allowed'
  | 'invalid_host'
  | 'extension_not_configured'
  | 'unauthorized_origin'
  | 'not_found';

function isAuthorizedCaller(
  req: http.IncomingMessage,
  allowedOrigin: string,
): boolean {
  // A request initiated by a web page always carries this header; extension
  // pages report `none`. Anything else is a cross-site page and is refused
  // before the token is written.
  const fetchSite = req.headers['sec-fetch-site'];
  if (typeof fetchSite === 'string' && fetchSite !== 'none') {
    return false;
  }

  const origin = req.headers.origin;
  if (typeof origin === 'string' && origin.length > 0) {
    return origin === allowedOrigin;
  }

  // No Origin header: this is how Chrome presents an extension-page fetch that
  // uses host permissions. Require the extension to assert its own origin.
  const claimed = req.headers[TERMINAL_ORIGIN_HEADER];
  return typeof claimed === 'string' && claimed === allowedOrigin;
}

function sendJson(
  res: http.ServerResponse,
  status: number,
  body: unknown,
  allowedOrigin?: string,
): void {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  if (allowedOrigin) {
    res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
    res.setHeader('Vary', 'Origin');
  }
  res.writeHead(status);
  res.end(JSON.stringify(body));
}

function isAllowedHost(req: http.IncomingMessage): boolean {
  const localPort = req.socket.localPort;
  const hostHeader = req.headers.host;
  if (localPort === undefined || typeof hostHeader !== 'string') {
    return false;
  }
  return hostHeader.toLowerCase() === `127.0.0.1:${localPort}`;
}

export function createDiscoveryHttpServer(
  options: DiscoveryHttpServerOptions,
): http.Server {
  const { authToken, allowedOrigin, startedAt } = options;

  return http.createServer((req, res) => {
    if (req.method !== 'GET') {
      res.setHeader('Allow', 'GET');
      sendJson(res, 405, { error: 'method_not_allowed' satisfies DiscoveryError });
      return;
    }

    if (!isAllowedHost(req)) {
      sendJson(res, 403, { error: 'invalid_host' satisfies DiscoveryError });
      return;
    }

    if (!allowedOrigin) {
      // Without a configured extension id there is no origin we may hand the
      // token to. Refuse rather than fall back to a permissive default.
      sendJson(res, 403, {
        error: 'extension_not_configured' satisfies DiscoveryError,
      });
      return;
    }

    if (!isAuthorizedCaller(req, allowedOrigin)) {
      console.warn(
        `[TerminalBackend] Discovery rejected request with origin=${String(
          req.headers.origin ?? '(none)',
        )} site=${String(req.headers['sec-fetch-site'] ?? '(none)')}`,
      );
      sendJson(res, 403, {
        error: 'unauthorized_origin' satisfies DiscoveryError,
      });
      return;
    }

    const path = new URL(req.url ?? '/', 'http://127.0.0.1').pathname;
    if (path !== TERMINAL_DISCOVERY_PATH) {
      sendJson(res, 404, { error: 'not_found' satisfies DiscoveryError });
      return;
    }

    const body: DiscoveryResponse = {
      version: TERMINAL_DISCOVERY_VERSION,
      wsPath: TERMINAL_WS_PATH,
      token: authToken,
      pid: process.pid,
      startedAt,
    };
    sendJson(res, 200, body, allowedOrigin);
  });
}

function listenOnce(server: http.Server, host: string, port: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const onError = (error: Error): void => {
      server.off('listening', onListening);
      reject(error);
    };
    const onListening = (): void => {
      server.off('error', onError);
      resolve();
    };
    server.once('error', onError);
    server.once('listening', onListening);
    server.listen(port, host);
  });
}

/**
 * Bind the first free port in the fixed discovery range. The extension probes
 * the same range, so the port must come from a known list rather than 0.
 */
export async function listenWithPortFallback(
  server: http.Server,
  host: string,
  basePort = TERMINAL_DISCOVERY_PORT_BASE,
  attempts = TERMINAL_DISCOVERY_PORT_ATTEMPTS,
): Promise<number> {
  let lastError: unknown;
  for (let offset = 0; offset < attempts; offset += 1) {
    const port = basePort + offset;
    try {
      await listenOnce(server, host, port);
      return port;
    } catch (error) {
      lastError = error;
      if ((error as NodeJS.ErrnoException).code !== 'EADDRINUSE') {
        throw error;
      }
    }
  }
  throw new Error(
    `[TerminalBackend] No free discovery port in range ${basePort}-${basePort + attempts - 1}: ${String(lastError)}`,
  );
}
