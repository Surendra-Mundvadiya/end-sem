import { useId, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { ArrowRight, BookOpen, SearchX } from 'lucide-react'
import UnitPill from '../../components/UnitPill'
import { slideById, unitVars } from '../../data'
import { easeOut } from '../../lib/motion'
import { plural } from '../../lib/text'
import { glossaryRows, type GlossaryRow } from './content'
import Rich from './Rich'
import SearchBox from './SearchBox'
import { markRegex, parseQuery, wordsMatch } from './search'

const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')

function GlossaryItem({ row, mark }: { row: GlossaryRow; mark: RegExp | null }) {
  const slide = slideById(row.slideId)
  return (
    <div className="ref-gloss__item" style={slide ? unitVars(slide.unitId) : undefined}>
      <dt className="ref-gloss__term">
        <Rich text={row.term} mark={mark} />
      </dt>
      <dd className="ref-gloss__def">
        {row.defIsHtml ? <span dangerouslySetInnerHTML={{ __html: row.def }} /> : <Rich text={row.defText} mark={mark} />}
      </dd>
      {slide && (
        <dd className="ref-gloss__more">
          <Link to={`/learn/${slide.id}`} className="ref-gloss__link">
            <BookOpen size={15} aria-hidden="true" />
            <span>
              <span className="sr-only">Read about {row.term} in the notes: </span>
              {slide.title}
            </span>
            <ArrowRight size={14} aria-hidden="true" className="ref-gloss__arrow" />
          </Link>
          <UnitPill unitId={slide.unitId} />
        </dd>
      )}
    </div>
  )
}

/** Every defined term, A to Z: search, jump to a letter, and open the slide that teaches it. */
export default function GlossaryPanel({ initialQuery = '' }: { initialQuery?: string }) {
  const [q, setQ] = useState(initialQuery)
  const query = useMemo(() => parseQuery(q), [q])
  const mark = useMemo(() => markRegex(query.words), [query])
  const reduce = useReducedMotion()
  const baseId = useId()

  const all = glossaryRows()
  const searching = query.words.length > 0
  const rows = searching ? all.filter((r) => wordsMatch(r.hay, query.words)) : all

  const groups = useMemo(() => {
    const byLetter = new Map<string, GlossaryRow[]>()
    for (const r of rows) {
      const list = byLetter.get(r.letter)
      if (list) list.push(r)
      else byLetter.set(r.letter, [r])
    }
    const order = (l: string) => (l === '#' ? LETTERS.length : LETTERS.indexOf(l))
    return [...byLetter].sort((a, b) => order(a[0]) - order(b[0]))
  }, [rows])

  const present = new Set(groups.map(([l]) => l))
  const letters = all.some((r) => r.letter === '#') ? [...LETTERS, '#'] : LETTERS
  const headingId = (l: string) => `${baseId}-letter-${l === '#' ? 'other' : l}`

  const jump = (l: string) => {
    const el = document.getElementById(headingId(l))
    if (!el) return
    el.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' })
    el.focus({ preventScroll: true })
  }

  return (
    <div className="ref-panel-body">
      <div className="ref-toolbar">
        <SearchBox value={q} onChange={setQ} label="Search the glossary" placeholder="Search a term, or a word in its meaning" />
        <p className="ref-count" aria-live="polite">
          {searching ? `${plural(rows.length, 'term')} match` : `${plural(all.length, 'term')}, A to Z`}
        </p>
      </div>

      <nav className="ref-az" aria-label="Jump to a letter">
        {letters.map((l) => {
          const has = present.has(l)
          const name = l === '#' ? 'other characters' : l
          return (
            <button
              key={l}
              type="button"
              className="ref-az__btn"
              disabled={!has}
              aria-label={has ? `Terms starting with ${name}` : `No terms starting with ${name}`}
              onClick={() => jump(l)}
            >
              {l}
            </button>
          )
        })}
      </nav>

      <AnimatePresence>
        {searching && rows.length === 0 && (
          <motion.div
            key="empty"
            className="ref-empty card"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0, transition: { duration: 0.3, ease: easeOut } }}
            exit={{ opacity: 0, transition: { duration: 0.15 } }}
          >
            <SearchX size={28} aria-hidden="true" />
            <p>
              No term matches <strong>“{q.trim()}”</strong>.
            </p>
            <button type="button" className="btn btn-sm" onClick={() => setQ('')}>
              Clear search
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="ref-gloss">
        {groups.map(([l, items], gi) => (
          <motion.section
            key={l}
            className="ref-gloss__group"
            aria-labelledby={headingId(l)}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0, transition: { duration: 0.34, ease: easeOut, delay: Math.min(gi, 8) * 0.03 } }}
          >
            <h2 id={headingId(l)} className="ref-gloss__letter" tabIndex={-1}>
              <span aria-hidden="true">{l}</span>
              <span className="sr-only">
                {l === '#' ? 'Other terms' : `Letter ${l}`}, {plural(items.length, 'term')}
              </span>
            </h2>
            <dl className="ref-gloss__list">
              {items.map((r) => (
                <GlossaryItem key={r.id} row={r} mark={mark} />
              ))}
            </dl>
          </motion.section>
        ))}
      </div>
    </div>
  )
}
