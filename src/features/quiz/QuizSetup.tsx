import { useMemo } from 'react'
import { motion } from 'framer-motion'
import { Check, Crosshair, History, Info, Play, Target, Timer, X } from 'lucide-react'
import PageHeader from '../../components/PageHeader'
import { QUIZ, UNITS, unitVars, type UnitId } from '../../data'
import { useProgress } from '../../lib/progress'
import { fadeUp, softSpring, spring, stagger } from '../../lib/motion'
import { Seg, type SegOption } from './bits'
import {
  ALL_UNITS,
  COUNT_PRESETS,
  MODE_LABEL,
  QUESTIONS_PER_UNIT,
  clock,
  countByUnit,
  effectiveCount,
  examMs,
  poolFor,
  unitsLabel,
  weakItems,
  type Count,
  type Mode,
  type QuizConfig,
} from './engine'
import { enterBelongsToTarget, useHotkeys } from './useHotkeys'

interface Props {
  config: QuizConfig
  notice: string | null
  onChange: (c: QuizConfig) => void
  onStart: (c: QuizConfig) => void
  onDismissNotice: () => void
}

const MODES: { id: Mode; icon: typeof Target; title: string; desc: string }[] = [
  { id: 'practice', icon: Target, title: 'Practice', desc: 'Instant feedback, with the explanation after every answer.' },
  { id: 'exam', icon: Timer, title: 'Exam', desc: '45 seconds a question on the clock. Results only at the end.' },
  { id: 'weak', icon: Crosshair, title: 'Weak spots', desc: 'Only the questions you keep missing or got wrong last time.' },
]

function when(at: number): string {
  const d = new Date(at)
  const now = new Date()
  const time = d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
  const day = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime()
  const diff = Math.round((day(now) - day(d)) / 86_400_000)
  if (diff === 0) return `Today, ${time}`
  if (diff === 1) return `Yesterday, ${time}`
  return `${d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}, ${time}`
}

function tone(pct: number): string {
  return pct >= 80 ? 'is-ok' : pct >= 50 ? 'is-mid' : 'is-low'
}

export default function QuizSetup({ config, notice, onChange, onStart, onDismissNotice }: Props) {
  const progress = useProgress()
  const stats = progress.quizStats
  const weakAll = useMemo(() => weakItems(stats), [stats])
  const weakBy = useMemo(() => countByUnit(weakAll), [weakAll])

  // Weak-spot mode needs something to drill; fall back to practice when there is nothing yet.
  const mode: Mode = config.mode === 'weak' && weakAll.length === 0 ? 'practice' : config.mode
  const effective: QuizConfig = { ...config, mode }
  const pool = poolFor(effective, stats)
  const n = effectiveCount(config.count, pool.length)
  const allOn = config.units.length === ALL_UNITS.length

  const hint =
    config.units.length === 0
      ? 'Pick at least one unit to start.'
      : n === 0
        ? 'No weak spots in these units. Add units or choose another mode.'
        : null
  const sub =
    mode === 'exam'
      ? `${clock(examMs(n))} on the clock · results at the end`
      : mode === 'weak'
        ? 'Most-missed questions first, with explanations.'
        : 'Questions you have seen least come first.'

  const seen = QUIZ.filter((q) => stats[q.id]).length
  const totals = QUIZ.reduce(
    (acc, q) => {
      const s = stats[q.id]
      if (s) {
        acc.right += s.right
        acc.all += s.right + s.wrong
      }
      return acc
    },
    { right: 0, all: 0 },
  )
  const accuracy = totals.all ? Math.round((totals.right / totals.all) * 100) : null
  const recent = progress.quizAttempts.slice(-5).reverse()

  function set(patch: Partial<QuizConfig>) {
    onChange({ ...config, ...patch })
  }

  function toggleUnit(u: UnitId) {
    const on = config.units.includes(u)
    set({ units: ALL_UNITS.filter((x) => (x === u ? !on : config.units.includes(x))) })
  }

  function start() {
    if (n > 0) onStart(effective)
  }

  useHotkeys((e) => {
    if (e.key !== 'Enter' || e.repeat || enterBelongsToTarget(e)) return
    e.preventDefault()
    start()
  })

  const counts: Count[] = [...COUNT_PRESETS]
  if (typeof config.count === 'number' && !counts.includes(config.count)) counts.push(config.count)
  counts.sort((a, b) => Number(a) - Number(b))
  counts.push('all')
  const countOptions: SegOption<Count>[] = counts.map((c) => ({
    value: c,
    label: c === 'all' ? `All ${pool.length}` : String(c),
  }))

  return (
    <>
      <PageHeader
        eyebrow={`Quiz · ${QUIZ.length} questions · ${UNITS.length} units`}
        title={
          <>
            Get <span className="gradient-text">quiz-ready</span>
          </>
        }
        subtitle="Practise with an explanation after every answer, sit a timed exam, or drill the questions you keep missing."
      />

      {notice && (
        <motion.div className="qz-notice" role="status" initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}>
          <Info size={18} aria-hidden="true" />
          <p>{notice}</p>
          <button type="button" className="btn btn-ghost btn-icon btn-sm" onClick={onDismissNotice} aria-label="Dismiss">
            <X size={16} aria-hidden="true" />
          </button>
        </motion.div>
      )}

      <div className="qz-setup">
        <motion.div className="card qz-panel" variants={stagger(0.07, 0.05)} initial="hidden" animate="show">
          <motion.section className="qz-sec" variants={fadeUp} aria-labelledby="qz-units-h">
            <div className="qz-sec__head">
              <h2 className="qz-sec__title" id="qz-units-h">
                <span className="qz-sec__num">1</span> Units
              </h2>
              <button type="button" className="chip" aria-pressed={allOn} onClick={() => set({ units: allOn ? [] : ALL_UNITS })}>
                {allOn && <Check size={14} strokeWidth={3} aria-hidden="true" />}
                All units
                <span className="qz-chip-count">{mode === 'weak' ? weakAll.length : QUIZ.length}</span>
              </button>
            </div>
            <div className="qz-unit-grid">
              {UNITS.map((u) => {
                const on = config.units.includes(u.id)
                const count = mode === 'weak' ? weakBy[u.id] : QUESTIONS_PER_UNIT[u.id]
                return (
                  <motion.button
                    key={u.id}
                    type="button"
                    className={`qz-unit${mode === 'weak' && count === 0 ? ' is-empty' : ''}`}
                    style={unitVars(u.id)}
                    aria-pressed={on}
                    aria-label={`${u.short}, ${u.name}: ${count} ${mode === 'weak' ? 'weak spots' : 'questions'}`}
                    onClick={() => toggleUnit(u.id)}
                    whileTap={{ scale: 0.97 }}
                    transition={spring}
                  >
                    <span className="qz-unit__top">
                      <span className="qz-unit__short">{u.short}</span>
                      <span className="qz-unit__count">
                        {count}
                        <small>{mode === 'weak' ? ' weak' : ' Qs'}</small>
                      </span>
                    </span>
                    <span className="qz-unit__name">{u.name}</span>
                    <span className="qz-unit__check" aria-hidden="true">
                      {on && (
                        <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} transition={spring}>
                          <Check size={13} strokeWidth={3.2} />
                        </motion.span>
                      )}
                    </span>
                  </motion.button>
                )
              })}
            </div>
          </motion.section>

          <motion.section className="qz-sec" variants={fadeUp} aria-labelledby="qz-count-h">
            <div className="qz-sec__head">
              <h2 className="qz-sec__title" id="qz-count-h">
                <span className="qz-sec__num">2</span> Questions
              </h2>
            </div>
            <Seg id="count" label="Number of questions" value={config.count} options={countOptions} onChange={(count) => set({ count })} />
          </motion.section>

          <motion.section className="qz-sec" variants={fadeUp} aria-labelledby="qz-mode-h">
            <div className="qz-sec__head">
              <h2 className="qz-sec__title" id="qz-mode-h">
                <span className="qz-sec__num">3</span> Mode
              </h2>
            </div>
            <div className="qz-modes" role="group" aria-labelledby="qz-mode-h">
              {MODES.map((m) => {
                const on = mode === m.id
                const disabled = m.id === 'weak' && weakAll.length === 0
                const meta =
                  m.id === 'exam'
                    ? `${clock(examMs(n))} for ${n} ${n === 1 ? 'question' : 'questions'}`
                    : m.id === 'weak'
                      ? disabled
                        ? 'Nothing yet. Questions you miss land here.'
                        : `${weakAll.length} to review`
                      : 'Learn as you go'
                const Icon = m.icon
                return (
                  <motion.button
                    key={m.id}
                    type="button"
                    className={`qz-mode-card is-${m.id}`}
                    aria-pressed={on}
                    aria-disabled={disabled || undefined}
                    onClick={() => !disabled && set({ mode: m.id })}
                    whileTap={disabled ? undefined : { scale: 0.98 }}
                    transition={spring}
                  >
                    {on && <motion.span layoutId="qz-mode-active" className="qz-mode-card__ring" transition={spring} aria-hidden="true" />}
                    <span className="qz-mode-card__icon" aria-hidden="true">
                      <Icon size={20} />
                    </span>
                    <span className="qz-mode-card__text">
                      <span className="qz-mode-card__title">{m.title}</span>
                      <span className="qz-mode-card__desc">{m.desc}</span>
                      <span className="qz-mode-card__meta">{meta}</span>
                    </span>
                  </motion.button>
                )
              })}
            </div>
          </motion.section>

          <motion.div className="qz-start" variants={fadeUp}>
            <div className="qz-start__summary" aria-live="polite">
              <p className="qz-start__main">
                <strong>
                  {n} {n === 1 ? 'question' : 'questions'}
                </strong>
                <span className="qz-dot-sep">·</span>
                {config.units.length ? unitsLabel(config.units) : 'No units'}
                <span className="qz-dot-sep">·</span>
                {MODE_LABEL[mode]}
              </p>
              <p className={`qz-start__sub${hint ? ' is-hint' : ''}`}>{hint ?? sub}</p>
            </div>
            <div className="qz-start__go">
              <span className="qz-keys qz-hide-touch" aria-hidden="true">
                <span className="kbd">Enter</span>
              </span>
              <button type="button" className="btn btn-primary btn-lg qz-start__btn" onClick={start} disabled={n === 0}>
                <Play size={18} fill="currentColor" aria-hidden="true" />
                Start quiz
              </button>
            </div>
          </motion.div>
        </motion.div>

        <motion.aside
          className="card card-pad qz-side"
          aria-labelledby="qz-hist-h"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ...softSpring, delay: 0.15 }}
        >
          <h2 className="qz-h2" id="qz-hist-h">
            <History size={18} aria-hidden="true" /> Your record
          </h2>
          <dl className="qz-kpis">
            <div>
              <dt>Seen</dt>
              <dd>
                {seen}
                <small>/{QUIZ.length}</small>
              </dd>
            </div>
            <div>
              <dt>Accuracy</dt>
              <dd>{accuracy === null ? '–' : `${accuracy}%`}</dd>
            </div>
            <div>
              <dt>Weak spots</dt>
              <dd>{weakAll.length}</dd>
            </div>
          </dl>

          <h3 className="qz-h3">Recent attempts</h3>
          {recent.length ? (
            <ol className="qz-attempts">
              {recent.map((a, i) => {
                const pct = a.total ? Math.round((a.correct / a.total) * 100) : 0
                return (
                  <motion.li
                    key={`${a.at}-${i}`}
                    className="qz-attempt"
                    initial={{ opacity: 0, x: 12 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ ...softSpring, delay: 0.2 + i * 0.05 }}
                  >
                    <span className={`qz-attempt__pct ${tone(pct)}`}>{pct}%</span>
                    <span className="qz-attempt__body">
                      <span className="qz-attempt__score">
                        {a.correct}/{a.total} correct
                      </span>
                      <span className="qz-attempt__meta">
                        {when(a.at)} · {a.units.length ? unitsLabel(a.units) : 'Mixed'}
                      </span>
                    </span>
                    <span className="qz-attempt__dots" aria-hidden="true">
                      {a.units.map((u) => (
                        <span key={u} className="qz-dot" style={unitVars(u)} />
                      ))}
                    </span>
                  </motion.li>
                )
              })}
            </ol>
          ) : (
            <p className="qz-empty">No quizzes yet. Your last five scores will show up here.</p>
          )}

          <h3 className="qz-h3">Best score by unit</h3>
          <ul className="qz-best">
            {UNITS.map((u, i) => {
              const best = progress.quizBest[u.id]
              return (
                <li key={u.id} className="qz-best__row" style={unitVars(u.id)} title={u.name}>
                  <span className="qz-best__label" aria-hidden="true">
                    {u.short}
                  </span>
                  <span className="qz-meter" aria-hidden="true">
                    <motion.span
                      className="qz-meter__fill"
                      initial={{ scaleX: 0 }}
                      animate={{ scaleX: (best ?? 0) / 100 }}
                      transition={{ ...softSpring, delay: 0.25 + i * 0.06 }}
                    />
                  </span>
                  <span className="qz-best__val" aria-hidden="true">
                    {best === undefined ? '–' : `${best}%`}
                  </span>
                  <span className="sr-only">{best === undefined ? `${u.short}: no score yet` : `${u.short}: best ${best}%`}</span>
                </li>
              )
            })}
          </ul>
        </motion.aside>
      </div>
    </>
  )
}
