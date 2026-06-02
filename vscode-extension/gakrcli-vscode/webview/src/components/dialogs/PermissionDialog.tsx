import { useCallback, useEffect } from 'react';
import type { PermissionRequest } from '../../hooks/usePermissions';

interface PermissionDialogProps {
  request: PermissionRequest;
  pendingCount: number;
  onAllow: (requestId: string) => void;
  onAlwaysAllow: (requestId: string) => void;
  onDeny: (requestId: string) => void;
}

function formatToolInput(toolName: string, input: Record<string, unknown>): string {
  const lowerName = toolName.toLowerCase();

  if (lowerName.includes('bash') || lowerName.includes('execute')) {
    const cmd = input.command ?? input.cmd ?? input.script;
    if (typeof cmd === 'string') return cmd;
  }

  if (lowerName.includes('read') || lowerName.includes('search')) {
    const path = input.path ?? input.file ?? input.file_path ?? input.pattern;
    if (typeof path === 'string') return path;
  }

  if (lowerName.includes('write') || lowerName.includes('edit')) {
    const path = input.path ?? input.file_path ?? input.filename;
    if (typeof path === 'string') {
      const content = input.content ?? input.new_string ?? input.text;
      if (typeof content === 'string') {
        const preview = content.length > 220 ? `${content.slice(0, 220)}...` : content;
        return `${path}\n\n${preview}`;
      }
      return path;
    }
  }

  try {
    return JSON.stringify(input, null, 2);
  } catch {
    return String(input);
  }
}

export function PermissionDialog({
  request,
  pendingCount,
  onAllow,
  onAlwaysAllow,
  onDeny,
}: PermissionDialogProps) {
  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if ((event.key === 'Enter' && !event.shiftKey) || event.key === '1') {
        event.preventDefault();
        onAllow(request.requestId);
      } else if (event.key === '2') {
        event.preventDefault();
        onAlwaysAllow(request.requestId);
      } else if (event.key === '3' || event.key === 'Escape') {
        event.preventDefault();
        onDeny(request.requestId);
      }
    },
    [request.requestId, onAllow, onAlwaysAllow, onDeny],
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  const formattedInput = formatToolInput(request.toolName, request.toolInput);
  const title = request.title || `Do you want to allow ${request.toolName} to run?`;

  return (
    <div className="permission-modal-backdrop fixed inset-0 z-50 flex items-center justify-center">
      <div className="permission-glass-dialog permission-card-shell">
        <div className="permission-card-title">
          <span>{title}</span>
          {pendingCount > 1 && <span className="permission-card-count">+{pendingCount - 1}</span>}
        </div>

        <div className="permission-card-meta">
          {(request.riskLevel ? `${request.riskLevel} risk` : 'Permission required')} · {request.toolName}
        </div>

        <pre className="permission-card-code">{formattedInput}</pre>

        <div className="permission-card-body">
          {request.description && <div className="permission-card-note">{request.description}</div>}
          {request.decisionReason && <div className="permission-card-note">{request.decisionReason}</div>}
          {request.blockedPath && <div className="permission-card-warning">Blocked path: {request.blockedPath}</div>}
          {request.agentId && <div className="permission-card-note">Agent: {request.agentId}</div>}
        </div>

        <div className="permission-choice-list">
          <PermissionChoice index="1." label="Yes" hint="Allow once" onClick={() => onAllow(request.requestId)} />
          <PermissionChoice
            index="2."
            label="Yes, and don't ask again"
            hint={`Always allow ${request.toolName}`}
            onClick={() => onAlwaysAllow(request.requestId)}
          />
          <PermissionChoice
            index="3."
            label="No"
            hint="Deny this request"
            muted
            onClick={() => onDeny(request.requestId)}
          />
        </div>
      </div>
    </div>
  );
}

function PermissionChoice({
  index,
  label,
  hint,
  muted = false,
  onClick,
}: {
  index: string;
  label: string;
  hint: string;
  muted?: boolean;
  onClick: () => void;
}) {
  return (
    <button className={`permission-choice-row ${muted ? 'permission-choice-muted' : ''}`} onClick={onClick}>
      <span className="permission-choice-index">{index}</span>
      <span className="permission-choice-label">{label}</span>
      <span className="permission-choice-hint">{hint}</span>
    </button>
  );
}
