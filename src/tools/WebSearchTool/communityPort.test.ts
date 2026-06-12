import { afterEach, describe, expect, mock, test } from 'bun:test'
import {
  runCommunityImageSearch,
  runCommunityTextSearch,
  runCommunityVideoSearch,
} from './communityPort.js'

const originalFetch = globalThis.fetch
type DuckCall = [
  string,
  Record<string, unknown> | undefined,
  Record<string, unknown> | undefined,
]

let searchImagesCalls: DuckCall[] = []
let searchVideosCalls: DuckCall[] = []
let searchImagesImpl: (...args: DuckCall) => Promise<unknown> = async () => ({
  results: [],
})
let searchVideosImpl: (...args: DuckCall) => Promise<unknown> = async () => ({
  results: [],
})

mock.module('duck-duck-scrape', () => ({
  SafeSearchType: {
    STRICT: 0,
    MODERATE: -1,
    OFF: -2,
  },
  searchImages: async (...args: DuckCall) => {
    searchImagesCalls.push(args)
    return searchImagesImpl(...args)
  },
  searchVideos: async (...args: DuckCall) => {
    searchVideosCalls.push(args)
    return searchVideosImpl(...args)
  },
}))

afterEach(() => {
  globalThis.fetch = originalFetch
  searchImagesCalls = []
  searchVideosCalls = []
  searchImagesImpl = async () => ({ results: [] })
  searchVideosImpl = async () => ({ results: [] })
})

describe('community DuckDuckGo search adapter', () => {
  test('parses DuckDuckGo HTML results regardless of anchor attribute order', async () => {
    const html = `
      <html>
        <body>
          <a rel="nofollow" class="result__a" href="//duckduckgo.com/l/?uddg=https%3A%2F%2Fopenai.com%2F&amp;rut=abc">
            OpenAI | Research &amp; Deployment
          </a>
          <a class="result__snippet">Creating safe and beneficial AI systems.</a>
        </body>
      </html>
    `

    globalThis.fetch = (async () =>
      new Response(html, {
        status: 200,
        headers: { 'content-type': 'text/html' },
      })) as typeof fetch

    const result = await runCommunityTextSearch({
      query: 'OpenAI official website',
      max_results: 2,
      retry_attempts: 0,
    })

    expect(result.error).toBeUndefined()
    expect(result.hits).toHaveLength(1)
    expect(result.hits[0].title).toBe('OpenAI | Research & Deployment')
    expect(result.hits[0].url).toBe('https://openai.com/')
    expect(result.hits[0].snippet).toBe(
      'Creating safe and beneficial AI systems.',
    )
  })

  test('uses structured DuckDuckGo image results before HTML fallback', async () => {
    searchImagesImpl = async () => ({
      results: [
        {
          title: 'OpenAI logo',
          url: 'https://openai.com/brand',
          image: 'https://images.example/openai.png',
          thumbnail: 'https://images.example/openai-thumb.png',
          source: 'OpenAI',
        },
      ],
    })
    globalThis.fetch = (async () =>
      new Response('', { status: 500 })) as typeof fetch

    const result = await runCommunityImageSearch({
      query: 'OpenAI logo',
      max_results: 1,
      retry_attempts: 0,
    })

    // Now with parallel retries, both safeSearch levels are attempted concurrently
    expect(searchImagesCalls.length).toBeGreaterThan(0)
    expect(searchImagesCalls[0][1]?.safeSearch).toBe(-2)
    expect(searchImagesCalls[0][2]?.headers).toBeTruthy()
    expect(result.hits).toEqual([
      {
        title: 'OpenAI logo',
        url: 'https://openai.com/brand',
        thumbnail_url: 'https://images.example/openai-thumb.png',
        snippet: 'OpenAI',
      },
    ])
  })

  test('uses structured DuckDuckGo video results with duration filters', async () => {
    searchVideosImpl = async () => ({
      results: [
        {
          title: 'Node.js Tutorial',
          url: 'https://www.youtube.com/watch?v=abc',
          description: 'A practical Node.js tutorial.',
          image: 'https://img.youtube.com/vi/abc/hqdefault.jpg',
          duration: '4:20',
        },
      ],
    })
    globalThis.fetch = (async () =>
      new Response('', { status: 500 })) as typeof fetch

    const result = await runCommunityVideoSearch({
      query: 'node js tutorial',
      max_results: 1,
      retry_attempts: 0,
      duration: 'short',
    })

    // Now with parallel retries, both safeSearch levels are attempted concurrently
    expect(searchVideosCalls.length).toBeGreaterThan(0)
    expect(searchVideosCalls[0][1]).toMatchObject({
      safeSearch: -2,
      duration: 'short',
    })
    expect(searchVideosCalls[0][2]?.headers).toBeTruthy()
    expect(result.hits).toEqual([
      {
        title: 'Node.js Tutorial',
        url: 'https://www.youtube.com/watch?v=abc',
        snippet: 'A practical Node.js tutorial.',
        duration: '4:20',
        thumbnail_url: 'https://img.youtube.com/vi/abc/hqdefault.jpg',
      },
    ])
  })
})
