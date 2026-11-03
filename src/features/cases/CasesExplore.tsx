import { AnimatePresence, motion, type Variants } from 'framer-motion'
import { ArrowRight, BookOpen, Brain, Eye, EyeOff, Layers, Search, SearchX, X } from 'lucide-react'
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import UnitPill from '../../components/UnitPill'
import { CASES, getUnit, unitVars, type CaseItem, type UnitId } from '../../data'
import { easeOut, spring } from '../../lib/motion'
import { matchesQuery, plural } from '../../lib/text'
import { CaseCite, CaseName, Highlight } from './CaseName'
import { highlightHtml, metaOf, queryRegex, splitPartTitle } from './caseText'
import UnitFilter from './UnitFilter'
import { loadPref, savePref, shouldIgnoreKey } from './util'

const RECALL_KEY = 'taxlaw-cases-recall'
const STAGGER_MAX = 20

interface Group {
  key: string
  part: string
  items: CaseItem[]
}

interface UnitBlock {
  unitId: UnitId
  count: number
  groups: Group[]
}

/** CASES is ordered by unit and then by topic, so consecutive runs form the groups. */
function groupCases(items: CaseItem[]): UnitBlock[] {
  const blocks: UnitBlock[] = []
  for (const c of items) {
    let b = blocks[blocks.length - 1]
    if (!b || b.unitId !== c.unitId) {
      b = { unitId: c.unitId, count: 0, groups: [] }
      blocks.push(b)
    }
    let g = b.groups[b.groups.length - 1]
    if (!g || g.part !== c.part) {
      g = { key: `${c.unitId}:${c.part}`, part: c.part, items: [] }
      b.groups.push(g)
    }
    g.items.push(c)
    b.count++
  }
  return blocks
}

interface Props {
  unit: UnitId | null
  onUnit: (unit: UnitId | null) => void
}

export default function CasesExplore({ unit, onUnit }: Props) {
  const [params, setParams] = useSearchParams()
  const urlQ = params.get('q') ?? ''
  const [input, setInput] = useState(urlQ)
  const [query, setQuery] = useState(urlQ)
  const written = useRef(urlQ.trim())
  const inputRef = useRef<HTMLInputElement>(null)

  // Debounce typing into the query that drives filtering, highlighting and the URL.
  useEffect(() => {
    if (input === query) return
    const t = window.setTimeout(() => setQuery(input), 200)
    return () => window.clearTimeout(t)
  }, [input, query])

  // Mirror the query into ?q= (replace, so typing does not fill the history).
  useEffect(() => {
    const q = query.trim()
    if (q === written.current) return
    written.current = q
    setParams(
      (prev) => {
        const p = new URLSearchParams(prev)
        if (q) p.set('q', q)
        else p.delete('q')
        return p
      },
      { replace: true },
    )
  }, [query, setParams])

  // Follow ?q= when it changes from outside (a link to /cases?q=… while this view is open).
  useEffect(() => {
    if (urlQ.trim() === written.current) return
    written.current = urlQ.trim()
    setInput(urlQ)
    setQuery(urlQ)
  }, [urlQ])

  // "/" focuses the search box.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== '/' || shouldIgnoreKey(e)) return
      e.preventDefault()
      inputRef.current?.focus()
      inputRef.current?.select()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const clearSearch = () => {
    setInput('')
    setQuery('')
    inputRef.current?.focus()
  }

  /* ---------- recall mode ---------- */

  const [recall, setRecall] = useState(() => loadPref(RECALL_KEY, false))
  const [revealed, setRevealed] = useState<ReadonlySet<string>>(() => new Set())
  /** The card the user flipped last; only it gets the flap animation (bulk changes just fade). */
  const [flipped, setFlipped] = useState<string | null>(null)

  const toggleRecall = () => {
    const next = !recall
    setRecall(next)
    savePref(RECALL_KEY, next)
    setRevealed(new Set())
    setFlipped(null)
  }

  const toggleCard = useCallback((id: string) => {
    setFlipped(id)
    setRevealed((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  /* ---------- results ---------- */

  const re = useMemo(() => queryRegex(query), [query])
  const matching = useMemo(() => CASES.filter((c) => matchesQuery(metaOf(c).haystack, query)), [query])
  const counts = useMemo(() => {
    const m: Partial<Record<UnitId, number>> = {}
    for (const c of matching) m[c.unitId] = (m[c.unitId] ?? 0) + 1
    return m
  }, [matching])
  const results = useMemo(() => (unit ? matching.filter((c) => c.unitId === unit) : matching), [matching, unit])
  const blocks = useMemo(() => groupCases(results), [results])
  const revealedCount = recall ? results.filter((c) => revealed.has(c.id)).length : 0

  const revealAll = () => {
    setFlipped(null)
    setRevealed(new Set(results.map((c) => c.id)))
  }
  const coverAll = () => {
    setFlipped(null)
    setRevealed(new Set())
  }

  const q = query.trim()
  const scope = unit ? getUnit(unit) : null
  const countLine = q
    ? `${plural(results.length, 'case')} ${results.length === 1 ? 'matches' : 'match'} “${q}”${scope ? ` in ${scope.short}` : ''}`
    : scope
      ? `${plural(results.length, 'case')} in ${scope.short} · ${scope.name}`
      : `All ${CASES.length} cases from the notes, by unit and topic`

  return (
    <div className="cs-explore">
      <div className="cs-controls">
        <div className="cs-toolbar">
          <div className="cs-search">
            <label htmlFor="cs-search-input" className="sr-only">
              Search cases
            </label>
            <Search className="cs-search__icon" size={18} aria-hidden="true" />
            <input
              ref={inputRef}
              id="cs-search-input"
              className="input cs-search__input"
              type="search"
              value={input}
              placeholder="Search names, citations, topics, holdings…"
              autoComplete="off"
              spellCheck={false}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Escape') {
                  if (input) {
                    e.preventDefault()
                    clearSearch()
                  } else e.currentTarget.blur()
                } else if (e.key === 'Enter') setQuery(input)
              }}
            />
            {input ? (
              <button type="button" className="cs-search__clear" aria-label="Clear search" onClick={clearSearch}>
                <X size={16} />
              </button>
            ) : (
              <span className="kbd cs-search__kbd" aria-hidden="true">
                /
              </span>
            )}
          </div>

          <button type="button" role="switch" aria-checked={recall} className={`cs-recall${recall ? ' is-on' : ''}`} onClick={toggleRecall}>
            <span className="cs-recall__track" aria-hidden="true">
              <motion.span className="cs-recall__thumb" animate={{ x: recall ? 16 : 0 }} transition={spring} />
            </span>
            {recall ? <EyeOff size={16} aria-hidden="true" /> : <Eye size={16} aria-hidden="true" />}
            Recall mode
          </button>
        </div>

        <UnitFilter unit={unit} onChange={onUnit} counts={counts} total={matching.length} />

        <p className="cs-count" aria-live="polite">
          {countLine}
        </p>
      </div>

      {recall && (
        <motion.div
          className="cs-recallbar"
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, ease: easeOut }}
        >
          <span className="cs-recallbar__icon" aria-hidden="true">
            <Brain size={20} />
          </span>
          <p className="cs-recallbar__text">
            <strong>Holdings are covered.</strong> Read the case name, say what was held, then tap the card to check yourself.
          </p>
          <span className="cs-recallbar__count" aria-live="polite">
            {revealedCount} of {results.length} revealed
          </span>
          <div className="cs-recallbar__actions">
            <button type="button" className="btn btn-sm" onClick={revealAll} disabled={revealedCount === results.length}>
              <Eye size={15} aria-hidden="true" /> Reveal all
            </button>
            <button type="button" className="btn btn-sm btn-ghost" onClick={coverAll} disabled={revealedCount === 0}>
              <EyeOff size={15} aria-hidden="true" /> Cover all
            </button>
          </div>
        </motion.div>
      )}

      {results.length === 0 ? (
        <EmptyState query={q} unit={unit} onClear={clearSearch} onAllUnits={() => onUnit(null)} />
      ) : (
        <CaseList key={unit ?? 'all'} blocks={blocks} re={re} recall={recall} revealed={revealed} flipped={flipped} onToggle={toggleCard} />
      )}
    </div>
  )
}

/* ---------- list ---------- */

interface ListProps {
  blocks: UnitBlock[]
  re: RegExp | null
  recall: boolean
  revealed: ReadonlySet<string>
  flipped: string | null
  onToggle: (id: string) => void
}

/** Keyed by the unit filter, so switching units replays the entrance; typing does not. */
function CaseList({ blocks, re, recall, revealed, flipped, onToggle }: ListProps) {
  const [entered, setEntered] = useState(false)
  useEffect(() => setEntered(true), [])

  let n = 0
  return (
    <div className="cs-list">
      {blocks.map((b) => {
        const u = getUnit(b.unitId)
        const firstIndex = n
        return (
          <section key={b.unitId} className="cs-unit" style={unitVars(b.unitId)} aria-labelledby={`cs-unit-${b.unitId}`}>
            <motion.header
              className="cs-unit__head"
              initial={entered ? false : { opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45, ease: easeOut, delay: Math.min(firstIndex, STAGGER_MAX) * 0.035 }}
            >
              <span className="cs-unit__badge" aria-hidden="true">
                {u.short.replace(/^Unit\s+/, '')}
              </span>
              <div className="cs-unit__text">
                <p className="cs-unit__eyebrow">
                  {u.short} · {plural(b.count, 'case')}
                </p>
                <h2 className="cs-unit__title" id={`cs-unit-${b.unitId}`}>
                  {u.name}
                </h2>
              </div>
              <Link className="btn btn-sm cs-unit__link" to={`/flashcards?unit=${b.unitId}&kind=case`}>
                <Layers size={15} aria-hidden="true" /> Case flashcards
              </Link>
            </motion.header>

            {b.groups.map((g) => {
              const { num, title } = splitPartTitle(g.part)
              return (
                <section key={g.key} className="cs-part" aria-label={`${u.short}: ${g.part}`}>
                  <h3 className="cs-part__head">
                    <UnitPill unitId={b.unitId} />
                    {num && (
                      <span className="cs-part__num" aria-hidden="true">
                        {num}
                      </span>
                    )}
                    <span className="cs-part__title">
                      <Highlight text={title} re={re} />
                    </span>
                    <span className="cs-part__count" aria-label={plural(g.items.length, 'case')}>
                      {g.items.length}
                    </span>
                  </h3>
                  <div className="cs-part__list">
                    {g.items.map((c) => {
                      const i = n++
                      return (
                        <CaseCard
                          key={c.id}
                          c={c}
                          re={re}
                          recall={recall}
                          open={revealed.has(c.id)}
                          flap={flipped === c.id}
                          onToggle={onToggle}
                          delay={!entered && i < STAGGER_MAX ? i * 0.035 : null}
                        />
                      )
                    })}
                  </div>
                </section>
              )
            })}
          </section>
        )
      })}
    </div>
  )
}

/* ---------- card ---------- */

/* The cover lifts away like a flap when the user flips one card; bulk reveal/cover and reduced motion just fade. */
const coverVariants: Variants = {
  enter: (flap: boolean) => (flap ? { opacity: 0, rotateX: -92 } : { opacity: 0, rotateX: 0 }),
  show: { opacity: 1, rotateX: 0, transition: { type: 'spring', stiffness: 260, damping: 24 } },
  exit: (flap: boolean) =>
    flap
      ? { opacity: 0, rotateX: -92, transition: { duration: 0.45, ease: easeOut } }
      : { opacity: 0, transition: { duration: 0.2, ease: easeOut } },
}

interface CardProps {
  c: CaseItem
  re: RegExp | null
  recall: boolean
  open: boolean
  flap: boolean
  onToggle: (id: string) => void
  /** Entrance delay in seconds, or null for a quick fade with no stagger. */
  delay: number | null
}

const CaseCard = memo(function CaseCard({ c, re, recall, open, flap, onToggle, delay }: CardProps) {
  const meta = metaOf(c)
  const covered = recall && !open
  const held = useMemo(() => highlightHtml(c.held, re), [c.held, re])
  const heldId = `cs-held-${c.id}`

  // The button the user pressed disappears as the card flips, so hand focus to its counterpart.
  const focusTo = useRef<'cover' | 'recover' | null>(null)
  const takeFocus = (which: 'cover' | 'recover') => (el: HTMLButtonElement | null) => {
    if (el && focusTo.current === which) {
      focusTo.current = null
      el.focus({ preventScroll: true })
    }
  }
  const flip = (next: 'cover' | 'recover') => {
    focusTo.current = next
    onToggle(c.id)
  }

  return (
    <motion.article
      className="cs-card"
      style={unitVars(c.unitId)}
      initial={delay === null ? { opacity: 0 } : { opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={delay === null ? { duration: 0.22, ease: easeOut } : { duration: 0.5, ease: easeOut, delay }}
    >
      <div className="cs-card__head">
        <h4 className="cs-card__name">
          <CaseName meta={meta} re={re} />
        </h4>
        <CaseCite meta={meta} re={re} />
        <div className="cs-card__meta">
          <UnitPill unitId={c.unitId} />
          <span className="cs-card__part">{c.part}</span>
        </div>
      </div>

      <div className="cs-card__body">
        <div
          id={heldId}
          className="notes cs-held"
          aria-hidden={covered || undefined}
          inert={covered}
          dangerouslySetInnerHTML={{ __html: held }}
        />
        <AnimatePresence initial={false} custom={flap}>
          {covered && (
            <motion.button
              key="cover"
              ref={takeFocus('cover')}
              type="button"
              className="cs-cover"
              custom={flap}
              variants={coverVariants}
              initial="enter"
              animate="show"
              exit="exit"
              aria-expanded={false}
              aria-controls={heldId}
              aria-label={`Reveal what was held in ${meta.shortName}`}
              onClick={() => flip('recover')}
            >
              <span className="cs-cover__icon" aria-hidden="true">
                <Eye size={18} />
              </span>
              <span className="cs-cover__text" aria-hidden="true">
                <span className="cs-cover__title">What was held?</span>
                <span className="cs-cover__hint">Recall it, then tap to check</span>
              </span>
            </motion.button>
          )}
        </AnimatePresence>
      </div>

      <div className="cs-card__foot">
        <Link className="cs-link" to={`/learn/${c.slideId}`}>
          <BookOpen size={15} aria-hidden="true" /> Read in notes <ArrowRight className="cs-link__arrow" size={14} aria-hidden="true" />
        </Link>
        {recall && open && (
          <button
            ref={takeFocus('recover')}
            type="button"
            className="btn btn-ghost btn-sm cs-recover"
            aria-controls={heldId}
            aria-expanded
            onClick={() => flip('cover')}
          >
            <EyeOff size={15} aria-hidden="true" /> Cover
          </button>
        )}
      </div>
    </motion.article>
  )
})

/* ---------- empty ---------- */

function EmptyState({ query, unit, onClear, onAllUnits }: { query: string; unit: UnitId | null; onClear: () => void; onAllUnits: () => void }) {
  return (
    <motion.div
      className="cs-empty"
      role="status"
      initial={{ opacity: 0, scale: 0.97 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.35, ease: easeOut }}
    >
      <span className="cs-empty__icon" aria-hidden="true">
        <SearchX size={28} />
      </span>
      <h2 className="cs-empty__title">{query ? `No cases match “${query}”` : 'No cases here'}</h2>
      <p className="cs-empty__text">
        {unit
          ? `Nothing in ${getUnit(unit).short} matches. Try fewer words, or search every unit.`
          : 'Try fewer or shorter words: a party name, a year, part of a citation, or a topic.'}
      </p>
      <div className="cs-empty__actions">
        {query && (
          <button type="button" className="btn btn-primary" onClick={onClear}>
            <X size={16} aria-hidden="true" /> Clear search
          </button>
        )}
        {unit && (
          <button type="button" className="btn" onClick={onAllUnits}>
            Search all units
          </button>
        )}
      </div>
    </motion.div>
  )
}
