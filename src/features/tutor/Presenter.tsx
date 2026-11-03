import type { CSSProperties } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { softSpring } from '../../lib/motion'

export type PresenterMood = 'idle' | 'speaking' | 'paused' | 'listening'

/* Waveform bars: each loops through its own heights at its own pace, so the motion never looks mechanical. */
const BARS = [
  { frames: [0.3, 0.9, 0.45, 0.75], dur: 0.9, delay: 0 },
  { frames: [0.5, 0.35, 1, 0.55], dur: 0.75, delay: 0.12 },
  { frames: [0.85, 0.4, 0.7, 1], dur: 1.05, delay: 0.05 },
  { frames: [0.4, 1, 0.6, 0.8], dur: 0.8, delay: 0.2 },
  { frames: [1, 0.55, 0.9, 0.45], dur: 0.95, delay: 0.08 },
  { frames: [0.6, 0.85, 0.4, 1], dur: 0.7, delay: 0.16 },
  { frames: [0.35, 0.7, 1, 0.5], dur: 1, delay: 0.03 },
  { frames: [0.75, 0.4, 0.65, 0.9], dur: 0.85, delay: 0.22 },
  { frames: [0.45, 0.8, 0.35, 0.6], dur: 0.9, delay: 0.1 },
]

interface Props {
  mood: PresenterMood
  /** CSS colour for the presenter, e.g. "var(--u3)". */
  accent: string
  size?: 'md' | 'lg'
}

/** The animated "speaker": an orb with pulsing rings and a waveform that move while it talks. */
export default function Presenter({ mood, accent, size = 'md' }: Props) {
  const reduce = useReducedMotion()
  const talking = mood === 'speaking'
  const style = { '--tt-accent': accent } as CSSProperties
  return (
    <div className={`tt-presenter tt-presenter--${size}`} data-mood={mood} style={style} aria-hidden="true">
      <div className="tt-orb-zone">
        {!reduce &&
          [0, 1, 2].map((i) => (
            <motion.span
              key={i}
              className="tt-ring"
              initial={false}
              animate={talking ? { scale: [1, 1.75], opacity: [0.45, 0] } : { scale: 1, opacity: 0 }}
              transition={talking ? { duration: 2.4, repeat: Infinity, delay: i * 0.8, ease: 'easeOut' } : { duration: 0.5 }}
            />
          ))}
        {!reduce && mood === 'listening' && (
          <motion.span
            className="tt-ring tt-ring--soft"
            initial={{ opacity: 0 }}
            animate={{ opacity: [0.15, 0.45, 0.15], scale: [1.08, 1.18, 1.08] }}
            transition={{ duration: 2.6, repeat: Infinity, ease: 'easeInOut' }}
          />
        )}
        <motion.div
          className="tt-orb"
          initial={false}
          animate={reduce ? { scale: 1 } : talking ? { scale: [1, 1.06, 0.98, 1.04, 1] } : { scale: [1, 1.025, 1] }}
          transition={
            reduce ? { duration: 0 } : talking ? { duration: 1.6, repeat: Infinity, ease: 'easeInOut' } : { duration: 5, repeat: Infinity, ease: 'easeInOut' }
          }
        >
          <span className="tt-orb-shine" />
        </motion.div>
      </div>
      <div className="tt-wave">
        {BARS.map((b, i) => (
          <motion.span
            key={i}
            className="tt-bar"
            initial={false}
            animate={talking && !reduce ? { scaleY: b.frames } : { scaleY: talking ? 0.55 : mood === 'paused' ? 0.22 : 0.14 }}
            transition={
              talking && !reduce
                ? { duration: b.dur, repeat: Infinity, repeatType: 'mirror', ease: 'easeInOut', delay: b.delay }
                : softSpring
            }
          />
        ))}
      </div>
    </div>
  )
}
