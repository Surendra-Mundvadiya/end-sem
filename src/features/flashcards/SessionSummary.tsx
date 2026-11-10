import { motion } from 'framer-motion'
import { Check, Clock, RotateCcw, Shuffle, Sparkles, Sprout, Target, Trophy } from 'lucide-react'
import { useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import ProgressRing from '../../components/ProgressRing'
import { HAS_QUIZ, unitVars, type Card } from '../../data'
import { bouncy, fadeUp, stagger } from '../../lib/motion'
import { plural } from '../../lib/text'
import Count from './Count'
import { htmlToText, type Mode } from './deck'
import { KIND_ICON } from './StackCard'

interface Props {
  total: number
  knew: number
  again: number
  missed: Card[]
  mode: Mode
  /** Live count of due cards in the current filter (for the "what next" note). */
  dueNow: number
  quizHref: string
  onStudyAgain: () => void
  onReviewMissed: () => void
}

export default function SessionSummary({ total, knew, again, missed, mode, dueNow, quizHref, onStudyAgain, onReviewMissed }: Props) {
  const headingRef = useRef<HTMLHeadingElement>(null)

  // Move focus to the result so keyboard and screen-reader users land on it.
  useEffect(() => {
    headingRef.current?.focus({ preventScroll: true })
  }, [])

  const ratio = total ? knew / total : 0
  const pct = Math.round(ratio * 100)
  const Icon = ratio >= 0.8 ? Trophy : ratio >= 0.5 ? Sparkles : Sprout
  const headline = ratio === 1 ? 'Perfect recall' : ratio >= 0.8 ? 'Excellent session' : ratio >= 0.5 ? 'Solid progress' : 'Good start'
  const sub =
    again === 0
      ? `You knew all ${plural(total, 'card')} in this session.`
      : `You knew ${knew} of ${total}. The ${again === 1 ? 'one' : again} you missed went back to box 1, so ${again === 1 ? 'it comes' : 'they come'} round again first.`

  return (
    <motion.section
      className="card fc-summary"
      aria-labelledby="fc-summary-title"
      initial={{ opacity: 0, y: 28, scale: 0.94 }}
      animate={{ opacity: 1, y: 0, scale: 1, transition: { ...bouncy, delay: 0.16 } }}
      exit={{ opacity: 0, scale: 0.96, transition: { duration: 0.18 } }}
    >
      <div className="fc-summary__glow" aria-hidden />
      <div className="fc-summary__hero">
        <ProgressRing value={ratio} size={128} stroke={10} color="var(--ok)" label={`${pct}% recalled`}>
          <span className="fc-ring">
            <span className="fc-ring__pct">
              <Count from={0} value={pct} />%
            </span>
            <span className="fc-ring__cap">recalled</span>
          </span>
        </ProgressRing>
        <div className="fc-summary__text">
          <p className="eyebrow">
            <Icon size={14} aria-hidden /> Session complete
          </p>
          <h2 id="fc-summary-title" ref={headingRef} tabIndex={-1} className="fc-summary__title">
            {headline}
          </h2>
          <p className="fc-summary__sub">{sub}</p>
        </div>
      </div>

      <motion.div className="fc-tiles" variants={stagger(0.08, 0.28)} initial="hidden" animate="show">
        <motion.div className="fc-tile fc-tile--ok" variants={fadeUp}>
          <span className="fc-tile__icon">
            <Check size={20} strokeWidth={2.6} aria-hidden />
          </span>
          <span>
            <Count from={0} value={knew} className="fc-tile__n" />
            <span className="fc-tile__label">Knew it</span>
          </span>
        </motion.div>
        <motion.div className="fc-tile fc-tile--bad" variants={fadeUp}>
          <span className="fc-tile__icon">
            <RotateCcw size={20} strokeWidth={2.6} aria-hidden />
          </span>
          <span>
            <Count from={0} value={again} className="fc-tile__n" />
            <span className="fc-tile__label">Again</span>
          </span>
        </motion.div>
      </motion.div>

      {missed.length > 0 && (
        <div className="fc-missed">
          <h3 className="fc-missed__title">Worth another look</h3>
          <ul className="fc-missed__list">
            {missed.slice(0, 5).map((c) => {
              const KindIcon = KIND_ICON[c.kind]
              return (
                <li key={c.id} style={unitVars(c.unitId)}>
                  <KindIcon size={16} aria-hidden />
                  <span>{htmlToText(c.front)}</span>
                </li>
              )
            })}
          </ul>
          {missed.length > 5 && <p className="fc-missed__more">and {plural(missed.length - 5, 'more card')}</p>}
        </div>
      )}

      <div className="fc-summary__actions">
        {missed.length > 0 && (
          <button type="button" className="btn btn-primary btn-lg" onClick={onReviewMissed}>
            <RotateCcw size={18} aria-hidden />
            Review the {missed.length === 1 ? 'one' : missed.length} I missed
          </button>
        )}
        <button type="button" className={`btn btn-lg${missed.length ? '' : ' btn-primary'}`} onClick={onStudyAgain}>
          <Shuffle size={18} aria-hidden />
          Study again
        </button>
        {HAS_QUIZ && <Link className="btn btn-ghost btn-lg" to={quizHref}>
          <Target size={18} aria-hidden />
          Quiz me
        </Link>}
      </div>

      {mode === 'due' && (
        <p className="fc-summary__note">
          <Clock size={15} aria-hidden />
          {dueNow > 0
            ? `${plural(dueNow, 'card')} in this deck ${dueNow === 1 ? 'is' : 'are'} due now.`
            : 'Nothing else in this deck is due right now.'}
        </p>
      )}
    </motion.section>
  )
}
