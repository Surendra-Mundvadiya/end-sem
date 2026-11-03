import type { Transition, Variants } from 'framer-motion'

/* Shared motion presets so every view moves the same way. */

export const easeOut: [number, number, number, number] = [0.22, 1, 0.36, 1]

export const spring: Transition = { type: 'spring', stiffness: 380, damping: 32 }
export const softSpring: Transition = { type: 'spring', stiffness: 200, damping: 26 }
export const bouncy: Transition = { type: 'spring', stiffness: 500, damping: 22 }

/** Use on a parent with initial="hidden" animate="show"; children use fadeUp. */
export function stagger(step = 0.05, delay = 0): Variants {
  return { hidden: {}, show: { transition: { staggerChildren: step, delayChildren: delay } } }
}

export const fadeUp: Variants = {
  hidden: { opacity: 0, y: 14 },
  show: { opacity: 1, y: 0, transition: { duration: 0.45, ease: easeOut } },
}

export const fadeIn: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { duration: 0.3, ease: easeOut } },
}

export const pop: Variants = {
  hidden: { opacity: 0, scale: 0.92 },
  show: { opacity: 1, scale: 1, transition: bouncy },
}
