const NAVIGATION_PATTERNS: RegExp[] = [
  /home\s*\|.*/i,
  /about\s*us.*/i,
  /contact\s*us.*/i,
  /sitemap.*/i,
  /privacy\s*policy.*/i,
  /terms\s*of\s*use.*/i,
  /cookie\s*policy.*/i,
  /follow\s*us\s*on.*/i,
  /share\s*this\s*page.*/i,
  /advertisement.*/i,
  /promoted\s*by.*/i,
]

function removeControlChars(text: string): string {
  return text.replace(/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f-\x9f]/g, ' ')
}

function shouldDropVisualNoiseLine(line: string): boolean {
  if (!line) {
    return true
  }
  return (
    /^[=*\-_~]{3,}$/.test(line) ||
    /^\d+$/.test(line) ||
    /^Page\s+\d+/i.test(line) ||
    /^[A-Za-z]+\s*>\s*[A-Za-z]+(?:\s*>\s*[A-Za-z]+)*$/.test(line)
  )
}

function dedupeRepeatedShortLines(text: string): string {
  const lines = text.split('\n')
  if (lines.length <= 10) {
    return text
  }

  const counts = new Map<string, number>()
  for (const line of lines) {
    if (line.length < 80) {
      counts.set(line, (counts.get(line) ?? 0) + 1)
    }
  }

  const repeatedHeaders = new Set(
    Array.from(counts.entries())
      .filter(([line, count]) => count > 3 && line.split(/\s+/).filter(Boolean).length < 5)
      .map(([line]) => line),
  )

  if (repeatedHeaders.size === 0) {
    return text
  }

  const seen = new Set<string>()
  const deduped: string[] = []
  for (const line of lines) {
    if (repeatedHeaders.has(line) && seen.has(line)) {
      continue
    }
    seen.add(line)
    deduped.push(line)
  }

  return deduped.join('\n')
}

export function applyCommunityWebCleaners(text: string): string {
  if (!text) {
    return ''
  }

  let cleaned = text
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')

  cleaned = removeControlChars(cleaned)

  const lines = cleaned
    .split('\n')
    .map(line => line.trim())
    .filter(line => !shouldDropVisualNoiseLine(line))

  cleaned = lines.join('\n')

  for (const pattern of NAVIGATION_PATTERNS) {
    cleaned = cleaned.replace(pattern, '')
  }

  cleaned = dedupeRepeatedShortLines(cleaned)

  cleaned = cleaned
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim()

  return cleaned
}
