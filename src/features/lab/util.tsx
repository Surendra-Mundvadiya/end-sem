import { useCallback, useLayoutEffect, useRef, useState, useSyncExternalStore, type RefObject } from 'react'
import type { Part } from '../../data'

/* Small helpers shared by the Memory Lab tools. */

/**
 * Leading section numbering, e.g. "1.1 ", "2.10 ", "5. ". Capped at two digits per level so a title that starts
 * with a year ("1957 Copyright Act") keeps it.
 */
const NUMBER_RE = /^\s*(\d{1,2}(?:\.\d{1,2})*)\.?\s+(?=\S)/

/** "2.10 Patent Stocks" → { num: "2.10", text: "Patent Stocks" } */
export function splitNumber(title: string): { num: string | null; text: string } {
  const m = NUMBER_RE.exec(title)
  if (!m) return { num: null, text: title.trim() }
  return { num: m[1], text: title.slice(m[0].length).trim() }
}

export function stripNumber(title: string): string {
  return splitNumber(title).text
}

/** Practice questions and answer plans: real parts of the notes, but not topics of the syllabus. */
const ASIDE_RE = /\b(practice questions?|answer[\s-]*plans?|model answers?|exam answers?)\b/i

export function isAsidePart(p: Part): boolean {
  return p.isPractice || ASIDE_RE.test(p.title)
}

const comparable = (s: string) => stripNumber(s).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()

/** True when two titles say the same thing once numbering, case and punctuation are ignored. */
export function sameTitle(a: string, b: string): boolean {
  return comparable(a) === comparable(b)
}

/** Bundled content may carry inline HTML (strong/em); plain strings render as text. */
const HTML_RE = /<\/?[a-z][^>]*>|&[a-z#0-9]+;/i

export function Rich({ text, as: Tag = 'span', className }: { text: string; as?: 'span' | 'p' | 'div'; className?: string }) {
  if (HTML_RE.test(text)) return <Tag className={className} dangerouslySetInnerHTML={{ __html: text }} />
  return <Tag className={className}>{text}</Tag>
}

/** Plain text of a possibly-HTML string, for aria labels and comparisons. */
export function plainText(text: string): string {
  if (!HTML_RE.test(text)) return text
  const el = document.createElement('div')
  el.innerHTML = text
  return (el.textContent ?? '').replace(/\s+/g, ' ').trim()
}

/** Width of an element, kept up to date with a ResizeObserver (0 until measured). */
export function useWidth<T extends HTMLElement>(): [RefObject<T | null>, number] {
  const ref = useRef<T>(null)
  const [width, setWidth] = useState(0)
  // Measured before paint, so a layout that depends on the width doesn't flash the wrong one first.
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    setWidth(el.getBoundingClientRect().width)
    if (typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width
      if (typeof w === 'number') setWidth(w)
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  return [ref, width]
}

export function useMedia(query: string): boolean {
  const subscribe = useCallback(
    (cb: () => void) => {
      const m = window.matchMedia(query)
      m.addEventListener('change', cb)
      return () => m.removeEventListener('change', cb)
    },
    [query],
  )
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(query).matches,
    () => false,
  )
}

export function prefersReducedMotion(): boolean {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches
  } catch {
    return false
  }
}

export function pct(n: number, d: number): number {
  return d > 0 ? Math.round((n / d) * 100) : 0
}
