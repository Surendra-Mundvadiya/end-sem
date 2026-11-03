/*
 * Pure text parsers for the two appendices (no DOM, no React, no imports, so they can be
 * unit-tested with plain Node). Every word shown in the UI still comes from the source text:
 * these functions only split it and mark up the section numbers inside it.
 */

/* ---------- facts (Appendix B values, figure cards) ---------- */

/** Splits "a; b (x; y); c." on top-level semicolons, keeping parenthesised text intact. */
export function splitFacts(text: string): string[] {
  const out: string[] = []
  let depth = 0
  let cur = ''
  for (const ch of text) {
    if (ch === '(') depth++
    else if (ch === ')') depth = Math.max(0, depth - 1)
    if (ch === ';' && depth === 0) {
      out.push(cur)
      cur = ''
    } else cur += ch
  }
  out.push(cur)
  return out
    .map((s) => s.trim().replace(/\.$/, '').trim())
    .filter(Boolean)
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
}

export interface Range {
  a: number
  b: number
}

const NUM = String.raw`\d+(?:,\d+)*(?:\.\d+)?`
const WORD_NUM = String.raw`(?:one|two|three|four|five|six|seven|eight|nine|ten|twelve)`
const FIGURE_RE = new RegExp(
  [
    String.raw`Rs\.\s?${NUM}(?:\s(?:lakh|crore))?`,
    String.raw`${NUM}\s?%`,
    String.raw`\b${NUM}(?:\s(?:days?|years?|kilometres))?\b`,
    String.raw`\b${WORD_NUM}\b(?:\s(?:third|half|lakh|crore|years?|days?))?`,
    String.raw`\bnil\b`,
  ].join('|'),
  'gi',
)
/** Numbers that are citations, not figures: "section 92(2)(m)", "Sl. No. 17", "Finance Act, 2026". */
const CITATION_RE = /\b(?:sections?|Sl\. No\.|Articles?|Rules?|Schedules?|Act,?)\s+[0-9IVXL][0-9A-Za-z]*(?:\([0-9A-Za-z]+\))*/g

/** Character ranges of the figures (amounts, rates, periods) in a sentence, for emphasis. */
export function figureRanges(text: string): Range[] {
  const cites = [...text.matchAll(CITATION_RE)].map((m) => ({ a: m.index ?? 0, b: (m.index ?? 0) + m[0].length }))
  return [...text.matchAll(FIGURE_RE)]
    .map((m) => ({ a: m.index ?? 0, b: (m.index ?? 0) + m[0].length }))
    .filter((r) => r.b > r.a && !cites.some((c) => r.a < c.b && r.b > c.a))
}

/* ---------- section references ---------- */

export type Ref = { kind: 'one'; v: string } | { kind: 'range'; from: string; to: string }

export type Seg = { kind: 'text'; text: string } | { kind: 'ref'; ref: Ref }

/** "80C", "2(1A)", "17(1)", "115BBE" */
const REF = String.raw`\d+[A-Z]*(?:\([0-9A-Za-z]+\))*`
const TOKEN = String.raw`${REF}(?:\s+to\s+${REF})?`
const TOKEN_RE = new RegExp(String.raw`(${REF})(?:\s+to\s+(${REF}))?`, 'g')
const LIST_RE = new RegExp(String.raw`${TOKEN}(?:(?:\s*,\s*|\s+and\s+)${TOKEN})*`, 'g')
/** "10(10), (10A) and (10C)": a bare "(10A)" continues the section before it. */
const SUBCLAUSES_RE = /(\d+[A-Z]*)(\([0-9A-Za-z]+\))((?:\s*(?:,|and)\s*\([0-9A-Za-z]+\))+)/g
const PARENS_RE = /\([^()]*(?:\([^()]*\)[^()]*)*\)/g

export function refLabel(r: Ref): string {
  return r.kind === 'one' ? r.v : `${r.from}–${r.to}`
}

function lead(v: string): number {
  return parseInt(v, 10)
}

/**
 * Does a typed section number (q, upper case) hit this reference?
 * Exact match, a sub-section either way ("24" ~ "24(b)", "17" ~ "17(2)"), or, for ranges on
 * the 1961 side, a number inside the range ("57" is within "56 to 58").
 */
export function refHits(q: string, r: Ref, ranges = true): boolean {
  const Q = q.toUpperCase()
  if (r.kind === 'one') {
    const v = r.v.toUpperCase()
    return v === Q || v.startsWith(`${Q}(`) || Q.startsWith(`${v}(`)
  }
  if (!ranges) return false
  const from = r.from.toUpperCase()
  const to = r.to.toUpperCase()
  if (Q === from || Q === to) return true
  const n = lead(Q)
  return Number.isFinite(n) && n >= lead(from) && n <= lead(to)
}

function segments(s: string): Seg[] {
  const out: Seg[] = []
  let last = 0
  for (const m of s.matchAll(TOKEN_RE)) {
    const i = m.index ?? 0
    if (i > last) out.push({ kind: 'text', text: s.slice(last, i) })
    out.push({ kind: 'ref', ref: m[2] ? { kind: 'range', from: m[1], to: m[2] } : { kind: 'one', v: m[1] } })
    last = i + m[0].length
  }
  if (last < s.length) out.push({ kind: 'text', text: s.slice(last) })
  return out
}

function refsOf(segs: Seg[]): Ref[] {
  return segs.flatMap((s) => (s.kind === 'ref' ? [s.ref] : []))
}

/* ---------- Appendix A: section finder ---------- */

export type Relation = 'maps' | 'same' | 'none'

/** One 1961 reference and what it corresponds to in the 2025 Act (empty: no counterpart). */
export interface Pair {
  old: Ref
  to: Ref[]
}

export interface FinderRow {
  id: string
  /** 1961 side of the clause, e.g. "agricultural income 2(1A)". */
  left: Seg[]
  /** 2025 side, e.g. "2(5)". Empty when relation is 'same' or 'none'. */
  right: Seg[]
  relation: Relation
  /** Source wording of a 'same' / 'none' relation ("keep the same numbers", "has no counterpart"). */
  note: string
  oldRefs: Ref[]
  newRefs: Ref[]
  pairs: Pair[]
  /** Both sides list the same number of single sections, read one to one. */
  zipped: boolean
  /** The clause as written (sub-clauses spelt out in full). */
  text: string
  /** Subject words of the 1961 side without the numbers, e.g. "Agricultural income" ('' if none). */
  subject: string
}

export interface FinderGroup {
  id: string
  title: string
  /** True when the title is the entry's own "Heading:"; false when built from its subjects. */
  labelled: boolean
  rows: FinderRow[]
  /** The whole entry as written. */
  text: string
}

const VERB_RE = /\s(is now|are now|is|are)\s|\s(keep the same numbers|has no counterpart)(?=$|[\s.,;])/

function subjectOf(left: string): string {
  const s = left
    .replace(PARENS_RE, ' ')
    .replace(LIST_RE, ' ')
    .replace(/\b(sections?|under|clauses)\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .replace(/\s+,/g, ',')
    .replace(/^[\s,]*(the\s+)?/i, '')
    .replace(/[\s,]+$/, '')
    .trim()
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : ''
}

function pairsOf(relation: Relation, oldRefs: Ref[], newRefs: Ref[]): { pairs: Pair[]; zipped: boolean } {
  if (relation === 'same') return { pairs: oldRefs.map((r) => ({ old: r, to: [r] })), zipped: false }
  if (relation === 'none') return { pairs: oldRefs.map((r) => ({ old: r, to: [] })), zipped: false }
  const singles = (rs: Ref[]) => rs.every((r) => r.kind === 'one')
  if (oldRefs.length > 0 && oldRefs.length === newRefs.length && singles(oldRefs) && singles(newRefs)) {
    return { pairs: oldRefs.map((r, i) => ({ old: r, to: [newRefs[i]] })), zipped: oldRefs.length > 1 }
  }
  if (newRefs.length === 1) return { pairs: oldRefs.map((r) => ({ old: r, to: newRefs })), zipped: false }
  if (oldRefs.length === 1) return { pairs: [{ old: oldRefs[0], to: newRefs }], zipped: false }
  return { pairs: [], zipped: false }
}

function parseClause(id: string, clause: string): FinderRow {
  const text = clause.replace(SUBCLAUSES_RE, (_m, base: string, first: string, rest: string) =>
    base + first + rest.replace(/\(([0-9A-Za-z]+)\)/g, (_x, sub: string) => `${base}(${sub})`),
  )
  const m = VERB_RE.exec(text)
  if (!m) {
    const left = segments(text)
    return { id, left, right: [], relation: 'maps', note: '', oldRefs: refsOf(left), newRefs: [], pairs: [], zipped: false, text, subject: subjectOf(text) }
  }
  const relation: Relation = m[2] === 'keep the same numbers' ? 'same' : m[2] === 'has no counterpart' ? 'none' : 'maps'
  const leftRaw = text.slice(0, m.index)
  const left = segments(leftRaw)
  const right = relation === 'maps' ? segments(text.slice(m.index + m[0].length)) : []
  const oldRefs = refsOf(left)
  const newRefs = refsOf(right)
  return {
    id,
    left,
    right,
    relation,
    note: m[2] ?? '',
    oldRefs,
    newRefs,
    ...pairsOf(relation, oldRefs, newRefs),
    text,
    subject: subjectOf(leftRaw),
  }
}

/** Parses the text of each Appendix A list item into a titled group of clauses. */
export function parseFinder(items: string[]): FinderGroup[] {
  return items.map((raw, gi) => {
    const entry = raw.replace(/\s+/g, ' ').trim()
    const label = /^([A-Z][A-Za-z ]{1,40}):\s+/.exec(entry)
    const body = label ? entry.slice(label[0].length) : entry
    const clauses = body
      .replace(/\.\s*$/, '')
      .split(/;\s+|,\s+and\s+(?=sections?\s)/)
      .map((c) => c.trim())
      .filter(Boolean)
    const rows = clauses.map((c, ci) => parseClause(`a${gi}-${ci}`, c))
    const derived = [...new Set(rows.map((r) => r.subject).filter(Boolean))].join(' · ')
    return { id: `a${gi}`, title: label ? label[1] : derived || `Entry ${gi + 1}`, labelled: Boolean(label), rows, text: entry }
  })
}
