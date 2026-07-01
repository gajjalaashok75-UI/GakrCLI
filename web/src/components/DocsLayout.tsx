import { type ReactNode } from 'react'
import { Link, useLocation } from 'react-router-dom'
import SEO from './SEO'
import Breadcrumbs from './Breadcrumbs'
import DocsSidebar from './DocsSidebar'
import DocsToc, { type TocEntry } from './DocsToc'
import { docsPages, pagerFor } from '../data/docsNav'
import { SITE } from '../data/site'

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
  const { prev, next } = pagerFor(path)
  const navTitle = docsPages.find(p => p.href === path)?.title ?? heading

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
      <div className="container">
        <div className="docs-shell">
          <DocsSidebar />
          <article className="docs-article">
            <Breadcrumbs crumbs={crumbs} />
            <h1>{heading}</h1>
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
    </>
  )
}
