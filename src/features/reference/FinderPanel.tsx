import { useMemo, useState, type Ref as ReactRef } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { ArrowRight, Info, SearchX } from 'lucide-react'
import { easeOut, softSpring } from '../../lib/motion'
import { plural } from '../../lib/text'
import { actLabels, finderSuggestions, sectionFinder, type Finder } from './content'
import { refHits, refLabel, type FinderGroup, type FinderRow, type Pair, type Ref, type Seg } from './parse'
import Rich from './Rich'
import SearchBox from './SearchBox'
import { markRegex, parseQuery, wordsMatch, type ParsedQuery } from './search'

type Side = 'old' | 'new'
type HitFn = (r: Ref, side: Side) => boolean
type Labels = { old: string; new: string }
type Mode = 'all' | 'strict' | 'prefix'

interface Answer {
  key: string
  dir: 'fwd' | 'rev'
  olds: Ref[]
  to: Ref[]
  row: FinderRow
  group: FinderGroup
}

const MAX_ANSWERS = 6

const item = (i: number) => ({
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.34, ease: easeOut, delay: Math.min(i, 10) * 0.025 } },
  exit: { opacity: 0, scale: 0.98, transition: { duration: 0.15 } },
})

/* ---------- matching ---------- */

function prefixHit(q: string, r: Ref): boolean {
  const Q = q.toUpperCase()
  return r.kind === 'one' ? r.v.toUpperCase().startsWith(Q) : r.from.toUpperCase().startsWith(Q) || r.to.toUpperCase().startsWith(Q)
}

function strictRowHit(r: FinderRow, refs: string[]): boolean {
  return refs.some((q) => r.oldRefs.some((o) => refHits(q, o)) || r.newRefs.some((n) => refHits(q, n, false)))
}

function prefixRowHit(r: FinderRow, refs: string[]): boolean {
  return refs.some((q) => [...r.oldRefs, ...r.newRefs].some((x) => prefixHit(q, x)))
}

function filterFinder(f: Finder, q: ParsedQuery): { groups: { g: FinderGroup; rows: FinderRow[] }[]; mode: Mode } {
  const pick = (test: (r: FinderRow) => boolean) =>
    f.groups
      .map((g) => ({ g, rows: g.rows.filter((r) => test(r) && wordsMatch(f.hay.get(r.id) ?? { text: '', stems: '' }, q.words)) }))
      .filter((x) => x.rows.length > 0)
  if (!q.refs.length) return { groups: pick(() => true), mode: 'all' }
  const strict = pick((r) => strictRowHit(r, q.refs))
  if (strict.length) return { groups: strict, mode: 'strict' }
  return { groups: pick((r) => prefixRowHit(r, q.refs)), mode: 'prefix' }
}

/** Direct answers for typed section numbers: old → new first, then new → old. */
function lookup(groups: FinderGroup[], refs: string[]): Answer[] {
  const out: Answer[] = []
  const seen = new Set<string>()
  const add = (dir: Answer['dir'], g: FinderGroup, r: FinderRow, ps: Pair[]) => {
    const byTarget = new Map<string, Pair[]>()
    for (const p of ps) {
      const k = p.to.map(refLabel).join(',')
      byTarget.set(k, [...(byTarget.get(k) ?? []), p])
    }
    for (const [k, list] of byTarget) {
      const key = `${r.id}|${list.map((p) => refLabel(p.old)).join(',')}|${k}`
      if (seen.has(key)) continue
      seen.add(key)
      out.push({ key, dir, olds: list.map((p) => p.old), to: list[0].to, row: r, group: g })
    }
  }
  for (const q of refs) {
    for (const g of groups) {
      for (const r of g.rows) {
        const fwd = r.pairs.filter((p) => refHits(q, p.old))
        if (fwd.length) add('fwd', g, r, fwd)
        else if (!r.pairs.length && r.oldRefs.some((o) => refHits(q, o)) && !seen.has(`${r.id}|all`)) {
          seen.add(`${r.id}|all`)
          out.push({ key: `${r.id}|all`, dir: 'fwd', olds: r.oldRefs, to: r.newRefs, row: r, group: g })
        }
        const rev = r.pairs.filter((p) => p.to.some((t) => refHits(q, t, false)))
        if (rev.length) add('rev', g, r, rev)
      }
    }
  }
  return out.sort((a, b) => (a.dir === b.dir ? 0 : a.dir === 'fwd' ? -1 : 1))
}

/* ---------- pieces ---------- */

function Chip({ r, side, hit }: { r: Ref; side: Side; hit: boolean }) {
  return (
    <span className={`ref-chip ref-chip--${side}`} data-hit={hit || undefined}>
      {refLabel(r)}
    </span>
  )
}

function SegText({ segs, side, mark, hit }: { segs: Seg[]; side: Side; mark: RegExp | null; hit: HitFn }) {
  return (
    <>
      {segs.map((s, i) =>
        s.kind === 'text' ? <Rich key={i} text={s.text} mark={mark} /> : <Chip key={i} r={s.ref} side={side} hit={hit(s.ref, side)} />,
      )}
    </>
  )
}

function plain(rs: Ref[]): string {
  return rs.length > 1 || rs.some((r) => r.kind === 'range') ? 'Sections' : 'Section'
}

function BigRefs({ refs }: { refs: Ref[] }) {
  const text = refs.map(refLabel).join(', ')
  return <span className={`ref-answer__refs${text.length > 12 ? ' is-long' : ''}`}>{text}</span>
}

/* Direct children of AnimatePresence mode="popLayout" must pass the ref on to their DOM node. */
function AnswerCard({ a, labels, ref }: { a: Answer; labels: Labels; ref?: ReactRef<HTMLElement> }) {
  return (
    <motion.article
      ref={ref}
      layout="position"
      className="ref-answer"
      initial={{ opacity: 0, y: 14, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.96, transition: { duration: 0.15 } }}
      transition={softSpring}
    >
      <p className="ref-answer__topic">{a.group.title}</p>
      <div className="ref-answer__map">
        <div className={`ref-answer__side ref-answer__side--old${a.dir === 'fwd' ? ' is-hit' : ''}`}>
          <span className="ref-answer__act">{labels.old}</span>
          <span className="ref-answer__kind">{plain(a.olds)}</span>
          <BigRefs refs={a.olds} />
        </div>
        <motion.span
          className="ref-answer__arrow"
          aria-hidden="true"
          initial={{ x: -12, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ ...softSpring, delay: 0.12 }}
        >
          <ArrowRight size={24} />
        </motion.span>
        <div className={`ref-answer__side ref-answer__side--new${a.dir === 'rev' ? ' is-hit' : ''}`}>
          <span className="ref-answer__act">{labels.new}</span>
          {a.to.length ? (
            <>
              <span className="ref-answer__kind">{plain(a.to)}</span>
              <BigRefs refs={a.to} />
            </>
          ) : (
            <span className="ref-answer__none">{a.row.note || 'No counterpart'}</span>
          )}
        </div>
      </div>
      <p className="ref-answer__src">
        <span className="ref-answer__src-label">As written</span>
        {a.row.text}
      </p>
    </motion.article>
  )
}

function MapRow({
  row,
  labels,
  mark,
  hit,
  index,
  ref,
}: {
  row: FinderRow
  labels: Labels
  mark: RegExp | null
  hit: HitFn
  index: number
  ref?: ReactRef<HTMLLIElement>
}) {
  return (
    <motion.li ref={ref} layout="position" className="ref-row" {...item(index)}>
      <div className="ref-row__side ref-row__side--old">
        <span className="ref-row__tag">{labels.old}</span>
        <p className="ref-row__text">
          <SegText segs={row.left} side="old" mark={mark} hit={hit} />
        </p>
      </div>
      <span className="ref-row__arrow" aria-hidden="true">
        <ArrowRight size={16} />
      </span>
      <div className="ref-row__side ref-row__side--new">
        <span className="ref-row__tag">{labels.new}</span>
        <p className="ref-row__text">
          {row.relation === 'maps' ? (
            <>
              <span className="sr-only">is now </span>
              <SegText segs={row.right} side="new" mark={mark} hit={hit} />
            </>
          ) : (
            <span className={`ref-row__note ref-row__note--${row.relation}`}>
              <Rich text={row.note} mark={mark} />
            </span>
          )}
        </p>
      </div>
      {row.zipped && (
        <div className="ref-row__pairs">
          <span className="ref-row__pairs-label">One to one</span>
          {row.pairs.map((p, i) => (
            <span key={i} className="ref-pair" data-hit={hit(p.old, 'old') || p.to.some((t) => hit(t, 'new')) || undefined}>
              <Chip r={p.old} side="old" hit={hit(p.old, 'old')} />
              <ArrowRight size={12} aria-hidden="true" />
              <span className="sr-only"> is now </span>
              {p.to.map((t, j) => (
                <Chip key={j} r={t} side="new" hit={hit(t, 'new')} />
              ))}
            </span>
          ))}
        </div>
      )}
    </motion.li>
  )
}

/* ---------- panel ---------- */

export default function FinderPanel({ initialQuery = '' }: { initialQuery?: string }) {
  const finder = sectionFinder()
  const labels = useMemo(actLabels, [])
  const examples = useMemo(finderSuggestions, [])
  const [q, setQ] = useState(initialQuery)

  const query = useMemo(() => parseQuery(q, { refs: true }), [q])
  const mark = useMemo(() => markRegex(query.words), [query])
  const { groups, mode } = useMemo(() => filterFinder(finder, query), [finder, query])
  const answers = useMemo(() => (mode === 'strict' ? lookup(finder.groups, query.refs) : []), [finder, query, mode])

  const hit: HitFn = (r, side) =>
    mode === 'strict' ? query.refs.some((x) => refHits(x, r, side === 'old')) : mode === 'prefix' ? query.refs.some((x) => prefixHit(x, r)) : false

  const searching = query.words.length > 0 || query.refs.length > 0
  const rowCount = groups.reduce((n, g) => n + g.rows.length, 0)
  const total = finder.groups.reduce((n, g) => n + g.rows.length, 0)
  const chips = [...examples.refs, ...examples.topics]
  const topicExample = [...examples.topics].sort((a, b) => a.length - b.length)[0]
  const eg = [examples.refs[0], topicExample?.toLowerCase()].filter(Boolean).join(' or ')
  const placeholder = eg ? `Section or topic, e.g. ${eg}` : 'Section number or topic'

  return (
    <div className="ref-panel-body">
      {finder.intro && (
        <p className="ref-callout">
          <Info size={18} aria-hidden="true" />
          <span>{finder.intro}</span>
        </p>
      )}

      <div className="ref-toolbar">
        <SearchBox value={q} onChange={setQ} label={`Find a section by its ${labels.old} number, its ${labels.new} number or its topic`} placeholder={placeholder} />
        {chips.length > 0 && (
          <div className="ref-suggest" role="group" aria-label="Try a lookup">
            {chips.map((c) => (
              <button key={c} type="button" className="chip" aria-pressed={q === c} onClick={() => setQ(q === c ? '' : c)}>
                {c}
              </button>
            ))}
          </div>
        )}
        <div className="ref-finder-meta">
          <p className="ref-legend" aria-hidden="true">
            <span className="ref-chip ref-chip--old">{labels.old}</span>
            <ArrowRight size={14} />
            <span className="ref-chip ref-chip--new">{labels.new}</span>
          </p>
          <p className="ref-count" aria-live="polite">
            {searching
              ? rowCount
                ? `${plural(rowCount, 'entry', 'entries')} in ${plural(groups.length, 'subject')}${answers.length ? ` · ${plural(answers.length, 'direct match', 'direct matches')}` : ''}${mode === 'prefix' ? ` · sections starting “${query.refs.join(', ')}”` : ''}`
                : 'No matches'
              : `${plural(total, 'correspondence', 'correspondences')} in ${plural(finder.groups.length, 'subject')}`}
          </p>
        </div>
      </div>

      {answers.length > 0 && (
        <section className="ref-answers" aria-label="Direct matches">
          <AnimatePresence mode="popLayout">
            {answers.slice(0, MAX_ANSWERS).map((a) => (
              <AnswerCard key={a.key} a={a} labels={labels} />
            ))}
          </AnimatePresence>
          {answers.length > MAX_ANSWERS && <p className="ref-more">{plural(answers.length - MAX_ANSWERS, 'more match', 'more matches')} in the list below.</p>}
        </section>
      )}

      <AnimatePresence>
        {searching && rowCount === 0 && (
          <motion.div key="empty" className="ref-empty card" {...item(0)}>
            <SearchX size={28} aria-hidden="true" />
            <p>
              Nothing matches <strong>“{q.trim()}”</strong>.
            </p>
            <p className="ref-empty__hint">Try a section number on its own, or one word of the topic.</p>
            <button type="button" className="btn btn-sm" onClick={() => setQ('')}>
              Clear search
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="ref-groups">
        <AnimatePresence mode="popLayout">
          {groups.map(({ g, rows }, gi) => (
            <motion.section key={g.id} layout="position" className="ref-group card" aria-labelledby={`${g.id}-title`} {...item(gi)}>
              <header className="ref-group__head">
                <h3 id={`${g.id}-title`} className="ref-group__title">
                  <Rich text={g.title} mark={mark} />
                </h3>
                <span className="ref-group__count">{plural(rows.length, 'entry', 'entries')}</span>
              </header>
              <div className="ref-group__cols" aria-hidden="true">
                <span>{labels.old}</span>
                <span />
                <span>{labels.new}</span>
              </div>
              <ul className="ref-rows" role="list">
                <AnimatePresence mode="popLayout">
                  {rows.map((r, ri) => (
                    <MapRow key={r.id} row={r} labels={labels} mark={mark} hit={hit} index={ri} />
                  ))}
                </AnimatePresence>
              </ul>
            </motion.section>
          ))}
        </AnimatePresence>
      </div>
    </div>
  )
}
