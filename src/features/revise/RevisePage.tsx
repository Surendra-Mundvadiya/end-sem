import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'
import { AnimatePresence, LayoutGroup, motion, useReducedMotion } from 'framer-motion'
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  CheckCircle2,
  Clock,
  Eye,
  Hash,
  Layers,
  ListTree,
  MessageCircleQuestion,
  PenLine,
  Printer,
  RotateCcw,
  Scale,
  Target,
  Zap,
  type LucideIcon,
} from 'lucide-react'
import PageHeader from '../../components/PageHeader'
import ProgressRing from '../../components/ProgressRing'
import { CARDS, CASES, QUIZ, UNITS, getUnit, isUnitId, slidesOfUnit, unitVars, type Unit, type UnitId } from '../../data'
import { easeOut, fadeUp, spring, stagger } from '../../lib/motion'
import { unitStats, useProgress, type UnitStats } from '../../lib/progress'
import { plural } from '../../lib/text'
import { figureCardsOf } from '../reference/content'
import Rich from '../reference/Rich'
import { casesOf, focusOf, outlineOf, practiceOf, splitCaseName } from './extract'
import { scrollToTop, useScrollSpy } from './useScrollSpy'
import './revise.css'

/* ---------- shared bits ---------- */

function numeral(u: Unit): string {
  return u.short.split(/\s+/).pop() || String(u.index + 1)
}

interface Summary {
  topics: number
  cases: number
  figures: number
  practice: number
  cards: number
  quiz: number
  firstSlide: string | null
}

const summaryCache = new Map<UnitId, Summary>()

function summaryOf(id: UnitId): Summary {
  const hit = summaryCache.get(id)
  if (hit) return hit
  const s: Summary = {
    topics: outlineOf(id).length,
    cases: CASES.filter((c) => c.unitId === id).length,
    figures: figureCardsOf(id).length,
    practice: practiceOf(id)?.items.length ?? 0,
    cards: CARDS.filter((c) => c.unitId === id).length,
    quiz: QUIZ.filter((q) => q.unitId === id).length,
    firstSlide: slidesOfUnit(id)[0]?.id ?? null,
  }
  summaryCache.set(id, s)
  return s
}

function count(n: number, one: string, many = `${one}s`) {
  return { n, label: n === 1 ? one : many }
}

/* ---------- index: one card per unit ---------- */

function UnitCard({ unit, mastery }: { unit: Unit; mastery: number }) {
  const s = summaryOf(unit.id)
  const pct = Math.round(mastery * 100)
  const stats = [count(s.topics, 'topic'), count(s.cases, 'case'), count(s.figures, 'figure')].filter((x) => x.n > 0)
  return (
    <motion.li variants={fadeUp} className="rv-units__item" style={unitVars(unit.id)}>
      <motion.div className="rv-ucard-lift" whileHover={{ y: -5 }} whileTap={{ scale: 0.985 }} transition={spring}>
        <Link to={`/revise/${unit.id}`} className="rv-ucard">
          <span className="rv-ucard__numeral" aria-hidden="true">
            {numeral(unit)}
          </span>
          <div className="rv-ucard__top">
            <span className="unit-pill">{unit.short}</span>
            {unit.hours > 0 && (
              <span className="rv-ucard__hours">
                <Clock size={13} aria-hidden="true" />
                {plural(unit.hours, 'hour')}
              </span>
            )}
            <div className="rv-ucard__ring">
              <ProgressRing value={mastery} size={50} stroke={5} label={`Mastery ${pct}%`}>
                <span className="rv-ucard__pct">{pct}%</span>
              </ProgressRing>
            </div>
          </div>
          <h2 className="rv-ucard__name">{unit.name}</h2>
          {stats.length > 0 && (
            <div className="rv-ucard__stats">
              {stats.map((x) => (
                <span key={x.label}>
                  <strong>{x.n}</strong> {x.label}
                </span>
              ))}
            </div>
          )}
          <span className="rv-ucard__go">
            Open cheat sheet
            <ArrowRight size={16} aria-hidden="true" />
          </span>
        </Link>
      </motion.div>
    </motion.li>
  )
}

/** "a, b and c" */
function listOf(parts: string[]): string {
  return parts.length < 2 ? (parts[0] ?? '') : `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`
}

/** Describes only the sections this subject actually has. */
function indexSubtitle(): string {
  const all = UNITS.map((u) => ({ s: summaryOf(u.id), focus: focusOf(u.id).length }))
  const has = (f: (x: (typeof all)[number]) => number) => all.some((x) => f(x) > 0)
  const parts = [
    'the outline',
    has((x) => x.focus) ? 'exam focus' : '',
    has((x) => x.s.cases) ? 'leading cases' : '',
    has((x) => x.s.figures) ? 'key figures' : '',
    has((x) => x.s.practice) ? 'practice questions' : '',
  ].filter(Boolean)
  const selfTest = has((x) => x.s.cases + x.s.figures) ? ' Switch on Self-test to hide the answers and check yourself.' : ''
  return `One page per unit, built from your notes: ${listOf(parts)}.${selfTest}`
}

function ReviseIndex() {
  const progress = useProgress()
  const subtitle = useMemo(indexSubtitle, [])
  const rootRef = useRef<HTMLDivElement>(null)
  // The shell keeps the scroll position between routes; coming back from a sheet's pager should start at the top.
  useEffect(() => {
    scrollToTop(rootRef.current)
  }, [])
  return (
    <div ref={rootRef} className="page rv-page">
      <PageHeader
        eyebrow={
          <>
            <Zap size={14} aria-hidden="true" /> Rapid revision
          </>
        }
        title="Exam-eve cheat sheets"
        subtitle={subtitle}
      />
      <motion.ul className="rv-units" role="list" variants={stagger(0.06, 0.05)} initial="hidden" animate="show">
        {UNITS.map((u) => (
          <UnitCard key={u.id} unit={u} mastery={unitStats(progress, u.id).mastery} />
        ))}
      </motion.ul>
    </div>
  )
}

/* ---------- unit sheet ---------- */

type SectionId = 'outline' | 'focus' | 'cases' | 'figures' | 'practice'

const SECTION_DEFS: { id: SectionId; label: string; short: string; icon: LucideIcon }[] = [
  { id: 'outline', label: 'Outline', short: 'Outline', icon: ListTree },
  { id: 'focus', label: 'Exam focus', short: 'Focus', icon: Target },
  { id: 'cases', label: 'Leading cases', short: 'Cases', icon: Scale },
  { id: 'figures', label: 'Key figures', short: 'Figures', icon: Hash },
  { id: 'practice', label: 'Practice questions', short: 'Practice', icon: PenLine },
]

const domId = (id: SectionId) => `rv-${id}`

/** Blurs its content in self-test mode until the cover is tapped. */
function Hideable({ hidden, onReveal, label, children }: { hidden: boolean; onReveal: () => void; label: string; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)
  return (
    <div className={`rv-hide${hidden ? ' is-hidden' : ''}`}>
      <div ref={ref} className="rv-hide__content" aria-hidden={hidden || undefined} tabIndex={-1}>
        {children}
      </div>
      <AnimatePresence>
        {hidden && (
          <motion.button
            key="cover"
            type="button"
            className="rv-hide__cover"
            aria-label={`Reveal ${label}`}
            onClick={() => {
              onReveal()
              requestAnimationFrame(() => ref.current?.focus({ preventScroll: true }))
            }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2, ease: easeOut }}
          >
            <span className="rv-hide__chip">
              <Eye size={14} aria-hidden="true" />
              Tap to reveal
            </span>
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  )
}

/* The id sits on an untransformed <section> so the scrollspy and jumps measure its real position;
   only the inner wrapper animates in. */
function Section({ id, icon: Icon, title, count: n, hint, children }: { id: string; icon: LucideIcon; title: string; count: string; hint?: ReactNode; children: ReactNode }) {
  return (
    <section id={id} className="rv-section" aria-labelledby={`${id}-title`}>
      <motion.div
        initial={{ opacity: 0, y: 22 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '0px 0px -8% 0px' }}
        transition={{ duration: 0.5, ease: easeOut }}
      >
        <header className="rv-section__head">
          <span className="rv-section__icon" aria-hidden="true">
            <Icon size={19} />
          </span>
          <div className="rv-section__titles">
            <h2 id={`${id}-title`} className="rv-section__title">
              {title}
              <span className="rv-section__count">{n}</span>
            </h2>
            {hint && <p className="rv-section__hint">{hint}</p>}
          </div>
        </header>
        {children}
      </motion.div>
    </section>
  )
}

function Hero({ unit, stats, s }: { unit: Unit; stats: UnitStats; s: Summary }) {
  const pct = Math.round(stats.mastery * 100)
  const items = [count(s.topics, 'topic'), count(s.cases, 'leading case'), count(s.figures, 'key figure'), count(s.practice, 'practice question')].filter((x) => x.n > 0)
  return (
    <motion.section
      className="rv-hero"
      aria-label={`${unit.short} at a glance`}
      initial={{ opacity: 0, y: 16, scale: 0.99 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.55, ease: easeOut, delay: 0.05 }}
    >
      <span className="rv-hero__numeral" aria-hidden="true">
        {numeral(unit)}
      </span>
      <div className="rv-hero__main">
        <p className="rv-hero__kicker">
          <span className="rv-hero__dot" aria-hidden="true" />
          {unit.short}
          {unit.hours > 0 && ` · ${plural(unit.hours, 'hour')} in the syllabus`}
        </p>
        {items.length > 0 && (
          <motion.ul className="rv-hero__stats" role="list" variants={stagger(0.07, 0.15)} initial="hidden" animate="show">
            {items.map((x) => (
              <motion.li key={x.label} variants={fadeUp}>
                <span className="rv-hero__num">{x.n}</span>
                <span className="rv-hero__lbl">{x.label}</span>
              </motion.li>
            ))}
          </motion.ul>
        )}
        <div className="rv-hero__actions">
          {s.quiz > 0 && (
            <Link className="btn rv-cta" to={`/quiz?units=${unit.id}&count=10&start=1`}>
              <Target size={16} aria-hidden="true" />
              Quiz this unit
            </Link>
          )}
          {s.cards > 0 && (
            <Link className="btn" to={`/flashcards?unit=${unit.id}`}>
              <Layers size={16} aria-hidden="true" />
              Flashcards
            </Link>
          )}
          {s.figures > 0 && (
            <Link className="btn" to={`/flashcards?unit=${unit.id}&kind=figure`}>
              <Hash size={16} aria-hidden="true" />
              Figure cards
            </Link>
          )}
          {s.firstSlide && (
            <Link className="btn btn-ghost" to={`/learn/${s.firstSlide}`}>
              <BookOpen size={16} aria-hidden="true" />
              Read the notes
            </Link>
          )}
        </div>
      </div>
      <div className="rv-hero__progress">
        <ProgressRing value={stats.mastery} size={104} stroke={9} label={`Mastery ${pct}%`}>
          <span className="rv-hero__pct">
            {pct}
            <small>%</small>
          </span>
        </ProgressRing>
        <p className="rv-hero__plabel">Mastery</p>
        <p className="rv-hero__pmeta">
          {stats.slidesUnderstood}/{stats.slidesTotal} notes understood
          {stats.quizBest != null && ` · best quiz ${stats.quizBest}%`}
        </p>
      </div>
    </motion.section>
  )
}

function Pager({ unit }: { unit: Unit }) {
  const prev = UNITS[unit.index - 1]
  const next = UNITS[unit.index + 1]
  const link = (u: Unit | undefined, dir: 'prev' | 'next') => {
    const Icon = dir === 'prev' ? ArrowLeft : ArrowRight
    const label = dir === 'prev' ? 'Previous' : 'Next'
    if (!u) {
      return (
        <Link className={`rv-pager__link rv-pager__link--${dir}`} to="/revise">
          {dir === 'prev' && <Icon size={18} aria-hidden="true" />}
          <span className="rv-pager__text">
            <span className="rv-pager__dir">Rapid revision</span>
            <span className="rv-pager__name">All units</span>
          </span>
          {dir === 'next' && <Icon size={18} aria-hidden="true" />}
        </Link>
      )
    }
    return (
      <Link className={`rv-pager__link rv-pager__link--${dir}`} to={`/revise/${u.id}`} style={unitVars(u.id)}>
        {dir === 'prev' && <Icon size={18} aria-hidden="true" />}
        <span className="rv-pager__text">
          <span className="rv-pager__dir">
            {label} · {u.short}
          </span>
          <span className="rv-pager__name">{u.name}</span>
        </span>
        {dir === 'next' && <Icon size={18} aria-hidden="true" />}
      </Link>
    )
  }
  return (
    <nav className="rv-pager" aria-label="Other units">
      {link(prev, 'prev')}
      {link(next, 'next')}
    </nav>
  )
}

function UnitSheet({ unitId }: { unitId: UnitId }) {
  const unit = getUnit(unitId)
  const progress = useProgress()
  const stats = unitStats(progress, unitId)
  const reduce = useReducedMotion()
  const rootRef = useRef<HTMLDivElement>(null)
  const navRef = useRef<HTMLDivElement>(null)
  const tabsRef = useRef<HTMLElement>(null)

  const content = useMemo(
    () => ({
      outline: outlineOf(unitId),
      focus: focusOf(unitId),
      cases: casesOf(unitId),
      figures: figureCardsOf(unitId),
      practice: practiceOf(unitId),
    }),
    [unitId],
  )
  const summary = summaryOf(unitId)
  const caseCount = content.cases.reduce((n, g) => n + g.cases.length, 0)
  const counts: Record<SectionId, number> = {
    outline: content.outline.length,
    focus: content.focus.length,
    cases: caseCount,
    figures: content.figures.length,
    practice: content.practice?.items.length ?? 0,
  }
  const sections = SECTION_DEFS.filter((s) => counts[s.id] > 0)
  const { active, jump } = useScrollSpy(
    sections.map((s) => domId(s.id)),
    navRef,
  )

  const [selfTest, setSelfTest] = useState(false)
  const [revealed, setRevealed] = useState<ReadonlySet<string>>(() => new Set())
  const hideable = caseCount + content.figures.length
  const isHidden = (id: string) => selfTest && !revealed.has(id)
  const reveal = (id: string) => setRevealed((prev) => new Set(prev).add(id))

  // A new unit starts at the top (prev/next keep this page mounted).
  useEffect(() => {
    scrollToTop(rootRef.current)
  }, [])

  // Keep the active pill in view inside the horizontally scrolling nav (never scroll the page here).
  useEffect(() => {
    const list = tabsRef.current
    const btn = list?.querySelector<HTMLElement>(`[data-section="${active}"]`)
    if (!list || !btn) return
    const left = btn.offsetLeft
    const right = left + btn.offsetWidth
    if (left < list.scrollLeft + 8 || right > list.scrollLeft + list.clientWidth - 8) {
      list.scrollTo({ left: left - (list.clientWidth - btn.offsetWidth) / 2, behavior: reduce ? 'auto' : 'smooth' })
    }
  }, [active, reduce])

  const testHint = (what: string) =>
    selfTest ? `Self-test is on: tap a blurred ${what} to check yourself.` : `Switch on Self-test to hide the ${what}s and test your recall.`

  return (
    <div ref={rootRef} className="page rv-page rv-sheet" style={unitVars(unitId)}>
      <PageHeader
        eyebrow={
          <>
            <Link className="rv-crumb" to="/revise">
              <ArrowLeft size={14} aria-hidden="true" />
              Rapid revision
            </Link>
            <span aria-hidden="true">/</span>
            <span>{unit.short}</span>
          </>
        }
        title={unit.name}
        subtitle="Everything to run through before the exam, on one page."
        actions={
          <button type="button" className="btn" onClick={() => window.print()}>
            <Printer size={16} aria-hidden="true" />
            Print
          </button>
        }
      />

      <Hero unit={unit} stats={stats} s={summary} />

      <LayoutGroup id={`rv-${unitId}`}>
        <div className="rv-sticky" ref={navRef}>
          <div className="rv-bar">
            <nav className="rv-tabs" ref={tabsRef} aria-label="Sections on this page">
              {sections.map((s) => {
                const id = domId(s.id)
                const on = active === id
                const Icon = s.icon
                return (
                  <button key={s.id} type="button" data-section={id} className="rv-tab" aria-current={on ? 'true' : undefined} onClick={() => jump(id, !reduce)}>
                    {on && <motion.span layoutId="rv-nav-pill" className="rv-tab__pill" transition={spring} />}
                    <Icon className="rv-tab__icon" size={15} aria-hidden="true" />
                    <span className="rv-tab__label">{s.label}</span>
                    <span className="rv-tab__short">{s.short}</span>
                    <span className="rv-tab__count">{counts[s.id]}</span>
                  </button>
                )
              })}
            </nav>
            {hideable > 0 && (
              <div className="rv-selftest">
                <AnimatePresence initial={false}>
                  {selfTest && revealed.size > 0 && (
                    <motion.button
                      key="reset"
                      type="button"
                      className="rv-reset"
                      aria-label="Hide all answers again"
                      title="Hide all answers again"
                      onClick={() => setRevealed(new Set())}
                      initial={{ opacity: 0, scale: 0.5 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.5 }}
                      transition={spring}
                    >
                      <RotateCcw size={15} aria-hidden="true" />
                    </motion.button>
                  )}
                </AnimatePresence>
                <button
                  type="button"
                  role="switch"
                  aria-checked={selfTest}
                  className="rv-switch"
                  onClick={() => {
                    setSelfTest((v) => !v)
                    setRevealed(new Set())
                  }}
                >
                  <span className="rv-switch__track" aria-hidden="true">
                    <motion.span className="rv-switch__thumb" animate={{ x: selfTest ? 14 : 0 }} transition={spring} />
                  </span>
                  <span className="rv-switch__label">Self-test</span>
                  {selfTest && (
                    <span className="rv-switch__count">
                      <span className="sr-only">, revealed </span>
                      {revealed.size}/{hideable}
                    </span>
                  )}
                </button>
              </div>
            )}
          </div>
        </div>
      </LayoutGroup>

      <div className="rv-sections">
        {counts.outline > 0 && (
          <Section id={domId('outline')} icon={ListTree} title="Outline" count={plural(counts.outline, 'topic')} hint="Every topic in order. Tap one to open its notes.">
            <ol className="rv-outline" role="list">
              {content.outline.map((p) => {
                const done = p.slides.every((sl) => progress.understood[sl.id])
                return (
                  <li key={p.key} className="rv-outline__part">
                    <Link className="rv-outline__head" to={`/learn/${p.first.id}`}>
                      {p.num && <span className="rv-outline__num">{p.num}</span>}
                      <span className="rv-outline__title">{p.title}</span>
                      {done && (
                        <>
                          <CheckCircle2 className="rv-done" size={17} aria-hidden="true" />
                          <span className="sr-only"> (understood)</span>
                        </>
                      )}
                    </Link>
                    {p.subs.length > 0 && (
                      <ul className="rv-outline__subs" role="list">
                        {p.subs.map((sub) => (
                          <li key={sub.slide.id}>
                            <Link className="rv-outline__sub" to={`/learn/${sub.slide.id}`}>
                              {sub.num && <span className="rv-outline__subnum">{sub.num}</span>}
                              <span className="rv-outline__subtext">{sub.text}</span>
                              {progress.understood[sub.slide.id] && (
                                <>
                                  <CheckCircle2 className="rv-done" size={15} aria-hidden="true" />
                                  <span className="sr-only"> (understood)</span>
                                </>
                              )}
                            </Link>
                          </li>
                        ))}
                      </ul>
                    )}
                  </li>
                )
              })}
            </ol>
          </Section>
        )}

        {counts.focus > 0 && (
          <Section id={domId('focus')} icon={Target} title="Exam focus" count={plural(counts.focus, 'note')} hint="The exam pointers from the notes, each linked to its topic.">
            <div className="rv-focus-list">
              {content.focus.map((f) => (
                <article key={f.id} className="rv-focus">
                  <div className="notes rv-focus__body" dangerouslySetInnerHTML={{ __html: f.html }} />
                  <Link className="rv-focus__src" to={`/learn/${f.slide.id}`}>
                    <span className="sr-only">Open the notes: </span>
                    {f.slide.title}
                    <ArrowUpRight size={15} aria-hidden="true" />
                  </Link>
                </article>
              ))}
            </div>
          </Section>
        )}

        {counts.cases > 0 && (
          <Section id={domId('cases')} icon={Scale} title="Leading cases" count={plural(counts.cases, 'case')} hint={testHint('holding')}>
            <div className="rv-casegroups">
              {content.cases.map((g, gi) => (
                <div key={`${g.part}-${gi}`} className="rv-casegroup">
                  <h3 className="rv-casegroup__title">
                    {g.num && <span className="rv-casegroup__num">{g.num}</span>}
                    {g.title}
                  </h3>
                  <ul className="rv-cases" role="list">
                    {g.cases.map((c) => {
                      const { title, cite } = splitCaseName(c.name)
                      return (
                        <li key={c.id} className="rv-case">
                          <div className="rv-case__main">
                            <p className="rv-case__name">{title}</p>
                            {cite && <p className="rv-case__cite">{cite}</p>}
                            <Hideable hidden={isHidden(c.id)} onReveal={() => reveal(c.id)} label={`the holding in ${title}`}>
                              <div className="notes rv-case__held" dangerouslySetInnerHTML={{ __html: c.held }} />
                            </Hideable>
                          </div>
                          <Link className="btn btn-ghost btn-icon btn-sm rv-case__open" to={`/learn/${c.slideId}`} aria-label={`Open the notes on ${title}`}>
                            <ArrowUpRight size={17} aria-hidden="true" />
                          </Link>
                        </li>
                      )
                    })}
                  </ul>
                </div>
              ))}
            </div>
          </Section>
        )}

        {counts.figures > 0 && (
          <Section id={domId('figures')} icon={Hash} title="Key figures" count={plural(counts.figures, 'figure')} hint={testHint('figure')}>
            <ul className="rv-figs" role="list">
              {content.figures.map((f) => (
                <li key={f.id} className="rv-fig">
                  <p className="rv-fig__label">{f.label}</p>
                  <Hideable hidden={isHidden(f.id)} onReveal={() => reveal(f.id)} label={`the figure for ${f.label}`}>
                    <p className="rv-fig__value">
                      <Rich text={f.value} figures />
                    </p>
                  </Hideable>
                </li>
              ))}
            </ul>
          </Section>
        )}

        {content.practice && (
          <Section
            id={domId('practice')}
            icon={PenLine}
            title="Practice questions"
            count={plural(content.practice.items.length, 'question')}
            hint="Try each one before you look anything up, then check yourself against the notes."
          >
            <ol className="rv-practice" role="list">
              {content.practice.items.map((q, i) => (
                <li key={q.id} className="rv-q">
                  <span className="rv-q__num" aria-hidden="true">
                    {i + 1}
                  </span>
                  <div className="notes rv-q__text" dangerouslySetInnerHTML={{ __html: q.html }} />
                </li>
              ))}
            </ol>
            <div className="rv-practice__actions">
              <Link className="btn" to={`/learn/${content.practice.slide.id}`}>
                <BookOpen size={16} aria-hidden="true" />
                Open in the notes
              </Link>
              <Link className="btn" to={`/tutor/${content.practice.slide.id}`}>
                <MessageCircleQuestion size={16} aria-hidden="true" />
                Work through with the tutor
              </Link>
            </div>
          </Section>
        )}
      </div>

      <Pager unit={unit} />
    </div>
  )
}

export default function RevisePage() {
  const { unitId } = useParams()
  if (unitId !== undefined && !isUnitId(unitId)) return <Navigate to="/revise" replace />
  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={unitId ?? 'index'}
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -8 }}
        transition={{ duration: 0.24, ease: easeOut }}
      >
        {unitId ? <UnitSheet unitId={unitId} /> : <ReviseIndex />}
      </motion.div>
    </AnimatePresence>
  )
}
