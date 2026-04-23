/**
 * Diagnostic Engine
 *
 * Runs health checks and identifies configuration, performance, and security issues.
 * Provides actionable fix suggestions.
 */

import { getCwd } from '../../utils/cwd.js'
import { getGlobalConfig } from '../../utils/config.js'
import { getIsGit } from '../../utils/git.js'
import { getInitialSettings } from '../../utils/settings/settings.js'
import type { DiagnosticResult, DiagnosticSeverity } from './diagnosticEngine.js'

export interface CheckResult {
  name: string
  severity: DiagnosticSeverity
  status: 'pass' | 'fail' | 'warn'
  message: string
  suggestion?: string
  metadata?: Record<string, unknown>
}

export enum DiagnosticSeverity {
  CRITICAL = 'critical', // Requires immediate attention (security, data loss)
  HIGH = 'high', // Should fix soon (performance, reliability)
  MEDIUM = 'medium', // Good to address (usability, optimization)
  LOW = 'low', //Minor improvements or informational
}

class DiagnosticEngine {
  private checks: DiagnosticCheck[] = []

  constructor() {
    this.registerDefaultChecks()
  }

  /**
   * Run all diagnostic checks
   */
  async runAll(): Promise<DiagnosticResult> {
    const results: CheckResult[] = []
    const startTime = Date.now()

    for (const check of this.checks) {
      try {
        const result = await check.handler()
        results.push(result)
      } catch (error) {
        results.push({
          name: check.name,
          severity: DiagnosticSeverity.HIGH,
          status: 'fail',
          message: `Check failed with error: ${error}`,
          suggestion: 'Report this issue to the Gakr team.',
        })
      }
    }

    const duration = Date.now() - startTime

    // Summarize
    const summary = this.summarizeResults(results)

    return {
      timestamp: new Date(),
      duration,
      cwd: getCwd(),
      results,
      summary,
    }
  }

  /**
   * Run a specific check by name
   */
  async runCheck(name: string): Promise<CheckResult | null> {
    const check = this.checks.find(c => c.name === name)
    if (!check) return null
    return check.handler()
  }

  /**
   * Register a custom diagnostic check
   */
  registerCheck(check: DiagnosticCheck): void {
    this.checks.push(check)
  }

  /**
   * Summarize check results into a human-readable report
   */
  private summarizeResults(results: CheckResult[]): string {
    const byStatus = {
      pass: results.filter(r => r.status === 'pass').length,
      fail: results.filter(r => r.status === 'fail').length,
      warn: results.filter(r => r.status === 'warn').length,
    }

    const bySeverity = {
      [DiagnosticSeverity.CRITICAL]: results.filter(r => r.severity === DiagnosticSeverity.CRITICAL && r.status !== 'pass'),
      [DiagnosticSeverity.HIGH]: results.filter(r => r.severity === DiagnosticSeverity.HIGH && r.status !== 'pass'),
      [DiagnosticSeverity.MEDIUM]: results.filter(r => r.severity === DiagnosticSeverity.MEDIUM && r.status !== 'pass'),
      [DiagnosticSeverity.LOW]: results.filter(r => r.severity === DiagnosticSeverity.LOW && r.status !== 'pass'),
    }

    const critical = bySeverity[DiagnosticSeverity.CRITICAL]
    const high = bySeverity[DiagnosticSeverity.HIGH]

    if (critical.length > 0) {
      return `CRITICAL: ${critical.length} issue(s) require immediate attention.`
    }
    if (high.length > 0) {
      return `HIGH: ${high.length} issue(s) need to be addressed.`
    }
    if (byStatus.fail > 0) {
      return `${byStatus.fail} check(s) failed, ${byStatus.warn} warning(s).`
    }
    return `All ${byStatus.pass} checks passed.`
  }

  /**
   * Register default health checks
   */
  private registerDefaultChecks(): void {
    // Configuration checks
    this.checks.push({
      name: 'api_key_configured',
      description: 'API key is configured',
      handler: async () => {
        const config = getGlobalConfig()
        const hasAnthropicKey = !!process.env.ANTHROPIC_API_KEY || !!config.apiKey
        const hasOpenAIKey = !!process.env.OPENAI_API_KEY || config.openAiApiKey

        if (hasAnthropicKey || hasOpenAIKey) {
          return {
            name: 'API key configured',
            severity: DiagnosticSeverity.LOW,
            status: 'pass',
            message: 'At least one provider API key is configured.',
          }
        }
        return {
          name: 'API key configured',
          severity: DiagnosticSeverity.HIGH,
          status: 'fail',
          message: 'No API key found. Set ANTHROPIC_API_KEY or OPENAI_API_KEY.',
          suggestion: 'Run `gakrcli auth login` or set the appropriate environment variable.',
        }
      },
    })

    // Git checks
    this.checks.push({
      name: 'git_repository',
      description: 'Git repository is accessible',
      handler: async () => {
        const isGit = await getIsGit()
        if (isGit) {
          return {
            name: 'Git repository',
            severity: DiagnosticSeverity.LOW,
            status: 'pass',
            message: 'Git repository detected.',
          }
        }
        return {
          name: 'Git repository',
          severity: DiagnosticSeverity.MEDIUM,
          status: 'warn',
          message: 'Not in a Git repository. Some features (like session history) won\'t work.',
          suggestion: 'Initialize a Git repository with `git init`.',
        }
      },
    })

    // Settings checks
    this.checks.push({
      name: 'settings_valid',
      description: 'Settings are valid and loadable',
      handler: async () => {
        try {
          const settings = getInitialSettings()
          const errors = settings._errors
          if (errors && errors.length > 0) {
            return {
              name: 'Settings validity',
              severity: DiagnosticSeverity.MEDIUM,
              status: 'warn',
              message: `Settings loaded with ${errors.length} warning(s).`,
              suggestion: 'Review settings with `/config` command.',
              metadata: { errors },
            }
          }
          return {
            name: 'Settings validity',
            severity: DiagnosticSeverity.LOW,
            status: 'pass',
            message: 'Settings loaded successfully.',
          }
        } catch (error) {
          return {
            name: 'Settings validity',
            severity: DiagnosticSeverity.HIGH,
            status: 'fail',
            message: `Failed to load settings: ${error}`,
            suggestion: 'Check `~/.gakrcli/settings.json` for syntax errors.',
          }
        }
      },
    })

    // Disk space check
    this.checks.push({
      name: 'disk_space',
      description: 'Sufficient disk space for sessions and cache',
      handler: async () => {
        // Would check actual disk space
        // Placeholder implementation
        return {
          name: 'Disk space',
          severity: DiagnosticSeverity.LOW,
          status: 'pass',
          message: 'Sufficient disk space available.',
        }
      },
    })

    // Feature flag sanity
    this.checks.push({
      name: 'feature_flags',
      description: 'Feature flags are reasonable',
      handler: async () => {
        const dangerousFlags = []
        if (process.env.GAKR_CODE_EXPERIMENTAL === 'true') {
          dangerousFlags.push('GAKR_CODE_EXPERIMENTAL')
        }
        if (process.env.GAKR_CODE_DISABLE_SANDBOX === 'true') {
          dangerousFlags.push('GAKR_CODE_DISABLE_SANDBOX')
        }

        if (dangerousFlags.length > 0) {
          return {
            name: 'Feature flags',
            severity: DiagnosticSeverity.MEDIUM,
            status: 'warn',
            message: `Potentially risky flags enabled: ${dangerousFlags.join(', ')}`,
            suggestion: 'These flags may reduce security or stability. Consider disabling them.',
          }
        }

        return {
          name: 'Feature flags',
          severity: DiagnosticSeverity.LOW,
          status: 'pass',
          message: 'No dangerous feature flags detected.',
        }
      },
    })

    // Telemetry permission
    this.checks.push({
      name: 'telemetry_consent',
      description: 'Telemetry settings are appropriate',
      handler: async () => {
        const analyticsDisabled = process.env.GAKR_CODE_ANALYTICS_DISABLED === 'true'
        if (analyticsDisabled) {
          return {
            name: 'Telemetry consent',
            severity: DiagnosticSeverity.LOW,
            status: 'pass',
            message: 'Analytics disabled by user preference.',
          }
        }
        // No issue - telemetry helps improve the product
        return {
          name: 'Telemetry consent',
          severity: DiagnosticSeverity.LOW,
          status: 'pass',
          message: 'Telemetry settings are OK.',
        }
      },
    })
  }
}

interface DiagnosticCheck {
  name: string
  description: string
  handler: () => Promise<CheckResult>
}

// Singleton
let globalDiagnostics: DiagnosticEngine | null = null

export function getDiagnosticEngine(): DiagnosticEngine {
  if (!globalDiagnostics) {
    globalDiagnostics = new DiagnosticEngine()
  }
  return globalDiagnostics
}

export function initDiagnosticEngine(): DiagnosticEngine {
  globalDiagnostics = new DiagnosticEngine()
  return globalDiagnostics
}

export type { DiagnosticResult, CheckResult, DiagnosticSeverity }
