// webview/src/hooks/usePermissions.ts
// React hook managing the queue of pending permission requests.
// Listens for permission_request and cancel_request messages from the extension host.

import { useState, useCallback, useEffect } from 'react';
import { vscode } from '../vscode';

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
      const req: PermissionRequest = {
        requestId: message.requestId as string,
        toolName: message.toolName as string,
        toolInput: (message.toolInput as Record<string, unknown>) ?? {},
        riskLevel: message.riskLevel as string | undefined,
        title: message.title as string | undefined,
        description: message.description as string | undefined,
        decisionReason: message.decisionReason as string | undefined,
        blockedPath: message.blockedPath as string | undefined,
        permissionSuggestions: message.permissionSuggestions as unknown[] | undefined,
        agentId: message.agentId as string | undefined,
      };
      enqueue(req);
    });

    const unsubCliOutput = vscode.onMessage('cli_output', (message) => {
      const data = message.data as Record<string, unknown> | undefined;
      if (data?.type === 'control_cancel_request') {
        const cancelId = data.request_id as string;
        setQueue((prev) => prev.filter((r) => r.requestId !== cancelId));
        return;
      }

      if (data?.type !== 'control_request') {
        return;
      }

      const request = data.request as Record<string, unknown> | undefined;
      if (request?.subtype !== 'can_use_tool') {
        return;
      }

      const toolName = String(request.tool_name ?? '');
      if (!toolName || isFileEditTool(toolName)) {
        return;
      }

      enqueue({
        requestId: data.request_id as string,
        toolName,
        toolInput: (request.input as Record<string, unknown>) ?? {},
        riskLevel: classifyRisk(toolName),
        title: (request.title as string | undefined) ?? (request.display_name as string | undefined),
        description: request.description as string | undefined,
        decisionReason: request.decision_reason as string | undefined,
        blockedPath: request.blocked_path as string | undefined,
        permissionSuggestions: request.permission_suggestions as unknown[] | undefined,
        agentId: request.agent_id as string | undefined,
      });
    });

    // Listen for cancel_request messages
    const unsubCancel = vscode.onMessage('cancel_request', (message) => {
      const cancelId = message.requestId as string;
      setQueue((prev) => prev.filter((r) => r.requestId !== cancelId));
    });

    return () => {
      unsubPermission();
      unsubCliOutput();
      unsubCancel();
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

function classifyRisk(toolName: string): string {
  const normalized = toolName.toLowerCase();
  if (normalized.includes('bash') || normalized.includes('shell') || normalized.includes('execute')) {
    return 'high';
  }
  if (normalized.includes('edit') || normalized.includes('write')) {
    return 'medium';
  }
  return 'low';
}

function isFileEditTool(toolName: string): boolean {
  return ['write', 'edit', 'multiedit', 'fileedittool', 'filewritetool', 'notebookedittool']
    .some((name) => toolName.toLowerCase().includes(name));
}
