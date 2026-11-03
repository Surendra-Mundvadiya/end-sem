import { useEffect, useEffectEvent, useRef, useState, type CSSProperties } from 'react'
import { AnimatePresence, motion, useReducedMotion, type Variants } from 'framer-motion'
import { ArrowLeft, ArrowRight, Check, Crosshair, RotateCcw, Send, Target, Timer, X } from 'lucide-react'
import UnitPill from '../../components/UnitPill'
import { getUnit, unitVars, type QuizItem } from '../../data'
import { recordQuizAnswer } from '../../lib/progress'
import { bouncy, easeOut, fadeUp, softSpring, spring, stagger } from '../../lib/motion'
import { ConceptTag, ExamTimer, StreakFlame, StudyLink } from './bits'
import {
  CONCEPT_UP_FRONT,
  LETTERS,
  MODE_LABEL,
  examMs,
  type EndReason,
  type Outcome,
  type Run,
  type RunProgress,
  type RunQuestion,
} from './engine'
import { enterBelongsToTarget, useHotkeys } from './useHotkeys'

/* The running quiz: one question at a time. */

interface Props {
  run: Run
  /** State to pick up from when coming back to an unfinished quiz. */
  resume?: RunProgress
  /** Called after every change so the quiz can be resumed. */
  onProgress?: (state: RunProgress) => void
  onFinish: (o: Outcome) => void
  /** Ended before answering anything: nothing to score. */
  onQuit: () => void
}

type OptState = 'idle' | 'selected' | 'correct' | 'wrong' | 'dim'

const PRAISE = ['Correct!', 'Spot on.', 'Exactly right.', 'Nailed it.', 'Well done.']

const cardVariants: Variants = {
  enter: (d: number) => ({ opacity: 0, x: 56 * d, scale: 0.985 }),
  center: {
    opacity: 1,
    x: 0,
    scale: 1,
    transition: { x: softSpring, scale: softSpring, opacity: { duration: 0.28, ease: easeOut } },
  },
  // popLayout lifts the leaving card above the new one; keep it from catching clicks.
  exit: (d: number) => ({ opacity: 0, x: -56 * d, scale: 0.985, pointerEvents: 'none', transition: { duration: 0.22, ease: easeOut } }),
}

const optVariants: Variants = {
  idle: { x: 0, y: 0, scale: 1, opacity: 1 },
  selected: { x: 0, y: 0, scale: 1, opacity: 1 },
  correct: { x: 0, y: 0, opacity: 1, scale: [1, 1.035, 1], transition: { duration: 0.5, ease: easeOut } },
  wrong: { y: 0, scale: 1, opacity: 1, x: [0, -10, 9, -7, 5, -2, 0], transition: { duration: 0.5, ease: 'easeInOut' } },
  dim: { x: 0, y: 0, scale: 0.985, opacity: 0.5, transition: { duration: 0.3, ease: easeOut } },
  hover: { y: -2, transition: spring },
  tap: { scale: 0.985, transition: spring },
}

const MODE_ICON = { practice: Target, exam: Timer, weak: Crosshair }

export default function QuizRun({ run, resume, onProgress, onFinish, onQuit }: Props) {
  const total = run.questions.length
  const instant = run.mode !== 'exam'
  const reduce = useReducedMotion()

  const [startedAt] = useState(() => resume?.startedAt ?? Date.now())
  const [deadline] = useState(() => (instant ? null : (resume?.deadline ?? Date.now() + examMs(total))))
  const [index, setIndex] = useState(() => resume?.index ?? 0)
  const [dir, setDir] = useState(1)
  const [picks, setPicks] = useState<(number | null)[]>(() => resume?.picks ?? run.questions.map(() => null))
  const [streak, setStreak] = useState(() => resume?.streak ?? 0)
  const [confirmEnd, setConfirmEnd] = useState(false)
  const [status, setStatus] = useState('')

  // Refs mirror the state the handlers depend on, so a fast double click or a timer firing
  // alongside a click can't record an answer or finish the quiz twice.
  const picksRef = useRef(picks)
  const streakRef = useRef(streak)
  const bestRef = useRef(resume?.best ?? 0)
  const finishedRef = useRef(false)
  const stageRef = useRef<HTMLDivElement>(null)

  const report = useEffectEvent((state: RunProgress) => onProgress?.(state))
  useEffect(() => {
    if (!finishedRef.current) report({ index, picks, streak, best: bestRef.current, startedAt, deadline })
  }, [index, picks, streak, startedAt, deadline])

  const q = run.questions[index]
  const pick = picks[index]
  const revealed = instant && pick !== null
  const answered = picks.filter((p) => p !== null).length
  const right = picks.filter((p, i) => p !== null && p === run.questions[i].answer).length
  const isLast = index === total - 1
  const otherOpen = picks.some((p, i) => p === null && i !== index)

  useEffect(() => {
    if (!confirmEnd) return
    const t = window.setTimeout(() => setConfirmEnd(false), 4000)
    return () => window.clearTimeout(t)
  }, [confirmEnd])

  function finish(reason: EndReason) {
    if (finishedRef.current) return
    finishedRef.current = true
    const now = Date.now()
    onFinish({
      run,
      picks: picksRef.current,
      reason,
      bestStreak: bestRef.current,
      startedAt,
      finishedAt: now,
      msLeft: deadline === null ? null : Math.max(0, deadline - now),
    })
  }

  function choose(i: number) {
    if (finishedRef.current || i < 0 || i >= q.options.length) return
    const current = picksRef.current
    if (instant ? current[index] !== null : current[index] === i) return
    const next = current.slice()
    next[index] = i
    picksRef.current = next
    setPicks(next)
    setConfirmEnd(false)
    if (!instant) return
    const correct = i === q.answer
    recordQuizAnswer(q.item.id, correct)
    const s = correct ? streakRef.current + 1 : 0
    streakRef.current = s
    bestRef.current = Math.max(bestRef.current, s)
    setStreak(s)
    setStatus(
      correct
        ? `Correct. ${q.item.why}`
        : `Not quite. The answer is ${LETTERS[q.answer]}: ${q.options[q.answer]}. ${q.item.why}`,
    )
  }

  function go(to: number) {
    if (finishedRef.current || to === index || to < 0 || to >= total) return
    setDir(to > index ? 1 : -1)
    setIndex(to)
    setStatus('')
    setConfirmEnd(false)
    const stage = stageRef.current
    if (stage && stage.getBoundingClientRect().top < 0) {
      stage.scrollIntoView({ block: 'start', behavior: reduce ? 'auto' : 'smooth' })
    }
  }

  function next() {
    if (finishedRef.current) return
    if (instant) {
      if (picksRef.current[index] === null) return
      if (isLast) finish('complete')
      else go(index + 1)
      return
    }
    if (!isLast) return go(index + 1)
    // Last exam question: visit anything skipped before submitting.
    const open = picksRef.current.findIndex((p, i) => p === null && i !== index)
    if (open !== -1) go(open)
    else finish('complete')
  }

  function endQuiz() {
    if (!confirmEnd) {
      setConfirmEnd(true)
      return
    }
    if (!picksRef.current.some((p) => p !== null)) {
      finishedRef.current = true
      onQuit()
      return
    }
    finish('ended')
  }

  useHotkeys((e) => {
    const k = e.key
    if (/^[1-6]$/.test(k)) {
      e.preventDefault()
      choose(Number(k) - 1)
      return
    }
    const letter = k.length === 1 ? 'abcdef'.indexOf(k.toLowerCase()) : -1
    if (letter !== -1) {
      e.preventDefault()
      choose(letter)
      return
    }
    if (k === 'Enter') {
      if (e.repeat || enterBelongsToTarget(e)) return
      e.preventDefault()
      // Enter on a focused option picks it; once answered, Enter moves on.
      const opt = e.target instanceof Element ? e.target.closest('[data-qz-option]') : null
      const oi = opt ? Number(opt.getAttribute('data-qz-option')) : -1
      const cur = picksRef.current[index]
      if (oi >= 0 && cur !== oi && (!instant || cur === null)) choose(oi)
      else next()
      return
    }
    if (!instant && (k === 'ArrowRight' || k === 'ArrowLeft')) {
      e.preventDefault()
      go(index + (k === 'ArrowRight' ? 1 : -1))
    }
  })

  function optState(i: number): OptState {
    if (!instant) return pick === i ? 'selected' : 'idle'
    if (pick === null) return 'idle'
    if (i === q.answer) return 'correct'
    return i === pick ? 'wrong' : 'dim'
  }

  const ModeIcon = run.retry ? RotateCcw : MODE_ICON[run.mode]
  const correctNow = revealed && pick === q.answer
  const praise = streak >= 3 ? `${streak} in a row!` : PRAISE[index % PRAISE.length]
  const examNextLabel = !isLast ? (pick === null ? 'Skip' : 'Next') : otherOpen ? 'Next unanswered' : 'Submit exam'

  return (
    <div className="qz-run">
      <header className="qz-runbar" style={unitVars(q.item.unitId)}>
        <div className="qz-runbar__top">
          <div className="qz-runbar__info">
            <span className={`qz-mode is-${run.mode}`}>
              <ModeIcon size={15} aria-hidden="true" />
              {run.retry ? 'Retry missed' : MODE_LABEL[run.mode]}
            </span>
            <span className="qz-runbar__count">
              Question <strong>{index + 1}</strong> of {total}
            </span>
          </div>
          <div className="qz-runbar__right">
            {instant ? (
              <>
                <span className="qz-tally">
                  <span className="qz-tally__ok" aria-hidden="true">
                    <Check size={14} strokeWidth={3} />
                    {right}
                  </span>
                  <span className="qz-tally__bad" aria-hidden="true">
                    <X size={14} strokeWidth={3} />
                    {answered - right}
                  </span>
                  <span className="sr-only">{`${right} right, ${answered - right} wrong`}</span>
                </span>
                <StreakFlame streak={streak} />
              </>
            ) : (
              <>
                <span className="qz-answered">
                  {answered}/{total} <span className="qz-hide-sm">answered</span>
                </span>
                {deadline !== null && <ExamTimer deadline={deadline} totalMs={examMs(total)} onExpire={() => finish('timeout')} />}
              </>
            )}
            <button type="button" className={`btn btn-sm qz-end${confirmEnd ? ' is-confirm' : ''}`} onClick={endQuiz}>
              {confirmEnd ? (
                <>
                  <Check size={15} strokeWidth={3} aria-hidden="true" />
                  End now?
                </>
              ) : (
                'End quiz'
              )}
            </button>
          </div>
        </div>
        <Track run={run} picks={picks} index={index} instant={instant} onJump={go} />
      </header>

      <div className="qz-stage" ref={stageRef}>
        <AnimatePresence mode="popLayout" custom={dir}>
          <motion.section
            key={index}
            className="qz-q card"
            style={unitVars(q.item.unitId)}
            custom={dir}
            variants={cardVariants}
            initial="enter"
            animate="center"
            exit="exit"
            aria-labelledby={`qz-q-${run.id}-${index}`}
          >
            <QuestionHead q={q} headingId={`qz-q-${run.id}-${index}`} showConcept={CONCEPT_UP_FRONT || revealed} />

            <motion.div
              className="qz-opts"
              role="group"
              aria-label="Answer options"
              variants={stagger(0.045, 0.06)}
              initial="hidden"
              animate="show"
            >
              {q.options.map((text, i) => {
                const state = optState(i)
                const locked = instant && pick !== null
                const suffix =
                  state === 'correct' ? ' (correct answer)' : state === 'wrong' ? ' (your answer, incorrect)' : ''
                return (
                  <motion.div key={i} className="qz-opt-wrap" variants={fadeUp}>
                    <motion.button
                      type="button"
                      className={`qz-opt is-${state}`}
                      data-qz-enter=""
                      data-qz-option={i}
                      aria-disabled={locked || undefined}
                      aria-pressed={instant ? undefined : state === 'selected'}
                      aria-label={`${LETTERS[i]}. ${text}${suffix}`}
                      aria-keyshortcuts={`${i + 1} ${LETTERS[i]}`}
                      onClick={() => choose(i)}
                      variants={optVariants}
                      initial={false}
                      animate={state}
                      whileHover={locked ? undefined : 'hover'}
                      whileTap={locked ? undefined : 'tap'}
                    >
                      <span className="qz-opt__key" aria-hidden="true">
                        <AnimatePresence mode="popLayout" initial={false}>
                          <motion.span
                            key={state === 'correct' ? 'ok' : state === 'wrong' ? 'bad' : 'letter'}
                            className="qz-opt__glyph"
                            initial={{ scale: 0.3, opacity: 0, rotate: -30 }}
                            animate={{ scale: 1, opacity: 1, rotate: 0 }}
                            exit={{ scale: 0.3, opacity: 0 }}
                            transition={bouncy}
                          >
                            {state === 'correct' ? (
                              <Check size={17} strokeWidth={3} />
                            ) : state === 'wrong' ? (
                              <X size={17} strokeWidth={3} />
                            ) : (
                              LETTERS[i]
                            )}
                          </motion.span>
                        </AnimatePresence>
                      </span>
                      <span className="qz-opt__text">{text}</span>
                    </motion.button>
                  </motion.div>
                )
              })}
            </motion.div>

            <AnimatePresence initial={false}>
              {revealed && (
                <Explain
                  key="explain"
                  item={q.item}
                  correct={correctNow}
                  title={correctNow ? praise : 'Not quite'}
                  answer={`${LETTERS[q.answer]}. ${q.options[q.answer]}`}
                  nextLabel={isLast ? 'See results' : 'Next question'}
                  onNext={next}
                />
              )}
            </AnimatePresence>

            {instant ? (
              !revealed && (
                <p className="qz-keys" aria-hidden="true">
                  <span className="kbd">1</span>–<span className="kbd">{q.options.length}</span> answer
                  <span className="qz-keys__sep">·</span>
                  <span className="kbd">Enter</span> next
                </p>
              )
            ) : (
              <div className="qz-q__foot">
                <button type="button" className="btn" onClick={() => go(index - 1)} disabled={index === 0}>
                  <ArrowLeft size={17} aria-hidden="true" />
                  <span className="qz-hide-sm">Previous</span>
                </button>
                <p className="qz-keys" aria-hidden="true">
                  <span className="kbd">1</span>–<span className="kbd">{q.options.length}</span> answer
                  <span className="qz-keys__sep">·</span>
                  <span className="kbd">Enter</span> next
                  <span className="qz-keys__sep">·</span>
                  <span className="kbd">←</span>
                  <span className="kbd">→</span> move
                </p>
                <button type="button" className="btn btn-primary" data-qz-enter="" onClick={next}>
                  {examNextLabel}
                  {isLast && !otherOpen ? <Send size={16} aria-hidden="true" /> : <ArrowRight size={17} aria-hidden="true" />}
                </button>
              </div>
            )}
          </motion.section>
        </AnimatePresence>
      </div>

      <p className="sr-only" role="status" aria-live="polite">
        {status}
      </p>
    </div>
  )
}

/** Unit label and question text. Focuses the question when it appears so screen readers read it. */
function QuestionHead({ q, headingId, showConcept }: { q: RunQuestion; headingId: string; showConcept: boolean }) {
  const ref = useRef<HTMLHeadingElement>(null)
  useEffect(() => {
    ref.current?.focus({ preventScroll: true })
  }, [])
  const unit = getUnit(q.item.unitId)
  const concept = q.item.concept
  return (
    <>
      <div className="qz-q__meta">
        <UnitPill unitId={q.item.unitId} />
        <span className="qz-q__unit">{unit.name}</span>
        <AnimatePresence initial={false}>
          {concept && showConcept && (
            <motion.span
              key="concept"
              className="qz-q__concept"
              initial={{ opacity: 0, scale: 0.85, y: 4 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={bouncy}
            >
              <ConceptTag concept={concept} />
            </motion.span>
          )}
        </AnimatePresence>
      </div>
      <h2 className="qz-q__title" id={headingId} ref={ref} tabIndex={-1}>
        {q.item.question}
      </h2>
    </>
  )
}

function Explain({
  item,
  correct,
  title,
  answer,
  nextLabel,
  onNext,
}: {
  item: QuizItem
  correct: boolean
  title: string
  answer: string
  nextLabel: string
  onNext: () => void
}) {
  const ref = useRef<HTMLDivElement>(null)
  const reduce = useReducedMotion()
  useEffect(() => {
    // Bring the explanation and the Next button on screen on small displays.
    const t = window.setTimeout(() => {
      const el = ref.current
      if (el && el.getBoundingClientRect().bottom > window.innerHeight - 80) {
        el.scrollIntoView({ block: 'nearest', behavior: reduce ? 'auto' : 'smooth' })
      }
    }, 160)
    return () => window.clearTimeout(t)
  }, [reduce])
  return (
    <motion.div
      ref={ref}
      className={`qz-explain ${correct ? 'is-ok' : 'is-bad'}`}
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0, transition: { ...softSpring, delay: correct ? 0.12 : 0.34 } }}
      exit={{ opacity: 0, transition: { duration: 0.15 } }}
    >
      <div className="qz-explain__head">
        <motion.span
          className="qz-explain__icon"
          aria-hidden="true"
          initial={{ scale: 0.4, rotate: -25 }}
          animate={{ scale: 1, rotate: 0, transition: { ...bouncy, delay: correct ? 0.16 : 0.38 } }}
        >
          {correct ? <Check size={18} strokeWidth={3} /> : <X size={18} strokeWidth={3} />}
        </motion.span>
        <div className="qz-explain__titles">
          <p className="qz-explain__title">{title}</p>
          {!correct && (
            <p className="qz-explain__answer">
              Answer: <strong>{answer}</strong>
            </p>
          )}
        </div>
      </div>
      <p className="qz-explain__why">{item.why}</p>
      <div className="qz-explain__foot">
        <StudyLink item={item} />
        <span className="qz-explain__next">
          <span className="qz-keys qz-hide-touch" aria-hidden="true">
            <span className="kbd">Enter</span>
          </span>
          <button type="button" className="btn btn-primary" data-qz-enter="" onClick={onNext}>
            {nextLabel}
            <ArrowRight size={17} aria-hidden="true" />
          </button>
        </span>
      </div>
    </motion.div>
  )
}

/** Progress: a segment per question up to 40 (coloured by result in practice), else a continuous bar. */
function Track({
  run,
  picks,
  index,
  instant,
  onJump,
}: {
  run: Run
  picks: (number | null)[]
  index: number
  instant: boolean
  onJump: (i: number) => void
}) {
  const total = run.questions.length
  const done = picks.filter((p) => p !== null).length
  const label = `${done} of ${total} answered`
  if (total > 40) {
    return (
      <div className="qz-track" role="progressbar" aria-label="Quiz progress" aria-valuemin={0} aria-valuemax={total} aria-valuenow={done} aria-valuetext={label}>
        <motion.span className="qz-track__fill" initial={false} animate={{ scaleX: done / total }} transition={softSpring} />
        <span className="qz-track__here" style={{ '--at': (index + 0.5) / total } as CSSProperties} />
      </div>
    )
  }
  return (
    <div className="qz-segs" role="progressbar" aria-label="Quiz progress" aria-valuemin={0} aria-valuemax={total} aria-valuenow={done} aria-valuetext={label}>
      {run.questions.map((rq, i) => {
        const p = picks[i]
        const tone = p === null ? '' : !instant ? ' is-done' : p === rq.answer ? ' is-ok' : ' is-bad'
        const cls = `qz-segs__item${tone}${i === index ? ' is-current' : ''}`
        return instant ? (
          <span key={i} className={cls} />
        ) : (
          <button
            key={i}
            type="button"
            tabIndex={-1}
            className={cls}
            aria-label={`Question ${i + 1}${p === null ? '' : ', answered'}`}
            onClick={() => onJump(i)}
          />
        )
      })}
    </div>
  )
}
