import { useEffect } from 'react'
import { animate, motion, useMotionValue, useTransform } from 'framer-motion'
import { Link } from 'react-router-dom'
import { ArrowRight, BookOpen, FileText, Flame, FlaskConical, Headphones, Layers, Library, ListChecks, Scale, Sparkles, Target, Zap, type LucideIcon } from 'lucide-react'
import ProgressRing from '../components/ProgressRing'
import UnitPill from '../components/UnitPill'
import { CARDS, CASES, MATERIALS, QUIZ, SLIDES, SUBJECT, SUBJECTS, UNITS, getUnit, partsOfUnit, slideById, slidesOfUnit, unitVars } from '../data'
import { easeOut, fadeUp, stagger } from '../lib/motion'
import { studyStreak, unitStats, useProgress } from '../lib/progress'
import { switchSubject } from '../subjects/registry'
import './HomePage.css'

function CountUp({ value, suffix = '' }: { value: number; suffix?: string }) {
  const mv = useMotionValue(0)
  const text = useTransform(mv, (v) => `${Math.round(v).toLocaleString('en-IN')}${suffix}`)
  useEffect(() => {
    const controls = animate(mv, value, { duration: 1.1, ease: easeOut })
    return () => controls.stop()
  }, [mv, value])
  return <motion.span>{text}</motion.span>
}

function greeting(): string {
  const h = new Date().getHours()
  if (h < 5) return 'Burning the midnight oil'
  if (h < 12) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  return 'Good evening'
}

const TOOLS: { to: string; title: string; hook: string; icon: LucideIcon }[] = [
  { to: '/tutor', title: 'Spoken tutor', hook: 'Lessons read aloud, line by line, with quick checks.', icon: Headphones },
  { to: '/lab', title: 'Memory Lab', hook: 'Calculators, decision trees, timelines and mnemonics.', icon: FlaskConical },
  { to: '/cases', title: 'Concept match', hook: 'Link each case to the principle it stands for.', icon: Scale },
  { to: '/revise', title: 'Rapid revision', hook: 'One page per unit for the night before.', icon: Zap },
  { to: '/reference', title: 'Reference', hook: 'Key figures, the section finder and the PDFs.', icon: Library },
].filter((t) => (t.to === '/lab' ? SUBJECT.hasLab : t.to === '/cases' ? CASES.length > 0 : true))

const CONTENTS = [
  `${SLIDES.length} topics`,
  CASES.length ? `${CASES.length} leading cases` : '',
  `${QUIZ.length} concept questions`,
  `${CARDS.length} flashcards`,
].filter(Boolean)

export default function HomePage() {
  const progress = useProgress()
  const stats = UNITS.map((u) => ({ unit: u, s: unitStats(progress, u.id) }))
  const overall = stats.reduce((a, x) => a + x.s.mastery, 0) / stats.length
  const understood = SLIDES.filter((s) => progress.understood[s.id]).length
  const mastered = stats.reduce((a, x) => a + x.s.cardsMastered, 0)
  const bests = stats.map((x) => x.s.quizBest).filter((v): v is number => v != null)
  const quizAvg = bests.length ? Math.round(bests.reduce((a, b) => a + b, 0) / bests.length) : null
  const streak = studyStreak(progress)
  const last = slideById(progress.lastSlide)
  const resume = last ?? SLIDES[0]
  const started = understood > 0 || bests.length > 0 || Object.keys(progress.cards).length > 0
  const weakest = started ? stats.slice().sort((a, b) => a.s.mastery - b.s.mastery)[0] : null

  return (
    <div className="page home">
      <motion.section className="home-hero" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, ease: easeOut }}>
        <div className="home-hero__blobs" aria-hidden="true">
          <span />
          <span />
          <span />
        </div>
        <div className="home-hero__text">
          <div className="eyebrow">
            <Sparkles size={14} aria-hidden="true" /> {greeting()}
          </div>
          <h1 className="home-hero__title">
            Master <span className="gradient-text">{SUBJECT.title}</span>, one unit at a time.
          </h1>
          <p className="home-hero__sub">
            {CONTENTS.slice(0, -1).join(', ')} and {CONTENTS[CONTENTS.length - 1]}, all built from your notes
            {SUBJECT.subtitle ? ` on the ${SUBJECT.subtitle}` : ''}.
          </p>
          <div className="home-hero__ctas">
            <Link className="btn btn-primary btn-lg" to={`/learn/${resume.id}`}>
              <BookOpen size={18} aria-hidden="true" /> {last ? 'Continue reading' : 'Start reading'}
            </Link>
            <Link className="btn btn-lg" to="/quiz?count=10&start=1">
              <ListChecks size={18} aria-hidden="true" /> Quick quiz
            </Link>
            <Link className="btn btn-lg btn-ghost" to={`/tutor/${resume.id}`}>
              <Headphones size={18} aria-hidden="true" /> Listen
            </Link>
          </div>
          {last && (
            <p className="home-hero__resume">
              Last read: <b>{last.title}</b> · {getUnit(last.unitId).short}
            </p>
          )}
        </div>
        <div className="home-hero__ring">
          <ProgressRing value={overall} size={176} stroke={14} color="var(--brand)" label={`Overall mastery ${Math.round(overall * 100)}%`}>
            <div className="home-hero__ring-inner">
              <b>
                <CountUp value={Math.round(overall * 100)} suffix="%" />
              </b>
              <span>overall mastery</span>
            </div>
          </ProgressRing>
        </div>
      </motion.section>

      <motion.section className="home-stats" variants={stagger(0.06, 0.15)} initial="hidden" animate="show" aria-label="Your progress">
        <motion.div className="home-stat card" variants={fadeUp}>
          <BookOpen size={18} aria-hidden="true" />
          <b>
            <CountUp value={understood} />
            <small> / {SLIDES.length}</small>
          </b>
          <span>topics understood</span>
        </motion.div>
        <motion.div className="home-stat card" variants={fadeUp}>
          <Layers size={18} aria-hidden="true" />
          <b>
            <CountUp value={mastered} />
            <small> / {CARDS.length}</small>
          </b>
          <span>flashcards mastered</span>
        </motion.div>
        <motion.div className="home-stat card" variants={fadeUp}>
          <Target size={18} aria-hidden="true" />
          <b>{quizAvg == null ? '–' : <CountUp value={quizAvg} suffix="%" />}</b>
          <span>average best quiz score</span>
        </motion.div>
        <motion.div className={`home-stat card${streak > 0 ? ' is-hot' : ''}`} variants={fadeUp}>
          <Flame size={18} aria-hidden="true" />
          <b>
            <CountUp value={streak} />
            <small> {streak === 1 ? 'day' : 'days'}</small>
          </b>
          <span>study streak</span>
        </motion.div>
      </motion.section>

      {weakest && weakest.s.mastery < 1 && (
        <motion.section
          className="home-focus card"
          style={unitVars(weakest.unit.id)}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.25, ease: easeOut }}
        >
          <div className="home-focus__text">
            <div className="eyebrow">Focus next</div>
            <h2>
              {weakest.unit.short}: {weakest.unit.name}
            </h2>
            <p>
              Your weakest unit so far, at {Math.round(weakest.s.mastery * 100)}% mastery. A short quiz shows you which gaps to fill.
            </p>
          </div>
          <div className="home-focus__actions">
            <Link className="btn btn-unit" to={`/quiz?units=${weakest.unit.id}&count=10&start=1`}>
              Quiz this unit <ArrowRight size={16} aria-hidden="true" />
            </Link>
            <Link className="btn" to={`/revise/${weakest.unit.id}`}>
              Rapid revision
            </Link>
          </div>
        </motion.section>
      )}

      <section className="home-section">
        <div className="home-section__head">
          <h2>Your study path</h2>
          <p>Six units, colour-coded everywhere so each one has its own place in your memory.</p>
        </div>
        <motion.div className="home-units" variants={stagger(0.07, 0.2)} initial="hidden" animate="show">
          {stats.map(({ unit: u, s }) => {
            const slides = slidesOfUnit(u.id)
            const next = slides.find((sl) => !progress.understood[sl.id]) ?? slides[0]
            const topics = partsOfUnit(u.id).filter((p) => !p.isPractice).length
            const cases = CASES.filter((c) => c.unitId === u.id).length
            return (
              <motion.article key={u.id} className="home-unit card" style={unitVars(u.id)} variants={fadeUp} whileHover={{ y: -4 }} transition={{ type: 'spring', stiffness: 400, damping: 28 }}>
                <div className="home-unit__top">
                  <UnitPill unitId={u.id} />
                  {u.hours > 0 && <span className="home-unit__hours">{u.hours} hrs</span>}
                </div>
                <h3 className="home-unit__name">{u.name}</h3>
                <div className="home-unit__body">
                  <ProgressRing value={s.mastery} size={68} stroke={7} label={`${u.short} mastery ${Math.round(s.mastery * 100)}%`}>
                    <b className="home-unit__pct">{Math.round(s.mastery * 100)}%</b>
                  </ProgressRing>
                  <dl className="home-unit__stats">
                    <div>
                      <dt>Notes</dt>
                      <dd>
                        {s.slidesUnderstood}/{s.slidesTotal}
                      </dd>
                    </div>
                    <div>
                      <dt>Quiz best</dt>
                      <dd>{s.quizBest == null ? '–' : `${s.quizBest}%`}</dd>
                    </div>
                    <div>
                      <dt>Cards</dt>
                      <dd>
                        {s.cardsMastered}/{s.cardsTotal}
                      </dd>
                    </div>
                  </dl>
                </div>
                <p className="home-unit__meta">
                  {topics} topics · {cases} cases · {s.quizQuestions} questions
                </p>
                <div className="home-unit__actions">
                  <Link className="btn btn-sm btn-unit" to={`/learn/${next.id}`}>
                    <BookOpen size={14} aria-hidden="true" /> Read
                  </Link>
                  <Link className="btn btn-sm" to={`/tutor/${next.id}`}>
                    <Headphones size={14} aria-hidden="true" /> Listen
                  </Link>
                  <Link className="btn btn-sm" to={`/quiz?units=${u.id}&count=10&start=1`}>
                    <ListChecks size={14} aria-hidden="true" /> Quiz
                  </Link>
                  <Link className="btn btn-sm" to={`/flashcards?unit=${u.id}`}>
                    <Layers size={14} aria-hidden="true" /> Cards
                  </Link>
                </div>
              </motion.article>
            )
          })}
        </motion.div>
      </section>

      <section className="home-section">
        <div className="home-section__head">
          <h2>Make it stick</h2>
          <p>Different ways to practise recall, because reading alone fades fast.</p>
        </div>
        <motion.div className="home-tools" variants={stagger(0.05, 0.1)} initial="hidden" whileInView="show" viewport={{ once: true, amount: 0.2 }}>
          {TOOLS.map((t) => {
            const Icon = t.icon
            return (
              <motion.div key={t.to} variants={fadeUp}>
                <Link to={t.to} className="home-tool card">
                  <span className="home-tool__icon">
                    <Icon size={20} aria-hidden="true" />
                  </span>
                  <b>{t.title}</b>
                  <span>{t.hook}</span>
                  <ArrowRight size={16} className="home-tool__arrow" aria-hidden="true" />
                </Link>
              </motion.div>
            )
          })}
        </motion.div>
      </section>

      {SUBJECTS.length > 1 && (
        <section className="home-section">
          <div className="home-section__head">
            <h2>Your subjects</h2>
            <p>Each subject keeps its own progress.</p>
          </div>
          <div className="home-materials">
            {SUBJECTS.map((s) => (
              <button
                key={s.id}
                type="button"
                className={`home-material card${s.id === SUBJECT.id ? ' is-current' : ''}`}
                onClick={() => s.id !== SUBJECT.id && switchSubject(s.id)}
                aria-current={s.id === SUBJECT.id ? 'true' : undefined}
              >
                <BookOpen size={22} aria-hidden="true" />
                <span>
                  <b>{s.title}</b>
                  <small>{s.id === SUBJECT.id ? 'Studying now' : s.subtitle}</small>
                </span>
                <ArrowRight size={16} aria-hidden="true" />
              </button>
            ))}
          </div>
        </section>
      )}

      <section className="home-section">
        <div className="home-section__head">
          <h2>Source material</h2>
          <p>The original PDFs, for when you want the full text.</p>
        </div>
        <div className="home-materials">
          {MATERIALS.map((m) => (
            <a key={m.id} className="home-material card" href={m.url} target="_blank" rel="noopener">
              <FileText size={22} aria-hidden="true" />
              <span>
                <b>{m.title}</b>
                <small>{m.subtitle}</small>
              </span>
              <ArrowRight size={16} aria-hidden="true" />
            </a>
          ))}
        </div>
      </section>

      <p className="home-tip">
        Tip: press <span className="kbd">Ctrl</span> <span className="kbd">K</span> or <span className="kbd">/</span> to search every note, case and key figure.
      </p>
    </div>
  )
}
