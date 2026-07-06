import { useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { SITE } from '../data/site'

interface Crumb {
  label: string
  href: string
}

interface Props {
  crumbs: Crumb[]
}

export default function Breadcrumbs({ crumbs }: Props) {
  const jsonLdRef = useRef<HTMLScriptElement>(null)

  useEffect(() => {
    if (!jsonLdRef.current) return
    const data = {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: crumbs.map((c, i) => ({
        '@type': 'ListItem',
        position: i + 1,
        name: c.label,
        item: new URL(c.href, SITE.url).href,
      })),
    }
    jsonLdRef.current.textContent = JSON.stringify(data)
  }, [crumbs])

  return (
    <>
      <nav className="breadcrumbs" aria-label="breadcrumb">
        {crumbs.map((c, i) => (
          <span key={c.href}>
            {i > 0 && <span aria-hidden="true">/</span>}
            {i < crumbs.length - 1 ? (
              <Link to={c.href}>{c.label}</Link>
            ) : (
              <span aria-current="page">{c.label}</span>
            )}
          </span>
        ))}
      </nav>
      <script ref={jsonLdRef} type="application/ld+json" />
    </>
  )
}
