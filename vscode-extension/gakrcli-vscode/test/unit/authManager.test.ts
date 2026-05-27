import { describe, it, expect, vi } from 'vitest';
import { AuthManager } from '../../src/auth/authManager';
import type { SettingsSync } from '../../src/settings/settingsSync';

function makeSettings(overrides: Partial<SettingsSync> = {}): SettingsSync {
  return {
    selectedProvider: 'anthropic',
    selectedModel: undefined,
    apiKey: undefined,
    baseUrl: undefined,
    environmentVariables: [],
    setProvider: vi.fn().mockResolvedValue(undefined),
    setModel: vi.fn().mockResolvedValue(undefined),
    setApiKey: vi.fn().mockResolvedValue(undefined),
    setBaseUrl: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  } as unknown as SettingsSync;
}

describe('AuthManager', () => {
  describe('getAvailableProviders', () => {
    it('returns the root GakrCLI provider presets used by the picker', () => {
      const manager = new AuthManager(makeSettings());
      const ids = manager.getAvailableProviders().map((p) => p.id);

      for (const id of [
        'anthropic',
        'dashscope-cn',
        'dashscope-intl',
        'azure-openai',
        'bankr',
        'deepseek',
        'gemini',
        'groq',
        'hicap',
        'lmstudio',
        'atomic-chat',
        'ollama',
        'minimax',
        'mistral',
        'moonshotai',
        'kimi-code',
        'nvidia-nim',
        'openai',
        'openrouter',
        'together',
        'venice',
        'xai',
        'xiaomi-mimo',
        'zai',
        'custom',
        'bedrock',
        'vertex',
        'github',
        'codex',
      ]) {
        expect(ids).toContain(id);
      }
    });
  });

  describe('buildProcessEnv - anthropic', () => {
    it('sets ANTHROPIC_API_KEY', () => {
      const manager = new AuthManager(makeSettings({ selectedProvider: 'anthropic', apiKey: 'sk-ant-test' }));
      const env = manager.buildProcessEnv();
      expect(env['ANTHROPIC_API_KEY']).toBe('sk-ant-test');
      expect(env['GAKR_CODE_USE_OPENAI']).toBeUndefined();
    });
  });

  describe('buildProcessEnv - openai', () => {
    it('sets OPENAI_API_KEY and GAKR_CODE_USE_OPENAI', () => {
      const manager = new AuthManager(makeSettings({ selectedProvider: 'openai', apiKey: 'sk-openai-test' }));
      const env = manager.buildProcessEnv();
      expect(env['OPENAI_API_KEY']).toBe('sk-openai-test');
      expect(env['GAKR_CODE_USE_OPENAI']).toBe('1');
    });

    it('sets OPENAI_BASE_URL when provided', () => {
      const manager = new AuthManager(makeSettings({
        selectedProvider: 'openai',
        apiKey: 'sk-openai-test',
        baseUrl: 'https://api.openai.com/v1',
      }));
      const env = manager.buildProcessEnv();
      expect(env['OPENAI_BASE_URL']).toBe('https://api.openai.com/v1');
    });
  });

  describe('buildProcessEnv - local OpenAI-compatible providers', () => {
    it('uses Ollama defaults', () => {
      const manager = new AuthManager(makeSettings({ selectedProvider: 'ollama' }));
      const env = manager.buildProcessEnv();
      expect(env['OPENAI_BASE_URL']).toBe('http://localhost:11434/v1');
      expect(env['OPENAI_API_KEY']).toBe('ollama');
      expect(env['GAKR_CODE_USE_OPENAI']).toBe('1');
    });

    it('allows custom Ollama base URL override', () => {
      const manager = new AuthManager(makeSettings({ selectedProvider: 'ollama', baseUrl: 'http://myhost:11434/v1' }));
      const env = manager.buildProcessEnv();
      expect(env['OPENAI_BASE_URL']).toBe('http://myhost:11434/v1');
    });
  });

  describe('buildProcessEnv - dedicated providers', () => {
    it('sets Gemini env and GAKR_CODE_USE_GEMINI', () => {
      const manager = new AuthManager(makeSettings({
        selectedProvider: 'gemini',
        apiKey: 'gemini-key',
        baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai',
      }));
      const env = manager.buildProcessEnv();
      expect(env['GEMINI_API_KEY']).toBe('gemini-key');
      expect(env['GEMINI_BASE_URL']).toBe('https://generativelanguage.googleapis.com/v1beta/openai');
      expect(env['GAKR_CODE_USE_GEMINI']).toBe('1');
    });

    it('sets dedicated Mistral routing instead of generic OpenAI routing', () => {
      const manager = new AuthManager(makeSettings({
        selectedProvider: 'mistral',
        apiKey: 'mistral-key',
      }));
      const env = manager.buildProcessEnv();
      expect(env['GAKR_CODE_USE_MISTRAL']).toBe('1');
      expect(env['MISTRAL_API_KEY']).toBe('mistral-key');
      expect(env['MISTRAL_BASE_URL']).toBe('https://api.mistral.ai/v1');
      expect(env['GAKR_CODE_USE_OPENAI']).toBeUndefined();
    });
  });

  describe('buildProcessEnv - descriptor-backed OpenAI-compatible presets', () => {
    it('sets custom OpenAI-compatible routing', () => {
      const manager = new AuthManager(makeSettings({
        selectedProvider: 'custom',
        apiKey: 'custom-key',
        baseUrl: 'https://my-llm.example.com/v1',
      }));
      const env = manager.buildProcessEnv();
      expect(env['OPENAI_API_KEY']).toBe('custom-key');
      expect(env['OPENAI_BASE_URL']).toBe('https://my-llm.example.com/v1');
      expect(env['GAKR_CODE_USE_OPENAI']).toBe('1');
    });

    it('sets xAI route env without inventing a model so OAuth fallback can work', () => {
      const manager = new AuthManager(makeSettings({ selectedProvider: 'xai' }));
      const env = manager.buildProcessEnv();
      expect(env['GAKR_CODE_USE_OPENAI']).toBe('1');
      expect(env['OPENAI_BASE_URL']).toBe('https://api.x.ai/v1');
      expect(env['OPENAI_MODEL']).toBeUndefined();
      expect(env['OPENAI_API_KEY']).toBeUndefined();
    });

    it('mirrors provider credentials for providers whose runtime expects OPENAI_API_KEY', () => {
      const manager = new AuthManager(makeSettings({
        selectedProvider: 'xiaomi-mimo',
        apiKey: 'mimo-key',
      }));
      const env = manager.buildProcessEnv();
      expect(env['MIMO_API_KEY']).toBe('mimo-key');
      expect(env['OPENAI_API_KEY']).toBe('mimo-key');
      expect(env['OPENAI_BASE_URL']).toBe('https://api.xiaomimimo.com/v1');
      expect(env['OPENAI_MODEL']).toBeUndefined();
    });

    it('sets NVIDIA NIM marker and route defaults', () => {
      const manager = new AuthManager(makeSettings({
        selectedProvider: 'nvidia-nim',
        apiKey: 'nvidia-key',
      }));
      const env = manager.buildProcessEnv();
      expect(env['GAKR_CODE_USE_OPENAI']).toBe('1');
      expect(env['NVIDIA_NIM']).toBe('1');
      expect(env['NVIDIA_API_KEY']).toBe('nvidia-key');
      expect(env['OPENAI_API_KEY']).toBe('nvidia-key');
      expect(env['OPENAI_BASE_URL']).toBe('https://integrate.api.nvidia.com/v1');
    });
  });

  describe('buildProcessEnv - merges user env vars', () => {
    it('includes user-configured environment variables', () => {
      const manager = new AuthManager(makeSettings({
        selectedProvider: 'anthropic',
        apiKey: 'sk-ant-test',
        environmentVariables: [{ name: 'MY_VAR', value: 'hello' }],
      }));
      const env = manager.buildProcessEnv();
      expect(env['MY_VAR']).toBe('hello');
      expect(env['ANTHROPIC_API_KEY']).toBe('sk-ant-test');
    });
  });

  describe('validate', () => {
    it('passes for anthropic with api key', () => {
      const manager = new AuthManager(makeSettings());
      const result = manager.validate({ providerId: 'anthropic', apiKey: 'sk-ant-test' });
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('fails for anthropic without api key', () => {
      const manager = new AuthManager(makeSettings());
      const result = manager.validate({ providerId: 'anthropic', apiKey: '' });
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('passes for providers that can use local or stored OAuth credentials', () => {
      const manager = new AuthManager(makeSettings());
      expect(manager.validate({ providerId: 'ollama' }).valid).toBe(true);
      expect(manager.validate({ providerId: 'xai' }).valid).toBe(true);
      expect(manager.validate({ providerId: 'github' }).valid).toBe(true);
      expect(manager.validate({ providerId: 'codex' }).valid).toBe(true);
    });

    it('fails for custom without base URL', () => {
      const manager = new AuthManager(makeSettings());
      const result = manager.validate({ providerId: 'custom', apiKey: 'key', baseUrl: '' });
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => /base url/i.test(e))).toBe(true);
    });

    it('fails for unknown provider', () => {
      const manager = new AuthManager(makeSettings());
      const result = manager.validate({ providerId: 'unknown-provider' });
      expect(result.valid).toBe(false);
    });
  });

  describe('buildProcessEnv - saved GakrCLI profile fallback', () => {
    it('loads profile env when extension provider settings are not explicit', () => {
      const manager = new AuthManager(
        makeSettings(),
        () => ({
          path: 'C:\\Users\\test\\.gakrcli\\.gakrcli-profile.json',
          profile: {
            profile: 'xai',
            env: {
              OPENAI_BASE_URL: 'https://api.x.ai/v1',
              OPENAI_MODEL: 'grok-4.3',
              XAI_CREDENTIAL_SOURCE: 'oauth',
            },
          },
        }),
      );

      const env = manager.buildProcessEnv();
      expect(env['OPENAI_BASE_URL']).toBe('https://api.x.ai/v1');
      expect(env['OPENAI_MODEL']).toBe('grok-4.3');
      expect(env['XAI_CREDENTIAL_SOURCE']).toBe('oauth');
      expect(env['GAKR_CODE_USE_OPENAI']).toBe('1');
    });
  });

  describe('updateProvider', () => {
    it('calls settings setters with provided values', async () => {
      const settings = makeSettings();
      const manager = new AuthManager(settings);
      await manager.updateProvider({ providerId: 'openai', apiKey: 'sk-new', model: 'gpt-4o' });
      expect(settings.setProvider).toHaveBeenCalledWith('openai');
      expect(settings.setApiKey).toHaveBeenCalledWith('sk-new');
      expect(settings.setModel).toHaveBeenCalledWith('gpt-4o');
    });
  });
});
