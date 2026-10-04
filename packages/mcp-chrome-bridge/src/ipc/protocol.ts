import * as os from 'os';
import * as path from 'path';

// ============================================================
// IPC Socket Path
// ============================================================

/**
 * Default IPC socket path.
 * - Unix/macOS: temp dir + /gakr-chrome-ipc.sock
 * - Windows: named pipe \\.\pipe\gakr-chrome-ipc
 */
export const IPC_DEFAULT_SOCKET_PATH =
  process.platform === 'win32'
    ? '\\\\.\\pipe\\gakr-chrome-ipc'
    : path.join(os.tmpdir(), 'gakr-chrome-ipc.sock');

/** Environment variable to override the socket path */
export const IPC_SOCKET_PATH_ENV = 'MCP_CHROME_IPC_SOCKET';

/**
 * Resolve the IPC socket path.
 * Priority: environment variable > default path
 */
export function getIpcSocketPath(): string {
  return process.env[IPC_SOCKET_PATH_ENV] || IPC_DEFAULT_SOCKET_PATH;
}

// ============================================================
// IPC Message Protocol (JSON-line)
// ============================================================

/** Request sent from IPC client to server */
export interface IpcRequest {
  /** Unique request ID for correlating responses */
  id: string;
  /** Message type — typically matches NativeMessageType or a tool-call action */
  type: string;
  /** Arbitrary payload */
  payload: any;
}

/** Response sent from IPC server back to client */
export interface IpcResponse {
  /** Correlates to the originating IpcRequest.id */
  id: string;
  /** Outcome status */
  status: 'success' | 'error';
  /** Response data on success */
  data?: any;
  /** Error message on failure */
  error?: string;
}
