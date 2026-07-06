// src/auth/authManager.ts
// Provider definitions and env-var assembly for supported LLM backends.
// Aligned with gakrcli CLI provider presets from the root project.

import type { SettingsSync } from '../settings/settingsSync';

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
// Sourced from gakrcli CLI's PREFERRED_PROVIDER_ORDER + VALID_PROVIDERS

const PROVIDER_DEFINITIONS: ProviderDefinition[] = [
  // --- First-party / native transport ---
  {
    id: 'anthropic',
    label: 'Anthropic (Claude)',
    requiresApiKey: true,
    requiresBaseUrl: false,
    supportsModel: true,
  },
  // --- OpenAI-compatible (native) ---
  {
    id: 'openai',
    label: 'OpenAI',
    requiresApiKey: true,
    requiresBaseUrl: false,
    supportsModel: true,
  },
  // --- Other native transports ---
  {
    id: 'gemini',
    label: 'Google Gemini',
    requiresApiKey: true,
    requiresBaseUrl: true,
    supportsModel: true,
  },
  {
    id: 'mistral',
    label: 'Mistral AI',
    requiresApiKey: true,
    requiresBaseUrl: false,
    supportsModel: true,
  },
  // --- Cloud service providers ---
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
  // --- OpenAI-compatible gateways / proxies ---
  {
    id: 'xai',
    label: 'xAI (Grok)',
    requiresApiKey: true,
    requiresBaseUrl: false,
    supportsModel: true,
  },
  {
    id: 'xiaomi-mimo',
    label: 'Xiaomi MiMo',
    requiresApiKey: true,
    requiresBaseUrl: false,
    supportsModel: true,
  },
  {
    id: 'bankr',
    label: 'Bankr',
    requiresApiKey: true,
    requiresBaseUrl: false,
    supportsModel: true,
  },
  {
    id: 'zai',
    label: 'Z.AI',
    requiresApiKey: true,
    requiresBaseUrl: false,
    supportsModel: true,
  },
  {
    id: 'deepseek',
    label: 'DeepSeek',
    requiresApiKey: true,
    requiresBaseUrl: false,
    supportsModel: true,
  },
  {
    id: 'groq',
    label: 'Groq',
    requiresApiKey: true,
    requiresBaseUrl: false,
    supportsModel: true,
  },
  {
    id: 'openrouter',
    label: 'OpenRouter',
    requiresApiKey: true,
    requiresBaseUrl: false,
    supportsModel: true,
  },
  {
    id: 'together',
    label: 'Together AI',
    requiresApiKey: true,
    requiresBaseUrl: false,
    supportsModel: true,
  },
  {
    id: 'fireworks',
    label: 'Fireworks AI',
    requiresApiKey: true,
    requiresBaseUrl: false,
    supportsModel: true,
  },
  {
    id: 'nvidia-nim',
    label: 'NVIDIA NIM',
    requiresApiKey: true,
    requiresBaseUrl: false,
    supportsModel: true,
  },
  {
    id: 'venice',
    label: 'Venice',
    requiresApiKey: true,
    requiresBaseUrl: false,
    supportsModel: true,
  },
  {
    id: 'atlas-cloud',
    label: 'Atlas Cloud',
    requiresApiKey: true,
    requiresBaseUrl: false,
    supportsModel: true,
  },
  {
    id: 'nearai',
    label: 'NEAR AI',
    requiresApiKey: true,
    requiresBaseUrl: false,
    supportsModel: true,
  },
  {
    id: 'minimax',
    label: 'MiniMax',
    requiresApiKey: true,
    requiresBaseUrl: false,
    supportsModel: true,
  },
  {
    id: 'moonshotai',
    label: 'Moonshot AI',
    requiresApiKey: true,
    requiresBaseUrl: false,
    supportsModel: true,
  },
  {
    id: 'kimi-code',
    label: 'Kimi Code',
    requiresApiKey: true,
    requiresBaseUrl: false,
    supportsModel: true,
  },
  {
    id: 'dashscope-cn',
    label: 'DashScope (China)',
    requiresApiKey: true,
    requiresBaseUrl: false,
    supportsModel: true,
  },
  {
    id: 'dashscope-intl',
    label: 'DashScope (International)',
    requiresApiKey: true,
    requiresBaseUrl: false,
    supportsModel: true,
  },
  {
    id: 'azure-openai',
    label: 'Azure OpenAI',
    requiresApiKey: true,
    requiresBaseUrl: true,
    supportsModel: true,
  },
  {
    id: 'opencode-go',
    label: 'OpenCode Go',
    requiresApiKey: true,
    requiresBaseUrl: false,
    supportsModel: true,
  },
  {
    id: 'opencode',
    label: 'OpenCode',
    requiresApiKey: true,
    requiresBaseUrl: false,
    supportsModel: true,
  },
  {
    id: 'hicap',
    label: 'Hicap',
    requiresApiKey: true,
    requiresBaseUrl: false,
    supportsModel: true,
  },
  {
    id: 'atomic-chat',
    label: 'Atomic Chat',
    requiresApiKey: true,
    requiresBaseUrl: false,
    supportsModel: true,
  },
  // --- Local ---
  {
    id: 'ollama',
    label: 'Ollama (local)',
    requiresApiKey: false,
    requiresBaseUrl: false,
    supportsModel: true,
    defaultBaseUrl: 'http://localhost:11434/v1',
  },
  {
    id: 'lmstudio',
    label: 'LM Studio',
    requiresApiKey: false,
    requiresBaseUrl: false,
    supportsModel: true,
  },
  // --- Legacy aliases ---
  {
    id: 'codex',
    label: 'Codex (ChatGPT)',
    requiresApiKey: true,
    requiresBaseUrl: false,
    supportsModel: true,
    defaultBaseUrl: 'https://api.codex.openai.com/v1',
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
  private readonly settings: SettingsSync;

  constructor(settings: SettingsSync) {
    this.settings = settings;
  }

  getAvailableProviders(): ProviderDefinition[] {
    return PROVIDER_DEFINITIONS;
  }

  getCurrentProvider(): ProviderConfig {
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
    const providerId = this.settings.selectedProvider;
    const def = PROVIDER_DEFINITIONS.find((p) => p.id === providerId) ?? PROVIDER_DEFINITIONS[0];
    const apiKey = this.settings.apiKey;
    const baseUrl = this.settings.baseUrl;

    // Start with user-configured env vars
    const env: Record<string, string> = {};
    for (const { name, value } of this.settings.environmentVariables) {
      env[name] = value;
    }

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

  /**
   * Build provider-specific env vars aligned with the gakrcli CLI conventions.
   *
   * When `--provider <id>` is passed to the CLI it handles internal routing;
   * these env vars provide the credentials and optional overrides.
   */
  private _buildEnvForProvider(
    def: ProviderDefinition,
    apiKey: string | undefined,
    baseUrl: string | undefined,
  ): Record<string, string> {
    const env: Record<string, string> = {};
    const id = def.id;

    switch (id) {
      // --- Anthropic native ---
      case 'anthropic':
        if (apiKey) env['ANTHROPIC_API_KEY'] = apiKey;
        break;

      // --- Gemini native ---
      case 'gemini':
        if (apiKey) env['GEMINI_API_KEY'] = apiKey;
        if (baseUrl) env['GEMINI_BASE_URL'] = baseUrl;
        env['GAKR_CODE_USE_GEMINI'] = '1';
        break;

      // --- Mistral native ---
      case 'mistral':
        if (apiKey) env['MISTRAL_API_KEY'] = apiKey;
        if (baseUrl) env['MISTRAL_BASE_URL'] = baseUrl;
        env['GAKR_CODE_USE_MISTRAL'] = '1';
        break;

      // --- Cloud service provider native ---
      case 'bedrock':
        env['GAKR_CODE_USE_BEDROCK'] = '1';
        break;

      case 'vertex':
        env['GAKR_CODE_USE_VERTEX'] = '1';
        break;

      case 'github':
        env['GAKR_CODE_USE_GITHUB'] = '1';
        break;

      // --- Local ---
      case 'ollama':
        env['OPENAI_BASE_URL'] = baseUrl || def.defaultBaseUrl!;
        env['OPENAI_API_KEY'] = 'ollama';
        env['GAKR_CODE_USE_OPENAI'] = '1';
        break;

      case 'lmstudio':
        env['OPENAI_BASE_URL'] = baseUrl || 'http://localhost:1234/v1';
        env['OPENAI_API_KEY'] = 'lm-studio';
        env['GAKR_CODE_USE_OPENAI'] = '1';
        break;

      // --- OpenAI-compatible (all use GAKR_CODE_USE_OPENAI=1) ---
      case 'openai':
      case 'xai':
      case 'xiaomi-mimo':
      case 'bankr':
      case 'zai':
      case 'deepseek':
      case 'groq':
      case 'openrouter':
      case 'together':
      case 'fireworks':
      case 'nvidia-nim':
      case 'venice':
      case 'atlas-cloud':
      case 'nearai':
      case 'minimax':
      case 'moonshotai':
      case 'kimi-code':
      case 'dashscope-cn':
      case 'dashscope-intl':
      case 'azure-openai':
      case 'opencode-go':
      case 'opencode':
      case 'hicap':
      case 'atomic-chat':
        if (apiKey) env['OPENAI_API_KEY'] = apiKey;
        if (baseUrl) env['OPENAI_BASE_URL'] = baseUrl;
        env['GAKR_CODE_USE_OPENAI'] = '1';
        break;

      // --- Legacy aliases ---
      case 'codex':
        if (apiKey) env['OPENAI_API_KEY'] = apiKey;
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
}
