import { useRef, type ReactNode } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import SEO from './SEO'
import Breadcrumbs from './Breadcrumbs'
import DocsSidebar from './DocsSidebar'
import DocsToc, { type TocEntry } from './DocsToc'
import CopyPageMenu from './CopyPageMenu'
import { docsNav, docsPages, pagerFor } from '../data/docsNav'
import { SITE } from '../data/site'
import { useScrollReveal } from '../lib/useScrollReveal'

interface Props {
  title: string
  description: string
  heading: string
  lede?: string
  toc?: TocEntry[]
  ogImage?: string
  children: ReactNode
}

export default function DocsLayout({ title, description, heading, lede, toc = [], ogImage = SITE.ogDocs, children }: Props) {
  const path = useLocation().pathname
  const navigate = useNavigate()
  const { prev, next } = pagerFor(path)
  const navTitle = docsPages.find(p => p.href === path)?.title ?? heading
  const articleRef = useRef<HTMLElement>(null)
  useScrollReveal(articleRef, 'h2, h3, .table-wrap, .cmd-entry, pre')

  const crumbs = [
    { label: 'home', href: '/' },
    { label: 'docs', href: '/docs/' },
    ...(path === '/docs/' ? [] : [{ label: navTitle.toLowerCase(), href: path }]),
  ]

  const jsonLd = [
    {
      '@context': 'https://schema.org',
      '@type': 'TechArticle',
      headline: heading,
      description,
      url: new URL(path, SITE.url).href,
      isPartOf: { '@type': 'WebSite', name: SITE.name, url: SITE.url },
      about: { '@type': 'SoftwareApplication', name: 'gakrcli', url: SITE.url },
      author: { '@type': 'Organization', name: 'GakrCLI', url: SITE.github },
    },
  ]

  return (
    <>
      <SEO title={title} description={description} ogImage={ogImage} type="article" jsonLd={jsonLd} />
      <div className="docs-page">
        <div className="container">
          <div className="docs-shell">
            <DocsSidebar />
            <article className="docs-article" ref={articleRef}>
              <Breadcrumbs crumbs={crumbs} />
              <div className="docs-mobile-nav">
                <label className="sr-only" htmlFor="docs-jump">jump to page</label>
                <select id="docs-jump" value={path} onChange={e => navigate(e.target.value)} aria-label="jump to docs page">
                  {docsNav.map(group => (
                    <optgroup label={group.group} key={group.group}>
                      {group.items.map(item => (
                        <option value={item.href} key={item.href}>{item.title}</option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </div>
              <div className="docs-title-row">
                <h1>{heading}</h1>
                <CopyPageMenu articleRef={articleRef} path={path} />
              </div>
              {lede && <p className="lede">{lede}</p>}
              {children}
              <nav className="docs-pager" aria-label="docs pagination">
                <span>
                  {prev && (
                    <Link to={prev.href}>
                      <span className="dir">previous</span>
                      <span className="title">{prev.title}</span>
                    </Link>
                  )}
                </span>
                <span>
                  {next && (
                    <Link to={next.href} className="next">
                      <span className="dir">next</span>
                      <span className="title">{next.title}</span>
                    </Link>
                  )}
                </span>
              </nav>
            </article>
            <DocsToc toc={toc} />
          </div>
        </div>
      </div>
    </>
  )
}
