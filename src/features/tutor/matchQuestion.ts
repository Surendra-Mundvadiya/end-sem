import { QUIZ, SLIDES, type QuizItem, type Slide } from '../../data'
import { getProgress } from '../../lib/progress'
import { keywords } from './speechText'

/*
 * Picks the end-of-lesson quick-check question for a slide.
 * 1. A question explicitly linked to the slide (QuizItem.slideId).
 * 2. Otherwise a question of the same unit that shares enough distinctive words with the slide:
 *    words of 5+ letters (no stop words), weighted by how rare they are across the notes, and only
 *    when this slide is (close to) the best match the question has anywhere in its unit.
 */

interface Index {
  idf: Map<string, number>
  slideWords: Map<string, Set<string>>
  questionWords: Map<string, string[]>
  best: Map<string, number>
}

const MIN_SCORE = 5
const MIN_SHARED = 2
const MIN_RELATIVE = 0.75

let index: Index | null = null

function overlap(ix: Index, q: QuizItem, slide: Slide): { score: number; shared: number } {
  const words = ix.slideWords.get(slide.id)
  let score = 0
  let shared = 0
  for (const w of ix.questionWords.get(q.id) ?? []) {
    if (words?.has(w)) {
      score += ix.idf.get(w) ?? 0
      shared++
    }
  }
  return { score, shared }
}

function getIndex(): Index {
  if (index) return index
  const df = new Map<string, number>()
  const slideWords = new Map<string, Set<string>>()
  for (const s of SLIDES) {
    const words = new Set(keywords(`${s.title} ${s.plain}`))
    slideWords.set(s.id, words)
    for (const w of words) df.set(w, (df.get(w) ?? 0) + 1)
  }
  const n = SLIDES.length
  const idf = new Map<string, number>()
  for (const [w, count] of df) idf.set(w, Math.log((n + 1) / (count + 1)))
  const ix: Index = {
    idf,
    slideWords,
    questionWords: new Map(QUIZ.map((q) => [q.id, keywords(`${q.question} ${q.answer}`)])),
    best: new Map(),
  }
  for (const q of QUIZ) {
    let best = 0
    for (const s of SLIDES) if (s.unitId === q.unitId && !s.isPractice) best = Math.max(best, overlap(ix, q, s).score)
    ix.best.set(q.id, best)
  }
  index = ix
  return ix
}

/** Question ids already asked in this browser session, so a topic does not repeat itself. */
const askedThisSession = new Set<string>()

export function markAsked(id: string) {
  askedThisSession.add(id)
}

export function quickCheckFor(slide: Slide): QuizItem | null {
  if (slide.isPractice) return null
  const stats = getProgress().quizStats
  const notMastered = (q: QuizItem) => !stats[q.id]?.lastCorrect
  const linked = QUIZ.filter((q) => q.slideId === slide.id && !askedThisSession.has(q.id))
  if (linked.length) return linked.find(notMastered) ?? linked[0]

  const ix = getIndex()
  const candidates: { q: QuizItem; score: number }[] = []
  for (const q of QUIZ) {
    if (q.unitId !== slide.unitId || askedThisSession.has(q.id)) continue
    if (q.slideId && q.slideId !== slide.id) continue // taught on another slide
    const { score, shared } = overlap(ix, q, slide)
    if (score >= MIN_SCORE && shared >= MIN_SHARED && score >= (ix.best.get(q.id) ?? 0) * MIN_RELATIVE) candidates.push({ q, score })
  }
  candidates.sort((a, b) => Number(notMastered(b.q)) - Number(notMastered(a.q)) || b.score - a.score)
  return candidates[0]?.q ?? null
}
