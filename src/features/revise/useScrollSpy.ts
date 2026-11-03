import { useCallback, useEffect, useRef, useState, type RefObject } from 'react'

/*
 * Scrollspy for the in-page section nav. Works whether the window or an ancestor scrolls,
 * and measures the sticky nav itself instead of assuming its height.
 */

export function scrollParent(el: Element | null): HTMLElement | null {
  for (let p = el?.parentElement ?? null; p && p !== document.body && p !== document.documentElement; p = p.parentElement) {
    const oy = getComputedStyle(p).overflowY
    if ((oy === 'auto' || oy === 'scroll' || oy === 'overlay') && p.scrollHeight > p.clientHeight) return p
  }
  return null
}

function atEnd(sp: HTMLElement | null): boolean {
  if (sp) return sp.scrollTop > 0 && sp.scrollTop + sp.clientHeight >= sp.scrollHeight - 2
  const doc = document.documentElement
  return window.scrollY > 0 && window.innerHeight + window.scrollY >= doc.scrollHeight - 2
}

/** Bottom edge of the sticky nav once stuck, relative to the top of the scroll area. */
function stuckBottom(nav: HTMLElement | null): number {
  if (!nav) return 0
  const top = parseFloat(getComputedStyle(nav).top)
  return (Number.isFinite(top) ? top : 0) + nav.offsetHeight
}

export function scrollToTop(from: Element | null) {
  const sp = scrollParent(from)
  if (sp) sp.scrollTo({ top: 0 })
  else window.scrollTo({ top: 0 })
}

export function useScrollSpy(ids: string[], navRef: RefObject<HTMLElement | null>) {
  const [active, setActive] = useState(ids[0] ?? '')
  const lockUntil = useRef(0)
  const key = ids.join('|')

  useEffect(() => {
    const list = key ? key.split('|') : []
    if (!list.length) return
    let raf = 0
    let sp: HTMLElement | null = scrollParent(document.getElementById(list[0]))
    const measure = () => {
      raf = 0
      if (performance.now() < lockUntil.current) return
      const line = (navRef.current?.getBoundingClientRect().bottom ?? 0) + 28
      let current = list[0]
      for (const id of list) {
        const el = document.getElementById(id)
        if (el && el.getBoundingClientRect().top <= line) current = id
      }
      if (atEnd(sp)) current = list[list.length - 1]
      setActive(current)
    }
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(measure)
    }
    const onResize = () => {
      sp = scrollParent(document.getElementById(list[0]))
      onScroll()
    }
    measure()
    document.addEventListener('scroll', onScroll, { capture: true, passive: true })
    window.addEventListener('resize', onResize, { passive: true })
    return () => {
      document.removeEventListener('scroll', onScroll, { capture: true })
      window.removeEventListener('resize', onResize)
      if (raf) cancelAnimationFrame(raf)
    }
  }, [key, navRef])

  /** Scrolls a section to just below the stuck nav and marks it active straight away. */
  const jump = useCallback(
    (id: string, smooth: boolean) => {
      const el = document.getElementById(id)
      if (!el) return
      setActive(id)
      lockUntil.current = performance.now() + (smooth ? 900 : 80)
      const offset = stuckBottom(navRef.current) + 16
      const sp = scrollParent(el)
      if (sp) {
        const top = sp.scrollTop + el.getBoundingClientRect().top - sp.getBoundingClientRect().top - offset
        sp.scrollTo({ top, behavior: smooth ? 'smooth' : 'auto' })
      } else {
        window.scrollTo({ top: window.scrollY + el.getBoundingClientRect().top - offset, behavior: smooth ? 'smooth' : 'auto' })
      }
    },
    [navRef],
  )

  return { active, jump }
}
