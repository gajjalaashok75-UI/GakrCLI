import { useEffect, useRef } from 'react'
import { createAnimatable } from 'animejs'
import { prefersReducedMotion } from '../lib/motion'

export default function ScrollProgress() {
  const barRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const bar = barRef.current
    if (!bar) return

    const reduced = prefersReducedMotion()
    const animatable = reduced ? null : createAnimatable(bar, { width: { unit: '%', duration: 180, ease: 'out(2)' } })

    const update = () => {
      const scrollTop = window.scrollY
      const height = document.documentElement.scrollHeight - window.innerHeight
      const pct = height > 0 ? Math.min(100, Math.max(0, (scrollTop / height) * 100)) : 0
      if (animatable) animatable.width(pct)
      else bar.style.width = `${pct}%`
    }

    update()
    window.addEventListener('scroll', update, { passive: true })
    window.addEventListener('resize', update)
    return () => {
      window.removeEventListener('scroll', update)
      window.removeEventListener('resize', update)
      animatable?.revert()
    }
  }, [])

  return (
    <div className="scroll-progress" aria-hidden="true">
      <div className="scroll-progress-bar" ref={barRef} />
    </div>
  )
}
