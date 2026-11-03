import { useCallback, useEffect, useState, useSyncExternalStore } from 'react'

/* Small hooks and helpers used only by the notes reader. */

/** useState persisted to localStorage (JSON). Falls back silently when storage is blocked or the value is invalid. */
export function useStoredState<T>(key: string, fallback: T, valid: (v: unknown) => v is T): [T, (next: T | ((prev: T) => T)) => void] {
  const [value, setValue] = useState<T>(() => {
    try {
      const raw = localStorage.getItem(key)
      if (raw != null) {
        const parsed: unknown = JSON.parse(raw)
        if (valid(parsed)) return parsed
      }
    } catch {
      /* blocked or malformed: use the fallback */
    }
    return fallback
  })

  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(value))
    } catch {
      /* storage full or blocked: keep the in-memory value */
    }
  }, [key, value])

  const set = useCallback((next: T | ((prev: T) => T)) => {
    setValue((prev) => (typeof next === 'function' ? (next as (p: T) => T)(prev) : next))
  }, [])

  return [value, set]
}

export const isBool = (v: unknown): v is boolean => typeof v === 'boolean'

/** Live result of a CSS media query. */
export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (cb: () => void) => {
      const mql = window.matchMedia(query)
      mql.addEventListener('change', cb)
      return () => mql.removeEventListener('change', cb)
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

/** True when a global single-key shortcut should be ignored for this event. */
export function shouldIgnoreShortcut(e: KeyboardEvent): boolean {
  if (e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey) return true
  if (document.body.dataset.modal === 'open') return true
  const t = e.target
  if (t instanceof HTMLElement) {
    if (t.isContentEditable) return true
    if (t.closest('input, textarea, select, [contenteditable]:not([contenteditable="false"])')) return true
  }
  return false
}

/** Reads a design token's current value (follows the active light/dark theme). */
export function tokenValue(name: string): string {
  try {
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim()
  } catch {
    return ''
  }
}
