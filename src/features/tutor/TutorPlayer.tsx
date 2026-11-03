import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { BookOpen, CircleAlert, Gauge, LayoutList, ListChecks, Repeat, Volume2, VolumeX } from 'lucide-react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import PageHeader from '../../components/PageHeader'
import UnitPill from '../../components/UnitPill'
import { getUnit, PARTS, SLIDES, unitVars, type QuizItem, type Slide } from '../../data'
import { recordQuizAnswer, setLastSlide } from '../../lib/progress'
import { shuffle } from '../../lib/text'
import { LessonEnd, UpNext } from './EndCards'
import { PREF_AUTO_CONTINUE, PREF_QUICK_CHECK, PREF_TRANSCRIPT, useBoolPref } from './prefs'
import Presenter, { type PresenterMood } from './Presenter'
import QuickCheck from './QuickCheck'
import { markAsked, quickCheckFor } from './matchQuestion'
import { scriptFor, transcriptText, type Segment } from './script'
import { speechify } from './speechText'
import Stage, { NO_HIGHLIGHT, type Highlight } from './Stage'
import Transcript from './Transcript'
import { keepFocus, Scrubber, Transport } from './Transport'
import { RATES, useSpeech, voiceRank, type SpeechItem } from './useSpeech'

type Phase = 'lesson' | 'quiz' | 'next' | 'end'

/** Router state passed when a lesson is opened from the picker or continues on its own. */
export interface TutorNavState {
  /** Part key when playing a whole topic. */
  topic?: string
  /** Set by a click just before navigating; the lesson starts speaking if this is recent. */
  autoplayAt?: number
  /** Continuing straight on from the previous slide: use a short intro. */
  continued?: boolean
}

const AUTOPLAY_WINDOW_MS = 5000
const NEXT_DELAY_MS = 2600

function pauseAfter(seg: Segment, next: Segment | undefined): number {
  if (!next) return 0
  if (seg.kind === 'intro') return 550
  if (seg.more) return 60
  if (next.block !== seg.block) return 380
  return 170
}

function accentFor(kind: Segment['kind'] | 'quiz' | 'end'): string {
  switch (kind) {
    case 'focus':
      return 'var(--warn)'
    case 'recap':
    case 'end':
      return 'var(--ok)'
    case 'quiz':
      return 'var(--brand)'
    default:
      return 'var(--unit)'
  }
}

function wordsIn(text: string): number {
  return text.split(/\s+/).filter(Boolean).length
}

function isTyping(target: EventTarget | null): boolean {
  const t = target as HTMLElement | null
  if (!t) return false
  return t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName)
}

export default function TutorPlayer({ slide }: { slide: Slide }) {
  const navigate = useNavigate()
  const location = useLocation()
  const unit = getUnit(slide.unitId)

  /* Read the navigation intent once per navigation (not on every render). */
  const entryRef = useRef<{ key: string; autoplay: boolean; brief: boolean; topic: string | null } | null>(null)
  if (!entryRef.current || entryRef.current.key !== location.key) {
    const nav = (location.state ?? {}) as TutorNavState
    const autoplay = typeof nav.autoplayAt === 'number' && Date.now() - nav.autoplayAt < AUTOPLAY_WINDOW_MS
    entryRef.current = { key: location.key, autoplay, brief: autoplay && !!nav.continued, topic: nav.topic ?? null }
  }
  const entry = entryRef.current

  const [autoContinue, setAutoContinue] = useBoolPref(PREF_AUTO_CONTINUE, false)
  const [quickCheckOn, setQuickCheckOn] = useBoolPref(PREF_QUICK_CHECK, true)
  const [transcriptOpen, setTranscriptOpen] = useBoolPref(PREF_TRANSCRIPT, false)

  const script = useMemo(() => scriptFor(slide, { brief: entry.brief }), [slide, entry.brief])
  const segments = script.segments
  const items = useMemo<SpeechItem[]>(
    () => segments.map((s, i) => ({ text: s.speech, starts: s.speechStarts, pauseAfter: pauseAfter(s, segments[i + 1]) })),
    [segments],
  )
  const minutes = useMemo(() => Math.max(1, Math.round(segments.reduce((n, s) => n + wordsIn(s.speech), 0) / 150)), [segments])

  const topicPart = entry.topic ? PARTS.find((p) => p.key === entry.topic && p.slides.some((s) => s.id === slide.id)) : undefined
  const posInTopic = topicPart ? topicPart.slides.findIndex((s) => s.id === slide.id) : -1
  const nextInTopic = topicPart ? (topicPart.slides[posInTopic + 1] ?? null) : null
  const prevSlide = SLIDES[slide.index - 1] ?? null
  const nextSlide = SLIDES[slide.index + 1] ?? null
  const autoTarget = topicPart ? nextInTopic : autoContinue ? nextSlide : null
  const part = PARTS.find((p) => p.unitId === slide.unitId && p.slides.some((s) => s.id === slide.id))
  const posInPart = part ? part.slides.findIndex((s) => s.id === slide.id) : 0

  const [speech, ctl] = useSpeech()
  const [phase, setPhase] = useState<Phase>('lesson')
  const [question, setQuestion] = useState<QuizItem | null>(null)
  const [options, setOptions] = useState<string[]>([])
  const [picked, setPicked] = useState<string | null>(null)
  const [upNext, setUpNext] = useState<Slide | null>(null)
  const startedRef = useRef(false)

  const planned = useMemo(() => (quickCheckOn ? quickCheckFor(slide) : null), [slide, quickCheckOn])

  /* ---------- navigation ---------- */

  const go = useCallback(
    (target: Slide, opts: { autoplay: boolean; continued?: boolean }) => {
      const state: TutorNavState = {
        topic: topicPart && topicPart.slides.some((s) => s.id === target.id) ? topicPart.key : undefined,
        autoplayAt: opts.autoplay ? Date.now() : undefined,
        continued: opts.continued,
      }
      navigate(`/tutor/${target.id}`, { replace: true, state })
    },
    [navigate, topicPart],
  )

  /* ---------- load the lesson when the slide (or navigation) changes ---------- */

  useEffect(() => {
    ctl.load(items)
    setPhase('lesson')
    setQuestion(null)
    setPicked(null)
    setUpNext(null)
    startedRef.current = false
    if (entry.autoplay) ctl.play()
  }, [ctl, items, entry])

  useEffect(() => {
    if ((speech.status === 'speaking' || speech.saying) && !startedRef.current) {
      startedRef.current = true
      setLastSlide(slide.id)
    }
  }, [speech.status, speech.saying, slide.id])

  /* ---------- lesson flow ---------- */

  const afterSlide = () => {
    ctl.cancelSay()
    if (autoTarget) {
      setUpNext(autoTarget)
      setPhase('next')
    } else setPhase('end')
  }

  const quizIntro = (q: QuizItem) => `${q.concept ? `Quick check on ${speechify(q.concept)}.` : 'Quick check.'} ${speechify(q.question)}`

  const feedbackSpeech = (q: QuizItem, opt: string) =>
    opt === q.answer
      ? `Correct! ${speechify(q.why)}`
      : `Not quite. The answer is: ${speechify(q.answer)}. ${speechify(q.why)}`

  const startQuiz = (q: QuizItem) => {
    markAsked(q.id)
    setQuestion(q)
    setOptions(shuffle([q.answer, ...q.distractors]))
    setPicked(null)
    setPhase('quiz')
    ctl.say(quizIntro(q))
  }

  const pick = (opt: string) => {
    if (!question || picked !== null) return
    setPicked(opt)
    recordQuizAnswer(question.id, opt === question.answer)
    ctl.say(feedbackSpeech(question, opt), () => {
      if (autoTarget) flowRef.current.afterSlide()
    })
  }

  const replay = () => {
    setPhase('lesson')
    setQuestion(null)
    setPicked(null)
    setUpNext(null)
    ctl.jump(0, true)
  }

  // Latest callbacks for engine events and the keyboard (avoids stale closures).
  const flowRef = useRef({ afterSlide, finish: () => {} })
  flowRef.current = {
    afterSlide,
    finish: () => {
      if (planned) startQuiz(planned)
      else afterSlide()
    },
  }

  useEffect(() => {
    ctl.onFinish = () => flowRef.current.finish()
    return () => {
      ctl.onFinish = null
    }
  }, [ctl])

  useEffect(() => {
    if (phase !== 'next' || !upNext) return
    const t = window.setTimeout(() => go(upNext, { autoplay: true, continued: true }), NEXT_DELAY_MS)
    return () => clearTimeout(t)
  }, [phase, upNext, go])

  /* ---------- transport actions (depend on the phase) ---------- */

  const active = speech.status === 'speaking' || speech.saying || phase === 'next'

  const toggle = () => {
    if (phase === 'lesson') ctl.toggle()
    else if (phase === 'quiz' && question) {
      if (speech.saying) ctl.cancelSay()
      else ctl.say(picked !== null ? feedbackSpeech(question, picked) : quizIntro(question))
    } else if (phase === 'next') setPhase('end')
    else replay()
  }

  const prevPart = () => {
    if (phase === 'lesson') ctl.prev()
    else {
      setPhase('lesson')
      setUpNext(null)
      ctl.jump(segments.length - 1, true)
    }
  }

  const nextPart = () => {
    if (phase === 'lesson') ctl.next()
    else if (phase === 'quiz') afterSlide()
    else if (phase === 'next' && upNext) go(upNext, { autoplay: true, continued: true })
    else if (phase === 'end' && nextSlide) go(nextSlide, { autoplay: true })
  }

  const toPrevSlide = () => prevSlide && go(prevSlide, { autoplay: active })
  const toNextSlide = () => nextSlide && go(nextSlide, { autoplay: active })

  const jumpTo = (i: number) => {
    setPhase('lesson')
    setUpNext(null)
    ctl.jump(i, true)
  }

  const seek = (i: number) => {
    if (phase !== 'lesson') {
      setPhase('lesson')
      setUpNext(null)
      ctl.jump(i, true)
    } else ctl.jump(i)
  }

  const keysRef = useRef({ toggle, prevPart, nextPart, toPrevSlide, toNextSlide, pick: (_i: number) => {} })
  keysRef.current = {
    toggle,
    prevPart,
    nextPart,
    toPrevSlide,
    toNextSlide,
    pick: (i: number) => {
      if (phase === 'quiz' && picked === null && options[i]) pick(options[i])
    },
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey) return
      if (document.body.dataset.modal === 'open' || isTyping(e.target)) return
      const k = keysRef.current
      const target = e.target as HTMLElement | null
      if (e.key === ' ' || e.key === 'Spacebar') {
        // A focused button already reacts to Space; don't double-toggle.
        if (target?.closest('button, a, [role="button"], summary')) return
        e.preventDefault()
        k.toggle()
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault()
        if (e.shiftKey) k.toPrevSlide()
        else k.prevPart()
      } else if (e.key === 'ArrowRight') {
        e.preventDefault()
        if (e.shiftKey) k.toNextSlide()
        else k.nextPart()
      } else if (!e.shiftKey && /^[1-4]$/.test(e.key)) {
        k.pick(Number(e.key) - 1)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  /* ---------- derived view state ---------- */

  const seg = segments[Math.min(speech.index, segments.length - 1)]
  let hl: Highlight = NO_HIGHLIGHT
  if (phase === 'lesson' && seg) {
    const live = speech.status === 'speaking' || (speech.status === 'paused' && speech.word >= 0)
    if (live && speech.wordSync) hl = { mode: 'word', range: speech.word >= 0 ? (seg.wordMap[speech.word] ?? [-1, -1]) : [-1, -1] }
    else if (speech.status === 'speaking') hl = { mode: 'line' }
  }

  const talking = speech.status === 'speaking' || speech.saying
  const mood: PresenterMood = talking ? 'speaking' : phase === 'quiz' && picked === null ? 'listening' : speech.status === 'paused' ? 'paused' : 'idle'
  const accent = accentFor(phase === 'lesson' ? (seg?.kind ?? 'text') : phase === 'quiz' ? 'quiz' : 'end')

  let status: string
  if (phase === 'quiz') status = picked === null ? 'Quick check — your turn' : picked === question?.answer ? 'Well done' : 'Let’s fix that'
  else if (phase === 'next') status = 'Moving on…'
  else if (phase === 'end') status = topicPart && !nextInTopic ? 'Topic complete' : 'Lesson complete'
  else if (speech.status === 'idle') status = 'Ready when you are'
  else if (speech.status === 'paused') status = 'Paused'
  else if (speech.status === 'done') status = 'Finished'
  else status = seg?.kind === 'intro' ? 'Introducing the lesson' : seg?.kind === 'recap' ? 'Recapping' : seg?.label || 'Explaining'

  let playLabel: string
  let playing: boolean
  if (phase === 'lesson') {
    playing = speech.status === 'speaking'
    playLabel = playing ? 'Pause' : speech.status === 'paused' ? 'Resume' : speech.status === 'done' ? 'Replay' : 'Play lesson'
  } else if (phase === 'quiz') {
    playing = speech.saying
    playLabel = playing ? 'Stop reading' : 'Read it again'
  } else if (phase === 'next') {
    playing = true
    playLabel = 'Stay on this lesson'
  } else {
    playing = false
    playLabel = 'Replay lesson'
  }

  const quizState = !planned && !question ? 'none' : phase === 'quiz' ? 'now' : phase === 'lesson' ? 'todo' : 'done'
  const transcriptIndex = phase === 'lesson' ? speech.index : segments.length
  const liveText =
    phase === 'lesson' ? (seg ? transcriptText(seg) : '') : phase === 'quiz' ? (question?.question ?? '') : phase === 'next' ? `Up next: ${upNext?.title ?? ''}` : status

  const englishVoices = useMemo(() => {
    const en = speech.voices.filter((v) => v.lang.toLowerCase().startsWith('en'))
    const list = en.length ? en : speech.voices
    return [...list].sort((a, b) => voiceRank(b) - voiceRank(a) || a.name.localeCompare(b.name))
  }, [speech.voices])

  const showStart = phase === 'lesson' && speech.status === 'idle'

  return (
    <div className="page tt-root" style={unitVars(slide.unitId)}>
      <PageHeader
        eyebrow={
          <>
            <UnitPill unitId={slide.unitId} /> Listen &amp; explain
          </>
        }
        title={slide.title}
        subtitle={
          topicPart
            ? `Playing the whole topic: ${topicPart.title} · lesson ${posInTopic + 1} of ${topicPart.slides.length}`
            : `${slide.part !== slide.title ? `${slide.part} · ` : ''}${unit.name}${part && part.slides.length > 1 ? ` · lesson ${posInPart + 1} of ${part.slides.length}` : ''}`
        }
        actions={
          <>
            <Link className="btn" to="/tutor">
              <LayoutList size={16} /> All lessons
            </Link>
            <Link className="btn" to={`/learn/${slide.id}`}>
              <BookOpen size={16} /> Open in notes
            </Link>
          </>
        }
      />

      <p className="sr-only" aria-live="polite">
        {liveText}
      </p>

      <AnimatePresence initial={false}>
        {(speech.notice || speech.silent) && (
          <motion.div
            className="tt-notice"
            role="status"
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
          >
            {speech.silent ? <VolumeX size={18} aria-hidden="true" /> : <CircleAlert size={18} aria-hidden="true" />}
            <span>
              {speech.notice ??
                (speech.supported
                  ? 'Silent captions are on: the lesson advances on its own without sound.'
                  : 'This browser cannot speak aloud, so the lesson plays as timed captions. Chrome, Edge and Safari can read it to you.')}
            </span>
            {speech.supported && !speech.silent && (
              <button type="button" className="btn btn-sm" onClick={() => ctl.setSilent(true)}>
                Use silent captions
              </button>
            )}
            {speech.supported && speech.silent && (
              <button type="button" className="btn btn-sm" onClick={() => ctl.setSilent(false)}>
                <Volume2 size={14} /> Turn the voice on
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      <div className="tt-layout">
        <section className="tt-stage" aria-label="Lesson stage" data-mood={mood}>
          <div className="tt-stage-top">
            <Presenter mood={mood} accent={accent} />
            <div className="tt-status">
              <p className="tt-status-main">{status}</p>
              <p className="tt-status-sub">
                {phase === 'lesson'
                  ? `Part ${Math.min(speech.index + 1, segments.length)} of ${segments.length}`
                  : phase === 'quiz'
                    ? 'Answer to continue'
                    : slide.title}
                {speech.activeVoice && !speech.silent && <span className="tt-voice-name"> · {speech.activeVoice.name}</span>}
              </p>
            </div>
          </div>

          <div className="tt-stage-body" style={{ '--tt-accent': accent } as CSSProperties}>
            <AnimatePresence mode="wait" initial={false}>
              {phase === 'lesson' && seg && (
                <motion.div key="lesson" className="tt-stage-slot" exit={{ opacity: 0, transition: { duration: 0.15 } }}>
                  <Stage slide={slide} segment={seg} hl={hl} count={segments.length} minutes={minutes} />
                </motion.div>
              )}
              {phase === 'quiz' && question && (
                <motion.div key="quiz" className="tt-stage-slot" exit={{ opacity: 0, transition: { duration: 0.15 } }}>
                  <QuickCheck
                    question={question}
                    options={options}
                    picked={picked}
                    onPick={pick}
                    onSkip={afterSlide}
                    onContinue={afterSlide}
                    continueLabel={autoTarget ? 'Next lesson' : 'Continue'}
                  />
                </motion.div>
              )}
              {phase === 'next' && upNext && (
                <motion.div key="next" className="tt-stage-slot" exit={{ opacity: 0, transition: { duration: 0.15 } }}>
                  <UpNext
                    next={upNext}
                    delayMs={NEXT_DELAY_MS}
                    onNow={() => go(upNext, { autoplay: true, continued: true })}
                    onStay={() => setPhase('end')}
                  />
                </motion.div>
              )}
              {phase === 'end' && (
                <motion.div key="end" className="tt-stage-slot" exit={{ opacity: 0, transition: { duration: 0.15 } }}>
                  <LessonEnd
                    slide={slide}
                    next={topicPart ? (nextInTopic ?? nextSlide) : nextSlide}
                    topicTitle={topicPart && !nextInTopic ? topicPart.title : null}
                    quizResult={question && picked !== null ? picked === question.answer : null}
                    onReplay={replay}
                    onNext={() => {
                      const target = topicPart ? (nextInTopic ?? nextSlide) : nextSlide
                      if (target) go(target, { autoplay: true })
                    }}
                  />
                </motion.div>
              )}
            </AnimatePresence>

            <AnimatePresence>
              {showStart && (
                <motion.div
                  className="tt-start"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 6, transition: { duration: 0.15 } }}
                >
                  <button type="button" className="btn btn-unit btn-lg tt-start-btn" onClick={() => ctl.play()}>
                    <Volume2 size={20} /> Start the lesson
                  </button>
                  <span className="tt-start-hint">
                    or press <kbd className="kbd">Space</kbd>
                  </span>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <div className="tt-stage-foot">
            <Scrubber
              segments={segments}
              index={phase === 'lesson' ? speech.index : segments.length - 1}
              quiz={quizState}
              finished={phase !== 'lesson'}
              onSeek={seek}
            />
            <Transport
              playing={playing}
              playLabel={playLabel}
              onToggle={toggle}
              onPrev={prevPart}
              onNext={nextPart}
              onPrevSlide={toPrevSlide}
              onNextSlide={toNextSlide}
              canPrev={phase !== 'lesson' || speech.index > 0}
              canNext={phase === 'lesson' || phase === 'quiz' || phase === 'next' || !!nextSlide}
              canPrevSlide={!!prevSlide}
              canNextSlide={!!nextSlide}
            />
          </div>
        </section>

        <Transcript
          segments={segments}
          current={transcriptIndex}
          hl={phase === 'lesson' ? hl : NO_HIGHLIGHT}
          quizLabel={planned ? `Quick check${planned.concept ? `: ${planned.concept}` : ''}` : null}
          open={transcriptOpen}
          onToggle={() => setTranscriptOpen(!transcriptOpen)}
          onJump={jumpTo}
        />
      </div>

      <div className="tt-settings card">
        <label className="tt-field">
          <span className="tt-field-label">
            <Gauge size={15} aria-hidden="true" /> Speed
          </span>
          <select className="select tt-select" value={String(speech.rate)} onChange={(e) => ctl.setRate(Number(e.target.value))}>
            {RATES.map((r) => (
              <option key={r} value={String(r)}>
                {r}×
              </option>
            ))}
          </select>
        </label>
        <label className="tt-field tt-field--voice">
          <span className="tt-field-label">
            <Volume2 size={15} aria-hidden="true" /> Voice
          </span>
          <select
            className="select tt-select"
            value={speech.voiceURI && speech.voices.some((v) => v.uri === speech.voiceURI) ? speech.voiceURI : ''}
            onChange={(e) => ctl.setVoice(e.target.value)}
            disabled={!speech.supported || speech.silent || speech.voices.length === 0}
          >
            <option value="">{speech.activeVoice ? `Automatic (${speech.activeVoice.name})` : 'Automatic'}</option>
            {englishVoices.map((v) => (
              <option key={v.uri} value={v.uri}>
                {v.name} ({v.lang})
              </option>
            ))}
          </select>
        </label>
        <div className="tt-toggles">
          <button type="button" className="chip" onMouseDown={keepFocus} aria-pressed={autoContinue} onClick={() => setAutoContinue(!autoContinue)}>
            <Repeat size={14} aria-hidden="true" /> Auto-continue to the next slide
          </button>
          <button type="button" className="chip" onMouseDown={keepFocus} aria-pressed={quickCheckOn} onClick={() => setQuickCheckOn(!quickCheckOn)}>
            <ListChecks size={14} aria-hidden="true" /> Quick check
          </button>
        </div>
        <p className="tt-keys">
          <span>
            <kbd className="kbd">Space</kbd> play / pause
          </span>
          <span>
            <kbd className="kbd">←</kbd> <kbd className="kbd">→</kbd> part
          </span>
          <span>
            <kbd className="kbd">Shift</kbd> + <kbd className="kbd">←</kbd> <kbd className="kbd">→</kbd> slide
          </span>
        </p>
      </div>
    </div>
  )
}
