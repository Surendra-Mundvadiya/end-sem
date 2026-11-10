import { motion } from 'framer-motion'
import { ArrowRight, BookOpen, CircleCheck, ListChecks, RotateCcw } from 'lucide-react'
import { Link } from 'react-router-dom'
import { HAS_QUIZ, getUnit, type Slide } from '../../data'
import { softSpring } from '../../lib/motion'

const cardMotion = {
  initial: { opacity: 0, y: 18, scale: 0.985 },
  animate: { opacity: 1, y: 0, scale: 1 },
  exit: { opacity: 0, y: -10, transition: { duration: 0.18 } },
  transition: softSpring,
}

/** Shown for a moment before the next slide starts on its own. */
export function UpNext({ next, delayMs, onNow, onStay }: { next: Slide; delayMs: number; onNow: () => void; onStay: () => void }) {
  return (
    <motion.div className="tt-card tt-card--next" {...cardMotion}>
      <p className="eyebrow">Up next</p>
      <h2 className="tt-end-title">{next.title}</h2>
      {next.part !== next.title && <p className="tt-end-sub">{next.part}</p>}
      <div className="tt-countdown" aria-hidden="true">
        <motion.span initial={{ scaleX: 0 }} animate={{ scaleX: 1 }} transition={{ duration: delayMs / 1000, ease: 'linear' }} />
      </div>
      <div className="tt-end-actions">
        <button type="button" className="btn btn-unit" onClick={onNow}>
          Play now <ArrowRight size={16} />
        </button>
        <button type="button" className="btn btn-ghost" onClick={onStay}>
          Stay on this lesson
        </button>
      </div>
    </motion.div>
  )
}

interface EndProps {
  slide: Slide
  next: Slide | null
  topicTitle: string | null
  quizResult: boolean | null
  onReplay: () => void
  onNext: () => void
}

/** End of a lesson (or of a whole topic). */
export function LessonEnd({ slide, next, topicTitle, quizResult, onReplay, onNext }: EndProps) {
  const unit = getUnit(slide.unitId)
  return (
    <motion.div className="tt-card tt-card--end" {...cardMotion}>
      <motion.span
        className="tt-end-icon"
        initial={{ scale: 0.4, rotate: -20, opacity: 0 }}
        animate={{ scale: 1, rotate: 0, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 420, damping: 18, delay: 0.1 }}
        aria-hidden="true"
      >
        <CircleCheck size={28} />
      </motion.span>
      <h2 className="tt-end-title">{topicTitle ? 'Topic complete' : 'Lesson complete'}</h2>
      <p className="tt-end-sub">{topicTitle ?? slide.title}</p>
      {quizResult !== null && (
        <p className="tt-end-quiz" data-ok={quizResult ? 'true' : 'false'}>
          {quizResult ? 'You got the quick check right.' : 'The quick check is worth another look in your notes.'}
        </p>
      )}
      <div className="tt-end-actions">
        {next && (
          <button type="button" className="btn btn-unit" onClick={onNext}>
            Next: {next.title} <ArrowRight size={16} />
          </button>
        )}
        <button type="button" className="btn" onClick={onReplay}>
          <RotateCcw size={16} /> Replay
        </button>
        <Link className="btn btn-ghost" to={`/learn/${slide.id}`}>
          <BookOpen size={16} /> Open in notes
        </Link>
        {HAS_QUIZ && (
          <Link className="btn btn-ghost" to={`/quiz?units=${slide.unitId}&count=10&start=1`}>
            <ListChecks size={16} /> Practise {unit.short}
          </Link>
        )}
      </div>
    </motion.div>
  )
}
