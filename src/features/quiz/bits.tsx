import { useEffect, useEffectEvent, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { AnimatePresence, animate, motion, useMotionValue, useReducedMotion, useTransform } from 'framer-motion'
import { ArrowUpRight, BookOpen, Flame, Lightbulb } from 'lucide-react'
import ProgressRing from '../../components/ProgressRing'
import type { QuizItem } from '../../data'
import { easeOut, spring } from '../../lib/motion'
import { clock, studyLink } from './engine'

/* Small building blocks shared by the quiz screens. */

/** Small tag naming the concept a question tests. */
export function ConceptTag({ concept }: { concept: string }) {
  return (
    <span className="qz-concept">
      <Lightbulb size={13} aria-hidden="true" />
      <span className="sr-only">Concept: </span>
      {concept}
    </span>
  )
}

/** "Review this concept" link to the slide that teaches the question (or the unit's first slide). */
export function StudyLink({ item }: { item: QuizItem }) {
  const link = studyLink(item)
  if (!link) return null
  return (
    <Link className="qz-study" to={link.to}>
      <BookOpen size={15} aria-hidden="true" />
      <span className="qz-study__text">
        <span className="qz-study__label">{link.label}</span>
        {link.title && <span className="qz-study__title">{link.title}</span>}
      </span>
      <ArrowUpRight size={15} className="qz-study__arrow" aria-hidden="true" />
    </Link>
  )
}

/** Animated number that counts up from 0 (jumps straight to the value under reduced motion). */
export function CountUp({ to, duration = 1.1, delay = 0.2 }: { to: number; duration?: number; delay?: number }) {
  const reduce = useReducedMotion()
  const value = useMotionValue(reduce ? to : 0)
  const text = useTransform(value, (v) => String(Math.round(v)))
  useEffect(() => {
    if (reduce) {
      value.set(to)
      return
    }
    const controls = animate(value, to, { duration, delay, ease: easeOut })
    return () => controls.stop()
  }, [to, reduce, value, duration, delay])
  return <motion.span>{text}</motion.span>
}

export interface SegOption<T> {
  value: T
  label: ReactNode
  disabled?: boolean
  title?: string
}

/** The shared .segmented control with a pill that slides to the pressed option. */
export function Seg<T extends string | number>({
  id,
  label,
  value,
  options,
  onChange,
}: {
  id: string
  label: string
  value: T
  options: SegOption<T>[]
  onChange: (v: T) => void
}) {
  return (
    <div className="segmented qz-seg" role="group" aria-label={label}>
      {options.map((o) => {
        const on = o.value === value
        return (
          <button
            key={String(o.value)}
            type="button"
            aria-pressed={on}
            disabled={o.disabled}
            title={o.title}
            onClick={() => onChange(o.value)}
          >
            {on && <motion.span layoutId={`qz-seg-${id}`} className="qz-seg__pill" transition={spring} aria-hidden="true" />}
            <span className="qz-seg__label">{o.label}</span>
          </button>
        )
      })}
    </div>
  )
}

/** Answers-in-a-row counter. The flame lights up and flickers from 3 in a row. */
export function StreakFlame({ streak }: { streak: number }) {
  const hot = streak >= 3
  const warm = streak > 0
  return (
    <div className={`qz-streak${hot ? ' is-hot' : warm ? ' is-warm' : ''}`} title="Correct answers in a row">
      <motion.span
        className="qz-streak__flame"
        aria-hidden="true"
        animate={hot ? { scale: [1, 1.14, 0.95, 1.1, 1], rotate: [0, -6, 4, -2, 0] } : { scale: 1, rotate: 0 }}
        transition={hot ? { duration: 1.5, repeat: Infinity, ease: 'easeInOut' } : spring}
      >
        <Flame className="qz-streak__outer" strokeWidth={2} />
        <AnimatePresence>
          {hot && (
            <motion.span
              key="core"
              className="qz-streak__core"
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0, opacity: 0 }}
              transition={spring}
            >
              <Flame strokeWidth={0} />
            </motion.span>
          )}
        </AnimatePresence>
      </motion.span>
      <span className="qz-streak__num" aria-hidden="true">
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.span
            key={streak}
            initial={{ y: 14, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -14, opacity: 0 }}
            transition={spring}
          >
            {streak}
          </motion.span>
        </AnimatePresence>
      </span>
      <span className="sr-only">{`Streak: ${streak} in a row`}</span>
    </div>
  )
}

/**
 * Exam countdown. Ticks on its own so the question card doesn't re-render every 250 ms,
 * and calls onExpire once when the deadline passes.
 */
export function ExamTimer({ deadline, totalMs, onExpire }: { deadline: number; totalMs: number; onExpire: () => void }) {
  const [now, setNow] = useState(() => Date.now())
  const expire = useEffectEvent(onExpire)
  useEffect(() => {
    let id = 0
    const tick = () => {
      const t = Date.now()
      setNow(t)
      if (t >= deadline) {
        window.clearInterval(id)
        expire()
      }
    }
    // Check straight away too: a resumed exam may already be out of time.
    const first = window.setTimeout(tick, 0)
    id = window.setInterval(tick, 250)
    return () => {
      window.clearTimeout(first)
      window.clearInterval(id)
    }
  }, [deadline])
  const left = Math.max(0, deadline - now)
  const secs = Math.ceil(left / 1000)
  const tone = secs <= 15 ? ' is-critical' : secs <= 60 ? ' is-low' : ''
  const announce =
    secs <= 10 ? '10 seconds left' : secs <= 60 ? '1 minute left' : secs <= 300 && totalMs > 300_000 ? '5 minutes left' : ''
  return (
    <div className={`qz-timer${tone}`} role="timer" aria-label={`Time left: ${clock(left)}`}>
      <span className="qz-timer__ring" aria-hidden="true">
        <ProgressRing
          value={totalMs ? left / totalMs : 0}
          size={22}
          stroke={3}
          color="currentColor"
          track="color-mix(in srgb, currentColor 22%, transparent)"
        />
      </span>
      <span className="qz-timer__text" aria-hidden="true">
        {clock(left)}
      </span>
      <span className="sr-only" aria-live="polite">
        {announce}
      </span>
    </div>
  )
}
