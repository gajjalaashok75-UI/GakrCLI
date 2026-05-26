import { afterAll, beforeEach, expect, mock, test } from 'bun:test'

import {
  acquireSharedMutationLock,
  releaseSharedMutationLock,
} from '../../test/sharedMutationLock.js'

let responseText = ''

const queryModelWithoutStreaming = mock(async () => ({
  message: {
    content: [{ type: 'text', text: responseText }],
  },
}))

await acquireSharedMutationLock('components/agents/generateAgent.test.ts')

mock.module('src/context.js', () => ({
  getUserContext: async () => ({}),
}))

mock.module('src/services/api/gakrcli.js', () => ({
  queryModelWithoutStreaming,
}))

mock.module('../../memdir/paths.js', () => ({
  isAutoMemoryEnabled: () => false,
}))

mock.module('../../services/analytics/index.js', () => ({
  logEvent: mock(() => {}),
}))

// @ts-expect-error cache-busting query string for Bun module mocks
const { generateAgent } = await import('./generateAgent.ts?test')

beforeEach(() => {
  responseText = ''
  queryModelWithoutStreaming.mockClear()
})

afterAll(() => {
  try {
    mock.restore()
  } finally {
    releaseSharedMutationLock()
  }
})

test('returns generated agents with string fields', async () => {
  responseText = JSON.stringify({
    identifier: 'code-reviewer',
    whenToUse: 'Use this agent when code needs review.',
    systemPrompt: 'You are a careful code reviewer.',
  })

  await expect(
    generateAgent('review code', 'gpt-5.4' as never, [], new AbortController().signal),
  ).resolves.toEqual({
    identifier: 'code-reviewer',
    whenToUse: 'Use this agent when code needs review.',
    systemPrompt: 'You are a careful code reviewer.',
  })
})

test('rejects generated agents with non-string required fields', async () => {
  responseText = JSON.stringify({
    identifier: 'bad-agent',
    whenToUse: ['Use this agent when arrays sneak in.'],
    systemPrompt: 'You are malformed.',
  })

  await expect(
    generateAgent('make a bad agent', 'gpt-5.4' as never, [], new AbortController().signal),
  ).rejects.toThrow(
    'Invalid agent configuration generated: identifier, whenToUse, and systemPrompt must be non-empty strings',
  )
})
