import type { PermissionRequest } from '../hooks/usePermissions';

export function toPermissionRequest(message: Record<string, unknown>): PermissionRequest | null {
  if (message.type && message.type !== 'permission_request') {
    return null;
  }
  if (typeof message.requestId !== 'string' || typeof message.toolName !== 'string') {
    return null;
  }

  return {
    requestId: message.requestId,
    toolName: message.toolName,
    toolInput: (message.toolInput as Record<string, unknown>) ?? {},
    riskLevel: message.riskLevel as string | undefined,
    title: message.title as string | undefined,
    description: message.description as string | undefined,
    decisionReason: message.decisionReason as string | undefined,
    blockedPath: message.blockedPath as string | undefined,
    permissionSuggestions: message.permissionSuggestions as unknown[] | undefined,
    agentId: message.agentId as string | undefined,
  };
}

export function getPermissionCancelRequestId(message: Record<string, unknown>): string | null {
  const data = message.data as Record<string, unknown> | undefined;
  if (data?.type !== 'control_cancel_request' || typeof data.request_id !== 'string') {
    return null;
  }
  return data.request_id;
}
