import { describe, it, expect } from 'vitest'
import { stableStringify } from '../../utils/stableStringify.js'

/**
 * Integration test verifying that stableStringify produces deterministic
 * request bodies for OpenAI/Codex API calls, ensuring prefix cache hits.
 */
describe('stableStringify integration with API shims', () => {
  it('produces identical bytes for OpenAI chat completion bodies with different key orders', () => {
    // Simulate spread-merged request body (common pattern in openaiShim.ts)
    const base = {
      model: 'gpt-4',
      messages: [{ role: 'user', content: 'Hello' }],
    }
    const options = {
      temperature: 0.7,
      max_tokens: 1000,
      stream: true,
    }

    // Different spread orders
    const body1 = { ...base, ...options }
    const body2 = { ...options, ...base }

    const serialized1 = stableStringify(body1)
    const serialized2 = stableStringify(body2)

    // Should be byte-identical despite different insertion order
    expect(serialized1).toBe(serialized2)
    expect(serialized1).toContain('"max_tokens":1000')
    expect(serialized1).toContain('"messages":[')
    expect(serialized1).toContain('"model":"gpt-4"')
    expect(serialized1).toContain('"stream":true')
    expect(serialized1).toContain('"temperature":0.7')
  })

  it('produces identical bytes for Codex Responses API bodies with different key orders', () => {
    // Simulate Codex request body (from codexShim.ts)
    const body1 = {
      model: 'codexplan',
      input: [
        {
          type: 'message',
          role: 'user',
          content: [{ type: 'input_text', text: 'Hello' }],
        },
      ],
      store: false,
      stream: true,
      instructions: 'You are helpful',
    }

    const body2 = {
      stream: true,
      instructions: 'You are helpful',
      model: 'codexplan',
      store: false,
      input: [
        {
          content: [{ text: 'Hello', type: 'input_text' }],
          role: 'user',
          type: 'message',
        },
      ],
    }

    const serialized1 = stableStringify(body1)
    const serialized2 = stableStringify(body2)

    // Should be byte-identical
    expect(serialized1).toBe(serialized2)
  })

  it('handles complex nested tool schemas with sorted keys', () => {
    const toolBody = {
      model: 'gpt-4',
      messages: [{ role: 'user', content: 'test' }],
      tools: [
        {
          type: 'function',
          function: {
            name: 'get_weather',
            description: 'Get weather info',
            parameters: {
              type: 'object',
              properties: {
                location: { type: 'string', description: 'City name' },
                units: { type: 'string', enum: ['celsius', 'fahrenheit'] },
              },
              required: ['location'],
            },
          },
        },
      ],
    }

    const result = stableStringify(toolBody)

    // Verify nested keys are sorted
    expect(result).toContain('"description":"Get weather info"')
    expect(result).toContain('"name":"get_weather"')
    expect(result).toContain('"parameters":{')
    expect(result).toContain('"properties":{')
    expect(result).toContain('"required":["location"]')
    expect(result).toContain('"type":"object"')
  })

  it('ensures cache hit for repeated requests with same semantic content', () => {
    const request = {
      model: 'gpt-4',
      messages: [
        { role: 'system', content: 'You are helpful' },
        { role: 'user', content: 'Hello' },
      ],
      temperature: 0.7,
      max_tokens: 1000,
    }

    // Serialize multiple times
    const results = Array.from({ length: 5 }, () => stableStringify(request))

    // All should be identical
    const unique = new Set(results)
    expect(unique.size).toBe(1)
  })

  it('produces different output when content actually differs', () => {
    const request1 = {
      model: 'gpt-4',
      messages: [{ role: 'user', content: 'Hello' }],
    }

    const request2 = {
      model: 'gpt-4',
      messages: [{ role: 'user', content: 'Hi' }],
    }

    expect(stableStringify(request1)).not.toBe(stableStringify(request2))
  })

  it('handles Anthropic cache_control breakpoints with sorted keys', () => {
    const body = {
      model: 'claude-3-5-sonnet-20241022',
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: 'Long context',
              cache_control: { type: 'ephemeral' },
            },
          ],
        },
      ],
      max_tokens: 1024,
    }

    const result = stableStringify(body)

    // Verify cache_control is properly serialized with sorted keys
    expect(result).toContain('"cache_control":{"type":"ephemeral"}')
    expect(result).toContain('"max_tokens":1024')
    expect(result).toContain('"messages":[')
    expect(result).toContain('"model":"claude-3-5-sonnet-20241022"')
  })
})
