import { CASES, partsOfUnit, slidesOfUnit, type CaseItem, type Slide, type UnitId } from '../../data'

/* Pulls the revision material for one unit out of the notes (trusted HTML, parsed with DOMParser). */

function parseHtml(html: string): Document {
  return new DOMParser().parseFromString(html, 'text/html')
}

/** "6.2 Evasion, avoidance and planning" → { num: "6.2", text: "Evasion, avoidance and planning" } */
export function splitNumber(title: string): { num: string; text: string } {
  const m = /^(\d+(?:\.\d+)*)\.?\s+(.+)$/.exec(title)
  return m ? { num: m[1], text: m[2] } : { num: '', text: title }
}

export interface OutlineSub {
  slide: Slide
  num: string
  text: string
}

export interface OutlinePart {
  key: string
  num: string
  title: string
  /** Slide the part heading links to. */
  first: Slide
  /** Every slide of the part, for progress. */
  slides: Slide[]
  /** Sub-topics, leaving out a slide that only repeats the part title. */
  subs: OutlineSub[]
}

export function outlineOf(unitId: UnitId): OutlinePart[] {
  return partsOfUnit(unitId)
    .filter((p) => !p.isPractice && p.slides.length > 0)
    .map((p) => {
      const head = splitNumber(p.title)
      return {
        key: p.key,
        num: head.num,
        title: head.text,
        first: p.slides[0],
        slides: p.slides,
        subs: p.slides.filter((s) => s.title !== p.title).map((s) => ({ slide: s, ...splitNumber(s.title) })),
      }
    })
}

export interface FocusItem {
  id: string
  slide: Slide
  /** Inner HTML of the aside, without its own "Exam focus." lead-in (the section heading says it). */
  html: string
}

const focusCache = new Map<UnitId, FocusItem[]>()

export function focusOf(unitId: UnitId): FocusItem[] {
  const hit = focusCache.get(unitId)
  if (hit) return hit
  const out: FocusItem[] = []
  for (const slide of slidesOfUnit(unitId)) {
    if (!slide.html.includes('focus')) continue
    parseHtml(slide.html)
      .querySelectorAll('aside.focus')
      .forEach((aside, i) => {
        const lead = aside.querySelector('strong')
        const para = lead?.parentElement
        if (lead && para && para.firstChild === lead && /^exam focus\.?$/i.test((lead.textContent ?? '').trim())) lead.remove()
        const html = aside.innerHTML.trim()
        if (html) out.push({ id: `${slide.id}-f${i}`, slide, html })
      })
  }
  focusCache.set(unitId, out)
  return out
}

export interface PracticeSet {
  slide: Slide
  items: { id: string; html: string }[]
}

const practiceCache = new Map<UnitId, PracticeSet | null>()

/** The numbered questions of the unit's practice slide(s). */
export function practiceOf(unitId: UnitId): PracticeSet | null {
  if (practiceCache.has(unitId)) return practiceCache.get(unitId) ?? null
  const slides = slidesOfUnit(unitId).filter((s) => s.isPractice)
  const items: PracticeSet['items'] = []
  for (const slide of slides) {
    const body = parseHtml(slide.html).body
    let lis = [...body.querySelectorAll('ol.pts > li')]
    if (!lis.length) lis = [...body.querySelectorAll('li')].filter((li) => !li.parentElement?.closest('li'))
    lis.forEach((li, i) => {
      const html = li.innerHTML.trim()
      if (html) items.push({ id: `${slide.id}-q${i}`, html })
    })
  }
  const set = slides.length && items.length ? { slide: slides[0], items } : null
  practiceCache.set(unitId, set)
  return set
}

export interface CaseGroup {
  part: string
  num: string
  title: string
  cases: CaseItem[]
}

/** The unit's cases in note order, grouped under the topic that discusses them. */
export function casesOf(unitId: UnitId): CaseGroup[] {
  const groups: CaseGroup[] = []
  for (const c of CASES) {
    if (c.unitId !== unitId) continue
    const last = groups[groups.length - 1]
    if (last && last.part === c.part) {
      last.cases.push(c)
      continue
    }
    const { num, text } = splitNumber(c.part)
    groups.push({ part: c.part, num, title: text, cases: [c] })
  }
  return groups
}

const CITATION_START = /\s+(?=\[\d{4}\]|\(\d{4}\)|AIR\s\d{4}|\d{4}\s(?:Supp|SCC)|\((?:Supreme Court|House of Lords|Privy Council))/

/** "IRC v. Duke of Westminster [1936] AC 1 (House of Lords)" → parties + citation. Combined entries stay whole. */
export function splitCaseName(name: string): { title: string; cite: string } {
  const m = CITATION_START.exec(name)
  if (!m) return { title: name, cite: '' }
  const title = name.slice(0, m.index).trim()
  const cite = name.slice(m.index).trim()
  if (!/\sv\.?\s/.test(` ${title} `) || /\sv\.\s/.test(cite)) return { title: name, cite: '' }
  return { title, cite }
}
