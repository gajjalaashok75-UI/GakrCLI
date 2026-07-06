import { SITE } from '../data/site'

function resolveHref(href: string): string {
  if (!href) return href
  try {
    return new URL(href, SITE.url).href
  } catch {
    return href
  }
}

/** Inline-level conversion: text, links, code, emphasis — anything that can sit inside a line. */
function inlineText(node: ChildNode): string {
  if (node.nodeType === Node.TEXT_NODE) {
    return (node.textContent || '').replace(/\s+/g, ' ')
  }
  if (node.nodeType !== Node.ELEMENT_NODE) return ''

  const el = node as HTMLElement
  const tag = el.tagName.toLowerCase()
  const inner = () => Array.from(el.childNodes).map(inlineText).join('')

  switch (tag) {
    case 'code':
      return `\`${el.textContent ?? ''}\``
    case 'strong':
    case 'b':
      return `**${inner()}**`
    case 'em':
    case 'i':
      return `*${inner()}*`
    case 'a': {
      const href = resolveHref(el.getAttribute('href') ?? '')
      const label = inner().trim()
      return href ? `[${label}](${href})` : label
    }
    case 'br':
      return '\n'
    default:
      return inner()
  }
}

/** Joins the inline markdown of every child node of `el` — used for heading/paragraph/list-item text. */
function inlineOf(el: Element): string {
  return Array.from(el.childNodes).map(inlineText).join('').trim()
}

/** Block-level conversion: headings, paragraphs, lists, tables, code fences. */
function blockToMarkdown(el: Element): string {
  const tag = el.tagName.toLowerCase()

  switch (tag) {
    case 'h1':
      return `# ${inlineOf(el)}`
    case 'h2':
      return `## ${inlineOf(el)}`
    case 'h3':
      return `### ${inlineOf(el)}`
    case 'p':
      return inlineOf(el)
    case 'pre': {
      const code = el.querySelector('code')
      const text = (code?.textContent ?? el.textContent ?? '').replace(/\n+$/, '')
      return '```\n' + text + '\n```'
    }
    case 'ul':
    case 'ol': {
      const items = Array.from(el.children).filter(c => c.tagName === 'LI')
      return items
        .map((li, i) => {
          const prefix = tag === 'ol' ? `${i + 1}.` : '-'
          return `${prefix} ${inlineOf(li)}`
        })
        .join('\n')
    }
    case 'table': {
      const rows = Array.from(el.querySelectorAll('tr'))
      const lines: string[] = []
      rows.forEach((row, i) => {
        const cells = Array.from(row.children).map(c => inlineOf(c).replace(/\|/g, '\\|'))
        lines.push(`| ${cells.join(' | ')} |`)
        if (i === 0) lines.push(`| ${cells.map(() => '---').join(' | ')} |`)
      })
      return lines.join('\n')
    }
    case 'button': {
      // the CopyCommand widget — render its shell command as a fenced code block
      if (el.classList.contains('copy-cmd')) {
        const cmd = el.querySelector('.cmd')?.textContent ?? ''
        return '```bash\n$ ' + cmd + '\n```'
      }
      return ''
    }
    case 'nav':
    case 'select':
    case 'label':
      return ''
    default: {
      // generic wrapper (div, section, article, etc.) — recurse into children
      const parts = Array.from(el.children)
        .map(child => blockToMarkdown(child))
        .filter(Boolean)
      return parts.join('\n\n')
    }
  }
}

/**
 * Converts a rendered docs `<article>` element into a Markdown document,
 * skipping chrome that isn't page content (breadcrumbs, mobile nav, pager).
 */
export function articleToMarkdown(article: HTMLElement, pageUrl: string): string {
  const skipClasses = ['breadcrumbs', 'docs-mobile-nav', 'docs-pager']
  const blocks: string[] = []

  Array.from(article.children).forEach(child => {
    if (skipClasses.some(c => child.classList.contains(c))) return
    if (child.tagName === 'H1' || child.classList.contains('docs-title-row')) {
      const md = blockToMarkdown(child)
      if (md) {
        blocks.push(md)
        blocks.push(`*Source: ${pageUrl}*`)
      }
      return
    }
    const md = blockToMarkdown(child)
    if (md) blocks.push(md)
  })

  return blocks.join('\n\n').trim() + '\n'
}
