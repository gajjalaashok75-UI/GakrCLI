import { useRef } from 'react'
import { Link } from 'react-router-dom'
import SEO from '../components/SEO'
import CopyCommand from '../components/CopyCommand'
import Terminal, { type TerminalLine } from '../components/Terminal'
import { SITE } from '../data/site'
import { useScrollReveal } from '../lib/useScrollReveal'
import { useMagnetic } from '../lib/useMagnetic'
import { useCardGlow } from '../lib/useCardGlow'

const features = [
  {
    title: 'any model, one terminal',
    body: 'local ollama, openai-compatible apis, gemini, github models, gateways — switch providers with one command, no rewrites.',
    href: '/docs/providers/',
    link: 'provider setup',
  },
  {
    title: 'real tools, not just chat',
    body: 'bash, file edits, grep, glob, mcp servers, skills — wired into the agent loop, not bolted on.',
    href: '/docs/slash-commands/',
    link: 'command reference',
  },
  {
    title: 'scriptable from day one',
    body: 'non-interactive --print mode with json and stream-json output, tool allowlists, budgets, and session control.',
    href: '/docs/cli-reference/',
    link: 'cli reference',
  },
  {
    title: 'profiles per repo',
    body: 'save model, base url, auth, and runtime defaults so every clone boots the same way.',
    href: '/docs/configuration/',
    link: 'configuration',
  },
  {
    title: 'streaming, not batch',
    body: 'watch the agent think, call tools, and produce diffs live. every change stays reviewable.',
    href: '/docs/quickstart/',
    link: 'quickstart',
  },
  {
    title: 'sessions that persist',
    body: 'resume, branch, and rewind conversations. background tasks, worktree isolation, remote control from your phone.',
    href: '/docs/slash-commands/#session',
    link: 'session commands',
  },
]

const providerNames = [
  'OpenAI', 'Gemini', 'Ollama', 'GitHub Models', 'OpenRouter', 'DeepSeek',
  'Groq', 'Mistral', 'LM Studio', 'NEAR AI', 'Xiaomi MiMo', 'LiteLLM',
]

const terminalLines: TerminalLine[] = [
  { text: '# start gakrcli in any repo', variant: 'dim', break: true },
  { text: 'gakrcli', prompt: '$', break: true },
  { text: '# the agent reports to provider', variant: 'dim', break: true },
  { text: 'discovering available providers…', prompt: '○' },
  { text: 'found 4 providers, 0 cached', prompt: '✔', break: true },
  { text: '# pick one and start building', variant: 'dim', break: true },
  { text: 'add retry with exponential', prompt: '>' },
  { text: '  backoff to the fetch client', variant: 'green' },
]

const jsonLd = [
  {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: 'gakrcli',
    applicationCategory: 'DeveloperApplication',
    operatingSystem: 'macOS, Linux, Windows',
    description: SITE.description,
    url: SITE.url,
    author: { '@type': 'Organization', name: 'GakrCLI', url: SITE.github },
  },
]

export default function Home() {
  const pageRef = useRef<HTMLDivElement>(null)
  const cardGridRef = useRef<HTMLDivElement>(null)
  const ghostCtaRef = useRef<HTMLAnchorElement>(null)

  useScrollReveal(pageRef)
  useCardGlow(cardGridRef)
  useMagnetic(ghostCtaRef)

  return (
    <div ref={pageRef}>
      <SEO title={SITE.title} description={SITE.description} jsonLd={jsonLd} />

      <section className="hero-band grid-bg">
        <div className="mesh-blobs" aria-hidden="true">
          <span className="mesh-blob mesh-blob--a" />
          <span className="mesh-blob mesh-blob--b" />
        </div>
        <div className="container">
          <div className="hero-grid">
            <div className="hero-content fade-up">
              <span className="eyebrow">
                <span className="spark" aria-hidden="true">✦</span>
                open source
                <span className="spark" aria-hidden="true">✦</span>
              </span>
              <h1 className="text-hero">your coding agent,<br /><span className="text-gradient">any model.</span></h1>
              <p>gakrcli is an open-source coding agent that runs in your terminal and connects to <strong>any</strong> model provider — no vendor lock-in, no platform capture.</p>
              <div className="hero-actions">
                <CopyCommand command={SITE.installCommand} />
                <Link to="/docs/" className="button button-ghost magnetic" ref={ghostCtaRef}>read the docs →</Link>
              </div>
              <div className="hero-foot fade-up fade-up-3">
                <span>node · npm · macOS / linux / windows</span>
                <span className="sep" style={{ margin: '0 8px', color: 'var(--muted-soft)' }}>·</span>
                <span>apache 2.0</span>
              </div>
            </div>
            <div className="fade-up fade-up-2">
              <Terminal lines={terminalLines} />
            </div>
          </div>
        </div>
      </section>

      <section className="section section-tint">
        <div className="container">
          <h2 className="text-heading" style={{ marginBottom: 48, textAlign: 'center' }} data-reveal>pick any provider</h2>
          <ul className="provider-strip" data-reveal>
            {providerNames.map(name => (
              <li key={name}>{name}</li>
            ))}
          </ul>
          <p className="provider-foot" style={{ marginTop: 24, textAlign: 'center' }} data-reveal>
            <Link to="/docs/providers/">see all 13+ supported providers →</Link>
          </p>
        </div>
      </section>

      <section className="section">
        <div className="container">
          <div className="card-grid" ref={cardGridRef}>
            {features.map((f, i) => (
              <Link to={f.href} key={i} className="card" data-reveal>
                <h3>{f.title}</h3>
                <p>{f.body}</p>
                <div className="card-foot">
                  <span>{f.link} →</span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="section section-tint">
        <div className="container" style={{ textAlign: 'center' }}>
          <div className="callout-card" data-reveal>
            <h2>one install, every provider</h2>
            <p>no sign-up required. run it anywhere.</p>
            <CopyCommand command={SITE.installCommand} />
          </div>
        </div>
      </section>
    </div>
  )
}
