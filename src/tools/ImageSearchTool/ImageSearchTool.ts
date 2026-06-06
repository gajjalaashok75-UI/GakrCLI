import type { PermissionResult } from 'src/utils/permissions/PermissionResult.js'
import { z } from 'zod/v4'
import { buildTool, type ToolDef } from '../../Tool.js'
import { lazySchema } from '../../utils/lazySchema.js'
import { runCommunityImageSearch } from '../WebSearchTool/communityPort.js'
import { getImageSearchPrompt, IMAGE_SEARCH_TOOL_NAME } from './prompt.js'
import {
  getToolUseSummary,
  renderToolResultMessage,
  renderToolUseMessage,
} from './UI.js'

const inputSchema = lazySchema(() =>
  z.strictObject({
    query: z.string().min(2).describe('The image search query to use'),
    max_results: z
      .number()
      .int()
      .min(1)
      .max(30)
      .optional()
      .describe('Maximum number of image results to return'),
    allowed_domains: z
      .array(z.string())
      .optional()
      .describe('Only include results from these domains'),
    blocked_domains: z
      .array(z.string())
      .optional()
      .describe('Never include results from these domains'),
  }),
)

type InputSchema = ReturnType<typeof inputSchema>
type Input = z.infer<InputSchema>

const searchResultSchema = lazySchema(() =>
  z.object({
    tool_use_id: z.string().describe('ID of the tool use'),
    content: z
      .array(
        z.object({
          title: z.string().describe('Image or page title'),
          url: z.string().describe('Image page URL'),
          thumbnail_url: z.string().optional().describe('Thumbnail URL if available'),
        }),
      )
      .describe('Array of image hits'),
  }),
)

export type SearchResult = z.infer<ReturnType<typeof searchResultSchema>>

const outputSchema = lazySchema(() =>
  z.object({
    query: z.string().describe('The image query that was executed'),
    results: z
      .array(z.union([searchResultSchema(), z.string()]))
      .describe('Image result links and/or text commentary'),
    durationSeconds: z
      .number()
      .describe('Time taken to complete the image search operation'),
  }),
)

type OutputSchema = ReturnType<typeof outputSchema>
export type Output = z.infer<OutputSchema>

type NormalizedHit = {
  title: string
  url: string
  thumbnail_url?: string
  snippet?: string
}

function isFirecrawlEnabled(): boolean {
  return Boolean(process.env.FIRECRAWL_API_KEY)
}

function filterByDomains(hits: NormalizedHit[], input: Input): NormalizedHit[] {
  let filtered = hits

  if (input.blocked_domains?.length) {
    filtered = filtered.filter(hit => {
      try {
        const host = new URL(hit.url).hostname
        return !input.blocked_domains!.some(domain => host.endsWith(domain))
      } catch {
        return false
      }
    })
  }

  if (input.allowed_domains?.length) {
    filtered = filtered.filter(hit => {
      try {
        const host = new URL(hit.url).hostname
        return input.allowed_domains!.some(domain => host.endsWith(domain))
      } catch {
        return false
      }
    })
  }

  return filtered
}

function formatOutputFromHits(
  query: string,
  toolUseId: string,
  hits: NormalizedHit[],
  startTime: number,
): Output {
  const snippets = hits
    .filter(hit => hit.snippet)
    .map(hit => `**${hit.title}** - ${hit.snippet} (${hit.url})`)
    .join('\n')

  const results: Output['results'] = []
  if (snippets) {
    results.push(snippets)
  }
  results.push({
    tool_use_id: toolUseId,
    content: hits.map(hit => ({
      title: hit.title,
      url: hit.url,
      thumbnail_url: hit.thumbnail_url,
    })),
  })

  return {
    query,
    results,
    durationSeconds: (performance.now() - startTime) / 1000,
  }
}

async function runFirecrawlImageSearch(input: Input): Promise<Output> {
  const startTime = performance.now()
  const { FirecrawlClient } = await import('@mendable/firecrawl-js')
  const app = new FirecrawlClient({ apiKey: process.env.FIRECRAWL_API_KEY! })

  const effectiveMax = input.max_results ?? 8
  const data = await app.search(`${input.query} images`, { limit: effectiveMax })

  const webResults = (data.web ?? []) as Array<{
    url?: string
    title?: string
    description?: string
  }>

  const rawHits = webResults
    .filter(entry => typeof entry.url === 'string' && entry.url.length > 0)
    .map(entry => ({
      title: entry.title ?? (entry.url as string),
      url: entry.url as string,
      snippet: entry.description,
    }))

  const hits = filterByDomains(rawHits, input)
  return formatOutputFromHits(input.query, 'firecrawl-image-search', hits, startTime)
}

async function runDuckDuckGoImageSearch(input: Input): Promise<Output> {
  const startTime = performance.now()

  try {
    const community = await runCommunityImageSearch({
      query: input.query,
      max_results: input.max_results,
      allowed_domains: input.allowed_domains,
      blocked_domains: input.blocked_domains,
      retry_attempts: 2,
      retry_backoff_seconds: 1,
    })
    const hits = filterByDomains(community.hits as NormalizedHit[], input)

    if (hits.length === 0 && isFirecrawlEnabled()) {
      return runFirecrawlImageSearch(input)
    }

    return formatOutputFromHits(input.query, 'duckduckgo-image-search', hits, startTime)
  } catch {
    if (isFirecrawlEnabled()) {
      return runFirecrawlImageSearch(input)
    }

    return {
      query: input.query,
      results: [
        'Image search temporarily unavailable - try again or configure Firecrawl for fallback.',
      ],
      durationSeconds: (performance.now() - startTime) / 1000,
    }
  }
}

export const ImageSearchTool = buildTool({
  name: IMAGE_SEARCH_TOOL_NAME,
  searchHint: 'search the web for image references',
  maxResultSizeChars: 100_000,
  shouldDefer: true,
  async description(input) {
    return `GakrCLI wants to search images for: ${input.query}`
  },
  userFacingName() {
    return 'Image Search'
  },
  getToolUseSummary,
  getActivityDescription(input) {
    const summary = getToolUseSummary(input)
    return summary ? `Searching images for ${summary}` : 'Searching images'
  },
  isEnabled() {
    return true
  },
  get inputSchema(): InputSchema {
    return inputSchema()
  },
  get outputSchema(): OutputSchema {
    return outputSchema()
  },
  isConcurrencySafe() {
    return true
  },
  isReadOnly() {
    return true
  },
  toAutoClassifierInput(input) {
    return input.query
  },
  async checkPermissions(): Promise<PermissionResult> {
    return {
      behavior: 'passthrough',
      message: 'ImageSearch requires permission.',
      suggestions: [
        {
          type: 'addRules',
          rules: [{ toolName: IMAGE_SEARCH_TOOL_NAME }],
          behavior: 'allow',
          destination: 'localSettings',
        },
      ],
    }
  },
  async prompt() {
    return getImageSearchPrompt()
  },
  renderToolUseMessage,
  renderToolResultMessage,
  extractSearchText() {
    return ''
  },
  async validateInput(input) {
    const { query, allowed_domains, blocked_domains } = input
    if (!query.length) {
      return {
        result: false,
        message: 'Error: Missing query',
        errorCode: 1,
      }
    }
    if (allowed_domains?.length && blocked_domains?.length) {
      return {
        result: false,
        message:
          'Error: Cannot specify both allowed_domains and blocked_domains in the same request',
        errorCode: 2,
      }
    }
    return { result: true }
  },
  async call(input) {
    return { data: await runDuckDuckGoImageSearch(input) }
  },
  mapToolResultToToolResultBlockParam(output, toolUseID) {
    const { query, results } = output

    let formattedOutput = `Image search results for query: "${query}"\n\n`
    for (const result of results ?? []) {
      if (typeof result === 'string') {
        formattedOutput += result + '\n\n'
      } else {
        if (result.content?.length > 0) {
          formattedOutput += `Links: ${JSON.stringify(result.content)}\n\n`
        } else {
          formattedOutput += 'No links found.\n\n'
        }
      }
    }

    formattedOutput +=
      '\nREMINDER: Include relevant source links above in your response using markdown hyperlinks.'

    return {
      tool_use_id: toolUseID,
      type: 'tool_result',
      content: formattedOutput.trim(),
    }
  },
} satisfies ToolDef<InputSchema, Output>)
