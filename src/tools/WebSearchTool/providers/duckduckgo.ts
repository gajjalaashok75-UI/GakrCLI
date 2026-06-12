import { runCommunityTextSearch } from '../communityPort.js'
import type { SearchInput, SearchProvider } from './types.js'
import { applyDomainFilters, type ProviderOutput } from './types.js'

const DEFAULT_MAX_RESULTS = 10
const DEFAULT_RETRY_ATTEMPTS = 2
const DEFAULT_RETRY_BACKOFF_SECONDS = 1

function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

function isAbort(error: unknown, signal?: AbortSignal): boolean {
  return (
    signal?.aborted === true ||
    (error instanceof Error && error.name === 'AbortError')
  )
}

export const duckduckgoProvider: SearchProvider = {
  name: 'duckduckgo',

  isConfigured() {
    return true
  },

  async search(
    input: SearchInput,
    signal?: AbortSignal,
  ): Promise<ProviderOutput> {
    const start = performance.now()

    if (signal?.aborted) {
      throw new DOMException('Aborted', 'AbortError')
    }

    try {
      const result = await runCommunityTextSearch({
        query: input.query,
        allowed_domains: input.allowed_domains,
        blocked_domains: input.blocked_domains,
        max_results: input.max_results ?? DEFAULT_MAX_RESULTS,
        retry_attempts: DEFAULT_RETRY_ATTEMPTS,
        retry_backoff_seconds: DEFAULT_RETRY_BACKOFF_SECONDS,
      })

      if (signal?.aborted) {
        throw new DOMException('Aborted', 'AbortError')
      }

      const hits = applyDomainFilters(
        result.hits.map(hit => ({
          title: hit.title || hit.url,
          url: hit.url,
          description: hit.snippet,
        })),
        input,
      )

      return {
        hits,
        providerName: 'duckduckgo',
        durationSeconds: (performance.now() - start) / 1000,
      }
    } catch (error) {
      if (isAbort(error, signal)) {
        throw error
      }

      throw new Error(`DuckDuckGo search failed: ${toErrorMessage(error)}`)
    }
  },
}
