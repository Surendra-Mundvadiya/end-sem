import confetti from 'canvas-confetti'
import { AnimatePresence, motion } from 'framer-motion'
import { ArrowRight, ArrowUpRight, BookOpen, Check, CircleCheck, CircleX, Compass, Flame, Layers, Lightbulb, Play, RotateCcw, Scale, Trophy, X } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from 'react'
import { Link } from 'react-router-dom'
import ProgressRing from '../../components/ProgressRing'
import UnitPill from '../../components/UnitPill'
import { CASES, getUnit, PARTS, UNITS, unitVars, type CaseItem, type UnitId } from '../../data'
import { bouncy, easeOut, fadeUp, pop, softSpring, stagger } from '../../lib/motion'
import { updateProgress } from '../../lib/progress'
import { normalize, plural, shuffle } from '../../lib/text'
import { CaseCite, CaseName } from './CaseName'
import { CASE_BY_ID, metaOf, splitPartTitle } from './caseText'
import UnitFilter from './UnitFilter'
import { isActivatable, loadPref, prefersReducedMotion, savePref, shouldIgnoreKey } from './util'

/*
 * Concept match: read a holding, pick the topic (Part) it illustrates. The case itself is the "authority",
 * hidden until the answer is in.
 */

const ROUNDS = 10
const BEST_KEY = 'taxlaw-cases-concept-best'

type Phase = 'intro' | 'play' | 'done'

interface Round {
  caseId: string
  /** Four part titles (as in the data, with their numbers) in display order; one is the case's own part. */
  options: string[]
}

interface Answer {
  caseId: string
  picked: string
  correct: boolean
}

type Best = Record<string, { score: number; total: number }>

function isBest(v: unknown): v is Best {
  if (!v || typeof v !== 'object') return false
  return Object.values(v as Record<string, unknown>).every((x) => {
    const r = x as { score?: unknown; total?: unknown } | null
    return !!r && typeof r.score === 'number' && typeof r.total === 'number' && r.total > 0
  })
}

/** "6. Moral Issues in Taxation" → "Moral Issues in Taxation" */
const conceptOf = (part: string) => splitPartTitle(part).title

/* Structural sections (worked examples, overviews) make weak distractors, so they are used last. */
const STRUCTURAL = /\billustrat|\boverview\b|\bworked\b/i

interface Topic {
  unitId: UnitId
  part: string
  structural: boolean
}

const TOPICS: Topic[] = (() => {
  const seen = new Set<string>()
  const out: Topic[] = []
  for (const p of PARTS) {
    const key = `${p.unitId}|${p.title}`
    if (p.isPractice || seen.has(key)) continue
    seen.add(key)
    out.push({ unitId: p.unitId, part: p.title, structural: STRUCTURAL.test(p.title) })
  }
  return out
})()

/**
 * The case's own topic plus three others drawn at random from the same unit (one shuffled pool, so no option is
 * a constant that gives the answer away), structural sections last, other units only if the unit runs short.
 */
function optionsFor(c: CaseItem): string[] {
  const seen = new Set([normalize(conceptOf(c.part))])
  const picks: string[] = []
  const tiers = [
    TOPICS.filter((t) => t.unitId === c.unitId && !t.structural),
    TOPICS.filter((t) => t.unitId === c.unitId && t.structural),
    TOPICS.filter((t) => t.unitId !== c.unitId && !t.structural),
    TOPICS.filter((t) => t.unitId !== c.unitId && t.structural),
  ]
  for (const tier of tiers) {
    for (const t of shuffle(tier)) {
      if (picks.length === 3) break
      const k = normalize(conceptOf(t.part))
      if (seen.has(k)) continue
      seen.add(k)
      picks.push(t.part)
    }
  }
  return shuffle([c.part, ...picks])
}

function buildRounds(pool: CaseItem[]): Round[] {
  return shuffle(pool)
    .slice(0, Math.min(ROUNDS, pool.length))
    .map((c) => ({ caseId: c.id, options: optionsFor(c) }))
}

const POOL_COUNTS: Partial<Record<UnitId, number>> = Object.fromEntries(UNITS.map((u) => [u.id, CASES.filter((c) => c.unitId === u.id).length]))

function celebrate() {
  if (prefersReducedMotion()) return
  const css = getComputedStyle(document.documentElement)
  const colors = ['--u1', '--u2', '--u3', '--u4', '--u5', '--u6', '--ok'].map((v) => css.getPropertyValue(v).trim()).filter((v) => /^#[0-9a-f]{3,8}$/i.test(v))
  const base = { particleCount: 80, spread: 70, startVelocity: 52, ticks: 240, scalar: 0.95, disableForReducedMotion: true, ...(colors.length ? { colors } : {}) }
  void confetti({ ...base, angle: 60, origin: { x: 0, y: 0.75 } })
  void confetti({ ...base, angle: 120, origin: { x: 1, y: 0.75 } })
  window.setTimeout(() => void confetti({ ...base, particleCount: 60, spread: 100, startVelocity: 38, origin: { x: 0.5, y: 0.35 } }), 260)
}

function verdict(ratio: number): { title: string; text: string } {
  if (ratio === 1) return { title: 'Perfect score', text: 'Every holding placed under the right concept.' }
  if (ratio >= 0.8) return { title: 'Excellent', text: 'You can tell these concepts apart. Keep them fresh with another round.' }
  if (ratio >= 0.6) return { title: 'Good going', text: 'A few more rounds will lock these in.' }
  if (ratio >= 0.4) return { title: 'Getting there', text: 'Read the cases below again, then play another round.' }
  return { title: 'Keep practising', text: 'Go through the cases below, then try again. It gets easier every round.' }
}

interface Props {
  unit: UnitId | null
  onUnit: (unit: UnitId | null) => void
  onExplore: () => void
}

export default function ConceptMatch({ unit, onUnit, onExplore }: Props) {
  const pool = useMemo(() => (unit ? CASES.filter((c) => c.unitId === unit) : CASES), [unit])
  const total = Math.min(ROUNDS, pool.length)
  const scopeKey = unit ?? 'all'

  const [phase, setPhase] = useState<Phase>('intro')
  const [rounds, setRounds] = useState<Round[]>([])
  const [index, setIndex] = useState(0)
  const [picked, setPicked] = useState<string | null>(null)
  const [answers, setAnswers] = useState<Answer[]>([])
  const [streak, setStreak] = useState(0)
  const [bestStreak, setBestStreak] = useState(0)
  const [best, setBest] = useState<Best>(() => loadPref<Best>(BEST_KEY, {}, isBest))
  const [newBest, setNewBest] = useState(false)
  const [announce, setAnnounce] = useState('')

  // A different unit (from the chips or the URL) starts over at the intro.
  const [scope, setScope] = useState(scopeKey)
  if (scope !== scopeKey) {
    setScope(scopeKey)
    setPhase('intro')
    setRounds([])
    setIndex(0)
    setPicked(null)
    setAnswers([])
    setStreak(0)
    setBestStreak(0)
    setNewBest(false)
    setAnnounce('')
  }

  const round = phase === 'play' ? rounds[index] : undefined
  const target = round ? CASE_BY_ID.get(round.caseId) : undefined
  const score = answers.filter((a) => a.correct).length

  /*
   * Focus follows the game: the new question, the Next button, the results heading, the Start button after
   * quitting. Screens mount after the previous one has animated out, so focus is claimed by a callback ref.
   * Arriving from the view switch also hands focus to Start, so the advertised Enter works straight away
   * (focus left on the switch would swallow it); only keyboard users get scrolled, never a cold deep link.
   */
  const [arrival] = useState<'key' | 'pointer' | null>(() => {
    const a = typeof document === 'undefined' ? null : document.activeElement
    if (!(a instanceof HTMLElement) || !a.closest('.cs-seg')) return null
    try {
      return a.matches(':focus-visible') ? 'key' : 'pointer'
    } catch {
      return 'pointer'
    }
  })
  const focusNext = useRef(arrival !== null)
  const scrollOnFocus = useRef(arrival !== 'pointer')
  const nextRef = useRef<HTMLButtonElement>(null)
  const claimFocus = useCallback((el: HTMLElement | null) => {
    if (!el || !focusNext.current) return
    focusNext.current = false
    el.focus({ preventScroll: true })
    const scroll = scrollOnFocus.current
    scrollOnFocus.current = true
    if (!scroll) return
    // If the new screen starts off-screen (e.g. after scrolling down to the feedback), bring the game's top into view.
    const top = el.getBoundingClientRect().top
    if (top < 72 || top > window.innerHeight - 96) {
      ;(el.closest('.cs-game') ?? el).scrollIntoView({ block: 'start', behavior: prefersReducedMotion() ? 'auto' : 'smooth' })
    }
  }, [])

  useEffect(() => {
    if (!picked) return
    const btn = nextRef.current
    if (!btn) return
    btn.focus({ preventScroll: true })
    if (btn.getBoundingClientRect().bottom > window.innerHeight - 8) btn.scrollIntoView({ block: 'nearest', behavior: prefersReducedMotion() ? 'auto' : 'smooth' })
  }, [picked])

  const start = () => {
    setRounds(buildRounds(pool))
    setIndex(0)
    setPicked(null)
    setAnswers([])
    setStreak(0)
    setBestStreak(0)
    setNewBest(false)
    setAnnounce('')
    setPhase('play')
    focusNext.current = true
  }

  const answer = (part: string) => {
    if (!round || !target || picked) return
    const correct = part === target.part
    const s = correct ? streak + 1 : 0
    setPicked(part)
    setAnswers((a) => [...a, { caseId: round.caseId, picked: part, correct }])
    setStreak(s)
    setBestStreak((b) => Math.max(b, s))
    const concept = conceptOf(target.part)
    const authority = metaOf(target).shortName
    setAnnounce(correct ? `Correct: ${concept}. Authority: ${authority}.` : `Not quite. The concept is ${concept}. Authority: ${authority}.`)
  }

  const finish = () => {
    const t = rounds.length
    const prev = best[scopeKey]
    const improved = !prev || score / t > prev.score / prev.total || (score / t === prev.score / prev.total && t > prev.total)
    if (improved) {
      const next = { ...best, [scopeKey]: { score, total: t } }
      setBest(next)
      savePref(BEST_KEY, next)
    }
    setNewBest(improved && !!prev)
    setPhase('done')
    setAnnounce(`Session complete. ${score} out of ${t}.`)
    focusNext.current = true
    updateProgress((p) => p) // counts today as a study day
    if (t > 0 && score / t >= 0.8) celebrate()
  }

  const next = () => {
    if (!picked) return
    if (index + 1 < rounds.length) {
      setIndex(index + 1)
      setPicked(null)
      setAnnounce('')
      focusNext.current = true
    } else finish()
  }

  const quit = () => {
    setPhase('intro')
    setPicked(null)
    setAnnounce('')
    focusNext.current = true
  }

  // Keys: 1–4 answer, Enter goes on. Re-subscribed every render so the handler always sees fresh state.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat || shouldIgnoreKey(e)) return
      if (phase === 'play' && round) {
        if (!picked && /^[1-4]$/.test(e.key)) {
          const part = round.options[Number(e.key) - 1]
          if (part) {
            e.preventDefault()
            answer(part)
          }
        } else if (picked && e.key === 'Enter' && !isActivatable(e.target)) {
          e.preventDefault()
          next()
        }
      } else if (phase !== 'play' && e.key === 'Enter' && !isActivatable(e.target) && total > 0) {
        e.preventDefault()
        start()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  const screen = { initial: { opacity: 0, y: 14 }, animate: { opacity: 1, y: 0 }, exit: { opacity: 0, y: -10 }, transition: { duration: 0.3, ease: easeOut } }

  return (
    <div className="cs-game" style={unit ? unitVars(unit) : undefined}>
      <p className="sr-only" aria-live="polite">
        {announce}
      </p>
      <AnimatePresence mode="wait" initial={false}>
        {phase === 'intro' && (
          <motion.div key="intro" {...screen}>
            <Intro unit={unit} onUnit={onUnit} total={total} best={best[scopeKey]} startRef={claimFocus} onStart={start} />
          </motion.div>
        )}

        {phase === 'play' && round && target && (
          <motion.div key="play" {...screen}>
            <Hud unit={unit} index={index} count={rounds.length} answered={!!picked} score={score} streak={streak} onQuit={quit} />
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={index}
                initial={{ opacity: 0, x: 32 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -32 }}
                transition={{ duration: 0.3, ease: easeOut }}
              >
                <RoundView
                  round={round}
                  target={target}
                  picked={picked}
                  streak={streak}
                  isLast={index + 1 === rounds.length}
                  questionRef={claimFocus}
                  nextRef={nextRef}
                  onAnswer={answer}
                  onNext={next}
                />
              </motion.div>
            </AnimatePresence>
            <p className="cs-keys" aria-hidden="true">
              <span className="kbd">1</span>–<span className="kbd">4</span> pick a concept · <span className="kbd">Enter</span> next
            </p>
          </motion.div>
        )}

        {phase === 'done' && (
          <motion.div key="done" {...screen}>
            <Results
              unit={unit}
              answers={answers}
              bestStreak={bestStreak}
              best={best[scopeKey]}
              newBest={newBest}
              headingRef={claimFocus}
              onAgain={start}
              onUnit={onUnit}
              onExplore={onExplore}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

/* ---------- intro ---------- */

function Intro({
  unit,
  onUnit,
  total,
  best,
  startRef,
  onStart,
}: {
  unit: UnitId | null
  onUnit: (u: UnitId | null) => void
  total: number
  best?: { score: number; total: number }
  startRef: (el: HTMLButtonElement | null) => void
  onStart: () => void
}) {
  const scope = unit ? getUnit(unit) : null
  const art = [
    { u: 'u1', Icon: Scale },
    { u: 'u3', Icon: Lightbulb },
    { u: 'u6', Icon: Scale },
  ] as const
  return (
    <section className="cs-intro" aria-labelledby="cs-intro-title">
      <div className="cs-intro__art" aria-hidden="true">
        {art.map(({ u, Icon }, i) => (
          <motion.span
            key={u}
            className={`cs-intro__card cs-intro__card--${i}`}
            style={unitVars(u)}
            initial={{ opacity: 0, y: 18, rotate: 0 }}
            animate={{ opacity: 1, y: [0, -6, 0], rotate: (i - 1) * 9 }}
            transition={{
              opacity: { duration: 0.4, delay: 0.1 + i * 0.08 },
              rotate: { ...bouncy, delay: 0.1 + i * 0.08 },
              y: { duration: 4.2, repeat: Infinity, ease: 'easeInOut', delay: i * 0.6 },
            }}
          >
            <Icon size={22} />
            <span className="cs-intro__line" />
            <span className="cs-intro__line cs-intro__line--short" />
          </motion.span>
        ))}
      </div>

      <div className="cs-intro__body">
        <p className="eyebrow">Concept match</p>
        <h2 className="cs-intro__title" id="cs-intro-title">
          Which concept does this case illustrate?
        </h2>
        <p className="cs-intro__text">
          Read what the court held, then pick the concept it illustrates. The case stays hidden until you answer, then it is revealed as
          the authority. {plural(total, 'round')}
          {scope ? ` from ${scope.short}, ${scope.name}.` : ' across all units.'}
        </p>
        {total < ROUNDS && scope && (
          <p className="cs-intro__note">
            {scope.short} has {plural(total, 'case')} in the notes, so this session covers each of them once.
          </p>
        )}

        <UnitFilter unit={unit} onChange={onUnit} counts={POOL_COUNTS} total={CASES.length} label="Cases from" />

        <div className="cs-intro__actions">
          <motion.button
            ref={startRef}
            type="button"
            className="btn btn-primary btn-lg cs-start"
            onClick={onStart}
            whileHover={{ y: -2 }}
            whileTap={{ scale: 0.97 }}
          >
            <Play size={18} aria-hidden="true" /> Start {plural(total, 'round')}
            <span className="kbd cs-kbd-in" aria-hidden="true">
              Enter
            </span>
          </motion.button>
          {best && (
            <span className="cs-best">
              <Trophy size={16} aria-hidden="true" /> Best: {best.score}/{best.total}
            </span>
          )}
        </div>
        <p className="cs-keys cs-keys--start" aria-hidden="true">
          In a round: <span className="kbd">1</span>–<span className="kbd">4</span> answer · <span className="kbd">Enter</span> next case
        </p>
      </div>
    </section>
  )
}

/* ---------- heads-up display ---------- */

function Hud({
  unit,
  index,
  count,
  answered,
  score,
  streak,
  onQuit,
}: {
  unit: UnitId | null
  index: number
  count: number
  answered: boolean
  score: number
  streak: number
  onQuit: () => void
}) {
  const done = index + (answered ? 1 : 0)
  return (
    <div className="cs-hud">
      <div className="cs-hud__round">
        <span className="cs-hud__label">
          Round <strong>{index + 1}</strong> of {count}
        </span>
        {unit ? <UnitPill unitId={unit} /> : <span className="cs-hud__scope">All units</span>}
      </div>
      <div className="bar cs-hud__bar" role="progressbar" aria-label="Session progress" aria-valuemin={0} aria-valuemax={count} aria-valuenow={done}>
        <span style={{ width: `${(done / count) * 100}%` }} />
      </div>
      <div className="cs-hud__stats">
        <span className="cs-hud__stat cs-hud__stat--ok" title="Correct answers">
          <CircleCheck size={16} aria-hidden="true" />
          <motion.span key={score} initial={{ scale: 1.5, opacity: 0.4 }} animate={{ scale: 1, opacity: 1 }} transition={bouncy}>
            {score}
          </motion.span>
          <span className="sr-only"> correct</span>
        </span>
        <span className={`cs-hud__stat cs-hud__stat--streak${streak >= 2 ? ' is-hot' : ''}`} title="Streak">
          <Flame size={16} aria-hidden="true" />
          <motion.span key={streak} initial={{ scale: 1.6, opacity: 0.4 }} animate={{ scale: 1, opacity: 1 }} transition={bouncy}>
            {streak}
          </motion.span>
          <span className="sr-only"> in a row</span>
        </span>
        <button type="button" className="btn btn-ghost btn-sm btn-icon" aria-label="End session" title="End session" onClick={onQuit}>
          <X size={16} />
        </button>
      </div>
    </div>
  )
}

/* ---------- one round ---------- */

const shake = { x: [0, -11, 10, -7, 6, -3, 0] }

function RoundView({
  round,
  target,
  picked,
  streak,
  isLast,
  questionRef,
  nextRef,
  onAnswer,
  onNext,
}: {
  round: Round
  target: CaseItem
  picked: string | null
  streak: number
  isLast: boolean
  questionRef: (el: HTMLDivElement | null) => void
  nextRef: RefObject<HTMLButtonElement | null>
  onAnswer: (part: string) => void
  onNext: () => void
}) {
  const meta = metaOf(target)
  const correct = picked === target.part
  const qId = `cs-q-${round.caseId}`

  return (
    <div className="cs-round" style={unitVars(target.unitId)}>
      <div className="cs-q" ref={questionRef} tabIndex={-1} role="group" aria-labelledby={qId}>
        <div className="cs-q__top">
          <span className="eyebrow" id={qId}>
            Which concept does this case illustrate?
          </span>
          <UnitPill unitId={target.unitId} />
        </div>
        <div className="notes cs-q__held" dangerouslySetInnerHTML={{ __html: picked ? target.held : meta.maskedHeld }} />
      </div>

      <div className="cs-options" role="group" aria-labelledby={qId}>
        {round.options.map((part, i) => {
          const isAnswer = part === target.part
          const state = !picked ? 'idle' : isAnswer ? 'right' : part === picked ? 'wrong' : 'dim'
          return (
            <motion.button
              key={part}
              type="button"
              className={`cs-opt is-${state}`}
              aria-disabled={picked ? true : undefined}
              onClick={() => onAnswer(part)}
              initial={{ opacity: 0, y: 10 }}
              animate={
                state === 'wrong'
                  ? { opacity: 1, y: 0, ...shake }
                  : state === 'right'
                    ? { opacity: 1, y: 0, scale: [1, 1.035, 1] }
                    : { opacity: state === 'dim' ? 0.5 : 1, y: 0 }
              }
              transition={
                state === 'wrong'
                  ? { duration: 0.5, ease: 'easeInOut' }
                  : state === 'right'
                    ? { duration: 0.5, ease: easeOut }
                    : { duration: 0.35, ease: easeOut, delay: picked ? 0 : 0.06 + i * 0.05 }
              }
              whileHover={picked ? undefined : { y: -2 }}
              whileTap={picked ? undefined : { scale: 0.98 }}
            >
              <span className="kbd cs-opt__key" aria-hidden="true">
                {i + 1}
              </span>
              <span className="cs-opt__name">{conceptOf(part)}</span>
              <span className="cs-opt__mark" aria-hidden="true">
                {state === 'right' && (
                  <motion.span initial={{ scale: 0, rotate: -30 }} animate={{ scale: 1, rotate: 0 }} transition={bouncy}>
                    <Check size={18} strokeWidth={3} />
                  </motion.span>
                )}
                {state === 'wrong' && (
                  <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} transition={bouncy}>
                    <X size={18} strokeWidth={3} />
                  </motion.span>
                )}
              </span>
              {state === 'right' && <span className="sr-only"> (the right answer)</span>}
              {state === 'wrong' && <span className="sr-only"> (your answer, wrong)</span>}
            </motion.button>
          )
        })}
      </div>

      <AnimatePresence>
        {picked && (
          <motion.div
            className={`cs-feedback ${correct ? 'is-ok' : 'is-bad'}`}
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={softSpring}
          >
            <span className="cs-feedback__icon" aria-hidden="true">
              {correct ? <CircleCheck size={26} /> : <CircleX size={26} />}
            </span>
            <div className="cs-feedback__body">
              <p className="cs-feedback__verdict">{correct ? (streak >= 3 ? `Correct · ${streak} in a row` : 'Correct') : 'Not quite. The concept is'}</p>
              <p className="cs-feedback__concept">{conceptOf(target.part)}</p>
              <motion.div
                className="cs-authority"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, ease: easeOut, delay: 0.15 }}
              >
                <span className="cs-authority__label">
                  <Scale size={14} aria-hidden="true" /> Authority
                </span>
                <p className="cs-authority__name">
                  <CaseName meta={meta} />
                </p>
                <CaseCite meta={meta} className="cs-cite cs-authority__cite" />
              </motion.div>
            </div>
            <div className="cs-feedback__actions">
              <Link className="cs-link" to={`/learn/${target.slideId}`} target="_blank" rel="noopener" title="Opens in a new tab, so your session keeps going">
                <BookOpen size={15} aria-hidden="true" /> Read in notes <ArrowUpRight size={14} aria-hidden="true" />
              </Link>
              <button ref={nextRef} type="button" className="btn btn-unit cs-next" onClick={onNext}>
                {isLast ? 'See results' : 'Next case'} <ArrowRight size={16} aria-hidden="true" />
                <span className="kbd cs-kbd-in" aria-hidden="true">
                  Enter
                </span>
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

/* ---------- results ---------- */

function Results({
  unit,
  answers,
  bestStreak,
  best,
  newBest,
  headingRef,
  onAgain,
  onUnit,
  onExplore,
}: {
  unit: UnitId | null
  answers: Answer[]
  bestStreak: number
  best?: { score: number; total: number }
  newBest: boolean
  headingRef: (el: HTMLHeadingElement | null) => void
  onAgain: () => void
  onUnit: (u: UnitId | null) => void
  onExplore: () => void
}) {
  const total = answers.length
  const score = answers.filter((a) => a.correct).length
  const ratio = total ? score / total : 0
  const v = verdict(ratio)
  const missed = answers.filter((a) => !a.correct)

  return (
    <>
      <motion.section className="cs-results" aria-labelledby="cs-results-title" variants={stagger(0.07, 0.05)} initial="hidden" animate="show">
        <motion.div variants={pop} className="cs-results__ring">
          <ProgressRing value={ratio} size={136} stroke={11} color={ratio >= 0.8 ? 'var(--ok)' : 'var(--unit, var(--brand))'} label={`${score} out of ${total}`}>
            <span className="cs-results__score">
              <strong>{score}</strong>
              <span>/{total}</span>
            </span>
          </ProgressRing>
        </motion.div>
        <div className="cs-results__text">
          <motion.h2 variants={fadeUp} className="cs-results__title" id="cs-results-title" ref={headingRef} tabIndex={-1}>
            {v.title}
          </motion.h2>
          <motion.p variants={fadeUp} className="cs-results__sub">
            {v.text}
          </motion.p>
          {newBest && (
            <motion.span variants={pop} className="cs-badge">
              <Trophy size={15} aria-hidden="true" /> New personal best
            </motion.span>
          )}
          <motion.ol variants={fadeUp} className="cs-dots" aria-label="Your answers, round by round">
            {answers.map((a, i) => (
              <li key={i} className={a.correct ? 'is-ok' : 'is-bad'} title={`Round ${i + 1}: ${a.correct ? 'correct' : 'wrong'}`}>
                <span className="sr-only">
                  Round {i + 1}: {a.correct ? 'correct' : 'wrong'}
                </span>
              </li>
            ))}
          </motion.ol>
          <motion.dl variants={fadeUp} className="cs-stats">
            <div>
              <dt>Accuracy</dt>
              <dd>{Math.round(ratio * 100)}%</dd>
            </div>
            <div>
              <dt>Best streak</dt>
              <dd>{bestStreak}</dd>
            </div>
            <div>
              <dt>Personal best</dt>
              <dd>{best ? `${best.score}/${best.total}` : '–'}</dd>
            </div>
          </motion.dl>
          <motion.div variants={fadeUp} className="cs-results__actions">
            <button type="button" className="btn btn-primary btn-lg" onClick={onAgain}>
              <RotateCcw size={17} aria-hidden="true" /> Play again
              <span className="kbd cs-kbd-in" aria-hidden="true">
                Enter
              </span>
            </button>
            <Link className="btn btn-lg" to={unit ? `/flashcards?unit=${unit}&kind=case` : '/flashcards?kind=case'}>
              <Layers size={17} aria-hidden="true" /> Case flashcards
            </Link>
            <button type="button" className="btn btn-ghost btn-lg" onClick={onExplore}>
              <Compass size={17} aria-hidden="true" /> Explore cases
            </button>
          </motion.div>
        </div>
      </motion.section>

      <div className="cs-results__units">
        <p className="cs-results__units-label">Next session from</p>
        <UnitFilter unit={unit} onChange={onUnit} counts={POOL_COUNTS} total={CASES.length} label="Next session from" />
      </div>

      {missed.length > 0 && (
        <motion.section className="cs-review" aria-labelledby="cs-review-title" initial="hidden" animate="show" variants={stagger(0.06, 0.35)}>
          <motion.h3 variants={fadeUp} className="cs-review__title" id="cs-review-title">
            Revisit {missed.length === 1 ? 'this case' : `these ${missed.length} cases`}
          </motion.h3>
          {missed.map((a, i) => {
            const c = CASE_BY_ID.get(a.caseId)
            if (!c) return null
            const m = metaOf(c)
            return (
              <motion.article key={`${a.caseId}-${i}`} variants={fadeUp} className="cs-review__item" style={unitVars(c.unitId)}>
                <div className="cs-review__concept">
                  <UnitPill unitId={c.unitId} />
                  <span className="cs-review__concept-name">{conceptOf(c.part)}</span>
                  <span className="cs-review__picked">
                    You picked: <s>{conceptOf(a.picked)}</s>
                  </span>
                </div>
                <div className="notes cs-held" dangerouslySetInnerHTML={{ __html: c.held }} />
                <div className="cs-review__foot">
                  <div className="cs-review__authority">
                    <span className="cs-authority__label">
                      <Scale size={14} aria-hidden="true" /> Authority
                    </span>
                    <p className="cs-authority__name">
                      <CaseName meta={m} />
                    </p>
                    <CaseCite meta={m} />
                  </div>
                  <Link className="cs-link" to={`/learn/${c.slideId}`}>
                    <BookOpen size={15} aria-hidden="true" /> Read in notes <ArrowRight className="cs-link__arrow" size={14} aria-hidden="true" />
                  </Link>
                </div>
              </motion.article>
            )
          })}
        </motion.section>
      )}
    </>
  )
}
