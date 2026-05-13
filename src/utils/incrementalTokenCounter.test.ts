import { beforeEach, describe, expect, test } from 'bun:test'
import type { Message } from '../types/message.js'
import {
  CounterFactory,
  IncrementalTokenCounter,
} from './incrementalTokenCounter.js'

function createMessage(content: string): Message {
  return {
    type: 'user',
    message: {
      role: 'user',
      content,
    },
  } as Message
}

describe('IncrementalTokenCounter', () => {
  let counter: IncrementalTokenCounter

  beforeEach(() => {
    counter = new IncrementalTokenCounter()
  })

  test('returns 0 for empty messages', () => {
    expect(counter.getCount([])).toBe(0)
  })

  test('calculates count for new messages', () => {
    expect(counter.getCount([createMessage('Hello world')])).toBeGreaterThan(0)
  })

  test('uses cache when message content is unchanged', () => {
    const messages = [createMessage('Hello world')]

    const count1 = counter.getCount(messages)
    const count2 = counter.getCount(messages)

    expect(count2).toBe(count1)
    expect(counter.getStats().hits).toBe(1)
  })

  test('recalculates when same-length content changes', () => {
    const count1 = counter.getCount([createMessage('aaaa bbbb cccc')])
    const count2 = counter.getCount([
      createMessage('zzzz yyyy xxxx qqqq rrrr ssss'),
    ])

    expect(count2).toBeGreaterThan(count1)
    expect(counter.getStats().misses).toBe(2)
  })

  test('increments when prefix is unchanged and message is appended', () => {
    const messages = [
      createMessage('First message'),
      createMessage('Second message'),
    ]
    const count1 = counter.getCount(messages)
    const count2 = counter.getCount([
      ...messages,
      createMessage('Third message appended'),
    ])

    expect(count2).toBeGreaterThan(count1)
  })

  test('fully recalculates when prefix mutates before append', () => {
    const messages = [
      createMessage('First message content'),
      createMessage('Second message content'),
    ]
    counter.getCount(messages)

    const mutated = [
      createMessage('Mutated first message content changed'),
      messages[1]!,
      createMessage('Third message appended'),
    ]

    const count = counter.getCount(mutated)
    const fullCount = counter.invalidate(mutated)

    expect(count).toBe(fullCount)
  })

  test('invalidates from full context on demand', () => {
    const messages = [createMessage('Test message')]

    const count = counter.invalidate(messages)

    expect(count).toBeGreaterThan(0)
    expect(counter.cachedCount).toBe(count)
  })

  test('uses tokenBudget for approaching-limit checks', () => {
    const tinyBudgetCounter = new IncrementalTokenCounter({ tokenBudget: 10 })
    const messages = [
      createMessage(
        'This is intentionally a longer message so the rough estimate crosses the tiny budget.',
      ),
    ]

    expect(tinyBudgetCounter.isApproachingLimit(messages, 0.5)).toBe(true)
  })

  test('updates config dynamically', () => {
    counter.updateConfig({ tokenBudget: 10 })

    expect(
      counter.isApproachingLimit([
        createMessage('A longer message that crosses a tiny budget.'),
      ]),
    ).toBe(true)
  })

  test('factory methods create counters', () => {
    expect(CounterFactory.realtime()).toBeInstanceOf(IncrementalTokenCounter)
    expect(CounterFactory.batch()).toBeInstanceOf(IncrementalTokenCounter)
    expect(CounterFactory.lightweight()).toBeInstanceOf(IncrementalTokenCounter)
  })
})
