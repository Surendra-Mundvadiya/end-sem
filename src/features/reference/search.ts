import { normalize } from '../../lib/text'

/*
 * Forgiving search for the reference views: "salary" finds "Salaries", "loss" finds "losses",
 * and section numbers typed in the query ("80C", "s. 17(2)") are pulled out for exact lookup.
 */

export function stem(w: string): string {
  if (w.length > 4 && w.endsWith('ies')) return `${w.slice(0, -3)}y`
  if (w.length > 4 && /(sses|xes|ches|shes)$/.test(w)) return w.slice(0, -2)
  if (w.length > 3 && w.endsWith('s') && !/(ss|us|is)$/.test(w)) return w.slice(0, -1)
  return w
}

export interface Haystack {
  text: string
  stems: string
}

export function haystack(...parts: string[]): Haystack {
  const text = normalize(parts.join(' '))
  const stems = text
    .split(/[^a-z0-9]+/)
    .filter(Boolean)
    .map(stem)
    .join(' ')
  return { text, stems }
}

/** True when every query word appears in the text, either as typed or by its stem. */
export function wordsMatch(h: Haystack, words: string[]): boolean {
  return words.every((w) => h.text.includes(w) || h.stems.includes(stem(w)))
}

export interface ParsedQuery {
  /** Normalised words to find in text. */
  words: string[]
  /** Section numbers, upper case ("80C", "17(2)"). Only filled when asked for. */
  refs: string[]
}

const REF_IN_QUERY = /\b\d+[a-z]*(?:\([0-9a-z]+\))*/gi
const FINDER_STOP = new Set(['s', 'ss', 'sec', 'secs', 'section', 'sections', 'u', 'us', 'u/s', 'act', 'the', 'of', 'old', 'new', '1961', '2025', 'is', 'now'])

export function parseQuery(q: string, opts: { refs?: boolean } = {}): ParsedQuery {
  if (!opts.refs) {
    return { words: normalize(q).split(' ').filter(Boolean), refs: [] }
  }
  const refs: string[] = []
  const rest = q.replace(REF_IN_QUERY, (m) => {
    if (m === '1961' || m === '2025') return ' '
    refs.push(m.toUpperCase())
    return ' '
  })
  const words = normalize(rest)
    .split(/[^a-z0-9'/-]+/)
    .filter((w) => w.length > 0 && !FINDER_STOP.has(w))
  return { words, refs: [...new Set(refs)] }
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/** A case-insensitive regex that marks each query word (or its stem root) in display text. */
export function markRegex(words: string[]): RegExp | null {
  const roots = words
    .map((w) => {
      const s = stem(w)
      return s.length > 3 && s.endsWith('y') ? s.slice(0, -1) : s
    })
    .filter((w) => w.length > 0)
    .sort((a, b) => b.length - a.length)
  if (!roots.length) return null
  return new RegExp(roots.map(escapeRe).join('|'), 'gi')
}
