// webview/src/components/input/ProviderBadge.tsx
// Shows current provider + model. Clicking opens the ProviderPicker dialog.
// GakrCLI-specific provider badge for the active CLI route.

import { useState, useEffect } from 'react';
import { vscode } from '../../vscode';
import { ProviderPicker } from '../dialogs/ProviderPicker';

// All providers GakrCLI supports (from gakrcli/src/utils/model/providers.ts)
const BUILTIN_PROVIDERS = [
  { id: 'anthropic', label: 'Anthropic', requiresApiKey: true, requiresBaseUrl: false, supportsModel: true },
  { id: 'dashscope-cn', label: 'Alibaba Coding Plan (China)', requiresApiKey: true, requiresBaseUrl: false, supportsModel: true, defaultBaseUrl: 'https://coding.dashscope.aliyuncs.com/v1' },
  { id: 'dashscope-intl', label: 'Alibaba Coding Plan', requiresApiKey: true, requiresBaseUrl: false, supportsModel: true, defaultBaseUrl: 'https://coding-intl.dashscope.aliyuncs.com/v1' },
  { id: 'azure-openai', label: 'Azure OpenAI', requiresApiKey: true, requiresBaseUrl: true, supportsModel: true, defaultBaseUrl: 'https://YOUR-RESOURCE-NAME.openai.azure.com/openai/v1' },
  { id: 'bankr', label: 'Bankr', requiresApiKey: true, requiresBaseUrl: false, supportsModel: true, defaultBaseUrl: 'https://llm.bankr.bot/v1' },
  { id: 'deepseek', label: 'DeepSeek', requiresApiKey: true, requiresBaseUrl: false, supportsModel: true, defaultBaseUrl: 'https://api.deepseek.com/v1' },
  { id: 'gemini', label: 'Google Gemini', requiresApiKey: true, requiresBaseUrl: false, supportsModel: true },
  { id: 'groq', label: 'Groq', requiresApiKey: true, requiresBaseUrl: false, supportsModel: true, defaultBaseUrl: 'https://api.groq.com/openai/v1' },
  { id: 'hicap', label: 'Hicap', requiresApiKey: true, requiresBaseUrl: false, supportsModel: true, defaultBaseUrl: 'https://api.hicap.ai/v1' },
  { id: 'lmstudio', label: 'LM Studio', requiresApiKey: false, requiresBaseUrl: false, supportsModel: true, defaultBaseUrl: 'http://localhost:1234/v1' },
  { id: 'atomic-chat', label: 'Atomic Chat', requiresApiKey: false, requiresBaseUrl: false, supportsModel: true, defaultBaseUrl: 'http://127.0.0.1:1337/v1' },
  { id: 'ollama', label: 'Ollama (Local)', requiresApiKey: false, requiresBaseUrl: false, supportsModel: true, defaultBaseUrl: 'http://localhost:11434/v1' },
  { id: 'minimax', label: 'MiniMax', requiresApiKey: true, requiresBaseUrl: false, supportsModel: true, defaultBaseUrl: 'https://api.minimax.io/v1' },
  { id: 'mistral', label: 'Mistral AI', requiresApiKey: true, requiresBaseUrl: false, supportsModel: true, defaultBaseUrl: 'https://api.mistral.ai/v1' },
  { id: 'moonshotai', label: 'Moonshot AI - API', requiresApiKey: true, requiresBaseUrl: false, supportsModel: true, defaultBaseUrl: 'https://api.moonshot.ai/v1' },
  { id: 'kimi-code', label: 'Moonshot AI - Kimi Code', requiresApiKey: true, requiresBaseUrl: false, supportsModel: true, defaultBaseUrl: 'https://api.kimi.com/coding/v1' },
  { id: 'nvidia-nim', label: 'NVIDIA NIM', requiresApiKey: true, requiresBaseUrl: false, supportsModel: true, defaultBaseUrl: 'https://integrate.api.nvidia.com/v1' },
  { id: 'openai', label: 'OpenAI', requiresApiKey: true, requiresBaseUrl: false, supportsModel: true, defaultBaseUrl: 'https://api.openai.com/v1' },
  { id: 'openrouter', label: 'OpenRouter', requiresApiKey: true, requiresBaseUrl: false, supportsModel: true, defaultBaseUrl: 'https://openrouter.ai/api/v1' },
  { id: 'together', label: 'Together AI', requiresApiKey: true, requiresBaseUrl: false, supportsModel: true, defaultBaseUrl: 'https://api.together.xyz/v1' },
  { id: 'venice', label: 'Venice', requiresApiKey: true, requiresBaseUrl: false, supportsModel: true, defaultBaseUrl: 'https://api.venice.ai/api/v1' },
  { id: 'xai', label: 'xAI', requiresApiKey: false, requiresBaseUrl: false, supportsModel: true, defaultBaseUrl: 'https://api.x.ai/v1' },
  { id: 'xiaomi-mimo', label: 'Xiaomi MiMo', requiresApiKey: true, requiresBaseUrl: false, supportsModel: true, defaultBaseUrl: 'https://api.xiaomimimo.com/v1' },
  { id: 'zai', label: 'Z.AI', requiresApiKey: true, requiresBaseUrl: false, supportsModel: true, defaultBaseUrl: 'https://api.z.ai/api/coding/paas/v4' },
  { id: 'custom', label: 'Custom OpenAI-compatible', requiresApiKey: false, requiresBaseUrl: true, supportsModel: true },
  { id: 'bedrock', label: 'AWS Bedrock', requiresApiKey: false, requiresBaseUrl: false, supportsModel: true },
  { id: 'vertex', label: 'Google Vertex AI', requiresApiKey: false, requiresBaseUrl: false, supportsModel: true },
  { id: 'github', label: 'GitHub Copilot', requiresApiKey: false, requiresBaseUrl: false, supportsModel: true, defaultBaseUrl: 'https://api.githubcopilot.com' },
  { id: 'codex', label: 'Codex (ChatGPT)', requiresApiKey: false, requiresBaseUrl: false, supportsModel: true, defaultBaseUrl: 'https://api.codex.openai.com/v1' },
];

export function ProviderBadge() {
  const [currentProviderId, setCurrentProviderId] = useState('anthropic');
  const [currentLabel, setCurrentLabel] = useState('Anthropic');
  const [currentModel, setCurrentModel] = useState<string | undefined>();
  const [currentBaseUrl, setCurrentBaseUrl] = useState<string | undefined>();
  const [isPickerOpen, setPickerOpen] = useState(false);
  const [providers, setProviders] = useState(BUILTIN_PROVIDERS);

  // Request provider state on mount
  useEffect(() => {
    vscode.postMessage({ type: 'get_provider_state' });
  }, []);

  // Listen for open_provider_picker message (e.g. from /provider command)
  useEffect(() => {
    const handler = (event: MessageEvent) => {
      if (event.data?.type === 'open_provider_picker') {
        setPickerOpen(true);
      }
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, []);

  // Listen for provider_state messages from extension host
  useEffect(() => {
    return vscode.onMessage('provider_state', (msg) => {
      const data = msg as unknown as {
        providers?: Array<{ id: string; label: string; requiresApiKey?: boolean; requiresBaseUrl?: boolean; supportsModel?: boolean; defaultBaseUrl?: string }>;
        currentProviderId: string;
        currentModel?: string;
        currentBaseUrl?: string;
      };
      setCurrentProviderId(data.currentProviderId ?? 'anthropic');
      setCurrentModel(data.currentModel);
      setCurrentBaseUrl(data.currentBaseUrl);
      if (data.providers && data.providers.length > 0) {
        setProviders(data.providers.map(p => ({
          ...p,
          requiresApiKey: p.requiresApiKey ?? true,
          requiresBaseUrl: p.requiresBaseUrl ?? false,
          supportsModel: p.supportsModel ?? true,
        })));
      }
      const providerDef = (data.providers ?? BUILTIN_PROVIDERS).find((p) => p.id === data.currentProviderId);
      setCurrentLabel(providerDef?.label ?? data.currentProviderId ?? 'Anthropic');
    });
  }, []);

  // Re-request state after picker closes (to refresh)
  const handlePickerClose = () => {
    setPickerOpen(false);
    vscode.postMessage({ type: 'get_provider_state' });
  };

  const modelLabel = currentModel ? ` · ${currentModel}` : '';

  return (
    <>
      <button
        onClick={() => setPickerOpen(true)}
        title="Change provider"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 4,
          padding: '2px 6px',
          fontSize: 11,
          background: 'transparent',
          border: '1px solid var(--app-input-border)',
          borderRadius: 'var(--corner-radius-small)',
          color: 'var(--app-secondary-foreground)',
          cursor: 'pointer',
          whiteSpace: 'nowrap',
          minWidth: 0,
          maxWidth: 260,
        }}
      >
        <ProviderIcon providerId={currentProviderId} />
        <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' }}>{currentLabel}{modelLabel}</span>
        <svg width="8" height="8" viewBox="0 0 8 8" fill="currentColor" style={{ opacity: 0.6 }}>
          <path d="M1 2.5l3 3 3-3" stroke="currentColor" strokeWidth="1.2" fill="none" strokeLinecap="round" />
        </svg>
      </button>

      {isPickerOpen && (
        <ProviderPicker
          providers={providers}
          currentProviderId={currentProviderId}
          currentModel={currentModel}
          currentBaseUrl={currentBaseUrl}
          onClose={handlePickerClose}
        />
      )}
    </>
  );
}

function ProviderIcon({ providerId }: { providerId: string }) {
  const icons: Record<string, string> = {
    anthropic: '◆',
    openai: '⬡',
    ollama: '🦙',
    gemini: '✦',
    codex: '⬡',
    bedrock: '☁',
    vertex: '▲',
    github: '⬢',
    custom: '⚙',
  };
  return <span style={{ fontSize: 10 }}>{icons[providerId] ?? '◆'}</span>;
}
