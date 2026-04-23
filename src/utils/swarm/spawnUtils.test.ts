import assert from 'node:assert/strict'
import test from 'node:test'

import { buildInheritedEnvVars } from './spawnUtils.ts'

const NVIDIA_ENV_KEYS = [
  'GAKR_CODE_USE_NVIDIA',
  'NVIDIA_API_KEY',
  'NVIDIA_BASE_URL',
  'NVIDIA_MODEL',
] as const

test('buildInheritedEnvVars forwards nvidia provider env vars for teammates', () => {
  const previous = Object.fromEntries(
    NVIDIA_ENV_KEYS.map(key => [key, process.env[key]]),
  )

  process.env.GAKR_CODE_USE_NVIDIA = '1'
  process.env.NVIDIA_API_KEY = 'nvapi-test'
  process.env.NVIDIA_BASE_URL = 'https://integrate.api.nvidia.com/v1'
  process.env.NVIDIA_MODEL = 'meta/llama-3.1-70b-instruct'

  try {
    const envVars = buildInheritedEnvVars()

    assert.match(envVars, /\bGAKR_CODE_USE_NVIDIA=1\b/)
    assert.match(envVars, /NVIDIA_API_KEY=.*nvapi-test/)
    assert.match(envVars, /NVIDIA_BASE_URL=.*integrate\.api\.nvidia\.com\/v1/)
    assert.match(envVars, /NVIDIA_MODEL=.*meta\/llama-3\.1-70b-instruct/)
  } finally {
    for (const key of NVIDIA_ENV_KEYS) {
      const value = previous[key]
      if (value === undefined) {
        delete process.env[key]
      } else {
        process.env[key] = value
      }
    }
  }
})
