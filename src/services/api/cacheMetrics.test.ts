import { describe, expect, test } from 'bun:test'
import {
  addCacheMetrics,
  buildAnthropicUsageFromRawUsage,
  extractCacheMetrics,
  extractCacheReadFromRawUsage,
  formatCacheMetricsCompact,
  formatCacheMetricsFull,
  resolveCacheProvider,
  type CacheMetrics,
} from './cacheMetrics.js'

describe('extractCacheReadFromRawUsage', () => {
  test('reads Anthropic native shape', () => {
    expect(extractCacheReadFromRawUsage({ cache_read_input_tokens: 500 })).toBe(500)
  })

  test('reads OpenAI nested shape', () => {
    expect(extractCacheReadFromRawUsage({
      prompt_tokens_details: { cached_tokens: 300 }
    })).toBe(300)
  })

  test('reads Kimi top-level shape', () => {
    expect(extractCacheReadFromRawUsage({ cached_tokens: 200 })).toBe(200)
  })

  test('reads DeepSeek shape', () => {
    expect(extractCacheReadFromRawUsage({ prompt_cache_hit_tokens: 400 })).toBe(400)
  })

  test('reads Gemini shape', () => {
    expect(extractCacheReadFromRawUsage({ cached_content_token_count: 600 })).toBe(600)
  })

  test('returns 0 for unsupported shapes', () => {
    expect(extractCacheReadFromRawUsage({})).toBe(0)
    expect(extractCacheReadFromRawUsage(null)).toBe(0)
    expect(extractCacheReadFromRawUsage(undefined)).toBe(0)
  })
})

describe('buildAnthropicUsageFromRawUsage', () => {
  test('converts OpenAI shape to Anthropic shape', () => {
    const result = buildAnthropicUsageFromRawUsage({
      prompt_tokens: 1000,
      completion_tokens: 200,
      prompt_tokens_details: { cached_tokens: 400 }
    })
    expect(result.input_tokens).toBe(600) // 1000 - 400
    expect(result.output_tokens).toBe(200)
    expect(result.cache_read_input_tokens).toBe(400)
    expect(result.cache_creation_input_tokens).toBe(0)
  })

  test('handles Anthropic native passthrough', () => {
    const result = buildAnthropicUsageFromRawUsage({
      input_tokens: 500,
      output_tokens: 100,
      cache_read_input_tokens: 300,
      cache_creation_input_tokens: 50
    })
    expect(result.input_tokens).toBe(200) // 500 - 300
    expect(result.cache_read_input_tokens).toBe(300)
  })
})

describe('extractCacheMetrics', () => {
  test('extracts metrics from Anthropic-shaped usage', () => {
    const metrics = extractCacheMetrics({
      input_tokens: 200,
      cache_read_input_tokens: 800,
      cache_creation_input_tokens: 100
    }, 'anthropic')
    expect(metrics.read).toBe(800)
    expect(metrics.created).toBe(100)
    expect(metrics.total).toBe(1100)
    expect(metrics.hitRate).toBeCloseTo(800 / 1100, 4)
    expect(metrics.supported).toBe(true)
  })

  test('returns unsupported for copilot', () => {
    const metrics = extractCacheMetrics({
      input_tokens: 500,
      cache_read_input_tokens: 0
    }, 'copilot')
    expect(metrics.supported).toBe(false)
  })

  test('returns unsupported for ollama', () => {
    const metrics = extractCacheMetrics({
      input_tokens: 500,
      cache_read_input_tokens: 0
    }, 'ollama')
    expect(metrics.supported).toBe(false)
  })
})

describe('formatCacheMetricsCompact', () => {
  test('formats supported metrics with read and hit rate', () => {
    const metrics: CacheMetrics = {
      read: 1200,
      created: 0,
      total: 2000,
      hitRate: 0.6,
      supported: true
    }
    expect(formatCacheMetricsCompact(metrics)).toBe('[Cache: 1.2k read • hit 60%]')
  })

  test('formats cold cache', () => {
    const metrics: CacheMetrics = {
      read: 0,
      created: 0,
      total: 500,
      hitRate: 0,
      supported: true
    }
    expect(formatCacheMetricsCompact(metrics)).toBe('[Cache: cold]')
  })

  test('formats unsupported provider', () => {
    const metrics: CacheMetrics = {
      read: 0,
      created: 0,
      total: 0,
      hitRate: null,
      supported: false
    }
    expect(formatCacheMetricsCompact(metrics)).toBe('[Cache: N/A]')
  })
})

describe('formatCacheMetricsFull', () => {
  test('formats full breakdown', () => {
    const metrics: CacheMetrics = {
      read: 1200,
      created: 340,
      total: 2000,
      hitRate: 0.6,
      supported: true
    }
    expect(formatCacheMetricsFull(metrics)).toBe('[Cache: read=1.2k created=340 hit=60%]')
  })

  test('formats unsupported provider', () => {
    const metrics: CacheMetrics = {
      read: 0,
      created: 0,
      total: 0,
      hitRate: null,
      supported: false
    }
    expect(formatCacheMetricsFull(metrics)).toBe('[Cache: N/A]')
  })
})

describe('addCacheMetrics', () => {
  test('sums two supported metrics', () => {
    const a: CacheMetrics = { read: 100, created: 50, total: 500, hitRate: 0.2, supported: true }
    const b: CacheMetrics = { read: 200, created: 100, total: 800, hitRate: 0.25, supported: true }
    const result = addCacheMetrics(a, b)
    expect(result.read).toBe(300)
    expect(result.created).toBe(150)
    expect(result.total).toBe(1300)
    expect(result.hitRate).toBeCloseTo(300 / 1300, 4)
  })

  test('returns unsupported when both are unsupported', () => {
    const a: CacheMetrics = { read: 0, created: 0, total: 0, hitRate: null, supported: false }
    const b: CacheMetrics = { read: 0, created: 0, total: 0, hitRate: null, supported: false }
    const result = addCacheMetrics(a, b)
    expect(result.supported).toBe(false)
  })
})

describe('resolveCacheProvider', () => {
  test('resolves anthropic providers', () => {
    expect(resolveCacheProvider('firstParty')).toBe('anthropic')
    expect(resolveCacheProvider('bedrock')).toBe('anthropic')
    expect(resolveCacheProvider('vertex')).toBe('anthropic')
  })

  test('resolves github with hints', () => {
    expect(resolveCacheProvider('github', { githubNativeAnthropic: true })).toBe('copilot-claude')
    expect(resolveCacheProvider('github', { githubNativeAnthropic: false })).toBe('copilot')
  })

  test('resolves self-hosted from private URLs', () => {
    expect(resolveCacheProvider('openai', { openAiBaseUrl: 'http://192.168.1.50:8000/v1' })).toBe('self-hosted')
    expect(resolveCacheProvider('openai', { openAiBaseUrl: 'http://localhost:8000/v1' })).toBe('self-hosted')
  })

  test('resolves vendor-specific providers', () => {
    expect(resolveCacheProvider('openai', { openAiBaseUrl: 'https://api.moonshot.ai/v1' })).toBe('kimi')
    expect(resolveCacheProvider('openai', { openAiBaseUrl: 'https://api.deepseek.com/v1' })).toBe('deepseek')
  })
})
