import { test, expect } from 'bun:test'
import { initMetricsCollector, getMetricsCollector, MetricType } from './metricsCollector'

test('metrics collector works', () => {
  const collector = initMetricsCollector('test')
  collector.observe(MetricType.TOOL_DURATION_MS, 100, {})
  const summary = collector.getSessionSummary()
  expect(summary.observations.length).toBe(1)
})
