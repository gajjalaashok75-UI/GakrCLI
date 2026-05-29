import { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { vscode } from '../../vscode';

interface ModelSelectorProps {
  currentModel: string | null;
  availableModels: Array<{ value: string; displayName: string }>;
}

export function ModelSelector({ currentModel, availableModels }: ModelSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [optimisticModel, setOptimisticModel] = useState<string | null>(null);
  const [menuRect, setMenuRect] = useState<{ left: number; top: number; width: number; maxHeight: number } | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const hasModelChoices = availableModels.length > 0;

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
      const target = e.target as Node;
      if (ref.current?.contains(target) || menuRef.current?.contains(target)) {
        return;
      }
      setIsOpen(false);
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

  useEffect(() => {
    if (optimisticModel && currentModel === optimisticModel) {
      setOptimisticModel(null);
    }
  }, [currentModel, optimisticModel]);

  const selectedModel = optimisticModel ?? currentModel;
  const displayName = availableModels.find((m) => m.value === selectedModel)?.value || selectedModel || 'Model';

  if (!hasModelChoices && !selectedModel) return null;

  return (
    <div ref={ref} style={{ position: 'relative', display: 'inline-flex', minWidth: 0 }}>
      <button
        className="glass-control"
        onClick={() => {
          if (!hasModelChoices) return;
          const nextOpen = !isOpen;
          setIsOpen(nextOpen);
          if (nextOpen) requestAnimationFrame(updateMenuRect);
        }}
        disabled={!hasModelChoices}
        title={`Model: ${displayName}`}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 4,
          padding: '2px 6px',
          fontSize: 11,
          borderRadius: 'var(--corner-radius-small)',
          color: 'var(--app-secondary-foreground)',
          cursor: hasModelChoices ? 'pointer' : 'default',
          whiteSpace: 'nowrap',
          minWidth: 0,
          maxWidth: 'min(300px, 52vw)',
        }}
      >
        <svg width="11" height="11" viewBox="0 0 16 16" fill="currentColor" style={{ opacity: 0.6 }}>
          <path d="M8 1a7 7 0 100 14A7 7 0 008 1zm0 1.5a5.5 5.5 0 110 11 5.5 5.5 0 010-11zM7 5v4.5l.5.5H11v-1H8V5H7z" />
        </svg>
        <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' }}>{displayName}</span>
        {hasModelChoices && (
          <svg width="8" height="8" viewBox="0 0 8 8" fill="currentColor" style={{ opacity: 0.6 }}>
            <path d="M1 2.5l3 3 3-3" stroke="currentColor" strokeWidth="1.2" fill="none" strokeLinecap="round" />
          </svg>
        )}
      </button>
      {isOpen && menuRect && createPortal(
        <div
          ref={menuRef}
          className="glass-menu"
          style={{
            position: 'fixed',
            left: menuRect.left,
            top: menuRect.top,
            width: menuRect.width,
            maxHeight: menuRect.maxHeight,
            overflowY: 'auto',
            borderRadius: 'var(--corner-radius-medium)',
            zIndex: 1000,
          }}
        >
          <div className="glass-menu-header" style={{ padding: '6px 12px', fontSize: 11, fontWeight: 600, color: 'var(--app-secondary-foreground)' }}>
            Select Model
          </div>
          {availableModels.map((m) => (
            <button
              key={m.value}
              onClick={() => {
                setOptimisticModel(m.value);
                vscode.postMessage({ type: 'set_model', model: m.value });
                setIsOpen(false);
              }}
              className={m.value === selectedModel ? 'glass-list-row-active' : 'glass-list-row'}
              style={{
                display: 'block',
                width: '100%',
                textAlign: 'left',
                padding: '8px 12px',
                fontSize: 12,
                background: m.value === selectedModel ? 'var(--app-list-active-background)' : 'transparent',
                color: m.value === selectedModel ? 'var(--app-list-active-foreground)' : 'var(--app-primary-foreground)',
                border: 'none',
                cursor: 'pointer',
                overflowWrap: 'anywhere',
              }}
              onMouseEnter={(e) => {
                if (m.value !== selectedModel) (e.currentTarget as HTMLButtonElement).style.background = 'var(--app-list-hover-background)';
              }}
              onMouseLeave={(e) => {
                if (m.value !== selectedModel) (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
              }}
            >
              {m.value}
              {m.value === selectedModel && <span style={{ marginLeft: 8, opacity: 0.5 }}>Selected</span>}
            </button>
          ))}
        </div>,
        document.body,
      )}
    </div>
  );
}
