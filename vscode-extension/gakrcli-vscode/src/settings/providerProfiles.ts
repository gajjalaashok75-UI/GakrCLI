import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

export interface ProviderProfile {
  id: string;
  name: string;
  provider: string;
  baseUrl: string;
  model: string;
  apiKey?: string;
  apiFormat?: 'chat_completions' | 'responses';
  authHeader?: string;
  authScheme?: 'bearer' | 'raw';
  authHeaderValue?: string;
  customHeaders?: Record<string, string>;
}

export interface ProviderModelOption {
  value: string;
  displayName: string;
}

export interface ActiveProviderProfileResult {
  profile: ProviderProfile;
  path: string;
  modelOptions: ProviderModelOption[];
}

export interface ProviderProfileConfigOptions {
  homeDir?: string;
  configDir?: string;
  filePath?: string;
}

interface GlobalProviderProfileConfig {
  activeProviderProfileId?: string;
  providerProfiles?: ProviderProfile[];
  openaiAdditionalModelOptionsCacheByProfile?: Record<string, Array<Record<string, unknown>>>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function trim(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function optionalString(value: unknown): string | undefined {
  const trimmed = trim(value);
  return trimmed.length > 0 ? trimmed : undefined;
}

function parseModelList(value: string): string[] {
  const seen = new Set<string>();
  const models: string[] = [];
  for (const part of value.split(',')) {
    const model = part.trim();
    if (!model || seen.has(model)) {
      continue;
    }
    seen.add(model);
    models.push(model);
  }
  return models;
}

export function normalizeModelForProvider(provider: string | undefined, model: string): string {
  void provider;
  return model.trim();
}

export function getPrimaryProviderModel(
  model: string | undefined,
  provider?: string,
): string | undefined {
  if (!model) {
    return undefined;
  }
  const primary = parseModelList(model)[0];
  return primary ? normalizeModelForProvider(provider, primary) : undefined;
}

function sanitizeCustomHeaders(value: unknown): Record<string, string> | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  const headers: Record<string, string> = {};
  for (const [key, raw] of Object.entries(value)) {
    if (typeof raw === 'string') {
      headers[key] = raw;
    }
  }
  return Object.keys(headers).length > 0 ? headers : undefined;
}

function sanitizeProfile(value: unknown): ProviderProfile | null {
  if (!isRecord(value)) {
    return null;
  }

  const id = trim(value.id);
  const name = trim(value.name);
  const provider = trim(value.provider);
  const baseUrl = trim(value.baseUrl).replace(/\/+$/, '');
  const model = trim(value.model);

  if (!id || !name || !provider || !baseUrl || !model) {
    return null;
  }

  const profile: ProviderProfile = { id, name, provider, baseUrl, model };
  const apiKey = optionalString(value.apiKey);
  const authHeader = optionalString(value.authHeader);
  const authHeaderValue = optionalString(value.authHeaderValue);
  const customHeaders = sanitizeCustomHeaders(value.customHeaders);

  if (apiKey) profile.apiKey = apiKey;
  if (value.apiFormat === 'chat_completions' || value.apiFormat === 'responses') {
    profile.apiFormat = value.apiFormat;
  }
  if (authHeader) profile.authHeader = authHeader;
  if (value.authScheme === 'bearer' || value.authScheme === 'raw') {
    profile.authScheme = value.authScheme;
  }
  if (authHeaderValue) profile.authHeaderValue = authHeaderValue;
  if (customHeaders) profile.customHeaders = customHeaders;

  return profile;
}

export function getGlobalProviderConfigPath(options: ProviderProfileConfigOptions = {}): string {
  if (options.filePath) {
    return options.filePath;
  }

  const configDir =
    options.configDir ??
    process.env.GAKR_CONFIG_DIR ??
    options.homeDir ??
    os.homedir();
  return path.join(configDir, '.gakrcli.json');
}

export function parseGlobalProviderProfileConfig(raw: string): GlobalProviderProfileConfig {
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!isRecord(parsed)) {
      return {};
    }

    return {
      activeProviderProfileId: optionalString(parsed.activeProviderProfileId),
      providerProfiles: Array.isArray(parsed.providerProfiles)
        ? parsed.providerProfiles
          .map(sanitizeProfile)
          .filter((profile): profile is ProviderProfile => profile !== null)
        : [],
      openaiAdditionalModelOptionsCacheByProfile: isRecord(parsed.openaiAdditionalModelOptionsCacheByProfile)
        ? parsed.openaiAdditionalModelOptionsCacheByProfile as Record<string, Array<Record<string, unknown>>>
        : undefined,
    };
  } catch {
    return {};
  }
}

function getModelOptionsForProfile(
  profile: ProviderProfile,
  config: GlobalProviderProfileConfig,
): ProviderModelOption[] {
  const options: ProviderModelOption[] = parseModelList(profile.model).map((model) => ({
    value: normalizeModelForProvider(profile.provider, model),
    displayName: normalizeModelForProvider(profile.provider, model),
  }));
  const seen = new Set(options.map((option) => option.value));
  const cached = config.openaiAdditionalModelOptionsCacheByProfile?.[profile.id] ?? [];

  for (const raw of cached) {
    const rawValue = optionalString(raw.value);
    const value = rawValue ? normalizeModelForProvider(profile.provider, rawValue) : undefined;
    if (!value || seen.has(value)) {
      continue;
    }
    seen.add(value);
    options.push({
      value,
      displayName: optionalString(raw.displayName) ?? optionalString(raw.label) ?? value,
    });
  }

  return options;
}

export function loadActiveProviderProfile(
  options: ProviderProfileConfigOptions = {},
): ActiveProviderProfileResult | null {
  const filePath = getGlobalProviderConfigPath(options);
  try {
    if (!fs.existsSync(filePath)) {
      return null;
    }

    const config = parseGlobalProviderProfileConfig(fs.readFileSync(filePath, 'utf8'));
    const profiles = config.providerProfiles ?? [];
    if (profiles.length === 0) {
      return null;
    }

    const activeId = config.activeProviderProfileId;
    const profile = profiles.find((candidate) => candidate.id === activeId) ?? profiles[0];
    return {
      profile,
      path: filePath,
      modelOptions: getModelOptionsForProfile(profile, config),
    };
  } catch {
    return null;
  }
}

export function buildEnvForProviderProfile(
  profile: ProviderProfile,
  options: { modelOverride?: string } = {},
): Record<string, string> {
  const model =
    getPrimaryProviderModel(options.modelOverride, profile.provider) ??
    getPrimaryProviderModel(profile.model, profile.provider);
  const env: Record<string, string> = {};
  const provider = profile.provider.toLowerCase();
  const baseUrl = profile.baseUrl;

  if (provider === 'anthropic') {
    env.ANTHROPIC_BASE_URL = baseUrl;
    if (model) env.ANTHROPIC_MODEL = model;
    if (profile.apiKey) env.ANTHROPIC_API_KEY = profile.apiKey;
  } else if (provider === 'gemini') {
    env.GAKR_CODE_USE_GEMINI = '1';
    env.GEMINI_BASE_URL = baseUrl;
    if (model) env.GEMINI_MODEL = model;
    if (profile.apiKey) env.GEMINI_API_KEY = profile.apiKey;
  } else if (provider === 'mistral') {
    env.GAKR_CODE_USE_MISTRAL = '1';
    env.MISTRAL_BASE_URL = baseUrl;
    if (model) env.MISTRAL_MODEL = model;
    if (profile.apiKey) env.MISTRAL_API_KEY = profile.apiKey;
  } else if (provider === 'github') {
    env.GAKR_CODE_USE_GITHUB = '1';
    env.OPENAI_BASE_URL = baseUrl;
    if (model) env.OPENAI_MODEL = model;
  } else if (provider === 'bedrock') {
    env.GAKR_CODE_USE_BEDROCK = '1';
    env.ANTHROPIC_BEDROCK_BASE_URL = baseUrl;
    if (model) env.ANTHROPIC_MODEL = model;
  } else if (provider === 'vertex') {
    env.GAKR_CODE_USE_VERTEX = '1';
    env.ANTHROPIC_VERTEX_BASE_URL = baseUrl;
    if (model) env.ANTHROPIC_MODEL = model;
  } else {
    env.GAKR_CODE_USE_OPENAI = '1';
    env.OPENAI_BASE_URL = baseUrl;
    if (model) env.OPENAI_MODEL = model;
    if (profile.apiKey) env.OPENAI_API_KEY = profile.apiKey;
    if (profile.apiFormat) env.OPENAI_API_FORMAT = profile.apiFormat;
    if (profile.authHeader) env.OPENAI_AUTH_HEADER = profile.authHeader;
    if (profile.authScheme) env.OPENAI_AUTH_SCHEME = profile.authScheme;
    if (profile.authHeaderValue) env.OPENAI_AUTH_HEADER_VALUE = profile.authHeaderValue;

    const lowerBaseUrl = baseUrl.toLowerCase();
    if (provider === 'nvidia-nim' || lowerBaseUrl.includes('nvidia')) {
      env.NVIDIA_NIM = '1';
      if (profile.apiKey) env.NVIDIA_API_KEY = profile.apiKey;
    }
    if (provider === 'minimax' || lowerBaseUrl.includes('minimax')) {
      if (profile.apiKey) env.MINIMAX_API_KEY = profile.apiKey;
    }
    if (provider === 'xai' || lowerBaseUrl.includes('x.ai')) {
      if (profile.apiKey) env.XAI_API_KEY = profile.apiKey;
    }
    if (provider === 'venice' || lowerBaseUrl.includes('api.venice.ai')) {
      if (profile.apiKey) env.VENICE_API_KEY = profile.apiKey;
    }
    if (provider === 'xiaomi-mimo' || lowerBaseUrl.includes('api.xiaomimimo.com') || lowerBaseUrl.includes('api.mimo-v2.com')) {
      if (profile.apiKey) env.MIMO_API_KEY = profile.apiKey;
    }
  }

  if (profile.customHeaders && Object.keys(profile.customHeaders).length > 0) {
    env.ANTHROPIC_CUSTOM_HEADERS = JSON.stringify(profile.customHeaders);
  }

  return env;
}

function promoteModel(modelList: string, selectedModel: string, provider?: string): string {
  const model = normalizeModelForProvider(provider, selectedModel);
  if (!model) {
    return modelList;
  }

  const existing = parseModelList(modelList);
  return [
    model,
    ...existing.filter((candidate) => candidate !== model),
  ].join(', ');
}

export function updateActiveProviderProfileModel(
  model: string,
  options: ProviderProfileConfigOptions = {},
): boolean {
  const nextModel = model.trim();
  if (!nextModel) {
    return false;
  }

  const filePath = getGlobalProviderConfigPath(options);
  try {
    if (!fs.existsSync(filePath)) {
      return false;
    }

    const raw = fs.readFileSync(filePath, 'utf8');
    const parsed = JSON.parse(raw) as unknown;
    if (!isRecord(parsed) || !Array.isArray(parsed.providerProfiles)) {
      return false;
    }

    const config = parseGlobalProviderProfileConfig(raw);
    const profiles = config.providerProfiles ?? [];
    const activeProfile = profiles.find((candidate) => candidate.id === config.activeProviderProfileId) ?? profiles[0];
    if (!activeProfile) {
      return false;
    }

    const index = parsed.providerProfiles.findIndex((candidate: unknown) => {
      return isRecord(candidate) && candidate.id === activeProfile.id;
    });
    if (index < 0) {
      return false;
    }

    const currentRawProfile = parsed.providerProfiles[index] as Record<string, unknown>;
    const promotedModel = promoteModel(activeProfile.model, nextModel, activeProfile.provider);
    if (currentRawProfile.model === promotedModel) {
      return true;
    }

    parsed.providerProfiles[index] = {
      ...currentRawProfile,
      model: promotedModel,
    };
    fs.writeFileSync(filePath, JSON.stringify(parsed, null, 2), { encoding: 'utf8', mode: 0o600 });
    return true;
  } catch {
    return false;
  }
}
