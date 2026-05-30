import React, { useEffect, useMemo, useState } from 'react';
import { vscode } from '../../vscode';

interface SettingsDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

interface ModelOption {
  value: string;
  displayName?: string;
}

interface SupportedSetting {
  key: string;
  label: string;
  kind: string;
}

interface SettingsState {
  supportedSettings?: SupportedSetting[];
  current?: {
    model?: string;
    permissionMode?: string;
    effort?: string | number | null;
    maxThinkingTokens?: number | null;
    fastMode?: boolean;
  };
  models?: ModelOption[];
  providers?: Array<{ id?: string; label?: string; name?: string; provider?: string }>;
  profiles?: Array<{ id?: string; name?: string; provider?: string; model?: string; active?: boolean }>;
  mcpServers?: Array<{ name?: string; status?: string }>;
  plugins?: Array<{ name?: string; status?: string }>;
  contextUsage?: {
    totalTokens?: number;
    maxTokens?: number;
    percentage?: number;
  };
  error?: string;
}

type FormState = {
  model: string;
  permissionMode: string;
  effort: string;
  maxThinkingTokens: string;
  fastMode: boolean;
};

const PERMISSION_MODES = [
  { value: 'default', label: 'Default' },
  { value: 'acceptEdits', label: 'Accept edits' },
  { value: 'plan', label: 'Plan' },
  { value: 'bypassPermissions', label: 'Bypass permissions' },
  { value: 'dontAsk', label: 'Do not ask' },
];

const EFFORT_LEVELS = [
  { value: '', label: 'Adaptive' },
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
  { value: 'max', label: 'Max' },
];

export function SettingsDialog({ isOpen, onClose }: SettingsDialogProps) {
  const [state, setState] = useState<SettingsState>({});
  const [isSaving, setIsSaving] = useState(false);
  const [form, setForm] = useState<FormState>({
    model: '',
    permissionMode: 'default',
    effort: '',
    maxThinkingTokens: '',
    fastMode: false,
  });

  useEffect(() => {
    return vscode.onMessage('settings_state', (message) => {
      const next = message as unknown as SettingsState;
      setState(next);
      const current = next.current ?? {};
      setForm({
        model: current.model ?? '',
        permissionMode: current.permissionMode ?? 'default',
        effort: current.effort === null || current.effort === undefined ? '' : String(current.effort),
        maxThinkingTokens: current.maxThinkingTokens === null || current.maxThinkingTokens === undefined
          ? ''
          : String(current.maxThinkingTokens),
        fastMode: current.fastMode === true,
      });
      setIsSaving(false);
    });
  }, []);

  useEffect(() => {
    if (isOpen) {
      vscode.postMessage({ type: 'settings_refresh' });
    }
  }, [isOpen]);

  const supported = state.supportedSettings ?? [];
  const activeProfile = useMemo(
    () => (state.profiles ?? []).find((profile) => profile.active),
    [state.profiles],
  );

  if (!isOpen) return null;

  const apply = () => {
    setIsSaving(true);
    vscode.postMessage({
      type: 'settings_update',
      settings: {
        model: form.model || undefined,
        permissionMode: form.permissionMode,
        effort: form.effort || null,
        maxThinkingTokens: form.maxThinkingTokens ? Number(form.maxThinkingTokens) : undefined,
        fastMode: form.fastMode,
      },
    });
  };

  return (
    <div className="glass-dialog-backdrop fixed inset-0 z-50 flex items-center justify-center">
      <div className="glass-dialog rounded-lg w-[620px] max-w-[calc(100vw-24px)] max-h-[86vh] flex flex-col">
        <div className="glass-dialog-section flex items-center justify-between px-4 py-3 border-b">
          <div>
            <h2 className="text-sm font-semibold text-[var(--vscode-foreground)]">Runtime Settings</h2>
            <p className="text-xs text-[var(--vscode-descriptionForeground)] mt-0.5">
              SDK-backed controls for this GakrCLI session
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-[var(--vscode-foreground)] hover:text-[var(--vscode-errorForeground)] text-lg leading-none px-1"
            aria-label="Close settings"
          >
            &times;
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {state.error && (
            <div className="rounded border border-[var(--vscode-inputValidation-errorBorder)] bg-red-500/10 px-3 py-2 text-xs text-[var(--vscode-errorForeground)]">
              {state.error}
            </div>
          )}

          <section className="glass-dialog-section rounded border p-3">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Model">
                <select
                  value={form.model}
                  onChange={(e) => setForm((prev) => ({ ...prev, model: e.target.value }))}
                  className="glass-input w-full px-2 py-1.5 text-xs rounded"
                >
                  {form.model && !state.models?.some((model) => model.value === form.model) && (
                    <option value={form.model}>{form.model}</option>
                  )}
                  {(state.models ?? []).map((model) => (
                    <option key={model.value} value={model.value}>
                      {model.displayName || model.value}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Permission Mode">
                <select
                  value={form.permissionMode}
                  onChange={(e) => setForm((prev) => ({ ...prev, permissionMode: e.target.value }))}
                  className="glass-input w-full px-2 py-1.5 text-xs rounded"
                >
                  {PERMISSION_MODES.map((mode) => (
                    <option key={mode.value} value={mode.value}>{mode.label}</option>
                  ))}
                </select>
              </Field>

              <Field label="Reasoning Effort">
                <select
                  value={form.effort}
                  onChange={(e) => setForm((prev) => ({ ...prev, effort: e.target.value }))}
                  className="glass-input w-full px-2 py-1.5 text-xs rounded"
                >
                  {EFFORT_LEVELS.map((effort) => (
                    <option key={effort.value} value={effort.value}>{effort.label}</option>
                  ))}
                </select>
              </Field>

              <Field label="Max Thinking Tokens">
                <input
                  type="number"
                  min={0}
                  value={form.maxThinkingTokens}
                  onChange={(e) => setForm((prev) => ({ ...prev, maxThinkingTokens: e.target.value }))}
                  className="glass-input w-full px-2 py-1.5 text-xs rounded"
                  placeholder="Adaptive"
                />
              </Field>
            </div>

            <label className="mt-3 flex items-center gap-2 text-xs text-[var(--vscode-foreground)] cursor-pointer">
              <input
                type="checkbox"
                checked={form.fastMode}
                onChange={(e) => setForm((prev) => ({ ...prev, fastMode: e.target.checked }))}
                className="accent-[var(--vscode-focusBorder)]"
              />
              Fast mode
            </label>
          </section>

          <section className="glass-dialog-section rounded border p-3">
            <h3 className="text-xs font-semibold text-[var(--vscode-foreground)] mb-2">Supported Updates</h3>
            <div className="flex flex-wrap gap-1.5">
              {supported.map((setting) => (
                <span
                  key={setting.key}
                  className="rounded border border-[var(--vscode-panel-border)] px-2 py-1 text-[10px] text-[var(--vscode-descriptionForeground)]"
                  title={`${setting.key}: ${setting.kind}`}
                >
                  {setting.label}
                </span>
              ))}
            </div>
          </section>

          <section className="grid grid-cols-2 gap-3">
            <SummaryCard label="Provider" value={activeProfile?.provider ?? state.providers?.[0]?.label ?? 'Unavailable'} />
            <SummaryCard label="Profile" value={activeProfile?.name ?? 'None'} />
            <SummaryCard label="MCP Servers" value={`${state.mcpServers?.length ?? 0}`} />
            <SummaryCard label="Plugins" value={`${state.plugins?.length ?? 0}`} />
            <SummaryCard
              label="Context"
              value={state.contextUsage?.maxTokens
                ? `${state.contextUsage.totalTokens ?? 0} / ${state.contextUsage.maxTokens}`
                : 'Not measured'}
            />
            <SummaryCard
              label="Context Used"
              value={typeof state.contextUsage?.percentage === 'number'
                ? `${Math.round(state.contextUsage.percentage)}%`
                : 'Unknown'}
            />
          </section>
        </div>

        <div className="glass-dialog-section border-t px-4 py-3 flex justify-between items-center">
          <button
            onClick={() => vscode.postMessage({ type: 'settings_refresh' })}
            className="glass-control text-xs px-3 py-1.5 rounded text-[var(--vscode-foreground)]"
          >
            Refresh
          </button>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="glass-control text-xs px-3 py-1.5 rounded text-[var(--vscode-foreground)]"
            >
              Close
            </button>
            <button
              onClick={apply}
              disabled={isSaving}
              className="glass-control text-xs px-3 py-1.5 rounded text-[var(--vscode-button-foreground)] disabled:opacity-50"
            >
              {isSaving ? 'Applying...' : 'Apply'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-[11px] font-medium text-[var(--vscode-descriptionForeground)] mb-1">
        {label}
      </span>
      {children}
    </label>
  );
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="glass-dialog-section rounded border p-3 min-w-0">
      <div className="text-[10px] uppercase text-[var(--vscode-descriptionForeground)]">{label}</div>
      <div className="mt-1 text-xs text-[var(--vscode-foreground)] truncate" title={value}>
        {value}
      </div>
    </div>
  );
}
