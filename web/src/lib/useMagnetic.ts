import { useEffect, type RefObject } from 'react'
import { animate } from 'animejs'
import { prefersReducedMotion } from './motion'

/** Subtle magnetic pull toward the cursor on hover, spring-back on leave. */
export function useMagnetic(ref: RefObject<HTMLElement | null>, strength = 0.25) {
  useEffect(() => {
    const el = ref.current
    if (!el || prefersReducedMotion()) return
    // skip on touch-only devices — magnetic drag has no meaning without a pointer
    if (window.matchMedia('(hover: none)').matches) return

    const handleMove = (e: MouseEvent) => {
      const rect = el.getBoundingClientRect()
      const relX = e.clientX - (rect.left + rect.width / 2)
      const relY = e.clientY - (rect.top + rect.height / 2)
      animate(el, { x: relX * strength, y: relY * strength, duration: 400, ease: 'out(3)' })
    }
    const handleLeave = () => {
      animate(el, { x: 0, y: 0, duration: 600, ease: 'spring(1, 80, 10, 0)' })
    }

    el.addEventListener('mousemove', handleMove)
    el.addEventListener('mouseleave', handleLeave)
    return () => {
      el.removeEventListener('mousemove', handleMove)
      el.removeEventListener('mouseleave', handleLeave)
    }
  }, [ref, strength])
}
