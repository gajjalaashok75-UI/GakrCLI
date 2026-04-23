/**
 * Self-Improvement Service
 *
 * Orchestrates metrics collection, pattern recognition, recommendations, and diagnostics.
 * Entry point for all self-improvement capabilities.
 */

import { feature } from 'bun:bundle'
import type { SessionMetrics } from './metricsCollector.js'
import { getMetricsCollector, initMetricsCollector } from './metricsCollector.js'
import { getPatternRecognition, initPatternRecognition } from './patternRecognition.js'
import { getRecommendationSystem, initRecommendationSystem } from './recommendationSystem.js'
import { getDiagnosticEngine, initDiagnosticEngine } from './diagnosticEngine.js'
import type { Pattern } from './patternRecognition.js'
import type { Recommendation, RecommendationsResult } from './recommendationSystem.js'
import type { DiagnosticResult } from './diagnosticEngine.js'

export interface ImprovementSession {
  sessionId: string
  startTime: Date
  metricsCollected: boolean
  patternsDetected: number
  recommendationsGenerated: number
}

export class SelfImprovementService {
  private session: ImprovementSession | null = null
  private enabled: boolean

  constructor() {
    let enabled = false
    if (feature('IMPROVEMENT_SYSTEM')) {
      enabled = true
    } else if (process.env.GAKR_CODE_IMPROVEMENT === 'true') {
      enabled = true
    }
    this.enabled = enabled
  }

  /**
   * Initialize the self-improvement system for a new session
   */
  initialize(sessionId?: string): void {
    if (!this.enabled) return

    const sessionId_ = sessionId || this.generateSessionId()
    initMetricsCollector(sessionId_)
    initPatternRecognition()
    initRecommendationSystem()
    initDiagnosticEngine()

    this.session = {
      sessionId: sessionId_,
      startTime: new Date(),
      metricsCollected: false,
      patternsDetected: 0,
      recommendationsGenerated: 0,
    }

    console.log('[SelfImprovement] System initialized for session:', sessionId_)
  }

  /**
   * Finalize session and generate summary
   */
  finalize(): { recommendations: RecommendationsResult; patterns: Pattern[]; diagnostics: DiagnosticResult } | null {
    if (!this.enabled || !this.session) return null

    const metrics = getMetricsCollector().getSessionSummary()
    const patterns = getPatternRecognition().analyze(metrics)
    const recommendations = getRecommendationSystem().generateFromPatterns(patterns)
    const diagnostics = getDiagnosticEngine().runAll()

    this.session.metricsCollected = true
    this.session.patternsDetected = patterns.length
    this.session.recommendationsGenerated = recommendations.recommendations.length

    return {
      recommendations,
      patterns,
      diagnostics,
    }
  }

  /**
   * Generate improvement suggestions for current session
   */
  async generateRecommendations(): Promise<RecommendationsResult> {
    if (!this.enabled) {
      return { recommendations: [], highPriorityCount: 0, totalPotentialImprovementMs: 0, totalPotentialSavingsUsd: 0 }
    }

    const metrics = getMetricsCollector().getSessionSummary()
    const patterns = getPatternRecognition().analyze(metrics)
    return getRecommendationSystem().generateFromPatterns(patterns)
  }

  /**
   * Run diagnostic checks
   */
  async runDiagnostics(): Promise<DiagnosticResult> {
    if (!this.enabled) {
      return {
        timestamp: new Date(),
        duration: 0,
        cwd: getCwd(),
        results: [],
        summary: 'Diagnostics disabled',
      }
    }
    return getDiagnosticEngine().runAll()
  }

  /**
   * Get collected metrics for current session
   */
  getMetrics(): SessionMetrics | null {
    if (!this.enabled) return null
    return getMetricsCollector().getSessionSummary()
  }

  /**
   * Get detected patterns
   */
  getPatterns(): Pattern[] {
    if (!this.enabled) return []
    return getPatternRecognition().getPatterns()
  }

  /**
   * Apply a recommended improvement
   */
  async applyImprovement(recommendationId: string): Promise<{ success: boolean; message: string }> {
    // Would implement actual application logic
    return {
      success: true,
      message: `Improvement ${recommendationId} applied (placeholder implementation)`,
    }
  }

  /**
   * Generate session summary report
   */
  generateReport(): string {
    if (!this.session) return 'Self-improvement system not initialized'

    const metrics = getMetricsCollector().getSessionSummary()
    const patterns = getPatternRecognition().getPatterns()
    const recommendations = getRecommendationSystem().generateFromPatterns(patterns)

    const lines: string[] = []
    lines.push('# Self-Improvement Session Report')
    lines.push(`Session ID: ${this.session.sessionId}`)
    lines.push(`Duration: ${Math.round((Date.now() - this.session.startTime.getTime()) / 1000)}s`)
    lines.push(`Observations collected: ${metrics.observations.length}`)
    lines.push(`Patterns detected: ${patterns.length}`)
    lines.push(`Recommendations: ${recommendations.recommendations.length} (${recommendations.highPriorityCount} high priority)`)
    lines.push('')

    if (recommendations.recommendations.length > 0) {
      lines.push('## Top Recommendations')
      for (const rec of recommendations.recommendations.slice(0, 5)) {
        lines.push(`- **${rec.title}** (confidence: ${(rec.confidence * 100).toFixed(0)}%, ${rec.impact} impact)`)
        lines.push(`  ${rec.description}`)
        lines.push(`  Actions: ${rec.actions.join(', ')}`)
        lines.push('')
      }
    }

    if (patterns.length > 0) {
      lines.push('## Detected Patterns')
      for (const pattern of patterns) {
        lines.push(`- ${pattern.description} (confidence: ${(pattern.confidence * 100).toFixed(0)}%)`)
      }
      lines.push('')
    }

    return lines.join('\n')
  }

  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 8)}`
  }
}

// Global singleton
let globalImprovement: SelfImprovementService | null = null

export function getSelfImprovementService(): SelfImprovementService {
  if (!globalImprovement) {
    globalImprovement = new SelfImprovementService()
  }
  return globalImprovement
}

export function initSelfImprovementService(): SelfImprovementService {
  globalImprovement = new SelfImprovementService()
  return globalImprovement
}
