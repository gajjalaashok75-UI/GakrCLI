import { useEffect, useState } from 'react'
import './styles.css'
import Commands from './Commands'
import { features, installCommand, navLinks, useCases } from './content'
import GetStarted from './GetStarted'
import Providers from './Providers'

type Theme = 'light' | 'dark'
type Page = 'home' | 'get-started' | 'providers' | 'commands'

function readInitialTheme(): Theme {
  if (typeof document === 'undefined') return 'light'
  const attr = document.documentElement.dataset.theme
  if (attr === 'light' || attr === 'dark') return attr
  return 'light'
}

function readPage(): Page {
  if (typeof window === 'undefined') return 'home'
  const path = window.location.pathname.replace(/\/+$/, '') || '/'
  if (path === '/get-started') return 'get-started'
  if (path === '/providers') return 'providers'
  if (path === '/commands') return 'commands'
  return 'home'
}

function App() {
  const [theme, setTheme] = useState<Theme>(readInitialTheme)
  const [page, setPage] = useState<Page>(readPage)

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    document.documentElement.style.colorScheme = theme
    try {
      localStorage.setItem('gakrcli-theme', theme)
    } catch {
      /* storage unavailable */
    }
  }, [theme])

  useEffect(() => {
    const onPopState = () => setPage(readPage())
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [])

  const toggleTheme = () => setTheme(t => (t === 'dark' ? 'light' : 'dark'))
  const navigate = (href: string) => {
    if (href.startsWith('#')) {
      if (page !== 'home') {
        window.history.pushState(null, '', `/${href}`)
        setPage('home')
        window.setTimeout(() => document.querySelector(href)?.scrollIntoView(), 0)
        return
      }
      document.querySelector(href)?.scrollIntoView()
      return
    }

    if (href.startsWith('/')) {
      window.history.pushState(null, '', href)
      setPage(readPage())
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }

  return (
    <div className="site-shell">
      <header className="site-header">
        <nav className="nav" aria-label="primary">
          <a
            className="brand"
            href="/"
            aria-label="gakrcli home"
            onClick={event => {
              event.preventDefault()
              navigate('/')
            }}
          >
            <img src="/gakrcli.png" alt="" />
            <span>gakrcli</span>
            <span className="ver">v0.5.1</span>
          </a>

          <div className="nav-right">
            <div className="nav-links">
              {navLinks.map(link => (
                <a
                  key={link.href}
                  href={link.href}
                  onClick={event => {
                    if (link.href.startsWith('/') || link.href.startsWith('#')) {
                      event.preventDefault()
                      navigate(link.href)
                    }
                  }}
                >
                  {link.label}
                </a>
              ))}
            </div>
            <button
              type="button"
              className="theme-toggle"
              onClick={toggleTheme}
              aria-label={`switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
              title={`switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
            >
              {theme === 'dark' ? 'light' : 'dark'}
            </button>
          </div>
        </nav>
        <div className="nav-rule" aria-hidden="true" />
      </header>

      <main className="shell-main">
        {page === 'home' && <HomePage />}
        {page === 'get-started' && <GetStarted />}
        {page === 'providers' && <Providers />}
        {page === 'commands' && <Commands />}
      </main>

      <footer className="footer">
        <div className="footer-line">
          <span className="brand">
            <img src="/gakrcli.png" alt="" />
            <span>gakrcli</span>
            <span className="ver">v0.5.1</span>
          </span>
          <span className="sep">|</span>
          <a href="https://github.com/gajjalaashok75-UI/GakrCLI/blob/main/LICENSE">license</a>
          <span className="sep">.</span>
          <span>{new Date().getFullYear()}</span>
        </div>
      </footer>
    </div>
  )
}

function HomePage() {
  return (
    <>
      <Hero />

      <section id="features" className="features" aria-labelledby="features-heading">
        <div className="section-head">
          <p className="eyebrow">// features</p>
          <h2 id="features-heading">built for agents that ship code.</h2>
        </div>
        <ul className="feature-list">
          {features.map(feature => (
            <li key={feature.title} className="feature-row">
              <h3>{feature.title}</h3>
              <p>- {feature.body}</p>
            </li>
          ))}
        </ul>
      </section>

      <section id="purpose" className="features" aria-labelledby="purpose-heading">
        <div className="section-head">
          <p className="eyebrow">// purpose</p>
          <h2 id="purpose-heading">from prompt to verified change.</h2>
        </div>
        <ul className="feature-list">
          {useCases.map(useCase => (
            <li key={useCase.title} className="feature-row">
              <h3>{useCase.title}</h3>
              <p>- {useCase.body}</p>
            </li>
          ))}
        </ul>
      </section>

      <section id="install" className="install-block" aria-labelledby="install-heading">
        <div className="section-head">
          <p className="eyebrow">// install</p>
          <h2 id="install-heading">one line. then write a task.</h2>
        </div>
        <div className="install-grid">
          <CopyableCommand command={installCommand} />
          <ol className="install-steps">
            <li>
              <span className="step-num">01</span>
              <div>
                <strong>install</strong>
                <p>requires node 20 or newer.</p>
              </div>
            </li>
            <li>
              <span className="step-num">02</span>
              <div>
                <strong>start in a repo</strong>
                <p>run <code>gakrcli</code> inside the project you want to work on.</p>
              </div>
            </li>
            <li>
              <span className="step-num">03</span>
              <div>
                <strong>choose model access</strong>
                <p>type <code>/provider</code> to wire openai-compatible apis, ollama, gemini, or a gateway.</p>
              </div>
            </li>
            <li>
              <span className="step-num">04</span>
              <div>
                <strong>ask for the work</strong>
                <p>describe what you want changed, reviewed, tested, explained, or shipped.</p>
              </div>
            </li>
          </ol>
        </div>
      </section>
    </>
  )
}

function Hero() {
  return (
    <section className="hero" aria-labelledby="hero-heading">
      <div className="hero-eyebrow">
        <span className="dot" aria-hidden="true" />
        open source - terminal-first - model-neutral
      </div>

      <h1 id="hero-heading" className="hero-title">
        ship with agents.<br />
        keep control.
      </h1>

      <p className="hero-sub">
        gakrcli is an open-source coding agent for your terminal. use it to understand projects,
        edit code, run tools, validate changes, and keep development work reviewable from start
        to finish.
      </p>

      <div className="hero-cta">
        <CopyableCommand command={installCommand} variant="hero" />
        <a className="button button-ghost" href="https://github.com/gajjalaashok75-UI/GakrCLI">
          view on github -&gt;
        </a>
      </div>

      <p className="hero-foot">
        works with openai, gemini, codex, ollama, lm studio, litellm, and 200+ models.
      </p>
    </section>
  )
}

function CopyableCommand({
  command,
  variant,
}: {
  command: string
  variant?: 'hero'
}) {
  const [copied, setCopied] = useState(false)

  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(command)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1400)
    } catch {
      /* clipboard unavailable */
    }
  }

  return (
    <button
      type="button"
      onClick={onCopy}
      className={['copy-cmd', variant === 'hero' ? 'copy-cmd-hero' : ''].filter(Boolean).join(' ')}
      aria-label={`copy install command: ${command}`}
    >
      <span className="copy-prefix">$</span>
      <span className="copy-text">{command}</span>
      <span className="copy-icon" aria-hidden="true">
        {copied ? 'copied' : 'copy'}
      </span>
    </button>
  )
}

export default App
