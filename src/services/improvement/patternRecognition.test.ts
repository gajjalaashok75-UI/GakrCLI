import { describe, test, expect, beforeEach } from 'bun:test'
import { getPatternRecognition, initPatternRecognition, type Pattern, type SessionMetrics, PatternType } from './patternRecognition'
import type { MetricObservation } from './metricsCollector.js'
import { MetricType } from './metricsCollector.js'

// Helper to create a metric observation
const createObservation = (overrides: Partial<MetricObservation>): MetricObservation => {
  return {
    id: `obs_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
    sessionId: 'test_session',
    timestamp: new Date(),
    type: MetricType.TOOL_DURATION_MS,
    value: 100,
    tags: {},
    ...overrides,
  }
}

describe('PatternRecognition', () => {
  beforeEach(() => {
    // Reset the pattern recognition state between tests
    getPatternRecognition().clear()
  })

  describe('detectToolSequences', () => {
    test('detects effective tool sequences', () => {
      const service = getPatternRecognition()
      const baseTime = Date.now()

      // Build 9 tool use observations that repeat the same 3-tool sequence 3 times
      // Sequence: FileRead -> AgentTool -> FileWrite
      const observations: MetricObservation[] = []
      let time = baseTime
      for (let rep = 0; rep < 3; rep++) {
        // Three tools in sequence
        observations.push(createObservation({
          timestamp: new Date(time += 1000),
          tags: { tool_name: 'FileRead' },
        }))
        observations.push(createObservation({
          timestamp: new Date(time += 1000),
          tags: { tool_name: 'AgentTool' },
        }))
        observations.push(createObservation({
          timestamp: new Date(time += 1000),
          tags: { tool_name: 'FileWrite' },
        }))
        // Success after each full sequence
        observations.push({
          id: `success_${rep}`,
          sessionId: 'test_session',
          timestamp: new Date(time += 1000),
          type: MetricType.SUCCESS,
          value: 1,
          tags: {},
        })
      }

      const metrics: SessionMetrics = {
        sessionId: 'test_session',
        startTime: new Date(baseTime - 5000),
        observations,
        aggregates: {},
      }

      const patterns = service.analyze(metrics)
      // Debug: ensure at least some patterns are detected
      expect(patterns.length).toBeGreaterThan(0, 'Should detect at least one pattern')
      // Log pattern types for debugging
      const patternTypes = patterns.map(p => p.type)
      // Expect at least one sequence pattern (effective or failure)
      const seqPattern = patterns.find(p => p.type === PatternType.TOOL_SEQUENCE_EFFECTIVE || p.type === PatternType.TOOL_FAILURE_CORRELATION)

      if (!seqPattern) {
        throw new Error(`Expected sequence pattern not found. Got pattern types: ${patternTypes.join(', ')}`)
      }
      if (seqPattern) {
        expect(seqPattern.description).toContain('succeeds')
        expect(seqPattern.metadata.occurrenceCount).toBeGreaterThanOrEqual(3)
      }
    })
  })

  describe('detectModelEfficiency', () => {
    test('detects optimal model for task', () => {
      const service = getPatternRecognition()
      const now = Date.now()

      // Create multiple success observations for same model/task
      const observations: MetricObservation[] = []
      for (let i = 0; i < 5; i++) {
        observations.push({
          id: `success_${i}`,
          sessionId: 'test_session',
          timestamp: new Date(now - i * 1000),
          type: MetricType.SUCCESS,
          value: 1, // success = 1
          tags: {
            model: 'claude-3-opus',
            task_type: 'code_generation',
          },
        })
      }

      const metrics: SessionMetrics = {
        sessionId: 'test_session',
        startTime: new Date(now - 10000),
        observations,
        aggregates: {},
      }

      const patterns = service.analyze(metrics)
      const modelPattern = patterns.find(p => p.type === PatternType.MODEL_OPTIMAL_FOR_TASK)

      expect(modelPattern).toBeDefined()
      if (modelPattern) {
        expect(modelPattern.metadata.model).toBe('claude-3-opus')
        expect(modelPattern.metadata.taskType).toBe('code_generation')
      }
    })
  })

  describe('detectErrorPatterns', () => {
    test('detects recurring errors', () => {
      const service = getPatternRecognition()
      const now = Date.now()

      const observations: MetricObservation[] = [
        {
          id: 'err1',
          sessionId: 'test_session',
          timestamp: new Date(now - 2000),
          type: MetricType.ERROR_COUNT,
          value: 1,
          tags: {
            tool_name: 'bash',
            error_type: 'timeout',
          },
        },
        {
          id: 'err2',
          sessionId: 'test_session',
          timestamp: new Date(now - 1000),
          type: MetricType.ERROR_COUNT,
          value: 1,
          tags: {
            tool_name: 'bash',
            error_type: 'timeout',
          },
        },
      ]

      const metrics: SessionMetrics = {
        sessionId: 'test_session',
        startTime: new Date(now - 5000),
        observations,
        aggregates: {},
      }

      const patterns = service.analyze(metrics)
      const errorPattern = patterns.find(p => p.type === PatternType.RECURRENT_ERROR)

      expect(errorPattern).toBeDefined()
      if (errorPattern) {
        expect(errorPattern.metadata.toolName).toBe('bash')
      }
    })
  })

  describe('detectContextWaste', () => {
    test('detects high context waste', () => {
      const service = getPatternRecognition()
      const now = Date.now()

      const observations: MetricObservation[] = []
      // Create many high waste observations
      for (let i = 0; i < 5; i++) {
        observations.push({
          id: `waste_${i}`,
          sessionId: 'test_session',
          timestamp: new Date(now - i * 1000),
          type: MetricType.CONTEXT_TOKENS_WASTED,
          value: 100000, // 100k tokens wasted
          tags: {},
        })
      }

      const metrics: SessionMetrics = {
        sessionId: 'test_session',
        startTime: new Date(now - 10000),
        observations,
        aggregates: {},
      }

      const patterns = service.analyze(metrics)
      const wastePattern = patterns.find(p => p.type === PatternType.CONTEXT_WASTE_PATTERN)

      expect(wastePattern).toBeDefined()
    })
  })

  describe('detectCostPatterns', () => {
    test('detects cost spikes', () => {
      const service = getPatternRecognition()
      const now = Date.now()

      const observations: MetricObservation[] = []
      // Add many low cost observations to keep average low
      for (let i = 0; i < 8; i++) {
        observations.push({
          id: `cost_low_${i}`,
          sessionId: 'test_session',
          timestamp: new Date(now - i * 1000),
          type: MetricType.COST_USD,
          value: 0.01, // 1 cent
          tags: {},
        })
      }
      // Add spikes (at least 2)
      for (let i = 8; i < 10; i++) {
        observations.push({
          id: `cost_high_${i}`,
          sessionId: 'test_session',
          timestamp: new Date(now - i * 1000),
          type: MetricType.COST_USD,
          value: 1.00, // $1.00 (100x average)
          tags: {},
        })
      }

      const metrics: SessionMetrics = {
        sessionId: 'test_session',
        startTime: new Date(now - 20000),
        observations,
        aggregates: {},
      }

      const patterns = service.analyze(metrics)
      const costPattern = patterns.find(p => p.type === PatternType.COST_SPIKE)

      expect(costPattern).toBeDefined()
    })
  })

  describe('getPatterns', () => {
    test('returns currently detected patterns', () => {
      const patterns = getPatternRecognition().getPatterns()
      expect(Array.isArray(patterns)).toBe(true)
    })
  })
})
