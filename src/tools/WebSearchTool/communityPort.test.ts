import { afterEach, describe, expect, test } from 'bun:test'
import { runCommunityTextSearch } from './communityPort.js'

const originalFetch = globalThis.fetch

afterEach(() => {
  globalThis.fetch = originalFetch
})

describe('runCommunityTextSearch', () => {
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
})
