import { useEffect, useRef, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { animate } from 'animejs'
import { SITE } from '../data/site'
import LiveClock from './LiveClock'
import { prefersReducedMotion } from '../lib/motion'

const links = [
  { href: '/docs/', label: 'docs' },
  { href: '/docs/slash-commands/', label: 'commands' },
  { href: '/docs/providers/', label: 'providers' },
  { href: SITE.github, label: 'github' },
]

const KEY = 'gakrcli-theme'
type Theme = 'dark' | 'light'

function readInitialTheme(): Theme {
  if (typeof document === 'undefined') return 'light'
  return document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light'
}

const SunIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
  </svg>
)
const MoonIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 12.8A9 9 0 1111.2 3a7 7 0 009.8 9.8z" />
  </svg>
)

export default function Nav() {
  const path = useLocation().pathname
  const [theme, setTheme] = useState<Theme>(readInitialTheme)
  const [menuOpen, setMenuOpen] = useState(false)
  const navLinksRef = useRef<HTMLDivElement>(null)
  const indicatorRef = useRef<HTMLSpanElement>(null)
  const iconRef = useRef<HTMLSpanElement>(null)

  const applyTheme = (next: Theme) => {
    document.documentElement.dataset.theme = next
    document.documentElement.style.colorScheme = next
    try { localStorage.setItem(KEY, next) } catch { /* storage unavailable */ }
    setTheme(next)

    if (iconRef.current && !prefersReducedMotion()) {
      animate(iconRef.current, {
        rotate: next === 'dark' ? [0, -160] : [0, 160],
        scale: [1, 0.4, 1],
        duration: 420,
        ease: 'out(3)',
      })
    }
  }

  // close mobile menu on route change
  useEffect(() => { setMenuOpen(false) }, [path])

  // close mobile menu if the viewport grows back to desktop width
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 900px)')
    const onChange = (e: MediaQueryListEvent | MediaQueryList) => { if (e.matches) setMenuOpen(false) }
    onChange(mq)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])

  // sliding active-link indicator
  const moveIndicatorTo = (el: HTMLElement | null) => {
    const container = navLinksRef.current
    const indicator = indicatorRef.current
    if (!container || !indicator) return
    if (!el) { indicator.style.opacity = '0'; return }
    const cRect = container.getBoundingClientRect()
    const eRect = el.getBoundingClientRect()
    indicator.style.opacity = '1'
    indicator.style.transform = `translateX(${eRect.left - cRect.left}px)`
    indicator.style.width = `${eRect.width}px`
  }
  const resetIndicator = () => {
    moveIndicatorTo(navLinksRef.current?.querySelector<HTMLElement>('a[aria-current="page"]') ?? null)
  }
  useEffect(() => {
    resetIndicator()
    window.addEventListener('resize', resetIndicator)
    return () => window.removeEventListener('resize', resetIndicator)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path])

  return (
    <header className={`site-nav${menuOpen ? ' menu-open' : ''}`} id="site-nav">
      <div className="container nav-container">
        <Link className="brand" to="/" aria-label="gakrcli home">
          <img src="/gakrcli.png" alt="" width="22" height="22" />
          <span>gakrcli</span>
          <span className="ver">v{SITE.version}</span>
        </Link>

        <div className="nav-center">
          <LiveClock />
        </div>

        <nav className="nav-links" aria-label="primary" ref={navLinksRef} onMouseLeave={resetIndicator}>
          <span className="nav-indicator" ref={indicatorRef} aria-hidden="true" />
          {links.map(l => (
            l.href.startsWith('http') ? (
              <a key={l.href} href={l.href} rel="noopener" onMouseEnter={e => moveIndicatorTo(e.currentTarget)}>{l.label}</a>
            ) : (
              <Link
                key={l.href}
                to={l.href}
                aria-current={path === l.href ? 'page' : undefined}
                onMouseEnter={e => moveIndicatorTo(e.currentTarget)}
              >{l.label}</Link>
            )
          ))}
          <button
            type="button"
            className="theme-toggle"
            onClick={() => applyTheme(theme === 'dark' ? 'light' : 'dark')}
            aria-label={`switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}
          >
            <span className="icon" aria-hidden="true" ref={iconRef}>{theme === 'dark' ? <SunIcon /> : <MoonIcon />}</span>
            {theme === 'dark' ? 'light' : 'dark'}
          </button>
        </nav>
        <button
          type="button"
          className="nav-burger"
          aria-expanded={menuOpen}
          aria-controls="mobile-menu"
          onClick={() => setMenuOpen(v => !v)}
        >
          {menuOpen ? '[close]' : '[menu]'}
        </button>
      </div>
      <div className="mobile-menu" id="mobile-menu">
        {links.map(l => (
          l.href.startsWith('http') ? (
            <a key={l.href} href={l.href} rel="noopener">{l.label}</a>
          ) : (
            <Link key={l.href} to={l.href}>{l.label}</Link>
          )
        ))}
        <button type="button" onClick={() => applyTheme(theme === 'dark' ? 'light' : 'dark')}>
          switch to {theme === 'dark' ? 'light' : 'dark'} theme
        </button>
        <div className="mobile-clock"><LiveClock /></div>
      </div>
    </header>
  )
}
