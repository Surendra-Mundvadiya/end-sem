import { useSyncExternalStore } from 'react'

/* Light / dark theme. "system" follows the OS; index.html applies the saved choice before first paint. */

export type ThemePref = 'system' | 'light' | 'dark'

const KEY = 'taxlaw-theme'
const mq = typeof window !== 'undefined' ? window.matchMedia('(prefers-color-scheme: dark)') : null
const listeners = new Set<() => void>()

function read(): ThemePref {
  try {
    const t = localStorage.getItem(KEY)
    return t === 'light' || t === 'dark' ? t : 'system'
  } catch {
    return 'system'
  }
}

let pref: ThemePref = read()

function resolve(p: ThemePref): 'light' | 'dark' {
  return p === 'system' ? (mq?.matches ? 'dark' : 'light') : p
}

function apply() {
  const root = document.documentElement
  if (pref === 'system') delete root.dataset.theme
  else root.dataset.theme = pref
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', resolve(pref) === 'dark' ? '#0c0d13' : '#f6f5f1')
}

function emit() {
  listeners.forEach((l) => l())
}

mq?.addEventListener('change', () => {
  apply()
  emit()
})

export function setTheme(next: ThemePref) {
  pref = next
  try {
    if (next === 'system') localStorage.removeItem(KEY)
    else localStorage.setItem(KEY, next)
  } catch {
    /* ignore */
  }
  apply()
  emit()
}

type ViewTransitionStart = (cb: () => void) => { ready: Promise<void> }

/** Flip between light and dark, revealing the new theme in a circle that grows from (x, y). */
export function toggleThemeAt(x: number, y: number) {
  const next = resolve(pref) === 'dark' ? 'light' : 'dark'
  const start = (document as unknown as { startViewTransition?: ViewTransitionStart }).startViewTransition
  if (!start || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    setTheme(next)
    return
  }
  const r = Math.hypot(Math.max(x, window.innerWidth - x), Math.max(y, window.innerHeight - y))
  const t = start.call(document, () => setTheme(next))
  t.ready
    .then(() => {
      document.documentElement.animate(
        { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${r}px at ${x}px ${y}px)`] },
        { duration: 560, easing: 'cubic-bezier(0.22, 1, 0.36, 1)', pseudoElement: '::view-transition-new(root)' },
      )
    })
    .catch(() => {})
}

function subscribe(fn: () => void) {
  listeners.add(fn)
  return () => {
    listeners.delete(fn)
  }
}

export function useTheme() {
  const value = useSyncExternalStore(subscribe, () => pref)
  return { pref: value, resolved: resolve(value) }
}
