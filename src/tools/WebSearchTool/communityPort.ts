type DomainInput = {
  allowed_domains?: string[]
  blocked_domains?: string[]
}

type BaseSearchInput = DomainInput & {
  query: string
  max_results?: number
  retry_attempts?: number
  retry_backoff_seconds?: number
}

type VideoSearchInput = BaseSearchInput & {
  duration?: 'short' | 'medium' | 'long'
}

export type CommunityHit = {
  title: string
  url: string
  snippet?: string
  thumbnail_url?: string
  duration?: string
}

export type CommunitySearchResult = {
  hits: CommunityHit[]
  error?: string
}

type DuckModule = Record<string, unknown>
type DuckFn = (
  query: string,
  options?: Record<string, unknown>,
) => Promise<unknown>

const DEFAULT_MAX_RESULTS = 8
const DEFAULT_RETRY_ATTEMPTS = 2
const DEFAULT_RETRY_BACKOFF_SECONDS = 1

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function normalizeDomainRule(rule: string): string {
  return rule.trim().toLowerCase().replace(/^\.+/, '')
}

function hostMatchesRule(hostname: string, rule: string): boolean {
  const normalizedHost = hostname.toLowerCase()
  const normalizedRule = normalizeDomainRule(rule)
  return normalizedHost === normalizedRule || normalizedHost.endsWith(`.${normalizedRule}`)
}

function stripHtmlTags(text: string): string {
  return text.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
}

function normalizeSearchUrl(rawUrl: string): string | undefined {
  let url = rawUrl.trim()
  if (!url) {
    return undefined
  }

  if (url.startsWith('//')) {
    url = `https:${url}`
  } else if (url.startsWith('/')) {
    url = new URL(url, 'https://duckduckgo.com').toString()
  }

  try {
    const parsed = new URL(url)
    if (parsed.hostname.includes('duckduckgo.com')) {
      const redirected = parsed.searchParams.get('uddg') ?? parsed.searchParams.get('rut')
      if (redirected) {
        return decodeURIComponent(redirected)
      }
    }
    return parsed.toString()
  } catch {
    return undefined
  }
}

function passesDomainFilters(url: string, input: DomainInput): boolean {
  if (!input.allowed_domains?.length && !input.blocked_domains?.length) {
    return true
  }

  try {
    const normalized = normalizeSearchUrl(url)
    if (!normalized) {
      return false
    }
    const host = new URL(normalized).hostname

    if (input.blocked_domains?.some(rule => hostMatchesRule(host, rule))) {
      return false
    }

    if (input.allowed_domains?.length) {
      return input.allowed_domains.some(rule => hostMatchesRule(host, rule))
    }

    return true
  } catch {
    return false
  }
}

async function fetchHtmlFallback(
  query: string,
  maxResults: number,
  input: DomainInput,
): Promise<CommunityHit[]> {
  const endpoints = [
    `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`,
    `https://duckduckgo.com/html/?q=${encodeURIComponent(query)}`,
  ]

  for (const url of endpoints) {
    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
          Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9',
        },
      })

      if (!response.ok) {
        continue
      }

      const html = await response.text()
      const titleRegex = /<a[^>]*class="result__a"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g
      const snippetRegex = /class="result__snippet"[^>]*>([\s\S]*?)<\/(?:a|div)>/g

      const titles: Array<{ title: string; url: string }> = []
      let titleMatch: RegExpExecArray | null
      while ((titleMatch = titleRegex.exec(html)) !== null) {
        const normalizedUrl = normalizeSearchUrl(titleMatch[1])
        if (!normalizedUrl) {
          continue
        }
        const cleanTitle = stripHtmlTags(titleMatch[2])
        if (!cleanTitle) {
          continue
        }
        titles.push({ title: cleanTitle, url: normalizedUrl })
      }

      const snippets: string[] = []
      let snippetMatch: RegExpExecArray | null
      while ((snippetMatch = snippetRegex.exec(html)) !== null) {
        snippets.push(stripHtmlTags(snippetMatch[1]))
      }

      const hits: CommunityHit[] = titles
        .map((entry, index) => ({
          title: entry.title,
          url: entry.url,
          snippet: snippets[index],
        }))
        .filter(hit => passesDomainFilters(hit.url, input))
        .slice(0, maxResults)

      if (hits.length > 0) {
        return hits
      }
    } catch {
      // Try the next fallback endpoint.
    }
  }

  return []
}

// Bing fallback removed — Bing's HTML structure is dynamic and no longer
// supports static scraping. Use Firecrawl or DuckDuckGo instead.
// async function fetchBingWebFallback(...): Promise<CommunityHit[]> { ... }

function toResultArray(raw: unknown): unknown[] {
  if (Array.isArray(raw)) {
    return raw
  }
  if (raw && typeof raw === 'object') {
    const obj = raw as Record<string, unknown>
    if (Array.isArray(obj.results)) {
      return obj.results
    }
    if (Array.isArray(obj.data)) {
      return obj.data
    }
  }
  return []
}

function pickFirstString(
  item: Record<string, unknown>,
  keys: string[],
): string | undefined {
  for (const key of keys) {
    const value = item[key]
    if (typeof value === 'string' && value.trim().length > 0) {
      return value
    }
  }
  return undefined
}

function rankTextHits(hits: CommunityHit[]): CommunityHit[] {
  const scored = hits.map((hit, index) => {
    let score = 0

    const titleWords = hit.title.split(/\s+/).filter(Boolean).length
    if (titleWords >= 5 && titleWords <= 15) {
      score += 0.25
    } else if (titleWords >= 2) {
      score += 0.1
    }

    const snippetWords = (hit.snippet ?? '').split(/\s+/).filter(Boolean).length
    if (snippetWords > 20) {
      score += 0.25
    } else if (snippetWords > 10) {
      score += 0.15
    }

    const positionScore = (1 - index / Math.max(hits.length, 1)) * 0.25
    score += positionScore

    if (/[.]edu|[.]gov|[.]org/i.test(hit.url)) {
      score += 0.15
    }
    if (hit.url.length > 100) {
      score -= 0.05
    }

    return { hit, score }
  })

  return scored
    .sort((a, b) => b.score - a.score)
    .map(entry => entry.hit)
}

function rankImageHits(hits: CommunityHit[]): CommunityHit[] {
  const scored = hits.map((hit, index) => {
    let score = 0

    if (hit.title.split(/\s+/).filter(Boolean).length >= 2) {
      score += 0.2
    }

    if (hit.thumbnail_url) {
      score += 0.25
    }

    if (/(flickr|deviantart|unsplash|pexels|pixabay)/i.test(hit.url)) {
      score += 0.25
    }

    const positionScore = (1 - index / Math.max(hits.length, 1)) * 0.2
    score += positionScore

    return { hit, score }
  })

  return scored
    .sort((a, b) => b.score - a.score)
    .map(entry => entry.hit)
}

function rankVideoHits(hits: CommunityHit[]): CommunityHit[] {
  const scored = hits.map((hit, index) => {
    let score = 0

    const titleWords = hit.title.split(/\s+/).filter(Boolean).length
    if (titleWords >= 3 && titleWords <= 15) {
      score += 0.25
    } else if (titleWords >= 2) {
      score += 0.1
    }

    const snippetWords = (hit.snippet ?? '').split(/\s+/).filter(Boolean).length
    if (snippetWords > 20) {
      score += 0.25
    } else if (snippetWords > 10) {
      score += 0.15
    }

    const positionScore = (1 - index / Math.max(hits.length, 1)) * 0.2
    score += positionScore

    if (/(youtube|vimeo|ted)/i.test(hit.url)) {
      score += 0.15
    }

    return { hit, score }
  })

  return scored
    .sort((a, b) => b.score - a.score)
    .map(entry => entry.hit)
}

function getDuckFn(module: DuckModule, names: string[]): DuckFn | undefined {
  for (const name of names) {
    const fn = module[name]
    if (typeof fn === 'function') {
      return fn as DuckFn
    }
  }
  return undefined
}

async function runAttempts(
  fn: DuckFn,
  query: string,
  attempts: Array<Record<string, unknown> | undefined>,
): Promise<unknown[]> {
  for (const options of attempts) {
    try {
      const raw = await fn(query, options)
      const parsed = toResultArray(raw)
      if (parsed.length > 0) {
        return parsed
      }
    } catch {
      // Try next call pattern.
    }
  }

  return []
}

export async function runCommunityTextSearch(
  input: BaseSearchInput,
): Promise<CommunitySearchResult> {
  try {
    const maxResults = input.max_results ?? DEFAULT_MAX_RESULTS
    const htmlFirstHits = await fetchHtmlFallback(input.query, maxResults, input)
    if (htmlFirstHits.length > 0) {
      return { hits: rankTextHits(htmlFirstHits).slice(0, maxResults) }
    }

    const duck = (await import('duck-duck-scrape')) as DuckModule
    const searchFn = getDuckFn(duck, ['search'])

    if (!searchFn) {
      return { hits: [], error: 'duck-duck-scrape text search API not available' }
    }

    const retries = Math.max(0, input.retry_attempts ?? DEFAULT_RETRY_ATTEMPTS)
    const backoffMs =
      (input.retry_backoff_seconds ?? DEFAULT_RETRY_BACKOFF_SECONDS) * 1000

    for (let attempt = 0; attempt <= retries; attempt++) {
      const rawResults = await runAttempts(searchFn, input.query, [
        { safeSearch: 0, maxResults },
        { safeSearch: 1, maxResults },
        { maxResults },
        undefined,
      ])

      const normalized: CommunityHit[] = rawResults
        .flatMap(entry => {
          const item = entry as Record<string, unknown>
          const rawUrl = pickFirstString(item, ['url', 'href', 'link'])
          const url = rawUrl ? normalizeSearchUrl(rawUrl) : undefined
          if (!url) {
            return []
          }

          const title = pickFirstString(item, ['title']) ?? url
          const snippet = pickFirstString(item, [
            'description',
            'body',
            'snippet',
            'content',
          ])

          return [
            {
              title,
              url,
              snippet,
            },
          ]
        })
        .filter(hit => passesDomainFilters(hit.url, input))

      const ranked = rankTextHits(normalized).slice(0, maxResults)
      if (ranked.length > 0) {
        return { hits: ranked }
      }

      if (attempt === retries) {
        const fallbackHits = await fetchHtmlFallback(input.query, maxResults, input)
        if (fallbackHits.length > 0) {
          return { hits: rankTextHits(fallbackHits).slice(0, maxResults) }
        }
        // Bing fallback removed — no longer reliable
      }

      if (attempt < retries) {
        await sleep(backoffMs)
      }
    }

    return { hits: [] }
  } catch (error) {
    return {
      hits: [],
      error: error instanceof Error ? error.message : String(error),
    }
  }
}

export async function runCommunityImageSearch(
  input: BaseSearchInput,
): Promise<CommunitySearchResult> {
  try {
    const maxResults = input.max_results ?? DEFAULT_MAX_RESULTS
    const htmlFirstHits = await fetchHtmlFallback(
      `${input.query} images`,
      maxResults,
      input,
    )
    if (htmlFirstHits.length > 0) {
      return { hits: rankImageHits(htmlFirstHits).slice(0, maxResults) }
    }

    const duck = (await import('duck-duck-scrape')) as DuckModule
    const searchFn = getDuckFn(duck, ['searchImages', 'images', 'search_images'])

    if (!searchFn) {
      return { hits: [], error: 'duck-duck-scrape image search API not available' }
    }

    const retries = Math.max(0, input.retry_attempts ?? DEFAULT_RETRY_ATTEMPTS)
    const backoffMs =
      (input.retry_backoff_seconds ?? DEFAULT_RETRY_BACKOFF_SECONDS) * 1000

    for (let attempt = 0; attempt <= retries; attempt++) {
      const rawResults = await runAttempts(searchFn, input.query, [
        { safeSearch: 0, moderate: true, limit: maxResults },
        { safeSearch: 1, limit: maxResults },
        { limit: maxResults },
        undefined,
      ])

      const normalized: CommunityHit[] = rawResults
        .flatMap(entry => {
          const item = entry as Record<string, unknown>
          const rawUrl = pickFirstString(item, ['url', 'source', 'href', 'image'])
          const url = rawUrl ? normalizeSearchUrl(rawUrl) : undefined
          if (!url) {
            return []
          }

          const title = pickFirstString(item, ['title', 'alt']) ?? url
          const thumbnailUrl = pickFirstString(item, [
            'thumbnail',
            'image',
            'thumbnail_url',
          ])
          const snippet = pickFirstString(item, ['description', 'body'])

          return [
            {
              title,
              url,
              thumbnail_url: thumbnailUrl,
              snippet,
            },
          ]
        })
        .filter(hit => passesDomainFilters(hit.url, input))

      const ranked = rankImageHits(normalized).slice(0, maxResults)
      if (ranked.length > 0) {
        return { hits: ranked }
      }

      if (attempt === retries) {
        const fallbackHits = await fetchHtmlFallback(
          `${input.query} images`,
          maxResults,
          input,
        )
        if (fallbackHits.length > 0) {
          return { hits: rankImageHits(fallbackHits).slice(0, maxResults) }
        }
        // Bing fallback removed — no longer reliable
      }

      if (attempt < retries) {
        await sleep(backoffMs)
      }
    }

    return { hits: [] }
  } catch (error) {
    return {
      hits: [],
      error: error instanceof Error ? error.message : String(error),
    }
  }
}

export async function runCommunityVideoSearch(
  input: VideoSearchInput,
): Promise<CommunitySearchResult> {
  try {
    const maxResults = input.max_results ?? DEFAULT_MAX_RESULTS
    const htmlFirstHits = await fetchHtmlFallback(
      `${input.query} video site:youtube.com`,
      maxResults,
      input,
    )
    if (htmlFirstHits.length > 0) {
      return { hits: rankVideoHits(htmlFirstHits).slice(0, maxResults) }
    }

    const duck = (await import('duck-duck-scrape')) as DuckModule
    const searchFn = getDuckFn(duck, ['searchVideos', 'videos', 'search_videos'])

    if (!searchFn) {
      return { hits: [], error: 'duck-duck-scrape video search API not available' }
    }

    const retries = Math.max(0, input.retry_attempts ?? DEFAULT_RETRY_ATTEMPTS)
    const backoffMs =
      (input.retry_backoff_seconds ?? DEFAULT_RETRY_BACKOFF_SECONDS) * 1000

    for (let attempt = 0; attempt <= retries; attempt++) {
      const rawResults = await runAttempts(searchFn, input.query, [
        { safeSearch: 0, limit: maxResults, duration: input.duration },
        { limit: maxResults, duration: input.duration },
        { limit: maxResults },
        undefined,
      ])

      const normalized: CommunityHit[] = rawResults
        .flatMap(entry => {
          const item = entry as Record<string, unknown>
          const rawUrl = pickFirstString(item, ['url', 'href', 'content'])
          const url = rawUrl ? normalizeSearchUrl(rawUrl) : undefined
          if (!url) {
            return []
          }

          const title = pickFirstString(item, ['title', 'content']) ?? url
          const snippet = pickFirstString(item, [
            'description',
            'body',
            'snippet',
          ])
          const duration = pickFirstString(item, ['duration'])

          return [
            {
              title,
              url,
              snippet,
              duration,
            },
          ]
        })
        .filter(hit => passesDomainFilters(hit.url, input))

      const ranked = rankVideoHits(normalized).slice(0, maxResults)
      if (ranked.length > 0) {
        return { hits: ranked }
      }

      if (attempt === retries) {
        const fallbackHits = await fetchHtmlFallback(
          `${input.query} video site:youtube.com`,
          maxResults,
          input,
        )
        if (fallbackHits.length > 0) {
          return { hits: rankVideoHits(fallbackHits).slice(0, maxResults) }
        }
        // Bing fallback removed — no longer reliable
      }

      if (attempt < retries) {
        await sleep(backoffMs)
      }
    }

    return { hits: [] }
  } catch (error) {
    return {
      hits: [],
      error: error instanceof Error ? error.message : String(error),
    }
  }
}
