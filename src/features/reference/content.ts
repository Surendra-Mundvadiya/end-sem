import { ABOUT_HTML, CARDS, GLOSSARY, KEY_FIGURES_HTML, SECTION_FINDER_HTML, UNITS, type UnitId } from '../../data'
import { parseFinder, refLabel, splitFacts, type FinderGroup } from './parse'
import { haystack, type Haystack } from './search'

/*
 * Nothing here names a subject: labels, examples and suggestions are all derived from the
 * loaded content, so the same views work for any subject (and hide what it does not have).
 */

/**
 * The appendix fields arrive as an HTML string, as an array of "<li>…</li>" strings (the content
 * spec's form for key facts), or not at all. Every view reads them through these normalised values.
 */
function asHtml(value: unknown): string {
  const wrap = (items: string[]) => `<ol class="pts">${items.map((i) => (/^\s*<li[\s>]/i.test(i) ? i : `<li>${i}</li>`)).join('')}</ol>`
  if (typeof value === 'string') {
    // Bare list items with no list around them.
    return /^\s*<li[\s>]/i.test(value) && !/<[ou]l[\s>]/i.test(value) ? `<ol class="pts">${value}</ol>` : value
  }
  if (Array.isArray(value)) {
    const items = value.filter((v): v is string => typeof v === 'string' && v.trim() !== '')
    return items.length ? wrap(items) : ''
  }
  return ''
}

/** "How to read the references" notes (HTML), or ''. */
export const ABOUT = asHtml(ABOUT_HTML as unknown)
const FINDER_SOURCE = asHtml(SECTION_FINDER_HTML as unknown)
const KEY_FACTS_SOURCE = asHtml(KEY_FIGURES_HTML as unknown)

/* DOM-based extraction of the appendices, parsed once and cached for the session. */

function parseHtml(html: string): Document {
  return new DOMParser().parseFromString(html, 'text/html')
}

/** Text content of trusted inline HTML (entities decoded, tags dropped). */
export function htmlToText(html: string): string {
  if (!/[<&]/.test(html)) return html.replace(/\s+/g, ' ').trim()
  return (parseHtml(html).body.textContent ?? '').replace(/\s+/g, ' ').trim()
}

/* ---------- Appendix B: key figures ---------- */

export interface FigureTile {
  id: string
  label: string
  facts: string[]
  hay: Haystack
}

let tilesCache: FigureTile[] | null = null

/** One tile per bold label in Appendix B ("Residence:", "Rebate:" …), facts split at semicolons. */
export function keyFigureTiles(): FigureTile[] {
  if (tilesCache) return tilesCache
  const tiles: FigureTile[] = []
  const doc = parseHtml(KEY_FACTS_SOURCE)
  doc.querySelectorAll('ol.pts > li').forEach((li) => {
    let label = ''
    let value = ''
    const flush = () => {
      const facts = splitFacts(value)
      if (label || facts.length) {
        tiles.push({ id: `b${tiles.length}`, label, facts, hay: haystack(label, ...facts) })
      }
    }
    li.childNodes.forEach((node) => {
      const text = node.textContent ?? ''
      if (node.nodeType === Node.ELEMENT_NODE && (node as Element).tagName === 'STRONG' && /:\s*$/.test(text)) {
        if (label || value.trim()) flush()
        label = text.replace(/:\s*$/, '').trim()
        value = ''
      } else value += text
    })
    flush()
  })
  tilesCache = tiles
  return tiles
}

/* ---------- 'figure' flashcards ---------- */

export interface FigureCard {
  id: string
  unitId: UnitId
  label: string
  value: string
  hay: Haystack
}

let cardsCache: FigureCard[] | null = null

export function figureCards(): FigureCard[] {
  if (cardsCache) return cardsCache
  cardsCache = CARDS.filter((c) => c.kind === 'figure').map((c) => {
    const label = htmlToText(c.front)
    const value = htmlToText(c.back)
    return { id: c.id, unitId: c.unitId, label, value, hay: haystack(label, value) }
  })
  return cardsCache
}

export function figureCardsOf(unitId: UnitId): FigureCard[] {
  return figureCards().filter((c) => c.unitId === unitId)
}

export function figureCardsByUnit(): { unitId: UnitId; cards: FigureCard[] }[] {
  return UNITS.map((u) => ({ unitId: u.id, cards: figureCardsOf(u.id) })).filter((g) => g.cards.length > 0)
}

/* ---------- Appendix A: section finder ---------- */

export interface Finder {
  intro: string
  groups: FinderGroup[]
  /** Group title + clause text, per row id. */
  hay: Map<string, Haystack>
}

let finderCache: Finder | null = null

export function sectionFinder(): Finder {
  if (finderCache) return finderCache
  const doc = parseHtml(FINDER_SOURCE)
  const intro = (doc.querySelector('p')?.textContent ?? '').trim()
  const items = [...doc.querySelectorAll('ol.pts > li')].map((li) => li.textContent ?? '')
  const groups = parseFinder(items)
  const hay = new Map<string, Haystack>()
  for (const g of groups) for (const r of g.rows) hay.set(r.id, haystack(g.title, r.text))
  finderCache = { intro, groups, hay }
  return finderCache
}

/**
 * Names for the two sides of the finder. Read from the "how to read the references" notes when
 * they define them (e.g. “1961 Act” means …, (“the 2025 Act”)); otherwise generic.
 */
export function actLabels(): { old: string; new: string } {
  const text = htmlToText(ABOUT)
  const oldYear = /[“"](\d{4}) Act[”"] means/.exec(text)?.[1]
  const newYear = /[“"]the (\d{4}) Act[”"]/.exec(text)?.[1]
  return oldYear && newYear && oldYear !== newYear ? { old: `${oldYear} Act`, new: `${newYear} Act` } : { old: 'Old Act', new: 'New Act' }
}

/** Example lookups taken from the finder itself: sections from the longest one-to-one lists, then its headings. */
export function finderSuggestions(): { refs: string[]; topics: string[] } {
  const { groups } = sectionFinder()
  const rows = groups.flatMap((g) => g.rows)
  const zipped = rows.filter((r) => r.zipped).sort((a, b) => b.pairs.length - a.pairs.length)
  const source = zipped.length ? zipped : rows.filter((r) => r.pairs.length)
  const refs = source.map((r) => refLabel((r.pairs[1] ?? r.pairs[0]).old))
  const short = (t: string) => t.length <= 18 && !t.includes('·')
  const labelled = groups.filter((g) => g.labelled && short(g.title)).map((g) => g.title)
  const topics = labelled.length ? labelled : groups.map((g) => g.title).filter(short)
  return { refs: [...new Set(refs)].slice(0, 3), topics: topics.slice(0, 4) }
}

/** Short Appendix-style labels to offer as one-tap filters. */
export function figureSuggestions(): string[] {
  return keyFigureTiles()
    .map((t) => t.label)
    .filter((l) => l && l.length <= 18)
    .slice(0, 6)
}

export function hasKeyFigures(): boolean {
  return KEY_FACTS_SOURCE.trim() !== '' && keyFigureTiles().length > 0
}

/** The section finder exists only for subjects whose content has one (it is empty otherwise). */
export function hasFinder(): boolean {
  return FINDER_SOURCE.trim() !== '' && sectionFinder().groups.length > 0
}

export function hasAbout(): boolean {
  return htmlToText(ABOUT) !== ''
}

/* ---------- glossary ---------- */

export interface GlossaryRow {
  id: string
  term: string
  /** Trusted inline HTML or plain text. */
  def: string
  /** Plain text of def, for search and for marking matches. */
  defText: string
  /** True when def carries markup (em, strong …) and is rendered as HTML. */
  defIsHtml: boolean
  slideId?: string
  /** "A" … "Z", or "#" for terms that start with anything else. */
  letter: string
  hay: Haystack
}

let glossaryCache: GlossaryRow[] | null = null

export function letterOf(term: string): string {
  const c = term
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/^[^A-Za-z0-9]+/, '')
    .charAt(0)
    .toUpperCase()
  return /[A-Z]/.test(c) ? c : '#'
}

/** GLOSSARY (already alphabetical), with search text and letter groups. */
export function glossaryRows(): GlossaryRow[] {
  if (glossaryCache) return glossaryCache
  glossaryCache = GLOSSARY.filter((g) => g.term?.trim()).map((g, i) => {
    const defText = htmlToText(g.def ?? '')
    return {
      id: `g${i}`,
      term: g.term.trim(),
      def: g.def ?? '',
      defText,
      defIsHtml: /<[a-z]/i.test(g.def ?? ''),
      slideId: g.slideId,
      letter: letterOf(g.term),
      hay: haystack(g.term, defText),
    }
  })
  return glossaryCache
}

export function hasGlossary(): boolean {
  return glossaryRows().length > 0
}
