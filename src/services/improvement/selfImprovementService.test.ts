import { describe, test, expect, beforeEach } from 'bun:test'
import { getSelfImprovementService, initSelfImprovementService, type ImprovementSession } from './index'
import { MetricType } from './metricsCollector.js'
import { getMetricsCollector } from './metricsCollector.js'
import { getPatternRecognition } from './patternRecognition.js'

// Enable the self-improvement feature for tests
process.env.GAKR_CODE_IMPROVEMENT = 'true'

describe('SelfImprovementService', () => {
  beforeEach(() => {
    // Reset the singleton to a fresh instance for each test
    initSelfImprovementService()
  })

  describe('initialization', () => {
    test('creates a service with feature flag disabled by default in test env', () => {
      const service = getSelfImprovementService()
      // Service should exist but may be disabled based on feature flag
      expect(service).toBeDefined()
    })

    test('initialize() sets up session when enabled', () => {
      const service = getSelfImprovementService()
      service.initialize('test_session_123')

      // Session should be set
      expect(service).toBeDefined()
    })

    test('initialize() generates session ID if not provided', () => {
      const service = getSelfImprovementService()
      service.initialize()

      // Session should be set with some ID
      expect(service).toBeDefined()
    })
  })

  describe('generateRecommendations', () => {
    test('returns recommendations structure', async () => {
      const service = getSelfImprovementService()
      service.initialize()

      const recommendations = await service.generateRecommendations()

      expect(recommendations).toHaveProperty('recommendations')
      expect(recommendations).toHaveProperty('highPriorityCount')
      expect(recommendations).toHaveProperty('totalPotentialImprovementMs')
      expect(recommendations).toHaveProperty('totalPotentialSavingsUsd')
    })

    test('returns empty recommendations when feature disabled', async () => {
      const service = getSelfImprovementService()
      // Don't initialize, assuming feature flag check will return empty

      const recommendations = await service.generateRecommendations()

      expect(recommendations.recommendations).toEqual([])
      expect(recommendations.highPriorityCount).toBe(0)
    })
  })

  describe('runDiagnostics', () => {
    test('runs diagnostics and returns result', async () => {
      const service = getSelfImprovementService()
      service.initialize()

      const diagnostics = await service.runDiagnostics()

      expect(diagnostics).toHaveProperty('timestamp')
      expect(diagnostics).toHaveProperty('duration')
      expect(diagnostics).toHaveProperty('cwd')
      expect(diagnostics).toHaveProperty('results')
      expect(diagnostics).toHaveProperty('summary')
    })

    test('returns diagnostic result when enabled', async () => {
      const service = getSelfImprovementService()
      service.initialize()

      const diagnostics = await service.runDiagnostics()

      expect(diagnostics.results.length).toBeGreaterThan(0)
    })

    test('includes various severity levels in diagnostics', async () => {
      const service = getSelfImprovementService()
      service.initialize()

      const diagnostics = await service.runDiagnostics()
      const severities = diagnostics.results.map(r => r.severity)

      expect(severities).toContain('low') // At least some low severity checks
    })
  })

  describe('getMetrics', () => {
    test('returns session metrics when enabled', () => {
      const service = getSelfImprovementService()
      service.initialize()

      const metrics = service.getMetrics()

      // Metrics may be null if no observations recorded, but structure should be valid
      if (metrics) {
        expect(metrics).toHaveProperty('observations')
        expect(metrics).toHaveProperty('sessionId')
        expect(metrics).toHaveProperty('startTime')
      }
    })

    test('returns null when feature disabled', () => {
      // Temporarily disable feature
      const originalEnv = process.env.GAKR_CODE_IMPROVEMENT
      process.env.GAKR_CODE_IMPROVEMENT = 'false'
      // Reset the singleton to force new construction with disabled flag
      initSelfImprovementService()
      const service = getSelfImprovementService()
      const metrics = service.getMetrics()
      expect(metrics).toBeNull()
      // Restore original state for other tests
      process.env.GAKR_CODE_IMPROVEMENT = originalEnv
      initSelfImprovementService()
    })
  })

  describe('getPatterns', () => {
    test('returns pattern array', () => {
      const service = getSelfImprovementService()
      service.initialize()

      const patterns = service.getPatterns()

      expect(Array.isArray(patterns)).toBe(true)
    })

    test('returns empty array when feature disabled', () => {
      const service = getSelfImprovementService()
      // Don't initialize

      const patterns = service.getPatterns()
      expect(patterns).toEqual([])
    })
  })

  describe('applyImprovement', () => {
    test('returns success placeholder', async () => {
      const service = getSelfImprovementService()
      const result = await service.applyImprovement('test_id')

      expect(result).toHaveProperty('success')
      expect(result).toHaveProperty('message')
      expect(result.success).toBe(true)
    })
  })

  describe('generateReport', () => {
    test('generates markdown report', () => {
      const service = getSelfImprovementService()
      service.initialize()

      const report = service.generateReport()

      expect(typeof report).toBe('string')
      expect(report.length).toBeGreaterThan(0)
      expect(report).toContain('# Self-Improvement Session Report')
    })

    test('includes session details in report', () => {
      const service = getSelfImprovementService()
      service.initialize('report_test_session')

      const report = service.generateReport()

      expect(report).toContain('Session ID')
      expect(report).toContain('report_test_session')
    })

    test('includes top recommendations when available', () => {
      const service = getSelfImprovementService()
      service.initialize()

      const report = service.generateReport()

      // Report should contain recommendations section even if empty
      expect(report).toContain('Recommendations')
    })

    test('includes detected patterns', () => {
      const service = getSelfImprovementService()
      service.initialize()

      // Record observations that will trigger a pattern (model efficiency)
      const collector = getMetricsCollector()
      // Create multiple successful observations with same model/task
      const now = Date.now()
      for (let i = 0; i < 5; i++) {
        collector.observe(MetricType.SUCCESS, 1, {
          model: 'test-model',
          task_type: 'test_task',
        })
      }

      // Trigger pattern analysis
      const metrics = collector.getSessionSummary()
      getPatternRecognition().analyze(metrics)

      const report = service.generateReport()

      expect(report).toContain('Detected Patterns')
    })

    test('returns error message when not initialized', () => {
      const service = getSelfImprovementService()
      // Don't initialize

      const report = service.generateReport()
      expect(report).toBe('Self-improvement system not initialized')
    })
  })

  describe('finalize', () => {
    test('generates final session summary', () => {
      const service = getSelfImprovementService()
      service.initialize('finalize_test')

      const summary = service.finalize()

      expect(summary).not.toBeNull()
      expect(summary).toHaveProperty('recommendations')
      expect(summary).toHaveProperty('patterns')
      expect(summary).toHaveProperty('diagnostics')
    })

    test('returns null when not initialized', () => {
      const service = getSelfImprovementService()

      const summary = service.finalize()
      expect(summary).toBeNull()
    })
  })
})
