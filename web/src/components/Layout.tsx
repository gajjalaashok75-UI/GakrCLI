import { useEffect, useRef } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { animate } from 'animejs'
import Nav from './Nav'
import Footer from './Footer'
import ScrollProgress from './ScrollProgress'
import { prefersReducedMotion } from '../lib/motion'

export default function Layout() {
  const { pathname } = useLocation()
  const mainRef = useRef<HTMLElement>(null)
  const firstRender = useRef(true)

  useEffect(() => {
    window.scrollTo(0, 0)
    const main = mainRef.current
    if (!main) return

    // skip the transition on first mount — the preloader/hero already handle that entrance
    if (firstRender.current) {
      firstRender.current = false
      return
    }
    if (prefersReducedMotion()) return

    animate(main, { opacity: [0, 1], translateY: [10, 0], duration: 420, ease: 'out(2)' })
  }, [pathname])

  return (
    <>
      <a className="skip-link" href="#main">skip to content</a>
      <ScrollProgress />
      <Nav />
      <main id="main" ref={mainRef}>
        <Outlet />
      </main>
      <Footer />
    </>
  )
}
