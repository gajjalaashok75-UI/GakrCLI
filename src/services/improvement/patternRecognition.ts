/**
 * Pattern Recognition Engine
 *
 * Analyzes collected metrics to identify patterns, correlations, and anomalies.
 * Generates insights for the recommendation system.
 */

import { MetricType } from './metricsCollector.js'
import type { MetricObservation, SessionMetrics } from './metricsCollector.js'

export interface Pattern {
  id: string
  type: PatternType
  confidence: number // 0-1, based on evidence strength
  description: string
  evidence: EvidencePoint[]
  metadata: PatternMetadata
}

export interface EvidencePoint {
  observation: MetricObservation
  significance: number // 0-1, how strongly this point supports the pattern
}

export interface PatternMetadata {
  taskType?: string
  toolName?: string
  model?: string
  timeOfDay?: string
  firstSeen: Date
  lastSeen: Date
  occurrenceCount: number
}

export enum PatternType {
  // Success patterns
  TOOL_SEQUENCE_EFFECTIVE = 'tool_sequence_effective',
  MODEL_OPTIMAL_FOR_TASK = 'model_optimal_for_task',
  PROMPT_VARIANT_BETTER = 'prompt_variant_better',

  // Failure patterns
  RECURRENT_ERROR = 'recurrent_error',
  TOOL_FAILURE_CORRELATION = 'tool_failure_correlation',
  CONTEXT_WASTE_PATTERN = 'context_waste_pattern',

  // Efficiency patterns
  COST_SPIKE = 'cost_spike',
  LATENCY_OUTLIER = 'latency_outlier',
  UNNECESSARY_TOOL_USE = 'unnecessary_tool_use',
}

class PatternRecognition {
  private patterns: Pattern[] = []
  private minEvidenceThreshold = 3 // Minimum observations to form a pattern

  /**
   * Analyze session metrics and extract patterns
   */
  analyze(sessionMetrics: SessionMetrics): Pattern[] {
    const newPatterns: Pattern[] = []

    // 1. Check for tool success sequences
    newPatterns.push(...this.detectToolSequences(sessionMetrics))

    // 2. Check for model efficiency patterns
    newPatterns.push(...this.detectModelEfficiency(sessionMetrics))

    // 3. Check for error patterns
    newPatterns.push(...this.detectErrorPatterns(sessionMetrics))

    // 4. Check for cost patterns
    newPatterns.push(...this.detectCostPatterns(sessionMetrics))

    // 5. Check for context waste
    newPatterns.push(...this.detectContextWaste(sessionMetrics))

    // Merge with existing patterns, update evidence counts
    this.mergePatterns(newPatterns)

    return newPatterns
  }

  /**
   * Detect effective and ineffective tool sequences
   */
  private detectToolSequences(sessionMetrics: SessionMetrics): Pattern[] {
    const patterns: Pattern[] = []
    const observations = sessionMetrics.observations

    // Find tool use events
    const toolUses = observations.filter(
      obs => obs.type === MetricType.TOOL_DURATION_MS || obs.type === MetricType.TOOL_USE_COUNT,
    )

    // Look for repeated patterns (same sequence of tools)
    const sequenceMap = new Map<string, { successes: number; failures: number }>()
    const sequence: string[] = []
    const windowSize = 3

    for (let i = 0; i <= toolUses.length - windowSize; i++) {
      const window = toolUses.slice(i, i + windowSize)
      const sequenceKey = window.map(o => o.tags.tool_name || 'unknown').join(' -> ')

      if (!sequenceMap.has(sequenceKey)) {
        sequenceMap.set(sequenceKey, { successes: 0, failures: 0 })
      }

      // Check if this sequence led to success
      const subsequentSuccess = observations.find(
        obs => obs.type === MetricType.SUCCESS && obs.timestamp > window[windowSize - 1].timestamp,
      )
      if (subsequentSuccess) {
        sequenceMap.get(sequenceKey)!.successes++
      } else {
        sequenceMap.get(sequenceKey)!.failures++
      }
    }

    // Generate patterns for high-success or high-failure sequences
    for (const [sequenceKey, counts] of sequenceMap) {
      const total = counts.successes + counts.failures
      if (total >= this.minEvidenceThreshold) {
        const successRate = counts.successes / total
        const pattern: Pattern = {
          id: `tool_seq_${sequenceKey.replace(/[^a-zA-Z0-9]/g, '_')}`,
          type: successRate > 0.7 ? PatternType.TOOL_SEQUENCE_EFFECTIVE : PatternType.TOOL_FAILURE_CORRELATION,
          confidence: Math.min(successRate, 1 - successRate),
          description: `Tool sequence ${successRate > 0.7 ? 'succeeds' : 'fails'} ${(successRate * 100).toFixed(0)}% of the time: ${sequenceKey}`,
          evidence: [], // Would populate with specific observations
          metadata: {
            firstSeen: sessionMetrics.startTime,
            lastSeen: sessionMetrics.endTime || new Date(),
            occurrenceCount: total,
          },
        }
        patterns.push(pattern)
      }
    }

    return patterns
  }

  /**
   * Detect which models perform best for specific task types
   */
  private detectModelEfficiency(sessionMetrics: SessionMetrics): Pattern[] {
    const patterns: Pattern[] = []
    const observations = sessionMetrics.observations

    // Group by model and task type
    const modelTaskSuccess = new Map<string, { successes: number; total: number }>()

    for (const obs of observations) {
      if (obs.type === MetricType.SUCCESS) {
        const model = obs.tags.model || obs.tags.mainLoopModel || 'unknown'
        const taskType = obs.tags.task_type || 'general'
        const key = `${model}|${taskType}`

        if (!modelTaskSuccess.has(key)) {
          modelTaskSuccess.set(key, { successes: 0, total: 0 })
        }
        modelTaskSuccess.get(key)!.total++
        modelTaskSuccess.get(key)!.successes += obs.value
      }
    }

    // Find models with high success rates for specific tasks
    for (const [key, counts] of modelTaskSuccess) {
      if (counts.total >= this.minEvidenceThreshold) {
        const [model, taskType] = key.split('|')
        const successRate = counts.successes / counts.total

        if (successRate >= 0.9) {
          patterns.push({
            id: `model_optimal_${model}_${taskType}`,
            type: PatternType.MODEL_OPTIMAL_FOR_TASK,
            confidence: successRate,
            description: `Model ${model} achieves ${(successRate * 100).toFixed(0)}% success rate on ${taskType} tasks`,
            evidence: [],
            metadata: {
              taskType,
              model,
              firstSeen: sessionMetrics.startTime,
              lastSeen: sessionMetrics.endTime || new Date(),
              occurrenceCount: counts.total,
            },
          })
        }
      }
    }

    return patterns
  }

  /**
   * Detect recurring errors and failure patterns
   */
  private detectErrorPatterns(sessionMetrics: SessionMetrics): Pattern[] {
    const patterns: Pattern[] = []
    const observations = sessionMetrics.observations

    // Group errors by type and tool
    const errorGroups = new Map<string, { count: number; messages: string[] }>()

    for (const obs of observations) {
      if (obs.type === MetricType.ERROR_COUNT && obs.value > 0) {
        const errorType = obs.tags.error_type || obs.tags.error_code || 'unknown'
        const tool = obs.tags.tool_name || 'system'
        const key = `${tool}:${errorType}`

        if (!errorGroups.has(key)) {
          errorGroups.set(key, { count: 0, messages: [] })
        }
        const group = errorGroups.get(key)!
        group.count++

        // Also capture any associated error message
        if (obs.tags.error_message) {
          group.messages.push(obs.tags.error_message)
        }
      }
    }

    // Report persistent error patterns
    for (const [key, data] of errorGroups) {
      if (data.count >= 2) {
        const [tool, errorType] = key.split(':')
        patterns.push({
          id: `error_${tool}_${errorType}`,
          type: PatternType.RECURRENT_ERROR,
          confidence: Math.min(data.count / 10, 1), // Capped at 10 occurrences
          description: `Recurring ${errorType} error in ${tool} (${data.count}x)`,
          evidence: [],
          metadata: {
            toolName: tool,
            firstSeen: sessionMetrics.startTime,
            lastSeen: sessionMetrics.endTime || new Date(),
            occurrenceCount: data.count,
          },
        })
      }
    }

    return patterns
  }

  /**
   * Detect cost anomalies and spending patterns
   */
  private detectCostPatterns(sessionMetrics: SessionMetrics): Pattern[] {
    const patterns: Pattern[] = []
    const costObservations = sessionMetrics.observations.filter(
      obs => obs.type === MetricType.COST_USD,
    )

    if (costObservations.length < 2) return patterns

    // Calculate average cost per turn
    const totalCost = costObservations.reduce((sum, obs) => sum + obs.value, 0)
    const avgCostPerObs = totalCost / costObservations.length

    // Look for spikes (3x average)
    const spikes = costObservations.filter(obs => obs.value > avgCostPerObs * 3)
    if (spikes.length >= 2) {
      patterns.push({
        id: 'cost_spike_detected',
        type: PatternType.COST_SPIKE,
        confidence: 0.8,
        description: `Detected ${spikes.length} cost spikes averaging $${spikes.reduce((s, o) => s + o.value, 0).toFixed(2)} each`,
        evidence: [],
        metadata: {
          firstSeen: sessionMetrics.startTime,
          lastSeen: sessionMetrics.endTime || new Date(),
          occurrenceCount: spikes.length,
        },
      })
    }

    return patterns
  }

  /**
   * Detect context window waste
   */
  private detectContextWaste(sessionMetrics: SessionMetrics): Pattern[] {
    const patterns: Pattern[] = []
    const wasteObservations = sessionMetrics.observations.filter(
      obs => obs.type === MetricType.CONTEXT_TOKENS_WASTED,
    )

    if (wasteObservations.length === 0) return patterns

    const avgWaste = wasteObservations.reduce((sum, obs) => sum + obs.value, 0) / wasteObservations.length
    const maxWaste = Math.max(...wasteObservations.map(o => o.value))

    if (avgWaste > 50000) { // 50k tokens wasted on average
      patterns.push({
        id: 'context_waste_high',
        type: PatternType.CONTEXT_WASTE_PATTERN,
        confidence: 0.9,
        description: `High context window waste detected: avg ${(avgWaste / 1000).toFixed(1)}k tokens per turn (max ${(maxWaste / 1000).toFixed(1)}k)`,
        evidence: [],
        metadata: {
          firstSeen: sessionMetrics.startTime,
          lastSeen: sessionMetrics.endTime || new Date(),
          occurrenceCount: wasteObservations.length,
        },
      })
    }

    return patterns
  }

  /**
   * Merge new patterns with existing ones, updating evidence and recency
   */
  private mergePatterns(newPatterns: Pattern[]): void {
    const now = new Date()

    for (const newPattern of newPatterns) {
      const existingIndex = this.patterns.findIndex(p => p.id === newPattern.id)

      if (existingIndex >= 0) {
        // Update existing pattern
        const existing = this.patterns[existingIndex]
        existing.evidence.push(...newPattern.evidence)
        existing.metadata.lastSeen = now
        existing.metadata.occurrenceCount += newPattern.metadata.occurrenceCount
        // Recalculate confidence based on increased evidence count
        existing.confidence = Math.min(1, existing.confidence + 0.1)
      } else {
        // Add new pattern
        this.patterns.push(newPattern)
      }
    }
  }

  /**
   * Get all identified patterns
   */
  getPatterns(): Pattern[] {
    return [...this.patterns]
  }

  /**
   * Get patterns by type
   */
  getPatternsByType(type: PatternType): Pattern[] {
    return this.patterns.filter(p => p.type === type)
  }

  /**
   * Clear patterns (for testing or privacy)
   */
  clear(): void {
    this.patterns = []
  }
}

// Singleton
let globalRecognizer: PatternRecognition | null = null

export function getPatternRecognition(): PatternRecognition {
  if (!globalRecognizer) {
    globalRecognizer = new PatternRecognition()
  }
  return globalRecognizer
}

export function initPatternRecognition(): PatternRecognition {
  globalRecognizer = new PatternRecognition()
  return globalRecognizer
}

export function resetPatternRecognition(): void {
  globalRecognizer = null
}
