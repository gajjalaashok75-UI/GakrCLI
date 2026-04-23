import { describe, test, expect } from 'bun:test'
import { getDiagnosticEngine, initDiagnosticEngine, DiagnosticSeverity, type CheckResult } from './diagnosticEngine'

describe('DiagnosticEngine', () => {

  describe('runAll', () => {
    test('runs all registered checks and returns results', async () => {
      const engine = initDiagnosticEngine()
      const result = await engine.runAll()

      expect(result).toHaveProperty('timestamp')
      expect(result).toHaveProperty('duration')
      expect(result).toHaveProperty('cwd')
      expect(result).toHaveProperty('results')
      expect(result).toHaveProperty('summary')
      expect(result.results.length).toBeGreaterThan(0)
    })

    test('completes within reasonable time', async () => {
      const engine = initDiagnosticEngine()
      const result = await engine.runAll()

      expect(result.duration).toBeLessThan(5000) // Should complete in under 5 seconds
    })

    test('includes checks for api_key_configured', async () => {
      const engine = initDiagnosticEngine()
      const result = await engine.runAll()

      const apiKeyCheck = result.results.find(r => r.name.includes('API key'))
      expect(apiKeyCheck).toBeDefined()
      expect(apiKeyCheck).toHaveProperty('severity')
      expect(apiKeyCheck).toHaveProperty('status')
      expect(apiKeyCheck).toHaveProperty('message')
    })

    test('includes checks for git_repository', async () => {
      const engine = initDiagnosticEngine()
      const result = await engine.runAll()

      const gitCheck = result.results.find(r => r.name.includes('Git'))
      expect(gitCheck).toBeDefined()
    })

    test('includes checks for settings_valid', async () => {
      const engine = initDiagnosticEngine()
      const result = await engine.runAll()

      const settingsCheck = result.results.find(r => r.name.includes('Settings'))
      expect(settingsCheck).toBeDefined()
    })

    test('includes checks for feature_flags', async () => {
      const engine = initDiagnosticEngine()
      const result = await engine.runAll()

      const featureCheck = result.results.find(r => r.name.includes('Feature flags'))
      expect(featureCheck).toBeDefined()
    })

    test('summarizes results with appropriate status', async () => {
      const engine = initDiagnosticEngine()
      const result = await engine.runAll()

      // Summary should be a non-empty string
      expect(typeof result.summary).toBe('string')
      expect(result.summary.length).toBeGreaterThan(0)
    })
  })

  describe('runCheck', () => {
    test('runs a specific check by name', async () => {
      const engine = initDiagnosticEngine()
      const result = await engine.runCheck('api_key_configured')

      expect(result).not.toBeNull()
      expect(result.name).toBe('API key configured')
    })

    test('returns null for non-existent check', async () => {
      const engine = initDiagnosticEngine()
      const result = await engine.runCheck('nonexistent_check')

      expect(result).toBeNull()
    })
  })

  describe('registerCheck', () => {
    test('allows registering custom checks', async () => {
      const engine = initDiagnosticEngine()
      const customCheckHandler = async () => ({
        name: 'custom check',
        severity: DiagnosticSeverity.LOW,
        status: 'pass',
        message: 'Custom check passed',
      })

      engine.registerCheck({
        name: 'custom_check',
        description: 'A custom check',
        handler: customCheckHandler,
      })

      const result = await engine.runCheck('custom_check')
      expect(result).not.toBeNull()
      expect(result.name).toBe('custom check')
    })
  })

  describe('CheckResult structure', () => {
    test('check results have correct structure', async () => {
      const engine = initDiagnosticEngine()
      const result = await engine.runAll()

      for (const check of result.results) {
        expect(check).toHaveProperty('name')
        expect(check).toHaveProperty('severity')
        expect(['critical', 'high', 'medium', 'low']).toContain(check.severity)
        expect(check).toHaveProperty('status')
        expect(['pass', 'fail', 'warn']).toContain(check.status)
        expect(check).toHaveProperty('message')
        expect(typeof check.message).toBe('string')
        if (check.suggestion) {
          expect(typeof check.suggestion).toBe('string')
        }
      }
    })
  })
})
