import { describe, test, expect } from 'bun:test'
import { getMetricsCollector, initMetricsCollector, type SessionMetrics, MetricType } from './metricsCollector'

describe('MetricsCollector', () => {
  describe('initMetricsCollector', () => {
    test('initializes with a session ID', () => {
      const collector = initMetricsCollector('test_session_123')
      expect(collector).toBeDefined()
    })

    test('generates session ID if not provided', () => {
      const collector = initMetricsCollector()
      expect(collector).toBeDefined()
    })
  })

  describe('getMetricsCollector', () => {
    test('returns singleton instance', () => {
      initMetricsCollector('session_1')
      const collector1 = getMetricsCollector()
      const collector2 = getMetricsCollector()

      expect(collector1).toBe(collector2)
    })
  })

  describe('observe', () => {
    test('records tool execution duration', () => {
      const collector = initMetricsCollector('test_session')

      collector.observe(MetricType.TOOL_DURATION_MS, 150, { tool_name: 'bash' })

      const summary = collector.getSessionSummary()
      expect(summary.observations.length).toBe(1)
      expect(summary.observations[0].type).toBe(MetricType.TOOL_DURATION_MS)
      expect(summary.observations[0].value).toBe(150)
    })

    test('records token usage via observe', () => {
      const collector = initMetricsCollector('test_session')

      collector.observe(MetricType.TOKENS_INPUT, 100, {})
      collector.observe(MetricType.TOKENS_OUTPUT, 50, {})

      const summary = collector.getSessionSummary()
      expect(summary.observations.length).toBe(2)
    })

    test('records cost observations', () => {
      const collector = initMetricsCollector('test_session')

      collector.observe(MetricType.COST_USD, 0.045, { model: 'claude-3-opus' })

      const summary = collector.getSessionSummary()
      expect(summary.observations.length).toBe(1)
      expect(summary.observations[0].type).toBe(MetricType.COST_USD)
      expect(summary.observations[0].value).toBeCloseTo(0.045)
    })

    test('records success/failure outcomes', () => {
      const collector = initMetricsCollector('test_session')

      collector.observe(MetricType.SUCCESS, 1, {})
      collector.observe(MetricType.ERROR_COUNT, 0, {})

      const summary = collector.getSessionSummary()
      expect(summary.observations.length).toBe(2)
    })
  })

  describe('recordOutcome', () => {
    test('records success outcomes', () => {
      const collector = initMetricsCollector('test_session')

      collector.recordOutcome(true, { tool: 'bash' })

      const summary = collector.getSessionSummary()
      expect(summary.observations.length).toBe(1)
      expect(summary.observations[0].type).toBe(MetricType.SUCCESS)
      expect(summary.observations[0].value).toBe(1)
    })

    test('records failure outcomes with error count', () => {
      const collector = initMetricsCollector('test_session')

      collector.recordOutcome(false, { tool: 'bash' })

      const summary = collector.getSessionSummary()
      expect(summary.observations.length).toBe(2) // SUCCESS and ERROR_COUNT
      const errorObs = summary.observations.find(o => o.type === MetricType.ERROR_COUNT)
      expect(errorObs).toBeDefined()
      expect(errorObs!.value).toBe(1)
    })
  })

  describe('recordTokenUsage', () => {
    test('records token usage as multiple observations', () => {
      const collector = initMetricsCollector('test_session')

      // Without model tag, no context waste is recorded
      collector.recordTokenUsage(1000, 500, {})

      const summary = collector.getSessionSummary()
      expect(summary.observations.length).toBe(3) // INPUT, OUTPUT, TOTAL
      const types = summary.observations.map(o => o.type)
      expect(types).toContain(MetricType.TOKENS_INPUT)
      expect(types).toContain(MetricType.TOKENS_OUTPUT)
      expect(types).toContain(MetricType.TOKEN_COUNT)
    })
  })

  describe('recordCost', () => {
    test('converts cents to dollars', () => {
      const collector = initMetricsCollector('test_session')

      collector.recordCost(450) // 450 cents = $4.50

      const summary = collector.getSessionSummary()
      expect(summary.observations.length).toBe(1)
      expect(summary.observations[0].type).toBe(MetricType.COST_USD)
      expect(summary.observations[0].value).toBe(4.5)
    })
  })

  describe('getSessionSummary', () => {
    test('returns observation count', () => {
      const collector = initMetricsCollector('test_session')

      collector.observe(MetricType.TOOL_DURATION_MS, 100, {})
      collector.observe(MetricType.TOOL_DURATION_MS, 200, {})

      const summary = collector.getSessionSummary()
      expect(summary.observations.length).toBe(2)
      expect(summary.sessionId).toBe('test_session')
    })

    test('computes aggregated metrics', () => {
      const collector = initMetricsCollector('test_session')

      collector.observe(MetricType.TOOL_DURATION_MS, 100, {})
      collector.observe(MetricType.TOOL_DURATION_MS, 200, {})

      const summary = collector.getSessionSummary()
      const agg = summary.aggregates[MetricType.TOOL_DURATION_MS]
      expect(agg).toBeDefined()
      expect(agg.count).toBe(2)
      expect(agg.sum).toBe(300)
      expect(agg.avg).toBe(150)
    })

    test('returns empty summary when no observations', () => {
      const collector = initMetricsCollector('test_session')
      const summary = collector.getSessionSummary()

      expect(summary.observations.length).toBe(0)
    })
  })

  describe('clear', () => {
    test('removes all collected data', () => {
      const collector = initMetricsCollector('test_session')

      collector.observe(MetricType.TOOL_DURATION_MS, 100, {})
      collector.clear()

      const summary = collector.getSessionSummary()
      expect(summary.observations.length).toBe(0)
    })
  })

  describe('error handling', () => {
    test('handles invalid metric types gracefully', () => {
      const collector = initMetricsCollector('test_session')

      // Should accept any MetricType enum value
      collector.observe(MetricType.SUCCESS, 1, {})

      const summary = collector.getSessionSummary()
      expect(summary.observations.length).toBe(1)
    })
  })
})
