// webview/src/components/dialogs/PermissionDialog.tsx
// Permission dialog matching CLI design exactly:
// - Risk badge as a capsule
// - Parsed tool input by type (Write→file_path+content, Bash→command)
// - CLI-matching options: Yes / Yes for Session / Full Access (conditional) / No with reason / No
// - Custom user feedback input field for deny with reason
//
// CLI reference: permissionOptions.tsx — getFilePermissionOptions() shows:
//  Yes (accept-once), Yes for session (accept-session),
//  Full Access (accept-full-access, conditional on bypassAvailable),
//  No with reason (reject+withReason, shows input), No (reject)

import { useState } from 'react';
import type { PermissionRequest } from '../../utils/permissionRequests';
import type { PermissionModeValue } from '../input/ModeSelector';

interface PermissionDialogProps {
  request: PermissionRequest;
  pendingCount: number;
  onAllow: (requestId: string) => void;
  onAlwaysAllow: (requestId: string) => void;
  onDeny: (requestId: string, reason?: string) => void;
  onFullAccess?: (requestId: string) => void;
  currentMode?: PermissionModeValue;
}

/** Map risk to color */
function riskColor(level?: string): string {
  switch (level) {
    case 'high': return 'var(--vscode-terminal-ansiRed, #f48771)';
    case 'medium': return 'var(--vscode-terminal-ansiYellow, #ffd700)';
    case 'low': return 'var(--vscode-terminal-ansiGreen, #4ec9b0)';
    default: return 'var(--vscode-charts-blue, #4fc3f7)';
  }
}

/** Parse tool input and return formatted display fields */
function parseToolInput(toolName: string, input: unknown): { label: string; value: string }[] {
  if (!input || typeof input !== 'object') return [];
  const obj = input as Record<string, unknown>;

  switch (toolName) {
    case 'Write':
    case 'FileWriteTool': {
      const fields: { label: string; value: string }[] = [];
      if (typeof obj.file_path === 'string') {
        fields.push({ label: 'File', value: obj.file_path });
      }
      if (typeof obj.content === 'string') {
        const preview = obj.content.length > 500
          ? obj.content.slice(0, 500) + '\n… (truncated)'
          : obj.content;
        fields.push({ label: 'Content', value: preview });
      }
      return fields;
    }
    case 'Edit':
    case 'FileEditTool': {
      const fields: { label: string; value: string }[] = [];
      if (typeof obj.file_path === 'string') {
        fields.push({ label: 'File', value: obj.file_path });
      }
      if (typeof obj.old_string === 'string') {
        fields.push({ label: 'Replace', value: obj.old_string });
      }
      if (typeof obj.new_string === 'string') {
        fields.push({ label: 'With', value: obj.new_string });
      }
      return fields;
    }
    case 'Bash':
    case 'PowerShellTool': {
      const fields: { label: string; value: string }[] = [];
      if (typeof obj.command === 'string') {
        fields.push({ label: 'Command', value: obj.command });
      }
      if (typeof obj.description === 'string') {
        fields.push({ label: 'Description', value: obj.description });
      }
      return fields;
    }
    case 'Read':
    case 'Glob':
    case 'Grep': {
      const fields: { label: string; value: string }[] = [];
      if (typeof obj.file_path === 'string') {
        fields.push({ label: 'Path', value: obj.file_path });
      }
      if (typeof obj.pattern === 'string') {
        fields.push({ label: 'Pattern', value: obj.pattern });
      }
      return fields;
    }
    case 'WebFetch': {
      const fields: { label: string; value: string }[] = [];
      if (typeof obj.url === 'string') {
        fields.push({ label: 'URL', value: obj.url });
      }
      return fields;
    }
    default:
      // Fallback: show first 2 keys as label-value
      return Object.entries(obj).slice(0, 3).map(([k, v]) => ({
        label: k,
        value: typeof v === 'string' ? v : JSON.stringify(v),
      }));
  }
}

export function PermissionDialog({
  request,
  pendingCount,
  onAllow,
  onAlwaysAllow,
  onDeny,
  currentMode,
}: PermissionDialogProps) {
  const toolName = request.toolName;
  const riskLevel = request.riskLevel;
  const parsedFields = parseToolInput(toolName, request.toolInput);

  // Feedback input states (like CLI's "tell GakrCLI what to do next")
  const [feedback, setFeedback] = useState('');
  const [showDenyWithReason, setShowDenyWithReason] = useState(false);

  const handleSelect = (action: 'allow' | 'session' | 'fullAccess' | 'denyWithReason' | 'deny') => {
    if (action === 'denyWithReason') {
      // "No, provide reason" — input always shows on first click
      if (!showDenyWithReason) {
        setShowDenyWithReason(true);
        return;
      }
      // Submit with reason
      onDeny(request.requestId, feedback || undefined);
      setShowDenyWithReason(false);
      setFeedback('');
      return;
    }

    if (action === 'deny') {
      // "No" — deny without reason (like CLI's plain reject)
      onDeny(request.requestId, undefined);
      setShowDenyWithReason(false);
      setFeedback('');
      return;
    }

    // Allow actions
    if (action === 'allow') {
      onAllow(request.requestId);
    } else if (action === 'session') {
      onAlwaysAllow(request.requestId);
    } else if (action === 'fullAccess') {
      // "Yes, and enable Full Access" — allow once + mode change
      onAllow(request.requestId);
      onFullAccess?.(request.requestId);
    }

    setShowDenyWithReason(false);
    setFeedback('');
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 50,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(0, 0, 0, 0.5)',
        backdropFilter: 'blur(2px)',
      }}
    >
      <div
        style={{
          width: '90%',
          maxWidth: 520,
          maxHeight: '80vh',
          borderRadius: 'var(--corner-radius-large, 10px)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
          border: '1px solid var(--vscode-panel-border, rgba(255,255,255,0.1))',
          background: 'var(--vscode-editor-background, #1e1e1e)',
        }}
      >
        {/* ===== Header: Tool name + risk capsule ===== */}
        <div
          style={{
            padding: '12px 16px 8px 16px',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            flexWrap: 'wrap',
          }}
        >
          {/* Tool name and icon */}
          <span style={{ fontWeight: 600, fontSize: 14, color: 'var(--vscode-editor-foreground)' }}>
            {toolName}
          </span>

          {/* Risk capsule */}
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              padding: '1px 8px',
              borderRadius: 10,
              fontSize: 10,
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.3px',
              background: riskColor(riskLevel),
              color: '#000',
              lineHeight: '18px',
            }}
          >
            <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4z"/>
            </svg>
            {riskLevel ?? 'info'}
          </span>

          {/* Mode badge (non-default) */}
          {currentMode && currentMode !== 'default' && (
            <span
              style={{
                padding: '1px 8px',
                borderRadius: 10,
                fontSize: 10,
                fontWeight: 500,
                background: 'var(--vscode-badge-background, rgba(255,255,255,0.08))',
                color: 'var(--vscode-badge-foreground)',
                lineHeight: '18px',
              }}
            >
              {currentMode}
            </span>
          )}

          {/* Pending count */}
          {pendingCount > 1 && (
            <span style={{ fontSize: 11, color: 'var(--vscode-descriptionForeground, #8b8b8b)' }}>
              +{pendingCount - 1} pending
            </span>
          )}
        </div>

        {/* ===== Parsed tool fields (not raw JSON) ===== */}
        {parsedFields.length > 0 && (
          <div style={{ padding: '4px 16px 8px 16px', display: 'flex', flexDirection: 'column', gap: 6 }}>
            {parsedFields.map((field, i) => (
              <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                <div style={{
                  fontSize: 10,
                  fontWeight: 600,
                  color: 'var(--vscode-descriptionForeground, #8b8b8b)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                }}>
                  {field.label}
                </div>
                <pre style={{
                  margin: 0,
                  padding: '6px 8px',
                  fontSize: 11,
                  lineHeight: 1.4,
                  fontFamily: 'var(--vscode-editor-font-family, monospace)',
                  background: 'var(--vscode-textCodeBlock-background, rgba(255,255,255,0.03))',
                  borderRadius: 4,
                  overflow: 'auto',
                  maxHeight: field.label === 'Content' ? 160 : 80,
                  color: 'var(--vscode-editor-foreground)',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                }}>
                  {field.value}
                </pre>
              </div>
            ))}
          </div>
        )}

        {/* Description / reason */}
        {request.description && (
          <div style={{
            padding: '0 16px 8px 16px',
            fontSize: 12,
            color: 'var(--vscode-editor-foreground)',
            lineHeight: 1.4,
            whiteSpace: 'pre-wrap',
          }}>
            {request.description}
          </div>
        )}

        {/* Decision reason (blocked tool reason) */}
        {request.decisionReason && (
          <div style={{
            margin: '0 16px 8px 16px',
            fontSize: 11,
            color: 'var(--vscode-errorForeground, #f48771)',
            padding: '6px 8px',
            background: 'rgba(244, 135, 113, 0.08)',
            borderRadius: 4,
          }}>
            {request.decisionReason}
          </div>
        )}

        {/* Blocked path */}
        {request.blockedPath && (
          <div style={{
            margin: '0 16px 8px 16px',
            fontSize: 11,
            color: 'var(--vscode-textPreformat-foreground, #ce9178)',
            fontFamily: 'var(--vscode-editor-font-family, monospace)',
            padding: '6px 8px',
            background: 'rgba(255,255,255,0.04)',
            borderRadius: 4,
            wordBreak: 'break-all',
          }}>
            {request.blockedPath}
          </div>
        )}

        {/* ===== Vertical options list (like CLI) ===== */}
        <div style={{
          padding: '4px 16px 12px 16px',
          display: 'flex',
          flexDirection: 'column',
          gap: 4,
        }}>
          {/* Option 1: Yes (Allow Once) — matches CLI "Yes" accept-once */}
          <OptionButton
            label="Yes"
            shortcut="Enter"
            color="var(--vscode-charts-green, #4ec9b0)"
            active={false}
            onClick={() => handleSelect('allow')}
          />

          {/* Option 2: Yes for Session — matches CLI "Yes, allow all edits during this session" */}
          <OptionButton
            label="Yes, allow all during this session"
            shortcut="S"
            color="var(--vscode-charts-blue, #4fc3f7)"
            active={false}
            onClick={() => handleSelect('session')}
          />

          {/* Option 3: Full Access — matches CLI "Yes, and enable Full Access for this session" */}
          <OptionButton
            label="Yes, and enable Full Access for this session"
            shortcut="F"
            color="var(--vscode-terminal-ansiRed, #f48771)"
            active={false}
            onClick={() => handleSelect('fullAccess')}
          />

          {/* Option 4: No with reason — matches CLI "No, provide reason" (reject+withReason) */}
          <OptionButton
            label="No, provide reason"
            shortcut="R"
            color="var(--vscode-errorForeground, #f48771)"
            active={showDenyWithReason}
            onClick={() => handleSelect('denyWithReason')}
          >
            {showDenyWithReason && (
              <div style={{ marginTop: 6 }}>
                <input
                  autoFocus
                  type="text"
                  placeholder="tell GakrCLI what to do differently"
                  value={feedback}
                  onChange={(e) => setFeedback(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      handleSelect('denyWithReason');
                    }
                    if (e.key === 'Escape') {
                      setShowDenyWithReason(false);
                      setFeedback('');
                    }
                  }}
                  style={{
                    width: '100%',
                    padding: '6px 8px',
                    fontSize: 12,
                    fontFamily: 'inherit',
                    borderRadius: 4,
                    border: '1px solid var(--vscode-input-border, rgba(255,255,255,0.15))',
                    background: 'var(--vscode-input-background, rgba(255,255,255,0.05))',
                    color: 'var(--vscode-input-foreground)',
                    outline: 'none',
                    boxSizing: 'border-box',
                  }}
                />
                <div style={{ fontSize: 10, color: 'var(--vscode-descriptionForeground, #888)', marginTop: 2 }}>
                  Enter to confirm · Escape to cancel
                </div>
              </div>
            )}
          </OptionButton>

          {/* Option 5: No (deny without reason) — matches CLI "No" reject */}
          <OptionButton
            label="No"
            shortcut="D"
            color="var(--vscode-errorForeground, #f48771)"
            active={false}
            onClick={() => handleSelect('deny')}
          />
        </div>
      </div>
    </div>
  );
}

/** Single option button styled like CLI's select list */
function OptionButton({
  label,
  shortcut,
  color,
  active,
  onClick,
  children,
}: {
  label: string;
  shortcut: string;
  color: string;
  active?: boolean;
  onClick: () => void;
  children?: React.ReactNode;
}) {
  return (
    <div
      onClick={onClick}
      style={{
        display: 'flex',
        flexDirection: 'column',
        padding: '6px 10px',
        borderRadius: 4,
        cursor: 'pointer',
        background: active ? 'rgba(255,255,255,0.08)' : 'transparent',
        border: active ? '1px solid ' + color : '1px solid transparent',
        transition: 'background 0.1s',
      }}
      onMouseEnter={(e) => {
        if (!active) (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.04)';
      }}
      onMouseLeave={(e) => {
        if (!active) (e.currentTarget as HTMLElement).style.background = 'transparent';
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {/* Shortcut key */}
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            minWidth: 18,
            height: 18,
            borderRadius: 3,
            fontSize: 10,
            fontWeight: 700,
            color: '#000',
            background: color,
            padding: '0 4px',
          }}
        >
          {shortcut}
        </span>

        {/* Label */}
        <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--vscode-editor-foreground)' }}>
          {label}
        </span>
      </div>

      {children}
    </div>
  );
}
