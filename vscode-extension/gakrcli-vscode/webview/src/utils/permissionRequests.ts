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

const FILE_EDIT_TOOLS = new Set([
  'Write',
  'Edit',
  'MultiEdit',
  'FileEditTool',
  'FileWriteTool',
  'NotebookEditTool',
]);

export function getPermissionRequestFromCliOutput(message: Record<string, unknown>): PermissionRequest | null {
  const data = message.data as Record<string, unknown> | undefined;
  if (!data || data.type !== 'control_request' || typeof data.request_id !== 'string') {
    return null;
  }

  const request = data.request as Record<string, unknown> | undefined;
  if (!request || request.subtype !== 'can_use_tool' || typeof request.tool_name !== 'string') {
    return null;
  }

  if (FILE_EDIT_TOOLS.has(request.tool_name)) {
    return null;
  }

  return {
    requestId: data.request_id,
    toolName: request.tool_name,
    toolInput: (request.input as Record<string, unknown>) ?? {},
    riskLevel: classifyRisk(request.tool_name),
    title: typeof request.title === 'string' ? request.title : undefined,
    description: typeof request.description === 'string' ? request.description : undefined,
    decisionReason: typeof request.decision_reason === 'string' ? request.decision_reason : undefined,
    blockedPath: typeof request.blocked_path === 'string' ? request.blocked_path : undefined,
    permissionSuggestions: request.permission_suggestions as unknown[] | undefined,
    agentId: typeof request.agent_id === 'string' ? request.agent_id : undefined,
  };
}

function classifyRisk(toolName: string): string {
  const lower = toolName.toLowerCase();
  if (lower.includes('bash') || lower.includes('execute')) return 'high';
  if (lower.includes('write') || lower.includes('edit')) return 'medium';
  return 'low';
}
