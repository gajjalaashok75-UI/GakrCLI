import { describe, test, expect } from 'bun:test'
import { getRecommendationSystem, initRecommendationSystem, type RecommendationsResult, RecommendationCategory } from './recommendationSystem'
import { PatternType, type Pattern, type EvidencePoint } from './patternRecognition.js'
import type { MetricObservation } from './metricsCollector.js'

describe('RecommendationSystem', () => {
  // Initialize once
  initRecommendationSystem()

  // Helper to create evidence points with proper MetricObservation structure
  const createEvidence = (count: number, obsType?: MetricType): EvidencePoint[] => {
    const evidence: EvidencePoint[] = []
    for (let i = 0; i < count; i++) {
      evidence.push({
        observation: {
          id: `obs_${i}`,
          sessionId: 'test_session',
          timestamp: new Date(),
          type: obsType || 'tool_execution',
          value: 100,
          tags: {},
        } as MetricObservation,
        significance: 0.8,
      })
    }
    return evidence
  }

  const now = new Date()
  const oneHourAgo = new Date(now.getTime() - 3600000)

  const mockPatterns: Pattern[] = [
    {
      id: 'tool_seq_FileRead_AgentTool_FileWrite',
      type: PatternType.TOOL_SEQUENCE_EFFECTIVE,
      description: 'Tool sequence FileRead -> AgentTool -> FileWrite is highly effective',
      confidence: 0.9,
      evidence: createEvidence(5),
      metadata: {
        occurrenceCount: 10,
        firstSeen: oneHourAgo,
        lastSeen: now,
      },
    },
    {
      id: 'pattern_model_optimal',
      type: PatternType.MODEL_OPTIMAL_FOR_TASK,
      description: 'Claude-3-opus performs well on coding tasks',
      confidence: 0.92,
      evidence: createEvidence(8),
      metadata: {
        model: 'claude-3-opus',
        taskType: 'code_generation',
        occurrenceCount: 15,
        firstSeen: oneHourAgo,
        lastSeen: now,
      },
    },
    {
      id: 'pattern_context_waste',
      type: PatternType.CONTEXT_WASTE_PATTERN,
      description: 'Context window consistently underutilized',
      confidence: 0.75,
      evidence: createEvidence(4, 'context_tokens_wasted'),
      metadata: {
        occurrenceCount: 20,
        firstSeen: oneHourAgo,
        lastSeen: now,
      },
    },
  ]

  describe('generateFromPatterns', () => {
    test('generates recommendations from patterns', () => {
      const result: RecommendationsResult = getRecommendationSystem().generateFromPatterns(mockPatterns)

      expect(result).toHaveProperty('recommendations')
      expect(result).toHaveProperty('highPriorityCount')
      expect(result).toHaveProperty('totalPotentialImprovementMs')
      expect(result).toHaveProperty('totalPotentialSavingsUsd')
    })

    test('creates at least one recommendation per pattern', () => {
      const result: RecommendationsResult = getRecommendationSystem().generateFromPatterns(mockPatterns)

      expect(result.recommendations.length).toBeGreaterThanOrEqual(mockPatterns.length)
    })

    test('recommendations have required properties', () => {
      const result: RecommendationsResult = getRecommendationSystem().generateFromPatterns(mockPatterns)

      for (const rec of result.recommendations) {
        expect(rec).toHaveProperty('id')
        expect(rec).toHaveProperty('title')
        expect(rec).toHaveProperty('description')
        expect(rec).toHaveProperty('impact')
        expect(rec).toHaveProperty('confidence')
        expect(rec).toHaveProperty('actions')
        expect(rec).toHaveProperty('estimatedImprovement')
        expect(rec).toHaveProperty('rationale')
      }
    })

    test('recommendation impact levels are valid', () => {
      const result: RecommendationsResult = getRecommendationSystem().generateFromPatterns(mockPatterns)

      for (const rec of result.recommendations) {
        expect(['high', 'medium', 'low']).toContain(rec.impact)
      }
    })

    test('highPriorityCount is calculated correctly', () => {
      const result: RecommendationsResult = getRecommendationSystem().generateFromPatterns(mockPatterns)

      const highCount = result.recommendations.filter(r => r.impact === 'high').length
      expect(result.highPriorityCount).toBe(highCount)
    })

    test('returns empty recommendations for empty patterns', () => {
      const result: RecommendationsResult = getRecommendationSystem().generateFromPatterns([])

      expect(result.recommendations).toEqual([])
      expect(result.highPriorityCount).toBe(0)
      expect(result.totalPotentialImprovementMs).toBe(0)
      expect(result.totalPotentialSavingsUsd).toBe(0)
    })
  })

  describe('specific recommendations', () => {
    test('generates recommendation for repeated tool usage pattern', () => {
      const result: RecommendationsResult = getRecommendationSystem().generateFromPatterns([mockPatterns[0]])

      // Should produce at least one recommendation for effective tool sequence
      expect(result.recommendations.length).toBeGreaterThan(0)
      const rec = result.recommendations.find(r => r.category === RecommendationCategory.USABILITY)
      expect(rec).toBeDefined()
    })

    test('generates recommendation for model efficiency pattern', () => {
      const result: RecommendationsResult = getRecommendationSystem().generateFromPatterns([mockPatterns[1]])

      expect(result.recommendations.length).toBeGreaterThan(0)
      const rec = result.recommendations.find(r => r.title.toLowerCase().includes('opus'))
      expect(rec).toBeDefined()
    })

    test('recommendations include actionable steps', () => {
      const result: RecommendationsResult = getRecommendationSystem().generateFromPatterns(mockPatterns)

      for (const rec of result.recommendations) {
        expect(rec.actions.length).toBeGreaterThan(0)
        for (const action of rec.actions) {
          expect(typeof action).toBe('string')
          expect(action.length).toBeGreaterThan(0)
        }
      }
    })
  })

  describe('estimated improvement', () => {
    test('estimates time improvements for relevant recommendations', () => {
      const result: RecommendationsResult = getRecommendationSystem().generateFromPatterns(mockPatterns)

      const withTimeImprovement = result.recommendations.filter(r => r.estimatedImprovement.timeMs)
      // At least some recommendations should have time estimates
      expect(withTimeImprovement.length).toBeGreaterThan(0)
    })

    test('estimates cost savings for relevant recommendations', () => {
      const result: RecommendationsResult = getRecommendationSystem().generateFromPatterns(mockPatterns)

      const withCostSavings = result.recommendations.filter(r => r.estimatedImprovement.costUsd)
      // At least some recommendations should have cost estimates
      expect(withCostSavings.length).toBeGreaterThan(0)
    })

    test('time improvements are negative (faster)', () => {
      const result: RecommendationsResult = getRecommendationSystem().generateFromPatterns(mockPatterns)

      for (const rec of result.recommendations) {
        if (rec.estimatedImprovement.timeMs) {
          // Negative time indicates improvement (faster)
          expect(rec.estimatedImprovement.timeMs).toBeLessThan(0)
        }
      }
    })

    test('cost savings are negative (cheaper)', () => {
      const result: RecommendationsResult = getRecommendationSystem().generateFromPatterns(mockPatterns)

      for (const rec of result.recommendations) {
        if (rec.estimatedImprovement.costUsd) {
          // Negative cost indicates savings
          expect(rec.estimatedImprovement.costUsd).toBeLessThan(0)
        }
      }
    })
  })
})
