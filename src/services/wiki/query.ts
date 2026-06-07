import { readFile, stat } from 'fs/promises'
import { basename } from 'path'
import { getWikiPaths } from './paths.js'

type WikiQueryNode = {
  id: string
  label?: string | null
  norm_label?: string | null
  source_file?: string | null
  source_location?: string | null
  community?: string | number | null
  file_type?: string | null
}

type WikiQueryEdge = {
  source: string
  target: string
  relation?: string | null
  confidence?: string | null
  context?: string | null
}

type WikiQueryGraph = {
  nodes?: WikiQueryNode[]
  links?: WikiQueryEdge[]
  edges?: WikiQueryEdge[]
}

type LoadedGraph = {
  nodes: Map<string, WikiQueryNode>
  links: WikiQueryEdge[]
  outgoing: Map<string, WikiQueryEdge[]>
  incoming: Map<string, WikiQueryEdge[]>
  degree: Map<string, number>
}

export type WikiQueryOptions = {
  mode?: 'bfs' | 'dfs'
  depth?: number
  tokenBudget?: number
  contextFilters?: string[]
}

const EXACT_MATCH_BONUS = 1000
const PREFIX_MATCH_BONUS = 100
const SUBSTRING_MATCH_BONUS = 1
const SOURCE_MATCH_BONUS = 0.5
const SOURCE_PATH_MATCH_BONUS = 25
const SHORT_EXACT_MATCH_BONUS = 1

type TraversalDirection = 'outgoing' | 'incoming' | 'both'

const CONTEXT_HINTS: Array<[string, string[]]> = [
  ['call', ['call', 'calls', 'called', 'invoke', 'invokes', 'invoked']],
  ['import', ['import', 'imports', 'imported', 'module', 'modules']],
  ['field', ['field', 'fields', 'member', 'members', 'property', 'properties']],
  ['parameter_type', ['parameter', 'parameters', 'param', 'params', 'argument', 'arguments']],
  ['return_type', ['return', 'returns', 'returned']],
  ['generic_arg', ['generic', 'generics', 'template', 'templates']],
]

const CONTEXT_FILTER_ALIASES = new Map([
  ['param', 'parameter_type'],
  ['params', 'parameter_type'],
  ['parameter', 'parameter_type'],
  ['parameters', 'parameter_type'],
  ['argument', 'parameter_type'],
  ['arguments', 'parameter_type'],
  ['arg', 'parameter_type'],
  ['args', 'parameter_type'],
  ['return', 'return_type'],
  ['returns', 'return_type'],
  ['returned', 'return_type'],
  ['generic', 'generic_arg'],
  ['generics', 'generic_arg'],
  ['template', 'generic_arg'],
  ['templates', 'generic_arg'],
  ['annotation', 'attribute'],
  ['annotations', 'attribute'],
  ['decorator', 'attribute'],
  ['decorators', 'attribute'],
  ['calls', 'call'],
  ['called', 'call'],
  ['invoke', 'call'],
  ['invocation', 'call'],
  ['fields', 'field'],
  ['property', 'field'],
  ['properties', 'field'],
  ['member', 'field'],
  ['members', 'field'],
  ['imports', 'import'],
  ['imported', 'import'],
  ['module', 'import'],
  ['modules', 'import'],
  ['exports', 'export'],
  ['exported', 'export'],
])

const QUERY_INTENT_TERMS = new Set([
  'about',
  'all',
  'codebase',
  'describe',
  'explain',
  'find',
  'flow',
  'flows',
  'from',
  'give',
  'how',
  'list',
  'overview',
  'show',
  'tell',
  'the',
  'what',
  'when',
  'where',
  'which',
  'who',
  'why',
])

const CONTEXT_INTENT_TERMS = new Set(
  [...CONTEXT_FILTER_ALIASES.keys(), ...CONTEXT_FILTER_ALIASES.values(), ...CONTEXT_HINTS.flatMap(([, hints]) => hints)],
)

function stripDiacritics(value: string): string {
  return value.normalize('NFKD').replace(/\p{Diacritic}/gu, '')
}

function searchTokens(value: unknown): string[] {
	const text = String(value)
	// Split camelCase/PascalCase boundaries first, then tokenize
	const camelSplit = text
		.replace(/([a-z0-9])([A-Z])/g, '$1 $2')
		.replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
	return [...stripDiacritics(camelSplit).toLowerCase().matchAll(/[\p{L}\p{N}_]+/gu)]
		.map(match => match[0])
}

function hasChinese(value: string): boolean {
  return /[\u4e00-\u9fff]/u.test(value)
}

function segmentChinese(value: string): string[] {
  const segments: string[] = []
  for (let index = 0; index < value.length - 1; index += 1) {
    segments.push(value.slice(index, index + 2))
  }
  if (segments.length === 0) {
    segments.push(value)
  }
  if (value.length > 1 && !segments.includes(value)) {
    segments.push(value)
  }
  return segments
}

function isSearchable(term: string): boolean {
  if (/^[a-z]+$/.test(term)) {
    return term.length > 2
  }
  return term.length > 0
}

function queryTerms(question: string): string[] {
  const terms: string[] = []
  for (const raw of question.split(/\s+/)) {
    if (!raw) continue
    if (hasChinese(raw)) {
      for (const segment of segmentChinese(raw.toLowerCase().trim())) {
        if (isSearchable(segment)) {
          terms.push(segment)
        }
      }
    } else {
      for (const token of [...raw.toLowerCase().matchAll(/[\p{L}\p{N}_]+/gu)].map(match => match[0])) {
        if (isSearchable(token)) {
          terms.push(token)
        }
      }
    }
  }
  return expandSemanticTerms(question, terms)
}

function expandSemanticTerms(question: string, terms: string[]): string[] {
  const lowered = stripDiacritics(question).toLowerCase()
  const expanded = [...terms]
  if (/\b(?:starting point|entry point|entrypoint|start point|start here)\b/u.test(lowered)) {
    expanded.push('main', 'cli', 'entrypoint', 'bootstrap', 'startup')
  }
  return [...new Set(expanded)]
}

function seedTerms(question: string, filters: string[]): string[] {
  const allTerms = queryTerms(question)
  const removePointIntent = /\b(?:starting point|entry point|start point)\b/iu.test(question)
  const useful = allTerms.filter(term => {
    if (QUERY_INTENT_TERMS.has(term)) return false
    if (removePointIntent && (term === 'starting' || term === 'start' || term === 'point')) return false
    if (filters.length > 0 && CONTEXT_INTENT_TERMS.has(term)) return false
    return true
  })
  return useful.length > 0 ? useful : allTerms
}

function sanitize(value: unknown): string {
  return String(value ?? '')
    .replace(/[\u001b\u009b][[\]()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g, '')
    .replace(/[\r\n\t]+/g, ' ')
    .trim()
}

async function pathExists(path: string): Promise<boolean> {
  try {
    await stat(path)
    return true
  } catch {
    return false
  }
}

function normalizeNode(raw: WikiQueryNode): WikiQueryNode {
  return {
    ...raw,
    id: String(raw.id),
  }
}

function normalizeEdge(raw: WikiQueryEdge): WikiQueryEdge {
  return {
    ...raw,
    source: String(raw.source),
    target: String(raw.target),
  }
}

async function loadGraph(graphPath: string): Promise<LoadedGraph> {
  if (!(await pathExists(graphPath))) {
    throw new Error('Wiki graph is missing. Run /wiki init first.')
  }

  const data = JSON.parse(await readFile(graphPath, 'utf8')) as WikiQueryGraph
  const nodes = new Map<string, WikiQueryNode>()
  const links = (data.links ?? data.edges ?? []).map(normalizeEdge)
  const outgoing = new Map<string, WikiQueryEdge[]>()
  const incoming = new Map<string, WikiQueryEdge[]>()
  const degree = new Map<string, number>()

  for (const node of data.nodes ?? []) {
    const normalized = normalizeNode(node)
    nodes.set(normalized.id, normalized)
    degree.set(normalized.id, 0)
  }

  for (const edge of links) {
    if (!nodes.has(edge.source) || !nodes.has(edge.target)) {
      continue
    }
    const edges = outgoing.get(edge.source) ?? []
    edges.push(edge)
    outgoing.set(edge.source, edges)
    const incomingEdges = incoming.get(edge.target) ?? []
    incomingEdges.push(edge)
    incoming.set(edge.target, incomingEdges)
    degree.set(edge.source, (degree.get(edge.source) ?? 0) + 1)
    degree.set(edge.target, (degree.get(edge.target) ?? 0) + 1)
  }

  return { nodes, links, outgoing, incoming, degree }
}

function nodeLabel(node: WikiQueryNode | undefined, fallback: string): string {
  return String(node?.label || fallback)
}

function normalizedLabel(node: WikiQueryNode): string {
  return String(node.norm_label || stripDiacritics(String(node.label || ''))).toLowerCase()
}

function computeIdf(graph: LoadedGraph, terms: string[]): Map<string, number> {
  const idf = new Map<string, number>()
  const totalNodes = graph.nodes.size || 1
  for (const term of terms) {
    let documentFrequency = 0
    for (const node of graph.nodes.values()) {
      if (normalizedLabel(node).includes(term)) {
        documentFrequency += 1
      }
    }
    idf.set(term, Math.log(1 + totalNodes / (1 + documentFrequency)))
  }
  return idf
}

function scoreNodes(graph: LoadedGraph, terms: string[], originalTermCount = terms.length): Array<[number, string]> {
  const normalizedTerms = terms.flatMap(term => searchTokens(term))
  const idf = computeIdf(graph, normalizedTerms)
  const multiTermQuery = originalTermCount > 1
  const scored: Array<[number, string]> = []

  for (const [nodeId, node] of graph.nodes.entries()) {
    const normLabel = normalizedLabel(node)
    const bareLabel = normLabel.replace(/\(\)$/u, '')
    const source = String(node.source_file || '').toLowerCase()
    const degree = graph.degree.get(nodeId) ?? 0
    let score = 0

    for (const term of normalizedTerms) {
      const weight = idf.get(term) ?? 1
      if (term === normLabel || term === bareLabel) {
        score += (multiTermQuery && term.length <= 4 ? SHORT_EXACT_MATCH_BONUS : EXACT_MATCH_BONUS) * weight
      } else if (normLabel.startsWith(term) || bareLabel.startsWith(term)) {
        score += PREFIX_MATCH_BONUS * weight
      } else if (normLabel.includes(term)) {
        score += SUBSTRING_MATCH_BONUS * weight
      }
      if (source.includes(term)) {
        score += SOURCE_MATCH_BONUS * weight
      }
      if (source.includes(term) || nodeId.toLowerCase().includes(term)) {
        score += SOURCE_PATH_MATCH_BONUS * weight
      }
    }

    if (score > 0) {
      score += Math.log1p(degree)
      scored.push([score, nodeId])
    }
  }

  return scored.sort((a, b) => b[0] - a[0] || a[1].localeCompare(b[1]))
}

function pickSeeds(scored: Array<[number, string]>, maxK = 3, gapRatio = 0.2): string[] {
  if (scored.length === 0) return []
  const topScore = scored[0][0]
  const seeds: string[] = []
  for (const [score, nodeId] of scored.slice(0, maxK)) {
    if (seeds.length > 0 && score < topScore * gapRatio) {
      break
    }
    seeds.push(nodeId)
  }
  return seeds
}

function normalizeContextFilters(filters: string[] | undefined): string[] {
  if (!filters) return []
  const output: string[] = []
  const seen = new Set<string>()
  for (const value of filters) {
    const key = CONTEXT_FILTER_ALIASES.get(stripDiacritics(value).trim().toLowerCase()) ?? stripDiacritics(value).trim().toLowerCase()
    if (!key || seen.has(key)) continue
    seen.add(key)
    output.push(key)
  }
  return output
}

function inferContextFilters(question: string): string[] {
  const lowered = new Set(
    question
      .replace(/[?,]/g, ' ')
      .split(/\s+/)
      .map(token => stripDiacritics(token).toLowerCase())
      .filter(Boolean),
  )
  const inferred: string[] = []
  for (const [context, hints] of CONTEXT_HINTS) {
    if (hints.some(hint => lowered.has(hint))) {
      inferred.push(context)
    }
  }
  return inferred
}

function resolveContextFilters(
  question: string,
  explicitFilters: string[] | undefined,
): { filters: string[]; source: 'explicit' | 'heuristic' | null } {
  const normalized = normalizeContextFilters(explicitFilters)
  if (normalized.length > 0) {
    return { filters: normalized, source: 'explicit' }
  }
  const inferred = inferContextFilters(question)
  if (inferred.length > 0) {
    return { filters: inferred, source: 'heuristic' }
  }
  return { filters: [], source: null }
}

function normalizedRelation(value: string | null | undefined): string {
	const raw = String(value || '').trim()
	// Graph may include side tags like "[EXTRACTED]" after the real relation
	const cleaned = raw.replace(/\s*\[[^\]]+\]\s*/gu, '').trim().toLowerCase()
	const key = stripDiacritics(cleaned)
	return CONTEXT_FILTER_ALIASES.get(key) ?? key
}

function edgeMatchesContext(edge: WikiQueryEdge, filters: string[]): boolean {
  if (filters.length === 0) return true
  const allowed = new Set(filters)
  return allowed.has(normalizedRelation(edge.context)) || allowed.has(normalizedRelation(edge.relation))
}

function edgesForDirection(
  graph: LoadedGraph,
  nodeId: string,
  filters: string[],
  direction: TraversalDirection,
): WikiQueryEdge[] {
  const edges = direction === 'outgoing'
    ? graph.outgoing.get(nodeId) ?? []
    : direction === 'incoming'
      ? graph.incoming.get(nodeId) ?? []
      : [...(graph.outgoing.get(nodeId) ?? []), ...(graph.incoming.get(nodeId) ?? [])]
  return edges.filter(edge => edgeMatchesContext(edge, filters))
}

function edgeNeighbor(edge: WikiQueryEdge, nodeId: string, direction: TraversalDirection): string | null {
  if (direction === 'outgoing') return edge.target
  if (direction === 'incoming') return edge.source
  if (edge.source === nodeId) return edge.target
  if (edge.target === nodeId) return edge.source
  return null
}

function inferTraversalDirection(question: string, filters: string[]): TraversalDirection {
  const lowered = stripDiacritics(question).toLowerCase()
  if (
    filters.includes('call') &&
    (/\bwho\s+(?:calls|invokes)\b/u.test(lowered) ||
      /\b(?:callers?|called by|invoked by)\b/u.test(lowered))
  ) {
    return 'incoming'
  }
  if (
    filters.includes('import') &&
    (/\bwho\s+imports\b/u.test(lowered) || /\bimported by\b/u.test(lowered))
  ) {
    return 'incoming'
  }
  return 'outgoing'
}

function hubThreshold(graph: LoadedGraph): number {
	const degrees = [...graph.degree.values()].sort((a, b) => a - b)
	if (degrees.length === 0) return 50
	// Use 90th percentile rather than 99th; high-degree "god nodes" (like Tool or
	// the main entry point) should still be traversed from seeds if they match.
	const index = Math.min(degrees.length - 1, Math.floor(degrees.length * 0.9))
	return Math.max(30, degrees[index] ?? 0)
}

function bfs(
  graph: LoadedGraph,
  startNodes: string[],
  depth: number,
  filters: string[],
  direction: TraversalDirection,
): { nodes: Set<string>; edges: WikiQueryEdge[] } {
  const threshold = hubThreshold(graph)
  const seedSet = new Set(startNodes)
  const visited = new Set(startNodes)
  let frontier = new Set(startNodes)
  const edges: WikiQueryEdge[] = []

  for (let currentDepth = 0; currentDepth < depth; currentDepth += 1) {
    const nextFrontier = new Set<string>()
    for (const nodeId of frontier) {
      if (!seedSet.has(nodeId) && (graph.degree.get(nodeId) ?? 0) >= threshold) {
        continue
      }
      for (const edge of edgesForDirection(graph, nodeId, filters, direction)) {
        const neighbor = edgeNeighbor(edge, nodeId, direction)
        if (neighbor && !visited.has(neighbor)) {
          nextFrontier.add(neighbor)
          edges.push(edge)
        }
      }
    }
    for (const nodeId of nextFrontier) {
      visited.add(nodeId)
    }
    frontier = nextFrontier
  }

  return { nodes: visited, edges }
}

function dfs(
  graph: LoadedGraph,
  startNodes: string[],
  depth: number,
  filters: string[],
  direction: TraversalDirection,
): { nodes: Set<string>; edges: WikiQueryEdge[] } {
  const threshold = hubThreshold(graph)
  const seedSet = new Set(startNodes)
  const visited = new Set<string>()
  const edges: WikiQueryEdge[] = []
  const stack = [...startNodes].reverse().map(nodeId => ({ nodeId, depth: 0 }))

  while (stack.length > 0) {
    const item = stack.pop()
    if (!item || visited.has(item.nodeId) || item.depth > depth) {
      continue
    }
    visited.add(item.nodeId)
    if (!seedSet.has(item.nodeId) && (graph.degree.get(item.nodeId) ?? 0) >= threshold) {
      continue
    }
    for (const edge of edgesForDirection(graph, item.nodeId, filters, direction)) {
      const neighbor = edgeNeighbor(edge, item.nodeId, direction)
      if (neighbor && !visited.has(neighbor)) {
        stack.push({ nodeId: neighbor, depth: item.depth + 1 })
        edges.push(edge)
      }
    }
  }

  return { nodes: visited, edges }
}

function subgraphToText(
  graph: LoadedGraph,
  nodes: Set<string>,
  edges: WikiQueryEdge[],
  tokenBudget: number,
  seeds: string[],
): string {
  const charBudget = tokenBudget * 3
  const seedSet = new Set(seeds)
  const ordered = [
    ...seeds.filter(nodeId => nodes.has(nodeId)),
    ...[...nodes]
      .filter(nodeId => !seedSet.has(nodeId))
      .sort((a, b) => (graph.degree.get(b) ?? 0) - (graph.degree.get(a) ?? 0)),
  ]

  const lines: string[] = []
  for (const nodeId of ordered) {
    const node = graph.nodes.get(nodeId)
    lines.push(
      `NODE ${sanitize(nodeLabel(node, nodeId))} [src=${sanitize(node?.source_file)} loc=${sanitize(node?.source_location)} community=${sanitize(node?.community)}]`,
    )
  }

  for (const edge of edges) {
    if (!nodes.has(edge.source) || !nodes.has(edge.target)) {
      continue
    }
    const source = graph.nodes.get(edge.source)
    const target = graph.nodes.get(edge.target)
    const contextSuffix = edge.context ? ` context=${sanitize(edge.context)}` : ''
    lines.push(
      `EDGE ${sanitize(nodeLabel(source, edge.source))} --${sanitize(edge.relation)} [${sanitize(edge.confidence)}${contextSuffix}]--> ${sanitize(nodeLabel(target, edge.target))}`,
    )
  }

  const output = lines.join('\n')
  if (output.length <= charBudget) {
    return output
  }

  let cutAt = output.slice(0, charBudget).lastIndexOf('\n')
  if (cutAt <= 0) {
    cutAt = charBudget
  }
  const visible = output.slice(0, cutAt)
  const shownNodes = visible.split('\n').filter(line => line.startsWith('NODE ')).length
  const cutCount = Math.max(0, lines.filter(line => line.startsWith('NODE ')).length - shownNodes)
  return `${visible}\n... (truncated - ${cutCount} more nodes cut by ~${tokenBudget}-token budget. Narrow with --context call or query a more specific symbol)`
}

function boundedInt(value: number | undefined, fallback: number, min: number, max: number): number {
  if (!Number.isFinite(value)) {
    return fallback
  }
  return Math.max(min, Math.min(value ?? fallback, max))
}

export async function queryWikiKnowledge(
  cwd: string,
  question: string,
  options: WikiQueryOptions = {},
): Promise<string> {
  const trimmedQuestion = question.trim()
  if (!trimmedQuestion) {
    throw new Error('Usage: /wiki query "<question>" [--dfs] [--context C] [--budget N]')
  }

  const paths = getWikiPaths(cwd)
  const graph = await loadGraph(paths.graphJsonFile)
  const mode = options.mode ?? 'bfs'
  const tokenBudget = boundedInt(options.tokenBudget, 2000, 100, 20_000)
  const { filters, source } = resolveContextFilters(trimmedQuestion, options.contextFilters)
  const direction = inferTraversalDirection(trimmedQuestion, filters)
  const depth = boundedInt(options.depth, direction === 'incoming' ? 1 : 2, 1, 6)
  const allTerms = queryTerms(trimmedQuestion)
  const terms = seedTerms(trimmedQuestion, filters)
  const scored = scoreNodes(graph, terms, allTerms.length)
  const startNodes = pickSeeds(scored)

  if (startNodes.length === 0) {
    return `No matching nodes found for query: ${trimmedQuestion}`
  }

  const result = mode === 'dfs'
    ? dfs(graph, startNodes, depth, filters, direction)
    : bfs(graph, startNodes, depth, filters, direction)
  const startLabels = startNodes.map(nodeId => nodeLabel(graph.nodes.get(nodeId), nodeId))
  const headerParts = [
    `Traversal: ${mode.toUpperCase()} depth=${depth}`,
    `Start: ${JSON.stringify(startLabels)}`,
  ]
  if (filters.length > 0) {
    headerParts.push(`Context: ${filters.join(', ')} (${source})`)
  }
  if (direction !== 'outgoing') {
    headerParts.push(`Direction: ${direction}`)
  }
  headerParts.push(`${result.nodes.size} nodes found`)

  return [
    `Wiki query: ${trimmedQuestion}`,
    `Graph: .gakrcli/wiki/graph/${basename(paths.graphJsonFile)}`,
    headerParts.join(' | '),
    '',
    subgraphToText(graph, result.nodes, result.edges, tokenBudget, startNodes),
  ].join('\n')
}
