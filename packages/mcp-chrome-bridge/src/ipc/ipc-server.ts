import * as net from 'net';
import * as fs from 'fs';
import { getIpcSocketPath, IpcRequest, IpcResponse } from './protocol';
import { NativeMessagingHost } from '../native-messaging-host';
import { NativeMessageType } from '@gakr-gakr/mcp-chrome-shared';

/**
 * IPC Server — runs inside the native messaging host process.
 *
 * Listens on a Unix socket (or Windows named pipe) so that the
 * standalone stdio MCP process (`mcp-server-stdio.ts`) can forward
 * tool-call requests to Chrome via the native messaging channel.
 */
export class IpcServer {
  private server: net.Server | null = null;
  private nativeHost: NativeMessagingHost | null = null;

  /**
   * Associate the native messaging host that will forward requests to Chrome.
   */
  public setNativeHost(host: NativeMessagingHost): void {
    this.nativeHost = host;
  }

  /**
   * Start listening on the IPC socket.
   */
  public async start(): Promise<void> {
    if (this.server) {
      return; // already running
    }

    const socketPath = getIpcSocketPath();

    // Clean up stale socket file (Unix only)
    if (process.platform !== 'win32' && fs.existsSync(socketPath)) {
      try {
        fs.unlinkSync(socketPath);
      } catch {
        // best-effort; another process may have removed it already
      }
    }

    this.server = net.createServer((socket) => {
      this.handleConnection(socket);
    });

    await new Promise<void>((resolve, reject) => {
      this.server!.listen(socketPath, () => {
        resolve();
      });
      this.server!.on('error', (err) => {
        reject(err);
      });
    });

    // Expose socket path via environment variable so child processes can discover it
    process.env.MCP_CHROME_IPC_SOCKET = socketPath;
  }

  /**
   * Stop the IPC server and clean up the socket file.
   */
  public async stop(): Promise<void> {
    if (!this.server) {
      return;
    }

    const socketPath = getIpcSocketPath();

    await new Promise<void>((resolve) => {
      this.server!.close(() => resolve());
    });
    this.server = null;

    // Remove socket file
    if (process.platform !== 'win32' && fs.existsSync(socketPath)) {
      try {
        fs.unlinkSync(socketPath);
      } catch {
        // ignore
      }
    }
  }

  /**
   * Handle a single IPC client connection.
   */
  private handleConnection(socket: net.Socket): void {
    let buffer = '';

    socket.on('data', (chunk) => {
      buffer += chunk.toString('utf-8');

      // Process complete JSON lines
      const lines = buffer.split('\n');
      buffer = lines.pop() || ''; // keep incomplete last line in buffer

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;

        try {
          const request: IpcRequest = JSON.parse(trimmed);
          this.handleRequest(request, socket);
        } catch {
          const errorResponse: IpcResponse = {
            id: 'unknown',
            status: 'error',
            error: `Invalid JSON: ${trimmed.substring(0, 200)}`,
          };
          this.sendResponse(socket, errorResponse);
        }
      }
    });

    socket.on('error', () => {
      // Connection lost; nothing to do
    });
  }

  /**
   * Forward an IPC request to Chrome via native messaging.
   */
  private async handleRequest(request: IpcRequest, socket: net.Socket): Promise<void> {
    if (!this.nativeHost) {
      const errorResponse: IpcResponse = {
        id: request.id,
        status: 'error',
        error: 'Native messaging host not available. Ensure the Chrome extension is connected.',
      };
      this.sendResponse(socket, errorResponse);
      return;
    }

    try {
      // Forward to Chrome extension and wait for response
      const result = await this.nativeHost.sendRequestToExtensionAndWait(
        request.payload,
        request.type as any,
        120000, // 2 min timeout for tool calls
      );

      const response: IpcResponse = {
        id: request.id,
        status: result?.status === 'success' ? 'success' : 'error',
        data: result?.data ?? result,
        error: result?.error,
      };
      this.sendResponse(socket, response);
    } catch (err: any) {
      const response: IpcResponse = {
        id: request.id,
        status: 'error',
        error: err?.message || String(err),
      };
      this.sendResponse(socket, response);
    }
  }

  /**
   * Send a JSON-line response back to the IPC client.
   */
  private sendResponse(socket: net.Socket, response: IpcResponse): void {
    try {
      if (!socket.destroyed) {
        socket.write(JSON.stringify(response) + '\n');
      }
    } catch {
      // Socket may have been closed; ignore
    }
  }
}

const ipcServerInstance = new IpcServer();
export default ipcServerInstance;
