import { motion, type Variants } from 'framer-motion'
import { ArrowRight, Check, Flag, MapPin, NotebookPen } from 'lucide-react'
import { Link } from 'react-router-dom'
import ProgressRing from '../../../components/ProgressRing'
import { PARTS, SLIDES, UNITS, partsOfUnit, unitVars, type Part, type Unit } from '../../../data'
import { easeOut, fadeUp } from '../../../lib/motion'
import { useProgress } from '../../../lib/progress'
import { plural } from '../../../lib/text'
import { isAsidePart, pct, prefersReducedMotion, sameTitle, splitNumber, stripNumber } from '../util'
import './course-map.css'

/*
 * The whole subject as one journey: each unit is a station with its own colour, each topic a numbered stop on
 * its line, each sub-topic a step under it. Read top to bottom, it is the syllabus in order.
 */

const laneVariants: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.045, delayChildren: 0.15 } },
}

const railVariants: Variants = {
  hidden: { scaleY: 0 },
  show: { scaleY: 1, transition: { duration: 0.9, ease: easeOut } },
}

const stopVariants: Variants = {
  hidden: { opacity: 0, x: -10 },
  show: { opacity: 1, x: 0, transition: { duration: 0.4, ease: easeOut } },
}

const TOPICS = PARTS.filter((p) => !isAsidePart(p))

function jumpTo(id: string) {
  const el = document.getElementById(id)
  if (!el) return
  el.scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth', block: 'start' })
  el.querySelector<HTMLElement>('[data-map-heading]')?.focus({ preventScroll: true })
}

export default function CourseMap() {
  const { understood } = useProgress()
  const doneSlides = SLIDES.filter((s) => understood[s.id]).length
  const next = TOPICS.find((p) => p.slides.some((s) => !understood[s.id]))
  const nextSlide = next?.slides.find((s) => !understood[s.id])

  return (
    <div className="lab-map">
      <motion.div className="lab-map__overview" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45, ease: easeOut }}>
        <div className="lab-map__summary">
          <ProgressRing value={SLIDES.length ? doneSlides / SLIDES.length : 0} size={72} stroke={7} color="var(--brand)" label={`${pct(doneSlides, SLIDES.length)}% understood`}>
            <span className="lab-map__ring-pct">{pct(doneSlides, SLIDES.length)}%</span>
          </ProgressRing>
          <div className="lab-map__summary-text">
            <p className="lab-map__summary-title">
              {plural(UNITS.length, 'unit')} · {plural(TOPICS.length, 'topic')} · {plural(SLIDES.length, 'section')}
            </p>
            <p className="lab-map__summary-sub">
              {doneSlides} of {SLIDES.length} sections marked understood.
            </p>
          </div>
          {next && nextSlide && (
            <Link to={`/learn/${nextSlide.id}`} className="btn btn-primary lab-map__continue" style={unitVars(next.unitId)}>
              <MapPin size={16} aria-hidden="true" />
              <span className="lab-map__continue-text">Next stop: {stripNumber(next.title)}</span>
              <ArrowRight size={16} aria-hidden="true" />
            </Link>
          )}
        </div>

        <nav className="lab-map__line" aria-label="Jump to a unit">
          {UNITS.map((u, i) => {
            const slides = SLIDES.filter((s) => s.unitId === u.id)
            const done = slides.filter((s) => understood[s.id]).length
            return (
              <motion.button
                key={u.id}
                type="button"
                className="lab-map__line-stop"
                style={unitVars(u.id)}
                onClick={() => jumpTo(`lab-map-${u.id}`)}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35, ease: easeOut, delay: 0.1 + i * 0.06 }}
              >
                <span className="lab-map__line-dot" aria-hidden="true">
                  {u.index + 1}
                </span>
                <span className="lab-map__line-text">
                  <span className="lab-map__line-short">{u.short}</span>
                  <span className="lab-map__line-name">{u.name}</span>
                </span>
                <span className="bar lab-map__line-bar" aria-hidden="true">
                  <span style={{ width: `${pct(done, slides.length)}%` }} />
                </span>
              </motion.button>
            )
          })}
        </nav>
      </motion.div>

      <ol className="lab-map__stations">
        {UNITS.map((u) => (
          <Station key={u.id} unit={u} understood={understood} nextKey={next?.key} />
        ))}
      </ol>

      <motion.div
        className="lab-map__finish"
        initial={{ opacity: 0, scale: 0.96 }}
        whileInView={{ opacity: 1, scale: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 0.4, ease: easeOut }}
      >
        <span className="lab-map__finish-icon" aria-hidden="true">
          <Flag size={20} />
        </span>
        <span>
          <span className="lab-map__finish-title">End of the line</span>
          <span className="lab-map__finish-sub">Close your eyes and walk it again from the first unit.</span>
        </span>
      </motion.div>
    </div>
  )
}

function Station({ unit, understood, nextKey }: { unit: Unit; understood: Record<string, number>; nextKey?: string }) {
  const parts = partsOfUnit(unit.id)
  const slides = parts.flatMap((p) => p.slides)
  const done = slides.filter((s) => understood[s.id]).length
  const topics = parts.filter((p) => !isAsidePart(p)).length
  const headingId = `lab-map-h-${unit.id}`
  let seq = 0

  return (
    <motion.li
      id={`lab-map-${unit.id}`}
      className="lab-map__station"
      style={unitVars(unit.id)}
      aria-labelledby={headingId}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, margin: '0px 0px -80px 0px' }}
      variants={fadeUp}
    >
      <header className="lab-map__station-head">
        <span className="lab-map__badge" aria-hidden="true">
          {unit.index + 1}
        </span>
        <div className="lab-map__station-text">
          <div className="eyebrow lab-map__station-short">{unit.short}</div>
          <h2 id={headingId} className="lab-map__station-name" tabIndex={-1} data-map-heading>
            {unit.name}
          </h2>
          <p className="lab-map__station-meta">
            {plural(topics, 'topic')} · {plural(slides.length, 'section')}
          </p>
          <div className="lab-map__station-progress">
            <span className="bar" aria-hidden="true">
              <span style={{ width: `${pct(done, slides.length)}%` }} />
            </span>
            <span className="lab-map__station-count">
              {done}/{slides.length}
              <span className="sr-only"> sections understood</span>
            </span>
          </div>
        </div>
      </header>

      <div className="lab-map__lane">
        <motion.span className="lab-map__rail" aria-hidden="true" variants={railVariants} />
        <motion.ol className="lab-map__stops" variants={laneVariants}>
          {parts.map((p) => {
            const aside = isAsidePart(p)
            if (!aside) seq++
            return <Stop key={p.key} part={p} aside={aside} seq={seq} understood={understood} isNext={p.key === nextKey} />
          })}
        </motion.ol>
      </div>
    </motion.li>
  )
}

function Stop({ part, aside, seq, understood, isNext }: { part: Part; aside: boolean; seq: number; understood: Record<string, number>; isNext: boolean }) {
  const { num, text } = splitNumber(part.title)
  const n = part.slides.length
  const done = part.slides.filter((s) => understood[s.id]).length
  const complete = n > 0 && done === n
  const first = part.slides[0]
  const showSlides = n > 1 || (first && !sameTitle(first.title, part.title))
  const cls = `lab-map__stop${aside ? ' is-aside' : ''}${complete ? ' is-done' : ''}${isNext ? ' is-next' : ''}`

  return (
    <motion.li className={cls} variants={stopVariants}>
      <span className="lab-map__node" aria-hidden="true">
        {aside ? <NotebookPen size={13} /> : complete ? <Check size={16} strokeWidth={3} /> : (num ?? seq)}
      </span>
      <div className="lab-map__stop-body">
        <Link to={`/learn/${first.id}`} className="lab-map__stop-link">
          <span className="lab-map__stop-title">
            {!aside && <span className="sr-only">{num ?? seq}. </span>}
            {text}
          </span>
          <span className="lab-map__stop-meta">
            {isNext && (
              <span className="lab-map__here">
                <MapPin size={12} aria-hidden="true" /> Next stop
              </span>
            )}
            <span className="lab-map__stop-count">{complete ? 'Understood' : n > 1 ? `${done}/${n} understood` : 'Not yet marked'}</span>
          </span>
        </Link>
        {showSlides && !aside && (
          <ul className="lab-map__slides">
            {part.slides.map((s) => {
              const ok = !!understood[s.id]
              const label = sameTitle(s.title, part.title) ? 'Overview' : stripNumber(s.title)
              return (
                <li key={s.id}>
                  <Link to={`/learn/${s.id}`} className={`lab-map__slide${ok ? ' is-done' : ''}`}>
                    <span className="lab-map__slide-dot" aria-hidden="true">
                      {ok && <Check size={10} strokeWidth={3.5} />}
                    </span>
                    {label}
                    {ok && <span className="sr-only"> (understood)</span>}
                  </Link>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </motion.li>
  )
}
