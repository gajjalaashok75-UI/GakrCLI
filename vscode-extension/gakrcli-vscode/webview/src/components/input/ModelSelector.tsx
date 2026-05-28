import { useState, useRef, useEffect, useCallback } from 'react';
import { vscode } from '../../vscode';

interface ModelSelectorProps {
  currentModel: string | null;
  availableModels: Array<{ value: string; displayName: string }>;
}

export function ModelSelector({ currentModel, availableModels }: ModelSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [menuRect, setMenuRect] = useState<{ left: number; top: number; width: number; maxHeight: number } | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  const updateMenuRect = useCallback(() => {
    const anchor = ref.current;
    if (!anchor) return;

    const viewportWidth = window.innerWidth || document.documentElement.clientWidth;
    const anchorRect = anchor.getBoundingClientRect();
    const padding = 12;
    const width = Math.min(320, Math.max(200, viewportWidth - padding * 2));
    const left = Math.min(
      Math.max(anchorRect.left, padding),
      Math.max(padding, viewportWidth - width - padding),
    );
    const maxHeight = Math.min(300, Math.max(180, anchorRect.top - padding * 2));
    const top = Math.max(padding, anchorRect.top - maxHeight - 4);

    setMenuRect({ left, top, width, maxHeight });
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setIsOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    updateMenuRect();
    window.addEventListener('resize', updateMenuRect);
    window.addEventListener('scroll', updateMenuRect, true);
    return () => {
      window.removeEventListener('resize', updateMenuRect);
      window.removeEventListener('scroll', updateMenuRect, true);
    };
  }, [isOpen, updateMenuRect]);

  const displayName = availableModels.find((m) => m.value === currentModel)?.displayName || currentModel || 'Model';
  const shortName = displayName.length > 20 ? displayName.slice(0, 18) + '…' : displayName;

  if (availableModels.length === 0) return null;

  return (
    <div ref={ref} style={{ position: 'relative', display: 'inline-flex', minWidth: 0 }}>
      <button
        className="glass-control"
        onClick={() => {
          const nextOpen = !isOpen;
          setIsOpen(nextOpen);
          if (nextOpen) requestAnimationFrame(updateMenuRect);
        }}
        title={`Model: ${displayName}`}
        style={{
          display: 'flex', alignItems: 'center', gap: 4,
          padding: '2px 6px', fontSize: 11,
          borderRadius: 'var(--corner-radius-small)',
          color: 'var(--app-secondary-foreground)',
          cursor: 'pointer',
          whiteSpace: 'nowrap',
          minWidth: 0,
          maxWidth: 210,
        }}
      >
        <svg width="11" height="11" viewBox="0 0 16 16" fill="currentColor" style={{ opacity: 0.6 }}>
          <path d="M8 1a7 7 0 100 14A7 7 0 008 1zm0 1.5a5.5 5.5 0 110 11 5.5 5.5 0 010-11zM7 5v4.5l.5.5H11v-1H8V5H7z"/>
        </svg>
        <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' }}>{shortName}</span>
        <svg width="8" height="8" viewBox="0 0 8 8" fill="currentColor" style={{ opacity: 0.6 }}>
          <path d="M1 2.5l3 3 3-3" stroke="currentColor" strokeWidth="1.2" fill="none" strokeLinecap="round"/>
        </svg>
      </button>
      {isOpen && menuRect && (
        <div className="glass-menu" style={{
          position: 'fixed',
          left: menuRect.left,
          top: menuRect.top,
          width: menuRect.width,
          maxHeight: menuRect.maxHeight,
          overflowY: 'auto',
          borderRadius: 'var(--corner-radius-medium)',
          zIndex: 1000,
        }}>
          <div className="glass-menu-header" style={{ padding: '6px 12px', fontSize: 11, fontWeight: 600, color: 'var(--app-secondary-foreground)' }}>
            Select Model
          </div>
          {availableModels.map((m) => (
            <button
              key={m.value}
              onClick={() => {
                vscode.postMessage({ type: 'set_model', model: m.value });
                setIsOpen(false);
              }}
              className={m.value === currentModel ? 'glass-list-row-active' : 'glass-list-row'}
              style={{
                display: 'block', width: '100%', textAlign: 'left',
                padding: '8px 12px', fontSize: 12,
                background: m.value === currentModel ? 'var(--app-list-active-background)' : 'transparent',
                color: m.value === currentModel ? 'var(--app-list-active-foreground)' : 'var(--app-primary-foreground)',
                border: 'none', cursor: 'pointer',
              }}
              onMouseEnter={(e) => {
                if (m.value !== currentModel) (e.currentTarget as HTMLButtonElement).style.background = 'var(--app-list-hover-background)';
              }}
              onMouseLeave={(e) => {
                if (m.value !== currentModel) (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
              }}
            >
              {m.displayName}
              {m.value === currentModel && <span style={{ marginLeft: 8, opacity: 0.5 }}>✓</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
