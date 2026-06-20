import type { ProviderModelOption } from './providerProfiles';

const DISCOVERY_TIMEOUT_MS = 5000;

interface OpenAIModelsResponse {
  data?: Array<{ id?: string | null } | string>;
  models?: Array<{ id?: string | null; name?: string | null } | string>;
}

export async function discoverOpenAICompatibleModelOptions(
  env: Record<string, string>,
  options: { timeoutMs?: number } = {},
): Promise<ProviderModelOption[]> {
  const fallbackBaseUrl = env.GAKR_CODE_USE_OPENAI === '1' || env.OPENAI_API_KEY
    ? 'https://api.openai.com/v1'
    : '';
  const baseUrl = (env.OPENAI_BASE_URL ?? env.OPENAI_API_BASE ?? fallbackBaseUrl).trim().replace(/\/+$/, '');
  if (!baseUrl || typeof fetch !== 'function') {
    return [];
  }

  const headers = getAuthHeaders(baseUrl, env);
  for (const url of getModelListUrls(baseUrl, env)) {
    const modelNames = await fetchModelNames(url, headers, options.timeoutMs ?? DISCOVERY_TIMEOUT_MS);
    if (modelNames.length > 0) {
      return modelNames.map((model) => ({
        value: model,
        displayName: model,
      }));
    }
  }

  return [];
}

function getModelListUrls(baseUrl: string, env: Record<string, string>): string[] {
  const primary = baseUrl.endsWith('/v1')
    ? `${baseUrl}/models`
    : `${baseUrl}/v1/models`;
  const secondary = `${baseUrl}/models`;
  const urls = primary === secondary ? [primary] : [primary, secondary];
  const apiVersion = env.OPENAI_API_VERSION?.trim();

  if (!apiVersion || !isAzureOpenAIBaseUrl(baseUrl)) {
    return urls;
  }

  return urls.map((url) => {
    try {
      const parsed = new URL(url);
      parsed.searchParams.set('api-version', apiVersion);
      return parsed.toString();
    } catch {
      return url;
    }
  });
}

function getAuthHeaders(baseUrl: string, env: Record<string, string>): Record<string, string> {
  const customHeader = env.OPENAI_AUTH_HEADER?.trim();
  const customHeaderValue = env.OPENAI_AUTH_HEADER_VALUE?.trim();
  if (customHeader && customHeaderValue) {
    const value = env.OPENAI_AUTH_SCHEME === 'raw' || /^Bearer\s+/i.test(customHeaderValue)
      ? customHeaderValue
      : `Bearer ${customHeaderValue}`;
    return { [customHeader]: value };
  }

  const apiKey = (
    env.OPENAI_API_KEY ??
    env.NVIDIA_API_KEY ??
    env.OPENROUTER_API_KEY ??
    env.GROQ_API_KEY ??
    env.TOGETHER_API_KEY ??
    env.DEEPSEEK_API_KEY ??
    env.MINIMAX_API_KEY ??
    env.BNKR_API_KEY ??
    ''
  ).trim();
  if (!apiKey) {
    return {};
  }

  const headers: Record<string, string> = isBankrBaseUrl(baseUrl)
    ? { 'X-API-Key': apiKey }
    : { Authorization: `Bearer ${apiKey}` };
  if (isAzureOpenAIBaseUrl(baseUrl)) {
    headers['api-key'] = apiKey;
  }
  return headers;
}

async function fetchModelNames(
  url: string,
  headers: Record<string, string>,
  timeoutMs: number,
): Promise<string[]> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      headers,
      signal: controller.signal,
    });
    if (!response.ok) {
      return [];
    }
    const payload = await response.json() as OpenAIModelsResponse;
    return uniqueModelNames([
      ...readModelNames(payload.data),
      ...readModelNames(payload.models),
    ]);
  } catch {
    return [];
  } finally {
    clearTimeout(timeout);
  }
}

function readModelNames(value: OpenAIModelsResponse['data'] | OpenAIModelsResponse['models']): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((entry) => {
      if (typeof entry === 'string') {
        return entry;
      }
      return entry.id ?? ('name' in entry ? entry.name : '') ?? '';
    })
    .filter((model): model is string => model.trim().length > 0);
}

function uniqueModelNames(modelNames: string[]): string[] {
  const seen = new Set<string>();
  const unique: string[] = [];
  for (const modelName of modelNames) {
    const trimmed = modelName.trim();
    if (!trimmed || seen.has(trimmed)) {
      continue;
    }
    seen.add(trimmed);
    unique.push(trimmed);
  }
  return unique;
}

function isAzureOpenAIBaseUrl(baseUrl: string): boolean {
  try {
    const hostname = new URL(baseUrl).hostname.toLowerCase();
    return hostname.endsWith('.openai.azure.com') || hostname.endsWith('.cognitiveservices.azure.com');
  } catch {
    return false;
  }
}

function isBankrBaseUrl(baseUrl: string): boolean {
  try {
    return new URL(baseUrl).hostname.toLowerCase().includes('bankr');
  } catch {
    return false;
  }
}
