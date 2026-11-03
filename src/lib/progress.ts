import { useSyncExternalStore } from 'react'
import { CARDS, QUIZ, SLIDES, SUBJECT, type UnitId } from '../data'

/*
 * Study progress for the current subject, persisted to localStorage and shared by every view.
 * Read it with useProgress(); change it only through the actions below.
 */

const KEY = `studykit:${SUBJECT.id}:progress:v2`
/** Progress saved by the original single-page Taxation Law kit. */
const LEGACY_KEY = SUBJECT.id === 'tax' ? 'taxlawStudyKitV1' : null
const MIN = 60_000
const DAY = 24 * 60 * MIN

/**
 * Leitner boxes 1–5 and how long a card waits after landing in each (index = box - 1).
 * "Again" sends a card to box 1 (back in 10 minutes); a card in box 0 / absent has never been reviewed.
 */
export const BOX_INTERVALS_MS = [10 * MIN, DAY, 3 * DAY, 7 * DAY, 16 * DAY]
export const MAX_BOX = 5

export interface CardState {
  box: number
  /** Epoch ms when the card is next due. */
  due: number
  reviews: number
  lapses: number
  last: number
}

export interface QuizAttempt {
  at: number
  correct: number
  total: number
  units: UnitId[]
}

export interface Progress {
  /** slideId -> time marked as understood */
  understood: Record<string, number>
  /** slideId -> time bookmarked */
  bookmarks: Record<string, number>
  lastSlide: string | null
  quizAttempts: QuizAttempt[]
  /** Best score (0–100) per unit, from finished quizzes. */
  quizBest: Partial<Record<UnitId, number>>
  /** quizId -> answer history */
  quizStats: Record<string, { right: number; wrong: number; lastCorrect: boolean }>
  /** cardId -> Leitner state */
  cards: Record<string, CardState>
  /** Local dates (YYYY-MM-DD) with any study activity, ascending. */
  studyDays: string[]
}

const EMPTY: Progress = {
  understood: {},
  bookmarks: {},
  lastSlide: null,
  quizAttempts: [],
  quizBest: {},
  quizStats: {},
  cards: {},
  studyDays: [],
}

function today(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function fromLegacy(): Progress {
  const p: Progress = { ...EMPTY }
  if (!LEGACY_KEY) return p
  try {
    const old = JSON.parse(localStorage.getItem(LEGACY_KEY) || 'null')
    if (!old || typeof old !== 'object') return p
    const now = Date.now()
    if (old.understood && typeof old.understood === 'object') {
      p.understood = Object.fromEntries(Object.keys(old.understood).filter((id) => old.understood[id]).map((id) => [id, now]))
    }
    if (old.learned && typeof old.learned === 'object') {
      p.cards = Object.fromEntries(
        Object.keys(old.learned)
          .filter((id) => old.learned[id])
          .map((id) => [id, { box: 3, due: now + BOX_INTERVALS_MS[2], reviews: 1, lapses: 0, last: now }]),
      )
    }
    if (typeof old.last === 'number' && SLIDES[old.last]) p.lastSlide = SLIDES[old.last].id
  } catch {
    /* ignore unreadable legacy data */
  }
  return p
}

function load(): Progress {
  try {
    const saved = localStorage.getItem(KEY)
    if (saved) return { ...EMPTY, ...JSON.parse(saved) }
  } catch {
    /* fall through */
  }
  return fromLegacy()
}

let state: Progress = load()
const listeners = new Set<() => void>()

function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify(state))
  } catch {
    /* storage full or blocked: keep the in-memory state */
  }
}

function subscribe(fn: () => void) {
  listeners.add(fn)
  return () => {
    listeners.delete(fn)
  }
}

if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key === KEY) {
      state = load()
      listeners.forEach((l) => l())
    }
  })
}

export function getProgress(): Progress {
  return state
}

/** Low-level update. Prefer the named actions below. */
export function updateProgress(fn: (p: Progress) => Progress) {
  const next = fn(state)
  const day = today()
  state = next.studyDays.includes(day) ? next : { ...next, studyDays: [...next.studyDays, day] }
  save()
  listeners.forEach((l) => l())
}

export function useProgress(): Progress {
  return useSyncExternalStore(subscribe, getProgress, getProgress)
}

/* ---------- actions ---------- */

export function setUnderstood(slideId: string, value: boolean) {
  updateProgress((p) => {
    const understood = { ...p.understood }
    if (value) understood[slideId] = Date.now()
    else delete understood[slideId]
    return { ...p, understood }
  })
}

export function toggleBookmark(slideId: string) {
  updateProgress((p) => {
    const bookmarks = { ...p.bookmarks }
    if (bookmarks[slideId]) delete bookmarks[slideId]
    else bookmarks[slideId] = Date.now()
    return { ...p, bookmarks }
  })
}

export function setLastSlide(slideId: string) {
  if (state.lastSlide === slideId) return
  updateProgress((p) => ({ ...p, lastSlide: slideId }))
}

/** Call once per answered question. */
export function recordQuizAnswer(quizId: string, correct: boolean) {
  updateProgress((p) => {
    const prev = p.quizStats[quizId] ?? { right: 0, wrong: 0, lastCorrect: false }
    const next = { right: prev.right + (correct ? 1 : 0), wrong: prev.wrong + (correct ? 0 : 1), lastCorrect: correct }
    return { ...p, quizStats: { ...p.quizStats, [quizId]: next } }
  })
}

/** A unit's best score only counts rounds with at least this many of its questions, so short retries can't inflate it. */
export const MIN_QUESTIONS_FOR_BEST = 5

/** Call once when a quiz is finished. perUnit holds the correct/total split for each unit in the quiz. */
export function recordQuizResult(result: { correct: number; total: number; perUnit: Partial<Record<UnitId, { correct: number; total: number }>> }) {
  updateProgress((p) => {
    const quizBest = { ...p.quizBest }
    const units = Object.keys(result.perUnit) as UnitId[]
    for (const u of units) {
      const r = result.perUnit[u]
      if (!r || r.total < MIN_QUESTIONS_FOR_BEST) continue
      const pct = Math.round((r.correct / r.total) * 100)
      quizBest[u] = Math.max(quizBest[u] ?? 0, pct)
    }
    const attempt: QuizAttempt = { at: Date.now(), correct: result.correct, total: result.total, units }
    return { ...p, quizBest, quizAttempts: [...p.quizAttempts, attempt].slice(-50) }
  })
}

/** Leitner review: "knew it" moves the card up a box (a new card goes straight to box 2), "again" sends it back to box 1. */
export function reviewCard(cardId: string, knewIt: boolean) {
  updateProgress((p) => {
    const now = Date.now()
    const prev = p.cards[cardId] ?? { box: 0, due: now, reviews: 0, lapses: 0, last: 0 }
    const box = knewIt ? Math.min(MAX_BOX, Math.max(prev.box, 1) + 1) : 1
    const next: CardState = {
      box,
      due: now + BOX_INTERVALS_MS[box - 1],
      reviews: prev.reviews + 1,
      lapses: prev.lapses + (knewIt ? 0 : 1),
      last: now,
    }
    return { ...p, cards: { ...p.cards, [cardId]: next } }
  })
}

export function resetProgress() {
  state = { ...EMPTY }
  save()
  listeners.forEach((l) => l())
}

/* ---------- selectors ---------- */

export function isCardMastered(s: CardState | undefined): boolean {
  return (s?.box ?? 0) >= 4
}

export function isCardDue(s: CardState | undefined, now = Date.now()): boolean {
  return !s || s.due <= now
}

export interface UnitStats {
  slidesTotal: number
  slidesUnderstood: number
  quizBest: number | null
  quizQuestions: number
  cardsTotal: number
  cardsSeen: number
  cardsMastered: number
  cardsDue: number
  /** 0–1 blend of notes understood, best quiz score and cards mastered. */
  mastery: number
}

export function unitStats(p: Progress, unitId: UnitId): UnitStats {
  const slides = SLIDES.filter((s) => s.unitId === unitId)
  const cards = CARDS.filter((c) => c.unitId === unitId)
  const now = Date.now()
  const slidesUnderstood = slides.filter((s) => p.understood[s.id]).length
  const cardsSeen = cards.filter((c) => p.cards[c.id]).length
  const cardsMastered = cards.filter((c) => isCardMastered(p.cards[c.id])).length
  const cardsDue = cards.filter((c) => isCardDue(p.cards[c.id], now)).length
  const quizBest = p.quizBest[unitId] ?? null
  const parts = [slides.length ? slidesUnderstood / slides.length : 0, (quizBest ?? 0) / 100, cards.length ? cardsMastered / cards.length : 0]
  return {
    slidesTotal: slides.length,
    slidesUnderstood,
    quizBest,
    quizQuestions: QUIZ.filter((q) => q.unitId === unitId).length,
    cardsTotal: cards.length,
    cardsSeen,
    cardsMastered,
    cardsDue,
    mastery: parts.reduce((a, b) => a + b, 0) / parts.length,
  }
}

/** Consecutive study days ending today (or yesterday, so the streak survives until you study today). */
export function studyStreak(p: Progress): number {
  const days = new Set(p.studyDays)
  const d = new Date()
  const key = (x: Date) => `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`
  if (!days.has(key(d))) d.setDate(d.getDate() - 1)
  let n = 0
  while (days.has(key(d))) {
    n++
    d.setDate(d.getDate() - 1)
  }
  return n
}
