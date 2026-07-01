import { useEffect } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { SITE } from '../data/site'

const links = [
  { href: '/docs/', label: 'docs' },
  { href: '/docs/slash-commands/', label: 'commands' },
  { href: '/docs/providers/', label: 'providers' },
  { href: SITE.github, label: 'github' },
]

const KEY = 'gakrcli-theme'

function currentTheme(): 'dark' | 'light' {
  return document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light'
}

function applyTheme(theme: 'dark' | 'light') {
  document.documentElement.dataset.theme = theme
  document.documentElement.style.colorScheme = theme
  try { localStorage.setItem(KEY, theme) } catch { /* noop */ }
}

export default function Nav() {
  const path = useLocation().pathname

  useEffect(() => {
    const toggles = document.querySelectorAll<HTMLElement>('[data-theme-toggle]')
    const renderToggles = () => {
      const next = currentTheme() === 'dark' ? 'light' : 'dark'
      toggles.forEach(el => {
        el.textContent = next
        el.setAttribute('aria-label', `switch to ${next} theme`)
      })
    }

    const handleClick = (e: Event) => {
      e.preventDefault()
      applyTheme(currentTheme() === 'dark' ? 'light' : 'dark')
    }

    toggles.forEach(el => el.addEventListener('click', handleClick))
    renderToggles()

    const nav = document.getElementById('site-nav')
    const burger = document.querySelector('[data-menu-toggle]')
    const closeMenu = () => {
      nav?.classList.remove('menu-open')
      burger?.setAttribute('aria-expanded', 'false')
      burger!.textContent = '[menu]'
    }
    const handleBurger = () => {
      const open = nav?.classList.toggle('menu-open') ?? false
      burger?.setAttribute('aria-expanded', String(open))
      burger!.textContent = open ? '[close]' : '[menu]'
    }
    burger?.addEventListener('click', handleBurger)

    const mq = window.matchMedia('(min-width: 900px)')
    const handleResize = (e: MediaQueryListEvent | MediaQueryList) => {
      if (e.matches) closeMenu()
    }
    handleResize(mq)
    mq.addEventListener('change', handleResize)

    const mobileLinks = document.querySelectorAll<HTMLElement>('.mobile-menu a, .mobile-menu button')
    mobileLinks.forEach(el => el.addEventListener('click', closeMenu))

    return () => {
      toggles.forEach(el => el.removeEventListener('click', handleClick))
      burger?.removeEventListener('click', handleBurger)
      mq.removeEventListener('change', handleResize)
      mobileLinks.forEach(el => el.removeEventListener('click', closeMenu))
    }
  }, [])

  return (
    <header className="site-nav" id="site-nav">
      <div className="container">
        <Link className="brand" to="/" aria-label="gakrcli home">
          <img src="/gakrcli.png" alt="" width="22" height="22" />
          <span>gakrcli</span>
          <span className="ver">v{SITE.version}</span>
        </Link>
        <nav className="nav-links" aria-label="primary">
          {links.map(l => (
            l.href.startsWith('http') ? (
              <a key={l.href} href={l.href} rel="noopener">{l.label}</a>
            ) : (
              <Link
                key={l.href}
                to={l.href}
                aria-current={path === l.href ? 'page' : undefined}
              >{l.label}</Link>
            )
          ))}
          <button type="button" className="theme-toggle" data-theme-toggle aria-live="polite">light</button>
        </nav>
        <button type="button" className="nav-burger" data-menu-toggle aria-expanded="false" aria-controls="mobile-menu">
          [menu]
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
        <button type="button" className="theme-toggle" data-theme-toggle aria-live="polite">light</button>
      </div>
    </header>
  )
}
