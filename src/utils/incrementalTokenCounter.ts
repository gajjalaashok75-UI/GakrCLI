/**
 * High-performance token counter with content-aware cache invalidation.
 */

import { createHash } from 'node:crypto'
import {
  roughTokenCountEstimation,
  roughTokenCountEstimationForMessages,
} from '../services/tokenEstimation.js'
import type { Message } from '../types/message.js'

export interface IncrementalCounterConfig {
  /** Token budget for context limit decisions, such as a model context window. */
  tokenBudget?: number
  /** Enable append-only incremental counting when the previous prefix is unchanged. */
  autoInvalidate?: boolean
  /** Custom estimation multiplier. */
  estimationMultiplier?: number
}

export interface CounterStats {
  hits: number
  misses: number
  totalTokens: number
  averageTokens: number
  hitRate: number
}

function contentForHash(message: Message): string {
  const content = message.message?.content
  if (typeof content === 'string') return content
  if (Array.isArray(content)) return JSON.stringify(content)
  return JSON.stringify(content ?? '')
}

/**
 * Hashes all message content so same-length edits and prefix mutations cannot
 * reuse stale cached token counts.
 */
function getMessageHash(messages: readonly Message[]): string {
  if (messages.length === 0) return 'empty'

  const fullContent = messages
    .map(message => contentForHash(message))
    .join('\u001f')

  return createHash('sha256').update(fullContent).digest('hex').slice(0, 16)
}

/**
 * Incremental token counter optimized for repeatedly estimating growing
 * conversations. It falls back to full recalculation whenever cached prefix
 * content no longer matches.
 */
export class IncrementalTokenCounter {
  private lastMessageCount = 0
  private lastTokenCount = 0
  private lastFullHash = ''
  private config: Required<IncrementalCounterConfig>
  private stats = {
    hits: 0,
    misses: 0,
    totalTokens: 0,
  }

  constructor(config: IncrementalCounterConfig = {}) {
    this.config = {
      tokenBudget: config.tokenBudget ?? 100_000,
      autoInvalidate: config.autoInvalidate ?? true,
      estimationMultiplier: config.estimationMultiplier ?? 1,
    }
  }

  getCount(messages: readonly Message[]): number {
    if (messages.length === 0) {
      this.reset()
      return 0
    }

    const fullHash = getMessageHash(messages)

    if (
      messages.length === this.lastMessageCount &&
      fullHash === this.lastFullHash
    ) {
      this.stats.hits++
      this.stats.totalTokens += this.lastTokenCount
      return this.lastTokenCount
    }

    this.stats.misses++

    const canAppendIncrementally =
      this.config.autoInvalidate &&
      this.lastMessageCount > 0 &&
      messages.length > this.lastMessageCount &&
      this.lastFullHash.length > 0

    if (canAppendIncrementally) {
      const currentPrefixHash = getMessageHash(
        messages.slice(0, this.lastMessageCount),
      )

      if (currentPrefixHash === this.lastFullHash) {
        const newMessages = messages.slice(this.lastMessageCount)
        const estimated = Math.round(
          roughTokenCountEstimationForMessages(newMessages) *
            this.config.estimationMultiplier,
        )
        this.lastTokenCount += estimated
      } else {
        this.lastTokenCount = this.estimate(messages)
      }
    } else {
      this.lastTokenCount = this.estimate(messages)
    }

    this.lastMessageCount = messages.length
    this.lastFullHash = fullHash
    this.stats.totalTokens += this.lastTokenCount

    return this.lastTokenCount
  }

  invalidate(messages: readonly Message[]): number {
    this.lastMessageCount = messages.length
    this.lastFullHash = getMessageHash(messages)
    this.lastTokenCount =
      messages.length === 0 ? 0 : roughTokenCountEstimationForMessages(messages)

    this.stats.totalTokens += this.lastTokenCount
    this.stats.misses++

    return this.lastTokenCount
  }

  estimate(messages: readonly Message[]): number {
    return roughTokenCountEstimationForMessages(messages)
  }

  estimateMessage(message: Message): number {
    const content = message.message?.content
    if (typeof content === 'string') {
      return roughTokenCountEstimation(content)
    }
    if (Array.isArray(content)) {
      return content.reduce((sum, block) => {
        if ('text' in block) {
          return sum + roughTokenCountEstimation(block.text || '')
        }
        if ('thinking' in block) {
          return sum + roughTokenCountEstimation(block.thinking || '')
        }
        return sum + 100
      }, 0)
    }
    return 100
  }

  estimateBatch(messages: readonly Message[]): number {
    return messages.reduce((sum, message) => sum + this.estimateMessage(message), 0)
  }

  getRemainingBudget(
    messages: readonly Message[],
    contextWindow: number,
  ): number {
    return Math.max(0, contextWindow - this.getCount(messages))
  }

  isApproachingLimit(
    messages: readonly Message[],
    threshold: number = 0.8,
  ): boolean {
    const count =
      this.lastMessageCount === messages.length &&
      this.lastFullHash === getMessageHash(messages)
        ? this.lastTokenCount
        : this.getCount(messages)

    return count / this.config.tokenBudget > threshold
  }

  reset(): void {
    this.lastMessageCount = 0
    this.lastTokenCount = 0
    this.lastFullHash = ''
    this.stats = { hits: 0, misses: 0, totalTokens: 0 }
  }

  get cachedCount(): number {
    return this.lastTokenCount
  }

  get messageCount(): number {
    return this.lastMessageCount
  }

  getStats(): CounterStats {
    const total = this.stats.hits + this.stats.misses
    return {
      hits: this.stats.hits,
      misses: this.stats.misses,
      totalTokens: this.stats.totalTokens,
      averageTokens: total > 0 ? Math.round(this.stats.totalTokens / total) : 0,
      hitRate: total > 0 ? Math.round((this.stats.hits / total) * 100) : 0,
    }
  }

  updateConfig(config: Partial<IncrementalCounterConfig>): void {
    this.config = {
      ...this.config,
      ...config,
      tokenBudget: config.tokenBudget ?? this.config.tokenBudget,
      autoInvalidate: config.autoInvalidate ?? this.config.autoInvalidate,
      estimationMultiplier:
        config.estimationMultiplier ?? this.config.estimationMultiplier,
    }
  }
}

export const CounterFactory = {
  realtime(): IncrementalTokenCounter {
    return new IncrementalTokenCounter({
      tokenBudget: 50_000,
      autoInvalidate: true,
      estimationMultiplier: 1.1,
    })
  },

  batch(): IncrementalTokenCounter {
    return new IncrementalTokenCounter({
      tokenBudget: 200_000,
      autoInvalidate: false,
      estimationMultiplier: 1,
    })
  },

  lightweight(): IncrementalTokenCounter {
    return new IncrementalTokenCounter({
      tokenBudget: 10_000,
      autoInvalidate: true,
      estimationMultiplier: 1.2,
    })
  },
}
