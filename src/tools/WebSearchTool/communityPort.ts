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
  requestOptions?: Record<string, unknown>,
) => Promise<unknown>

const DEFAULT_MAX_RESULTS = 8
const DEFAULT_RETRY_ATTEMPTS = 2
const DEFAULT_RETRY_BACKOFF_SECONDS = 1
const DEFAULT_REQUEST_TIMEOUT_MS = 8000
const DUCK_SAFE_SEARCH_OFF = -2
const DUCK_SAFE_SEARCH_MODERATE = -1

// User-Agent rotation to avoid detection
const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:128.0) Gecko/20100101 Firefox/128.0',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15',
]

// Simple in-memory cache for search results (LRU-like)
const searchCache = new Map<string, { result: CommunitySearchResult; timestamp: number }>()
const CACHE_TTL_MS = 300000 // 5 minutes

function getRandomUserAgent(): string {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)]
}

function getDuckRequestOptions(): Record<string, unknown> {
  return {
    headers: {
      'sec-ch-ua': '"Not=A?Brand";v="8", "Chromium";v="129"',
      'sec-ch-ua-mobile': '?0',
      'sec-ch-ua-platform': '"Windows"',
      'sec-fetch-dest': 'document',
      'sec-fetch-mode': 'navigate',
      'sec-fetch-site': 'none',
      'sec-fetch-user': '?1',
      'sec-gpc': '1',
      'upgrade-insecure-requests': '1',
      accept: 'application/json,text/javascript,*/*;q=0.8',
      referer: 'https://duckduckgo.com/',
      'user-agent': getRandomUserAgent(),
    },
  }
}

function getCacheKey(query: string, type: 'text' | 'image' | 'video', duration?: string): string {
  const key = `${type}:${query}`
  return duration ? `${key}:${duration}` : key
}

function getFromCache(cacheKey: string): CommunitySearchResult | null {
  const cached = searchCache.get(cacheKey)
  if (!cached) return null
  
  const now = Date.now()
  if (now - cached.timestamp > CACHE_TTL_MS) {
    searchCache.delete(cacheKey)
    return null
  }
  
  return cached.result
}

function setInCache(cacheKey: string, result: CommunitySearchResult): void {
  searchCache.set(cacheKey, { result, timestamp: Date.now() })
  
  // Simple LRU: keep cache size under 100 entries
  if (searchCache.size > 100) {
    const firstKey = searchCache.keys().next().value
    if (firstKey) searchCache.delete(firstKey)
  }
}

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

function isDuckDuckGoHost(hostname: string): boolean {
  return hostMatchesRule(hostname, 'duckduckgo.com')
}

function stripHtmlTags(text: string): string {
  return decodeHtmlEntities(
    text.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim(),
  )
}

function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
}

function normalizeSearchUrl(rawUrl: string): string | undefined {
  let url = decodeHtmlEntities(rawUrl.trim())
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
    if (isDuckDuckGoHost(parsed.hostname)) {
      for (const key of ['uddg', 'u', 'u3']) {
        const redirected = parsed.searchParams.get(key)
        if (!redirected) {
          continue
        }
        const decoded = decodeURIComponent(redirected)
        try {
          return new URL(decoded).toString()
        } catch {
          // Keep looking; some DDG params are tracking tokens, not URLs.
        }
      }
      return undefined
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

function isUsableResultUrl(url: string): boolean {
  try {
    return !isDuckDuckGoHost(new URL(url).hostname)
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

  const searches = endpoints.map(async url => {
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
        return []
      }

      const html = await response.text()
      const titleRegex =
        /<a\b(?=[^>]*\bclass=["'][^"']*\bresult__a\b[^"']*["'])(?=[^>]*\bhref=["']([^"']+)["'])[^>]*>([\s\S]*?)<\/a>/g
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
        .filter(hit => isUsableResultUrl(hit.url))
        .slice(0, maxResults)

      return hits
    } catch {
      return []
    }
  })

  const settled = await Promise.allSettled(searches)
  for (const result of settled) {
    if (result.status === 'fulfilled' && result.value.length > 0) {
      return result.value
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
  // Deduplicate by URL first
  const seen = new Set<string>()
  const unique = hits.filter(hit => {
    if (seen.has(hit.url)) return false
    seen.add(hit.url)
    return true
  })

  const scored = unique.map((hit, index) => {
    let score = 0

    // Title quality: prefer titles with 5-15 words (neither too short nor too long)
    const titleWords = hit.title.split(/\s+/).filter(Boolean).length
    if (titleWords >= 8 && titleWords <= 12) {
      score += 0.35
    } else if (titleWords >= 5 && titleWords <= 15) {
      score += 0.25
    } else if (titleWords >= 2) {
      score += 0.1
    }

    // Snippet quality: longer, more informative snippets score higher
    const snippetWords = (hit.snippet ?? '').split(/\s+/).filter(Boolean).length
    if (snippetWords > 40) {
      score += 0.35
    } else if (snippetWords > 20) {
      score += 0.25
    } else if (snippetWords > 10) {
      score += 0.15
    }

    // Position score: earlier results get higher scores
    const positionScore = (1 - index / Math.max(unique.length, 1)) * 0.2
    score += positionScore

    // Domain authority: educational/government/non-profit domains score higher
    if (/[.]edu|[.]gov|[.]org/i.test(hit.url)) {
      score += 0.2
    }
    
    // Penalize commercial domains slightly
    if (/[.]com|[.]co/i.test(hit.url)) {
      score += 0.05
    }

    // Penalize extremely long URLs (likely tracking/complex URLs)
    if (hit.url.length > 150) {
      score -= 0.1
    }

    // Penalize short URLs (often low-quality or redirects)
    if (hit.url.length < 20) {
      score -= 0.05
    }

    return { hit, score }
  })

  return scored
    .sort((a, b) => b.score - a.score)
    .map(entry => entry.hit)
}

function rankImageHits(hits: CommunityHit[]): CommunityHit[] {
  // Deduplicate by thumbnail_url or URL
  const seen = new Set<string>()
  const unique = hits.filter(hit => {
    const key = hit.thumbnail_url || hit.url
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })

  const scored = unique.map((hit, index) => {
    let score = 0

    // Title quality
    const titleWords = hit.title.split(/\s+/).filter(Boolean).length
    if (titleWords >= 2 && titleWords <= 10) {
      score += 0.3
    } else if (titleWords >= 2) {
      score += 0.2
    }

    // Thumbnail availability (very important for images)
    if (hit.thumbnail_url) {
      score += 0.35
    }

    // Reputable image sources
    if (/(flickr|deviantart|unsplash|pexels|pixabay|getty|istockphoto|shutterstock)/i.test(hit.url)) {
      score += 0.3
    }

    // Position score
    const positionScore = (1 - index / Math.max(unique.length, 1)) * 0.15
    score += positionScore

    return { hit, score }
  })

  return scored
    .sort((a, b) => b.score - a.score)
    .map(entry => entry.hit)
}

function rankVideoHits(hits: CommunityHit[]): CommunityHit[] {
  // Deduplicate by URL
  const seen = new Set<string>()
  const unique = hits.filter(hit => {
    if (seen.has(hit.url)) return false
    seen.add(hit.url)
    return true
  })

  const scored = unique.map((hit, index) => {
    let score = 0

    // Title quality: video titles typically 3-20 words
    const titleWords = hit.title.split(/\s+/).filter(Boolean).length
    if (titleWords >= 5 && titleWords <= 15) {
      score += 0.3
    } else if (titleWords >= 3 && titleWords <= 20) {
      score += 0.2
    } else if (titleWords >= 2) {
      score += 0.1
    }

    // Snippet quality (video description)
    const snippetWords = (hit.snippet ?? '').split(/\s+/).filter(Boolean).length
    if (snippetWords > 50) {
      score += 0.25
    } else if (snippetWords > 20) {
      score += 0.2
    } else if (snippetWords > 10) {
      score += 0.1
    }

    // Duration availability (useful metadata)
    if (hit.duration) {
      score += 0.1
    }

    // Thumbnail availability
    if (hit.thumbnail_url) {
      score += 0.1
    }

    // Position score
    const positionScore = (1 - index / Math.max(unique.length, 1)) * 0.15
    score += positionScore

    // Reputable video sources
    if (/(youtube|vimeo|ted|bbc|pbs|netflix|twitch|dailymotion)/i.test(hit.url)) {
      score += 0.2
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
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), DEFAULT_REQUEST_TIMEOUT_MS)
      
      try {
        const requestOpts = getDuckRequestOptions()
        const raw = await fn(query, options, requestOpts)
        const parsed = toResultArray(raw)
        if (parsed.length > 0) {
          clearTimeout(timeoutId)
          return parsed
        }
      } finally {
        clearTimeout(timeoutId)
      }
    } catch {
      // Try next call pattern.
    }
  }

  return []
}

async function runAttemptsParallel(
  fn: DuckFn,
  query: string,
  attempts: Array<Record<string, unknown> | undefined>,
): Promise<unknown[]> {
  // Execute all attempts in parallel and return the first successful result
  const promises = attempts.map(async options => {
    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), DEFAULT_REQUEST_TIMEOUT_MS)
      
      try {
        const requestOpts = getDuckRequestOptions()
        const raw = await fn(query, options, requestOpts)
        const parsed = toResultArray(raw)
        if (parsed.length > 0) {
          return parsed
        }
      } finally {
        clearTimeout(timeoutId)
      }
    } catch {
      // Continue to next attempt
    }
    return null
  })

  const results = await Promise.allSettled(promises)
  for (const result of results) {
    if (result.status === 'fulfilled' && result.value && result.value.length > 0) {
      return result.value
    }
  }

  return []
}

export async function runCommunityTextSearch(
  input: BaseSearchInput,
): Promise<CommunitySearchResult> {
  try {
    const maxResults = input.max_results ?? DEFAULT_MAX_RESULTS
    
    // Check cache first
    const cacheKey = getCacheKey(input.query, 'text')
    const cached = getFromCache(cacheKey)
    if (cached) {
      return cached
    }

    // Try API first (not HTML fallback first) - API-first approach
    const duck = (await import('duck-duck-scrape')) as DuckModule
    const searchFn = getDuckFn(duck, ['search'])

    if (searchFn) {
      const retries = Math.max(0, input.retry_attempts ?? DEFAULT_RETRY_ATTEMPTS)
      const backoffMs =
        (input.retry_backoff_seconds ?? DEFAULT_RETRY_BACKOFF_SECONDS) * 1000

      for (let attempt = 0; attempt <= retries; attempt++) {
        // Use parallel attempts for better performance
        const rawResults = await runAttemptsParallel(searchFn, input.query, [
          {
            safeSearch: DUCK_SAFE_SEARCH_OFF,
            locale: 'en-us',
            marketRegion: 'en-US',
          },
          {
            safeSearch: DUCK_SAFE_SEARCH_MODERATE,
            locale: 'en-us',
            marketRegion: 'en-US',
          },
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
          .filter(hit => isUsableResultUrl(hit.url))
          .filter(hit => passesDomainFilters(hit.url, input))

        const ranked = rankTextHits(normalized).slice(0, maxResults)
        if (ranked.length > 0) {
          const result = { hits: ranked }
          setInCache(cacheKey, result)
          return result
        }

        if (attempt < retries) {
          await sleep(backoffMs)
        }
      }
    }

    // Fallback to HTML scraping if API fails
    const htmlFirstHits = await fetchHtmlFallback(input.query, maxResults, input)
    if (htmlFirstHits.length > 0) {
      const result = { hits: rankTextHits(htmlFirstHits).slice(0, maxResults) }
      setInCache(cacheKey, result)
      return result
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
    
    // Check cache first
    const cacheKey = getCacheKey(input.query, 'image')
    const cached = getFromCache(cacheKey)
    if (cached) {
      return cached
    }

    // Try API first
    const duck = (await import('duck-duck-scrape')) as DuckModule
    const searchFn = getDuckFn(duck, ['searchImages', 'images', 'search_images'])

    if (searchFn) {
      const retries = Math.max(0, input.retry_attempts ?? DEFAULT_RETRY_ATTEMPTS)
      const backoffMs =
        (input.retry_backoff_seconds ?? DEFAULT_RETRY_BACKOFF_SECONDS) * 1000

      for (let attempt = 0; attempt <= retries; attempt++) {
        const rawResults = await runAttemptsParallel(searchFn, input.query, [
          { safeSearch: DUCK_SAFE_SEARCH_OFF, locale: 'en-us' },
          { safeSearch: DUCK_SAFE_SEARCH_MODERATE, locale: 'en-us' },
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
            const snippet = pickFirstString(item, ['description', 'body', 'source'])

            return [
              {
                title,
                url,
                thumbnail_url: thumbnailUrl,
                snippet,
              },
            ]
          })
          .filter(hit => isUsableResultUrl(hit.url))
          .filter(hit => passesDomainFilters(hit.url, input))

        const ranked = rankImageHits(normalized).slice(0, maxResults)
        if (ranked.length > 0) {
          const result = { hits: ranked }
          setInCache(cacheKey, result)
          return result
        }

        if (attempt < retries) {
          await sleep(backoffMs)
        }
      }
    }

    // Fallback to HTML scraping
    const fallbackHits = await fetchHtmlFallback(
      `${input.query} images`,
      maxResults,
      input,
    )
    if (fallbackHits.length > 0) {
      const result = { hits: rankImageHits(fallbackHits).slice(0, maxResults) }
      setInCache(cacheKey, result)
      return result
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
    
    // Check cache first
    const cacheKey = getCacheKey(input.query, 'video', input.duration)
    const cached = getFromCache(cacheKey)
    if (cached) {
      return cached
    }

    // Try API first
    const duck = (await import('duck-duck-scrape')) as DuckModule
    const searchFn = getDuckFn(duck, ['searchVideos', 'videos', 'search_videos'])

    if (searchFn) {
      const retries = Math.max(0, input.retry_attempts ?? DEFAULT_RETRY_ATTEMPTS)
      const backoffMs =
        (input.retry_backoff_seconds ?? DEFAULT_RETRY_BACKOFF_SECONDS) * 1000

      for (let attempt = 0; attempt <= retries; attempt++) {
        const rawResults = await runAttemptsParallel(searchFn, input.query, [
          {
            safeSearch: DUCK_SAFE_SEARCH_OFF,
            locale: 'en-us',
            duration: input.duration,
          },
          {
            safeSearch: DUCK_SAFE_SEARCH_MODERATE,
            locale: 'en-us',
            duration: input.duration,
          },
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
            const thumbnailUrl = pickFirstString(item, [
              'image',
              'thumbnail',
              'thumbnail_url',
            ])

            return [
              {
                title,
                url,
                snippet,
                duration,
                thumbnail_url: thumbnailUrl,
              },
            ]
          })
          .filter(hit => isUsableResultUrl(hit.url))
          .filter(hit => passesDomainFilters(hit.url, input))

        const ranked = rankVideoHits(normalized).slice(0, maxResults)
        if (ranked.length > 0) {
          const result = { hits: ranked }
          setInCache(cacheKey, result)
          return result
        }

        if (attempt < retries) {
          await sleep(backoffMs)
        }
      }
    }

    // Fallback to HTML scraping (YouTube-specific)
    const fallbackHits = await fetchHtmlFallback(
      `${input.query} video site:youtube.com`,
      maxResults,
      input,
    )
    if (fallbackHits.length > 0) {
      const result = { hits: rankVideoHits(fallbackHits).slice(0, maxResults) }
      setInCache(cacheKey, result)
      return result
    }

    return { hits: [] }
  } catch (error) {
    return {
      hits: [],
      error: error instanceof Error ? error.message : String(error),
    }
  }
}
