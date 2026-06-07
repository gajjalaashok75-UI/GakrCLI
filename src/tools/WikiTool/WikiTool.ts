import { z } from 'zod/v4'
import { buildTool, type ToolDef, type ValidationResult } from '../../Tool.js'
import { queryWikiKnowledge, type WikiQueryOptions } from '../../services/wiki/query.js'
import { getCwd } from '../../utils/cwd.js'
import { lazySchema } from '../../utils/lazySchema.js'
import { semanticNumber } from '../../utils/semanticNumber.js'

export const WIKI_TOOL_NAME = 'wiki'

const inputSchema = lazySchema(() =>
  z.strictObject({
    query: z
      .string()
      .optional()
      .describe('Question to answer from .gakrcli/wiki graph knowledge. Use this first for codebase architecture, symbols, callers, imports, and entrypoints.'),
    search: z
      .string()
      .optional()
      .describe('Reserved search-style wiki lookup. Currently uses the same graph traversal engine as query.'),
    explain: z
      .string()
      .optional()
      .describe('Reserved explain-style wiki lookup. Currently uses the same graph traversal engine as query.'),
    mode: z
      .enum(['bfs', 'dfs'])
      .optional()
      .describe('Graph traversal mode. Defaults to bfs.'),
    depth: semanticNumber(z.number().optional()).describe(
      'Traversal depth from 1 to 6. Defaults to 2, except direct caller/import questions default to 1.',
    ),
    budget: semanticNumber(z.number().optional()).describe(
      'Approximate output token budget from 100 to 20000. Defaults to 2000.',
    ),
    context: z
      .union([z.string(), z.array(z.string())])
      .optional()
      .describe('Optional edge relation/context filter, such as call, import, field, parameter_type, return_type, or generic_arg.'),
  }),
)
type InputSchema = ReturnType<typeof inputSchema>
type Input = z.infer<InputSchema>

const outputSchema = lazySchema(() =>
  z.object({
    mode: z.enum(['query', 'search', 'explain']),
    request: z.string(),
    result: z.string(),
  }),
)
type OutputSchema = ReturnType<typeof outputSchema>
export type Output = z.infer<OutputSchema>

function getRequest(input: Input): { mode: Output['mode']; request: string } | null {
  const candidates = [
    ['query', input.query],
    ['search', input.search],
    ['explain', input.explain],
  ] as const
  const provided = candidates.filter(([, value]) => value?.trim())
  if (provided.length !== 1) {
    return null
  }
  const [mode, value] = provided[0]!
  return { mode, request: value!.trim() }
}

function toContextFilters(context: Input['context']): string[] | undefined {
  if (!context) return undefined
  const filters = Array.isArray(context) ? context : [context]
  const normalized = filters.map(value => value.trim()).filter(Boolean)
  return normalized.length > 0 ? normalized : undefined
}

function toWikiQueryOptions(input: Input): WikiQueryOptions {
  return {
    ...(input.mode ? { mode: input.mode } : {}),
    ...(input.depth !== undefined ? { depth: input.depth } : {}),
    ...(input.budget !== undefined ? { tokenBudget: input.budget } : {}),
    ...(toContextFilters(input.context)
      ? { contextFilters: toContextFilters(input.context) }
      : {}),
  }
}

export const WikiTool = buildTool({
  name: WIKI_TOOL_NAME,
  searchHint: 'query local codebase wiki graph knowledge',
  maxResultSizeChars: 100_000,
  strict: true,
  async description() {
    return 'Query the initialized .gakrcli/wiki knowledge graph for codebase understanding with low-token graph traversal results.'
  },
  async prompt() {
    return [
      'Use wiki to query the initialized .gakrcli/wiki knowledge graph before reading broad raw source files.',
      'Input examples:',
      '- wiki({ query: "starting point" })',
      '- wiki({ query: "who calls updateWikiKnowledge", context: "call" })',
      '- wiki({ query: "auth flow", mode: "dfs", budget: 3000 })',
      'The tool is read-only. It requires the project to already have .gakrcli/wiki/graph/graph.json from /wiki init.',
    ].join('\n')
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
    return { isSearch: true, isRead: true }
  },
  userFacingName() {
    return 'Wiki'
  },
  getToolUseSummary(input) {
    return input?.query ?? input?.search ?? input?.explain ?? null
  },
  getActivityDescription(input) {
    const summary = input?.query ?? input?.search ?? input?.explain
    return summary ? `Querying wiki for ${summary}` : 'Querying wiki'
  },
  async validateInput(input): Promise<ValidationResult> {
    if (!getRequest(input)) {
      return {
        result: false,
        message: 'Provide exactly one of query, search, or explain.',
        errorCode: 1,
      }
    }
    return { result: true }
  },
  renderToolUseMessage(input) {
    const summary = input.query ?? input.search ?? input.explain
    return summary ? `Wiki: ${summary}` : 'Wiki'
  },
  async call(input) {
    const request = getRequest(input)
    if (!request) {
      throw new Error('Provide exactly one of query, search, or explain.')
    }
    const result = await queryWikiKnowledge(
      getCwd(),
      request.request,
      toWikiQueryOptions(input),
    )
    return {
      data: {
        mode: request.mode,
        request: request.request,
        result,
      },
    }
  },
  mapToolResultToToolResultBlockParam(content, toolUseID) {
    return {
      tool_use_id: toolUseID,
      type: 'tool_result',
      content: content.result,
    }
  },
} satisfies ToolDef<InputSchema, Output>)
