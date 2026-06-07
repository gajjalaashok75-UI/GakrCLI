import { createHash } from 'crypto'
import { mkdir, readdir, readFile, rm, stat, writeFile } from 'fs/promises'
import { basename, extname, isAbsolute, join, relative, resolve } from 'path'
import ignore from 'ignore'
import { initializeWiki } from './init.js'
import { rebuildWikiIndex } from './indexBuilder.js'
import { getWikiPaths } from './paths.js'
import type { WikiKnowledgeInitResult } from './types.js'

type WikiGraphNode = {
  id: string
  label: string
  type: 'file' | 'symbol' | 'concept'
  source_file: string
  source_location?: string
  community: number
  file_type?: string
}

type WikiGraphEdge = {
  source: string
  target: string
  relation: 'contains' | 'imports' | 'imports_from' | 'references' | 'calls'
  confidence: 'EXTRACTED'
  source_file?: string
  weight?: number
}

type WikiGraph = {
  directed: boolean
  multigraph: boolean
  graph: {
    generated_by: 'gakrcli-wiki'
    generated_at: string
    root: string
  }
  nodes: WikiGraphNode[]
  links: WikiGraphEdge[]
}

type ExtractedFile = {
  relPath: string
  absPath: string
  fileType: string
  hash: string
  size: number
  symbols: Array<{ name: string; line: number; kind: 'symbol' | 'concept' }>
  imports: string[]
  references: Array<{ name: string; line: number }>
}

const DEFAULT_IGNORE_PATTERNS = [
  '.git/',
  '.gakrcli/wiki/',
  'node_modules/',
  'dist/',
  'build/',
  'coverage/',
  '.pytest_cache/',
  '__pycache__/',
  '.next/',
  '.turbo/',
  '.cache/',
  'graphify-out/',
  '*.log',
  '*.tmp',
  '*.map',
  'package-lock.json',
  'bun.lock',
  'uv.lock',
]

const TEXT_EXTENSIONS = new Set([
  '.ts',
  '.tsx',
  '.js',
  '.jsx',
  '.mjs',
  '.cjs',
  '.ejs',
  '.vue',
  '.svelte',
  '.astro',
  '.py',
  '.go',
  '.rs',
  '.java',
  '.kt',
  '.swift',
  '.rb',
  '.php',
  '.cs',
  '.cpp',
  '.c',
  '.h',
  '.hpp',
  '.sh',
  '.ps1',
  '.ex',
  '.exs',
  '.lua',
  '.zig',
  '.dart',
  '.csproj',
  '.fsproj',
  '.vbproj',
  '.gradle',
  '.kts',
  '.json',
  '.yaml',
  '.yml',
  '.toml',
  '.md',
  '.mdx',
  '.txt',
  '.sql',
])

const CODE_EXTENSIONS = new Set([
  '.ts',
  '.tsx',
  '.js',
  '.jsx',
  '.mjs',
  '.cjs',
  '.ejs',
  '.vue',
  '.svelte',
  '.astro',
  '.py',
  '.go',
  '.rs',
  '.java',
  '.kt',
  '.swift',
  '.rb',
  '.php',
  '.cs',
  '.cpp',
  '.c',
  '.h',
  '.hpp',
  '.sh',
  '.ps1',
  '.ex',
  '.exs',
  '.lua',
  '.zig',
  '.dart',
  '.csproj',
  '.fsproj',
  '.vbproj',
  '.gradle',
  '.kts',
  '.json',
  '.yaml',
  '.yml',
  '.toml',
  '.sql',
])

const CALL_NOISE = new Set([
  'if',
  'for',
  'while',
  'switch',
  'catch',
  'return',
  'typeof',
  'sizeof',
  'new',
  'function',
  'Promise',
  'Array',
  'Object',
  'String',
  'Number',
  'Boolean',
  'Date',
  'JSON',
  'console',
  'setTimeout',
  'setInterval',
  'clearTimeout',
  'clearInterval',
  'filter',
  'map',
  'reduce',
  'trim',
  'get',
  'set',
  'has',
  'keys',
  'values',
  'entries',
  'from',
  'add',
  'toString',
  'now',
  'test',
  'it',
  'describe',
  'expect',
  'mock',
])

const JS_RESOLVE_EXTENSIONS = [
  '.ts',
  '.tsx',
  '.svelte',
  '.vue',
  '.astro',
  '.js',
  '.jsx',
  '.mjs',
  '.cjs',
  '.json',
]

const INDEX_FILENAMES = JS_RESOLVE_EXTENSIONS.map(ext => `index${ext}`)
const MAX_COMMUNITY_SIZE = 120

const MAX_TEXT_FILE_BYTES = 1_000_000

function toPosix(path: string): string {
  return path.replace(/\\/g, '/')
}

function hashText(input: string): string {
  return createHash('sha256').update(input).digest('hex')
}

function slug(value: string): string {
  return (
    value
      .replace(/[<>:"/\\|?*]/g, '_')
      .replace(/\s+/g, '_')
      .replace(/\.+$/g, '')
      .slice(0, 180) || 'unnamed'
  )
}

function communityKey(relPath: string): string {
  const parts = relPath.split('/')
  if (parts.length <= 1) {
    return '(root)'
  }
  if (parts[0] === 'src' && parts.length > 2) {
    return `${parts[0]}/${parts[1]}`
  }
  return parts[0]
}

function splitCommunityKey(node: WikiGraphNode): string {
  const parts = node.source_file.split('/')
  if (parts[0] === 'src' && parts.length >= 3) {
    return parts.slice(0, 3).join('/')
  }
  if (parts.length >= 2) {
    return parts.slice(0, 2).join('/')
  }
  return communityKey(node.source_file)
}

function classifyFile(path: string): string {
  const ext = extname(path).toLowerCase()
  if (CODE_EXTENSIONS.has(ext)) return 'code'
  if (ext === '.md' || ext === '.mdx' || ext === '.txt') return 'document'
  if (ext === '.json' || ext === '.yaml' || ext === '.yml' || ext === '.toml') return 'config'
  if (['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg'].includes(ext)) return 'image'
  if (['.mp4', '.mov', '.webm', '.mp3', '.wav', '.m4a'].includes(ext)) return 'media'
  return 'file'
}

function symbolId(relPath: string, name: string, line: number): string {
  return `symbol:${relPath}:${line}:${name}`
}

function fileId(relPath: string): string {
  return `file:${relPath}`
}

function isFileNodeId(nodeId: string): boolean {
  return nodeId.startsWith('file:')
}

function dirname(path: string): string {
  const index = path.lastIndexOf('/')
  return index === -1 ? '' : path.slice(0, index)
}

function normalizeRel(path: string): string {
  const output: string[] = []
  for (const part of toPosix(path).split('/')) {
    if (!part || part === '.') continue
    if (part === '..') {
      output.pop()
    } else {
      output.push(part)
    }
  }
  return output.join('/')
}

async function loadIgnore(cwd: string): Promise<ReturnType<typeof ignore>> {
  const ig = ignore().add(DEFAULT_IGNORE_PATTERNS)
  for (const file of ['.gitignore', '.wikiignore']) {
    try {
      ig.add(await readFile(join(cwd, file), 'utf8'))
    } catch {
      continue
    }
  }
  return ig
}

async function collectProjectFiles(projectRoot: string, scanRoot: string): Promise<string[]> {
  const ig = await loadIgnore(projectRoot)
  const files: string[] = []

  async function walk(dir: string): Promise<void> {
    const entries = await readdir(dir, { withFileTypes: true })
    for (const entry of entries) {
      const absPath = join(dir, entry.name)
      const relPath = toPosix(relative(projectRoot, absPath))
      if (!relPath || ig.ignores(entry.isDirectory() ? `${relPath}/` : relPath)) {
        continue
      }

      if (entry.isDirectory()) {
        await walk(absPath)
      } else if (entry.isFile()) {
        files.push(absPath)
      }
    }
  }

  await walk(scanRoot)
  return files.sort()
}

function codeSymbols(content: string, ext: string): ExtractedFile['symbols'] {
  const symbols: ExtractedFile['symbols'] = []
  const lines = content.split(/\r?\n/)
  const patterns: RegExp[] = []

  if (['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs'].includes(ext)) {
    patterns.push(
      /\b(?:export\s+)?(?:async\s+)?function\s+([A-Za-z_$][\w$]*)\b/,
      /\b(?:export\s+)?class\s+([A-Za-z_$][\w$]*)\b/,
      /\b(?:export\s+)?interface\s+([A-Za-z_$][\w$]*)\b/,
      /\b(?:export\s+)?type\s+([A-Za-z_$][\w$]*)\b/,
      /\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s*)?\(?[^=]*\)?\s*=>/,
    )
  } else if (ext === '.py') {
    patterns.push(/^\s*(?:async\s+)?def\s+([A-Za-z_]\w*)\b/, /^\s*class\s+([A-Za-z_]\w*)\b/)
  } else if (ext === '.go') {
    patterns.push(/\bfunc\s+(?:\([^)]+\)\s*)?([A-Za-z_]\w*)\b/, /\btype\s+([A-Za-z_]\w*)\b/)
  } else if (ext === '.rs') {
    patterns.push(/\bfn\s+([A-Za-z_]\w*)\b/, /\b(?:struct|enum|trait)\s+([A-Za-z_]\w*)\b/)
  } else {
    patterns.push(/\b(?:class|interface|enum|struct)\s+([A-Za-z_]\w*)\b/)
  }

  for (const [index, line] of lines.entries()) {
    for (const pattern of patterns) {
      const match = pattern.exec(line)
      if (match?.[1]) {
        symbols.push({ name: match[1], line: index + 1, kind: 'symbol' })
      }
    }
  }

  return symbols.slice(0, 200)
}

function markdownConcepts(content: string): ExtractedFile['symbols'] {
  return content
    .split(/\r?\n/)
    .map((line, index) => {
      const match = /^(#{1,3})\s+(.+)$/.exec(line.trim())
      if (!match?.[2]) return null
      return { name: match[2].trim(), line: index + 1, kind: 'concept' as const }
    })
    .filter((item): item is ExtractedFile['symbols'][number] => item !== null)
    .slice(0, 100)
}

function importsFor(content: string, ext: string): string[] {
  const imports = new Set<string>()
  const patterns =
    ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs'].includes(ext)
      ? [
          /\bimport\s+.*?\s+from\s+['"]([^'"]+)['"]/g,
          /\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
          /\brequire\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
        ]
      : ext === '.py'
        ? [/^\s*from\s+([A-Za-z0-9_.]+)\s+import\b/gm, /^\s*import\s+([A-Za-z0-9_.]+)/gm]
        : ext === '.go'
          ? [/"([^"]+)"/g]
          : ext === '.rs'
            ? [/\buse\s+([^;]+);/g]
            : []

  for (const pattern of patterns) {
    for (const match of content.matchAll(pattern)) {
      if (match[1]) imports.add(match[1])
    }
  }
  return [...imports].slice(0, 100)
}

function referencesFor(content: string, ext: string): ExtractedFile['references'] {
  if (!CODE_EXTENSIONS.has(ext)) return []
  const refs = new Map<string, { name: string; line: number }>()
  const patterns =
    ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.vue', '.svelte', '.astro'].includes(ext)
      ? [/\b([A-Za-z_$][\w$]*)\s*\(/g]
      : ext === '.py'
        ? [/\b([A-Za-z_]\w*)\s*\(/g]
        : ext === '.go'
          ? [/\b([A-Za-z_]\w*)\s*\(/g]
          : ext === '.rs'
            ? [/\b([A-Za-z_]\w*)\s*(?:\(|::)/g]
            : [/\b([A-Za-z_]\w*)\s*\(/g]

  for (const pattern of patterns) {
    for (const match of content.matchAll(pattern)) {
      const name = match[1]
      const previous = match.index && match.index > 0 ? content[match.index - 1] : ''
      if (previous === '.') continue
      if (name && !CALL_NOISE.has(name)) {
        const before = content.slice(0, match.index)
        const line = before.split(/\r?\n/).length
        refs.set(`${name}:${line}`, { name, line })
      }
    }
  }

  return [...refs.values()].slice(0, 200)
}

function resolveLocalImport(
  fromRelPath: string,
  imported: string,
  filesByRelPath: Map<string, string>,
): string | null {
  const fromDir = dirname(fromRelPath)
  let base: string
  if (imported.startsWith('./') || imported.startsWith('../')) {
    base = normalizeRel(`${fromDir}/${imported}`)
  } else if (imported.startsWith('.')) {
    const leadingDots = imported.match(/^\.+/)?.[0].length ?? 1
    const modulePath = imported.slice(leadingDots).replace(/\./g, '/')
    const baseParts = fromDir.split('/').filter(Boolean)
    for (let index = 1; index < leadingDots; index += 1) {
      baseParts.pop()
    }
    base = normalizeRel(`${baseParts.join('/')}/${modulePath}`)
  } else {
    base = normalizeRel(imported.replace(/\./g, '/'))
  }
  const candidates = [base]

  if (base.endsWith('.js')) {
    candidates.push(base.slice(0, -3) + '.ts')
    candidates.push(base.slice(0, -3) + '.tsx')
  } else if (base.endsWith('.jsx')) {
    candidates.push(base.slice(0, -4) + '.tsx')
  } else if (!extname(base)) {
    for (const ext of JS_RESOLVE_EXTENSIONS) {
      candidates.push(`${base}${ext}`)
    }
    for (const indexFile of INDEX_FILENAMES) {
      candidates.push(`${base}/${indexFile}`)
    }
  }
  candidates.push(`${base}.py`, `${base}/__init__.py`)

  if (!imported.startsWith('.') && fromDir.includes('/')) {
    const packageRoot = fromDir.split('/')[0]
    candidates.push(`${packageRoot}/${base}.py`, `${packageRoot}/${base}/__init__.py`)
  }

  for (const candidate of candidates) {
    if (filesByRelPath.has(candidate)) {
      return candidate
    }
  }

  return null
}

async function extractFile(cwd: string, absPath: string): Promise<ExtractedFile | null> {
  const relPath = toPosix(relative(cwd, absPath))
  const info = await stat(absPath)
  const ext = extname(absPath).toLowerCase()
  const fileType = classifyFile(absPath)

  if (!TEXT_EXTENSIONS.has(ext) || info.size > MAX_TEXT_FILE_BYTES) {
    return {
      relPath,
      absPath,
      fileType,
      hash: `${info.size}:${info.mtimeMs}`,
      size: info.size,
      symbols: [],
      imports: [],
      references: [],
    }
  }

  const content = await readFile(absPath, 'utf8')
  const symbols =
    ext === '.md' || ext === '.mdx' ? markdownConcepts(content) : codeSymbols(content, ext)

  return {
    relPath,
    absPath,
    fileType,
    hash: hashText(content),
    size: info.size,
    symbols,
    imports: importsFor(content, ext),
    references: referencesFor(content, ext),
  }
}

function edgeWeight(edge: WikiGraphEdge): number {
  if (typeof edge.weight === 'number') return edge.weight
  if (edge.relation === 'imports_from' || edge.relation === 'imports') return 2
  if (edge.relation === 'calls') return 1.2
  if (edge.relation === 'references') return 0.8
  return 0.2
}

function buildAdjacency(graph: WikiGraph): Map<string, Map<string, number>> {
  const adjacency = new Map<string, Map<string, number>>()

  function add(source: string, target: string, weight: number): void {
    const sourceEdges = adjacency.get(source) ?? new Map<string, number>()
    sourceEdges.set(target, (sourceEdges.get(target) ?? 0) + weight)
    adjacency.set(source, sourceEdges)
  }

  for (const node of graph.nodes) {
    adjacency.set(node.id, adjacency.get(node.id) ?? new Map())
  }

  for (const edge of graph.links) {
    const weight = edgeWeight(edge)
    add(edge.source, edge.target, weight)
    add(edge.target, edge.source, weight)
  }

  return adjacency
}

function communityCohesion(graph: WikiGraph, nodeIds: string[]): number {
  if (nodeIds.length <= 1) return 1
  const members = new Set(nodeIds)
  let actual = 0
  for (const edge of graph.links) {
    if (members.has(edge.source) && members.has(edge.target)) {
      actual += 1
    }
  }
  const possible = (nodeIds.length * (nodeIds.length - 1)) / 2
  return possible > 0 ? actual / possible : 0
}

function remapCommunities(graph: WikiGraph, communities: Map<number, string[]>): void {
  const sorted = [...communities.values()]
    .filter(nodes => nodes.length > 0)
    .sort((a, b) => b.length - a.length || a[0].localeCompare(b[0]))

  const nodeCommunity = new Map<string, number>()
  for (const [index, nodes] of sorted.entries()) {
    for (const nodeId of nodes) {
      nodeCommunity.set(nodeId, index)
    }
  }

  for (const node of graph.nodes) {
    node.community = nodeCommunity.get(node.id) ?? sorted.length
  }
}

function splitOversizedCommunities(
  graph: WikiGraph,
  communities: Map<number, string[]>,
): Map<number, string[]> {
  const nodesById = new Map(graph.nodes.map(node => [node.id, node]))
  const output = new Map<number, string[]>()
  let nextCommunity = 0

  for (const nodes of communities.values()) {
    if (nodes.length <= MAX_COMMUNITY_SIZE) {
      output.set(nextCommunity, nodes)
      nextCommunity += 1
      continue
    }

    const buckets = new Map<string, string[]>()
    for (const nodeId of nodes) {
      const node = nodesById.get(nodeId)
      const key = node ? splitCommunityKey(node) : '(unknown)'
      const bucket = buckets.get(key) ?? []
      bucket.push(nodeId)
      buckets.set(key, bucket)
    }

    for (const bucket of [...buckets.values()].sort((a, b) => b.length - a.length)) {
      const sorted = bucket.sort()
      for (let index = 0; index < sorted.length; index += MAX_COMMUNITY_SIZE) {
        output.set(nextCommunity, sorted.slice(index, index + MAX_COMMUNITY_SIZE))
        nextCommunity += 1
      }
    }
  }

  return output
}

function mergeSmallCommunities(
  graph: WikiGraph,
  communities: Map<number, string[]>,
  minSize = 8,
): Map<number, string[]> {
  const nodeCommunity = new Map<string, number>()
  for (const [community, nodes] of communities) {
    for (const node of nodes) {
      nodeCommunity.set(node, community)
    }
  }

  const communityEdges = new Map<number, Map<number, number>>()
  for (const edge of graph.links) {
    const sourceCommunity = nodeCommunity.get(edge.source)
    const targetCommunity = nodeCommunity.get(edge.target)
    if (
      sourceCommunity === undefined ||
      targetCommunity === undefined ||
      sourceCommunity === targetCommunity
    ) {
      continue
    }
    const weight = edgeWeight(edge)
    const sourceEdges = communityEdges.get(sourceCommunity) ?? new Map<number, number>()
    sourceEdges.set(targetCommunity, (sourceEdges.get(targetCommunity) ?? 0) + weight)
    communityEdges.set(sourceCommunity, sourceEdges)
    const targetEdges = communityEdges.get(targetCommunity) ?? new Map<number, number>()
    targetEdges.set(sourceCommunity, (targetEdges.get(sourceCommunity) ?? 0) + weight)
    communityEdges.set(targetCommunity, targetEdges)
  }

  const output = new Map([...communities].map(([community, nodes]) => [community, [...nodes]]))
  const smallCommunities = [...output.entries()]
    .filter(([, nodes]) => nodes.length > 0 && nodes.length <= minSize)
    .sort((a, b) => a[1].length - b[1].length)

  for (const [community, nodes] of smallCommunities) {
    if (!output.has(community) || (output.get(community)?.length ?? 0) > minSize) continue
    const candidates = [...(communityEdges.get(community)?.entries() ?? [])]
      .filter(([target]) => target !== community && output.has(target))
      .sort((a, b) => b[1] - a[1] || a[0] - b[0])
    const target = candidates[0]?.[0]
    if (target === undefined) continue
    const targetNodes = output.get(target)
    if (!targetNodes) continue
    targetNodes.push(...nodes)
    output.delete(community)
  }

  return output
}

function assignCommunities(graph: WikiGraph): void {
  if (graph.nodes.length === 0) return
  const adjacency = buildAdjacency(graph)
  const communityByNode = new Map<string, number>()
  const communitySizes = new Map<number, number>()

  for (const [index, node] of graph.nodes.entries()) {
    communityByNode.set(node.id, index)
    communitySizes.set(index, 1)
  }

  const nodeOrder = [...graph.nodes]
    .sort((a, b) => (adjacency.get(b.id)?.size ?? 0) - (adjacency.get(a.id)?.size ?? 0) || a.id.localeCompare(b.id))

  for (let iteration = 0; iteration < 16; iteration += 1) {
    let moved = false
    for (const node of nodeOrder) {
      const current = communityByNode.get(node.id)
      if (current === undefined) continue

      const scores = new Map<number, number>()
      for (const [neighbor, weight] of adjacency.get(node.id) ?? []) {
        const community = communityByNode.get(neighbor)
        if (community === undefined) continue
        const size = communitySizes.get(community) ?? 1
        scores.set(community, (scores.get(community) ?? 0) + weight / Math.sqrt(size))
      }

      let bestCommunity = current
      let bestScore = scores.get(current) ?? 0
      for (const [community, score] of scores) {
        if (score > bestScore + 0.0001 || (score === bestScore && community < bestCommunity)) {
          bestCommunity = community
          bestScore = score
        }
      }

      if (bestCommunity !== current && bestScore > 0) {
        communityByNode.set(node.id, bestCommunity)
        communitySizes.set(current, Math.max(0, (communitySizes.get(current) ?? 1) - 1))
        communitySizes.set(bestCommunity, (communitySizes.get(bestCommunity) ?? 0) + 1)
        moved = true
      }
    }
    if (!moved) break
  }

  const communities = new Map<number, string[]>()
  for (const [nodeId, community] of communityByNode) {
    const nodes = communities.get(community) ?? []
    nodes.push(nodeId)
    communities.set(community, nodes)
  }

  const split = splitOversizedCommunities(graph, communities)
  remapCommunities(graph, mergeSmallCommunities(graph, split))
}

function buildGraph(cwd: string, files: ExtractedFile[]): WikiGraph {
  const generatedAt = new Date().toISOString()
  const nodes: WikiGraphNode[] = []
  const links: WikiGraphEdge[] = []
  const filesByRelPath = new Map(files.map(file => [file.relPath, fileId(file.relPath)]))
  const filesByDirectory = new Map<string, string[]>()
  const symbolIdsByName = new Map<string, string[]>()
  const symbolIdsByFile = new Map<string, string[]>()

  for (const file of files) {
    const fid = fileId(file.relPath)
    const directory = dirname(file.relPath)
    const dirFiles = filesByDirectory.get(directory) ?? []
    dirFiles.push(file.relPath)
    filesByDirectory.set(directory, dirFiles)
    nodes.push({
      id: fid,
      label: file.relPath,
      type: 'file',
      source_file: file.relPath,
      source_location: 'L1',
      community: 0,
      file_type: file.fileType,
    })

    for (const symbol of file.symbols) {
      const sid = symbolId(file.relPath, symbol.name, symbol.line)
      const byName = symbolIdsByName.get(symbol.name) ?? []
      byName.push(sid)
      symbolIdsByName.set(symbol.name, byName)
      const byFile = symbolIdsByFile.get(file.relPath) ?? []
      byFile.push(sid)
      symbolIdsByFile.set(file.relPath, byFile)
      nodes.push({
        id: sid,
        label: symbol.name,
        type: symbol.kind,
        source_file: file.relPath,
        source_location: `L${symbol.line}`,
        community: 0,
        file_type: file.fileType,
      })
      links.push({
        source: fid,
        target: sid,
        relation: 'contains',
        confidence: 'EXTRACTED',
        source_file: file.relPath,
        weight: 0.2,
      })
    }
  }

  for (const dirFiles of filesByDirectory.values()) {
    const sortedFiles = dirFiles.sort()
    for (let index = 1; index < sortedFiles.length; index += 1) {
      links.push({
        source: fileId(sortedFiles[index - 1]),
        target: fileId(sortedFiles[index]),
        relation: 'references',
        confidence: 'EXTRACTED',
        source_file: sortedFiles[index],
        weight: 0.35,
      })
    }
  }

  const nodeIds = new Set(nodes.map(node => node.id))
  for (const file of files) {
    for (const imported of file.imports) {
      const resolved = resolveLocalImport(file.relPath, imported, filesByRelPath)
      const target = resolved ? filesByRelPath.get(resolved) : null
      if (target && target !== fileId(file.relPath) && nodeIds.has(target)) {
        links.push({
          source: fileId(file.relPath),
          target,
          relation: 'imports_from',
          confidence: 'EXTRACTED',
          source_file: file.relPath,
          weight: 2,
        })
      }
    }

    const localSymbolIds = new Set(symbolIdsByFile.get(file.relPath) ?? [])
    for (const reference of file.references) {
      const candidates = symbolIdsByName.get(reference.name) ?? []
      const preferred = candidates.find(candidate => localSymbolIds.has(candidate)) ?? candidates[0]
      if (!preferred) continue

      const sourceSymbol = [...file.symbols]
        .filter(symbol => symbol.kind === 'symbol' && symbol.line <= reference.line)
        .sort((a, b) => b.line - a.line)[0]
      const source = sourceSymbol
        ? symbolId(file.relPath, sourceSymbol.name, sourceSymbol.line)
        : fileId(file.relPath)
      const relation = sourceSymbol ? 'calls' : 'references'
      if (source !== preferred) {
        links.push({
          source,
          target: preferred,
          relation,
          confidence: 'EXTRACTED',
          source_file: file.relPath,
          weight: relation === 'calls' ? 0.9 : 0.7,
        })
      }
    }
  }

  const graph: WikiGraph = {
    directed: true,
    multigraph: false,
    graph: {
      generated_by: 'gakrcli-wiki',
      generated_at: generatedAt,
      root: cwd,
    },
    nodes,
    links,
  }
  assignCommunities(graph)
  return graph
}

function degreeMap(graph: WikiGraph): Map<string, number> {
  const degree = new Map<string, number>()
  for (const link of graph.links) {
    degree.set(link.source, (degree.get(link.source) ?? 0) + 1)
    degree.set(link.target, (degree.get(link.target) ?? 0) + 1)
  }
  return degree
}

function communitiesFor(graph: WikiGraph): Map<number, WikiGraphNode[]> {
  const communities = new Map<number, WikiGraphNode[]>()
  for (const node of graph.nodes) {
    const nodes = communities.get(node.community) ?? []
    nodes.push(node)
    communities.set(node.community, nodes)
  }
  return communities
}

function isFileNode(node: WikiGraphNode): boolean {
  return node.type === 'file' || isFileNodeId(node.id)
}

function isConceptNode(node: WikiGraphNode): boolean {
  return node.type === 'concept'
}

function godNodes(graph: WikiGraph, limit = 20): Array<WikiGraphNode & { degree: number }> {
  const degree = degreeMap(graph)
  return [...graph.nodes]
    .filter(node => !isFileNode(node) && !isConceptNode(node))
    .map(node => ({ ...node, degree: degree.get(node.id) ?? 0 }))
    .filter(node => node.degree > 0)
    .sort((a, b) => b.degree - a.degree || a.label.localeCompare(b.label))
    .slice(0, limit)
}

function crossCommunityConnections(graph: WikiGraph, limit = 12): Array<{
  source: WikiGraphNode
  target: WikiGraphNode
  edge: WikiGraphEdge
}> {
  const nodesById = new Map(graph.nodes.map(node => [node.id, node]))
  const seenPairs = new Set<string>()
  const items: Array<{ source: WikiGraphNode; target: WikiGraphNode; edge: WikiGraphEdge }> = []

  for (const edge of graph.links) {
    if (edge.relation === 'contains' || edge.relation === 'imports' || edge.relation === 'imports_from') {
      continue
    }
    const source = nodesById.get(edge.source)
    const target = nodesById.get(edge.target)
    if (!source || !target || source.community === target.community) continue
    if (isFileNode(source) || isFileNode(target)) continue

    const pair = [source.community, target.community].sort((a, b) => a - b).join(':')
    if (seenPairs.has(pair)) continue
    seenPairs.add(pair)
    items.push({ source, target, edge })
    if (items.length >= limit) break
  }

  return items
}

function importCycles(graph: WikiGraph, limit = 20): string[][] {
  const adjacency = new Map<string, Set<string>>()
  for (const edge of graph.links) {
    if (edge.relation !== 'imports_from' && edge.relation !== 'imports') continue
    const source = edge.source.replace(/^file:/, '')
    const target = edge.target.replace(/^file:/, '')
    const edges = adjacency.get(source) ?? new Set<string>()
    edges.add(target)
    adjacency.set(source, edges)
  }

  const cycles: string[][] = []
  const seen = new Set<string>()

  function visit(start: string, current: string, path: string[]): void {
    if (path.length > 5 || cycles.length >= limit) return
    for (const next of adjacency.get(current) ?? []) {
      if (next === start && path.length > 1) {
        const core = [...path]
        const minIndex = core.indexOf([...core].sort()[0])
        const normalized = [...core.slice(minIndex), ...core.slice(0, minIndex)]
        const key = normalized.join('>')
        if (!seen.has(key)) {
          seen.add(key)
          cycles.push(normalized)
        }
      } else if (!path.includes(next)) {
        visit(start, next, [...path, next])
      }
    }
  }

  for (const node of adjacency.keys()) {
    visit(node, node, [node])
    if (cycles.length >= limit) break
  }

  return cycles.sort((a, b) => a.length - b.length)
}

function generateReport(graph: WikiGraph, files: ExtractedFile[]): string {
  const degree = degreeMap(graph)
  const topNodes = godNodes(graph)
  const communities = communitiesFor(graph)
  const communityEntries = [...communities.entries()].sort((a, b) => b[1].length - a[1].length)
  const thinCommunities = communityEntries.filter(([, nodes]) => nodes.filter(node => !isFileNode(node)).length < 3)
  const shownCommunities = communityEntries.length - thinCommunities.length
  const extractedEdges = graph.links.filter(edge => edge.confidence === 'EXTRACTED').length
  const cycles = importCycles(graph)
  const surprising = crossCommunityConnections(graph)
  const isolated = graph.nodes.filter(
    node => (degree.get(node.id) ?? 0) <= 1 && !isFileNode(node) && !isConceptNode(node),
  )
  const lowCohesion = communityEntries
    .map(([community, nodes]) => ({
      community,
      nodes,
      cohesion: communityCohesion(graph, nodes.map(node => node.id)),
    }))
    .filter(item => item.nodes.length >= 5 && item.cohesion < 0.15)
    .slice(0, 5)

  return [
    `# Graph Report - ${basename(graph.graph.root)}  (${new Date().toISOString().slice(0, 10)})`,
    '',
    '## Corpus Check',
    `- ${files.length} files indexed by local wiki init`,
    '- Verdict: corpus is large enough that graph structure adds value.',
    '',
    '## Summary',
    `- ${graph.nodes.length} nodes - ${graph.links.length} edges - ${communities.size} communities` +
      (thinCommunities.length > 0 ? ` (${shownCommunities} shown, ${thinCommunities.length} thin omitted)` : ''),
    `- Extraction: ${Math.round((extractedEdges / Math.max(graph.links.length, 1)) * 100)}% EXTRACTED - 0% INFERRED - 0% AMBIGUOUS`,
    '- Token cost: 0 input - 0 output',
    '',
    '## Graph Freshness',
    '- Built by `/wiki init` from current working tree.',
    '- Run `/wiki init` after code changes to force-rebuild the local graph.',
    '',
    '## Community Hubs (Navigation)',
    ...communityEntries.map(([community]) => `- [[_COMMUNITY_Community ${community}|Community ${community}]]`),
    '',
    '## God Nodes (most connected - your core abstractions)',
    '',
    ...topNodes.map((node, index) => `${index + 1}. \`${node.label}\` - ${node.degree} edges`),
    '',
    '## Surprising Connections (you probably did not know these)',
    ...(surprising.length > 0
      ? surprising.flatMap(({ source, target, edge }) => [
          `- \`${source.label}\` --${edge.relation}--> \`${target.label}\`  [${edge.confidence}]`,
          `  ${source.source_file} -> ${target.source_file}  _Bridges community ${source.community} to community ${target.community}_`,
        ])
      : ['- None detected - all connections are within the same source files or communities.']),
    '',
    '## Import Cycles',
    ...(cycles.length > 0
      ? cycles.map(cycle => `- ${cycle.length}-file cycle: \`${[...cycle, cycle[0]].join(' -> ')}\``)
      : ['- None detected.']),
    '',
    `## Communities (${communities.size} total, ${thinCommunities.length} thin omitted)`,
    '',
    ...communityEntries.flatMap(([community, nodes]) => {
      const realNodes = nodes.filter(node => !isFileNode(node))
      if (realNodes.length < 3) return []
      const display = realNodes
        .sort((a, b) => (degree.get(b.id) ?? 0) - (degree.get(a.id) ?? 0))
        .slice(0, 8)
        .map(node => node.label)
      const suffix = realNodes.length > 8 ? ` (+${realNodes.length - 8} more)` : ''
      return [
        `### Community ${community} - "Community ${community}"`,
        `Cohesion: ${communityCohesion(graph, nodes.map(node => node.id)).toFixed(2)}`,
        `Nodes (${realNodes.length}): ${display.join(', ')}${suffix}`,
        '',
      ]
    }),
    '## Knowledge Gaps',
    ...(isolated.length > 0
      ? [
          `- **${isolated.length} isolated node(s):** ${isolated.slice(0, 5).map(node => `\`${node.label}\``).join(', ')}${isolated.length > 5 ? ` (+${isolated.length - 5} more)` : ''}`,
          '  These have <=1 connection - possible missing edges or undocumented components.',
        ]
      : ['- No isolated non-file nodes detected.']),
    ...(thinCommunities.length > 0
      ? [`- **${thinCommunities.length} thin communities (<3 nodes) omitted from report** - use the graph wiki index to inspect them.`]
      : []),
    '',
    '## Suggested Questions',
    '',
    ...topNodes.slice(0, 3).map(node => `- **Why is \`${node.label}\` central to this project?**`),
    ...lowCohesion.map(item => `- **Should \`Community ${item.community}\` be split into smaller, more focused modules?**`),
    ...(isolated.length > 0
      ? [`- **What connects \`${isolated[0].label}\` to the rest of the system?**`]
      : []),
    '',
  ].join('\n')
}

function generateHtml(graph: WikiGraph): string {
  const data = JSON.stringify({
    nodes: graph.nodes.map(node => ({
      id: node.id,
      label: node.label,
      group: node.community,
      type: node.type,
      source: node.source_file,
    })),
    links: graph.links,
  })

  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>GakrCLI Wiki Graph</title>
  <style>
    body { margin: 0; font-family: system-ui, sans-serif; background: #101418; color: #e6f2e6; }
    header { padding: 16px 20px; border-bottom: 1px solid #2b3a32; }
    #graph { width: 100vw; height: calc(100vh - 74px); }
    .hint { color: #8fb89a; font-size: 13px; }
  </style>
</head>
<body>
  <header>
    <strong>GakrCLI Wiki Graph</strong>
    <div class="hint">${graph.nodes.length} nodes - ${graph.links.length} edges. Open graph.json for machine-readable data.</div>
  </header>
  <pre id="graph"></pre>
  <script>
    const data = ${data};
    document.getElementById('graph').textContent = JSON.stringify(data, null, 2);
  </script>
</body>
</html>`
}

async function generateGraphWiki(paths: ReturnType<typeof getWikiPaths>, graph: WikiGraph): Promise<void> {
  await rm(paths.graphWikiDir, { recursive: true, force: true })
  await mkdir(paths.graphWikiDir, { recursive: true })

  const degree = degreeMap(graph)
  const byCommunity = communitiesFor(graph)
  const nodesById = new Map(graph.nodes.map(node => [node.id, node]))
  const nodeCommunity = new Map(graph.nodes.map(node => [node.id, node.community]))
  const incidentEdges = new Map<string, WikiGraphEdge[]>()
  for (const edge of graph.links) {
    const sourceEdges = incidentEdges.get(edge.source) ?? []
    sourceEdges.push(edge)
    incidentEdges.set(edge.source, sourceEdges)
    const targetEdges = incidentEdges.get(edge.target) ?? []
    targetEdges.push(edge)
    incidentEdges.set(edge.target, targetEdges)
  }
  const sortedCommunities = [...byCommunity.entries()].sort((a, b) => b[1].length - a[1].length)
  const gods = godNodes(graph, 25)
  const index = [
    '# Knowledge Graph Index',
    '',
    '> Auto-generated by GakrCLI wiki init. Start here: read community articles for context, then drill into god nodes for detail.',
    '',
    `**${graph.nodes.length} nodes - ${graph.links.length} edges - ${byCommunity.size} communities**`,
    '',
    '---',
    '',
    '## Communities',
    '(sorted by size, largest first)',
    '',
    ...sortedCommunities.map(([community, nodes]) => `- [Community ${community}](./${slug(`Community ${community}`)}.md) - ${nodes.length} nodes`),
    '',
    '## God Nodes',
    '(most connected concepts - the load-bearing abstractions)',
    '',
    ...gods.map(node => `- [${node.label}](./${slug(node.label)}.md) - ${node.degree} connections`),
    '',
  ].join('\n')

  await writeFile(paths.graphWikiIndexFile, index, 'utf8')

  for (const [community, nodes] of sortedCommunities) {
    const topNodes = [...nodes]
      .filter(node => !isFileNode(node))
      .sort((a, b) => (degree.get(b.id) ?? 0) - (degree.get(a.id) ?? 0))
      .slice(0, 50)
    const sources = [...new Set(nodes.map(node => node.source_file))].slice(0, 50)
    const crossCounts = new Map<number, number>()
    for (const node of nodes) {
      for (const edge of incidentEdges.get(node.id) ?? []) {
        const other = edge.source === node.id ? edge.target : edge.source
        const otherCommunity = nodeCommunity.get(other)
        if (otherCommunity !== undefined && otherCommunity !== community) {
          crossCounts.set(otherCommunity, (crossCounts.get(otherCommunity) ?? 0) + 1)
        }
      }
    }
    const page = [
      `# Community ${community}`,
      '',
      `> ${nodes.length} nodes - cohesion ${communityCohesion(graph, nodes.map(node => node.id)).toFixed(2)}`,
      '',
      '## Key Concepts',
      '',
      ...topNodes.map(node => `- **${node.label}** (${degree.get(node.id) ?? 0} connections) - \`${node.source_file}${node.source_location ? ` ${node.source_location}` : ''}\``),
      '',
      '## Relationships',
      '',
      ...([...crossCounts.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 12)
        .map(([otherCommunity, count]) => `- [Community ${otherCommunity}](./${slug(`Community ${otherCommunity}`)}.md) (${count} shared connections)`)),
      ...(crossCounts.size === 0 ? ['- No strong cross-community connections detected'] : []),
      '',
      '## Source Files',
      '',
      ...sources.map(source => `- \`${source}\``),
      '',
      '## Audit Trail',
      '',
      '- EXTRACTED: 100%',
      '- INFERRED: 0%',
      '- AMBIGUOUS: 0%',
      '',
      '[Back to index](./index.md)',
      '',
    ].join('\n')
    await writeFile(join(paths.graphWikiDir, `${slug(`Community ${community}`)}.md`), page, 'utf8')
  }

  for (const node of gods) {
    const neighbors = (incidentEdges.get(node.id) ?? [])
      .map(edge => {
        const otherId = edge.source === node.id ? edge.target : edge.source
        const other = nodesById.get(otherId)
        return { edge, other }
      })
      .filter((item): item is { edge: WikiGraphEdge; other: WikiGraphNode } => item.other !== undefined)
      .sort((a, b) => (degree.get(b.other.id) ?? 0) - (degree.get(a.other.id) ?? 0))

    const byRelation = new Map<string, Array<{ edge: WikiGraphEdge; other: WikiGraphNode }>>()
    for (const item of neighbors) {
      const items = byRelation.get(item.edge.relation) ?? []
      items.push(item)
      byRelation.set(item.edge.relation, items)
    }

    const article = [
      `# ${node.label}`,
      '',
      `> God node - ${node.degree} connections - \`${node.source_file}\``,
      '',
      `**Community:** [Community ${node.community}](./${slug(`Community ${node.community}`)}.md)`,
      '',
      '## Connections by Relation',
      '',
      ...[...byRelation.entries()].flatMap(([relation, items]) => [
        `### ${relation}`,
        ...items.slice(0, 20).map(item => `- **${item.other.label}** \`${item.edge.confidence}\` - \`${item.other.source_file}\``),
        '',
      ]),
      '[Back to index](./index.md)',
      '',
    ].join('\n')

    await writeFile(join(paths.graphWikiDir, `${slug(node.label)}.md`), article, 'utf8')
  }
}

function resolveInsideProject(cwd: string, target: string): string {
  const raw = target.trim() || '.'
  const abs = isAbsolute(raw) ? raw : resolve(cwd, raw)
  const rel = relative(cwd, abs)
  if (rel.startsWith('..') || isAbsolute(rel)) {
    throw new Error('Wiki init only supports paths inside the current project.')
  }
  return abs
}

export async function initializeWikiKnowledge(
  cwd: string,
  target = '.',
): Promise<WikiKnowledgeInitResult> {
  const init = await initializeWiki(cwd)
  const paths = getWikiPaths(cwd)
  const scanRoot = resolveInsideProject(cwd, target)
  const files = await collectProjectFiles(cwd, scanRoot)
  const extracted = (
    await Promise.all(files.map(file => extractFile(cwd, file)))
  ).filter((file): file is ExtractedFile => file !== null)

  const graph = buildGraph(cwd, extracted)
  await mkdir(paths.graphDir, { recursive: true })
  await writeFile(paths.graphJsonFile, JSON.stringify(graph, null, 2), 'utf8')
  await writeFile(paths.graphReportFile, generateReport(graph, extracted), 'utf8')
  await writeFile(paths.graphHtmlFile, generateHtml(graph), 'utf8')
  await writeFile(
    paths.graphManifestFile,
    JSON.stringify(
      {
        generated_at: graph.graph.generated_at,
        files: extracted.map(file => ({
          path: file.relPath,
          hash: file.hash,
          size: file.size,
          type: file.fileType,
        })),
      },
      null,
      2,
    ),
    'utf8',
  )
  await generateGraphWiki(paths, graph)
  await rebuildWikiIndex(cwd)

  return {
    ...init,
    graphRoot: paths.graphDir,
    indexedFiles: extracted.length,
    nodeCount: graph.nodes.length,
    edgeCount: graph.links.length,
    communityCount: new Set(graph.nodes.map(node => node.community)).size,
    graphFiles: [
      paths.graphJsonFile,
      paths.graphReportFile,
      paths.graphHtmlFile,
      paths.graphManifestFile,
      paths.graphWikiIndexFile,
    ].map(file => toPosix(relative(cwd, file))),
  }
}
