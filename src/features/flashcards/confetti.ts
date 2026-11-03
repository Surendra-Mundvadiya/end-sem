import confetti from 'canvas-confetti'

const PALETTE = ['--u1', '--u2', '--u3', '--u4', '--u5', '--u6', '--ok']

/**
 * Two bursts from the lower corners. Strength 0–1 scales the particle count.
 * Called from the grade that finishes a session (not from an effect, so StrictMode can't double it).
 */
export function celebrate(strength: number) {
  if (typeof window === 'undefined') return
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return
  // canvas-confetti can't read CSS variables, so resolve the design tokens to concrete colours first.
  const css = getComputedStyle(document.documentElement)
  const colors = PALETTE.map((v) => css.getPropertyValue(v).trim()).filter(Boolean)
  const particleCount = Math.round(50 + Math.max(0, Math.min(1, strength)) * 110)
  const base: confetti.Options = {
    particleCount,
    spread: 72,
    startVelocity: 52,
    ticks: 240,
    gravity: 1.05,
    scalar: 0.95,
    zIndex: 1000,
    disableForReducedMotion: true,
    ...(colors.length ? { colors } : {}),
  }
  window.setTimeout(() => {
    void confetti({ ...base, angle: 62, origin: { x: 0, y: 0.82 } })
    void confetti({ ...base, angle: 118, origin: { x: 1, y: 0.82 } })
  }, 220)
}
