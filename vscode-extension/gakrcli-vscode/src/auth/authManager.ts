// src/auth/authManager.ts
// Provider definitions and env-var assembly for supported LLM backends.

import type { SettingsSync } from '../settings/settingsSync';
import {
  applyCompatibilityFlag,
  loadProfileFile,
  type GakrCliProfileFile,
} from '../settings/profileFile';

// ============================================================================
// Types
// ============================================================================

export interface ProviderDefinition {
  id: string;
  label: string;
  requiresApiKey: boolean;
  requiresBaseUrl: boolean;
  supportsModel: boolean;
  defaultBaseUrl?: string;
}

export interface ProviderConfig {
  id: string;
  label: string;
  env: Record<string, string>;
  model?: string;
}

export interface ProviderUpdateInput {
  providerId: string;
  apiKey?: string;
  baseUrl?: string;
  model?: string;
}

export interface ProviderValidationResult {
  valid: boolean;
  errors: string[];
}

// ============================================================================
// Provider definitions
// ============================================================================

const PROVIDER_DEFINITIONS: ProviderDefinition[] = [
  {
    id: 'anthropic',
    label: 'Anthropic (Claude)',
    requiresApiKey: true,
    requiresBaseUrl: false,
    supportsModel: true,
  },
  {
    id: 'openai',
    label: 'OpenAI',
    requiresApiKey: true,
    requiresBaseUrl: false,
    supportsModel: true,
  },
  {
    id: 'ollama',
    label: 'Ollama (local)',
    requiresApiKey: false,
    requiresBaseUrl: false,
    supportsModel: true,
    defaultBaseUrl: 'http://localhost:11434/v1',
  },
  {
    id: 'gemini',
    label: 'Google Gemini',
    requiresApiKey: true,
    requiresBaseUrl: true,
    supportsModel: true,
  },
  {
    id: 'codex',
    label: 'Codex (ChatGPT)',
    requiresApiKey: true,
    requiresBaseUrl: false,
    supportsModel: true,
    defaultBaseUrl: 'https://api.codex.openai.com/v1',
  },
  {
    id: 'bedrock',
    label: 'AWS Bedrock',
    requiresApiKey: false,
    requiresBaseUrl: false,
    supportsModel: true,
  },
  {
    id: 'vertex',
    label: 'Google Vertex AI',
    requiresApiKey: false,
    requiresBaseUrl: false,
    supportsModel: true,
  },
  {
    id: 'github',
    label: 'GitHub Models',
    requiresApiKey: true,
    requiresBaseUrl: false,
    supportsModel: true,
  },
  {
    id: 'custom',
    label: 'Custom (OpenAI-compatible)',
    requiresApiKey: true,
    requiresBaseUrl: true,
    supportsModel: true,
  },
];

// ============================================================================
// AuthManager
// ============================================================================

export class AuthManager {
  constructor(
    private readonly settings: SettingsSync,
    private readonly profileLoader: typeof loadProfileFile = loadProfileFile,
  ) {}

  getAvailableProviders(): ProviderDefinition[] {
    return PROVIDER_DEFINITIONS;
  }

  getCurrentProvider(): ProviderConfig {
    const profile = this.getProfileFallback();
    if (profile) {
      return {
        id: profile.profile.profile,
        label: labelForProfile(profile.profile.profile),
        env: applyCompatibilityFlag(profile.profile.profile, profile.profile.env),
        model: profile.profile.env.OPENAI_MODEL ??
          profile.profile.env.ANTHROPIC_MODEL ??
          profile.profile.env.GEMINI_MODEL ??
          profile.profile.env.MISTRAL_MODEL,
      };
    }

    const providerId = this.settings.selectedProvider;
    const def = PROVIDER_DEFINITIONS.find((p) => p.id === providerId) ?? PROVIDER_DEFINITIONS[0];
    const apiKey = this.settings.apiKey;
    const baseUrl = this.settings.baseUrl;
    const model = this.settings.selectedModel;

    return {
      id: def.id,
      label: def.label,
      env: this._buildEnvForProvider(def, apiKey, baseUrl),
      model,
    };
  }

  /**
   * Build the env vars to inject into ProcessManager for the current provider.
   */
  buildProcessEnv(): Record<string, string> {
    // Start with user-configured env vars
    const env: Record<string, string> = {};
    for (const { name, value } of this.settings.environmentVariables) {
      env[name] = value;
    }

    const profile = this.getProfileFallback();
    if (profile) {
      Object.assign(env, applyCompatibilityFlag(profile.profile.profile, profile.profile.env));
      return env;
    }

    const providerId = this.settings.selectedProvider;
    const def = PROVIDER_DEFINITIONS.find((p) => p.id === providerId) ?? PROVIDER_DEFINITIONS[0];
    const apiKey = this.settings.apiKey;
    const baseUrl = this.settings.baseUrl;

    // Merge provider-specific env vars (provider takes precedence for its own keys)
    const providerEnv = this._buildEnvForProvider(def, apiKey, baseUrl);
    Object.assign(env, providerEnv);

    return env;
  }

  async updateProvider(input: ProviderUpdateInput): Promise<void> {
    await this.settings.setProvider(input.providerId);
    if (input.apiKey !== undefined) {
      await this.settings.setApiKey(input.apiKey);
    }
    if (input.baseUrl !== undefined) {
      await this.settings.setBaseUrl(input.baseUrl);
    }
    if (input.model !== undefined) {
      await this.settings.setModel(input.model);
    }
  }

  validate(input: ProviderUpdateInput): ProviderValidationResult {
    const def = PROVIDER_DEFINITIONS.find((p) => p.id === input.providerId);
    if (!def) {
      return { valid: false, errors: [`Unknown provider: ${input.providerId}`] };
    }

    const errors: string[] = [];

    if (def.requiresApiKey && !input.apiKey?.trim()) {
      errors.push(`${def.label} requires an API key`);
    }

    if (def.requiresBaseUrl && !input.baseUrl?.trim()) {
      errors.push(`${def.label} requires a base URL`);
    }

    return { valid: errors.length === 0, errors };
  }

  // --------------------------------------------------------------------------
  // Private
  // --------------------------------------------------------------------------

  private _buildEnvForProvider(
    def: ProviderDefinition,
    apiKey: string | undefined,
    baseUrl: string | undefined,
  ): Record<string, string> {
    const env: Record<string, string> = {};

    switch (def.id) {
      case 'anthropic':
        if (apiKey) env['ANTHROPIC_API_KEY'] = apiKey;
        break;

      case 'openai':
        if (apiKey) env['OPENAI_API_KEY'] = apiKey;
        if (baseUrl) env['OPENAI_BASE_URL'] = baseUrl;
        env['GAKR_CODE_USE_OPENAI'] = '1';
        break;

      case 'ollama':
        env['OPENAI_BASE_URL'] = baseUrl || def.defaultBaseUrl!;
        env['OPENAI_API_KEY'] = 'ollama';
        env['GAKR_CODE_USE_OPENAI'] = '1';
        break;

      case 'gemini':
        if (apiKey) env['GEMINI_API_KEY'] = apiKey;
        if (baseUrl) env['GEMINI_BASE_URL'] = baseUrl;
        env['GAKR_CODE_USE_GEMINI'] = '1';
        break;

      case 'codex':
        if (apiKey) env['CODEX_API_KEY'] = apiKey;
        if (baseUrl) env['OPENAI_BASE_URL'] = baseUrl;
        else if (def.defaultBaseUrl) env['OPENAI_BASE_URL'] = def.defaultBaseUrl;
        env['GAKR_CODE_USE_OPENAI'] = '1';
        break;

      case 'custom':
        if (apiKey) env['OPENAI_API_KEY'] = apiKey;
        if (baseUrl) env['OPENAI_BASE_URL'] = baseUrl;
        env['GAKR_CODE_USE_OPENAI'] = '1';
        break;
    }

    return env;
  }

  private getProfileFallback(): { profile: GakrCliProfileFile; path: string } | null {
    if (this.hasExplicitExtensionProvider()) {
      return null;
    }

    return this.profileLoader();
  }

  private hasExplicitExtensionProvider(): boolean {
    const settings = this.settings as SettingsSync & {
      hasConfiguredProvider?: () => boolean;
    };
    const explicitProvider =
      typeof settings.hasConfiguredProvider === 'function'
        ? settings.hasConfiguredProvider()
        : this.settings.selectedProvider !== 'anthropic';

    return Boolean(
      explicitProvider ||
      this.settings.apiKey ||
      this.settings.baseUrl,
    );
  }
}

function labelForProfile(profile: string): string {
  const labels: Record<string, string> = {
    anthropic: 'Anthropic',
    openai: 'OpenAI',
    ollama: 'Ollama',
    gemini: 'Google Gemini',
    mistral: 'Mistral',
    github: 'GitHub Models',
    bedrock: 'AWS Bedrock',
    vertex: 'Google Vertex AI',
    foundry: 'Foundry',
    codex: 'Codex (ChatGPT)',
    'nvidia-nim': 'NVIDIA NIM',
    minimax: 'MiniMax',
    xai: 'xAI',
    venice: 'Venice',
    'xiaomi-mimo': 'Xiaomi MiMo',
    zai: 'Z.AI',
    moonshotai: 'Moonshot AI',
    'kimi-code': 'Moonshot AI - Kimi Code',
    deepseek: 'DeepSeek',
    openrouter: 'OpenRouter',
    'atomic-chat': 'Atomic Chat',
  };
  return labels[profile] ?? profile;
}
