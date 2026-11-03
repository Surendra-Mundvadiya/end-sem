import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { BookOpen, Check, Clock, Flame, Hourglass, Layers, ListChecks, Plus, RefreshCw, RotateCcw, Sparkles, Trophy, X } from 'lucide-react'
import PageHeader from '../../components/PageHeader'
import ProgressRing from '../../components/ProgressRing'
import UnitPill from '../../components/UnitPill'
import { getUnit, slidesOfUnit, unitVars, type UnitId } from '../../data'
import { easeOut, softSpring, stagger, fadeUp } from '../../lib/motion'
import { ConceptTag, CountUp, Seg, StudyLink } from './bits'
import {
  LETTERS,
  MODE_LABEL,
  WEAK_UNIT_PCT,
  clock,
  duration,
  pctOf,
  verdict,
  type Graded,
  type Outcome,
  type Summary,
} from './engine'

interface Props {
  outcome: Outcome
  summary: Summary
  /** Units where this quiz beat an earlier best. */
  newBest: UnitId[]
  /** Weak-spot rounds: how many of the questions are no longer weak. */
  cleared: number | null
  onRetryMissed: () => void
  onAgain: () => void
  onNew: () => void
}

type Filter = 'missed' | 'all'
const FILTER_KEY = 'taxlaw-quiz-review'

function loadFilter(): Filter | null {
  try {
    const v = localStorage.getItem(FILTER_KEY)
    return v === 'missed' || v === 'all' ? v : null
  } catch {
    return null
  }
}

function saveFilter(f: Filter) {
  try {
    localStorage.setItem(FILTER_KEY, f)
  } catch {
    /* not remembered */
  }
}

export default function QuizResults({ outcome, summary, newBest, cleared, onRetryMissed, onAgain, onNew }: Props) {
  const { run, reason } = outcome
  const { correct, total, pct, perUnit, missed, graded } = summary
  const v = verdict(pct)
  const instant = run.mode !== 'exam'
  const unanswered = graded.filter((g) => g.pick === null).length
  const [filter, setFilter] = useState<Filter>(() => (missed.length ? (loadFilter() ?? 'missed') : 'all'))
  const heroRef = useRef<HTMLElement>(null)

  useEffect(() => {
    heroRef.current?.focus({ preventScroll: true })
  }, [])

  const ringColor = pct >= 80 ? 'var(--ok)' : pct >= 50 ? 'var(--brand)' : 'var(--warn)'
  const units = (Object.keys(perUnit) as UnitId[]).filter((u) => perUnit[u])
  const items = filter === 'missed' ? missed : graded
  const modeName = run.retry ? 'Retry' : MODE_LABEL[run.mode]

  const note =
    reason === 'timeout'
      ? `Time's up. ${unanswered ? `${unanswered} unanswered ${unanswered === 1 ? 'question counts' : 'questions count'} as missed.` : 'You answered everything just in time.'}`
      : reason === 'ended'
        ? `Ended early. Scored on the ${total} ${total === 1 ? 'question' : 'questions'} you answered out of ${run.questions.length}.`
        : null

  function changeFilter(f: Filter) {
    setFilter(f)
    saveFilter(f)
  }

  return (
    <div className="qz-results">
      <PageHeader
        eyebrow={
          <>
            <Trophy size={14} aria-hidden="true" /> {modeName} results
          </>
        }
        title={v.title}
        subtitle={v.line}
      />

      <motion.section
        ref={heroRef}
        tabIndex={-1}
        className="card qz-hero"
        aria-label={`Score ${pct} percent: ${correct} of ${total} correct`}
        initial={{ opacity: 0, y: 18, scale: 0.985 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={softSpring}
      >
        <div className="qz-hero__ring" style={{ '--qz-ring': ringColor } as CSSProperties}>
          <span className="qz-hero__halo" aria-hidden="true" />
          <ProgressRing value={pct / 100} size={176} stroke={14} color={ringColor} label={`Score ${pct} percent`}>
            <span className="qz-score">
              <span className="qz-score__num">
                <CountUp to={pct} />
                <span className="qz-score__pct">%</span>
              </span>
              <span className="qz-score__sub">
                {correct} of {total}
              </span>
            </span>
          </ProgressRing>
        </div>

        <div className="qz-hero__body">
          {note && (
            <p className={`qz-hero__note${reason === 'timeout' ? ' is-timeout' : ''}`}>
              {reason === 'timeout' ? <Hourglass size={16} aria-hidden="true" /> : <ListChecks size={16} aria-hidden="true" />}
              {note}
            </p>
          )}
          <dl className="qz-stats">
            <div>
              <dt>
                <Check size={14} aria-hidden="true" /> Correct
              </dt>
              <dd>
                {correct}
                <small>/{total}</small>
              </dd>
            </div>
            {instant ? (
              <div>
                <dt>
                  <Flame size={14} aria-hidden="true" /> Best streak
                </dt>
                <dd>{outcome.bestStreak}</dd>
              </div>
            ) : (
              <div>
                <dt>
                  <Hourglass size={14} aria-hidden="true" /> Clock
                </dt>
                <dd>{reason === 'timeout' ? "Time's up" : `${clock(outcome.msLeft ?? 0)} left`}</dd>
              </div>
            )}
            <div>
              <dt>
                <Clock size={14} aria-hidden="true" /> Time
              </dt>
              <dd>{duration(outcome.finishedAt - outcome.startedAt)}</dd>
            </div>
            {cleared !== null && (
              <div>
                <dt>
                  <Sparkles size={14} aria-hidden="true" /> Cleared
                </dt>
                <dd>
                  {cleared}
                  <small>/{run.questions.length}</small>
                </dd>
              </div>
            )}
          </dl>
          <div className="qz-hero__actions">
            {missed.length > 0 && (
              <button type="button" className="btn btn-primary btn-lg" onClick={onRetryMissed}>
                <RotateCcw size={18} aria-hidden="true" />
                Retry {missed.length} missed
              </button>
            )}
            <button
              type="button"
              className={`btn btn-lg${missed.length ? '' : ' btn-primary'}`}
              onClick={onAgain}
              title="Same settings, fresh questions"
            >
              <RefreshCw size={17} aria-hidden="true" />
              Go again
            </button>
            <button type="button" className="btn btn-lg btn-ghost" onClick={onNew}>
              <Plus size={18} aria-hidden="true" />
              New quiz
            </button>
          </div>
        </div>
      </motion.section>

      <div className="qz-results__grid">
        <section className="card card-pad qz-byunit" aria-labelledby="qz-byunit-h">
          <h2 className="qz-h2" id="qz-byunit-h">
            By unit
          </h2>
          <motion.ul className="qz-byunit__list" variants={stagger(0.08, 0.25)} initial="hidden" animate="show">
            {units.map((u, i) => {
              const t = perUnit[u]!
              const p = pctOf(t)
              const weak = p < WEAK_UNIT_PCT
              const unit = getUnit(u)
              const first = slidesOfUnit(u)[0]
              return (
                <motion.li key={u} className={`qz-ur${weak ? ' is-weak' : ''}`} style={unitVars(u)} variants={fadeUp}>
                  <div className="qz-ur__head">
                    <UnitPill unitId={u} />
                    <span className="qz-ur__name">{unit.name}</span>
                    <span className="qz-ur__score">
                      <strong>{p}%</strong> {t.correct}/{t.total}
                    </span>
                  </div>
                  <span className="qz-meter qz-meter--lg" aria-hidden="true">
                    <motion.span
                      className="qz-meter__fill"
                      initial={{ scaleX: 0 }}
                      animate={{ scaleX: p / 100 }}
                      transition={{ ...softSpring, delay: 0.4 + i * 0.08 }}
                    />
                  </span>
                  {(newBest.includes(u) || weak) && (
                    <div className="qz-ur__foot">
                      {newBest.includes(u) && (
                        <span className="qz-badge">
                          <Sparkles size={13} aria-hidden="true" /> New best
                        </span>
                      )}
                      {weak && (
                        <span className="qz-ur__actions">
                          {first && (
                            <Link className="btn btn-sm btn-unit" to={`/learn/${first.id}`}>
                              <BookOpen size={15} aria-hidden="true" />
                              Read {unit.short} notes
                            </Link>
                          )}
                          <Link className="btn btn-sm" to={`/flashcards?unit=${u}`}>
                            <Layers size={15} aria-hidden="true" />
                            Flashcards
                          </Link>
                        </span>
                      )}
                    </div>
                  )}
                </motion.li>
              )
            })}
          </motion.ul>
        </section>

        <section className="card card-pad qz-review" aria-labelledby="qz-review-h">
          <div className="qz-review__head">
            <h2 className="qz-h2" id="qz-review-h">
              Review
            </h2>
            <Seg
              id="review"
              label="Show questions"
              value={filter}
              onChange={changeFilter}
              options={[
                { value: 'missed', label: `Missed ${missed.length}` },
                { value: 'all', label: `All ${graded.length}` },
              ]}
            />
          </div>
          {items.length === 0 ? (
            <motion.p className="qz-empty qz-empty--big" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <Sparkles size={18} aria-hidden="true" /> Nothing missed. Every answer was right.
            </motion.p>
          ) : (
            <ol className="qz-review__list" key={filter}>
              {items.map((g, i) => (
                <ReviewItem key={g.index} g={g} order={i} />
              ))}
            </ol>
          )}
        </section>
      </div>
    </div>
  )
}

function ReviewItem({ g, order }: { g: Graded; order: number }) {
  const { q, pick, correct } = g
  return (
    <motion.li
      className={`qz-ri ${correct ? 'is-ok' : 'is-bad'}`}
      style={unitVars(q.item.unitId)}
      initial={{ opacity: 0, y: 14 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '0px 0px -40px 0px' }}
      transition={{ duration: 0.4, ease: easeOut, delay: Math.min(order, 6) * 0.04 }}
    >
      <div className="qz-ri__meta">
        <span className="qz-ri__icon" aria-hidden="true">
          {correct ? <Check size={14} strokeWidth={3} /> : <X size={14} strokeWidth={3} />}
        </span>
        <span className="qz-ri__num">Question {g.index + 1}</span>
        <UnitPill unitId={q.item.unitId} />
        {q.item.concept && <ConceptTag concept={q.item.concept} />}
        <span className="sr-only">{correct ? 'Correct' : pick === null ? 'Not answered' : 'Incorrect'}</span>
      </div>
      <p className="qz-ri__q">{q.item.question}</p>
      <div className="qz-ri__answers">
        <p className={`qz-ri__ans ${correct ? 'is-ok' : 'is-bad'}`}>
          <span className="qz-ri__label">Your answer</span>
          <span className="qz-ri__text">{pick === null ? <em>Not answered</em> : `${LETTERS[pick]}. ${q.options[pick]}`}</span>
        </p>
        {!correct && (
          <p className="qz-ri__ans is-ok">
            <span className="qz-ri__label">Correct answer</span>
            <span className="qz-ri__text">
              {LETTERS[q.answer]}. {q.options[q.answer]}
            </span>
          </p>
        )}
      </div>
      <p className="qz-ri__why">
        <span className="qz-ri__label">Why</span>
        {q.item.why}
      </p>
      <div className="qz-ri__foot">
        <StudyLink item={q.item} />
      </div>
    </motion.li>
  )
}
