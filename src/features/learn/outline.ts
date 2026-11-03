import { PARTS, SLIDES, UNITS, slidesOfUnit, type Part, type Slide, type Unit } from '../../data'

/* Structure helpers derived from the content (no facts are added here). */

const PART_OF = new Map<string, Part>()
for (const p of PARTS) for (const s of p.slides) PART_OF.set(s.id, p)

export function partOf(slide: Slide): Part {
  return PART_OF.get(slide.id) ?? PARTS[0]
}

/** "Topic 3 of 10" counts only the numbered topics of a unit, not its Practice Questions. */
export function topicOf(slide: Slide): { index: number; count: number } | null {
  if (slide.isPractice) return null
  const topics = PARTS.filter((p) => p.unitId === slide.unitId && !p.isPractice)
  const index = topics.indexOf(partOf(slide))
  return index < 0 ? null : { index: index + 1, count: topics.length }
}

/** Splits "5.5 Purposive construction" into its number and text. */
export function splitTitle(title: string): { num: string | null; text: string } {
  const m = /^(\d+(?:\.\d+)*)\.?\s+(.+)$/.exec(title)
  return m ? { num: m[1], text: m[2] } : { num: null, text: title }
}

/** The part heading is only worth repeating when it differs from the slide title. */
export function crumbPart(slide: Slide): string | null {
  return slide.part === slide.title ? null : slide.part
}

/** TOC label: the slide title, with the unit name trimmed from the Practice Questions slide. */
export function tocLabel(slide: Slide): string {
  return slide.isPractice ? 'Practice questions' : slide.title
}

export function neighbours(slide: Slide): { prev: Slide | null; next: Slide | null } {
  return { prev: SLIDES[slide.index - 1] ?? null, next: SLIDES[slide.index + 1] ?? null }
}

/** True on the last slide of a unit (its Practice Questions slide). */
export function isUnitEnd(slide: Slide): boolean {
  const next = SLIDES[slide.index + 1]
  return !next || next.unitId !== slide.unitId
}

export function nextUnit(unit: Unit): { unit: Unit; first: Slide } | null {
  const u = UNITS[unit.index + 1]
  if (!u) return null
  const first = slidesOfUnit(u.id)[0]
  return first ? { unit: u, first } : null
}
