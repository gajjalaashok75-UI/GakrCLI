/**
 * Markdown chunking for the memdir lexical index.
 *
 * Chunks respect document structure: a chunk never spans a heading boundary,
 * and each chunk records the heading it belongs to, so a retrieval result can
 * cite a section instead of a whole file. A section longer than `maxChars`
 * falls back to paragraph (blank-line) boundaries, then to a hard character
 * split — the split only happens inside a section, never across one.
 *
 * Pure and dependency-free so it can be unit-tested without a database.
 */

export interface MemoryChunk {
  /** 0-based position within the source. */
  index: number
  /** Stable-ish key combining the section slug and the position. */
  key: string
  text: string
  /** Innermost heading the chunk sits under, null for pre-heading content. */
  heading: string | null
}

export const DEFAULT_MAX_CHUNK_CHARS = 1200

function headingSlug(heading: string | null): string {
  if (!heading) return 'preamble'
  const slug = heading
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
  return slug || 'section'
}

function splitLongText(text: string, maxChars: number): string[] {
  if (text.length <= maxChars) return [text]
  const out: string[] = []
  let current = ''
  for (const raw of text.split(/\n{2,}/)) {
    const piece = raw.trim()
    if (!piece) continue
    if (piece.length > maxChars) {
      if (current) {
        out.push(current)
        current = ''
      }
      for (let i = 0; i < piece.length; i += maxChars) {
        out.push(piece.slice(i, i + maxChars))
      }
      continue
    }
    if (current && current.length + piece.length + 2 > maxChars) {
      out.push(current)
      current = piece
    } else {
      current = current ? `${current}\n\n${piece}` : piece
    }
  }
  if (current) out.push(current)
  return out
}

/**
 * Split markdown body text (frontmatter already stripped by the caller) into
 * heading-scoped chunks.
 */
export function chunkMarkdown(
  content: string,
  maxChars: number = DEFAULT_MAX_CHUNK_CHARS,
): MemoryChunk[] {
  const lines = content.replace(/\r\n?/g, '\n').split('\n')
  const chunks: MemoryChunk[] = []
  let heading: string | null = null
  let buffer: string[] = []

  const flush = () => {
    const section = buffer.join('\n').trim()
    buffer = []
    if (!section) return
    for (const text of splitLongText(section, maxChars)) {
      chunks.push({
        index: chunks.length,
        key: `${headingSlug(heading)}#${chunks.length}`,
        text,
        heading,
      })
    }
  }

  for (const line of lines) {
    const match = /^(#{1,6})\s+(.+?)\s*#*\s*$/.exec(line)
    if (match) {
      flush()
      heading = match[2].trim() || null
    } else {
      buffer.push(line)
    }
  }
  flush()

  return chunks
}
