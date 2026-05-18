import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import {
  acquireSharedMutationLock,
  releaseSharedMutationLock,
} from '../test/sharedMutationLock.js'
import {
  parseProviderFlag,
  parseModelFlag,
  applyProviderFlag,
  applyProviderFlagFromArgs,
  applyModelFlagFromArgs,
  VALID_PROVIDERS,
} from './providerFlag.js'

const ENV_KEYS = [
  'GAKR_CODE_USE_OPENAI',
  'GAKR_CODE_USE_GEMINI',
  'GAKR_CODE_USE_GITHUB',
  'GAKR_CODE_USE_MISTRAL',
  'GAKR_CODE_USE_NVIDIA',
  'GAKR_CODE_USE_BEDROCK',
  'GAKR_CODE_USE_VERTEX',
  'OPENAI_BASE_URL',
  'OPENAI_API_KEY',
  'OPENAI_MODEL',
  'GEMINI_MODEL',
  'MISTRAL_MODEL',
  'ANTHROPIC_MODEL',
  'NVIDIA_MODEL',
  'NVIDIA_API_KEY',
  'NVIDIA_NIM',
  'BNKR_API_KEY',
  'XAI_API_KEY',
  'MINIMAX_API_KEY',
  'VENICE_API_KEY',
  'MIMO_API_KEY',
]

const originalEnv: Record<string, string | undefined> = {}

beforeEach(async () => {
  await acquireSharedMutationLock('utils/providerFlag.test.ts')
  for (const key of ENV_KEYS) {
    originalEnv[key] = process.env[key]
    delete process.env[key]
  }
})

const RESET_KEYS = [
  'GAKR_CODE_USE_OPENAI',
  'GAKR_CODE_USE_GEMINI',
  'GAKR_CODE_USE_GITHUB',
  'GAKR_CODE_USE_MISTRAL',
  'GAKR_CODE_USE_NVIDIA',
  'GAKR_CODE_USE_BEDROCK',
  'GAKR_CODE_USE_VERTEX',
  'OPENAI_BASE_URL',
  'OPENAI_API_KEY',
  'OPENAI_MODEL',
  'GEMINI_MODEL',
  'MISTRAL_MODEL',
  'ANTHROPIC_MODEL',
  'NVIDIA_MODEL',
  'NVIDIA_API_KEY',
  'NVIDIA_NIM',
  'BNKR_API_KEY',
  'XAI_API_KEY',
  'MINIMAX_API_KEY',
  'VENICE_API_KEY',
  'MIMO_API_KEY',
] as const

beforeEach(() => {
  for (const key of RESET_KEYS) {
    delete process.env[key]
  }
})

afterEach(() => {
  try {
    for (const key of ENV_KEYS) {
      if (originalEnv[key] === undefined) {
        delete process.env[key]
      } else {
        process.env[key] = originalEnv[key]
      }
    }
  } finally {
    releaseSharedMutationLock()
  }
})

// --- parseProviderFlag ---

describe('parseProviderFlag', () => {
  test('returns provider name when --provider flag present', () => {
    expect(parseProviderFlag(['--provider', 'openai'])).toBe('openai')
  })

  test('returns provider name with --model alongside', () => {
    expect(parseProviderFlag(['--provider', 'gemini', '--model', 'gemini-2.0-flash'])).toBe('gemini')
  })

  test('returns null when --provider flag absent', () => {
    expect(parseProviderFlag(['--model', 'gpt-4o'])).toBeNull()
  })

  test('returns null for empty args', () => {
    expect(parseProviderFlag([])).toBeNull()
  })

  test('returns null when --provider has no value', () => {
    expect(parseProviderFlag(['--provider'])).toBeNull()
  })

  test('returns null when --provider value starts with --', () => {
    expect(parseProviderFlag(['--provider', '--model'])).toBeNull()
  })
})

// --- applyProviderFlag ---

describe('applyProviderFlag - anthropic', () => {
  test('sets no env vars for anthropic (default)', () => {
    const result = applyProviderFlag('anthropic', [])
    expect(result.error).toBeUndefined()
    expect(process.env.GAKR_CODE_USE_OPENAI).toBeUndefined()
    expect(process.env.GAKR_CODE_USE_GEMINI).toBeUndefined()
  })
})

describe('VALID_PROVIDERS', () => {
  test('includes descriptor-backed preset and route ids', () => {
    expect(VALID_PROVIDERS).toContain('deepseek')
    expect(VALID_PROVIDERS).toContain('moonshotai')
    expect(VALID_PROVIDERS).toContain('openrouter')
    expect(VALID_PROVIDERS).toContain('atomic-chat')
    expect(VALID_PROVIDERS).toContain('zai')
  })
})

describe('applyProviderFlag - openai', () => {
  test('sets GAKR_CODE_USE_OPENAI=1', () => {
    const result = applyProviderFlag('openai', [])
    expect(result.error).toBeUndefined()
    expect(process.env.GAKR_CODE_USE_OPENAI).toBe('1')
  })

  test('sets OPENAI_MODEL when --model is provided', () => {
    applyProviderFlag('openai', ['--model', 'gpt-4o'])
    expect(process.env.OPENAI_MODEL).toBe('gpt-4o')
  })
})

describe('applyProviderFlag - gemini', () => {
  test('sets GAKR_CODE_USE_GEMINI=1', () => {
    const result = applyProviderFlag('gemini', [])
    expect(result.error).toBeUndefined()
    expect(process.env.GAKR_CODE_USE_GEMINI).toBe('1')
  })

  test('sets GEMINI_MODEL when --model is provided', () => {
    applyProviderFlag('gemini', ['--model', 'gemini-2.0-flash'])
    expect(process.env.GEMINI_MODEL).toBe('gemini-2.0-flash')
  })
})

describe('applyProviderFlag - github', () => {
  test('sets GAKR_CODE_USE_GITHUB=1', () => {
    const result = applyProviderFlag('github', [])
    expect(result.error).toBeUndefined()
    expect(process.env.GAKR_CODE_USE_GITHUB).toBe('1')
  })
})

describe('applyProviderFlag - bedrock', () => {
  test('sets GAKR_CODE_USE_BEDROCK=1', () => {
    const result = applyProviderFlag('bedrock', [])
    expect(result.error).toBeUndefined()
    expect(process.env.GAKR_CODE_USE_BEDROCK).toBe('1')
  })
})

describe('applyProviderFlag - vertex', () => {
  test('sets GAKR_CODE_USE_VERTEX=1', () => {
    const result = applyProviderFlag('vertex', [])
    expect(result.error).toBeUndefined()
    expect(process.env.GAKR_CODE_USE_VERTEX).toBe('1')
  })
})

describe('applyProviderFlag - ollama', () => {
  test('sets GAKR_CODE_USE_OPENAI=1 with Ollama defaults when unset', () => {
    delete process.env.OPENAI_BASE_URL
    delete process.env.OPENAI_API_KEY

    const result = applyProviderFlag('ollama', [])
    expect(result.error).toBeUndefined()
    expect(process.env.GAKR_CODE_USE_OPENAI).toBe('1')
    expect(process.env.OPENAI_BASE_URL!).toBe('http://localhost:11434/v1')
    expect(process.env.OPENAI_API_KEY!).toBe('ollama')
  })

  test('sets OPENAI_MODEL when --model is provided', () => {
    applyProviderFlag('ollama', ['--model', 'llama3.2'])
    expect(process.env.OPENAI_MODEL).toBe('llama3.2')
  })

  test('does not override existing OPENAI_BASE_URL when user set a custom one', () => {
    process.env.OPENAI_BASE_URL = 'http://my-ollama:11434/v1'
    applyProviderFlag('ollama', [])
    expect(process.env.OPENAI_BASE_URL).toBe('http://my-ollama:11434/v1')
  })

  test('preserves explicit OPENAI_BASE_URL and OPENAI_API_KEY overrides', () => {
    process.env.OPENAI_BASE_URL = 'http://remote-ollama.internal:11434/v1'
    process.env.OPENAI_API_KEY = 'secret-token'

    applyProviderFlag('ollama', [])

    expect(process.env.OPENAI_BASE_URL).toBe('http://remote-ollama.internal:11434/v1')
    expect(process.env.OPENAI_API_KEY).toBe('secret-token')
  })
})

describe('applyProviderFlag - descriptor-backed openai-compatible routes', () => {
  test('deepseek applies generic openai-compatible routing with descriptor defaults', () => {
    const result = applyProviderFlag('deepseek', [])

    expect(result.error).toBeUndefined()
    expect(process.env.GAKR_CODE_USE_OPENAI).toBe('1')
    expect(process.env.OPENAI_BASE_URL).toBe('https://api.deepseek.com/v1')
    expect(process.env.OPENAI_MODEL).toBe('deepseek-v4-pro')
  })

  test('openrouter applies gateway defaults from descriptors', () => {
    const result = applyProviderFlag('openrouter', [])

    expect(result.error).toBeUndefined()
    expect(process.env.GAKR_CODE_USE_OPENAI).toBe('1')
    expect(process.env.OPENAI_BASE_URL).toBe('https://openrouter.ai/api/v1')
  })

  test('clears stale NVIDIA_NIM marker when switching to another OpenAI-compatible route', () => {
    process.env.NVIDIA_NIM = '1'

    const result = applyProviderFlag('openrouter', [])

    expect(result.error).toBeUndefined()
    expect(process.env.GAKR_CODE_USE_OPENAI).toBe('1')
    expect(process.env.NVIDIA_NIM).toBeUndefined()
    expect(process.env.OPENAI_BASE_URL).toBe('https://openrouter.ai/api/v1')
  })

  test('clears NVIDIA_API_KEY copied into OPENAI_API_KEY when switching routes', () => {
    process.env.NVIDIA_API_KEY = 'nvidia-live-key'

    const nvidiaResult = applyProviderFlag('nvidia-nim', [])
    expect(nvidiaResult.error).toBeUndefined()
    expect(process.env.OPENAI_API_KEY).toBe('nvidia-live-key')

    process.env.OPENAI_BASE_URL = 'https://openrouter.ai/api/v1'
    const openrouterResult = applyProviderFlag('openrouter', [])

    expect(openrouterResult.error).toBeUndefined()
    expect(process.env.NVIDIA_NIM).toBeUndefined()
    expect(process.env.OPENAI_API_KEY).toBeUndefined()
    expect(process.env.OPENAI_BASE_URL).toBe('https://openrouter.ai/api/v1')
  })

  test('clears BNKR_API_KEY copied into OPENAI_API_KEY when switching routes', () => {
    process.env.BNKR_API_KEY = 'bankr-live-key'

    const bankrResult = applyProviderFlag('bankr', [])
    expect(bankrResult.error).toBeUndefined()
    expect(process.env.OPENAI_API_KEY).toBe('bankr-live-key')

    process.env.OPENAI_BASE_URL = 'https://openrouter.ai/api/v1'
    const openrouterResult = applyProviderFlag('openrouter', [])

    expect(openrouterResult.error).toBeUndefined()
    expect(process.env.OPENAI_API_KEY).toBeUndefined()
    expect(process.env.OPENAI_BASE_URL).toBe('https://openrouter.ai/api/v1')
  })

  test('clears XAI_API_KEY copied into OPENAI_API_KEY when switching routes', () => {
    process.env.XAI_API_KEY = 'xai-live-key'

    const xaiResult = applyProviderFlag('xai', [])
    expect(xaiResult.error).toBeUndefined()
    expect(process.env.OPENAI_API_KEY).toBe('xai-live-key')

    process.env.OPENAI_BASE_URL = 'https://openrouter.ai/api/v1'
    const openrouterResult = applyProviderFlag('openrouter', [])

    expect(openrouterResult.error).toBeUndefined()
    expect(process.env.OPENAI_API_KEY).toBeUndefined()
    expect(process.env.OPENAI_BASE_URL).toBe('https://openrouter.ai/api/v1')
  })

  test('clears MINIMAX_API_KEY copied into OPENAI_API_KEY when switching routes', () => {
    process.env.MINIMAX_API_KEY = 'minimax-live-key'
    process.env.OPENAI_API_KEY = 'minimax-live-key'
    process.env.XAI_API_KEY = 'xai-live-key'

    const xaiResult = applyProviderFlag('xai', [])

    expect(xaiResult.error).toBeUndefined()
    expect(process.env.OPENAI_API_KEY).toBe('xai-live-key')
    expect(process.env.OPENAI_BASE_URL).toBe('https://api.x.ai/v1')
  })
})

describe('applyProviderFlag - minimax', () => {
  test('preserves MiniMax default base URL and model semantics', () => {
    const result = applyProviderFlag('minimax', [])

    expect(result.error).toBeUndefined()
    expect(process.env.GAKR_CODE_USE_OPENAI).toBe('1')
    expect(process.env.OPENAI_BASE_URL).toBe('https://api.minimax.io/v1')
    expect(process.env.OPENAI_MODEL).toBe('MiniMax-M2.7')
  })
})

describe('applyProviderFlag - nvidia-nim', () => {
  test('maps NVIDIA_API_KEY into the OPENAI-compatible auth env when present', () => {
    process.env.NVIDIA_API_KEY = 'nvidia-live-key'

    const result = applyProviderFlag('nvidia-nim', [])

    expect(result.error).toBeUndefined()
    expect(process.env.GAKR_CODE_USE_OPENAI).toBe('1')
    expect(process.env.NVIDIA_NIM).toBe('1')
    expect(process.env.OPENAI_API_KEY).toBe('nvidia-live-key')
    expect(process.env.OPENAI_BASE_URL).toBe('https://integrate.api.nvidia.com/v1')
  })
})

describe('applyProviderFlag - zai', () => {
  test('preserves Z.AI default base URL and model semantics', () => {
    const result = applyProviderFlag('zai', [])

    expect(result.error).toBeUndefined()
    expect(process.env.GAKR_CODE_USE_OPENAI).toBe('1')
    expect(process.env.OPENAI_BASE_URL).toBe('https://api.z.ai/api/coding/paas/v4')
    expect(process.env.OPENAI_MODEL).toBe('GLM-5.1')
  })
})

describe('applyProviderFlag - xai', () => {
  test('sets GAKR_CODE_USE_OPENAI=1 with xAI defaults when unset', () => {
    delete process.env.OPENAI_BASE_URL
    delete process.env.OPENAI_API_KEY

    const result = applyProviderFlag('xai', [])
    expect(result.error).toBeUndefined()
    expect(process.env.GAKR_CODE_USE_OPENAI).toBe('1')
    expect(process.env.OPENAI_BASE_URL).toBe('https://api.x.ai/v1')
    expect(process.env.OPENAI_MODEL).toBe('grok-4.3')
  })

  test('sets OPENAI_MODEL when --model is provided', () => {
    applyProviderFlag('xai', ['--model', 'grok-3'])
    expect(process.env.OPENAI_MODEL).toBe('grok-3')
  })

  test('propagates XAI_API_KEY to OPENAI_API_KEY when only XAI_API_KEY is set', () => {
    delete process.env.OPENAI_API_KEY
    process.env.XAI_API_KEY = 'xai-secret-key'

    applyProviderFlag('xai', [])

    expect(process.env.OPENAI_API_KEY).toBe('xai-secret-key')
  })

  test('does not override existing OPENAI_API_KEY when both keys are set', () => {
    process.env.OPENAI_API_KEY = 'existing-openai-key'
    process.env.XAI_API_KEY = 'xai-secret-key'

    applyProviderFlag('xai', [])

    expect(process.env.OPENAI_API_KEY).toBe('existing-openai-key')
  })
})

describe('applyProviderFlag - venice', () => {
  test('sets GAKR_CODE_USE_OPENAI=1 with Venice defaults when unset', () => {
    const result = applyProviderFlag('venice', [])

    expect(result.error).toBeUndefined()
    expect(process.env.GAKR_CODE_USE_OPENAI).toBe('1')
    expect(process.env.OPENAI_BASE_URL).toBe('https://api.venice.ai/api/v1')
    expect(process.env.OPENAI_MODEL).toBe('venice-uncensored')
  })

  test('propagates VENICE_API_KEY to OPENAI_API_KEY when only VENICE_API_KEY is set', () => {
    process.env.VENICE_API_KEY = 'venice-live-key'

    const result = applyProviderFlag('venice', [])

    expect(result.error).toBeUndefined()
    expect(process.env.OPENAI_API_KEY).toBe('venice-live-key')
  })
})

describe('applyProviderFlag - xiaomi-mimo', () => {
  test('sets GAKR_CODE_USE_OPENAI=1 with Xiaomi MiMo defaults when unset', () => {
    const result = applyProviderFlag('xiaomi-mimo', [])

    expect(result.error).toBeUndefined()
    expect(process.env.GAKR_CODE_USE_OPENAI).toBe('1')
    expect(process.env.OPENAI_BASE_URL).toBe('https://api.xiaomimimo.com/v1')
    expect(process.env.OPENAI_MODEL).toBe('mimo-v2.5-pro')
  })

  test('propagates MIMO_API_KEY to OPENAI_API_KEY when only MIMO_API_KEY is set', () => {
    process.env.MIMO_API_KEY = 'mimo-live-key'

    const result = applyProviderFlag('xiaomi-mimo', [])

    expect(result.error).toBeUndefined()
    expect(process.env.OPENAI_API_KEY).toBe('mimo-live-key')
  })
})

describe('applyProviderFlag - invalid provider', () => {
  test('returns error for unknown provider', () => {
    const result = applyProviderFlag('unknown-provider', [])
    expect(result.error).toContain('unknown-provider')
    expect(result.error).toContain(VALID_PROVIDERS.join(', '))
  })
})

describe('applyProviderFlagFromArgs', () => {
  test('applies ollama provider and model from argv in one step', () => {
    delete process.env.OPENAI_BASE_URL
    delete process.env.OPENAI_API_KEY

    const result = applyProviderFlagFromArgs([
      '--provider',
      'ollama',
      '--model',
      'qwen2.5:3b',
    ])

    expect(result?.error).toBeUndefined()
    expect(process.env.GAKR_CODE_USE_OPENAI).toBe('1')
    expect(process.env.OPENAI_BASE_URL!).toBe('http://localhost:11434/v1')
    expect(process.env.OPENAI_API_KEY!).toBe('ollama')
    expect(process.env.OPENAI_MODEL).toBe('qwen2.5:3b')
  })

  test('returns undefined when --provider is absent', () => {
    expect(applyProviderFlagFromArgs(['--model', 'gpt-4o'])).toBeUndefined()
  })
})

// --- parseModelFlag ---

describe('parseModelFlag', () => {
  test('returns model value when --model is present', () => {
    expect(parseModelFlag(['--model', 'gpt-4o-mini'])).toBe('gpt-4o-mini')
  })

  test('returns null when --model is absent', () => {
    expect(parseModelFlag(['--provider', 'openai'])).toBeNull()
  })

  test('returns null when --model has no value', () => {
    expect(parseModelFlag(['--model'])).toBeNull()
  })

  test('returns null when --model value looks like another flag', () => {
    expect(parseModelFlag(['--model', '--provider'])).toBeNull()
  })
})

// --- applyModelFlagFromArgs ---

describe('applyModelFlagFromArgs', () => {
  test('is a no-op when --model is absent', () => {
    applyModelFlagFromArgs(['--ide'])

    expect(process.env.OPENAI_MODEL).toBeUndefined()
    expect(process.env.GEMINI_MODEL).toBeUndefined()
    expect(process.env.MISTRAL_MODEL).toBeUndefined()
    expect(process.env.ANTHROPIC_MODEL).toBeUndefined()
  })

  test('is a no-op when --provider is also present', () => {
    process.env.GAKR_CODE_USE_OPENAI = '1'

    applyModelFlagFromArgs(['--provider', 'openai', '--model', 'gpt-4o'])

    expect(process.env.OPENAI_MODEL).toBeUndefined()
  })

  test('sets OPENAI_MODEL when OpenAI-compatible mode is active', () => {
    process.env.GAKR_CODE_USE_OPENAI = '1'

    applyModelFlagFromArgs(['--model', 'gpt-4o-mini'])

    expect(process.env.OPENAI_MODEL).toBe('gpt-4o-mini')
  })

  test('sets GEMINI_MODEL when Gemini mode is active', () => {
    process.env.GAKR_CODE_USE_GEMINI = '1'

    applyModelFlagFromArgs(['--model', 'gemini-2.0-flash'])

    expect(process.env.GEMINI_MODEL).toBe('gemini-2.0-flash')
  })

  test('sets MISTRAL_MODEL when Mistral mode is active', () => {
    process.env.GAKR_CODE_USE_MISTRAL = '1'

    applyModelFlagFromArgs(['--model', 'devstral-latest'])

    expect(process.env.MISTRAL_MODEL).toBe('devstral-latest')
  })

  test('sets OPENAI_MODEL when GitHub mode is active', () => {
    process.env.GAKR_CODE_USE_GITHUB = '1'

    applyModelFlagFromArgs(['--model', 'gpt-4.1'])

    expect(process.env.OPENAI_MODEL).toBe('gpt-4.1')
  })

  test('sets NVIDIA_MODEL when dedicated NVIDIA mode is active', () => {
    process.env.GAKR_CODE_USE_NVIDIA = '1'

    applyModelFlagFromArgs(['--model', 'nvidia/custom-model'])

    expect(process.env.NVIDIA_MODEL).toBe('nvidia/custom-model')
    expect(process.env.OPENAI_MODEL).toBe('nvidia/custom-model')
  })

  test('falls back to ANTHROPIC_MODEL when no provider mode is active', () => {
    applyModelFlagFromArgs(['--model', 'claude-sonnet-4-6'])

    expect(process.env.ANTHROPIC_MODEL).toBe('claude-sonnet-4-6')
  })

  test('overrides an existing profile model value for the process', () => {
    process.env.GAKR_CODE_USE_OPENAI = '1'
    process.env.OPENAI_MODEL = 'gpt-4o'

    applyModelFlagFromArgs(['--model', 'gpt-4o-mini'])

    expect(process.env.OPENAI_MODEL).toBe('gpt-4o-mini')
  })

  test('accepts model values containing colons', () => {
    process.env.GAKR_CODE_USE_OPENAI = '1'

    applyModelFlagFromArgs(['--model', 'qwen2.5-coder:14b'])

    expect(process.env.OPENAI_MODEL).toBe('qwen2.5-coder:14b')
  })
})
