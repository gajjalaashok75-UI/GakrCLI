import { describe, expect, test } from 'bun:test'
import type { Message } from '../types/message.js'
import {
  getIncrementalTokenCounter,
  getTokenCountFromUsage,
  tokenCountWithEstimation,
} from './tokens.js'

function userMessage(content: string): Message {
  return {
    type: 'user',
    message: {
      role: 'user',
      content,
    },
  } as Message
}

function assistantWithUsage(id: string): Message {
  return {
    type: 'assistant',
    message: {
      id,
      model: 'test-model',
      role: 'assistant',
      content: [{ type: 'text', text: 'ok' }],
      usage: {
        input_tokens: 100,
        output_tokens: 20,
        cache_creation_input_tokens: 10,
        cache_read_input_tokens: 30,
      },
    },
  } as Message
}

describe('tokens', () => {
  test('counts cache tokens from usage', () => {
    expect(
      getTokenCountFromUsage({
        input_tokens: 100,
        output_tokens: 20,
        cache_creation_input_tokens: 10,
        cache_read_input_tokens: 30,
      }),
    ).toBe(160)
  })

  test('exposes the shared incremental token counter', () => {
    expect(getIncrementalTokenCounter()).toBe(getIncrementalTokenCounter())
  })

  test('tokenCountWithEstimation uses usage baseline plus new message estimate', () => {
    getIncrementalTokenCounter().reset()

    const count = tokenCountWithEstimation([
      userMessage('hello'),
      assistantWithUsage('response-1'),
      userMessage('new message after response'),
    ])

    expect(count).toBeGreaterThan(160)
  })

  test('tokenCountWithEstimation counts all messages when no usage exists', () => {
    getIncrementalTokenCounter().reset()

    expect(
      tokenCountWithEstimation([
        userMessage('first message'),
        userMessage('second message'),
      ]),
    ).toBeGreaterThan(0)
  })
})
