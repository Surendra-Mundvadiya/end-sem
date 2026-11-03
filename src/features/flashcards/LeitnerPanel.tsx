import { motion, useAnimate, useReducedMotion } from 'framer-motion'
import { Archive } from 'lucide-react'
import { useEffect, useRef } from 'react'
import { softSpring } from '../../lib/motion'
import { plural } from '../../lib/text'
import Count from './Count'
import { boxInterval, formatInterval, type DeckStats } from './deck'

/** isCardMastered() in lib/progress counts box 4 and up as mastered. */
const MASTERED_FROM = 4

export default function LeitnerPanel({ stats }: { stats: DeckStats }) {
  const max = Math.max(1, ...stats.boxes)
  return (
    <section className="card fc-leitner" aria-labelledby="fc-leitner-title">
      <div>
        <p className="eyebrow">
          <Archive size={14} aria-hidden /> Leitner boxes
        </p>
        <h2 id="fc-leitner-title" className="fc-leitner__title">
          Where this deck stands
        </h2>
      </div>

      <div className="fc-boxes-wrap">
        <ol className="fc-boxes">
          {stats.boxes.map((n, i) => (
            <LeitnerBox key={i} box={i + 1} count={n} max={max} />
          ))}
        </ol>
        <div className="fc-bracket" aria-hidden>
          <span style={{ gridColumn: `${MASTERED_FROM} / -1` }}>Mastered</span>
        </div>
      </div>

      <p className="fc-leitner__fresh">
        <Count value={stats.fresh} className="fc-leitner__n" /> not started yet ·{' '}
        <Count value={stats.total - stats.fresh} className="fc-leitner__n" /> in boxes
      </p>

      <p className="fc-leitner__explain">
        <strong>Spaced repetition:</strong> each <em>Knew it</em> moves a card up a box and pushes its next review further
        out. <em>Again</em> sends it back to box 1. Boxes {MASTERED_FROM} and up count as mastered.
      </p>
    </section>
  )
}

function LeitnerBox({ box, count, max }: { box: number; count: number; max: number }) {
  const [scope, animateCount] = useAnimate<HTMLSpanElement>()
  const reduce = useReducedMotion()
  const prev = useRef(count)

  // Pulse the number whenever a graded card lands in (or leaves) this box.
  useEffect(() => {
    if (prev.current === count) return
    const grew = count > prev.current
    prev.current = count
    if (reduce || !scope.current) return
    void animateCount(scope.current, { scale: [1, grew ? 1.25 : 0.85, 1] }, { duration: 0.45, ease: 'easeOut' })
  }, [count, reduce, animateCount, scope])

  const wait = boxInterval(box)
  return (
    <li
      className="fc-box"
      data-box={box}
      data-mastered={box >= MASTERED_FROM ? 'true' : undefined}
      aria-label={`Box ${box}, next review ${wait > 0 ? `after ${formatInterval(wait)}` : 'right away'}: ${plural(count, 'card')}`}
    >
      <span className="fc-box__tray" aria-hidden>
        <motion.span className="fc-box__fill" initial={{ scaleY: 0 }} animate={{ scaleY: count / max }} transition={softSpring} />
      </span>
      <span ref={scope} className="fc-box__count" aria-hidden>
        <Count value={count} />
      </span>
      <span className="fc-box__name" aria-hidden>
        Box {box}
      </span>
      <span className="fc-box__wait" aria-hidden>
        {formatInterval(wait, true)}
      </span>
    </li>
  )
}
