import { test, expect } from 'bun:test'
import { DiagnosticSeverity, type CheckResult } from './diagnosticEngine'

test('imports DiagnosticSeverity enum', () => {
  expect(DiagnosticSeverity.CRITICAL).toBe('critical')
  expect(DiagnosticSeverity.HIGH).toBe('high')
  expect(DiagnosticSeverity.MEDIUM).toBe('medium')
  expect(DiagnosticSeverity.LOW).toBe('low')
})
