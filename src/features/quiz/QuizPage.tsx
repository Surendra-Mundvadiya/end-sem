import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useLocation, useSearchParams } from 'react-router-dom'
import confetti from 'canvas-confetti'
import type { UnitId } from '../../data'
import { getProgress, recordQuizAnswer, recordQuizResult } from '../../lib/progress'
import { easeOut } from '../../lib/motion'
import { shuffle } from '../../lib/text'
import QuizResults from './QuizResults'
import QuizRun from './QuizRun'
import QuizSetup from './QuizSetup'
import {
  DEFAULT_CONFIG,
  clearSession,
  configFromParams,
  createRun,
  hasQuizParams,
  isWeak,
  loadSavedConfig,
  loadSession,
  makeRun,
  pctOf,
  saveConfig,
  saveResults,
  saveRunning,
  summarize,
  weakItems,
  type Outcome,
  type QuizConfig,
  type Run,
  type RunProgress,
  type Summary,
} from './engine'
import './quiz.css'

/*
 * Quiz: setup -> running -> results.
 * URL: /quiz?units=u1,u3&count=10&mode=practice|exam|weak&start=1
 */

type View =
  | { phase: 'setup' }
  | { phase: 'running'; run: Run; resume?: RunProgress }
  | { phase: 'results'; outcome: Outcome; summary: Summary; newBest: UnitId[]; cleared: number | null }

interface Boot {
  config: QuizConfig
  view: View
  notice: string | null
}

const NO_WEAK = 'No weak spots yet. Questions you miss collect here, so start with a practice round.'
const NO_WEAK_HERE = 'No weak spots in the selected units yet. Add units or choose another mode.'

const VIEW_MOTION = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.4, ease: easeOut } },
  exit: { opacity: 0, y: -10, transition: { duration: 0.18, ease: easeOut } },
}

function withoutStart(params: URLSearchParams): string {
  const p = new URLSearchParams(params)
  p.delete('start')
  return p.toString()
}

const hasWeakSpots = () => weakItems(getProgress().quizStats).length > 0

/** Initial state from the URL, an unfinished quiz in this tab, or the remembered setup. */
function boot(params: URLSearchParams): Boot {
  const fromUrl = hasQuizParams(params)
  const start = params.get('start') === '1'
  let config = fromUrl ? configFromParams(params) : (loadSavedConfig() ?? DEFAULT_CONFIG)

  // Back, refresh or the nav link after leaving mid-quiz (e.g. to review a concept) picks up where you were.
  if (!start) {
    const restored = loadSession(withoutStart(params))
    if (restored?.kind === 'running') {
      return { config, view: { phase: 'running', run: restored.run, resume: restored.state }, notice: null }
    }
    if (restored?.kind === 'results') {
      const { outcome, newBest, cleared } = restored
      return { config, view: { phase: 'results', outcome, summary: summarize(outcome), newBest, cleared }, notice: null }
    }
  }

  if (config.mode === 'weak' && !hasWeakSpots()) {
    config = { ...config, mode: 'practice' }
    return { config, view: { phase: 'setup' }, notice: fromUrl ? NO_WEAK : null }
  }
  if (start) {
    const run = createRun(config, getProgress().quizStats)
    return run ? { config, view: { phase: 'running', run }, notice: null } : { config, view: { phase: 'setup' }, notice: NO_WEAK_HERE }
  }
  return { config, view: { phase: 'setup' }, notice: null }
}

/** canvas-confetti needs real colour values, so read the unit tokens from the stylesheet. */
function tokenColors(): string[] {
  const css = getComputedStyle(document.documentElement)
  return ['--u1', '--u2', '--u3', '--u4', '--u5', '--u6', '--ok']
    .map((v) => css.getPropertyValue(v).trim())
    .filter((c) => /^#[0-9a-f]{3,8}$/i.test(c))
}

function celebrate() {
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return
  const colors = tokenColors()
  const base = { disableForReducedMotion: true, zIndex: 1200, ...(colors.length ? { colors } : {}) }
  window.setTimeout(() => {
    void confetti({ ...base, particleCount: 90, spread: 78, startVelocity: 44, origin: { x: 0.5, y: 0.32 } })
    window.setTimeout(() => {
      void confetti({ ...base, particleCount: 55, angle: 60, spread: 62, origin: { x: 0, y: 0.72 } })
      void confetti({ ...base, particleCount: 55, angle: 120, spread: 62, origin: { x: 1, y: 0.72 } })
    }, 240)
  }, 520)
}

export default function QuizPage() {
  const location = useLocation()
  const [params, setParams] = useSearchParams()
  const [initial] = useState(() => boot(params))
  const [config, setConfig] = useState(initial.config)
  const [view, setView] = useState<View>(initial.view)
  const [notice, setNotice] = useState(initial.notice)
  const rootRef = useRef<HTMLDivElement>(null)
  const handledKey = useRef(location.key)
  const lastStart = useRef(0)
  const search = withoutStart(params)

  // A link with start=1 starts a quiz, even while this page is open. The flag is then dropped
  // (replace) so Back and refresh return to this quiz instead of starting another.
  useEffect(() => {
    if (params.get('start') !== '1') return
    if (handledKey.current !== location.key) {
      handledKey.current = location.key
      const next = boot(params)
      setConfig(next.config)
      setNotice(next.notice)
      setView(next.view)
      toTop()
    }
    setParams(new URLSearchParams(withoutStart(params)), { replace: true })
    // Keyed on the navigation only: params/setParams belong to that same navigation.
  }, [location.key])

  function toTop() {
    window.scrollTo({ top: 0 })
    const main = rootRef.current?.closest('main')
    if (main && main.scrollTop > 0) main.scrollTop = 0
  }

  function updateConfig(c: QuizConfig) {
    setConfig(c)
    saveConfig(c)
    setNotice(null)
  }

  function begin(run: Run | null) {
    const now = Date.now()
    if (now - lastStart.current < 600) return // double click / double Enter
    if (!run) {
      clearSession()
      setNotice(hasWeakSpots() ? NO_WEAK_HERE : NO_WEAK)
      setView({ phase: 'setup' })
      toTop()
      return
    }
    lastStart.current = now
    setNotice(null)
    setView({ phase: 'running', run })
    toTop()
  }

  function startFrom(c: QuizConfig) {
    begin(createRun(c, getProgress().quizStats))
  }

  function toSetup() {
    clearSession()
    setView({ phase: 'setup' })
    toTop()
  }

  /** The one place a finished quiz is scored and recorded. Called from the runner's handlers, never from an effect. */
  function handleFinish(outcome: Outcome) {
    const summary = summarize(outcome)
    if (summary.total === 0) return toSetup()
    if (outcome.run.mode === 'exam') {
      // Exams give no feedback while running, so their answers are recorded on submit.
      for (const g of summary.graded) if (g.pick !== null) recordQuizAnswer(g.q.item.id, g.correct)
    }
    const before = getProgress().quizBest
    const newBest = (Object.keys(summary.perUnit) as UnitId[]).filter((u) => {
      const t = summary.perUnit[u]
      const prev = before[u]
      return !!t && prev !== undefined && pctOf(t) > prev
    })
    recordQuizResult({ correct: summary.correct, total: summary.total, perUnit: summary.perUnit })
    let cleared: number | null = null
    if (outcome.run.mode === 'weak') {
      const stats = getProgress().quizStats
      cleared = outcome.run.questions.filter((q, i) => outcome.picks[i] !== null && !isWeak(stats[q.item.id])).length
    }
    saveResults(search, outcome, newBest, cleared)
    setView({ phase: 'results', outcome, summary, newBest, cleared })
    toTop()
    if (summary.pct >= 80) celebrate()
  }

  return (
    <div className="page qz" ref={rootRef}>
      {/* No initial={false}: it would also block the entrance animations nested inside the first view. */}
      <AnimatePresence mode="wait">
        {view.phase === 'setup' ? (
          <motion.div key="setup" {...VIEW_MOTION}>
            <QuizSetup
              config={config}
              notice={notice}
              onChange={updateConfig}
              onStart={startFrom}
              onDismissNotice={() => setNotice(null)}
            />
          </motion.div>
        ) : view.phase === 'running' ? (
          <motion.div key={`run-${view.run.id}`} {...VIEW_MOTION}>
            <QuizRun
              run={view.run}
              resume={view.resume}
              onProgress={(state) => saveRunning(search, view.run, state)}
              onFinish={handleFinish}
              onQuit={toSetup}
            />
          </motion.div>
        ) : (
          <motion.div key={`results-${view.outcome.run.id}`} {...VIEW_MOTION}>
            <QuizResults
              outcome={view.outcome}
              summary={view.summary}
              newBest={view.newBest}
              cleared={view.cleared}
              onRetryMissed={() => begin(makeRun(shuffle(view.summary.missed.map((g) => g.q.item)), 'practice', true))}
              onAgain={() => startFrom(config)}
              onNew={toSetup}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
