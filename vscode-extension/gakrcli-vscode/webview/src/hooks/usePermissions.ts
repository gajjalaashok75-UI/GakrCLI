// webview/src/hooks/usePermissions.ts
// React hook managing the queue of pending permission requests.
// Listens for permission_request and cancel_request messages from the extension host.

import { useState, useCallback, useEffect } from 'react';
import { vscode } from '../vscode';
import {
  getPermissionCancelRequestId,
  getPermissionRequestFromCliOutput,
  toPermissionRequest,
} from '../utils/permissionRequests';

export interface PermissionRequest {
  requestId: string;
  toolName: string;
  toolInput: Record<string, unknown>;
  riskLevel?: string;
  title?: string;
  description?: string;
  decisionReason?: string;
  blockedPath?: string;
  permissionSuggestions?: unknown[];
  agentId?: string;
}

export function usePermissions() {
  const [queue, setQueue] = useState<PermissionRequest[]>([]);

  useEffect(() => {
    const enqueue = (req: PermissionRequest) => {
      setQueue((prev) =>
        prev.some((existing) => existing.requestId === req.requestId)
          ? prev
          : [...prev, req],
      );
    };

    // Listen for permission_request messages
    const unsubPermission = vscode.onMessage('permission_request', (message) => {
      const req = toPermissionRequest(message);
      if (req) enqueue(req);
    });

    const unsubCliOutput = vscode.onMessage('cli_output', (message) => {
      const req = getPermissionRequestFromCliOutput(message);
      if (req) {
        enqueue(req);
      }

      const cancelId = getPermissionCancelRequestId(message);
      if (cancelId) {
        setQueue((prev) => prev.filter((r) => r.requestId !== cancelId));
      }
    });

    // Listen for cancel_request messages
    const unsubCancel = vscode.onMessage('cancel_request', (message) => {
      const cancelId = message.requestId as string;
      setQueue((prev) => prev.filter((r) => r.requestId !== cancelId));
    });

    const unsubClear = vscode.onMessage('permissions_cleared', () => {
      setQueue([]);
    });

    const unsubProcessState = vscode.onMessage('process_state', (message) => {
      if (message.state === 'stopped' || message.state === 'crashed' || message.state === 'restarting') {
        setQueue([]);
      }
    });

    return () => {
      unsubPermission();
      unsubCliOutput();
      unsubCancel();
      unsubClear();
      unsubProcessState();
    };
  }, []);

  // Current request is the first in the FIFO queue
  const currentRequest = queue.length > 0 ? queue[0] : null;
  const pendingCount = queue.length;

  // Respond to the current request and remove it from the queue
  const respond = useCallback(
    (requestId: string, allowed: boolean, alwaysAllow?: boolean) => {
      vscode.postMessage({
        type: 'permission_response',
        requestId,
        allowed,
        alwaysAllow: alwaysAllow ?? false,
      });
      setQueue((prev) => prev.filter((r) => r.requestId !== requestId));
    },
    [],
  );

  // Dismiss the current request (deny it)
  const dismissRequest = useCallback(
    (requestId: string) => {
      respond(requestId, false);
    },
    [respond],
  );

  return {
    currentRequest,
    pendingCount,
    respond,
    dismissRequest,
  };
}
