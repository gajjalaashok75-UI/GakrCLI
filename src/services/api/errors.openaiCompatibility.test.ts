import { APIError } from '@anthropic-ai/sdk'
import { afterEach, beforeEach, expect, test } from 'bun:test'

import { getAssistantMessageFromError } from './errors.js'
import {
  acquireSharedMutationLock,
  releaseSharedMutationLock,
} from '../../test/sharedMutationLock.js'

const SAVED_ENV = {
  GAKR_CODE_USE_OPENAI: process.env.GAKR_CODE_USE_OPENAI,
  OPENAI_BASE_URL: process.env.OPENAI_BASE_URL,
  OPENAI_MODEL: process.env.OPENAI_MODEL,
  XAI_CREDENTIAL_SOURCE: process.env.XAI_CREDENTIAL_SOURCE,
  XAI_API_KEY: process.env.XAI_API_KEY,
}
let lockAcquired = false

beforeEach(async () => {
  await acquireSharedMutationLock('services/api/errors.openaiCompatibility.test.ts')
  lockAcquired = true
})

afterEach(() => {
  try {
    for (const [key, value] of Object.entries(SAVED_ENV)) {
      if (value === undefined) {
        delete process.env[key]
      } else {
        process.env[key] = value
      }
    }
  } finally {
    if (lockAcquired) {
      releaseSharedMutationLock()
      lockAcquired = false
    }
  }
})

function getFirstText(message: ReturnType<typeof getAssistantMessageFromError>): string {
  const first = message.message.content[0]
  if (!first || typeof first !== 'object' || !('text' in first)) {
    return ''
  }
  return typeof first.text === 'string' ? first.text : ''
}

test('maps endpoint_not_found category markers to actionable setup guidance', () => {
  const error = APIError.generate(
    404,
    undefined,
    'OpenAI API error 404: Not Found [openai_category=endpoint_not_found] Hint: Confirm OPENAI_BASE_URL includes /v1.',
    new Headers(),
  )

  const message = getAssistantMessageFromError(error, 'qwen2.5-coder:7b')
  const text = getFirstText(message)

  expect(message.isApiErrorMessage).toBe(true)
  expect(text).toContain('Provider endpoint was not found')
  expect(text).toContain('OPENAI_BASE_URL')
  expect(text).toContain('/v1')
})

test('endpoint_not_found from a remote host shows the actual host, not Ollama (issue #926)', () => {
  const error = APIError.generate(
    404,
    undefined,
    'OpenAI API error 404: Not Found [openai_category=endpoint_not_found,host=integrate.api.nvidia.com] Hint: Endpoint at integrate.api.nvidia.com returned 404.',
    new Headers(),
  )

  const message = getAssistantMessageFromError(error, 'moonshotai/kimi-k2.5-thinking')
  const text = getFirstText(message)

  expect(text).toContain('integrate.api.nvidia.com')
  expect(text).toContain('moonshotai/kimi-k2.5-thinking')
  expect(text).not.toContain('Ollama')
  expect(text).not.toContain('11434')
})

test('endpoint_not_found without a host falls back to the Ollama-aware message', () => {
  const error = APIError.generate(
    404,
    undefined,
    'OpenAI API error 404: Not Found [openai_category=endpoint_not_found] Hint: Confirm OPENAI_BASE_URL includes /v1.',
    new Headers(),
  )

  const message = getAssistantMessageFromError(error, 'qwen2.5-coder:7b')
  const text = getFirstText(message)

  expect(text).toContain('Provider endpoint was not found')
  expect(text).toContain('Ollama')
})

test('maps tool_call_incompatible category markers to model/tool guidance', () => {
  const error = APIError.generate(
    400,
    undefined,
    'OpenAI API error 400: tool_calls are not supported [openai_category=tool_call_incompatible]',
    new Headers(),
  )

  const message = getAssistantMessageFromError(error, 'qwen2.5-coder:7b')
  const text = getFirstText(message)

  expect(text).toContain('rejected tool-calling payloads')
  expect(text).toContain('/model')
})

test('maps 500 context overflow responses to new-session guidance', () => {
  const error = APIError.generate(
    500,
    undefined,
    'request too large: maximum context length exceeded',
    new Headers(),
  )

  const message = getAssistantMessageFromError(error, 'qwen2.5-coder:7b')
  const text = getFirstText(message)

  expect(message.isApiErrorMessage).toBe(true)
  expect(message.errorDetails).toContain('Context overflow (500)')
  expect(text).toContain('The conversation has grown too large')
  expect(text).toContain('/new')
})

test('xAI OAuth entitlement failures do not suggest /login', () => {
  process.env.GAKR_CODE_USE_OPENAI = '1'
  process.env.OPENAI_BASE_URL = 'https://api.x.ai/v1'
  process.env.OPENAI_MODEL = 'grok-4.3'
  process.env.XAI_CREDENTIAL_SOURCE = 'oauth'
  delete process.env.XAI_API_KEY

  const error = APIError.generate(
    403,
    {
      code: 'The caller does not have permission to execute the specified operation',
      error:
        'You have run out of credits or need a Grok subscription. [WKE=personal-team-blocked:spending-limit]',
    },
    '403 {"code":"The caller does not have permission to execute the specified operation","error":"You have run out of credits or need a Grok subscription. [WKE=personal-team-blocked:spending-limit]"}',
    new Headers(),
  )

  const message = getAssistantMessageFromError(error, 'grok-4.3')
  const text = getFirstText(message)

  expect(text).toContain('xAI rejected the request')
  expect(text).toContain('credits')
  expect(text).toContain('/provider')
  expect(text).not.toContain('/login')
})

test('vision_not_supported shows image-specific guidance for remote host', () => {
  const error = APIError.generate(
    404,
    undefined,
    'OpenAI API error 404: Not Found [openai_category=vision_not_supported,host=opengateway.gitlawb.com] Hint: The provider returned 404 for a request containing images.',
    new Headers(),
  )

  const message = getAssistantMessageFromError(error, 'mimo-v2.5-pro')
  const text = getFirstText(message)

  expect(message.isApiErrorMessage).toBe(true)
  expect(text).toContain('images')
  expect(text).toContain('mimo-v2.5-pro')
  expect(text).toContain('opengateway.gitlawb.com')
  expect(text).not.toContain('OPENAI_BASE_URL')
})
