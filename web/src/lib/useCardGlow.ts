import { useEffect, type RefObject } from 'react'

/** Delegated pointer tracking so .card children light up a sky-blue glow under the cursor. */
export function useCardGlow(rootRef: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const root = rootRef.current
    if (!root) return
    if (window.matchMedia('(hover: none)').matches) return

    const handleMove = (e: MouseEvent) => {
      const target = (e.target as HTMLElement)?.closest<HTMLElement>('.card')
      if (!target || !root.contains(target)) return
      const rect = target.getBoundingClientRect()
      target.style.setProperty('--mx', `${((e.clientX - rect.left) / rect.width) * 100}%`)
      target.style.setProperty('--my', `${((e.clientY - rect.top) / rect.height) * 100}%`)
    }

    root.addEventListener('mousemove', handleMove)
    return () => root.removeEventListener('mousemove', handleMove)
  }, [rootRef])
}
