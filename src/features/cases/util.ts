/* Small browser helpers for the cases feature. */

/** Reads a JSON preference from localStorage, falling back when it is missing, unreadable or of another type. */
export function loadPref<T>(key: string, fallback: T, valid?: (v: unknown) => v is T): T {
  try {
    const raw = localStorage.getItem(key)
    if (raw == null) return fallback
    const v: unknown = JSON.parse(raw)
    if (valid ? valid(v) : typeof v === typeof fallback) return v as T
  } catch {
    /* blocked or corrupt storage: use the fallback */
  }
  return fallback
}

export function savePref(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    /* storage full or blocked: the preference just won't persist */
  }
}

/** True when a global shortcut should leave this keydown alone. */
export function shouldIgnoreKey(e: KeyboardEvent): boolean {
  if (e.ctrlKey || e.metaKey || e.altKey) return true
  if (document.body.dataset.modal === 'open') return true
  const t = e.target
  if (!(t instanceof HTMLElement)) return false
  return t.isContentEditable || t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT'
}

/** True when Enter on this target already activates it natively (so a global Enter shortcut must not also fire). */
export function isActivatable(t: EventTarget | null): boolean {
  return t instanceof HTMLElement && t.closest('button, a[href], summary, [role="button"], [role="switch"]') !== null
}

export function prefersReducedMotion(): boolean {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches
  } catch {
    return false
  }
}
