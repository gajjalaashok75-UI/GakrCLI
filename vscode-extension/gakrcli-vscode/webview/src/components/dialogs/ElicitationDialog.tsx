// webview/src/components/dialogs/ElicitationDialog.tsx
import React, { useState, useCallback } from 'react';
import type {
  ElicitationRequest,
  ElicitationField,
  ElicitationOption,
} from '../../types/interactions';

interface ElicitationDialogProps {
  request: ElicitationRequest;
  onSubmit: (values: Record<string, unknown>) => void;
  onCancel: () => void;
}

export const ElicitationDialog: React.FC<ElicitationDialogProps> = ({
  request,
  onSubmit,
  onCancel,
}) => {
  const [values, setValues] = useState<Record<string, unknown>>(() => {
    const defaults: Record<string, unknown> = {};
    for (const field of request.fields) {
      if (field.default !== undefined) {
        defaults[field.name] = field.default;
      } else if (field.type.type === 'multiselect') {
        defaults[field.name] = [];
      } else if (field.type.type === 'confirm') {
        defaults[field.name] = (field.type as { type: 'confirm'; default?: boolean }).default ?? false;
      } else {
        defaults[field.name] = '';
      }
    }
    return defaults;
  });

  const setValue = useCallback((name: string, value: unknown) => {
    setValues((prev) => ({ ...prev, [name]: value }));
  }, []);

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      onSubmit(values);
    },
    [values, onSubmit],
  );

  const isValid = request.fields.every((field) => {
    if (!field.required) return true;
    const val = values[field.name];
    if (val === undefined || val === null || val === '') return false;
    if (Array.isArray(val) && val.length === 0) return false;
    return true;
  });

  return (
    <div className="permission-modal-backdrop fixed inset-0 z-50 flex items-center justify-center">
      <div className="permission-glass-dialog permission-card-shell">
        <div className="permission-card-title">
          <span>{request.message}</span>
        </div>
        <div className="permission-card-meta">Question from GakrCLI</div>

        <form onSubmit={handleSubmit} className="space-y-3">
          {request.fields.map((field) => (
            <FieldRenderer
              key={field.name}
              field={field}
              value={values[field.name]}
              onChange={(val) => setValue(field.name, val)}
            />
          ))}

          <div className="permission-choice-list">
            <button
              type="button"
              className="permission-choice-row permission-choice-muted"
              onClick={onCancel}
            >
              <span className="permission-choice-index">1.</span>
              <span className="permission-choice-label">Skip</span>
              <span className="permission-choice-hint">Continue without answering</span>
            </button>
            <button
              type="submit"
              className="permission-choice-row"
              disabled={!isValid}
            >
              <span className="permission-choice-index">2.</span>
              <span className="permission-choice-label">Submit</span>
              <span className="permission-choice-hint">Send answer to the model</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

/** Renders a single elicitation field based on its type */
const FieldRenderer: React.FC<{
  field: ElicitationField;
  value: unknown;
  onChange: (value: unknown) => void;
}> = ({ field, value, onChange }) => {
  const fieldType = field.type;

  return (
    <div>
      <label className="block text-xs font-medium text-[var(--vscode-descriptionForeground)] mb-1">
        {field.label}
        {field.required && <span className="text-red-400 ml-0.5">*</span>}
      </label>

      {fieldType.type === 'text' && (
        <input
          type="text"
          className="w-full px-2 py-1.5 text-sm rounded border border-[var(--vscode-input-border)] bg-[var(--vscode-input-background)] text-[var(--vscode-input-foreground)] outline-none focus:border-[var(--vscode-focusBorder)]"
          placeholder={(fieldType as { type: 'text'; placeholder?: string }).placeholder ?? ''}
          value={(value as string) ?? ''}
          onChange={(e) => onChange(e.target.value)}
          autoFocus={true}
        />
      )}

      {fieldType.type === 'select' && (
        <div className="space-y-1">
          {(fieldType as { type: 'select'; options: ElicitationOption[] }).options.map((opt) => (
            <label
              key={opt.value}
              className={`flex items-center gap-2 px-2 py-1.5 rounded border cursor-pointer text-sm ${
                value === opt.value
                  ? 'border-[var(--vscode-focusBorder)] bg-[var(--vscode-list-activeSelectionBackground)] text-[var(--vscode-editor-foreground)]'
                  : 'border-[var(--vscode-input-border)] bg-transparent text-[var(--vscode-descriptionForeground)] hover:border-[var(--vscode-editor-foreground)]'
              }`}
            >
              <input
                type="radio"
                name={field.name}
                value={opt.value}
                checked={value === opt.value}
                onChange={() => onChange(opt.value)}
                className="sr-only"
              />
              <div
                className={`w-3.5 h-3.5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                  value === opt.value ? 'border-[var(--vscode-focusBorder)]' : 'border-[var(--vscode-input-border)]'
                }`}
              >
                {value === opt.value && (
                  <div className="w-1.5 h-1.5 rounded-full bg-[var(--vscode-focusBorder)]" />
                )}
              </div>
              <div>
                <div>{opt.label}</div>
                {opt.description && (
                  <div className="text-xs text-[var(--vscode-descriptionForeground)]">{opt.description}</div>
                )}
              </div>
            </label>
          ))}
        </div>
      )}

      {fieldType.type === 'multiselect' && (
        <div className="space-y-1">
          {(fieldType as { type: 'multiselect'; options: ElicitationOption[] }).options.map((opt) => {
            const selected = Array.isArray(value) && (value as string[]).includes(opt.value);
            return (
              <label
                key={opt.value}
                className={`flex items-center gap-2 px-2 py-1.5 rounded border cursor-pointer text-sm ${
                  selected
                    ? 'border-[var(--vscode-focusBorder)] bg-[var(--vscode-list-activeSelectionBackground)] text-[var(--vscode-editor-foreground)]'
                    : 'border-[var(--vscode-input-border)] bg-transparent text-[var(--vscode-descriptionForeground)] hover:border-[var(--vscode-editor-foreground)]'
                }`}
              >
                <input
                  type="checkbox"
                  checked={selected}
                  onChange={() => {
                    const arr = Array.isArray(value) ? [...(value as string[])] : [];
                    if (selected) {
                      onChange(arr.filter((v) => v !== opt.value));
                    } else {
                      onChange([...arr, opt.value]);
                    }
                  }}
                  className="sr-only"
                />
                <div
                  className={`w-3.5 h-3.5 rounded border-2 flex items-center justify-center flex-shrink-0 ${
                    selected ? 'border-[var(--vscode-focusBorder)] bg-[var(--vscode-focusBorder)]' : 'border-[var(--vscode-input-border)]'
                  }`}
                >
                  {selected && (
                    <svg className="w-2.5 h-2.5 text-white" fill="currentColor" viewBox="0 0 12 12">
                      <path d="M10 3L4.5 8.5 2 6" stroke="currentColor" strokeWidth="2" fill="none" />
                    </svg>
                  )}
                </div>
                <div>
                  <div>{opt.label}</div>
                  {opt.description && (
                    <div className="text-xs text-[var(--vscode-descriptionForeground)]">{opt.description}</div>
                  )}
                </div>
              </label>
            );
          })}
        </div>
      )}

      {fieldType.type === 'confirm' && (
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={!!value}
            onChange={(e) => onChange(e.target.checked)}
            className="w-4 h-4 rounded border-[var(--vscode-input-border)] accent-[var(--vscode-focusBorder)]"
          />
          <span className="text-sm text-[var(--vscode-descriptionForeground)]">Yes</span>
        </label>
      )}
    </div>
  );
};
