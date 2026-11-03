import type { CSSProperties } from 'react'
import { SUBJECTS, resolveSubject, type SubjectMeta } from '../subjects/registry'

/*
 * Typed access to the current subject's content. The subject comes from the URL (#/<subject>/…) and
 * its src/subjects/<id>/content.json is the single source of truth for every fact in the app.
 * The content loads before any view module runs (top-level await), so the exports below are plain arrays.
 * HTML fields are trusted, bundled content and may be rendered with dangerouslySetInnerHTML.
 */

export { SUBJECTS }
export type { SubjectMeta }

/** The subject being studied. */
export const SUBJECT: SubjectMeta = resolveSubject()

export type UnitId = 'u1' | 'u2' | 'u3' | 'u4' | 'u5' | 'u6'

export interface Unit {
  id: UnitId
  /** 0-based position (Unit I = 0). */
  index: number
  /** "Unit I" */
  short: string
  /** "Introduction to Taxation" */
  name: string
  /** CSS colour for the unit, e.g. "var(--u1)". */
  color: string
  /** Soft background tint for the unit, e.g. "var(--u1-soft)". */
  soft: string
  /** Teaching hours from the syllabus. */
  hours: number
}

export interface Slide {
  /** "s0" … "s130" */
  id: string
  /** Position in SLIDES. */
  index: number
  unitId: UnitId
  /** Topic heading the slide belongs to, e.g. "1. Meaning of Tax" or "Practice Questions for Unit I". */
  part: string
  /** e.g. "5.5 Purposive construction" */
  title: string
  /**
   * Trusted HTML. Tags: p, strong, em, ol.pts (numbered points), ol.roman, li,
   * div.case > p.cname + p (a decided case), aside.focus (exam focus), div.clause (statutory clause).
   */
  html: string
  /** Plain text of title + body, for search. */
  plain: string
  /** True for the "Practice Questions for Unit X" slides. */
  isPractice: boolean
}

export interface Part {
  key: string
  unitId: UnitId
  title: string
  isPractice: boolean
  slides: Slide[]
}

export interface CaseItem {
  /** "c0" … */
  id: string
  unitId: UnitId
  part: string
  /** Slide where the case is discussed. */
  slideId: string
  /** Case name with citation, e.g. "IRC v. Duke of Westminster [1936] AC 1 (House of Lords)". Plain text. */
  name: string
  /** What was held. May contain inline HTML (strong/em). */
  held: string
  plain: string
}

export interface QuizItem {
  /** Stable id used for progress tracking ("u3-q07", or "q0" … for older data). */
  id: string
  unitId: UnitId
  question: string
  answer: string
  /** Three wrong options. */
  distractors: string[]
  /** Explanation shown after answering. */
  why: string
  /** Short name of the concept the question tests, e.g. "Tax vs fee: quid pro quo". */
  concept?: string
  /** Slide where the concept is taught, for "review this concept" links. */
  slideId?: string
}

export type CardKind = 'case' | 'concept' | 'figure'

export interface Card {
  /** "k0" … */
  id: string
  unitId: UnitId
  kind: CardKind
  /** May contain inline HTML. */
  front: string
  /** May contain inline HTML. */
  back: string
}

interface RawData {
  units: { id: string; short: string; name: string; hours?: number }[]
  slides: { id: string; u: number; part: string; title: string; html: string; plain: string }[]
  cases: { u: string; part: string; slide: number; name: string; h: string; plain: string }[]
  quiz: { id?: string; u: string; q: string; ok: string; no: string[]; why: string; concept?: string; slide?: string }[]
  cards: { id: string; u: string; k: string; f: string; b: string }[]
  about: string
  appA: string
  appB: string
}

const data = (await SUBJECT.load()) as RawData

/** Units cycle through the six unit colour tokens (--u1 … --u6). */
function colourSlot(index: number): number {
  return (index % 6) + 1
}

export const UNITS: Unit[] = data.units.map((u, index) => {
  const slot = colourSlot(index)
  return { id: u.id as UnitId, index, short: u.short, name: u.name, color: `var(--u${slot})`, soft: `var(--u${slot}-soft)`, hours: u.hours ?? 0 }
})

export const SLIDES: Slide[] = data.slides.map((s, index) => ({
  id: s.id,
  index,
  unitId: UNITS[s.u].id,
  part: s.part,
  title: s.title,
  html: s.html,
  plain: s.plain,
  isPractice: s.part.startsWith('Practice Questions'),
}))

const slideMap = new Map(SLIDES.map((s) => [s.id, s]))

export const PARTS: Part[] = []
for (const s of SLIDES) {
  const last = PARTS[PARTS.length - 1]
  if (last && last.unitId === s.unitId && last.title === s.part) last.slides.push(s)
  else PARTS.push({ key: `${s.unitId}-p${PARTS.length}`, unitId: s.unitId, title: s.part, isPractice: s.isPractice, slides: [s] })
}

export const CASES: CaseItem[] = data.cases.map((c, i) => ({
  id: `c${i}`,
  unitId: c.u as UnitId,
  part: c.part,
  slideId: (SLIDES[c.slide] ?? SLIDES[0]).id,
  name: c.name,
  held: c.h,
  plain: c.plain,
}))

export const QUIZ: QuizItem[] = data.quiz.map((q, i) => ({
  id: q.id ?? `q${i}`,
  unitId: q.u as UnitId,
  question: q.q,
  answer: q.ok,
  distractors: q.no,
  why: q.why,
  concept: q.concept,
  slideId: q.slide && slideMap.has(q.slide) ? q.slide : undefined,
}))

export const CARDS: Card[] = data.cards.map((c) => ({
  id: c.id,
  unitId: c.u as UnitId,
  kind: c.k as CardKind,
  front: c.f,
  back: c.b,
}))

/** "How to read the references" and about-this-material notes (HTML). */
export const ABOUT_HTML = data.about
/** Appendix A: section finder, 1961 Act to 2025 Act correspondence (HTML, an ol.pts list). */
export const SECTION_FINDER_HTML = data.appA
/** Appendix B: key figures and thresholds (HTML, an ol.pts list with <strong> labels). */
export const KEY_FIGURES_HTML = data.appB

const unitMap = new Map(UNITS.map((u) => [u.id, u]))

export function getUnit(id: UnitId): Unit {
  return unitMap.get(id) ?? UNITS[0]
}

export function slideById(id: string | undefined | null): Slide | undefined {
  return id ? slideMap.get(id) : undefined
}

export function slidesOfUnit(id: UnitId): Slide[] {
  return SLIDES.filter((s) => s.unitId === id)
}

export function partsOfUnit(id: UnitId): Part[] {
  return PARTS.filter((p) => p.unitId === id)
}

export function isUnitId(v: unknown): v is UnitId {
  return typeof v === 'string' && unitMap.has(v as UnitId)
}

/** Sets --unit and --unit-soft so shared classes (.notes, .chip, .unit-pill) pick up the unit colour. */
export function unitVars(id: UnitId): CSSProperties {
  const u = unitMap.get(id)
  return { '--unit': u?.color ?? 'var(--u1)', '--unit-soft': u?.soft ?? 'var(--u1-soft)' } as CSSProperties
}

export interface Material {
  id: string
  title: string
  subtitle: string
  /** File name, e.g. "The Income Tax Act, 2025.pdf". */
  file: string
  url: string
}

/** The subject's PDFs (kept in a top-level folder such as tax/, copied into dist/ at build time). */
export const MATERIALS: Material[] = SUBJECT.materials.map((m) => ({
  id: m.id,
  title: m.title,
  subtitle: m.subtitle,
  file: m.path.split('/').pop() ?? m.path,
  url: `${import.meta.env.BASE_URL}${m.path.split('/').map(encodeURIComponent).join('/')}`,
}))
