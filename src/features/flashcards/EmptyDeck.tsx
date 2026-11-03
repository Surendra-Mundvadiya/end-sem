import { motion, useReducedMotion } from 'framer-motion'
import { CircleCheck, Inbox, Layers, Play, Shuffle, Sparkles } from 'lucide-react'
import { getUnit, unitVars, type UnitId } from '../../data'
import { bouncy, fadeUp, stagger } from '../../lib/motion'
import { plural } from '../../lib/text'
import { KIND_META, formatDue, type KindFilter, type UnitFilter } from './deck'

interface NoCardsProps {
  variant: 'none'
  unit: UnitFilter
  kind: KindFilter
  onAllKinds: () => void
  onAllUnits: () => void
}

interface CaughtUpProps {
  variant: 'caught-up'
  now: number
  nextDue: number | null
  /** Cards that have come due since this session was built. */
  dueNow: number
  /** Other units that still have due cards. */
  suggestions: { unitId: UnitId; due: number }[]
  onStart: () => void
  onStudyAll: () => void
  onPickUnit: (unit: UnitId) => void
}

export default function EmptyDeck(props: NoCardsProps | CaughtUpProps) {
  const reduce = useReducedMotion()

  if (props.variant === 'none') {
    const what = props.kind === 'all' ? 'cards' : `${KIND_META[props.kind].label.toLowerCase()} cards`
    const where = props.unit === 'all' ? 'this deck' : getUnit(props.unit).short
    return (
      <motion.section className="card fc-empty" variants={stagger(0.06)} initial="hidden" animate="show" aria-live="polite">
        <motion.div className="fc-empty__badge fc-empty__badge--muted" variants={fadeUp}>
          <Inbox size={38} strokeWidth={1.8} aria-hidden />
        </motion.div>
        <motion.h2 className="fc-empty__title" variants={fadeUp}>
          Nothing to study here
        </motion.h2>
        <motion.p className="fc-empty__text" variants={fadeUp}>
          There are no {what} in {where}.
        </motion.p>
        <motion.div className="fc-empty__actions" variants={fadeUp}>
          {props.kind !== 'all' && (
            <button type="button" className="btn btn-primary btn-lg" onClick={props.onAllKinds}>
              <Layers size={18} aria-hidden /> Show all card types
            </button>
          )}
          {props.unit !== 'all' && (
            <button type="button" className="btn btn-lg" onClick={props.onAllUnits}>
              Show all units
            </button>
          )}
        </motion.div>
      </motion.section>
    )
  }

  const { now, nextDue, dueNow, suggestions, onStart, onStudyAll, onPickUnit } = props
  const cameDue = dueNow > 0

  return (
    <motion.section className="card fc-empty" variants={stagger(0.07)} initial="hidden" animate="show" aria-live="polite">
      <motion.div className="fc-empty__badge" initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={bouncy}>
        <motion.span
          className="fc-empty__float"
          animate={reduce ? undefined : { y: [0, -5, 0] }}
          transition={{ duration: 3.2, repeat: Infinity, ease: 'easeInOut' }}
        >
          <CircleCheck size={42} strokeWidth={1.9} aria-hidden />
        </motion.span>
        {!reduce &&
          [0, 1, 2].map((i) => (
            <motion.span
              key={i}
              className={`fc-spark fc-spark--${i}`}
              aria-hidden
              initial={{ opacity: 0, scale: 0.4 }}
              animate={{ opacity: [0, 1, 0], scale: [0.4, 1, 0.4] }}
              transition={{ duration: 2.6, repeat: Infinity, delay: 0.4 + i * 0.85, ease: 'easeInOut' }}
            >
              <Sparkles size={i === 1 ? 18 : 14} aria-hidden />
            </motion.span>
          ))}
      </motion.div>

      <motion.h2 className="fc-empty__title" variants={fadeUp}>
        {cameDue ? 'Cards are due again' : 'All caught up'}
      </motion.h2>
      <motion.p className="fc-empty__text" variants={fadeUp}>
        {cameDue ? (
          <>
            <strong>{plural(dueNow, 'card')}</strong> came due while you were here. Start a session to review{' '}
            {dueNow === 1 ? 'it' : 'them'}.
          </>
        ) : nextDue !== null ? (
          <>
            Nothing in this deck is due right now. The next card is due <strong>{formatDue(nextDue, now)}</strong>.
          </>
        ) : (
          <>Nothing in this deck is due right now.</>
        )}
      </motion.p>

      <motion.div className="fc-empty__actions" variants={fadeUp}>
        {cameDue ? (
          <button type="button" className="btn btn-primary btn-lg" onClick={onStart}>
            <Play size={18} aria-hidden /> Start session
          </button>
        ) : (
          <button type="button" className="btn btn-primary btn-lg" onClick={onStudyAll}>
            <Shuffle size={18} aria-hidden /> Study all anyway
          </button>
        )}
      </motion.div>

      {!cameDue && suggestions.length > 0 && (
        <motion.div className="fc-suggest" variants={fadeUp}>
          <span className="fc-label">Still due elsewhere</span>
          <div className="fc-suggest__chips">
            {suggestions.map((s) => (
              <button key={s.unitId} type="button" className="chip" style={unitVars(s.unitId)} onClick={() => onPickUnit(s.unitId)}>
                <span className="fc-dot" aria-hidden />
                {getUnit(s.unitId).short}
                <span className="fc-chip-n">{s.due}</span>
              </button>
            ))}
          </div>
        </motion.div>
      )}
    </motion.section>
  )
}
