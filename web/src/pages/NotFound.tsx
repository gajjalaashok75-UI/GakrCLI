import { Link } from 'react-router-dom'
import SEO from '../components/SEO'

export default function NotFound() {
  return (
    <>
      <SEO title="404 — page not found" description="The page you're looking for doesn't exist." />
      <section className="nf grid-bg">
        <div className="mesh-blobs" aria-hidden="true">
          <span className="mesh-blob mesh-blob--c" />
        </div>
        <div className="container">
          <div className="nf-inner fade-up">
            <span className="eyebrow">404</span>
            <h1 className="text-hero">page not found</h1>
            <p style={{ color: 'var(--muted)', margin: 0 }}>the page you're looking for doesn't exist or has moved.</p>
            <div className="nf-links">
              <Link to="/" className="button button-solid">go home</Link>
              <Link to="/docs/" className="button button-ghost">read the docs</Link>
            </div>
          </div>
        </div>
      </section>
    </>
  )
}
