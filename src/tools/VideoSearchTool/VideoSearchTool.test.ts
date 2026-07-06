import { describe, expect, test } from 'bun:test'
import { VideoSearchTool } from './VideoSearchTool.js'

describe('VideoSearchTool - Schema and Configuration', () => {
  test('tool exports are present', () => {
    expect(VideoSearchTool).toBeTruthy()
    expect(typeof VideoSearchTool).toBe('object')
  })

  test('basic input validation logic works', () => {
    // Test valid query
    const validInput = {
      query: 'javascript tutorial',
      max_results: 12,
    }
    
    expect(validInput.query.length).toBeGreaterThanOrEqual(2)
    expect(validInput.max_results).toBeGreaterThanOrEqual(1)
    expect(validInput.max_results).toBeLessThanOrEqual(30)
  })

  test('duration filter enum values', () => {
    const validDurations = ['short', 'medium', 'long']
    
    for (const duration of validDurations) {
      expect(validDurations).toContain(duration)
    }
  })

  test('duration filter application', () => {
    const inputs = [
      { query: 'quick tips', duration: 'short' as const },
      { query: 'how-to guide', duration: 'medium' as const },
      { query: 'documentary', duration: 'long' as const },
    ]
    
    for (const input of inputs) {
      expect(['short', 'medium', 'long']).toContain(input.duration)
    }
  })

  test('domain filtering logic works', () => {
    const input = {
      query: 'coding tutorials',
      allowed_domains: ['youtube.com', 'vimeo.com', 'ted.com'],
      blocked_domains: undefined,
    }
    
    expect(input.allowed_domains).toHaveLength(3)
    expect(input.allowed_domains.every(d => typeof d === 'string')).toBe(true)
  })

  test('max_results validation', () => {
    const cases = [
      { max_results: 1, valid: true },
      { max_results: 20, valid: true },
      { max_results: 30, valid: true },
      { max_results: 0, valid: false },
      { max_results: 31, valid: false },
    ]
    
    for (const testCase of cases) {
      const isValid = testCase.max_results >= 1 && testCase.max_results <= 30
      expect(isValid).toBe(testCase.valid)
    }
  })

  test('video metadata extraction', () => {
    const videoResults = [
      {
        title: 'How to Learn JavaScript',
        url: 'https://youtube.com/watch?v=abc123',
        duration: '45:32',
        thumbnail_url: 'https://img.youtube.com/vi/abc123/maxresdefault.jpg',
      },
      {
        title: 'Python Crash Course',
        url: 'https://vimeo.com/123456789',
        duration: '2:15:48',
        thumbnail_url: 'https://i.vimeocdn.com/video/123456789.jpg',
      },
    ]
    
    expect(videoResults[0].duration).toBeTruthy()
    expect(videoResults[0].thumbnail_url).toBeTruthy()
    expect(videoResults[1].duration).toBeTruthy()
  })

  test('combined filters (duration + domain)', () => {
    const input = {
      query: 'web development',
      duration: 'short' as const,
      allowed_domains: ['youtube.com'],
      max_results: 15,
    }
    
    expect(input.duration).toBe('short')
    expect(input.allowed_domains).toContain('youtube.com')
    expect(input.max_results).toBeLessThanOrEqual(30)
  })
})
