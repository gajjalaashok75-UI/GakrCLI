import { Link } from 'react-router-dom'
import { SITE } from '../data/site'

const columns = [
  {
    title: 'get started',
    links: [
      { href: '/docs/', label: 'overview' },
      { href: '/docs/installation/', label: 'installation' },
      { href: '/docs/quickstart/', label: 'quickstart' },
      { href: '/docs/providers/', label: 'providers' },
    ],
  },
  {
    title: 'reference',
    links: [
      { href: '/docs/slash-commands/', label: 'slash commands' },
      { href: '/docs/cli-reference/', label: 'cli reference' },
      { href: '/docs/configuration/', label: 'configuration' },
      { href: '/docs/keybindings/', label: 'keybindings' },
      { href: '/docs/skills/', label: 'skills' },
    ],
  },
  {
    title: 'project',
    links: [
      { href: SITE.github, label: 'github' },
      { href: SITE.npmUrl, label: 'npm' },
      { href: `${SITE.github}/blob/main/LICENSE`, label: 'license' },
      { href: `${SITE.github}/issues`, label: 'issues' },
    ],
  },
  {
    title: 'community',
    links: [
      { href: SITE.github, label: 'github' },
      { href: `${SITE.github}/issues`, label: 'issues' },
      { href: `${SITE.github}/discussions`, label: 'discussions' },
    ],
  },
]

function isExternal(href: string) {
  return href.startsWith('http')
}

export default function Footer() {
  return (
    <footer className="site-footer">
      <div className="container">
        <div className="footer-grid">
          {columns.map(col => (
            <div className="footer-col" key={col.title}>
              <h4>{col.title}</h4>
              <ul>
                {col.links.map(l =>
                  isExternal(l.href) ? (
                    <li key={l.label}>
                      <a href={l.href} rel="noopener">{l.label}</a>
                    </li>
                  ) : (
                    <li key={l.label}>
                      <Link to={l.href}>{l.label}</Link>
                    </li>
                  )
                )}
              </ul>
            </div>
          ))}
        </div>
        <div className="footer-bottom">
          <span className="brand">
            <img src="/gakrcli.png" alt="" width="18" height="18" />
            <span>gakrcli</span>
            <span className="ver">v{SITE.version}</span>
          </span>
          <span className="sep">&middot;</span>
          <span>open source coding agent, built by <a href={SITE.github} rel="noopener">Gajjala Ashok Kumar Reddy</a></span>
          <span className="sep">&middot;</span>
          <span>runs anywhere. uses anything.</span>
        </div>
      </div>
    </footer>
  )
}
