import { motion } from 'framer-motion'
import { Link } from 'react-router-dom'
import { ArrowRight, Layers, RotateCcw, Shuffle, Target, Zap } from 'lucide-react'
import { CARDS, QUIZ, UNITS, getUnit, slidesOfUnit, unitVars, type Slide } from '../../data'
import { useProgress } from '../../lib/progress'
import { fadeUp, stagger } from '../../lib/motion'
import ProgressRing from '../../components/ProgressRing'
import { nextUnit } from './outline'

/** Shown on a unit's last slide (its Practice Questions): turn reading into retrieval practice. */
export default function EndOfUnit({ slide }: { slide: Slide }) {
  const progress = useProgress()
  const unit = getUnit(slide.unitId)
  const slides = slidesOfUnit(unit.id)
  const done = slides.filter((s) => progress.understood[s.id]).length
  const all = done === slides.length
  const unread = slides.find((s) => !progress.understood[s.id] && s.id !== slide.id)
  const quizCount = QUIZ.filter((q) => q.unitId === unit.id).length
  const cardCount = CARDS.filter((c) => c.unitId === unit.id).length
  const following = nextUnit(unit)

  return (
    <motion.section
      className="lrn-end"
      style={unitVars(unit.id)}
      aria-labelledby={`lrn-end-${unit.id}`}
      variants={stagger(0.07)}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, amount: 0.25 }}
    >
      <motion.div className="lrn-end-head" variants={fadeUp}>
        <ProgressRing value={done / Math.max(1, slides.length)} size={72} stroke={6} label={`${done} of ${slides.length} sections understood`}>
          <span className="lrn-end-ring">
            {done}
            <small>/{slides.length}</small>
          </span>
        </ProgressRing>
        <div className="lrn-end-head-text">
          <span className="eyebrow">End of {unit.short}</span>
          <h2 className="lrn-end-title" id={`lrn-end-${unit.id}`}>
            {unit.name}
          </h2>
          <p className="lrn-end-sub">
            {all
              ? 'Every section is marked as understood. Now make it stick with retrieval practice.'
              : `${slides.length - done} of ${slides.length} sections are not yet marked as understood. Testing yourself now still pays off.`}
          </p>
        </div>
      </motion.div>

      <motion.div className="lrn-end-actions" variants={fadeUp}>
        <Link className="lrn-end-cta lrn-end-cta--primary" to={`/quiz?units=${unit.id}&count=10&start=1`}>
          <span className="lrn-end-cta-icon">
            <Target size={20} />
          </span>
          <span className="lrn-end-cta-text">
            <strong>Quiz yourself on {unit.short}</strong>
            <small>10 questions from a bank of {quizCount}</small>
          </span>
          <ArrowRight size={18} className="lrn-end-cta-arrow" aria-hidden="true" />
        </Link>
        <Link className="lrn-end-cta" to={`/flashcards?unit=${unit.id}`}>
          <span className="lrn-end-cta-icon">
            <Layers size={18} />
          </span>
          <span className="lrn-end-cta-text">
            <strong>Flashcards</strong>
            <small>{cardCount} cards for this unit</small>
          </span>
        </Link>
        <Link className="lrn-end-cta" to={`/revise/${unit.id}`}>
          <span className="lrn-end-cta-icon">
            <Zap size={18} />
          </span>
          <span className="lrn-end-cta-text">
            <strong>Rapid revision</strong>
            <small>A fast pass over {unit.short}</small>
          </span>
        </Link>
      </motion.div>

      {unread && (
        <motion.div variants={fadeUp}>
          <Link className="lrn-end-unread" to={`/learn/${unread.id}`}>
            <RotateCcw size={15} aria-hidden="true" />
            <span>
              First unmarked section: <strong>{unread.title}</strong>
            </span>
          </Link>
        </motion.div>
      )}

      <motion.div variants={fadeUp}>
        {following ? (
          <Link className="lrn-end-next" to={`/learn/${following.first.id}`} style={unitVars(following.unit.id)}>
            <span className="lrn-end-next-text">
              <span className="eyebrow">Up next</span>
              <span className="lrn-end-next-title">
                Start {following.unit.short}: {following.unit.name}
              </span>
            </span>
            <span className="lrn-end-next-go" aria-hidden="true">
              <ArrowRight size={18} />
            </span>
          </Link>
        ) : (
          <Link className="lrn-end-next" to={`/quiz?units=${UNITS.map((u) => u.id).join(',')}&count=20&start=1`}>
            <span className="lrn-end-next-text">
              <span className="eyebrow">You have reached the end of the notes</span>
              <span className="lrn-end-next-title">Mixed quiz: 20 questions from every unit</span>
            </span>
            <span className="lrn-end-next-go" aria-hidden="true">
              <Shuffle size={18} />
            </span>
          </Link>
        )}
      </motion.div>
    </motion.section>
  )
}
