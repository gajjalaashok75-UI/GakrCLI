import * as net from 'net';
import { randomUUID } from 'node:crypto';
import { getIpcSocketPath, IpcRequest, IpcResponse } from './protocol';

interface PendingRequest {
  resolve: (value: IpcResponse) => void;
  reject: (reason?: any) => void;
  timeoutId: NodeJS.Timeout;
}

/**
 * IPC Client — used by the stdio MCP server to communicate with
 * the native messaging host through an IPC socket.
 */
export class IpcClient {
  private socket: net.Socket | null = null;
  private connected = false;
  private connecting: Promise<void> | null = null;
  private pendingRequests: Map<string, PendingRequest> = new Map();
  private buffer = '';

  /**
   * Connect to the IPC socket. Resolves when connected.
   */
  public async connect(): Promise<void> {
    if (this.connected && this.socket && !this.socket.destroyed) {
      return;
    }

    if (this.connecting) {
      return this.connecting;
    }

    this.connecting = new Promise<void>((resolve, reject) => {
      const socketPath = getIpcSocketPath();
      const socket = net.createConnection(socketPath, () => {
        this.connected = true;
        this.connecting = null;
        resolve();
      });

      socket.on('data', (chunk) => {
        this.handleData(chunk.toString('utf-8'));
      });

      socket.on('error', (err) => {
        this.connected = false;
        this.connecting = null;
        reject(
          new Error(
            `Failed to connect to Chrome MCP IPC socket at ${socketPath}. ` +
              'Ensure the Chrome extension is running and the native messaging host has started. ' +
              `Original error: ${err.message}`,
          ),
        );
      });

      socket.on('close', () => {
        this.connected = false;
        // Reject all pending requests
        for (const [id, pending] of this.pendingRequests) {
          clearTimeout(pending.timeoutId);
          pending.reject(new Error('IPC socket connection closed'));
        }
        this.pendingRequests.clear();
      });

      this.socket = socket;
    });

    return this.connecting;
  }

  /**
   * Send a request through the IPC socket and wait for the response.
   *
   * @param type Message type (e.g. NativeMessageType.CALL_TOOL)
   * @param payload Request payload
   * @param timeoutMs Timeout in milliseconds (default 30s)
   * @returns The IPC response from the native messaging host
   */
  public async sendRequestAndWait(
    type: string,
    payload: any,
    timeoutMs: number = 30000,
  ): Promise<IpcResponse> {
    if (!this.connected || !this.socket || this.socket.destroyed) {
      await this.connect();
    }

    return new Promise<IpcResponse>((resolve, reject) => {
      const id = randomUUID();

      const timeoutId = setTimeout(() => {
        this.pendingRequests.delete(id);
        reject(new Error(`IPC request timed out after ${timeoutMs}ms`));
      }, timeoutMs);

      this.pendingRequests.set(id, { resolve, reject, timeoutId });

      const request: IpcRequest = { id, type, payload };
      const message = JSON.stringify(request) + '\n';

      this.socket!.write(message, (err) => {
        if (err) {
          this.pendingRequests.delete(id);
          clearTimeout(timeoutId);
          reject(new Error(`Failed to send IPC request: ${err.message}`));
        }
      });
    });
  }

  /**
   * Disconnect from the IPC socket.
   */
  public disconnect(): void {
    if (this.socket) {
      this.socket.destroy();
      this.socket = null;
    }
    this.connected = false;
  }

  /**
   * Parse incoming data and resolve pending requests.
   */
  private handleData(data: string): void {
    this.buffer += data;

    const lines = this.buffer.split('\n');
    this.buffer = lines.pop() || '';

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      try {
        const response: IpcResponse = JSON.parse(trimmed);
        const pending = this.pendingRequests.get(response.id);
        if (pending) {
          clearTimeout(pending.timeoutId);
          this.pendingRequests.delete(response.id);
          pending.resolve(response);
        }
      } catch {
        // Ignore malformed responses
      }
    }
  }
}
