import { QUIZ, UNITS, getUnit, isUnitId, slideById, slidesOfUnit, type QuizItem, type UnitId } from '../../data'
import type { Progress } from '../../lib/progress'
import { shuffle } from '../../lib/text'

/* Pure quiz logic: configuration, question selection, grading. No React in here. */

/**
 * Show an item's concept tag on the question before it is answered. A concept name can cue the
 * answer ("Tax vs fee: quid pro quo"); set this to false to reveal the tag only with the
 * feedback and in the review.
 */
export const CONCEPT_UP_FRONT: boolean = false

/** Where to read up on a question: its own slide when known, else the first slide of its unit. */
export function studyLink(item: QuizItem): { to: string; label: string; title: string | null } | null {
  const exact = slideById(item.slideId)
  const slide = exact ?? slidesOfUnit(item.unitId)[0]
  if (!slide) return null
  return {
    to: `/learn/${slide.id}`,
    label: exact ? 'Review this concept' : `Review ${getUnit(item.unitId).short} notes`,
    title: exact ? slide.title : null,
  }
}

export type Mode = 'practice' | 'exam' | 'weak'
export type Count = number | 'all'

export interface QuizConfig {
  units: UnitId[]
  count: Count
  mode: Mode
}

export const COUNT_PRESETS = [10, 20, 40] as const
export const EXAM_SECONDS_PER_QUESTION = 45
export const ALL_UNITS: UnitId[] = UNITS.map((u) => u.id)
export const DEFAULT_CONFIG: QuizConfig = { units: ALL_UNITS, count: 10, mode: 'practice' }
/** Option letters; items normally have 4 options (answer + 3 distractors). */
export const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F'] as const

export const MODE_LABEL: Record<Mode, string> = { practice: 'Practice', exam: 'Exam', weak: 'Weak spots' }

/** Number of questions in the bank per unit. */
export const QUESTIONS_PER_UNIT: Record<UnitId, number> = Object.fromEntries(
  UNITS.map((u) => [u.id, QUIZ.filter((q) => q.unitId === u.id).length]),
) as Record<UnitId, number>

/* ---------- answer history ---------- */

export type QuizStats = Progress['quizStats']
type Stat = QuizStats[string]

/** A weak spot: more wrong than right, or got wrong the last time it was answered. */
export function isWeak(s: Stat | undefined): boolean {
  return !!s && (s.wrong > s.right || s.lastCorrect === false)
}

export function weakItems(stats: QuizStats, units?: readonly UnitId[]): QuizItem[] {
  return QUIZ.filter((q) => (!units || units.includes(q.unitId)) && isWeak(stats[q.id]))
}

export function countByUnit(items: readonly QuizItem[]): Record<UnitId, number> {
  const out = Object.fromEntries(ALL_UNITS.map((u) => [u, 0])) as Record<UnitId, number>
  for (const q of items) out[q.unitId]++
  return out
}

/** Every question the given setup can draw from. */
export function poolFor(config: QuizConfig, stats: QuizStats): QuizItem[] {
  const inUnits = QUIZ.filter((q) => config.units.includes(q.unitId))
  return config.mode === 'weak' ? inUnits.filter((q) => isWeak(stats[q.id])) : inUnits
}

export function effectiveCount(count: Count, poolSize: number): number {
  return count === 'all' ? poolSize : Math.max(0, Math.min(count, poolSize))
}

const timesAnswered = (s: Stat | undefined) => (s ? s.right + s.wrong : 0)
const weakness = (s: Stat | undefined) => (s ? s.wrong - s.right + (s.lastCorrect ? 0 : 1) : 0)

/**
 * Picks n questions. Ordinary rounds prefer the questions answered least often, so repeated
 * short quizzes work through the whole bank; weak-spot rounds prefer the most-missed ones.
 * Ties are broken randomly and the final order is shuffled.
 */
function selectQuestions(pool: readonly QuizItem[], n: number, mode: Mode, stats: QuizStats): QuizItem[] {
  const ranked = shuffle(pool)
  if (mode === 'weak') ranked.sort((a, b) => weakness(stats[b.id]) - weakness(stats[a.id]))
  else ranked.sort((a, b) => timesAnswered(stats[a.id]) - timesAnswered(stats[b.id]))
  return shuffle(ranked.slice(0, n))
}

/* ---------- runs ---------- */

export interface RunQuestion {
  item: QuizItem
  /** Answer + distractors, shuffled once when the run is created. */
  options: string[]
  /** Index of the correct option within options. */
  answer: number
}

export interface Run {
  id: number
  mode: Mode
  questions: RunQuestion[]
  /** Units covered, in syllabus order. */
  units: UnitId[]
  /** Built from the misses of an earlier quiz. */
  retry: boolean
}

let runSeq = 0

function runFrom(questions: RunQuestion[], mode: Mode, retry: boolean): Run {
  const units = ALL_UNITS.filter((u) => questions.some((q) => q.item.unitId === u))
  return { id: ++runSeq, mode, questions, units, retry }
}

const baseOptions = (item: QuizItem) => [item.answer, ...item.distractors]

export function makeRun(items: readonly QuizItem[], mode: Mode, retry = false): Run {
  const questions = items.map((item) => {
    const options = shuffle(baseOptions(item))
    return { item, options, answer: options.indexOf(item.answer) }
  })
  return runFrom(questions, mode, retry)
}

/** Builds a run from a setup, or null when the setup has no questions to draw from. */
export function createRun(config: QuizConfig, stats: QuizStats): Run | null {
  const pool = poolFor(config, stats)
  const n = effectiveCount(config.count, pool.length)
  if (n === 0) return null
  return makeRun(selectQuestions(pool, n, config.mode, stats), config.mode)
}

export function examMs(questionCount: number): number {
  return questionCount * EXAM_SECONDS_PER_QUESTION * 1000
}

/* ---------- grading ---------- */

/** complete: finished every question (or submitted the exam); ended: stopped early; timeout: exam clock ran out. */
export type EndReason = 'complete' | 'ended' | 'timeout'

export interface Outcome {
  run: Run
  /** Picked option index per question, null when unanswered. */
  picks: (number | null)[]
  reason: EndReason
  bestStreak: number
  startedAt: number
  finishedAt: number
  /** Exam only: ms left on the clock when finished. */
  msLeft: number | null
}

export interface Graded {
  /** Position in the run (0-based). */
  index: number
  q: RunQuestion
  pick: number | null
  correct: boolean
}

export type UnitTally = Partial<Record<UnitId, { correct: number; total: number }>>

export interface Summary {
  /** The questions that count towards the score. */
  graded: Graded[]
  correct: number
  total: number
  /** 0–100 */
  pct: number
  /** Only units with at least one counted question, in syllabus order. */
  perUnit: UnitTally
  missed: Graded[]
}

/** Ending early scores only the answered questions; a finished or timed-out quiz scores all of them. */
export function summarize(o: Outcome): Summary {
  const graded: Graded[] = []
  o.run.questions.forEach((q, index) => {
    const pick = o.picks[index] ?? null
    if (o.reason === 'ended' && pick === null) return
    graded.push({ index, q, pick, correct: pick === q.answer })
  })
  const perUnit: UnitTally = {}
  for (const u of ALL_UNITS) {
    const mine = graded.filter((g) => g.q.item.unitId === u)
    if (mine.length) perUnit[u] = { correct: mine.filter((g) => g.correct).length, total: mine.length }
  }
  const correct = graded.filter((g) => g.correct).length
  const total = graded.length
  return {
    graded,
    correct,
    total,
    pct: total ? Math.round((correct / total) * 100) : 0,
    perUnit,
    missed: graded.filter((g) => !g.correct),
  }
}

export function pctOf(t: { correct: number; total: number }): number {
  return t.total ? Math.round((t.correct / t.total) * 100) : 0
}

/** Below this a unit counts as weak in the results. */
export const WEAK_UNIT_PCT = 70

export function verdict(pct: number): { title: string; line: string } {
  if (pct === 100) return { title: 'Flawless', line: 'Full marks. You know this material cold.' }
  if (pct >= 90) return { title: 'Outstanding', line: 'Exam-ready. Keep it warm with a short round each day.' }
  if (pct >= 80) return { title: 'Excellent work', line: 'A strong score. Tidy up the few misses below.' }
  if (pct >= 65) return { title: 'Solid progress', line: 'Read the explanations for your misses, then go again.' }
  if (pct >= 50) return { title: 'Halfway there', line: 'Review the misses below and retry them while they are fresh.' }
  return { title: 'Back to the notes', line: 'Revisit the weak units below, then come back for another round.' }
}

/* ---------- setup <-> URL / storage ---------- */

const QUIZ_PARAMS = ['units', 'count', 'mode', 'start']

export function hasQuizParams(p: URLSearchParams): boolean {
  return QUIZ_PARAMS.some((k) => p.has(k))
}

function parseMode(v: string | null | undefined): Mode {
  const m = (v ?? '').trim().toLowerCase()
  if (m === 'exam') return 'exam'
  if (m === 'weak' || m === 'weak-spots' || m === 'weakspots') return 'weak'
  return 'practice'
}

function parseCount(v: unknown): Count {
  if (typeof v === 'number') return Number.isInteger(v) && v > 0 ? v : DEFAULT_CONFIG.count
  const s = String(v ?? '').trim().toLowerCase()
  if (s === 'all') return 'all'
  const n = Number.parseInt(s, 10)
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_CONFIG.count
}

function parseUnits(list: unknown[]): UnitId[] {
  const units = ALL_UNITS.filter((u) => list.some((x) => typeof x === 'string' && x.trim().toLowerCase() === u))
  return units.length ? units : ALL_UNITS
}

/** Reads ?units=u1,u3&count=10&mode=practice. Missing or invalid values fall back to the defaults. */
export function configFromParams(p: URLSearchParams): QuizConfig {
  return {
    units: parseUnits((p.get('units') ?? '').split(',')),
    count: parseCount(p.get('count')),
    mode: parseMode(p.get('mode')),
  }
}

const PREF_KEY = 'taxlaw-quiz-setup'

export function loadSavedConfig(): QuizConfig | null {
  try {
    const raw = localStorage.getItem(PREF_KEY)
    if (!raw) return null
    const v = JSON.parse(raw) as Partial<Record<keyof QuizConfig, unknown>>
    if (!v || typeof v !== 'object') return null
    const units = Array.isArray(v.units) ? v.units.filter(isUnitId) : []
    return { units: units.length ? parseUnits(units) : ALL_UNITS, count: parseCount(v.count), mode: parseMode(String(v.mode ?? '')) }
  } catch {
    return null
  }
}

export function saveConfig(c: QuizConfig) {
  try {
    localStorage.setItem(PREF_KEY, JSON.stringify(c))
  } catch {
    /* storage blocked: the setup just won't be remembered */
  }
}

/* ---------- session: a quiz survives leaving the page (e.g. to review a concept) and coming back ---------- */

/** The runner's live state, saved after every change. */
export interface RunProgress {
  index: number
  picks: (number | null)[]
  streak: number
  best: number
  startedAt: number
  deadline: number | null
}

interface PackedRun {
  mode: Mode
  retry: boolean
  /** Question id + option order as indexes into [answer, ...distractors]. */
  q: { id: string; o: number[] }[]
}

interface PackedResult {
  picks: (number | null)[]
  reason: EndReason
  bestStreak: number
  startedAt: number
  finishedAt: number
  msLeft: number | null
  newBest: UnitId[]
  cleared: number | null
}

interface PackedSession {
  v: 1
  /** Last save, for expiry. */
  at: number
  /** The page's query string (without start=1) when the quiz began. */
  search: string
  run: PackedRun
  state?: RunProgress
  result?: PackedResult
}

export type Restored =
  | { kind: 'running'; run: Run; state: RunProgress }
  | { kind: 'results'; outcome: Outcome; newBest: UnitId[]; cleared: number | null }

const SESSION_KEY = 'taxlaw-quiz-session'
const SESSION_TTL_MS = 60 * 60 * 1000
const quizById = new Map(QUIZ.map((q) => [q.id, q]))

function packRun(run: Run): PackedRun {
  return {
    mode: run.mode,
    retry: run.retry,
    q: run.questions.map((rq) => {
      const base = baseOptions(rq.item)
      return { id: rq.item.id, o: rq.options.map((t) => base.indexOf(t)) }
    }),
  }
}

function unpackRun(p: PackedRun | undefined): Run | null {
  if (!p || !Array.isArray(p.q) || !p.q.length) return null
  const questions: RunQuestion[] = []
  for (const x of p.q) {
    const item = x && typeof x.id === 'string' ? quizById.get(x.id) : undefined
    if (!item) return null // the question bank changed since
    const base = baseOptions(item)
    const order = Array.isArray(x.o) ? x.o : []
    const valid = order.length === base.length && new Set(order).size === base.length && order.every((i) => Number.isInteger(i) && i >= 0 && i < base.length)
    if (!valid) return null
    const options = order.map((i) => base[i])
    questions.push({ item, options, answer: options.indexOf(item.answer) })
  }
  return runFrom(questions, parseMode(p.mode), p.retry === true)
}

function validPicks(p: unknown, run: Run): p is (number | null)[] {
  return (
    Array.isArray(p) &&
    p.length === run.questions.length &&
    p.every((x, i) => x === null || (Number.isInteger(x) && x >= 0 && x < run.questions[i].options.length))
  )
}

const num = (v: unknown, fallback = 0) => (typeof v === 'number' && Number.isFinite(v) ? v : fallback)

function write(s: Omit<PackedSession, 'v' | 'at'>) {
  try {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify({ v: 1, at: Date.now(), ...s }))
  } catch {
    /* storage blocked: leaving the page will simply lose the quiz */
  }
}

export function saveRunning(search: string, run: Run, state: RunProgress) {
  write({ search, run: packRun(run), state })
}

export function saveResults(search: string, o: Outcome, newBest: UnitId[], cleared: number | null) {
  write({
    search,
    run: packRun(o.run),
    result: {
      picks: o.picks,
      reason: o.reason,
      bestStreak: o.bestStreak,
      startedAt: o.startedAt,
      finishedAt: o.finishedAt,
      msLeft: o.msLeft,
      newBest,
      cleared,
    },
  })
}

export function clearSession() {
  try {
    sessionStorage.removeItem(SESSION_KEY)
  } catch {
    /* nothing to clear */
  }
}

/**
 * The quiz or results to come back to. Restores when the page is reopened with the same query
 * string (Back, refresh) or with none (the nav link); a different deep link discards it.
 */
export function loadSession(search: string): Restored | null {
  let s: PackedSession | null = null
  try {
    s = JSON.parse(sessionStorage.getItem(SESSION_KEY) || 'null') as PackedSession | null
  } catch {
    s = null
  }
  if (!s || typeof s !== 'object' || s.v !== 1) return null
  const fresh = Date.now() - num(s.at) < SESSION_TTL_MS
  const run = fresh && (search === '' || search === s.search) ? unpackRun(s.run) : null
  if (run && s.state && validPicks(s.state.picks, run)) {
    const st = s.state
    const index = Number.isInteger(st.index) && st.index >= 0 && st.index < run.questions.length ? st.index : 0
    const startedAt = num(st.startedAt, Date.now())
    return {
      kind: 'running',
      run,
      state: {
        index,
        picks: st.picks,
        streak: num(st.streak),
        best: num(st.best),
        startedAt,
        deadline: run.mode === 'exam' ? num(st.deadline, startedAt + examMs(run.questions.length)) : null,
      },
    }
  }
  if (run && s.result && validPicks(s.result.picks, run)) {
    const r = s.result
    const reason: EndReason = r.reason === 'ended' || r.reason === 'timeout' ? r.reason : 'complete'
    return {
      kind: 'results',
      outcome: {
        run,
        picks: r.picks,
        reason,
        bestStreak: num(r.bestStreak),
        startedAt: num(r.startedAt),
        finishedAt: num(r.finishedAt),
        msLeft: typeof r.msLeft === 'number' ? r.msLeft : null,
      },
      newBest: Array.isArray(r.newBest) ? r.newBest.filter(isUnitId) : [],
      cleared: typeof r.cleared === 'number' ? r.cleared : null,
    }
  }
  clearSession()
  return null
}

/* ---------- formatting ---------- */

/** 450000 -> "7:30" */
export function clock(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000))
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  const ss = String(s).padStart(2, '0')
  return h ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`
}

/** 252000 -> "4 min 12 s" */
export function duration(ms: number): string {
  const total = Math.max(0, Math.round(ms / 1000))
  const m = Math.floor(total / 60)
  const s = total % 60
  if (!m) return `${s} s`
  return s ? `${m} min ${s} s` : `${m} min`
}

export function unitsLabel(units: readonly UnitId[]): string {
  if (units.length === ALL_UNITS.length) return 'All units'
  const names = UNITS.filter((u) => units.includes(u.id)).map((u) => u.short.replace('Unit ', ''))
  return names.length === 1 ? `Unit ${names[0]}` : `Units ${names.join(', ')}`
}
