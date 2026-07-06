import { useLayoutEffect, type RefObject } from 'react'
import { animate, createScope, onScroll } from 'animejs'
import { prefersReducedMotion } from './motion'

/**
 * Reveals descendants of `rootRef` matching `selector` as they scroll into
 * view. Elements are staggered in small groups (via DOM order) using
 * anime.js' ScrollObserver so each one animates independently as it crosses
 * the viewport threshold, rather than all firing on page mount.
 *
 * Runs in useLayoutEffect and sets the hidden state via inline styles
 * synchronously (rather than relying only on a CSS class) so elements
 * that don't carry a [data-reveal] attribute in markup — e.g. docs
 * headings — still get a clean hidden→visible transition with no flash.
 */
export function useScrollReveal(rootRef: RefObject<HTMLElement | null>, selector = '[data-reveal]') {
  useLayoutEffect(() => {
    const root = rootRef.current
    if (!root) return

    const els = root.querySelectorAll<HTMLElement>(selector)
    if (!els.length) return

    if (prefersReducedMotion()) {
      els.forEach(el => { el.style.opacity = '1'; el.style.transform = 'none' })
      return
    }

    els.forEach(el => { el.style.opacity = '0'; el.style.transform = 'translateY(28px)' })

    const scope = createScope({ root: rootRef }).add(() => {
      els.forEach((el, i) => {
        animate(el, {
          opacity: [0, 1],
          translateY: [28, 0],
          duration: 650,
          delay: (i % 6) * 70,
          ease: 'out(3)',
          autoplay: onScroll({
            target: el,
            enter: 'bottom-=60 top',
            repeat: false,
          }),
        })
      })
    })

    return () => scope.revert()
  }, [rootRef, selector])
}
