import { test, expect } from 'bun:test'
import { initDiagnosticEngine, type CheckResult } from './diagnosticEngine'

test('diagnostic engine checks have correct result type', async () => {
  const engine = initDiagnosticEngine()
  const result = await engine.runAll()
  // Verify that each result matches CheckResult structure
  for (const check of result.results) {
    const typedCheck = check as CheckResult
    expect(typedCheck).toHaveProperty('name')
    expect(typedCheck).toHaveProperty('severity')
    expect(typedCheck).toHaveProperty('status')
    expect(typedCheck).toHaveProperty('message')
  }
})
