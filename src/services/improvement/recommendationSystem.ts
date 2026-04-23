/**
 * Recommendation System
 *
 * Generates actionable improvement suggestions based on detected patterns.
 * Provides actionable steps with confidence scores and impact estimates.
 */

import { PatternType } from './patternRecognition.js'
import type { Pattern, EvidencePoint } from './patternRecognition.js'
import type { MetricObservation, MetricType } from './metricsCollector.js'

export enum RecommendationCategory {
  PERFORMANCE = 'performance',
  COST = 'cost',
  QUALITY = 'quality',
  SECURITY = 'security',
  USABILITY = 'usability',
  CONFIGURATION = 'configuration',
}

export enum RecommendationAction {
  CHANGE_MODEL = 'change_model',
  ADD_ALWAY_ALLOW_RULE = 'add_always_allow_rule',
  ENABLE_FEATURE = 'enable_feature',
  UPDATE_CONFIG = 'update_config',
  RUN_DIAGNOSTIC = 'run_diagnostic',
  // Add more as needed
}

export interface Recommendation {
  id: string
  category: RecommendationCategory
  title: string
  description: string
  rationale: string[]
  confidence: number // 0-1
  impact: 'high' | 'medium' | 'low'
  effort: 'zero' | 'low' | 'medium' | 'high'
  actions: RecommendationAction[]
  estimatedImprovement: {
    timeMs?: number
    costUsd?: number
    successRatePp?: number
    contextTokensWasted?: number
  }
  createdAt: Date
}

export interface RecommendationsResult {
  recommendations: Recommendation[]
  highPriorityCount: number
  totalPotentialImprovementMs: number
  totalPotentialSavingsUsd: number
}

class RecommendationSystem {
  private static readonly MIN_CONFIDENCE = 0.6
  private static readonly MIN_EVIDENCE = 3

  /**
   * Generate recommendations from detected patterns
   */
  generateFromPatterns(patterns: Pattern[]): RecommendationsResult {
    const recommendations: Recommendation[] = []
    let highPriorityCount = 0
    let totalImprovementMs = 0
    let totalSavingsUsd = 0

    for (const pattern of patterns) {
      if (pattern.confidence < this.MIN_CONFIDENCE || pattern.evidence.length < this.MIN_EVIDENCE) {
        continue // Skip low-confidence patterns
      }

      const recs = this.recommendationsForPattern(pattern)
      recommendations.push(...recs)

      for (const rec of recs) {
        if (rec.impact === 'high') highPriorityCount++
        totalImprovementMs += rec.estimatedImprovement.timeMs || 0
        totalSavingsUsd += rec.estimatedImprovement.costUsd || 0
      }
    }

    // Sort by impact then confidence
    recommendations.sort((a, b) => {
      const impactDiff = this.impactRank(b) - this.impactRank(a)
      if (impactDiff !== 0) return impactDiff
      return b.confidence - a.confidence
    })

    return {
      recommendations,
      highPriorityCount,
      totalPotentialImprovementMs: totalImprovementMs,
      totalPotentialSavingsUsd: totalSavingsUsd,
    }
  }

  /**
   * Generate one or more recommendations for a specific pattern
   */
  private recommendationsForPattern(pattern: Pattern): Recommendation[] {
    switch (pattern.type) {
      case PatternType.MODEL_OPTIMAL_FOR_TASK:
        return this.recommendModelForTask(pattern)

      case PatternType.TOOL_SEQUENCE_EFFECTIVE:
        return this.recommendToolSequence(pattern)

      case PatternType.CONTEXT_WASTE_PATTERN:
        return this.recommendReduceContextWaste(pattern)

      case PatternType.RECURRENT_ERROR:
        return this.recommendFixRecurringError(pattern)

      case PatternType.COST_SPIKE:
        return this.recommendCostOptimization(pattern)

      case PatternType.TOOL_FAILURE_CORRELATION:
        return this.recommendToolFailureMitigation(pattern)

      default:
        return []
    }
  }

  /**
   * Recommend using an optimal model for a task type
   */
  private recommendModelForTask(pattern: Pattern): Recommendation[] {
    const model = pattern.metadata.model
    const taskType = pattern.metadata.taskType

    if (!model || !taskType) return []

    return [
      {
        id: `rec_${pattern.id}`,
        category: RecommendationCategory.PERFORMANCE,
        title: `Use ${model} for ${taskType} tasks`,
        description: `Based on past performance, ${model} achieves ${(pattern.confidence * 100).toFixed(0)}% success rate on ${taskType} tasks.`,
        rationale: pattern.evidence.map(e => `Observation: ${e.observation.type}`),
        confidence: pattern.confidence,
        impact: 'medium',
        effort: 'zero',
        actions: [RecommendationAction.CHANGE_MODEL],
        estimatedImprovement: {
          timeMs: -500, // 500ms faster (negative = improvement)
          successRatePp: (pattern.confidence - 0.8) * 100, // Assuming 80% baseline
        },
        createdAt: new Date(),
      },
    ]
  }

  /**
   * Recommend reinforcing successful tool sequences
   */
  private recommendToolSequence(pattern: Pattern): Recommendation[] {
    // Extract sequence from pattern ID
    const sequenceMatch = pattern.id.match(/tool_seq_(.+)/)
    if (!sequenceMatch) return []

    const sequence = sequenceMatch[1].split(' -> ')

    return [
      {
        id: `rec_seq_${pattern.id}`,
        category: RecommendationCategory.USABILITY,
        title: `Optimize tool permissions for common sequence`,
        description: `The sequence ${sequence.join(' → ')} is highly effective. Consider adding these tools to always-allow to reduce friction.`,
        rationale: [`Observed ${pattern.metadata.occurrenceCount} successful executions`],
        confidence: pattern.confidence,
        impact: 'low',
        effort: 'low',
        actions: [RecommendationAction.ADD_ALWAY_ALLOW_RULE],
        estimatedImprovement: {
          timeMs: -200, // Save 200ms per prompt by skipping permission prompts
        },
        createdAt: new Date(),
      },
    ]
  }

  /**
   * Recommend reducing context window waste
   */
  private recommendReduceContextWaste(pattern: Pattern): Recommendation[] {
    return [
      {
        id: `rec_waste_${pattern.id}`,
        category: RecommendationCategory.COST,
        title: 'Reduce context window waste',
        description: 'Significant tokens are being wasted in the context window. Consider using compact boundaries more frequently.',
        rationale: [
          `Average ${pattern.metadata.occurrenceCount} tokens wasted per turn`,
          'Context caching or smarter compaction could improve efficiency',
        ],
        confidence: pattern.confidence,
        impact: 'medium',
        effort: 'medium',
        actions: [RecommendationAction.ENABLE_FEATURE],
        estimatedImprovement: {
          costUsd: -0.05, // Save $0.05 per session
          contextTokensWasted: -50000,
        },
        createdAt: new Date(),
      },
    ]
  }

  /**
   * Recommend fix for recurring errors
   */
  private recommendFixRecurringError(pattern: Pattern): Recommendation[] {
    const toolName = pattern.metadata.toolName || 'tool'
    const errorCount = pattern.metadata.occurrenceCount

    return [
      {
        id: `rec_error_${pattern.id}`,
        category: RecommendationCategory.QUALITY,
        title: `Fix recurring ${toolName} errors`,
        description: `The error pattern occurred ${errorCount} times. Investigate the root cause and add error handling.`,
        rationale: [
          `Error type detected in ${toolName}`,
          `Occurred ${errorCount} times in this session`,
        ],
        confidence: pattern.confidence,
        impact: 'high',
        effort: 'medium',
        actions: [RecommendationAction.UPDATE_CONFIG, RecommendationAction.RUN_DIAGNOSTIC],
        estimatedImprovement: {
          successRatePp: 10, // Potential 10% improvement in success rate
        },
        createdAt: new Date(),
      },
    ]
  }

  /**
   * Recommend cost optimizations
   */
  private recommendCostOptimization(pattern: Pattern): Recommendation[] {
    return [
      {
        id: `rec_cost_${pattern.id}`,
        category: RecommendationCategory.COST,
        title: 'Enable Fast Mode for similar tasks',
        description: 'Detected cost spikes that could be mitigated with Fast Mode or smaller models.',
        rationale: [
          'Multiple high-cost operations observed',
          'Fast Mode typically reduces cost by 30-50% for coding tasks',
        ],
        confidence: pattern.confidence,
        impact: 'medium',
        effort: 'zero',
        actions: [RecommendationAction.ENABLE_FEATURE],
        estimatedImprovement: {
          costUsd: -0.10, // Save $0.10 per session
        },
        createdAt: new Date(),
      },
    ]
  }

  /**
   * Recommend mitigations for tool failures
   */
  private recommendToolFailureMitigation(pattern: Pattern): Recommendation[] {
    return [
      {
        id: `rec_tool_fail_${pattern.id}`,
        category: RecommendationCategory.USABILITY,
        title: 'Add tool to always-allow rules',
        description: 'Frequent permission prompts on this tool may be causing interruptions or failures.',
        rationale: [
          'Tool shows correlated failure patterns',
          'Permission friction is a likely contributor',
        ],
        confidence: pattern.confidence * 0.8, // Lower confidence due to correlation ≠ causation
        impact: 'low',
        effort: 'low',
        actions: [RecommendationAction.ADD_ALWAY_ALLOW_RULE],
        createdAt: new Date(),
      },
    ]
  }

  /**
   * Rank impact for sorting (high>medium>low)
   */
  private impactRank(rec: Recommendation): number {
    return rec.impact === 'high' ? 3 : rec.impact === 'medium' ? 2 : 1
  }
}

// Singleton
let globalRecommender: RecommendationSystem | null = null

export function getRecommendationSystem(): RecommendationSystem {
  if (!globalRecommender) {
    globalRecommender = new RecommendationSystem()
  }
  return globalRecommender
}

export function initRecommendationSystem(): RecommendationSystem {
  globalRecommender = new RecommendationSystem()
  return globalRecommender
}
