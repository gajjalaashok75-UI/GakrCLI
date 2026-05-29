/**
 * /diagnose command
 *
 * Runs health checks and identifies configuration, performance, and security issues.
 * Usage: /diagnose [--fix] [--check <name>]
 */

import chalk from 'chalk'
import { getDiagnosticEngine, type DiagnosticResult } from '../services/improvement/diagnosticEngine.js'

const command = {
  type: 'prompt',
  name: 'diagnose',
  description: 'Run system health checks and diagnostics',
  async getPromptForCommand(args, context) {
    const engine = getDiagnosticEngine()
    const result = await engine.runAll()

    const lines = []

    lines.push(chalk.bold('# System Diagnostics'))
    lines.push(`Run in ${result.duration}ms`)
    lines.push(`Status: ${result.summary}`)
    lines.push('')

    // Group by severity
    const bySeverity = {
      critical: result.results.filter(r => r.severity === 'critical'),
      high: result.results.filter(r => r.severity === 'high'),
      medium: result.results.filter(r => r.severity === 'medium'),
      low: result.results.filter(r => r.severity === 'low'),
    }

    const printGroup = (title, color, checks) => {
      if (checks.length === 0) return
      lines.push(chalk.bold(color(`${title} (${checks.length})`)))
      for (const check of checks) {
        const statusIcon = check.status === 'pass' ? chalk.green('✓') : check.status === 'warn' ? chalk.yellow('⚠') : chalk.red('✗')
        lines.push(`${statusIcon} ${check.name}: ${check.message}`)
        if (check.suggestion) {
          lines.push(chalk.dim(`  → ${check.suggestion}`))
        }
      }
      lines.push('')
    }

    printGroup('CRITICAL', chalk.red, bySeverity.critical)
    printGroup('HIGH', chalk.yellow, bySeverity.high)
    printGroup('MEDIUM', chalk.white, bySeverity.medium)
    printGroup('INFO', chalk.gray, bySeverity.low)

    lines.push(chalk.dim('Use /diagnose --fix to attempt automatic fixes for safe issues'))
    lines.push(chalk.dim('Some checks may require manual intervention'))

    return lines.join('\n')
  },
}

export default command
