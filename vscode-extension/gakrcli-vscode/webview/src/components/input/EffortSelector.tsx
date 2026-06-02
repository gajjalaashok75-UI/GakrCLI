import { useState, useRef, useEffect } from 'react';
import { vscode } from '../../vscode';

const EFFORTS = [
  { value: 'low', label: 'Low', bar: '▁' },
  { value: 'medium', label: 'Medium', bar: '▃' },
  { value: 'high', label: 'High', bar: '▅' },
  { value: 'max', label: 'Max', bar: '█' },
];

interface EffortSelectorProps {
  currentEffort?: string | null;
  disabled?: boolean;
  onEffortChange?: (level: string) => void;
}

export function EffortSelector({ currentEffort, disabled, onEffortChange }: EffortSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setIsOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [isOpen]);

  const current = EFFORTS.find((e) => e.value === currentEffort) ?? EFFORTS[1];

  return (
    <div ref={ref} style={{ position: 'relative', display: 'inline-flex' }}>
      <button
        className="glass-control"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        title={`Effort: ${current.label}`}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          width: 26, height: 26, borderRadius: 'var(--corner-radius-small)',
          cursor: disabled ? 'not-allowed' : 'pointer',
          color: 'var(--app-secondary-foreground)',
          opacity: disabled ? 0.4 : 1, padding: 0, fontSize: 13, fontFamily: 'monospace',
        }}
      >
        {current.bar}
      </button>
      {isOpen && (
        <div className="glass-menu" style={{
          position: 'absolute', bottom: '100%', right: 0, marginBottom: 4,
          width: 160,
          borderRadius: 'var(--corner-radius-medium)',
          zIndex: 50,
        }}>
          <div className="glass-menu-header" style={{ padding: '6px 12px', fontSize: 11, fontWeight: 600, color: 'var(--app-secondary-foreground)' }}>
            Effort Level
          </div>
          {EFFORTS.map((e) => (
            <button
              key={e.value}
              onClick={() => {
                if (onEffortChange) {
                  onEffortChange(e.value);
                } else {
                  vscode.postMessage({ type: 'set_effort_level', level: e.value });
                }
                setIsOpen(false);
              }}
              className={e.value === currentEffort ? 'glass-list-row-active' : 'glass-list-row'}
              style={{
                display: 'flex', alignItems: 'center', gap: 8, width: '100%',
                padding: '7px 12px', fontSize: 12, textAlign: 'left',
                background: e.value === currentEffort ? 'var(--app-list-active-background)' : 'transparent',
                color: e.value === currentEffort ? 'var(--app-list-active-foreground)' : 'var(--app-primary-foreground)',
                border: 'none', cursor: 'pointer',
              }}
            >
              <span style={{ fontFamily: 'monospace', width: 14 }}>{e.bar}</span>
              <span>{e.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
