/**
 * /improve command
 *
 * Shows self-improvement recommendations and session insights.
 * Usage: /improve [--apply <id>] [--list] [--report]
 */

import { feature } from 'bun:bundle'
import chalk from 'chalk'
import { getSelfImprovementService } from '../services/improvement/index.js'

const command = {
  type: 'prompt',
  name: 'improve',
  description: 'Show self-improvement recommendations and session insights',
  async getPromptForCommand(args, context) {
    const service = getSelfImprovementService()

    if (!feature('IMPROVEMENT_SYSTEM')) {
      return 'Self-improvement system is not enabled. Set GAKR_CODE_IMPROVEMENT=true or enable the feature flag.'
    }

    const recommendations = await service.generateRecommendations()
    const patterns = service.getPatterns()
    const metrics = service.getMetrics()

    const lines = []

    lines.push(chalk.bold('# Self-Improvement Recommendations'))
    lines.push('')

    if (recommendations.recommendations.length === 0) {
      lines.push('No recommendations at this time. Keep using GakrCLI to gather more data!')
    } else {
      lines.push(chalk.dim(`📊 ${recommendations.recommendations.length} recommendations (${recommendations.highPriorityCount} high priority)`))
      lines.push('')

      for (const rec of recommendations.recommendations) {
        const priority = rec.impact === 'high' ? chalk.red('HIGH') : rec.impact === 'medium' ? chalk.yellow('MED') : chalk.gray('LOW')
        lines.push(chalk.bold(`${rec.title} ${chalk.gray(`[${priority}, ${Math.round(rec.confidence * 100)}% confidence]`)}`))
        lines.push(chalk.dim(rec.description))
        lines.push(chalk.dim(`Impact: ~${rec.estimatedImprovement.timeMs ? rec.estimatedImprovement.timeMs + 'ms faster' : ''} ${rec.estimatedImprovement.costUsd ? '$' + rec.estimatedImprovement.costUsd.toFixed(3) + ' saved' : ''}`))
        if (rec.rationale.length > 0) {
          lines.push(chalk.dim(`Rationale: ${rec.rationale.join('; ')}`))
        }
        lines.push('')
      }
    }

    if (patterns.length > 0) {
      lines.push(chalk.bold('\n# Detected Patterns'))
      lines.push('')
      for (const pattern of patterns.slice(0, 5)) {
        lines.push(`- ${pattern.description}`)
      }
      if (patterns.length > 5) {
        lines.push(chalk.dim(`...and ${patterns.length - 5} more`))
      }
    }

    if (metrics) {
      lines.push(chalk.bold('\n# Session Metrics'))
      lines.push(`Observations: ${metrics.observations.length}`)
      lines.push(`Duration: ${Math.round((Date.now() - metrics.startTime.getTime()) / 1000)}s`)
    }

    lines.push('')
    lines.push(chalk.dim('Use /improve --apply <id> to apply a recommendation (when safe)'))
    lines.push(chalk.dim('Use /diagnose to run health checks'))

    return lines.join('\n')
  },
}

export default command
