import { AnimatePresence, motion } from 'framer-motion'
import { Clock, Layers, Shuffle } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import PageHeader from '../../components/PageHeader'
import { UNITS, unitVars, type UnitId } from '../../data'
import { easeOut } from '../../lib/motion'
import { useProgress } from '../../lib/progress'
import Count from './Count'
import DeckSession from './DeckSession'
import EmptyDeck from './EmptyDeck'
import LeitnerPanel from './LeitnerPanel'
import {
  KIND_FILTERS,
  KIND_META,
  MODES,
  MODE_KEY,
  SIZES,
  SIZE_KEY,
  deckStats,
  filterDeck,
  parseKind,
  parseUnit,
  quizHref,
  readPref,
  releaseMouseFocus,
  writePref,
  type KindFilter,
  type Mode,
  type SessionSize,
  type UnitFilter,
} from './deck'
import './flashcards.css'

/** Wall clock that ticks every `ms` and when the tab becomes visible again, so "due" counts stay current. */
function useNow(ms: number) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const tick = () => setNow(Date.now())
    const id = window.setInterval(tick, ms)
    const onVisible = () => {
      if (document.visibilityState === 'visible') tick()
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      window.clearInterval(id)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [ms])
  return now
}

const UNIT_FILTERS: UnitFilter[] = ['all', ...UNITS.map((u) => u.id)]

export default function FlashcardsPage() {
  const [params, setParams] = useSearchParams()
  const unit = parseUnit(params.get('unit'))
  const kind = parseKind(params.get('kind'))
  const [mode, setModeState] = useState<Mode>(() => readPref(MODE_KEY, MODES, 'due'))
  const [size, setSizeState] = useState<SessionSize>(() => readPref(SIZE_KEY, SIZES, '20'))
  const [round, setRound] = useState(0)
  const [retry, setRetry] = useState<{ base: string; ids: string[] } | null>(null)
  const progress = useProgress()
  const tick = useNow(30_000)

  const deck = useMemo(() => filterDeck(unit, kind), [unit, kind])
  // Re-read the clock whenever progress changes (a fresh grade) or the timer ticks.
  const now = useMemo(() => Math.max(tick, Date.now()), [tick, progress])
  const stats = useMemo(() => deckStats(deck, progress.cards, now), [deck, progress.cards, now])

  const unitCounts = useMemo(() => {
    const out = {} as Record<UnitFilter, number>
    for (const u of UNIT_FILTERS) {
      const st = deckStats(filterDeck(u, kind), progress.cards, now)
      out[u] = mode === 'due' ? st.due : st.total
    }
    return out
  }, [kind, mode, progress.cards, now])

  const kindCounts = useMemo(() => {
    const out = {} as Record<KindFilter, number>
    for (const k of KIND_FILTERS) {
      const st = deckStats(filterDeck(unit, k), progress.cards, now)
      out[k] = mode === 'due' ? st.due : st.total
    }
    return out
  }, [unit, mode, progress.cards, now])

  const base = `${unit}|${kind}|${mode}|${size}`
  const retryIds = retry && retry.base === base ? retry.ids : null
  useEffect(() => {
    if (retry && retry.base !== base) setRetry(null)
  }, [retry, base])

  // The URL is the source of truth for unit and kind; "All" removes the param.
  const setFilter = (next: { unit?: UnitFilter; kind?: KindFilter }) => {
    setRetry(null)
    setParams(
      (prev) => {
        const p = new URLSearchParams(prev)
        if (next.unit !== undefined) {
          if (next.unit === 'all') p.delete('unit')
          else p.set('unit', next.unit)
        }
        if (next.kind !== undefined) {
          if (next.kind === 'all') p.delete('kind')
          else p.set('kind', next.kind)
        }
        return p
      },
      { replace: true },
    )
  }
  const setMode = (m: Mode) => {
    setRetry(null)
    setModeState(m)
    writePref(MODE_KEY, m)
  }
  const setSize = (v: SessionSize) => {
    setRetry(null)
    setSizeState(v)
    writePref(SIZE_KEY, v)
  }
  const studyAgain = () => {
    setRetry(null)
    setRound((r) => r + 1)
  }
  const reviewMissed = (ids: string[]) => {
    setRetry({ base, ids })
    setRound((r) => r + 1)
  }

  const label = retryIds ? 'Missed cards' : mode === 'due' ? 'Due now' : 'Shuffled'
  const suggestions = UNITS.filter((u) => u.id !== unit && unitCounts[u.id] > 0).map((u) => ({ unitId: u.id as UnitId, due: unitCounts[u.id] }))

  const empty =
    deck.length === 0 ? (
      <EmptyDeck
        variant="none"
        unit={unit}
        kind={kind}
        onAllKinds={() => setFilter({ kind: 'all' })}
        onAllUnits={() => setFilter({ unit: 'all' })}
      />
    ) : (
      <EmptyDeck
        variant="caught-up"
        now={now}
        nextDue={stats.nextDue}
        dueNow={stats.due}
        suggestions={mode === 'due' ? suggestions : []}
        onStart={studyAgain}
        onStudyAll={() => setMode('all')}
        onPickUnit={(u) => setFilter({ unit: u })}
      />
    )

  return (
    <div className="page fc-page">
      <PageHeader
        eyebrow={
          <>
            <Layers size={14} aria-hidden /> Spaced repetition
          </>
        }
        title="Flashcards"
        subtitle="Recall first, then flip and grade yourself honestly. Cards you know come back less often; the ones you miss come straight back."
      />

      <div className="fc-shell" style={unit === 'all' ? undefined : unitVars(unit)}>
        <div className="fc-clip">
          <motion.section
            className="card fc-controls"
            aria-label="Choose a deck"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, ease: easeOut, delay: 0.06 }}
          >
            <div className="fc-filters">
              <div className="fc-field">
                <span className="fc-label" id="fc-unit-label">
                  Unit
                </span>
                <div className="fc-chips" role="group" aria-labelledby="fc-unit-label">
                  <button
                    type="button"
                    className="chip"
                    aria-pressed={unit === 'all'}
                    onClick={(e) => {
                      releaseMouseFocus(e)
                      setFilter({ unit: 'all' })
                    }}
                  >
                    All units <span className="fc-chip-n">{unitCounts.all}</span>
                  </button>
                  {UNITS.map((u) => (
                    <button
                      key={u.id}
                      type="button"
                      className="chip"
                      style={unitVars(u.id)}
                      aria-pressed={unit === u.id}
                      title={u.name}
                      aria-label={`${u.short}: ${u.name}, ${unitCounts[u.id]} ${mode === 'due' ? 'due' : 'cards'}`}
                      onClick={(e) => {
                        releaseMouseFocus(e)
                        setFilter({ unit: u.id })
                      }}
                    >
                      <span className="fc-dot" aria-hidden />
                      {u.short}
                      <span className="fc-chip-n" aria-hidden>
                        {unitCounts[u.id]}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="fc-row">
                <div className="fc-field">
                  <span className="fc-label" id="fc-kind-label">
                    Card type
                  </span>
                  <div className="segmented fc-seg" role="group" aria-labelledby="fc-kind-label">
                    {KIND_FILTERS.map((k) => (
                      <button
                        key={k}
                        type="button"
                        aria-pressed={kind === k}
                        onClick={(e) => {
                          releaseMouseFocus(e)
                          setFilter({ kind: k })
                        }}
                      >
                        {k === 'all' ? (
                          'All'
                        ) : (
                          <>
                            <span className="fc-long">{KIND_META[k].plural}</span>
                            <span className="fc-short">{KIND_META[k].short}</span>
                          </>
                        )}
                        <span className="fc-seg-n">{kindCounts[k]}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="fc-field">
                  <span className="fc-label" id="fc-mode-label">
                    Mode
                  </span>
                  <div className="segmented fc-seg" role="group" aria-labelledby="fc-mode-label">
                    <button
                      type="button"
                      aria-pressed={mode === 'due'}
                      onClick={(e) => {
                        releaseMouseFocus(e)
                        setMode('due')
                      }}
                    >
                      <Clock size={14} aria-hidden /> Due now
                    </button>
                    <button
                      type="button"
                      aria-pressed={mode === 'all'}
                      onClick={(e) => {
                        releaseMouseFocus(e)
                        setMode('all')
                      }}
                    >
                      <Shuffle size={14} aria-hidden /> All, shuffled
                    </button>
                  </div>
                </div>

                <div className="fc-field">
                  <span className="fc-label" id="fc-size-label">
                    Per session
                  </span>
                  <div className="segmented fc-seg" role="group" aria-labelledby="fc-size-label">
                    {SIZES.map((v) => (
                      <button
                        key={v}
                        type="button"
                        aria-pressed={size === v}
                        onClick={(e) => {
                          releaseMouseFocus(e)
                          setSize(v)
                        }}
                      >
                        {v === 'all' ? 'All' : v}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <dl className="fc-stats" aria-label="This deck">
              <div className="fc-stat fc-stat--due">
                <dt>Due now</dt>
                <dd>
                  <Count value={stats.due} className="fc-stat__n" />
                  <span className="fc-stat__sub">
                    {stats.review} review · {stats.fresh} new
                  </span>
                </dd>
              </div>
              <div className="fc-stat">
                <dt>New</dt>
                <dd>
                  <Count value={stats.fresh} className="fc-stat__n" />
                  <span className="fc-stat__sub">never seen</span>
                </dd>
              </div>
              <div className="fc-stat">
                <dt>Mastered</dt>
                <dd>
                  <Count value={stats.mastered} className="fc-stat__n" />
                  <span className="fc-stat__sub">of {stats.total} cards</span>
                </dd>
              </div>
            </dl>
          </motion.section>

          <div className="fc-grid">
            <div className="fc-main">
              <AnimatePresence mode="wait" initial={false}>
                <motion.div
                  key={`${base}|${round}`}
                  initial={{ opacity: 0, y: 14 }}
                  animate={{ opacity: 1, y: 0, transition: { duration: 0.32, ease: easeOut } }}
                  exit={{ opacity: 0, y: -8, transition: { duration: 0.16, ease: easeOut } }}
                >
                  <DeckSession
                    deck={deck}
                    mode={mode}
                    size={size}
                    customIds={retryIds}
                    label={label}
                    quizHref={quizHref(unit)}
                    dueNow={stats.due}
                    empty={empty}
                    onStudyAgain={studyAgain}
                    onReviewMissed={reviewMissed}
                  />
                </motion.div>
              </AnimatePresence>
            </div>
            <aside className="fc-side" aria-label="Leitner boxes">
              <LeitnerPanel stats={stats} />
            </aside>
          </div>
        </div>
      </div>
    </div>
  )
}
