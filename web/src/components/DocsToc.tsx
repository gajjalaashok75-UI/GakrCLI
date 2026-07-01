import { useEffect, useRef } from 'react'

export interface TocEntry {
  id: string
  label: string
  depth?: 2 | 3
}

interface Props {
  toc: TocEntry[]
}

export default function DocsToc({ toc }: Props) {
  const navRef = useRef<HTMLElement>(null)

  useEffect(() => {
    if (toc.length === 0) return

    const ids = toc.map(e => e.id)
    const elms = ids.map(id => document.getElementById(id)).filter(Boolean) as HTMLElement[]
    if (elms.length === 0) return

    const nav = navRef.current
    if (!nav) return

    let current = ''

    const cb: IntersectionObserverCallback = (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          current = entry.target.id
        }
      }
      nav.querySelectorAll('a').forEach(a => {
        a.classList.toggle('active', a.getAttribute('href') === `#${current}`)
      })
    }

    const obs = new IntersectionObserver(cb, { rootMargin: '-64px 0px -66% 0px', threshold: 0 })
    elms.forEach(el => obs.observe(el))

    return () => obs.disconnect()
  }, [toc])

  if (toc.length === 0) return null

  return (
    <aside className="docs-toc">
      <nav ref={navRef} aria-label="on this page">
        <h4>on this page</h4>
        <ul>
          {toc.map(entry => (
            <li key={entry.id}>
              <a href={`#${entry.id}`} className={entry.depth === 3 ? 'depth-3' : undefined}>
                {entry.label}
              </a>
            </li>
          ))}
        </ul>
      </nav>
    </aside>
  )
}
