import type { ReactNode } from 'react'
import { providers } from './content-providers'

function renderInlineCode(text: string): ReactNode[] {
  return text.split(/(`[^`]+`)/g).map((part, index) => {
    if (part.startsWith('`') && part.endsWith('`')) {
      return <code key={`${part}-${index}`}>{part.slice(1, -1)}</code>
    }
    return part
  })
}

function Providers() {
  return (
    <div className="page providers">
      <header className="page-header">
        <p className="eyebrow">// providers</p>
        <h1>Connect GakrCLI to hosted APIs, local models, or gateways.</h1>
      </header>

      <div className="provider-list">
        {providers.map(provider => (
          <section key={provider.id} className="provider-section" aria-labelledby={`${provider.id}-heading`}>
            <div>
              <h2 id={`${provider.id}-heading`}>{provider.name}</h2>
              <p>{renderInlineCode(provider.description)}</p>
            </div>
            <pre className="code-block"><code>{provider.configExample}</code></pre>
          </section>
        ))}
      </div>
    </div>
  )
}

export default Providers
