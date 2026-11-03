import { AnimatePresence, motion } from 'framer-motion'
import { Check, CircleHelp, X } from 'lucide-react'
import type { QuizItem } from '../../data'
import { easeOut, softSpring, stagger } from '../../lib/motion'

interface Props {
  question: QuizItem
  options: string[]
  picked: string | null
  onPick: (option: string) => void
  onSkip: () => void
  onContinue: () => void
  /** Label for the continue button ("Next lesson", "Finish"). */
  continueLabel: string
}

/** End-of-lesson question, read aloud by the tutor. Answer with a click or the keys 1–4. */
export default function QuickCheck({ question, options, picked, onPick, onSkip, onContinue, continueLabel }: Props) {
  const answered = picked !== null
  const correct = picked === question.answer
  return (
    <motion.div
      className="tt-card tt-card--quiz"
      initial={{ opacity: 0, y: 18, scale: 0.985 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -10, transition: { duration: 0.18 } }}
      transition={softSpring}
    >
      <div className="tt-card-head">
        <span className="tt-card-icon" aria-hidden="true">
          <CircleHelp size={16} />
        </span>
        <span className="tt-card-label">Quick check</span>
        {question.concept && <span className="tt-card-detail">{question.concept}</span>}
      </div>
      <p className="tt-quiz-q" id="tt-quiz-q">
        {question.question}
      </p>
      <motion.div className="tt-options" role="group" aria-labelledby="tt-quiz-q" variants={stagger(0.05, 0.1)} initial="hidden" animate="show">
        {options.map((o, i) => {
          const state = !answered ? undefined : o === question.answer ? 'right' : o === picked ? 'wrong' : 'rest'
          return (
            <motion.button
              key={o}
              type="button"
              className="tt-option"
              data-state={state}
              disabled={answered}
              onClick={() => onPick(o)}
              variants={{ hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: easeOut } } }}
            >
              <span className="tt-option-key" aria-hidden="true">
                {state === 'right' ? <Check size={14} /> : state === 'wrong' ? <X size={14} /> : String.fromCharCode(65 + i)}
              </span>
              <span className="tt-option-text">{o}</span>
              {state === 'right' && <span className="sr-only">(correct answer)</span>}
              {state === 'wrong' && <span className="sr-only">(your answer)</span>}
            </motion.button>
          )
        })}
      </motion.div>
      <AnimatePresence initial={false}>
        {answered && (
          <motion.div
            className="tt-feedback"
            data-ok={correct ? 'true' : 'false'}
            role="status"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, ease: easeOut }}
          >
            <strong>{correct ? 'Correct!' : `Not quite — the answer is: ${question.answer}.`}</strong> {question.why}
          </motion.div>
        )}
      </AnimatePresence>
      <div className="tt-quiz-actions">
        {!answered ? (
          <>
            <span className="tt-quiz-hint">
              Press <kbd className="kbd">1</kbd>–<kbd className="kbd">{options.length}</kbd> to answer
            </span>
            <button type="button" className="btn btn-ghost btn-sm" onClick={onSkip}>
              Skip question
            </button>
          </>
        ) : (
          <button type="button" className="btn btn-unit" onClick={onContinue}>
            {continueLabel}
          </button>
        )}
      </div>
    </motion.div>
  )
}
