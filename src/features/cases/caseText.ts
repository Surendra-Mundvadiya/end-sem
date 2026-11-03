import { CASES, type CaseItem } from '../../data'
import { normalize } from '../../lib/text'

/*
 * Text helpers for the cases feature: split "Name v. Name (1985) 3 SCC 230" into the party names and the
 * citation, hide party names that a holding repeats (so the match game does not give itself away), and mark
 * search terms. Everything is derived from CaseItem.name / CaseItem.held; nothing is added.
 */

export interface CasePart {
  /** Party names, e.g. "IRC v. Duke of Westminster". */
  name: string
  /** Citation, e.g. "[1936] AC 1 (House of Lords)". Empty when none was recognised. */
  cite: string
}

export interface CaseMeta {
  /** One entry per decision; two for the entries that pair two cases ("… and …"). */
  parts: CasePart[]
  /** Party names only, decisions joined with " and ". */
  shortName: string
  /** Holding HTML with party names that would reveal the case replaced by a blank. */
  maskedHeld: string
  /** Text the explorer searches: name, topic and plain text (which includes the holding). */
  haystack: string
}

/* A citation starts with "(1985)", "[1936]", "AIR 1965", "1995 Supp", "2024 SCC" or "(Supreme Court". */
const CITE_START = /\s(?=\(\d{4}\)|\[\d{4}\]|AIR \d{4}\b|\d{4} (?:Supp|SCC)\b|\(Supreme Court\b)/
/* " and " inside a citation that begins a second case name ("… (SC) and CIT v. Alom Extrusions …"). */
const JOINED = /\s+and\s+(?=[^;]*?\sv\.\s)/

function splitOne(s: string): CasePart {
  const m = CITE_START.exec(s)
  return m ? { name: s.slice(0, m.index).trim(), cite: s.slice(m.index).trim() } : { name: s.trim(), cite: '' }
}

export function parseCaseName(full: string): CasePart[] {
  const first = splitOne(full)
  if (!first.cite) return [first]
  const j = JOINED.exec(first.cite)
  if (!j) return [first]
  return [{ name: first.name, cite: first.cite.slice(0, j.index).trim() }, ...parseCaseName(first.cite.slice(j.index + j[0].length))]
}

export function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/* Words that are too common in case names to give anything away on their own. */
const GENERIC = new Set(
  (
    'v. and of the in for cit irc union india state ltd. ltd co. co (p) pvt. mrs. commissioner income tax officer ' +
    'deputy joint director appeals (appeals) commercial assistant excess profits international holdings b.v. ' +
    'corporation club bank trust development'
  ).split(' '),
)

/** Distinctive runs of party-name words that the holding repeats, e.g. "India Cement". */
function giveaways(parts: CasePart[], held: string): string[] {
  const text = held.replace(/<[^>]+>/g, ' ')
  const found: string[] = []
  for (const part of parts) {
    for (const party of part.name.split(/\s+v\.\s+/)) {
      const words = party.split(/\s+/)
      const runs: string[][] = []
      for (let i = 0; i < words.length; i++) for (let k = words.length; k > i; k--) runs.push(words.slice(i, k))
      runs.sort((a, b) => b.length - a.length)
      for (const run of runs) {
        if (!run.some((w) => !GENERIC.has(w.toLowerCase()))) continue
        const phrase = run.join(' ').replace(/[.,]$/, '')
        if (phrase.length < 4 || found.some((f) => f.includes(phrase))) continue
        if (new RegExp(`(^|[^\\w])${escapeRegExp(phrase)}(?!\\w)`).test(text)) found.push(phrase)
      }
    }
  }
  return found
}

const BLANK = '<span class="cs-blank" role="img" aria-label="case name hidden"></span>'

function maskHtml(html: string, phrases: string[]): string {
  if (!phrases.length) return html
  const re = new RegExp(`(^|[^\\w])(?:${phrases.map(escapeRegExp).join('|')})(?!\\w)`, 'g')
  return html
    .split(/(<[^>]+>)/)
    .map((seg, i) => (i % 2 ? seg : seg.replace(re, (_m, pre: string) => pre + BLANK)))
    .join('')
}

function build(c: CaseItem): CaseMeta {
  const parts = parseCaseName(c.name)
  return {
    parts,
    shortName: parts.map((p) => p.name).join(' and '),
    maskedHeld: maskHtml(c.held, giveaways(parts, c.held)),
    haystack: `${c.name} ${c.part} ${c.plain}`,
  }
}

const META = new Map(CASES.map((c) => [c.id, build(c)]))

export function metaOf(c: CaseItem): CaseMeta {
  let m = META.get(c.id)
  if (!m) {
    m = build(c)
    META.set(c.id, m)
  }
  return m
}

export const CASE_BY_ID: ReadonlyMap<string, CaseItem> = new Map(CASES.map((c) => [c.id, c]))

/**
 * Case-insensitive regex with one capture group matching any word of the query (two or more characters),
 * or null when there is nothing worth marking. Straight quotes also match curly ones, as in normalize().
 */
export function queryRegex(query: string): RegExp | null {
  const words = [...new Set(normalize(query).split(' ').filter((w) => w.length >= 2))]
  if (!words.length) return null
  const alts = words
    .sort((a, b) => b.length - a.length)
    .map((w) => escapeRegExp(w).replace(/'/g, "['‘’]").replace(/"/g, '["“”]'))
  return new RegExp(`(${alts.join('|')})`, 'gi')
}

/** Wraps query matches in <mark> inside trusted HTML, touching text only (never tags or entities). */
export function highlightHtml(html: string, re: RegExp | null): string {
  if (!re) return html
  return html
    .split(/(<[^>]+>|&[#\w]+;)/)
    .map((seg, i) => (i % 2 ? seg : seg.replace(re, '<mark class="cs-mark">$1</mark>')))
    .join('')
}

/** Splits a part title such as "2. Income and Receipt" into its number and title. */
export function splitPartTitle(part: string): { num: string; title: string } {
  const m = /^(\d+)\.\s+(.*)$/.exec(part)
  return m ? { num: m[1], title: m[2] } : { num: '', title: part }
}
