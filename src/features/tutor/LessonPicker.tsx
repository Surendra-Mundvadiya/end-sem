import { useMemo } from 'react'
import { motion } from 'framer-motion'
import { Check, Headphones, ListChecks, Play, Sparkles, Volume2 } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import PageHeader from '../../components/PageHeader'
import { isUnitId, partsOfUnit, slideById, UNITS, unitVars, type Part, type Slide, type UnitId } from '../../data'
import { fadeUp, stagger } from '../../lib/motion'
import { useProgress } from '../../lib/progress'
import { plural } from '../../lib/text'
import { PREF_UNIT, useStringPref } from './prefs'
import Presenter from './Presenter'
import type { TutorNavState } from './TutorPlayer'
import { unlockSpeech } from './useSpeech'

/** Rough listening time for a slide, in minutes (notes words plus the tutor's own phrases). */
function minutesFor(slide: Slide): number {
  const words = slide.plain.split(/\s+/).filter(Boolean).length
  return Math.max(1, Math.round((words + 30) / 150))
}

const canSpeak = typeof window !== 'undefined' && 'speechSynthesis' in window

export default function LessonPicker() {
  const navigate = useNavigate()
  const progress = useProgress()
  const last = slideById(progress.lastSlide)
  const [stored, setStored] = useStringPref(PREF_UNIT, last?.unitId ?? 'u1')
  const unitId: UnitId = isUnitId(stored) ? stored : 'u1'
  const parts = useMemo(() => partsOfUnit(unitId), [unitId])
  const unit = UNITS.find((u) => u.id === unitId) ?? UNITS[0]

  /** Opening a lesson from here is a click, so it may start speaking straight away. */
  const open = (slide: Slide, topic?: Part) => {
    unlockSpeech()
    const state: TutorNavState = { topic: topic?.key, autoplayAt: Date.now() }
    navigate(`/tutor/${slide.id}`, { state })
  }

  return (
    <div className="page tt-root">
      <PageHeader
        eyebrow={
          <>
            <Headphones size={14} aria-hidden="true" /> Listen &amp; explain
          </>
        }
        title={
          <>
            Your <span className="gradient-text">speaking tutor</span>
          </>
        }
        subtitle="Pick a lesson and the tutor reads your notes aloud, explains them point by point, highlights each word as it speaks and checks your understanding at the end."
        actions={
          last ? (
            <button type="button" className="btn btn-primary" onClick={() => open(last)}>
              <Play size={16} fill="currentColor" /> Resume: <span className="tt-resume-title">{last.title}</span>
            </button>
          ) : undefined
        }
      />

      <motion.section className="tt-hero card" initial="hidden" animate="show" variants={stagger(0.08)} aria-label="How the tutor works">
        <motion.div variants={fadeUp} className="tt-hero-presenter">
          <Presenter mood="speaking" accent="var(--brand)" size="lg" />
        </motion.div>
        <motion.ul variants={stagger(0.07, 0.1)} className="tt-hero-points">
          <motion.li variants={fadeUp}>
            <Volume2 size={18} aria-hidden="true" />
            <span>
              <strong>Listens like a lecture.</strong> Every paragraph, point, case and exam tip is read in order, with a short recap at the end.
            </span>
          </motion.li>
          <motion.li variants={fadeUp}>
            <Sparkles size={18} aria-hidden="true" />
            <span>
              <strong>Follow along.</strong> The words light up as they are spoken; click any line of the transcript to jump there.
            </span>
          </motion.li>
          <motion.li variants={fadeUp}>
            <ListChecks size={18} aria-hidden="true" />
            <span>
              <strong>Quick check.</strong> After a lesson the tutor asks a question on what you just heard and explains the answer.
            </span>
          </motion.li>
        </motion.ul>
      </motion.section>

      {!canSpeak && (
        <p className="tt-notice" role="status">
          This browser cannot speak aloud. Lessons will play as timed captions; Chrome, Edge or Safari can read them to you.
        </p>
      )}

      <div className="tt-unit-tabs" role="group" aria-label="Choose a unit">
        {UNITS.map((u) => (
          <button
            key={u.id}
            type="button"
            className="chip tt-unit-chip"
            style={unitVars(u.id)}
            aria-pressed={u.id === unitId}
            onClick={() => setStored(u.id)}
          >
            <span className="tt-unit-dot" aria-hidden="true" />
            {u.short}
            <span className="tt-unit-name">· {u.name}</span>
          </button>
        ))}
      </div>

      <motion.div key={unitId} className="tt-parts" initial="hidden" animate="show" variants={stagger(0.05)} style={unitVars(unitId)}>
        <motion.h2 variants={fadeUp} className="tt-parts-title">
          {unit.short} · {unit.name}
        </motion.h2>
        {parts.map((p) => {
          const mins = p.slides.reduce((n, s) => n + minutesFor(s), 0)
          return (
            <motion.article key={p.key} variants={fadeUp} className="tt-part card">
              <header className="tt-part-head">
                <div className="tt-part-text">
                  <h3 className="tt-part-title">{p.title}</h3>
                  <p className="tt-part-meta">
                    {plural(p.slides.length, 'lesson')} · about {mins} min
                  </p>
                </div>
                <button type="button" className="btn btn-unit btn-sm tt-part-play" onClick={() => open(p.slides[0], p)} aria-label={`Play the whole topic: ${p.title}`}>
                  <Play size={14} fill="currentColor" aria-hidden="true" /> {p.slides.length > 1 ? 'Play topic' : 'Play'}
                </button>
              </header>
              {p.slides.length > 1 && (
                <ol className="tt-slide-list">
                  {p.slides.map((s, i) => (
                    <li key={s.id}>
                      <button type="button" className="tt-slide-row" onClick={() => open(s)} aria-label={`Play lesson: ${s.title}`}>
                        <span className="tt-slide-no" aria-hidden="true">
                          {progress.understood[s.id] ? <Check size={13} /> : i + 1}
                        </span>
                        <span className="tt-slide-title">{s.title}</span>
                        {last?.id === s.id && <span className="tt-slide-last">Last played</span>}
                        <span className="tt-slide-time">{minutesFor(s)} min</span>
                        <Play size={14} className="tt-slide-play" aria-hidden="true" />
                      </button>
                    </li>
                  ))}
                </ol>
              )}
            </motion.article>
          )
        })}
      </motion.div>
    </div>
  )
}
