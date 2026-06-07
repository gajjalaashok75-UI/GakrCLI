import { createHash } from 'crypto'
import { mkdir, readdir, readFile, rm, stat, writeFile } from 'fs/promises'
import { cpus } from 'os'
import { basename, extname, isAbsolute, join, relative, resolve } from 'path'
import ignore from 'ignore'
import { initializeWiki } from './init.js'
import { rebuildWikiIndex } from './indexBuilder.js'
import { getWikiPaths } from './paths.js'
import type { WikiInitResult, WikiKnowledgeInitResult, WikiKnowledgeUpdateResult } from './types.js'

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
  relation:
    | 'contains'
    | 'imports'
    | 'imports_from'
    | 'references'
    | 'calls'
    | 'method'
    | 'inherits'
    | 'implements'
    | 're_exports'
    | 'uses'
    | 'rationale_for'
  confidence: 'EXTRACTED'
  source_file?: string
  weight?: number
}

type ExtractedSymbol = {
  name: string
  line: number
  kind: 'symbol' | 'concept'
  symbolKind?: 'class' | 'function' | 'method' | 'type'
  parentName?: string
  bases?: string[]
  implements?: string[]
  rationale?: string
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
  mtimeMs: number
  symbols: ExtractedSymbol[]
  imports: Array<{ imported: string; names: string[]; line: number }>
  reExports: Array<{ imported: string; names: string[] }>
  uses: Array<{ name: string; line: number }>
  references: Array<{ name: string; line: number }>
}

type WikiGraphManifest = {
  generated_at?: string
  scan_root?: string
  files?: Array<{
    path: string
    hash: string
    size: number
    mtime_ms?: number
    type: string
  }>
}

type WikiKnowledgeInitOptions = {
  force?: boolean
}

export type WikiKnowledgeFreshness = {
  checked: boolean
  changed: boolean
  indexedFiles: number
  addedFiles: number
  modifiedFiles: number
  deletedFiles: number
}

const DEFAULT_IGNORE_PATTERNS = [
  '.git/',
  '.gakrcli/wiki/',
  '.graphify/',
  'node_modules/',
  'dist/',
  'build/',
  'target/',
  'out/',
  'coverage/',
  'lcov-report/',
  'visual-tests/',
  'visual-test/',
  '__snapshots__/',
  'snapshots/',
  'storybook-static/',
  'dist-protected/',
  '.pytest_cache/',
  '.mypy_cache/',
  '.ruff_cache/',
  '.tox/',
  '.eggs/',
  '__pycache__/',
  '.next/',
  '.nuxt/',
  '.turbo/',
  '.angular/',
  '.cache/',
  '.parcel-cache/',
  '.svelte-kit/',
  '.terraform/',
  '.serverless/',
  '.worktrees/',
  'graphify-out/',
  'worked/**/graph.json',
  'worked/**/graph.html',
  'worked/**/manifest.json',
  'worked/**/.obsidian/',
  '*.log',
  '*.tmp',
  '*.map',
  'package-lock.json',
  'yarn.lock',
  'pnpm-lock.yaml',
  'Cargo.lock',
  'poetry.lock',
  'Gemfile.lock',
  'composer.lock',
  'go.sum',
  'go.work.sum',
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
const GRAPH_WORKER_COUNT = Math.max(2, Math.min(8, cpus().length || 4))
const GRAPHIFY_DISPATCH_EXTENSIONS = new Set([
  '.py',
  '.js',
  '.jsx',
  '.mjs',
  '.ts',
  '.tsx',
  '.go',
  '.rs',
  '.java',
  '.groovy',
  '.gradle',
  '.c',
  '.h',
  '.cpp',
  '.cc',
  '.cxx',
  '.hpp',
  '.rb',
  '.cs',
  '.kt',
  '.kts',
  '.scala',
  '.php',
  '.swift',
  '.lua',
  '.luau',
  '.toc',
  '.zig',
  '.ps1',
  '.ex',
  '.exs',
  '.m',
  '.mm',
  '.jl',
  '.f',
  '.F',
  '.f90',
  '.F90',
  '.f95',
  '.F95',
  '.f03',
  '.F03',
  '.f08',
  '.F08',
  '.vue',
  '.svelte',
  '.astro',
  '.dart',
  '.v',
  '.sv',
  '.svh',
  '.sql',
  '.md',
  '.mdx',
  '.qmd',
  '.pas',
  '.pp',
  '.dpr',
  '.dpk',
  '.lpr',
  '.inc',
  '.dfm',
  '.lfm',
  '.lpk',
  '.sh',
  '.bash',
  '.json',
  '.tf',
  '.tfvars',
  '.hcl',
  '.dm',
  '.dme',
  '.dmi',
  '.dmm',
  '.dmf',
  '.sln',
  '.csproj',
  '.fsproj',
  '.vbproj',
  '.razor',
  '.cshtml',
  '.cls',
  '.trigger',
])

function toPosix(path: string): string {
  return path.replace(/\\/g, '/')
}

function hashText(input: string): string {
  return createHash('sha256').update(input).digest('hex')
}

async function mapWithWorkers<T, R>(
  items: T[],
  workerCount: number,
  mapper: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length)
  let cursor = 0
  const workers = Array.from(
    { length: Math.min(workerCount, Math.max(items.length, 1)) },
    async () => {
      while (cursor < items.length) {
        const index = cursor
        cursor += 1
        results[index] = await mapper(items[index], index)
      }
    },
  )
  await Promise.all(workers)
  return results
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
  if (CODE_EXTENSIONS.has(ext) || (GRAPHIFY_DISPATCH_EXTENSIONS.has(ext) && !['.md', '.mdx', '.qmd'].includes(ext))) return 'code'
  if (ext === '.md' || ext === '.mdx' || ext === '.qmd' || ext === '.txt') return 'document'
  if (ext === '.json' || ext === '.yaml' || ext === '.yml' || ext === '.toml') return 'config'
  if (['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg'].includes(ext)) return 'image'
  if (['.mp4', '.mov', '.webm', '.mp3', '.wav', '.m4a'].includes(ext)) return 'media'
  return 'file'
}

function symbolId(relPath: string, name: string, line: number): string {
  return `symbol:${relPath}:${line}:${name}`
}

function rationaleId(relPath: string, line: number, text: string): string {
  return `rationale:${relPath}:${line}:${hashText(text).slice(0, 12)}`
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

  const rootInfo = await stat(scanRoot)
  const rootRelPath = toPosix(relative(projectRoot, scanRoot))
  if (rootInfo.isFile()) {
    if (
      GRAPHIFY_DISPATCH_EXTENSIONS.has(extname(scanRoot)) &&
      (!rootRelPath || !ig.ignores(rootRelPath))
    ) {
      return [scanRoot]
    }
    return []
  }

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
      } else if (entry.isFile() && GRAPHIFY_DISPATCH_EXTENSIONS.has(extname(entry.name))) {
        files.push(absPath)
      }
    }
  }

  await walk(scanRoot)
  return files.sort()
}

function splitTypeList(value: string | undefined): string[] {
  if (!value) return []
  return value
    .split(/[,|&]/)
    .map(item => item.trim().replace(/<.*$/, '').replace(/\(.*$/, ''))
    .map(item => item.split(/\s+/).pop() ?? '')
    .filter(Boolean)
    .slice(0, 12)
}

function rationaleNear(lines: string[], index: number): string | undefined {
  const comments: string[] = []
  for (let i = index - 1; i >= 0 && comments.length < 5; i -= 1) {
    const trimmed = lines[i].trim()
    if (!trimmed) {
      if (comments.length > 0) break
      continue
    }
    const comment = trimmed
      .replace(/^\/\*\*?/, '')
      .replace(/\*\/$/, '')
      .replace(/^\*/, '')
      .replace(/^#/, '')
      .replace(/^\/\//, '')
      .trim()
    if (comment === trimmed && comments.length > 0) break
    if (comment === trimmed) break
    if (comment) comments.unshift(comment)
  }

  const next = lines[index + 1]?.trim()
  if (next?.startsWith('"""') || next?.startsWith("'''")) {
    const quote = next.slice(0, 3)
    const doc: string[] = [next.slice(3).replace(quote, '').trim()]
    for (let i = index + 2; i < lines.length && doc.length < 5; i += 1) {
      const line = lines[i].trim()
      if (line.includes(quote)) {
        doc.push(line.replace(quote, '').trim())
        break
      }
      doc.push(line)
    }
    comments.push(...doc.filter(Boolean))
  }

  const text = comments.join(' ').replace(/\s+/g, ' ').trim()
  return text ? text.slice(0, 180) : undefined
}

function codeSymbols(content: string, ext: string): ExtractedFile['symbols'] {
  const symbols: ExtractedFile['symbols'] = []
  const lines = content.split(/\r?\n/)
  const classStack: Array<{ name: string; indent: number; braceDepth?: number }> = []
  let braceDepth = 0

  for (const [index, line] of lines.entries()) {
    const lineNo = index + 1
    const trimmed = line.trim()
    const indent = line.length - line.trimStart().length
    while (
      classStack.length > 0 &&
      indent <= classStack[classStack.length - 1].indent &&
      ext === '.py' &&
      trimmed &&
      !trimmed.startsWith('#') &&
      !trimmed.startsWith('@')
    ) {
      classStack.pop()
    }

    let match: RegExpExecArray | null = null
    if (ext === '.py') {
      match = /^(\s*)class\s+([A-Za-z_]\w*)(?:\(([^)]*)\))?/.exec(line)
      if (match?.[2]) {
        classStack.push({ name: match[2], indent })
        symbols.push({
          name: match[2],
          line: lineNo,
          kind: 'symbol',
          symbolKind: 'class',
          bases: splitTypeList(match[3]),
          rationale: rationaleNear(lines, index),
        })
        continue
      }

      match = /^(\s*)(?:async\s+)?def\s+([A-Za-z_]\w*)\b/.exec(line)
      if (match?.[2]) {
        const parent = classStack[classStack.length - 1]
        symbols.push({
          name: match[2],
          line: lineNo,
          kind: 'symbol',
          symbolKind: parent ? 'method' : 'function',
          parentName: parent?.name,
          rationale: rationaleNear(lines, index),
        })
        continue
      }
    } else if (['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.vue', '.svelte', '.astro'].includes(ext)) {
      match = /\b(?:export\s+)?class\s+([A-Za-z_$][\w$]*)(?:\s+extends\s+([A-Za-z_$][\w$./]*))?(?:\s+implements\s+([^{]+))?/.exec(line)
      if (match?.[1]) {
        classStack.push({ name: match[1], indent, braceDepth })
        symbols.push({
          name: match[1],
          line: lineNo,
          kind: 'symbol',
          symbolKind: 'class',
          bases: splitTypeList(match[2]),
          implements: splitTypeList(match[3]),
          rationale: rationaleNear(lines, index),
        })
      }

      match = /\b(?:export\s+)?interface\s+([A-Za-z_$][\w$]*)(?:\s+extends\s+([^{]+))?/.exec(line)
      if (match?.[1]) {
        symbols.push({
          name: match[1],
          line: lineNo,
          kind: 'symbol',
          symbolKind: 'type',
          bases: splitTypeList(match[2]),
          rationale: rationaleNear(lines, index),
        })
      }

      match = /\b(?:export\s+)?type\s+([A-Za-z_$][\w$]*)\b/.exec(line)
      if (match?.[1]) {
        symbols.push({ name: match[1], line: lineNo, kind: 'symbol', symbolKind: 'type', rationale: rationaleNear(lines, index) })
      }

      match = /\b(?:export\s+)?(?:async\s+)?function\s+([A-Za-z_$][\w$]*)\b/.exec(line)
      if (match?.[1]) {
        symbols.push({ name: match[1], line: lineNo, kind: 'symbol', symbolKind: 'function', rationale: rationaleNear(lines, index) })
      }

      match = /\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s*)?\(?[^=]*\)?\s*=>/.exec(line)
      if (match?.[1]) {
        symbols.push({ name: match[1], line: lineNo, kind: 'symbol', symbolKind: 'function', rationale: rationaleNear(lines, index) })
      }

      const parent = classStack[classStack.length - 1]
      match = /^\s*(?:public\s+|private\s+|protected\s+|static\s+|async\s+)*([A-Za-z_$][\w$]*)\s*\([^)]*\)\s*[:{]/.exec(line)
      if (match?.[1] && parent && !['if', 'for', 'while', 'switch'].includes(match[1])) {
        symbols.push({
          name: match[1],
          line: lineNo,
          kind: 'symbol',
          symbolKind: 'method',
          parentName: parent.name,
          rationale: rationaleNear(lines, index),
        })
      }
    } else if (ext === '.go') {
      match = /\bfunc\s+(?:\([^)]+\)\s*)?([A-Za-z_]\w*)\b/.exec(line)
      if (match?.[1]) symbols.push({ name: match[1], line: lineNo, kind: 'symbol', symbolKind: 'function', rationale: rationaleNear(lines, index) })
      match = /\btype\s+([A-Za-z_]\w*)\b/.exec(line)
      if (match?.[1]) symbols.push({ name: match[1], line: lineNo, kind: 'symbol', symbolKind: 'type', rationale: rationaleNear(lines, index) })
    } else if (ext === '.rs') {
      match = /\bfn\s+([A-Za-z_]\w*)\b/.exec(line)
      if (match?.[1]) symbols.push({ name: match[1], line: lineNo, kind: 'symbol', symbolKind: 'function', rationale: rationaleNear(lines, index) })
      match = /\b(?:struct|enum|trait)\s+([A-Za-z_]\w*)\b/.exec(line)
      if (match?.[1]) symbols.push({ name: match[1], line: lineNo, kind: 'symbol', symbolKind: 'type', rationale: rationaleNear(lines, index) })
      match = /\bimpl\s+([A-Za-z_]\w*)\s+for\s+([A-Za-z_]\w*)/.exec(line)
      if (match?.[1] && match[2]) {
        const target = symbols.find(symbol => symbol.name === match?.[2])
        if (target) target.implements = [...(target.implements ?? []), match[1]]
      }
    } else if (['.java', '.php'].includes(ext)) {
      match = /\b(?:public\s+)?(?:abstract\s+)?(?:final\s+)?(?:class|interface)\s+([A-Za-z_]\w*)(?:\s+extends\s+([A-Za-z_][\w\\]*))?(?:\s+implements\s+([^{]+))?/.exec(line)
      if (match?.[1]) {
        symbols.push({
          name: match[1],
          line: lineNo,
          kind: 'symbol',
          symbolKind: 'class',
          bases: splitTypeList(match[2]),
          implements: splitTypeList(match[3]),
          rationale: rationaleNear(lines, index),
        })
      }
    } else if (['.cs', '.kt', '.swift'].includes(ext)) {
      match = /\b(?:public\s+|open\s+|data\s+|final\s+)*class\s+([A-Za-z_]\w*)(?:<[^>]+>)?(?:\([^)]*\))?\s*(?::\s*([^{]+))?/.exec(line)
      if (match?.[1]) {
        const types = splitTypeList(match[2])
        symbols.push({
          name: match[1],
          line: lineNo,
          kind: 'symbol',
          symbolKind: 'class',
          bases: types.slice(0, 1),
          implements: types.slice(1),
          rationale: rationaleNear(lines, index),
        })
      }
      match = /\b(?:public\s+|open\s+)?(?:interface|protocol)\s+([A-Za-z_]\w*)/.exec(line)
      if (match?.[1]) {
        symbols.push({ name: match[1], line: lineNo, kind: 'symbol', symbolKind: 'type', rationale: rationaleNear(lines, index) })
      }
      match = /\bextension\s+([A-Za-z_]\w*)\s*:\s*([^{]+)/.exec(line)
      if (match?.[1] && match[2]) {
        const target = symbols.find(symbol => symbol.name === match?.[1])
        if (target) target.implements = [...(target.implements ?? []), ...splitTypeList(match[2])]
      }
    } else if (ext === '.m') {
      match = /@interface\s+([A-Za-z_]\w*)(?:\s*:\s*([A-Za-z_]\w*))?(?:\s*<([^>]+)>)?/.exec(line)
      if (match?.[1]) {
        symbols.push({
          name: match[1],
          line: lineNo,
          kind: 'symbol',
          symbolKind: 'class',
          bases: splitTypeList(match[2]),
          implements: splitTypeList(match[3]),
          rationale: rationaleNear(lines, index),
        })
      }
    } else {
      match = /\b(?:class|interface|enum|struct)\s+([A-Za-z_]\w*)(?:\s*:\s*([^{]+)|\s+extends\s+([^{]+))?/.exec(line)
      if (match?.[1]) {
        symbols.push({
          name: match[1],
          line: lineNo,
          kind: 'symbol',
          symbolKind: 'class',
          bases: splitTypeList(match[2] ?? match[3]),
          rationale: rationaleNear(lines, index),
        })
      }
    }

    braceDepth += (line.match(/{/g) ?? []).length - (line.match(/}/g) ?? []).length
    while (
      classStack.length > 0 &&
      classStack[classStack.length - 1].braceDepth !== undefined &&
      braceDepth <= (classStack[classStack.length - 1].braceDepth ?? 0)
    ) {
      classStack.pop()
    }
  }

  return symbols.slice(0, 400)
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

function namesFromImportList(value: string): string[] {
  return value
    .split(',')
    .map(item => item.trim().replace(/^type\s+/, '').split(/\s+as\s+|\s+AS\s+/)[0]?.trim() ?? '')
    .map(item => item.replace(/^\{|\}$/g, '').trim())
    .filter(Boolean)
    .slice(0, 30)
}

function lineAt(content: string, index: number | undefined): number {
  if (index === undefined) return 1
  return content.slice(0, index).split(/\r?\n/).length
}

function importsFor(content: string, ext: string): ExtractedFile['imports'] {
  const imports = new Map<string, ExtractedFile['imports'][number]>()

  function add(imported: string, names: string[], line: number): void {
    const key = `${imported}:${names.join(',')}:${line}`
    imports.set(key, { imported, names, line })
  }

  if (['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs'].includes(ext)) {
    for (const match of content.matchAll(/\bimport\s+\{([^}]+)\}\s+from\s+['"]([^'"]+)['"]/g)) {
      if (match[1] && match[2]) add(match[2], namesFromImportList(match[1]), lineAt(content, match.index))
    }
    for (const match of content.matchAll(/\bimport\s+([A-Za-z_$][\w$]*)\s+from\s+['"]([^'"]+)['"]/g)) {
      if (match[1] && match[2]) add(match[2], [match[1]], lineAt(content, match.index))
    }
    for (const match of content.matchAll(/\bimport\s+\*\s+as\s+([A-Za-z_$][\w$]*)\s+from\s+['"]([^'"]+)['"]/g)) {
      if (match[1] && match[2]) add(match[2], [match[1]], lineAt(content, match.index))
    }
    for (const match of content.matchAll(/\bimport\s+['"]([^'"]+)['"]/g)) {
      if (match[1]) add(match[1], [], lineAt(content, match.index))
    }
    for (const match of content.matchAll(/\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g)) {
      if (match[1]) add(match[1], [], lineAt(content, match.index))
    }
    for (const match of content.matchAll(/\brequire\s*\(\s*['"]([^'"]+)['"]\s*\)/g)) {
      if (match[1]) add(match[1], [], lineAt(content, match.index))
    }
  } else if (ext === '.py') {
    for (const match of content.matchAll(/^\s*from\s+([A-Za-z0-9_.]+)\s+import\s+(.+)$/gm)) {
      if (match[1] && match[2]) add(match[1], namesFromImportList(match[2]), lineAt(content, match.index))
    }
    for (const match of content.matchAll(/^\s*import\s+([A-Za-z0-9_.]+)(?:\s+as\s+\w+)?/gm)) {
      if (match[1]) add(match[1], [match[1].split('.').pop() ?? match[1]], lineAt(content, match.index))
    }
  } else if (ext === '.go') {
    for (const match of content.matchAll(/"([^"]+)"/g)) {
      if (match[1]) add(match[1], [], lineAt(content, match.index))
    }
  } else if (ext === '.rs') {
    for (const match of content.matchAll(/\buse\s+([^;]+);/g)) {
      if (match[1]) {
        const imported = match[1].replace(/::\{.*$/, '').trim()
        add(imported, namesFromImportList(match[1].replace(/^.*::\{?/, '').replace(/\}?$/, '')), lineAt(content, match.index))
      }
    }
  }

  return [...imports.values()].slice(0, 100)
}

function reExportsFor(content: string, ext: string): ExtractedFile['reExports'] {
  if (!['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs'].includes(ext)) return []

  const reExports: ExtractedFile['reExports'] = []
  const patterns = [
    /\bexport\s+\*\s+from\s+['"]([^'"]+)['"]/g,
    /\bexport\s+\{([^}]+)\}\s+from\s+['"]([^'"]+)['"]/g,
  ]

  for (const match of content.matchAll(patterns[0])) {
    if (match[1]) reExports.push({ imported: match[1], names: [] })
  }

  for (const match of content.matchAll(patterns[1])) {
    if (!match[1] || !match[2]) continue
    const names = match[1]
      .split(',')
      .map(item => item.trim().replace(/^type\s+/, '').split(/\s+as\s+/i)[0]?.trim() ?? '')
      .filter(Boolean)
      .slice(0, 25)
    reExports.push({ imported: match[2], names })
  }

  return reExports.slice(0, 100)
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

function usesFor(content: string, ext: string): ExtractedFile['uses'] {
  if (!CODE_EXTENSIONS.has(ext)) return []
  const uses = new Map<string, { name: string; line: number }>()
  const patterns =
    ext === '.py'
      ? [
          /(?:^|[(:,])\s*([A-Z][A-Za-z0-9_]*)\s*(?:[=,):]|\|)/gm,
          /->\s*([A-Z][A-Za-z0-9_]*)/g,
          /\b([A-Z][A-Za-z0-9_]*)\s*\(/g,
        ]
      : [
          /:\s*([A-Z][A-Za-z0-9_]*)\b/g,
          /<\s*([A-Z][A-Za-z0-9_]*)\s*>/g,
          /\bnew\s+([A-Z][A-Za-z0-9_]*)\b/g,
          /->\s*([A-Z][A-Za-z0-9_]*)\b/g,
        ]

  for (const pattern of patterns) {
    for (const match of content.matchAll(pattern)) {
      const name = match[1]
      if (!name || CALL_NOISE.has(name) || name.length < 3) continue
      const before = content.slice(0, match.index)
      const line = before.split(/\r?\n/).length
      const lineText = content.split(/\r?\n/)[line - 1]?.trim() ?? ''
      if (/^(?:class|interface|type|struct|enum|trait|protocol)\b/.test(lineText)) continue
      uses.set(`${name}:${line}`, { name, line })
    }
  }

  return [...uses.values()].slice(0, 120)
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

  if (!GRAPHIFY_DISPATCH_EXTENSIONS.has(ext) || info.size > MAX_TEXT_FILE_BYTES) {
    return {
      relPath,
      absPath,
      fileType,
      hash: `${info.size}:${info.mtimeMs}`,
      size: info.size,
      mtimeMs: info.mtimeMs,
      symbols: [],
      imports: [],
      reExports: [],
      uses: [],
      references: [],
    }
  }

  const content = await readFile(absPath, 'utf8')
  const symbols =
    ext === '.md' || ext === '.mdx' || ext === '.qmd' ? markdownConcepts(content) : codeSymbols(content, ext)

  return {
    relPath,
    absPath,
    fileType,
    hash: hashText(content),
    size: info.size,
    mtimeMs: info.mtimeMs,
    symbols,
    imports: importsFor(content, ext),
    reExports: reExportsFor(content, ext),
    uses: usesFor(content, ext),
    references: referencesFor(content, ext),
  }
}

function edgeWeight(edge: WikiGraphEdge): number {
  if (typeof edge.weight === 'number') return edge.weight
  if (edge.relation === 'imports_from' || edge.relation === 'imports') return 2
  if (edge.relation === 'inherits' || edge.relation === 'implements') return 1.8
  if (edge.relation === 'method' || edge.relation === 're_exports') return 1.4
  if (edge.relation === 'calls') return 1.2
  if (edge.relation === 'uses') return 1
  if (edge.relation === 'references') return 0.8
  if (edge.relation === 'rationale_for') return 0.4
  return 0.2
}

function dedupeEdges(edges: WikiGraphEdge[]): WikiGraphEdge[] {
  const byKey = new Map<string, WikiGraphEdge>()
  for (const edge of edges) {
    if (edge.source === edge.target && edge.relation !== 'rationale_for') continue
    const key = `${edge.source}\u0000${edge.target}\u0000${edge.relation}`
    const existing = byKey.get(key)
    if (!existing) {
      byKey.set(key, edge)
      continue
    }
    const existingWeight = edgeWeight(existing)
    const nextWeight = edgeWeight(edge)
    if (nextWeight > existingWeight) {
      byKey.set(key, edge)
    }
  }
  return [...byKey.values()].sort(
    (a, b) =>
      a.source.localeCompare(b.source) ||
      a.target.localeCompare(b.target) ||
      a.relation.localeCompare(b.relation),
  )
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
  minSize = 3,
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
  const symbolIdsByFileAndName = new Map<string, string[]>()
  const symbolsById = new Map<string, ExtractedSymbol & { relPath: string }>()

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
      const byFileAndNameKey = `${file.relPath}:${symbol.name}`
      const byFileAndName = symbolIdsByFileAndName.get(byFileAndNameKey) ?? []
      byFileAndName.push(sid)
      symbolIdsByFileAndName.set(byFileAndNameKey, byFileAndName)
      symbolsById.set(sid, { ...symbol, relPath: file.relPath })
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

      if (symbol.rationale) {
        const rid = rationaleId(file.relPath, symbol.line, symbol.rationale)
        nodes.push({
          id: rid,
          label: symbol.rationale,
          type: 'concept',
          source_file: file.relPath,
          source_location: `L${symbol.line}`,
          community: 0,
          file_type: 'rationale',
        })
        links.push({
          source: rid,
          target: sid,
          relation: 'rationale_for',
          confidence: 'EXTRACTED',
          source_file: file.relPath,
          weight: 0.4,
        })
      }
    }
  }

  function symbolIdsForName(name: string, relPath?: string): string[] {
    if (relPath) {
      const local = symbolIdsByFileAndName.get(`${relPath}:${name}`)
      if (local?.length) return local
    }
    return symbolIdsByName.get(name) ?? []
  }

  function preferredSymbolId(name: string, relPath?: string): string | undefined {
    const candidates = symbolIdsForName(name, relPath)
    if (candidates.length === 0) return undefined
    return candidates
      .map(id => ({ id, symbol: symbolsById.get(id) }))
      .sort((a, b) => {
        const aLocal = a.symbol?.relPath === relPath ? 0 : 1
        const bLocal = b.symbol?.relPath === relPath ? 0 : 1
        return aLocal - bLocal || (a.symbol?.line ?? 0) - (b.symbol?.line ?? 0)
      })[0]?.id
  }

  for (const file of files) {
    for (const symbol of file.symbols) {
      const source = symbolId(file.relPath, symbol.name, symbol.line)
      if (symbol.parentName) {
        const parent = preferredSymbolId(symbol.parentName, file.relPath)
        if (parent && parent !== source) {
          links.push({
            source: parent,
            target: source,
            relation: 'method',
            confidence: 'EXTRACTED',
            source_file: file.relPath,
            weight: 1.4,
          })
        }
      }

      for (const base of symbol.bases ?? []) {
        const target = preferredSymbolId(base, file.relPath)
        if (!target || target === source) continue
        links.push({
          source,
          target,
          relation: 'inherits',
          confidence: 'EXTRACTED',
          source_file: file.relPath,
          weight: 1.8,
        })
      }

      for (const implemented of symbol.implements ?? []) {
        const target = preferredSymbolId(implemented, file.relPath)
        if (!target || target === source) continue
        links.push({
          source,
          target,
          relation: 'implements',
          confidence: 'EXTRACTED',
          source_file: file.relPath,
          weight: 1.8,
        })
      }
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
    for (const importRef of file.imports) {
      const resolved = resolveLocalImport(file.relPath, importRef.imported, filesByRelPath)
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
        const sourceSymbol = [...file.symbols]
          .filter(symbol => symbol.kind === 'symbol' && symbol.line <= importRef.line)
          .sort((a, b) => b.line - a.line)[0]
        const source = sourceSymbol
          ? symbolId(file.relPath, sourceSymbol.name, sourceSymbol.line)
          : fileId(file.relPath)
        const importedSymbols =
          importRef.names.length > 0
            ? importRef.names
                .map(name => preferredSymbolId(name, resolved))
                .filter((id): id is string => Boolean(id))
            : []
        for (const importedSymbol of importedSymbols.slice(0, 30)) {
          links.push({
            source,
            target: importedSymbol,
            relation: 'imports',
            confidence: 'EXTRACTED',
            source_file: file.relPath,
            weight: 1.6,
          })
        }
      }
    }

    for (const reExport of file.reExports) {
      const resolved = resolveLocalImport(file.relPath, reExport.imported, filesByRelPath)
      const target = resolved ? filesByRelPath.get(resolved) : null
      if (!target || target === fileId(file.relPath) || !nodeIds.has(target)) continue

      if (reExport.names.length === 0) {
        links.push({
          source: fileId(file.relPath),
          target,
          relation: 're_exports',
          confidence: 'EXTRACTED',
          source_file: file.relPath,
          weight: 1.4,
        })
        continue
      }

      for (const name of reExport.names) {
        const exportedSymbol = preferredSymbolId(name, resolved)
        links.push({
          source: fileId(file.relPath),
          target: exportedSymbol ?? target,
          relation: 're_exports',
          confidence: 'EXTRACTED',
          source_file: file.relPath,
          weight: 1.4,
        })
      }
    }

    const useEdgeKeys = new Set<string>()
    for (const use of file.uses) {
      const target = preferredSymbolId(use.name, file.relPath)
      if (!target) continue
      const sourceSymbol = [...file.symbols]
        .filter(symbol => symbol.kind === 'symbol' && symbol.line <= use.line)
        .sort((a, b) => b.line - a.line)[0]
      const source = sourceSymbol
        ? symbolId(file.relPath, sourceSymbol.name, sourceSymbol.line)
        : fileId(file.relPath)
      if (source === target) continue
      const key = `${source}->${target}`
      if (useEdgeKeys.has(key)) continue
      useEdgeKeys.add(key)
      links.push({
        source,
        target,
        relation: 'uses',
        confidence: 'EXTRACTED',
        source_file: file.relPath,
        weight: 0.8,
      })
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
    links: dedupeEdges(links),
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
    if (
      edge.relation === 'contains' ||
      edge.relation === 'imports' ||
      edge.relation === 'imports_from' ||
      edge.relation === 'method' ||
      edge.relation === 'rationale_for'
    ) {
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
    '- Run `/wiki update` after code changes to refresh the local graph.',
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
  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>GakrCLI Wiki Graph</title>
  <style>
    body { margin: 0; font-family: system-ui, sans-serif; background: #101418; color: #e6f2e6; }
    header { padding: 16px 20px; border-bottom: 1px solid #2b3a32; }
    main { padding: 20px; max-width: 880px; line-height: 1.5; }
    a { color: #95e6a4; }
    .hint { color: #8fb89a; font-size: 13px; }
    code { background: #1a211d; padding: 2px 6px; border-radius: 4px; }
  </style>
</head>
<body>
  <header>
    <strong>GakrCLI Wiki Graph</strong>
    <div class="hint">${graph.nodes.length} nodes - ${graph.links.length} edges - ${new Set(graph.nodes.map(node => node.community)).size} communities</div>
  </header>
  <main>
    <p>The full graph is saved next to this file as <a href="./graph.json">graph.json</a>.</p>
    <p>Start with <a href="./GRAPH_REPORT.md">GRAPH_REPORT.md</a> for central nodes and surprising connections, or open <a href="./wiki/index.md">wiki/index.md</a> for community pages.</p>
    <p class="hint">This HTML intentionally references graph artifacts instead of embedding the full graph inline, keeping <code>/wiki init</code> and <code>/wiki update</code> responsive on large repositories.</p>
  </main>
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

async function pathExists(path: string): Promise<boolean> {
  try {
    await stat(path)
    return true
  } catch (error: unknown) {
    if (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      error.code === 'ENOENT'
    ) {
      return false
    }
    throw error
  }
}

async function readExistingGraph(path: string): Promise<WikiGraph | null> {
  try {
    return JSON.parse(await readFile(path, 'utf8')) as WikiGraph
  } catch {
    return null
  }
}

async function readExistingManifest(path: string): Promise<WikiGraphManifest | null> {
  try {
    return JSON.parse(await readFile(path, 'utf8')) as WikiGraphManifest
  } catch {
    return null
  }
}

async function wikiScaffoldExists(paths: ReturnType<typeof getWikiPaths>): Promise<boolean> {
  const [hasRoot, hasSchema, hasIndex, hasLog] = await Promise.all([
    pathExists(paths.root),
    pathExists(paths.schemaFile),
    pathExists(paths.indexFile),
    pathExists(paths.logFile),
  ])
  return hasRoot && hasSchema && hasIndex && hasLog
}

function manifestFromGraph(
  graph: WikiGraph,
  extracted: ExtractedFile[],
  scanRoot: string,
  cwd: string,
): Required<WikiGraphManifest> {
  return {
    generated_at: graph.graph.generated_at,
    scan_root: toPosix(relative(cwd, scanRoot)) || '.',
    files: extracted.map(file => ({
      path: file.relPath,
      hash: file.hash,
      size: file.size,
      mtime_ms: file.mtimeMs,
      type: file.fileType,
    })),
  }
}

async function collectManifestEntries(
  cwd: string,
  files: string[],
  previous?: WikiGraphManifest | null,
): Promise<Required<WikiGraphManifest>['files']> {
  const previousByPath = new Map((previous?.files ?? []).map(file => [file.path, file]))
  return mapWithWorkers(
    files,
    GRAPH_WORKER_COUNT,
    async file => {
      const relPath = toPosix(relative(cwd, file))
      const info = await stat(file)
      const old = previousByPath.get(relPath)
      if (old && old.size === info.size && old.mtime_ms === info.mtimeMs) {
        return old
      }
      const ext = extname(file).toLowerCase()
      let hash = `${info.size}:${info.mtimeMs}`
      if (GRAPHIFY_DISPATCH_EXTENSIONS.has(ext) && info.size <= MAX_TEXT_FILE_BYTES) {
        hash = hashText(await readFile(file, 'utf8'))
      }
      return {
        path: relPath,
        hash,
        size: info.size,
        mtime_ms: info.mtimeMs,
        type: classifyFile(file),
      }
    },
  )
}

function targetContainsPath(targetRel: string, relPath: string): boolean {
  if (!targetRel || targetRel === '.') return true
  return relPath === targetRel || relPath.startsWith(`${targetRel}/`)
}

function manifestChangedForTarget(
  previous: WikiGraphManifest | null,
  current: WikiGraphManifest,
  targetRel: string,
): boolean {
  return manifestDiffForTarget(previous, current, targetRel).changed
}

function manifestDiffForTarget(
  previous: WikiGraphManifest | null,
  current: WikiGraphManifest,
  targetRel: string,
): Omit<WikiKnowledgeFreshness, 'checked' | 'indexedFiles'> {
  if (!previous?.files || !current.files) {
    return {
      changed: true,
      addedFiles: current.files?.length ?? 0,
      modifiedFiles: 0,
      deletedFiles: 0,
    }
  }
  const previousByPath = new Map(previous.files.map(file => [file.path, file]))
  const currentByPath = new Map(current.files.map(file => [file.path, file]))
  let addedFiles = 0
  let modifiedFiles = 0
  let deletedFiles = 0

  for (const file of current.files) {
    if (!targetContainsPath(targetRel, file.path)) continue
    const old = previousByPath.get(file.path)
    if (!old || old.hash !== file.hash || old.size !== file.size || old.type !== file.type) {
      if (old) {
        modifiedFiles += 1
      } else {
        addedFiles += 1
      }
    }
  }

  for (const file of previous.files) {
    if (targetContainsPath(targetRel, file.path) && !currentByPath.has(file.path)) {
      deletedFiles += 1
    }
  }

  return {
    changed: addedFiles + modifiedFiles + deletedFiles > 0,
    addedFiles,
    modifiedFiles,
    deletedFiles,
  }
}

function mergeManifestTargetEntries(
  previous: WikiGraphManifest,
  current: Required<WikiGraphManifest>,
): Required<WikiGraphManifest> | null {
  if (!previous.files) return null
  const currentByPath = new Map(current.files.map(file => [file.path, file]))
  let changed = false
  const files = previous.files.map(file => {
    const updated = currentByPath.get(file.path)
    if (!updated) return file
    if (
      file.hash !== updated.hash ||
      file.size !== updated.size ||
      file.type !== updated.type ||
      file.mtime_ms !== updated.mtime_ms
    ) {
      changed = true
      return updated
    }
    return file
  })

  return changed
    ? {
        generated_at: previous.generated_at ?? current.generated_at,
        scan_root: previous.scan_root ?? current.scan_root,
        files,
      }
    : null
}

function resultFromExistingGraph(
  init: WikiInitResult,
  paths: ReturnType<typeof getWikiPaths>,
  cwd: string,
  graph: WikiGraph,
  indexedFiles: number,
): WikiKnowledgeInitResult {
  return {
    ...init,
    graphRoot: paths.graphDir,
    indexedFiles,
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

async function rebuildWikiKnowledgeGraph(
  cwd: string,
  target: string,
  init: WikiInitResult,
): Promise<WikiKnowledgeInitResult> {
  const paths = getWikiPaths(cwd)
  const scanRoot = resolveInsideProject(cwd, target)
  const files = await collectProjectFiles(cwd, scanRoot)
  const extracted = (
    await mapWithWorkers(files, GRAPH_WORKER_COUNT, file => extractFile(cwd, file))
  ).filter((file): file is ExtractedFile => file !== null)

  const graph = buildGraph(cwd, extracted)
  const manifest = manifestFromGraph(graph, extracted, scanRoot, cwd)
  await mkdir(paths.graphDir, { recursive: true })
  await writeFile(paths.graphJsonFile, JSON.stringify(graph, null, 2), 'utf8')
  await writeFile(paths.graphReportFile, generateReport(graph, extracted), 'utf8')
  await writeFile(paths.graphHtmlFile, generateHtml(graph), 'utf8')
  await writeFile(
    paths.graphManifestFile,
    JSON.stringify(
      manifest,
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

export async function initializeWikiKnowledge(
  cwd: string,
  target = '.',
  options: WikiKnowledgeInitOptions = {},
): Promise<WikiKnowledgeInitResult> {
  const paths = getWikiPaths(cwd)
  if (!options.force && await wikiScaffoldExists(paths)) {
    const init: WikiInitResult = {
      root: paths.root,
      createdFiles: [],
      createdDirectories: [],
      alreadyExisted: true,
    }
    const previousGraph = await readExistingGraph(paths.graphJsonFile)
    if (previousGraph) {
      const previousManifest = await readExistingManifest(paths.graphManifestFile)
      return {
        ...resultFromExistingGraph(
          init,
          paths,
          cwd,
          previousGraph,
          previousManifest?.files?.length ?? 0,
        ),
        skipped: true,
      }
    }

    return {
      ...init,
      graphRoot: paths.graphDir,
      indexedFiles: 0,
      nodeCount: 0,
      edgeCount: 0,
      communityCount: 0,
      graphFiles: [],
      skipped: true,
    }
  }

  const init = await initializeWiki(cwd)
  return rebuildWikiKnowledgeGraph(cwd, target, init)
}

export async function updateWikiKnowledge(
  cwd: string,
  target = '.',
): Promise<WikiKnowledgeUpdateResult> {
  const paths = getWikiPaths(cwd)
  if (!(await pathExists(paths.root))) {
    throw new Error('Wiki is not initialized. Run /wiki init first.')
  }
  const previousGraph = await readExistingGraph(paths.graphJsonFile)
  if (!previousGraph) {
    throw new Error('Wiki graph is missing. Run /wiki init first.')
  }

  const init: WikiInitResult = {
    root: paths.root,
    createdFiles: [],
    createdDirectories: [],
    alreadyExisted: true,
  }
  const previousManifest = await readExistingManifest(paths.graphManifestFile)
  const scanTarget = previousManifest?.scan_root || '.'
  const targetAbs = resolveInsideProject(cwd, target)
  const targetRel = toPosix(relative(cwd, targetAbs)) || '.'
  let changed = true
  let refreshedManifest: Required<WikiGraphManifest> | null = null

  if (previousManifest?.files) {
    const targetExists = await pathExists(targetAbs)
    if (targetExists) {
      const targetFiles = await collectProjectFiles(cwd, targetAbs)
      const targetManifest: Required<WikiGraphManifest> = {
        generated_at: previousManifest.generated_at ?? '',
        scan_root: scanTarget,
        files: await collectManifestEntries(cwd, targetFiles, previousManifest),
      }
      changed = manifestChangedForTarget(previousManifest, targetManifest, targetRel)
      if (!changed) {
        refreshedManifest = mergeManifestTargetEntries(previousManifest, targetManifest)
      }
    } else {
      changed = previousManifest.files.some(file => targetContainsPath(targetRel, file.path))
    }
  }

  if (!changed) {
    if (refreshedManifest) {
      await writeFile(paths.graphManifestFile, JSON.stringify(refreshedManifest, null, 2), 'utf8')
    }
    const result = resultFromExistingGraph(
      init,
      paths,
      cwd,
      previousGraph,
      previousManifest?.files?.length ?? 0,
    )
    return {
      ...result,
      changed: false,
      updatedTarget: targetRel,
    }
  }

  const result = await rebuildWikiKnowledgeGraph(cwd, scanTarget, init)
  return {
    ...result,
    changed: true,
    updatedTarget: targetRel,
  }
}

export async function checkWikiKnowledgeFreshness(cwd: string): Promise<WikiKnowledgeFreshness> {
  const paths = getWikiPaths(cwd)
  const previousManifest = await readExistingManifest(paths.graphManifestFile)
  if (!previousManifest?.files) {
    return {
      checked: false,
      changed: false,
      indexedFiles: 0,
      addedFiles: 0,
      modifiedFiles: 0,
      deletedFiles: 0,
    }
  }

  const scanRoot = resolveInsideProject(cwd, previousManifest.scan_root || '.')
  const files = (await pathExists(scanRoot)) ? await collectProjectFiles(cwd, scanRoot) : []
  const currentManifest: Required<WikiGraphManifest> = {
    generated_at: previousManifest.generated_at ?? '',
    scan_root: previousManifest.scan_root || '.',
    files: await collectManifestEntries(cwd, files, previousManifest),
  }
  const diff = manifestDiffForTarget(previousManifest, currentManifest, '.')

  return {
    checked: true,
    indexedFiles: currentManifest.files.length,
    ...diff,
  }
}
