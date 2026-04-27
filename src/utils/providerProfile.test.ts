import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { DEFAULT_CODEX_BASE_URL } from '../services/api/providerConfig.ts'
import {
  buildStartupEnvFromProfile,
  buildAtomicChatProfileEnv,
  buildCodexProfileEnv,
  buildGeminiProfileEnv,
  buildLaunchEnv,
  buildMistralProfileEnv,
  buildNvidiaNimProfileEnv,
  buildOllamaProfileEnv,
  buildOpenAIProfileEnv,
  clearPersistedCodexOAuthProfile,
  createProfileFile,
  isPersistedCodexOAuthProfile,
  maskSecretForDisplay,
  loadProfileFile,
  PROFILE_FILE_NAME,
  redactSecretValueForDisplay,
  saveProfileFile,
  sanitizeProviderConfigValue,
  selectAutoProfile,
  type ProfileFile,
} from './providerProfile.ts'
function makeJwt(payload: Record<string, unknown>): string {
  const header = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' }))
    .toString('base64url')
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url')
  return `${header}.${body}.signature`
}
function profile(profile: ProfileFile['profile'], env: ProfileFile['env']): ProfileFile {
  return {
    profile,
    env,
    createdAt: '2026-04-01T00:00:00.000Z',
  }
}

const missingCodexAuthPath = join(tmpdir(), 'gakrcli-missing-codex-auth.json')

test('matching persisted ollama env is reused for ollama launch', async () => {
  const env = await buildLaunchEnv({
    profile: 'ollama',
    persisted: profile('ollama', {
      OPENAI_BASE_URL: 'http://127.0.0.1:11435/v1',
      OPENAI_MODEL: 'mistral:7b-instruct',
    }),
    goal: 'balanced',
    processEnv: {},
    getOllamaChatBaseUrl: () => 'http://localhost:11434/v1',
    resolveOllamaDefaultModel: async () => 'llama3.1:8b',
  })

  assert.equal(env.OPENAI_BASE_URL, 'http://127.0.0.1:11435/v1')
  assert.equal(env.OPENAI_MODEL, 'mistral:7b-instruct')
})

test('ollama launch ignores mismatched persisted openai env and shell model fallback', async () => {
  const env = await buildLaunchEnv({
    profile: 'ollama',
    persisted: profile('openai', {
      OPENAI_BASE_URL: 'https://api.openai.com/v1',
      OPENAI_MODEL: 'gpt-4o',
      OPENAI_API_KEY: 'sk-persisted',
    }),
    goal: 'coding',
    processEnv: {
      OPENAI_BASE_URL: 'https://api.deepseek.com/v1',
      OPENAI_MODEL: 'gpt-4o-mini',
      OPENAI_API_KEY: 'sk-live',
      CODEX_API_KEY: 'codex-live',
      CHATGPT_ACCOUNT_ID: 'acct_live',
    },
    getOllamaChatBaseUrl: () => 'http://localhost:11434/v1',
    resolveOllamaDefaultModel: async () => 'qwen2.5-coder:7b',
  })

  assert.equal(env.OPENAI_BASE_URL, 'http://localhost:11434/v1')
  assert.equal(env.OPENAI_MODEL, 'qwen2.5-coder:7b')
  assert.equal(env.OPENAI_API_KEY, undefined)
  assert.equal(env.CODEX_API_KEY, undefined)
  assert.equal(env.CHATGPT_ACCOUNT_ID, undefined)
})

test('openai launch ignores mismatched persisted ollama env', async () => {
  const env = await buildLaunchEnv({
    profile: 'openai',
    persisted: profile('ollama', {
      OPENAI_BASE_URL: 'http://localhost:11434/v1',
      OPENAI_MODEL: 'llama3.1:8b',
    }),
    goal: 'latency',
    processEnv: {
      OPENAI_API_KEY: 'sk-live',
      CODEX_API_KEY: 'codex-live',
      CHATGPT_ACCOUNT_ID: 'acct_live',
    },
    getOllamaChatBaseUrl: () => 'http://localhost:11434/v1',
    resolveOllamaDefaultModel: async () => 'llama3.1:8b',
  })

  assert.equal(env.OPENAI_BASE_URL, 'https://api.openai.com/v1')
  assert.equal(env.OPENAI_MODEL, 'gpt-4o-mini')
  assert.equal(env.OPENAI_API_KEY, 'sk-live')
  assert.equal(env.CODEX_API_KEY, undefined)
  assert.equal(env.CHATGPT_ACCOUNT_ID, undefined)
})

test('openai launch ignores codex shell transport hints', async () => {
  const env = await buildLaunchEnv({
    profile: 'openai',
    persisted: null,
    goal: 'balanced',
    processEnv: {
      OPENAI_API_KEY: 'sk-live',
      OPENAI_BASE_URL: 'https://chatgpt.com/backend-api/codex',
      OPENAI_MODEL: 'codexplan',
    },
  })

  assert.equal(env.OPENAI_BASE_URL, 'https://api.openai.com/v1')
  assert.equal(env.OPENAI_MODEL, 'gpt-4o')
  assert.equal(env.OPENAI_API_KEY, 'sk-live')
})

test('openai launch ignores codex persisted transport hints', async () => {
  const env = await buildLaunchEnv({
    profile: 'openai',
    persisted: profile('openai', {
      OPENAI_BASE_URL: 'https://chatgpt.com/backend-api/codex',
      OPENAI_MODEL: 'codexplan',
      OPENAI_API_KEY: 'sk-persisted',
    }),
    goal: 'balanced',
    processEnv: {
      OPENAI_API_KEY: 'sk-live',
    },
  })

  assert.equal(env.OPENAI_BASE_URL, 'https://api.openai.com/v1')
  assert.equal(env.OPENAI_MODEL, 'gpt-4o')
  assert.equal(env.OPENAI_API_KEY, 'sk-live')
})

test('matching persisted gemini env is reused for gemini launch', async () => {
  const env = await buildLaunchEnv({
    profile: 'gemini',
    persisted: profile('gemini', {
      GEMINI_MODEL: 'gemini-2.5-flash',
      GEMINI_API_KEY: 'gem-persisted',
      GEMINI_BASE_URL: 'https://example.test/v1beta/openai',
    }),
    goal: 'balanced',
    processEnv: {},
  })

  assert.equal(env.GAKR_CODE_USE_GEMINI, '1')
  assert.equal(env.GAKR_CODE_USE_OPENAI, undefined)
  assert.equal(env.GEMINI_MODEL, 'gemini-2.5-flash')
  assert.equal(env.GEMINI_API_KEY, 'gem-persisted')
  assert.equal(env.GEMINI_BASE_URL, 'https://example.test/v1beta/openai')
})

test('matching persisted nvidia env is reused for nvidia launch', async () => {
  const env = await buildLaunchEnv({
    profile: 'nvidia-nim',
    persisted: profile('nvidia-nim', {
      NVIDIA_MODEL: 'meta/llama-3.1-405b-instruct',
      NVIDIA_API_KEY: 'nvapi-persisted',
      NVIDIA_BASE_URL: 'https://example.nvidia.test/v1',
    }),
    goal: 'balanced',
    processEnv: {},
  })

  assert.equal(env.GAKR_CODE_USE_NVIDIA, '1')
  assert.equal(env.GAKR_CODE_USE_OPENAI, undefined)
  assert.equal(env.GAKR_CODE_USE_GEMINI, undefined)
  assert.equal(env.NVIDIA_MODEL, 'meta/llama-3.1-405b-instruct')
  assert.equal(env.NVIDIA_API_KEY, 'nvapi-persisted')
  assert.equal(env.NVIDIA_BASE_URL, 'https://example.nvidia.test/v1')
})

test('nvidia launch ignores mismatched persisted openai env and strips other provider secrets', async () => {
  const env = await buildLaunchEnv({
    profile: 'nvidia-nim',
    persisted: profile('openai', {
      OPENAI_BASE_URL: 'https://api.openai.com/v1',
      OPENAI_MODEL: 'gpt-4o',
      OPENAI_API_KEY: 'sk-persisted',
    }),
    goal: 'balanced',
    processEnv: {
      NVIDIA_API_KEY: 'nvapi-live',
      OPENAI_API_KEY: 'sk-live',
      OPENAI_BASE_URL: 'https://api.openai.com/v1',
      OPENAI_MODEL: 'gpt-4o-mini',
      GEMINI_API_KEY: 'gem-live',
      GEMINI_MODEL: 'gemini-2.5-flash',
      GAKR_CODE_USE_OPENAI: '1',
    },
  })

  assert.equal(env.GAKR_CODE_USE_NVIDIA, '1')
  assert.equal(env.GAKR_CODE_USE_OPENAI, undefined)
  assert.equal(env.GAKR_CODE_USE_GEMINI, undefined)
  assert.equal(env.NVIDIA_MODEL, 'stepfun-ai/step-3.5-flash')
  assert.equal(env.NVIDIA_BASE_URL, 'https://integrate.api.nvidia.com/v1')
  assert.equal(env.NVIDIA_API_KEY, 'nvapi-live')
  assert.equal(env.OPENAI_API_KEY, undefined)
  assert.equal(env.OPENAI_BASE_URL, undefined)
  assert.equal(env.OPENAI_MODEL, undefined)
  assert.equal(env.GEMINI_API_KEY, undefined)
  assert.equal(env.GEMINI_MODEL, undefined)
})

test('openai env variables take precedence over gemini', async () => {
  const env = await buildLaunchEnv({
    profile: 'gemini',
    persisted: profile('openai', {
      OPENAI_BASE_URL: 'https://api.openai.com/v1',
      OPENAI_MODEL: 'gpt-4o',
      OPENAI_API_KEY: 'sk-persisted',
    }),
    goal: 'balanced',
    processEnv: {
      GEMINI_API_KEY: 'gem-live',
      GOOGLE_API_KEY: 'google-live',
      OPENAI_API_KEY: 'sk-live',
      OPENAI_BASE_URL: 'https://api.openai.com/v1',
      OPENAI_MODEL: 'gpt-4o-mini',
      CODEX_API_KEY: 'codex-live',
      CHATGPT_ACCOUNT_ID: 'acct_live',
      GAKR_CODE_USE_OPENAI: '1',
    },
  })

  assert.equal(env.GAKR_CODE_USE_GEMINI, undefined) 
  assert.equal(env.GAKR_CODE_USE_OPENAI, '1')
  assert.equal(env.GEMINI_MODEL, undefined)
  assert.equal(env.GEMINI_API_KEY, undefined)
  assert.equal(
    env.GEMINI_BASE_URL,
    undefined,
  )
  assert.equal(env.GOOGLE_API_KEY, undefined)
  assert.equal(env.OPENAI_API_KEY, 'sk-live')
  assert.equal(env.CODEX_API_KEY, undefined)
  assert.equal(env.CHATGPT_ACCOUNT_ID, undefined)
})

test('matching persisted codex env is reused for codex launch', async () => {
  const env = await buildLaunchEnv({
    profile: 'codex',
    persisted: profile('codex', {
      OPENAI_BASE_URL: 'https://chatgpt.com/backend-api/codex',
      OPENAI_MODEL: 'codexspark',
      CODEX_API_KEY: 'codex-persisted',
      CHATGPT_ACCOUNT_ID: 'acct_persisted',
    }),
    goal: 'balanced',
    processEnv: {
      CODEX_AUTH_JSON_PATH: missingCodexAuthPath,
    },
  })

  assert.equal(env.OPENAI_BASE_URL, 'https://chatgpt.com/backend-api/codex')
  assert.equal(env.OPENAI_MODEL, 'codexspark')
  assert.equal(env.CODEX_API_KEY, 'codex-persisted')
  assert.equal(env.CHATGPT_ACCOUNT_ID, 'acct_persisted')
})

test('codex launch normalizes poisoned persisted base urls', async () => {
  const env = await buildLaunchEnv({
    profile: 'codex',
    persisted: profile('codex', {
      OPENAI_BASE_URL: 'https://api.openai.com/v1',
      OPENAI_MODEL: 'codexspark',
      CHATGPT_ACCOUNT_ID: 'acct_persisted',
    }),
    goal: 'balanced',
    processEnv: {
      CODEX_AUTH_JSON_PATH: missingCodexAuthPath,
    },
  })

  assert.equal(env.OPENAI_BASE_URL, 'https://chatgpt.com/backend-api/codex')
  assert.equal(env.OPENAI_MODEL, 'codexspark')
})

test('codex launch ignores mismatched persisted openai env', async () => {
  const env = await buildLaunchEnv({
    profile: 'codex',
    persisted: profile('openai', {
      OPENAI_BASE_URL: 'https://api.openai.com/v1',
      OPENAI_MODEL: 'gpt-4o',
      OPENAI_API_KEY: 'sk-persisted',
    }),
    goal: 'balanced',
    processEnv: {
      OPENAI_BASE_URL: 'https://api.openai.com/v1',
      OPENAI_MODEL: 'gpt-4o-mini',
      OPENAI_API_KEY: 'sk-live',
      CODEX_API_KEY: 'codex-live',
      CHATGPT_ACCOUNT_ID: 'acct_live',
    },
  })

  assert.equal(env.OPENAI_BASE_URL, 'https://chatgpt.com/backend-api/codex')
  assert.equal(env.OPENAI_MODEL, 'codexplan')
  assert.equal(env.OPENAI_API_KEY, undefined)
  assert.equal(env.CODEX_API_KEY, 'codex-live')
  assert.equal(env.CHATGPT_ACCOUNT_ID, 'acct_live')
})

test('codex launch ignores placeholder codex env keys', async () => {
  const env = await buildLaunchEnv({
    profile: 'codex',
    persisted: profile('codex', {
      OPENAI_BASE_URL: 'https://chatgpt.com/backend-api/codex',
      OPENAI_MODEL: 'codexspark',
      CODEX_API_KEY: 'codex-persisted',
      CHATGPT_ACCOUNT_ID: 'acct_persisted',
    }),
    goal: 'balanced',
    processEnv: {
      CODEX_API_KEY: 'SUA_CHAVE',
      CODEX_AUTH_JSON_PATH: missingCodexAuthPath,
    },
  })

  assert.equal(env.CODEX_API_KEY, 'codex-persisted')
  assert.equal(env.CHATGPT_ACCOUNT_ID, 'acct_persisted')
})

test('codex launch prefers auth account id over stale persisted value', async () => {
  const codexHome = mkdtempSync(join(tmpdir(), 'gakrcli-codex-'))
  try {
    writeFileSync(
      join(codexHome, 'auth.json'),
      JSON.stringify({
        access_token: 'codex-live',
        account_id: 'acct_auth',
      }),
      'utf8',
    )

    const env = await buildLaunchEnv({
      profile: 'codex',
      persisted: profile('codex', {
        OPENAI_BASE_URL: 'https://chatgpt.com/backend-api/codex',
        OPENAI_MODEL: 'codexspark',
        CHATGPT_ACCOUNT_ID: 'acct_persisted',
      }),
      goal: 'balanced',
      processEnv: {
        CODEX_HOME: codexHome,
      },
    })

    assert.equal(env.CHATGPT_ACCOUNT_ID, 'acct_auth')
  } finally {
    rmSync(codexHome, { recursive: true, force: true })
  }
})

test('ollama profiles never persist openai api keys', () => {
  const env = buildOllamaProfileEnv('llama3.1:8b', {
    getOllamaChatBaseUrl: () => 'http://localhost:11434/v1',
  })

  assert.deepEqual(env, {
    OPENAI_BASE_URL: 'http://localhost:11434/v1',
    OPENAI_MODEL: 'llama3.1:8b',
  })
  assert.equal('OPENAI_API_KEY' in env, false)
})

test('codex profiles accept explicit codex credentials', () => {
  const env = buildCodexProfileEnv({
    model: 'codexspark',
    apiKey: 'codex-live',
    processEnv: {
      CHATGPT_ACCOUNT_ID: 'acct_123',
    },
  })

  assert.deepEqual(env, {
    OPENAI_BASE_URL: 'https://chatgpt.com/backend-api/codex',
    CODEX_CREDENTIAL_SOURCE: 'existing',
    OPENAI_MODEL: 'codexspark',
    CODEX_API_KEY: 'codex-live',
    CHATGPT_ACCOUNT_ID: 'acct_123',
  })
})

test('codex profiles require a chatgpt account id', () => {
  const env = buildCodexProfileEnv({
    model: 'codexspark',
    apiKey: 'codex-live',
    processEnv: {
      CODEX_AUTH_JSON_PATH: missingCodexAuthPath,
    },
  })

  assert.equal(env, null)
})

test('gemini profiles accept google api key fallback', () => {
  const env = buildGeminiProfileEnv({
    processEnv: {
      GOOGLE_API_KEY: 'gem-live',
    },
  })

  assert.deepEqual(env, {
    GEMINI_AUTH_MODE: 'api-key',
    GEMINI_MODEL: 'gemini-2.0-flash',
    GEMINI_API_KEY: 'gem-live',
  })
})

test('gemini profiles require a key', () => {
  const env = buildGeminiProfileEnv({
    processEnv: {},
  })

  assert.equal(env, null)
})

test('nvidia profiles accept session defaults and explicit keys', () => {
  const env = buildNvidiaNimProfileEnv({
    apiKey: 'nvapi-live',
    processEnv: {},
  })

  assert.deepEqual(env, {
    NVIDIA_MODEL: 'stepfun-ai/step-3.5-flash',
    NVIDIA_API_KEY: 'nvapi-live',
  })
})

test('nvidia profiles require a key', () => {
  const env = buildNvidiaNimProfileEnv({
    processEnv: {},
  })

  assert.equal(env, null)
})

test('mistral profiles accept session defaults and explicit keys', () => {
  const env = buildMistralProfileEnv({
    apiKey: 'mistral-live',
    processEnv: {},
  })

  assert.deepEqual(env, {
    MISTRAL_API_KEY: 'mistral-live',
    MISTRAL_MODEL: 'devstral-latest',
  })
})

test('mistral profiles require a key', () => {
  const env = buildMistralProfileEnv({
    processEnv: {},
  })

  assert.equal(env, null)
})

test('matching persisted mistral env is reused for mistral launch', async () => {
  const env = await buildLaunchEnv({
    profile: 'mistral',
    persisted: profile('mistral', {
      MISTRAL_MODEL: 'codestral-latest',
      MISTRAL_API_KEY: 'mistral-persisted',
      MISTRAL_BASE_URL: 'https://mistral.example/v1',
    }),
    goal: 'balanced',
    processEnv: {},
  })

  assert.equal(env.GAKR_CODE_USE_MISTRAL, '1')
  assert.equal(env.GAKR_CODE_USE_OPENAI, undefined)
  assert.equal(env.MISTRAL_MODEL, 'codestral-latest')
  assert.equal(env.MISTRAL_API_KEY, 'mistral-persisted')
  assert.equal(env.MISTRAL_BASE_URL, 'https://mistral.example/v1')
})

test('buildStartupEnvFromProfile applies persisted mistral settings when no provider is explicitly selected', async () => {
  const env = await buildStartupEnvFromProfile({
    persisted: profile('mistral', {
      MISTRAL_API_KEY: 'mistral-test',
      MISTRAL_MODEL: 'codestral-latest',
    }),
    processEnv: {},
  })

  assert.equal(env.GAKR_CODE_USE_MISTRAL, '1')
  assert.equal(env.GAKR_CODE_USE_OPENAI, undefined)
  assert.equal(env.MISTRAL_API_KEY, 'mistral-test')
  assert.equal(env.MISTRAL_MODEL, 'codestral-latest')
})

test('saveProfileFile writes a profile that loadProfileFile can read back', () => {
  const cwd = mkdtempSync(join(tmpdir(), 'gakrcli-profile-file-'))

  try {
    const persisted = createProfileFile('openai', {
      OPENAI_API_KEY: 'sk-test',
      OPENAI_MODEL: 'gpt-4o',
    })

    const filePath = saveProfileFile(persisted, { cwd })

    assert.equal(filePath, join(cwd, PROFILE_FILE_NAME))
    assert.equal(
      JSON.parse(readFileSync(filePath, 'utf8')).profile,
      'openai',
    )
    assert.deepEqual(loadProfileFile({ cwd }), persisted)
  } finally {
    rmSync(cwd, { recursive: true, force: true })
  }
})

test('buildCodexProfileEnv tags OAuth-saved profiles so logout can remove them safely', () => {
  const env = buildCodexProfileEnv({
    model: 'codexplan',
    apiKey: makeJwt({
      'https://api.openai.com/auth': {
        chatgpt_account_id: 'acct_oauth',
      },
    }),
    credentialSource: 'oauth',
    processEnv: {},
  })

  assert.deepEqual(env, {
    OPENAI_BASE_URL: DEFAULT_CODEX_BASE_URL,
    OPENAI_MODEL: 'codexplan',
    CODEX_CREDENTIAL_SOURCE: 'oauth',
    CODEX_API_KEY: makeJwt({
      'https://api.openai.com/auth': {
        chatgpt_account_id: 'acct_oauth',
      },
    }),
    CHATGPT_ACCOUNT_ID: 'acct_oauth',
  })
})

test('clearPersistedCodexOAuthProfile removes only persisted Codex OAuth profiles', async () => {
  const cwd = mkdtempSync(join(tmpdir(), 'gakrcli-codex-oauth-profile-'))

  try {
    const providerProfileModule = await import(
      `./providerProfile.ts?ts=${Date.now()}-${Math.random()}`
    )
    const {
      PROFILE_FILE_NAME,
      clearPersistedCodexOAuthProfile,
      createProfileFile,
      isPersistedCodexOAuthProfile,
      loadProfileFile,
      saveProfileFile,
    } = providerProfileModule
    const oauthProfile = createProfileFile('codex', {
      OPENAI_MODEL: 'codexplan',
      OPENAI_BASE_URL: DEFAULT_CODEX_BASE_URL,
      CHATGPT_ACCOUNT_ID: 'acct_oauth',
      CODEX_CREDENTIAL_SOURCE: 'oauth',
    })
    saveProfileFile(oauthProfile, { cwd })

    assert.equal(isPersistedCodexOAuthProfile(loadProfileFile({ cwd })), true)
    assert.equal(
      clearPersistedCodexOAuthProfile({ cwd }),
      join(cwd, PROFILE_FILE_NAME),
    )
    assert.equal(loadProfileFile({ cwd }), null)

    const existingCredentialProfile = createProfileFile('codex', {
      OPENAI_MODEL: 'codexplan',
      OPENAI_BASE_URL: DEFAULT_CODEX_BASE_URL,
      CHATGPT_ACCOUNT_ID: 'acct_existing',
      CODEX_CREDENTIAL_SOURCE: 'existing',
    })
    saveProfileFile(existingCredentialProfile, { cwd })

    assert.equal(isPersistedCodexOAuthProfile(loadProfileFile({ cwd })), false)
    assert.equal(clearPersistedCodexOAuthProfile({ cwd }), null)
    assert.deepEqual(loadProfileFile({ cwd }), existingCredentialProfile)
  } finally {
    rmSync(cwd, { recursive: true, force: true })
  }
})

test('buildStartupEnvFromProfile applies persisted gemini settings when no provider is explicitly selected', async () => {
  const env = await buildStartupEnvFromProfile({
    persisted: profile('gemini', {
      GEMINI_API_KEY: 'gem-test',
      GEMINI_MODEL: 'gemini-2.5-flash',
    }),
    processEnv: {},
  })

  assert.equal(env.GAKR_CODE_USE_GEMINI, '1')
  assert.equal(env.GAKR_CODE_USE_OPENAI, undefined)
  assert.equal(env.GEMINI_API_KEY, 'gem-test')
  assert.equal(env.GEMINI_MODEL, 'gemini-2.5-flash')
})

test('buildStartupEnvFromProfile applies persisted nvidia settings when no provider is explicitly selected', async () => {
  const env = await buildStartupEnvFromProfile({
    persisted: profile('nvidia-nim', {
      NVIDIA_API_KEY: 'nvapi-test',
      NVIDIA_MODEL: 'meta/llama-3.1-70b-instruct',
    }),
    processEnv: {},
  })

  assert.equal(env.GAKR_CODE_USE_NVIDIA, '1')
  assert.equal(env.GAKR_CODE_USE_OPENAI, undefined)
  assert.equal(env.NVIDIA_API_KEY, 'nvapi-test')
  assert.equal(env.NVIDIA_MODEL, 'meta/llama-3.1-70b-instruct')
})

test('buildStartupEnvFromProfile leaves explicit provider selections untouched', async () => {
  const processEnv = {
    GAKR_CODE_USE_GEMINI: '1',
    GEMINI_API_KEY: 'gem-live',
    GEMINI_MODEL: 'gemini-2.0-flash',
  }

  const env = await buildStartupEnvFromProfile({
    persisted: profile('openai', {
      OPENAI_API_KEY: 'sk-persisted',
      OPENAI_MODEL: 'gpt-4o',
    }),
    processEnv,
  })

  // Remove the strict object equality check: assert.equal(env, processEnv)
  assert.equal(env.GAKR_CODE_USE_GEMINI, '1')
  assert.equal(env.GEMINI_API_KEY, 'gem-live')
  assert.equal(env.GEMINI_MODEL, 'gemini-2.0-flash')
  // Add the new default fields injected by the function
  assert.equal(env.GEMINI_BASE_URL, 'https://generativelanguage.googleapis.com/v1beta/openai')
  assert.equal(env.GEMINI_AUTH_MODE, 'api-key')
  assert.equal(env.OPENAI_API_KEY, undefined)
})

test('buildStartupEnvFromProfile treats explicit falsey provider flags as user intent', async () => {
  const processEnv = {
    GAKR_CODE_USE_OPENAI: '0',
  }

  const env = await buildStartupEnvFromProfile({
    persisted: profile('gemini', {
      GEMINI_API_KEY: 'gem-persisted',
      GEMINI_MODEL: 'gemini-2.5-flash',
    }),
    processEnv,
  })

  assert.equal(env.GAKR_CODE_USE_OPENAI, undefined)
  assert.equal(env.GAKR_CODE_USE_GEMINI, '1')
  assert.equal(env.GEMINI_API_KEY, 'gem-persisted')
  assert.equal(env.GEMINI_MODEL, 'gemini-2.5-flash')
  assert.equal(env.GEMINI_BASE_URL, 'https://generativelanguage.googleapis.com/v1beta/openai')
  assert.equal(env.GEMINI_AUTH_MODE, 'api-key')
})

test('buildStartupEnvFromProfile treats explicit nvidia provider flags as user intent', async () => {
  const processEnv = {
    GAKR_CODE_USE_NVIDIA: '0',
  }

  const env = await buildStartupEnvFromProfile({
    persisted: profile('openai', {
      OPENAI_API_KEY: 'sk-persisted',
      OPENAI_MODEL: 'gpt-4o',
    }),
    processEnv,
  })

  assert.equal(env.GAKR_CODE_USE_NVIDIA, undefined)
  assert.equal(env.GAKR_CODE_USE_OPENAI, '1')
  assert.equal(env.OPENAI_API_KEY, 'sk-persisted')
  assert.equal(env.OPENAI_MODEL, 'gpt-4o')
})

test('maskSecretForDisplay preserves only a short prefix and suffix', () => {
  assert.equal(maskSecretForDisplay('sk-secret-12345678'), 'sk-...678')
  assert.equal(maskSecretForDisplay('AIzaSecret12345678'), 'AIz...678')
  assert.equal(maskSecretForDisplay('nvapi-secret-12345678'), 'nva...678')
})

test('redactSecretValueForDisplay masks poisoned display fields that equal configured secrets', () => {
  const apiKey = 'sk-secret-12345678'

  assert.equal(
    redactSecretValueForDisplay(apiKey, { OPENAI_API_KEY: apiKey }),
    'sk-...678',
  )
  assert.equal(
    redactSecretValueForDisplay('gpt-4o', { OPENAI_API_KEY: apiKey }),
    'gpt-4o',
  )
})

test('sanitizeProviderConfigValue drops secret-like poisoned values', () => {
  const apiKey = 'sk-secret-12345678'

  assert.equal(
    sanitizeProviderConfigValue(apiKey, { OPENAI_API_KEY: apiKey }),
    undefined,
  )
  assert.equal(
    sanitizeProviderConfigValue('gpt-4o', { OPENAI_API_KEY: apiKey }),
    'gpt-4o',
  )
})

test('openai profiles ignore codex shell transport hints', () => {
  const env = buildOpenAIProfileEnv({
    goal: 'balanced',
    apiKey: 'sk-live',
    processEnv: {
      OPENAI_BASE_URL: 'https://chatgpt.com/backend-api/codex',
      OPENAI_MODEL: 'codexplan',
      OPENAI_API_KEY: 'sk-live',
    },
  })

  assert.deepEqual(env, {
    OPENAI_BASE_URL: 'https://api.openai.com/v1',
    OPENAI_MODEL: 'gpt-4o',
    OPENAI_API_KEY: 'sk-live',
  })
})

test('openai profiles with DeepSeek V4 multi-model string sets first model', () => {
  const env = buildOpenAIProfileEnv({
    goal: 'balanced',
    apiKey: 'sk-live',
    model: 'deepseek-v4-flash, deepseek-v4-pro, deepseek-chat',
    baseUrl: 'https://api.deepseek.com/v1',
    processEnv: {},
  })

  assert.deepEqual(env, {
    OPENAI_BASE_URL: 'https://api.deepseek.com/v1',
    OPENAI_MODEL: 'deepseek-v4-flash',
    OPENAI_API_KEY: 'sk-live',
  })
})

test('openai profiles ignore poisoned shell model and base url values', () => {
  const env = buildOpenAIProfileEnv({
    goal: 'balanced',
    apiKey: 'sk-live',
    processEnv: {
      OPENAI_BASE_URL: 'sk-live',
      OPENAI_MODEL: 'sk-live',
      OPENAI_API_KEY: 'sk-live',
    },
  })

  assert.deepEqual(env, {
    OPENAI_BASE_URL: 'https://api.openai.com/v1',
    OPENAI_MODEL: 'gpt-4o',
    OPENAI_API_KEY: 'sk-live',
  })
})

test('startup env ignores poisoned persisted openai model and base url', async () => {
  const env = await buildStartupEnvFromProfile({
    persisted: profile('openai', {
      OPENAI_API_KEY: 'sk-live',
      OPENAI_MODEL: 'sk-live',
      OPENAI_BASE_URL: 'sk-live',
    }),
    processEnv: {},
  })

  assert.equal(env.GAKR_CODE_USE_OPENAI, '1')
  assert.equal(env.OPENAI_API_KEY, 'sk-live')
  assert.equal(env.OPENAI_MODEL, 'gpt-4o')
  assert.equal(env.OPENAI_BASE_URL, 'https://api.openai.com/v1')
})

test('auto profile falls back to openai when no viable ollama model exists', () => {
  assert.equal(selectAutoProfile(null), 'openai')
  assert.equal(selectAutoProfile('qwen2.5-coder:7b'), 'ollama')
})

// ── Atomic Chat profile tests ────────────────────────────────────────────────

test('atomic-chat profiles never persist openai api keys', () => {
  const env = buildAtomicChatProfileEnv('some-local-model', {
    getAtomicChatChatBaseUrl: () => 'http://127.0.0.1:1337/v1',
  })

  assert.deepEqual(env, {
    OPENAI_BASE_URL: 'http://127.0.0.1:1337/v1',
    OPENAI_MODEL: 'some-local-model',
  })
  assert.equal('OPENAI_API_KEY' in env, false)
})

test('atomic-chat profiles respect custom base url', () => {
  const env = buildAtomicChatProfileEnv('my-model', {
    baseUrl: 'http://192.168.1.100:1337',
    getAtomicChatChatBaseUrl: (baseUrl?: string) =>
      baseUrl ? `${baseUrl}/v1` : 'http://127.0.0.1:1337/v1',
  })

  assert.equal(env.OPENAI_BASE_URL, 'http://192.168.1.100:1337/v1')
  assert.equal(env.OPENAI_MODEL, 'my-model')
})

test('matching persisted atomic-chat env is reused for atomic-chat launch', async () => {
  const env = await buildLaunchEnv({
    profile: 'atomic-chat',
    persisted: profile('atomic-chat', {
      OPENAI_BASE_URL: 'http://127.0.0.1:1337/v1',
      OPENAI_MODEL: 'llama-3.1-8b',
    }),
    goal: 'balanced',
    processEnv: {},
    getAtomicChatChatBaseUrl: () => 'http://127.0.0.1:1337/v1',
    resolveAtomicChatDefaultModel: async () => 'other-model',
  })

  assert.equal(env.OPENAI_BASE_URL, 'http://127.0.0.1:1337/v1')
  assert.equal(env.OPENAI_MODEL, 'llama-3.1-8b')
  assert.equal(env.OPENAI_API_KEY, undefined)
  assert.equal(env.CODEX_API_KEY, undefined)
})

test('atomic-chat launch ignores mismatched persisted openai env', async () => {
  const env = await buildLaunchEnv({
    profile: 'atomic-chat',
    persisted: profile('openai', {
      OPENAI_BASE_URL: 'https://api.openai.com/v1',
      OPENAI_MODEL: 'gpt-4o',
      OPENAI_API_KEY: 'sk-persisted',
    }),
    goal: 'balanced',
    processEnv: {
      OPENAI_API_KEY: 'sk-live',
      CODEX_API_KEY: 'codex-live',
      CHATGPT_ACCOUNT_ID: 'acct_live',
    },
    getAtomicChatChatBaseUrl: () => 'http://127.0.0.1:1337/v1',
    resolveAtomicChatDefaultModel: async () => 'local-model',
  })

  assert.equal(env.OPENAI_BASE_URL, 'http://127.0.0.1:1337/v1')
  assert.equal(env.OPENAI_MODEL, 'local-model')
  assert.equal(env.OPENAI_API_KEY, undefined)
  assert.equal(env.CODEX_API_KEY, undefined)
  assert.equal(env.CHATGPT_ACCOUNT_ID, undefined)
})
