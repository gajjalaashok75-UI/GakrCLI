import { z } from 'zod/v4'
import type { ValidationResult } from '../../Tool.js'
import { buildTool } from '../../Tool.js'
import { feature } from 'bun:bundle'
import { getAutoMemPath, isAutoMemoryEnabled } from '../../memdir/paths.js'
import { searchMemdirIndex } from '../../memdir/vectorIndex.js'
import { sanitizeMemoryText } from '../../memdir/memorySecurity.js'
import { lazySchema } from '../../utils/lazySchema.js'
import { semanticNumber } from '../../utils/semanticNumber.js'
import { plural } from '../../utils/stringUtils.js'
import { logForDebugging } from '../../utils/debug.js'
import { getDescription, MEMORY_RECALL_TOOL_NAME } from './prompt.js'
import { renderToolResultMessage, renderToolUseMessage } from './UI.js'

const inputSchema = lazySchema(() =>
  z.strictObject({
    query: z
      .string()
      .describe(
        'Search keywords for the memory index. Short focused keyword queries work better than long prose (the search is lexical, not semantic).',
      ),
    limit: semanticNumber(z.number().optional()).describe(
      'Maximum number of chunk hits to consider (1-20). Defaults to 8. Results are grouped per source file, so fewer sources may be returned than this.',
    ),
  }),
)
type InputSchema = ReturnType<typeof inputSchema>

const outputSchema = lazySchema(() =>
  z.object({
    query: z.string(),
    totalHits: z.number(),
    hits: z.array(
      z.object({
        path: z.string(),
        title: z.string(),
        heading: z.string().nullable(),
        sessionId: z.string().nullable(),
        sourceType: z.string(),
        score: z.number(),
        content: z.string(),
      }),
    ),
  }),
)
type OutputSchema = ReturnType<typeof outputSchema>

type Output = z.infer<OutputSchema>

export type MemoryRecallHit = {
  path: string
  title: string
  heading: string | null
  sessionId: string | null
  sourceType: string
  score: number
  content: string
}

export type MemoryRecallOutput = {
  query: string
  totalHits: number
  hits: MemoryRecallHit[]
}

const DEFAULT_TOOL_LIMIT = 8
const MAX_TOOL_LIMIT = 20
const MAX_EXCERPT_CHARS = 400

/** Group chunk hits by source path, best score first. */
function groupHits(
  hits: Awaited<ReturnType<typeof searchMemdirIndex>>,
  maxGroups: number,
): { groups: MemoryRecallHit[]; totalHits: number } {
  const totalHits = hits.length
  const byPath = new Map<string, { hit: (typeof hits)[number]; excerpt: string }>()
  for (const hit of hits) {
    const existing = byPath.get(hit.path)
    if (!existing) {
      byPath.set(hit.path, {
        hit,
        excerpt: hit.content.trim().slice(0, MAX_EXCERPT_CHARS),
      })
      continue
    }
    if (!existing.excerpt && hit.content.trim()) {
      existing.excerpt = hit.content.trim().slice(0, MAX_EXCERPT_CHARS)
    }
  }
  const groups: MemoryRecallHit[] = []
  for (const { hit, excerpt } of byPath.values()) {
    const safeTitle = sanitizeMemoryText(hit.title)
    if (safeTitle.wholeSecret || !safeTitle.text.trim()) continue
    const safeExcerpt = excerpt ? sanitizeMemoryText(excerpt) : null
    groups.push({
      path: hit.path,
      title: safeTitle.text,
      heading: hit.heading,
      sessionId: hit.sessionId,
      sourceType: hit.sourceType,
      score: hit.score,
      content: safeExcerpt && !safeExcerpt.wholeSecret ? safeExcerpt.text : '',
    })
    if (groups.length >= maxGroups) break
  }
  return { groups, totalHits }
}

export const MemoryRecallTool = buildTool({
  name: MEMORY_RECALL_TOOL_NAME,
  searchHint: 'search project memory and session summaries',
  maxResultSizeChars: 20_000,
  strict: true,
  isEnabled() {
    // Same gate as the per-turn injection (query.ts feature('MEMORY_RETRIEVAL'))
    // plus the auto-memory enablement check, so the tool is never visible when
    // retrieval itself is off. feature() must appear directly in the ternary
    // (bun:bundle transforms it there only).
    const retrievalFlagOn = feature('MEMORY_RETRIEVAL') ? true : false
    return retrievalFlagOn && isAutoMemoryEnabled()
  },
  async description() {
    return getDescription()
  },
  userFacingName() {
    return 'MemoryRecall'
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
  isSearchOrReadCommand() {
    return { isSearch: true, isRead: false }
  },
  toAutoClassifierInput(input?: { query?: string }) {
    return input?.query ?? ''
  },
  async validateInput({ limit }): Promise<ValidationResult> {
    if (limit !== undefined && (limit < 1 || limit > MAX_TOOL_LIMIT)) {
      return {
        result: false,
        message: `limit must be between 1 and ${MAX_TOOL_LIMIT}`,
        errorCode: 1,
      }
    }
    return { result: true }
  },
  async prompt() {
    return getDescription()
  },
  renderToolUseMessage,
  renderToolResultMessage,
  getToolUseSummary(input?: { query?: string }) {
    const query = input?.query?.trim()
    return query ? `memory: ${query}` : 'memory recall'
  },
  getActivityDescription(input?: { query?: string }) {
    const query = input?.query?.trim()
    return query ? `Searching memory for ${JSON.stringify(query)}` : 'Searching memory'
  },
  mapToolResultToToolResultBlockParam(output, toolUseID) {
    let content: string
    if (output.totalHits === 0) {
      content = `No memory matches for "${output.query}". Try different keywords — the search is lexical, so terms must literally appear in memory files or session summaries.`
    } else {
      const lines: string[] = [
        `Found ${output.hits.length} ${plural(output.hits.length, 'source')} (${output.totalHits} matching chunk${output.totalHits === 1 ? '' : 's'}), best first:`,
      ]
      for (const hit of output.hits) {
        const provenance = hit.sessionId ? ` [session ${hit.sessionId.slice(0, 8)}]` : ''
        const heading = hit.heading ? ` — ${hit.heading}` : ''
        lines.push(`\n# ${hit.title}${heading} (${hit.path})${provenance}`)
        if (hit.content) lines.push(hit.content)
      }
      content = lines.join('\n')
    }
    return {
      tool_use_id: toolUseID,
      type: 'tool_result',
      content,
    }
  },
  async checkPermissions(input, _context) {
    // Read-only search over the app's own memory index: auto-allow. Generic
    // deny rules still apply before checkPermissions is reached.
    void input
    return { behavior: 'allow' as const, updatedInput: input }
  },
  async call(args, _context, _canUseTool, _parentMessage, _onProgress) {
    const query = args.query.trim()
    if (!query) {
      return {
        data: {
          query: args.query,
          totalHits: 0,
          hits: [],
        } satisfies MemoryRecallOutput,
      }
    }

    const memDir = getAutoMemPath()
    if (!memDir) {
      logForDebugging('[memdir] memory_recall: no memory dir available')
      return {
        data: { query, totalHits: 0, hits: [] } satisfies MemoryRecallOutput,
      }
    }

    const limit = Math.min(Math.max(args.limit ?? DEFAULT_TOOL_LIMIT, 1), MAX_TOOL_LIMIT)
    const started = Date.now()
    const hits = await searchMemdirIndex(query, memDir, limit)
    const { groups, totalHits } = groupHits(hits, limit)
    logForDebugging(
      `[memdir] memory_recall: query="${query}" ${hits.length} chunk hit(s) → ${groups.length} source(s) in ${Date.now() - started}ms`,
    )
    return {
      data: {
        query,
        totalHits,
        hits: groups,
      } satisfies MemoryRecallOutput,
    }
  },
})
