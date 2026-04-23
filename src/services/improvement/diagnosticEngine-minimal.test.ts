import { test, expect } from 'bun:test'
import { initDiagnosticEngine } from './diagnosticEngine'

test('diagnostic engine can run', async () => {
  const engine = initDiagnosticEngine()
  const result = await engine.runAll()
  expect(result.results.length).toBeGreaterThan(0)
})
