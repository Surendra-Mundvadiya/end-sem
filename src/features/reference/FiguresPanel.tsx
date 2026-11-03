import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { ArrowRight, Layers, SearchX } from 'lucide-react'
import UnitPill from '../../components/UnitPill'
import { getUnit, unitVars } from '../../data'
import { easeOut } from '../../lib/motion'
import { plural } from '../../lib/text'
import { figureCardsByUnit, figureSuggestions, keyFigureTiles } from './content'
import Rich from './Rich'
import SearchBox from './SearchBox'
import { markRegex, parseQuery, wordsMatch } from './search'

const item = (i: number) => ({
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.36, ease: easeOut, delay: Math.min(i, 12) * 0.03 } },
  exit: { opacity: 0, scale: 0.98, transition: { duration: 0.16 } },
})

export default function FiguresPanel({ initialQuery = '' }: { initialQuery?: string }) {
  const [q, setQ] = useState(initialQuery)
  const query = useMemo(() => parseQuery(q), [q])
  const mark = useMemo(() => markRegex(query.words), [query])

  const allTiles = keyFigureTiles()
  const allGroups = figureCardsByUnit()
  const suggestions = figureSuggestions()
  const tiles = allTiles.filter((t) => wordsMatch(t.hay, query.words))
  const groups = allGroups.map((g) => ({ ...g, cards: g.cards.filter((c) => wordsMatch(c.hay, query.words)) })).filter((g) => g.cards.length)
  const cardCount = groups.reduce((n, g) => n + g.cards.length, 0)
  const searching = query.words.length > 0
  const empty = searching && tiles.length === 0 && cardCount === 0

  return (
    <div className="ref-panel-body">
      <div className="ref-toolbar">
        <SearchBox value={q} onChange={setQ} label="Search key figures" placeholder="Search a topic, an amount or a rate" />
        {suggestions.length > 0 && (
          <div className="ref-suggest" role="group" aria-label="Quick filters">
            {suggestions.map((s) => (
              <button key={s} type="button" className="chip" aria-pressed={q === s} onClick={() => setQ(q === s ? '' : s)}>
                {s}
              </button>
            ))}
          </div>
        )}
        <p className="ref-count" aria-live="polite">
          {searching
            ? `${plural(tiles.length, 'topic')} and ${plural(cardCount, 'card')} match`
            : [
                allTiles.length ? `${plural(allTiles.length, 'topic')} at a glance` : '',
                allGroups.length ? `${plural(allGroups.reduce((n, g) => n + g.cards.length, 0), 'figure card')} by unit` : '',
              ]
                .filter(Boolean)
                .join(' · ')}
        </p>
      </div>

      <AnimatePresence>
        {empty && (
          <motion.div key="empty" className="ref-empty card" {...item(0)}>
            <SearchX size={28} aria-hidden="true" />
            <p>
              Nothing matches <strong>“{q.trim()}”</strong>.
            </p>
            <button type="button" className="btn btn-sm" onClick={() => setQ('')}>
              Clear search
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {tiles.length > 0 && (
        <section className="ref-block" aria-labelledby="ref-fig-sheet">
          <header className="ref-block__head">
            <span className="eyebrow">At a glance</span>
            <h2 id="ref-fig-sheet" className="ref-block__title">
              Key figures and thresholds
            </h2>
          </header>
          <ul className="ref-sheet" role="list">
            <AnimatePresence mode="popLayout" initial={true}>
              {tiles.map((t, i) => (
                <motion.li key={t.id} layout="position" className="ref-fact card" {...item(i)}>
                  <h3 className="ref-fact__label">
                    <Rich text={t.label} mark={mark} />
                  </h3>
                  <ul className="ref-fact__list" role="list">
                    {t.facts.map((f, j) => (
                      <li key={j}>
                        <Rich text={f} mark={mark} figures />
                      </li>
                    ))}
                  </ul>
                </motion.li>
              ))}
            </AnimatePresence>
          </ul>
        </section>
      )}

      {groups.length > 0 && (
        <section className="ref-block" aria-labelledby="ref-fig-units">
          <header className="ref-block__head">
            <span className="eyebrow">Flashcard figures</span>
            <h2 id="ref-fig-units" className="ref-block__title">
              Figures by unit
            </h2>
          </header>
          <div className="ref-units">
            <AnimatePresence mode="popLayout">
              {groups.map((g, gi) => {
                const unit = getUnit(g.unitId)
                return (
                  <motion.section key={g.unitId} layout="position" className="ref-unit" style={unitVars(g.unitId)} {...item(gi)} aria-label={`${unit.short} figures`}>
                    <header className="ref-unit__head">
                      <UnitPill unitId={g.unitId} />
                      <h3 className="ref-unit__name">{unit.name}</h3>
                      <Link className="btn btn-sm ref-unit__drill" to={`/flashcards?unit=${g.unitId}&kind=figure`}>
                        <Layers size={15} aria-hidden="true" />
                        Drill as flashcards
                        <ArrowRight size={15} aria-hidden="true" />
                      </Link>
                    </header>
                    <ul className="ref-tiles" role="list">
                      <AnimatePresence mode="popLayout">
                        {g.cards.map((c, i) => (
                          <motion.li key={c.id} layout="position" className="ref-tile" {...item(i)}>
                            <p className="ref-tile__label">
                              <Rich text={c.label} mark={mark} />
                            </p>
                            <p className="ref-tile__value">
                              <Rich text={c.value} mark={mark} figures />
                            </p>
                          </motion.li>
                        ))}
                      </AnimatePresence>
                    </ul>
                  </motion.section>
                )
              })}
            </AnimatePresence>
          </div>
        </section>
      )}
    </div>
  )
}
