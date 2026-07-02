import { useEffect, useRef, useState, type RefObject } from 'react'
import { articleToMarkdown } from '../lib/domToMarkdown'
import { SITE } from '../data/site'

interface Props {
  articleRef: RefObject<HTMLElement | null>
  path: string
}

type Feedback = 'page' | 'command' | null

const CopyIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="9" y="9" width="12" height="12" rx="2" />
    <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
  </svg>
)
const CheckIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 6L9 17l-5-5" />
  </svg>
)
const MarkdownIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="5" width="20" height="14" rx="2" />
    <path d="M6 15V9l3 3 3-3v6M15 9v6l3-3 3 3" />
  </svg>
)
const TerminalIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="4" width="20" height="16" rx="2" />
    <path d="M6 9l3 3-3 3M12 15h6" />
  </svg>
)
const ChevronIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M6 9l6 6 6-6" />
  </svg>
)

export default function CopyPageMenu({ articleRef, path }: Props) {
  const [open, setOpen] = useState(false)
  const [feedback, setFeedback] = useState<Feedback>(null)
  const rootRef = useRef<HTMLDivElement>(null)
  const pageUrl = new URL(path, SITE.url).href

  useEffect(() => {
    if (!open) return
    const onClick = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onClick)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const getMarkdown = () => {
    const el = articleRef.current
    return el ? articleToMarkdown(el, pageUrl) : ''
  }

  const copyPage = async () => {
    const md = getMarkdown()
    if (!md) { setOpen(false); return }
    try {
      await navigator.clipboard.writeText(md)
      setFeedback('page')
      window.setTimeout(() => setFeedback(null), 1600)
    } catch { /* clipboard unavailable */ }
    setOpen(false)
  }

  const viewAsMarkdown = () => {
    const md = getMarkdown()
    if (!md) { setOpen(false); return }
    const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    window.open(url, '_blank', 'noopener')
    window.setTimeout(() => URL.revokeObjectURL(url), 60_000)
    setOpen(false)
  }

  const askGakrcli = async () => {
    const cmd = `gakrcli -p "read ${pageUrl} and explain it"`
    try {
      await navigator.clipboard.writeText(cmd)
      setFeedback('command')
      window.setTimeout(() => setFeedback(null), 1600)
    } catch { /* clipboard unavailable */ }
    setOpen(false)
  }

  return (
    <div className="copy-page-menu" ref={rootRef}>
      <div className="copy-page-split">
        <button type="button" className="copy-page-main" onClick={copyPage}>
          <span className="icon" aria-hidden="true">{feedback === 'page' ? <CheckIcon /> : <CopyIcon />}</span>
          {feedback === 'page' ? 'copied' : 'copy page'}
        </button>
        <button
          type="button"
          className="copy-page-toggle"
          aria-haspopup="menu"
          aria-expanded={open}
          aria-label="more copy options"
          onClick={() => setOpen(v => !v)}
        >
          <span className={`chevron${open ? ' open' : ''}`}><ChevronIcon /></span>
        </button>
      </div>

      {open && (
        <div className="copy-page-dropdown" role="menu">
          <button type="button" role="menuitem" onClick={copyPage}>
            <span className="icon" aria-hidden="true">{feedback === 'page' ? <CheckIcon /> : <CopyIcon />}</span>
            <span className="item-text">
              <strong>copy page</strong>
              <span>copy this page as markdown for llms</span>
            </span>
          </button>
          <button type="button" role="menuitem" onClick={viewAsMarkdown}>
            <span className="icon" aria-hidden="true"><MarkdownIcon /></span>
            <span className="item-text">
              <strong>view as markdown</strong>
              <span>open this page as plain text</span>
            </span>
          </button>
          <button type="button" role="menuitem" onClick={askGakrcli}>
            <span className="icon" aria-hidden="true">{feedback === 'command' ? <CheckIcon /> : <TerminalIcon />}</span>
            <span className="item-text">
              <strong>ask gakrcli</strong>
              <span>copy a ready gakrcli prompt for this page</span>
            </span>
          </button>
        </div>
      )}
    </div>
  )
}
