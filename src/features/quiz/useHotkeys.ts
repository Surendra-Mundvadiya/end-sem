import { useEffect, useEffectEvent } from 'react'

/* Page-level keyboard shortcuts that stay out of the way of typing, modals and browser shortcuts. */

function isTypingTarget(t: EventTarget | null): boolean {
  if (!(t instanceof HTMLElement)) return false
  if (t.isContentEditable) return true
  return !!t.closest('input, textarea, select, [contenteditable]:not([contenteditable="false"])')
}

export function shouldIgnoreKey(e: KeyboardEvent): boolean {
  return (
    e.defaultPrevented ||
    e.ctrlKey ||
    e.metaKey ||
    e.altKey ||
    document.body.dataset.modal === 'open' ||
    isTypingTarget(e.target)
  )
}

/**
 * True when Enter on this target should be left to the browser (it activates the focused
 * button or link). Elements marked data-qz-enter opt in to the page's own Enter handling.
 */
export function enterBelongsToTarget(e: KeyboardEvent): boolean {
  const t = e.target instanceof Element ? e.target : null
  const control = t?.closest('button, a[href], [role="button"], summary')
  return !!control && !control.hasAttribute('data-qz-enter')
}

export function useHotkeys(handler: (e: KeyboardEvent) => void, enabled = true) {
  const onKey = useEffectEvent(handler)
  useEffect(() => {
    if (!enabled) return
    const listener = (e: KeyboardEvent) => {
      if (!shouldIgnoreKey(e)) onKey(e)
    }
    window.addEventListener('keydown', listener)
    return () => window.removeEventListener('keydown', listener)
  }, [enabled])
}
