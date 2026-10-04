/**
 * HTTP Server - Core server implementation.
 *
 * Responsibilities:
 * - Hono instance management
 * - CORS handling
 * - MCP transport handling (StreamableHTTP + SSE)
 * - Server lifecycle management
 */
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import type { HttpBindings } from '@hono/node-server';
import { serve } from '@hono/node-server';
import { NATIVE_SERVER_PORT, TIMEOUTS, SERVER_CONFIG, ERROR_MESSAGES } from '../constant';
import { NativeMessagingHost } from '../native-messaging-host';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { randomUUID } from 'node:crypto';
import { isInitializeRequest } from '@modelcontextprotocol/sdk/types.js';
import { createMcpServer } from '../mcp/mcp-server';
import type { Server as McpServerInstance } from '@modelcontextprotocol/sdk/server/index.js';
import type { Server as NodeHttpServer } from 'node:http';

// ============================================================
// Server Class
// ============================================================

export class Server {
  private app: Hono<{ Bindings: HttpBindings }>;
  private httpServer: NodeHttpServer | null = null;
  public isRunning = false;
  private nativeHost: NativeMessagingHost | null = null;
  private transportsMap: Map<string, StreamableHTTPServerTransport | SSEServerTransport> =
    new Map();
  private mcpServersMap: Map<string, McpServerInstance> = new Map();

  constructor() {
    this.app = new Hono<{ Bindings: HttpBindings }>();
    this.setupRoutes();
  }

  /**
   * Associate NativeMessagingHost instance.
   */
  public setNativeHost(nativeHost: NativeMessagingHost): void {
    this.nativeHost = nativeHost;
  }

  private setupRoutes(): void {
    // CORS middleware
    this.app.use(
      '*',
      cors({
        origin: (origin) => {
          if (!origin) return '*';
          const allowed = SERVER_CONFIG.CORS_ORIGIN.some((pattern) =>
            pattern instanceof RegExp ? pattern.test(origin) : origin.startsWith(pattern),
          );
          return allowed ? origin : '';
        },
        allowMethods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
        credentials: true,
      }),
    );

    this.setupHealthRoutes();
    this.setupExtensionRoutes();
    this.setupMcpRoutes();
  }

  // ============================================================
  // Health Routes
  // ============================================================

  private setupHealthRoutes(): void {
    this.app.get('/ping', (c) => c.json({ status: 'ok', message: 'pong' }));
  }

  // ============================================================
  // Extension Routes
  // ============================================================

  private setupExtensionRoutes(): void {
    this.app.get('/ask-extension', async (c) => {
      if (!this.nativeHost) {
        return c.json({ error: ERROR_MESSAGES.NATIVE_HOST_NOT_AVAILABLE }, 500);
      }
      if (!this.isRunning) {
        return c.json({ error: ERROR_MESSAGES.SERVER_NOT_RUNNING }, 500);
      }

      try {
        const query = c.req.query();
        const extensionResponse = await this.nativeHost.sendRequestToExtensionAndWait(
          query,
          'process_data',
          TIMEOUTS.EXTENSION_REQUEST_TIMEOUT,
        );
        return c.json({ status: 'success', data: extensionResponse });
      } catch (error: unknown) {
        const err = error as Error;
        if (err.message.includes('timed out')) {
          return c.json({ status: 'error', message: ERROR_MESSAGES.REQUEST_TIMEOUT }, 504);
        } else {
          return c.json(
            { status: 'error', message: `Failed to get response from extension: ${err.message}` },
            500,
          );
        }
      }
    });
  }

  // ============================================================
  // MCP Routes
  // ============================================================

  private setupMcpRoutes(): void {
    // SSE endpoint — uses raw Node.js response for SSEServerTransport compatibility
    this.app.get('/sse', async (c) => {
      const { incoming, outgoing } = c.env;

      outgoing.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      });

      const transport = new SSEServerTransport('/messages', outgoing);
      this.transportsMap.set(transport.sessionId, transport);

      const mcpServer = createMcpServer();
      this.mcpServersMap.set(transport.sessionId, mcpServer);

      outgoing.on('close', () => {
        this.transportsMap.delete(transport.sessionId);
        this.mcpServersMap.delete(transport.sessionId);
        mcpServer.close().catch(() => {});
      });

      await mcpServer.connect(transport);

      outgoing.write(':\n\n');
      return new Response(null);
    });

    // SSE messages endpoint
    this.app.post('/messages', async (c) => {
      const sessionId = c.req.query('sessionId') as string | undefined;
      const transport = this.transportsMap.get(sessionId || '') as SSEServerTransport;
      if (!sessionId || !transport) {
        return c.text('No transport found for sessionId', 400);
      }

      const body = await c.req.json();
      const { incoming, outgoing } = c.env;
      await transport.handlePostMessage(incoming, outgoing, body);
      return new Response(null);
    });

    // MCP POST endpoint
    this.app.post('/mcp', async (c) => {
      const sessionId = c.req.header('mcp-session-id');
      let transport: StreamableHTTPServerTransport | undefined = this.transportsMap.get(
        sessionId || '',
      ) as StreamableHTTPServerTransport;

      if (transport) {
        // Transport found, proceed
      } else if (!sessionId) {
        const body = await c.req.json();
        if (isInitializeRequest(body)) {
          const newSessionId = randomUUID();
          transport = new StreamableHTTPServerTransport({
            sessionIdGenerator: () => newSessionId,
            onsessioninitialized: (initializedSessionId) => {
              if (transport && initializedSessionId === newSessionId) {
                this.transportsMap.set(initializedSessionId, transport);
              }
            },
          });

          const mcpServer = createMcpServer();

          transport.onclose = () => {
            if (transport?.sessionId) {
              this.transportsMap.delete(transport.sessionId);
              this.mcpServersMap.delete(transport.sessionId);
            }
          };
          this.mcpServersMap.set(newSessionId, mcpServer);
          await mcpServer.connect(transport);
        } else {
          return c.json({ error: ERROR_MESSAGES.INVALID_MCP_REQUEST }, 400);
        }
      } else {
        return c.json({ error: ERROR_MESSAGES.INVALID_MCP_REQUEST }, 400);
      }

      try {
        const body = await c.req.json().catch(() => undefined);
        const { incoming, outgoing } = c.env;
        await transport.handleRequest(incoming, outgoing, body);
        return new Response(null);
      } catch (error) {
        return c.json({ error: ERROR_MESSAGES.MCP_REQUEST_PROCESSING_ERROR }, 500);
      }
    });

    // MCP GET endpoint (SSE stream for existing session)
    this.app.get('/mcp', async (c) => {
      const sessionId = c.req.header('mcp-session-id');
      const transport = sessionId
        ? (this.transportsMap.get(sessionId) as StreamableHTTPServerTransport)
        : undefined;

      if (!transport) {
        return c.json({ error: ERROR_MESSAGES.INVALID_SSE_SESSION }, 400);
      }

      const { incoming, outgoing } = c.env;

      outgoing.setHeader('Content-Type', 'text/event-stream');
      outgoing.setHeader('Cache-Control', 'no-cache');
      outgoing.setHeader('Connection', 'keep-alive');
      outgoing.flushHeaders();

      try {
        await transport.handleRequest(incoming, outgoing);
      } catch (error) {
        if (!outgoing.writableEnded) {
          outgoing.end();
        }
      }

      incoming.socket?.on('close', () => {
        // Client disconnected
      });

      return new Response(null);
    });

    // MCP DELETE endpoint
    this.app.delete('/mcp', async (c) => {
      const sessionId = c.req.header('mcp-session-id');
      const transport = sessionId
        ? (this.transportsMap.get(sessionId) as StreamableHTTPServerTransport)
        : undefined;

      if (!transport) {
        return c.json({ error: ERROR_MESSAGES.INVALID_SESSION_ID }, 400);
      }

      try {
        const { incoming, outgoing } = c.env;
        await transport.handleRequest(incoming, outgoing);
        return new Response(null, { status: 204 });
      } catch (error) {
        return c.json({ error: ERROR_MESSAGES.MCP_SESSION_DELETION_ERROR }, 500);
      }
    });
  }

  // ============================================================
  // Server Lifecycle
  // ============================================================

  public async start(port = NATIVE_SERVER_PORT, nativeHost: NativeMessagingHost): Promise<void> {
    if (!this.nativeHost) {
      this.nativeHost = nativeHost;
    } else if (this.nativeHost !== nativeHost) {
      this.nativeHost = nativeHost;
    }

    if (this.isRunning) {
      return;
    }

    return new Promise<void>((resolve, reject) => {
      const srv = serve(
        {
          fetch: this.app.fetch,
          port,
          hostname: SERVER_CONFIG.HOST,
        },
        () => {
          process.env.CHROME_MCP_PORT = String(port);
          process.env.MCP_HTTP_PORT = String(port);
          this.isRunning = true;
          resolve();
        },
      );
      this.httpServer = srv as NodeHttpServer;

      this.httpServer?.on('error', (err) => {
        this.isRunning = false;
        reject(err);
      });
    });
  }

  public async stop(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    return new Promise<void>((resolve, reject) => {
      if (!this.httpServer) {
        this.isRunning = false;
        resolve();
        return;
      }

      this.httpServer.close((err) => {
        this.httpServer = null;
        this.isRunning = false;
        if (err) reject(err);
        else resolve();
      });
    });
  }

  public getInstance(): Hono<{ Bindings: HttpBindings }> {
    return this.app;
  }
}

const serverInstance = new Server();
export default serverInstance;
