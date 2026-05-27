import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

export const PROFILE_FILE_NAME = '.gakrcli-profile.json';

export interface GakrCliProfileFile {
  profile: string;
  env: Record<string, string>;
  createdAt?: string;
}

export interface ProfileSearchOptions {
  cwd?: string;
  configDir?: string;
  homeDir?: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function normalizeEnv(value: unknown): Record<string, string> {
  if (!isRecord(value)) {
    return {};
  }

  const env: Record<string, string> = {};
  for (const [key, raw] of Object.entries(value)) {
    if (typeof raw === 'string') {
      env[key] = raw;
    }
  }
  return env;
}

export function parseProfileFile(raw: string): GakrCliProfileFile | null {
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!isRecord(parsed) || typeof parsed.profile !== 'string') {
      return null;
    }

    const env = normalizeEnv(parsed.env);
    if (Object.keys(env).length === 0) {
      return null;
    }

    return {
      profile: parsed.profile,
      env,
      createdAt: typeof parsed.createdAt === 'string' ? parsed.createdAt : undefined,
    };
  } catch {
    return null;
  }
}

export function getProfileSearchPaths(options: ProfileSearchOptions = {}): string[] {
  const cwd = options.cwd ?? process.cwd();
  const configDir =
    options.configDir ??
    process.env.GAKR_CONFIG_DIR ??
    path.join(options.homeDir ?? os.homedir(), '.gakrcli');

  const candidates = [
    path.resolve(cwd, PROFILE_FILE_NAME),
    path.resolve(configDir, PROFILE_FILE_NAME),
  ];

  return [...new Set(candidates)];
}

export function loadProfileFile(
  options: ProfileSearchOptions = {},
): { profile: GakrCliProfileFile; path: string } | null {
  for (const filePath of getProfileSearchPaths(options)) {
    try {
      if (!fs.existsSync(filePath)) {
        continue;
      }
      const profile = parseProfileFile(fs.readFileSync(filePath, 'utf8'));
      if (profile) {
        return { profile, path: filePath };
      }
    } catch {
      continue;
    }
  }

  return null;
}

export function applyCompatibilityFlag(
  profile: string,
  env: Record<string, string>,
): Record<string, string> {
  const next = { ...env };
  switch (profile) {
    case 'openai':
    case 'ollama':
    case 'custom':
    case 'codex':
    case 'nvidia-nim':
    case 'minimax':
    case 'xai':
    case 'venice':
    case 'xiaomi-mimo':
    case 'moonshotai':
    case 'kimi-code':
    case 'deepseek':
    case 'openrouter':
    case 'zai':
    case 'atomic-chat':
      next.GAKR_CODE_USE_OPENAI = '1';
      break;
    case 'github':
      next.GAKR_CODE_USE_GITHUB = '1';
      break;
    case 'gemini':
      next.GAKR_CODE_USE_GEMINI = '1';
      break;
    case 'mistral':
      next.GAKR_CODE_USE_MISTRAL = '1';
      break;
    case 'bedrock':
      next.GAKR_CODE_USE_BEDROCK = '1';
      break;
    case 'vertex':
      next.GAKR_CODE_USE_VERTEX = '1';
      break;
    case 'foundry':
      next.GAKR_CODE_USE_FOUNDRY = '1';
      break;
  }
  return next;
}
