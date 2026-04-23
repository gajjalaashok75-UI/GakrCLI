/**
 * Self-Improvement Metrics Collector
 *
 * Collects runtime metrics for analysis and recommendation generation.
 * Integrates with existing OpenTelemetry infrastructure.
 */

import { feature } from 'bun:bundle'
import { randomUUID } from 'crypto'
import type { Attributes } from '@opentelemetry/api'
import { logForDebugging } from '../../utils/debug.js'

// Metric types we track
export enum MetricType {
  // Performance
  API_LATENCY_MS = 'api_latency_ms',
  TOOL_DURATION_MS = 'tool_duration_ms',
  TURN_DURATION_MS = 'turn_duration_ms',

  // Usage
  TOKEN_COUNT = 'token_count',
  TOKENS_INPUT = 'tokens_input',
  TOKENS_OUTPUT = 'tokens_output',
  CONTEXT_TOKENS_USED = 'context_tokens_used',
  CONTEXT_TOKENS_WASTED = 'context_tokens_wasted',

  // Quality
  SUCCESS = 'success',
  ERROR_COUNT = 'error_count',
  RETRY_COUNT = 'retry_count',

  // Cost
  COST_USD = 'cost_usd',

  // User interaction
  INTERRUPTION = 'interruption',
  USER_CORRECTION = 'user_correction',

  // Efficiency
  FILE_READ_COUNT = 'file_read_count',
  TOOL_USE_COUNT = 'tool_use_count',
}

// Single metric observation
export interface MetricObservation {
  id: string
  sessionId: string
  timestamp: Date
  type: MetricType
  value: number
  tags: Record<string, string> // key-value pairs for categorization
}

// Session aggregate
export interface SessionMetrics {
  sessionId: string
  startTime: Date
  endTime?: Date
  observations: MetricObservation[]
  aggregates: Record<MetricType, Aggregate>
}

interface Aggregate {
  count: number
  sum: number
  min?: number
  max?: number
  avg: number
}

class MetricsCollector {
  private sessionId: string
  private sessionStart: Date
  private observations: MetricObservation[] = []
  private aggregates: Record<MetricType, Aggregate> = {}

  constructor(sessionId?: string) {
    this.sessionId = sessionId || randomUUID()
    this.sessionStart = new Date()
  }

  /**
   * Record a single metric observation
   */
  observe(type: MetricType, value: number, tags: Record<string, string> = {}): void {
    const observation: MetricObservation = {
      id: randomUUID(),
      sessionId: this.sessionId,
      timestamp: new Date(),
      type,
      value,
      tags,
    }

    this.observations.push(observation)
    this.updateAggregate(type, value)

    // Send to telemetry if feature enabled
    if (feature('IMPROVEMENT_METRICS')) {
      this.sendToTelemetry(observation)
    }
  }

  /**
   * Record a duration (measures time between start and end)
   */
  async measureDuration<T>(
    type: MetricType,
    fn: () => Promise<T>,
    tags: Record<string, string> = {},
  ): Promise<T> {
    const start = Date.now()
    try {
      const result = await fn()
      const duration = Date.now() - start
      this.observe(type, duration, tags)
      return result
    } catch (error) {
      const duration = Date.now() - start
      this.observe(type, duration, { ...tags, error: 'true' })
      throw error
    }
  }

  /**
   * Record success/failure outcome
   */
  recordOutcome(success: boolean, tags: Record<string, string> = {}): void {
    this.observe(MetricType.SUCCESS, success ? 1 : 0, tags)
    if (!success) {
      this.observe(MetricType.ERROR_COUNT, 1, tags)
    }
  }

  /**
   * Record token usage from API response
   */
  recordTokenUsage(inputTokens: number, outputTokens: number, tags: Record<string, string> = {}): void {
    this.observe(MetricType.TOKENS_INPUT, inputTokens, tags)
    this.observe(MetricType.TOKENS_OUTPUT, outputTokens, tags)
    this.observe(MetricType.TOKEN_COUNT, inputTokens + outputTokens, tags)

    // Calculate context waste (approximate)
    // In production, this would compare to actual context window used
    const contextWindow = this.getContextWindowForTags(tags)
    if (contextWindow) {
      const wasted = Math.max(0, contextWindow - (inputTokens + outputTokens))
      this.observe(MetricType.CONTEXT_TOKENS_WASTED, wasted, tags)
    }
  }

  /**
   * Record cost in USD
   */
  recordCost(cents: number, tags: Record<string, string> = {}): void {
    this.observe(MetricType.COST_USD, cents / 100, tags)
  }

  /**
   * Get current session metrics summary
   */
  getSessionSummary(): SessionMetrics {
    return {
      sessionId: this.sessionId,
      startTime: this.sessionStart,
      endTime: new Date(),
      observations: [...this.observations],
      aggregates: { ...this.aggregates },
    }
  }

  /**
   * Export observations for analysis
   */
  exportObservations(): MetricObservation[] {
    return [...this.observations]
  }

  /**
   * Clear collected data (for testing or privacy)
   */
  clear(): void {
    this.observations = []
    this.aggregates = {}
  }

  private updateAggregate(type: MetricType, value: number): void {
    const agg = this.aggregates[type]
    if (!agg) {
      this.aggregates[type] = {
        count: 1,
        sum: value,
        min: value,
        max: value,
        avg: value,
      }
    } else {
      agg.count++
      agg.sum += value
      agg.min = Math.min(agg.min ?? Infinity, value)
      agg.max = Math.max(agg.max ?? -Infinity, value)
      agg.avg = agg.sum / agg.count
    }
  }

  private sendToTelemetry(observation: MetricObservation): void {
    // Hook into existing OpenTelemetry/Metrics system
    // This is a placeholder - actual implementation would use the telemetry SDK
    const attrs: Attributes = {
      'metric.type': observation.type,
      'metric.value': observation.value,
      'session.id': observation.sessionId,
      ...observation.tags as any,
    }

    // Example: telemetryMeter?.createObservableGauge(...)
    // For now, just debug log
    if (observation.type === MetricType.API_LATENCY_MS && observation.value > 5000) {
      logForDebugging(`[Metrics] Slow API: ${observation.value}ms`, observation.tags)
    }
  }

  private getContextWindowForTags(tags: Record<string, string>): number | undefined {
    // Would lookup model-specific context window from configuration
    const model = tags.model || tags.mainLoopModel
    if (!model) return undefined

    // Placeholder - would integrate with getContextWindowForModel
    const contextWindows: Record<string, number> = {
      'claude-3-opus': 200000,
      'claude-3.5-sonnet': 200000,
      'claude-3-haiku': 200000,
      'gpt-4': 128000,
      'gpt-4-turbo': 128000,
    }
    return contextWindows[model]
  }
}

// Singleton per session
let globalCollector: MetricsCollector | null = null

export function getMetricsCollector(): MetricsCollector {
  if (!globalCollector) {
    globalCollector = new MetricsCollector()
  }
  return globalCollector
}

export function initMetricsCollector(sessionId: string): MetricsCollector {
  globalCollector = new MetricsCollector(sessionId)
  return globalCollector
}

export function resetMetricsCollector(): void {
  globalCollector = null
}
