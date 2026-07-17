import { useEffect, useState } from 'react';
import { vscode } from '../../vscode';

interface SettingsDialogProps {
  isOpen: boolean;
  onClose: () => void;
  showThinking: boolean;
  onToggleThinking: () => void;
}

export function SettingsDialog({ isOpen, onClose, showThinking, onToggleThinking }: SettingsDialogProps) {
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    return vscode.onMessage('settings_state', () => {
      setIsRefreshing(false);
    });
  }, []);

  useEffect(() => {
    if (isOpen) {
      setIsRefreshing(true);
      vscode.postMessage({ type: 'settings_refresh' });
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const refresh = () => {
    setIsRefreshing(true);
    vscode.postMessage({ type: 'settings_refresh' });
  };

  return (
    <div className="glass-dialog-backdrop fixed inset-0 z-50 flex items-center justify-center">
      <div className="glass-dialog rounded-lg w-[420px] max-w-[calc(100vw-24px)] overflow-hidden">
        <div className="px-5 py-4">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0' }}>
            <label htmlFor="show-thinking-toggle" style={{ cursor: 'pointer', userSelect: 'none', fontSize: 14 }}>Show Thinking</label>
            <button
              id="show-thinking-toggle"
              role="switch"
              aria-checked={showThinking}
              onClick={onToggleThinking}
              style={{
                width: 40,
                height: 22,
                borderRadius: 11,
                border: 'none',
                cursor: 'pointer',
                background: showThinking ? 'var(--app-brand-accent, #4fc3f7)' : 'var(--vscode-input-border, #555)',
                position: 'relative',
                transition: 'background 0.2s',
              }}
            >
              <span
                style={{
                  position: 'absolute',
                  top: 2,
                  left: showThinking ? 20 : 2,
                  width: 18,
                  height: 18,
                  borderRadius: '50%',
                  background: '#fff',
                  transition: 'left 0.2s',
                }}
              />
            </button>
          </div>
        </div>

        <div className="glass-dialog-section border-t px-4 py-3 flex justify-between items-center">
          <button
            onClick={refresh}
            disabled={isRefreshing}
            className="glass-control text-xs px-3 py-1.5 rounded text-[var(--vscode-foreground)] disabled:opacity-50"
          >
            {isRefreshing ? 'Refreshing...' : 'Refresh'}
          </button>
          <button
            onClick={onClose}
            className="glass-control text-xs px-3 py-1.5 rounded text-[var(--vscode-foreground)]"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
