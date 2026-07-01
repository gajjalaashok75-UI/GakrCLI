import { useEffect, useRef, useState } from 'react'
import { animate, createScope, stagger, onScroll } from 'animejs'
import { prefersReducedMotion } from '../lib/motion'

export interface TerminalLine {
  text: string
  variant?: 'dim' | 'green' | 'yellow'
  prompt?: string
  break?: boolean
}

interface Props {
  title?: string
  lines: TerminalLine[]
}

export default function Terminal({ title = '~/your-repo', lines }: Props) {
  const bodyRef = useRef<HTMLDivElement>(null)
  const [cursorOn, setCursorOn] = useState(prefersReducedMotion())

  useEffect(() => {
    const body = bodyRef.current
    if (!body) return

    if (prefersReducedMotion()) {
      body.querySelectorAll<HTMLElement>('.terminal-line').forEach(el => { el.style.opacity = '1' })
      setCursorOn(true)
      return
    }

    const scope = createScope({ root: bodyRef }).add(() => {
      const items = body.querySelectorAll<HTMLElement>('.terminal-line')
      animate(items, {
        opacity: [0, 1],
        translateX: [-8, 0],
        duration: 380,
        delay: stagger(200),
        ease: 'out(2)',
        autoplay: onScroll({ target: body, enter: 'bottom-=40 top', repeat: false }),
        onComplete: () => setCursorOn(true),
      })
    })
    return () => scope.revert()
  }, [])

  return (
    <div className="terminal" role="img" aria-label="terminal session showing gakrcli editing code">
      <div className="terminal-bar">
        <span className="dots" aria-hidden="true"><i></i><i></i><i></i></span>
        <span>{title}</span>
      </div>
      <div className="terminal-body" ref={bodyRef}>
        {lines.map((l, i) => (
          <div className="terminal-line" key={i} style={{ marginBottom: l.break ? 12 : 0 }}>
            {l.prompt && <span className="green">{l.prompt} </span>}
            <span className={l.variant}>{l.text}</span>
          </div>
        ))}
        {cursorOn && <span className="terminal-cursor" aria-hidden="true" />}
      </div>
    </div>
  )
}
