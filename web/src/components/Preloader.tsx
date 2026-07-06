import { useEffect, useRef, useState } from 'react'
import { animate, createTimeline } from 'animejs'
import { prefersReducedMotion } from '../lib/motion'

const BOOT_LINES: { text: string; cls: 'line' | 'out' }[] = [
  { text: '$ gakrcli --boot', cls: 'line' },
  { text: 'resolving providers: openai, gemini, ollama +11 more', cls: 'line' },
  { text: 'ready.', cls: 'out' },
]

export default function Preloader() {
  const [hidden, setHidden] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const barRef = useRef<HTMLDivElement>(null)
  const skippedRef = useRef(false)

  useEffect(() => {
    if (prefersReducedMotion()) {
      setHidden(true)
      return
    }

    const root = rootRef.current
    if (!root) return

    const finish = () => {
      if (skippedRef.current) return
      skippedRef.current = true
      animate(root, {
        opacity: [1, 0],
        duration: 380,
        ease: 'out(2)',
        onComplete: () => setHidden(true),
      })
    }

    // progress bar fills across the whole boot sequence
    requestAnimationFrame(() => {
      if (barRef.current) barRef.current.style.width = '100%'
    })

    const tl = createTimeline({ onComplete: finish })
    const lines = root.querySelectorAll<HTMLElement>('.line-item')
    lines.forEach((line, i) => {
      tl.add(
        line,
        { opacity: [0, 1], translateX: [-6, 0], duration: 260, ease: 'out(2)' },
        i === 0 ? 0 : '+=170',
      )
    })

    // safety net: never trap a visitor behind the preloader
    const failsafe = window.setTimeout(finish, 4000)
    const skip = () => finish()
    window.addEventListener('click', skip, { once: true })
    window.addEventListener('keydown', skip, { once: true })

    return () => {
      window.clearTimeout(failsafe)
      window.removeEventListener('click', skip)
      window.removeEventListener('keydown', skip)
    }
  }, [])

  if (hidden) return null

  return (
    <div className="preloader" ref={rootRef} role="status" aria-label="loading gakrcli">
      <div className="preloader-inner">
        <div className="preloader-mark" aria-hidden="true">
          <span />
          <span />
          <span />
        </div>
        <div className="preloader-term">
          {BOOT_LINES.map((l, i) => (
            <div key={l.text} className={`line-item ${l.cls}`} style={{ opacity: 0 }}>
              {l.text}
              {i === BOOT_LINES.length - 1 && <span className="preloader-cursor" />}
            </div>
          ))}
          <div className="preloader-progress"><div className="preloader-progress-bar" ref={barRef} /></div>
        </div>
      </div>
    </div>
  )
}
