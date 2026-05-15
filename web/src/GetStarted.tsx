import type { ReactNode } from 'react'
import { getStartedSections } from './content-getstarted'

function renderInlineCode(text: string): ReactNode[] {
  return text.split(/(`[^`]+`)/g).map((part, index) => {
    if (part.startsWith('`') && part.endsWith('`')) {
      return <code key={`${part}-${index}`}>{part.slice(1, -1)}</code>
    }
    return part
  })
}

function TextBlock({ text }: { text: string }) {
  return (
    <>
      {text.split('\n').map(line => (
        <p key={line}>{renderInlineCode(line)}</p>
      ))}
    </>
  )
}

function GetStarted() {
  return (
    <div className="page get-started">
      <header className="page-header">
        <p className="eyebrow">// get started</p>
        <h1>Install GakrCLI and start a coding-agent session.</h1>
      </header>

      {getStartedSections.map(section => (
        <section key={section.id} className="page-section" aria-labelledby={`${section.id}-heading`}>
          <h2 id={`${section.id}-heading`}>{section.title}</h2>
          <div className="content-grid">
            {section.subsections.map(subsection => (
              <article key={subsection.id} className="content-card">
                <h3>{subsection.title}</h3>
                <TextBlock text={subsection.content} />
              </article>
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}

export default GetStarted
