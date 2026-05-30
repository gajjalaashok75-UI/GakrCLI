import { useEffect, useState } from 'react';
import { vscode } from '../../vscode';

interface SettingsDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SettingsDialog({ isOpen, onClose }: SettingsDialogProps) {
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
        <div className="px-5 py-8 text-center">
          <p className="text-sm text-[var(--vscode-foreground)]">
            Settings are coming soon. Keep checking for updates.
          </p>
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
