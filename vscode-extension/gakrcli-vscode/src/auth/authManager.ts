// src/auth/authManager.ts
// Provider definitions and env-var assembly for supported LLM backends.

import type { SettingsSync } from '../settings/settingsSync';
import {
  applyCompatibilityFlag,
  loadProfileFile,
  type GakrCliProfileFile,
} from '../settings/profileFile';
import {
  buildEnvForProviderProfile,
  getPrimaryProviderModel,
  loadActiveProviderProfile,
  normalizeModelForProvider,
  updateActiveProviderProfileModel,
  type ActiveProviderProfileResult,
  type ProviderModelOption,
} from '../settings/providerProfiles';
import { discoverOpenAICompatibleModelOptions } from '../settings/providerModelDiscovery';

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
  defaultModel?: string;
  credentialEnvVar?: string;
  modelEnvVar?: string;
  mode?: 'anthropic' | 'openai-compatible' | 'gemini' | 'mistral' | 'github' | 'bedrock' | 'vertex' | 'codex';
  extraEnv?: Record<string, string>;
  mirrorApiKeyToOpenAI?: boolean;
  localApiKeyFallback?: string;
}

export interface ProviderConfig {
  id: string;
  label: string;
  env: Record<string, string>;
  model?: string;
  modelOptions?: ProviderModelOption[];
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
    credentialEnvVar: 'ANTHROPIC_API_KEY',
    modelEnvVar: 'ANTHROPIC_MODEL',
    mode: 'anthropic',
  },
  {
    id: 'dashscope-cn',
    label: 'Alibaba Coding Plan (China)',
    requiresApiKey: true,
    requiresBaseUrl: false,
    supportsModel: true,
    defaultBaseUrl: 'https://coding.dashscope.aliyuncs.com/v1',
    credentialEnvVar: 'DASHSCOPE_API_KEY',
    mode: 'openai-compatible',
  },
  {
    id: 'dashscope-intl',
    label: 'Alibaba Coding Plan',
    requiresApiKey: true,
    requiresBaseUrl: false,
    supportsModel: true,
    defaultBaseUrl: 'https://coding-intl.dashscope.aliyuncs.com/v1',
    credentialEnvVar: 'DASHSCOPE_API_KEY',
    mode: 'openai-compatible',
  },
  {
    id: 'azure-openai',
    label: 'Azure OpenAI',
    requiresApiKey: true,
    requiresBaseUrl: true,
    supportsModel: true,
    defaultBaseUrl: 'https://YOUR-RESOURCE-NAME.openai.azure.com/openai/v1',
    credentialEnvVar: 'AZURE_OPENAI_API_KEY',
    mode: 'openai-compatible',
  },
  {
    id: 'bankr',
    label: 'Bankr',
    requiresApiKey: true,
    requiresBaseUrl: false,
    supportsModel: true,
    defaultBaseUrl: 'https://llm.bankr.bot/v1',
    credentialEnvVar: 'BNKR_API_KEY',
    mode: 'openai-compatible',
    mirrorApiKeyToOpenAI: true,
  },
  {
    id: 'deepseek',
    label: 'DeepSeek',
    requiresApiKey: true,
    requiresBaseUrl: false,
    supportsModel: true,
    defaultBaseUrl: 'https://api.deepseek.com/v1',
    credentialEnvVar: 'DEEPSEEK_API_KEY',
    mode: 'openai-compatible',
  },
  {
    id: 'gemini',
    label: 'Google Gemini',
    requiresApiKey: true,
    requiresBaseUrl: false,
    supportsModel: true,
    credentialEnvVar: 'GEMINI_API_KEY',
    modelEnvVar: 'GEMINI_MODEL',
    mode: 'gemini',
  },
  {
    id: 'groq',
    label: 'Groq',
    requiresApiKey: true,
    requiresBaseUrl: false,
    supportsModel: true,
    defaultBaseUrl: 'https://api.groq.com/openai/v1',
    credentialEnvVar: 'GROQ_API_KEY',
    mode: 'openai-compatible',
  },
  {
    id: 'hicap',
    label: 'Hicap',
    requiresApiKey: true,
    requiresBaseUrl: false,
    supportsModel: true,
    defaultBaseUrl: 'https://api.hicap.ai/v1',
    credentialEnvVar: 'HICAP_API_KEY',
    mode: 'openai-compatible',
  },
  {
    id: 'lmstudio',
    label: 'LM Studio',
    requiresApiKey: false,
    requiresBaseUrl: false,
    supportsModel: true,
    defaultBaseUrl: 'http://localhost:1234/v1',
    mode: 'openai-compatible',
    localApiKeyFallback: 'lmstudio',
  },
  {
    id: 'atomic-chat',
    label: 'Atomic Chat',
    requiresApiKey: false,
    requiresBaseUrl: false,
    supportsModel: true,
    defaultBaseUrl: 'http://127.0.0.1:1337/v1',
    mode: 'openai-compatible',
    localApiKeyFallback: 'atomic-chat',
  },
  {
    id: 'ollama',
    label: 'Ollama (local)',
    requiresApiKey: false,
    requiresBaseUrl: false,
    supportsModel: true,
    defaultBaseUrl: 'http://localhost:11434/v1',
    mode: 'openai-compatible',
    localApiKeyFallback: 'ollama',
  },
  {
    id: 'minimax',
    label: 'MiniMax',
    requiresApiKey: true,
    requiresBaseUrl: false,
    supportsModel: true,
    defaultBaseUrl: 'https://api.minimax.io/v1',
    credentialEnvVar: 'MINIMAX_API_KEY',
    mode: 'openai-compatible',
    mirrorApiKeyToOpenAI: true,
  },
  {
    id: 'mistral',
    label: 'Mistral AI',
    requiresApiKey: true,
    requiresBaseUrl: false,
    supportsModel: true,
    defaultBaseUrl: 'https://api.mistral.ai/v1',
    credentialEnvVar: 'MISTRAL_API_KEY',
    modelEnvVar: 'MISTRAL_MODEL',
    mode: 'mistral',
  },
  {
    id: 'moonshotai',
    label: 'Moonshot AI - API',
    requiresApiKey: true,
    requiresBaseUrl: false,
    supportsModel: true,
    defaultBaseUrl: 'https://api.moonshot.ai/v1',
    credentialEnvVar: 'MOONSHOT_API_KEY',
    mode: 'openai-compatible',
  },
  {
    id: 'kimi-code',
    label: 'Moonshot AI - Kimi Code',
    requiresApiKey: true,
    requiresBaseUrl: false,
    supportsModel: true,
    defaultBaseUrl: 'https://api.kimi.com/coding/v1',
    credentialEnvVar: 'KIMI_API_KEY',
    mode: 'openai-compatible',
  },
  {
    id: 'nvidia-nim',
    label: 'NVIDIA NIM',
    requiresApiKey: true,
    requiresBaseUrl: false,
    supportsModel: true,
    defaultBaseUrl: 'https://integrate.api.nvidia.com/v1',
    defaultModel: 'stepfun-ai/step-3.5-flash',
    credentialEnvVar: 'NVIDIA_API_KEY',
    mode: 'openai-compatible',
    extraEnv: { NVIDIA_NIM: '1' },
    mirrorApiKeyToOpenAI: true,
  },
  {
    id: 'openai',
    label: 'OpenAI',
    requiresApiKey: true,
    requiresBaseUrl: false,
    supportsModel: true,
    credentialEnvVar: 'OPENAI_API_KEY',
    mode: 'openai-compatible',
  },
  {
    id: 'openrouter',
    label: 'OpenRouter',
    requiresApiKey: true,
    requiresBaseUrl: false,
    supportsModel: true,
    defaultBaseUrl: 'https://openrouter.ai/api/v1',
    credentialEnvVar: 'OPENROUTER_API_KEY',
    mode: 'openai-compatible',
  },
  {
    id: 'together',
    label: 'Together AI',
    requiresApiKey: true,
    requiresBaseUrl: false,
    supportsModel: true,
    defaultBaseUrl: 'https://api.together.xyz/v1',
    credentialEnvVar: 'TOGETHER_API_KEY',
    mode: 'openai-compatible',
  },
  {
    id: 'venice',
    label: 'Venice',
    requiresApiKey: true,
    requiresBaseUrl: false,
    supportsModel: true,
    defaultBaseUrl: 'https://api.venice.ai/api/v1',
    credentialEnvVar: 'VENICE_API_KEY',
    mode: 'openai-compatible',
    mirrorApiKeyToOpenAI: true,
  },
  {
    id: 'xai',
    label: 'xAI',
    requiresApiKey: false,
    requiresBaseUrl: false,
    supportsModel: true,
    defaultBaseUrl: 'https://api.x.ai/v1',
    credentialEnvVar: 'XAI_API_KEY',
    mode: 'openai-compatible',
    mirrorApiKeyToOpenAI: true,
  },
  {
    id: 'xiaomi-mimo',
    label: 'Xiaomi MiMo',
    requiresApiKey: true,
    requiresBaseUrl: false,
    supportsModel: true,
    defaultBaseUrl: 'https://api.xiaomimimo.com/v1',
    credentialEnvVar: 'MIMO_API_KEY',
    mode: 'openai-compatible',
    mirrorApiKeyToOpenAI: true,
  },
  {
    id: 'zai',
    label: 'Z.AI',
    requiresApiKey: true,
    requiresBaseUrl: false,
    supportsModel: true,
    defaultBaseUrl: 'https://api.z.ai/api/coding/paas/v4',
    credentialEnvVar: 'OPENAI_API_KEY',
    mode: 'openai-compatible',
  },
  {
    id: 'custom',
    label: 'Custom OpenAI-compatible',
    requiresApiKey: false,
    requiresBaseUrl: true,
    supportsModel: true,
    credentialEnvVar: 'OPENAI_API_KEY',
    mode: 'openai-compatible',
  },
  {
    id: 'bedrock',
    label: 'AWS Bedrock',
    requiresApiKey: false,
    requiresBaseUrl: false,
    supportsModel: true,
    mode: 'bedrock',
  },
  {
    id: 'vertex',
    label: 'Google Vertex AI',
    requiresApiKey: false,
    requiresBaseUrl: false,
    supportsModel: true,
    mode: 'vertex',
  },
  {
    id: 'github',
    label: 'GitHub Copilot',
    requiresApiKey: false,
    requiresBaseUrl: false,
    supportsModel: true,
    defaultBaseUrl: 'https://api.githubcopilot.com',
    credentialEnvVar: 'GITHUB_TOKEN',
    mode: 'github',
  },
  {
    id: 'codex',
    label: 'Codex (ChatGPT)',
    requiresApiKey: false,
    requiresBaseUrl: false,
    supportsModel: true,
    defaultBaseUrl: 'https://api.codex.openai.com/v1',
    credentialEnvVar: 'CODEX_API_KEY',
    mode: 'codex',
  },
];

// ============================================================================
// AuthManager
// ============================================================================

export class AuthManager {
  constructor(
    private readonly settings: SettingsSync,
    private readonly profileLoader: typeof loadProfileFile = loadProfileFile,
    private readonly activeProfileLoader: typeof loadActiveProviderProfile = loadActiveProviderProfile,
    private readonly activeProfileModelUpdater: typeof updateActiveProviderProfileModel = updateActiveProviderProfileModel,
    private readonly modelDiscoverer: typeof discoverOpenAICompatibleModelOptions = discoverOpenAICompatibleModelOptions,
  ) {}

  getAvailableProviders(): ProviderDefinition[] {
    return PROVIDER_DEFINITIONS;
  }

  getCurrentProvider(): ProviderConfig {
    const activeProfile = this.getActiveProviderProfileFallback();
    if (activeProfile) {
      const model =
        (this.settings.selectedModel
          ? normalizeModelForProvider(activeProfile.profile.provider, this.settings.selectedModel)
          : undefined) ??
        getPrimaryProviderModel(activeProfile.profile.model, activeProfile.profile.provider);
      return {
        id: activeProfile.profile.provider,
        label: activeProfile.profile.name,
        env: buildEnvForProviderProfile(activeProfile.profile, { modelOverride: model }),
        model,
        modelOptions: activeProfile.modelOptions,
      };
    }

    const profile = this.getProfileFallback();
    if (profile) {
      const rawModel = this.settings.selectedModel ??
        profile.profile.env.OPENAI_MODEL ??
        profile.profile.env.NVIDIA_MODEL ??
        profile.profile.env.ANTHROPIC_MODEL ??
        profile.profile.env.GEMINI_MODEL ??
        profile.profile.env.MISTRAL_MODEL ??
        profile.profile.env.MINIMAX_MODEL ??
        profile.profile.env.BANKR_MODEL;
      const model = rawModel ? normalizeModelForProvider(profile.profile.profile, rawModel) : undefined;
      return {
        id: profile.profile.profile,
        label: labelForProfile(profile.profile.profile),
        env: withModelOverride(
          profile.profile.profile,
          applyCompatibilityFlag(profile.profile.profile, profile.profile.env),
          this.settings.selectedModel,
        ),
        model,
      };
    }

    const providerId = this.settings.selectedProvider;
    const def = PROVIDER_DEFINITIONS.find((p) => p.id === providerId) ?? PROVIDER_DEFINITIONS[0];
    const apiKey = this.settings.apiKey;
    const baseUrl = this.settings.baseUrl;
    const model = this.settings.selectedModel ?? def.defaultModel;
    const normalizedModel = model ? normalizeModelForProvider(def.id, model) : undefined;

    return {
      id: def.id,
      label: def.label,
      env: this._buildEnvForProvider(def, apiKey, baseUrl, normalizedModel),
      model: normalizedModel,
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

    const activeProfile = this.getActiveProviderProfileFallback();
    if (activeProfile) {
      Object.assign(env, buildEnvForProviderProfile(activeProfile.profile, {
        modelOverride: this.settings.selectedModel,
      }));
      return env;
    }

    const profile = this.getProfileFallback();
    if (profile) {
      Object.assign(env, withModelOverride(
        profile.profile.profile,
        applyCompatibilityFlag(profile.profile.profile, profile.profile.env),
        this.settings.selectedModel,
      ));
      return env;
    }

    const providerId = this.settings.selectedProvider;
    const def = PROVIDER_DEFINITIONS.find((p) => p.id === providerId) ?? PROVIDER_DEFINITIONS[0];
    const apiKey = this.settings.apiKey;
    const baseUrl = this.settings.baseUrl;
    const model = this.settings.selectedModel ?? def.defaultModel;
    const normalizedModel = model ? normalizeModelForProvider(def.id, model) : undefined;

    // Merge provider-specific env vars (provider takes precedence for its own keys)
    const providerEnv = this._buildEnvForProvider(
      def,
      apiKey,
      baseUrl,
      normalizedModel,
    );
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

  async updateModel(model: string | undefined): Promise<void> {
    const activeProfile = this.getActiveProviderProfileFallback();
    if (activeProfile && model && this.activeProfileModelUpdater(model)) {
      await this.settings.setModel(undefined);
      return;
    }

    await this.settings.setModel(model);
  }

  normalizeModelForCurrentProvider(model: string): string {
    return normalizeModelForProvider(this.getCurrentProvider().id, model);
  }

  async discoverCurrentProviderModels(): Promise<ProviderModelOption[]> {
    const current = this.getCurrentProvider();
    const discovered = await this.modelDiscoverer(this.buildProcessEnv());
    if (discovered.length > 0) {
      return discovered;
    }
    return current.modelOptions ?? [];
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
    model: string | undefined,
  ): Record<string, string> {
    const env: Record<string, string> = {};

    switch (def.mode ?? def.id) {
      case 'anthropic':
        if (apiKey && def.credentialEnvVar) env[def.credentialEnvVar] = apiKey;
        if (model) env[def.modelEnvVar ?? 'ANTHROPIC_MODEL'] = model;
        break;

      case 'bedrock':
        env['GAKR_CODE_USE_BEDROCK'] = '1';
        break;

      case 'vertex':
        env['GAKR_CODE_USE_VERTEX'] = '1';
        break;

      case 'gemini':
        if (apiKey && def.credentialEnvVar) env[def.credentialEnvVar] = apiKey;
        if (baseUrl) env['GEMINI_BASE_URL'] = baseUrl;
        if (model) env[def.modelEnvVar ?? 'GEMINI_MODEL'] = model;
        env['GAKR_CODE_USE_GEMINI'] = '1';
        break;

      case 'mistral':
        if (apiKey && def.credentialEnvVar) env[def.credentialEnvVar] = apiKey;
        if (baseUrl || def.defaultBaseUrl) env['MISTRAL_BASE_URL'] = baseUrl || def.defaultBaseUrl!;
        if (model) env[def.modelEnvVar ?? 'MISTRAL_MODEL'] = model;
        env['GAKR_CODE_USE_MISTRAL'] = '1';
        break;

      case 'github':
        if (apiKey && def.credentialEnvVar) env[def.credentialEnvVar] = apiKey;
        if (baseUrl || def.defaultBaseUrl) env['OPENAI_BASE_URL'] = baseUrl || def.defaultBaseUrl!;
        if (model) env['OPENAI_MODEL'] = model;
        env['GAKR_CODE_USE_GITHUB'] = '1';
        break;

      case 'codex':
        if (apiKey && def.credentialEnvVar) env[def.credentialEnvVar] = apiKey;
        if (baseUrl || def.defaultBaseUrl) env['OPENAI_BASE_URL'] = baseUrl || def.defaultBaseUrl!;
        if (model) env['OPENAI_MODEL'] = model;
        env['GAKR_CODE_USE_OPENAI'] = '1';
        break;

      case 'openai-compatible':
        if (apiKey && def.credentialEnvVar) {
          env[def.credentialEnvVar] = apiKey;
        }
        if (apiKey && (def.mirrorApiKeyToOpenAI || def.credentialEnvVar === 'OPENAI_API_KEY')) {
          env['OPENAI_API_KEY'] = apiKey;
        }
        if (!apiKey && def.localApiKeyFallback) {
          env['OPENAI_API_KEY'] = def.localApiKeyFallback;
        }
        if (baseUrl || def.defaultBaseUrl) {
          env['OPENAI_BASE_URL'] = baseUrl || def.defaultBaseUrl!;
        }
        if (model) {
          env['OPENAI_MODEL'] = model;
          if (def.id === 'nvidia-nim') {
            env['NVIDIA_MODEL'] = model;
          }
        }
        env['GAKR_CODE_USE_OPENAI'] = '1';
        Object.assign(env, def.extraEnv);
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

  private getActiveProviderProfileFallback(): ActiveProviderProfileResult | null {
    if (this.hasExplicitExtensionProvider()) {
      return null;
    }

    return this.activeProfileLoader();
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

function withModelOverride(
  profile: string,
  env: Record<string, string>,
  model: string | undefined,
): Record<string, string> {
  if (!model) {
    return env;
  }

  const next = { ...env };
  switch (profile) {
    case 'anthropic':
    case 'bedrock':
    case 'vertex':
      next.ANTHROPIC_MODEL = model;
      break;
    case 'gemini':
      next.GEMINI_MODEL = model;
      break;
    case 'mistral':
      next.MISTRAL_MODEL = model;
      break;
    case 'nvidia-nim':
      next.OPENAI_MODEL = model;
      next.NVIDIA_MODEL = model;
      break;
    default:
      next.OPENAI_MODEL = model;
      break;
  }
  return next;
}

function labelForProfile(profile: string): string {
  const labels: Record<string, string> = {
    anthropic: 'Anthropic',
    openai: 'OpenAI',
    ollama: 'Ollama',
    gemini: 'Google Gemini',
    'dashscope-cn': 'Alibaba Coding Plan (China)',
    'dashscope-intl': 'Alibaba Coding Plan',
    'azure-openai': 'Azure OpenAI',
    bankr: 'Bankr',
    groq: 'Groq',
    hicap: 'Hicap',
    lmstudio: 'LM Studio',
    'atomic-chat': 'Atomic Chat',
    mistral: 'Mistral AI',
    github: 'GitHub Copilot',
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
    together: 'Together AI',
  };
  return labels[profile] ?? profile;
}
