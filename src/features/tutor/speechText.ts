/*
 * Pure text helpers for the spoken tutor: speech-friendly rewriting, sentence splitting,
 * speech-to-display word alignment and keyword scoring. No DOM and no imports, so it can be
 * tested in isolation.
 */

const NUMBER_WORDS = [
  'zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten',
  'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen', 'twenty',
]

/** 2 -> "two" (digits above twenty). */
export function numberWord(n: number): string {
  return NUMBER_WORDS[n] ?? String(n)
}

/** 2 -> "Two". */
export function numberWordCap(n: number): string {
  const w = numberWord(n)
  return w.charAt(0).toUpperCase() + w.slice(1)
}

const ROMAN_VALUES: Record<string, number> = { I: 1, V: 5, X: 10, L: 50 }

function intToRoman(n: number): string {
  const table: [number, string][] = [[50, 'L'], [40, 'XL'], [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']]
  let out = ''
  for (const [v, s] of table) {
    while (n >= v) {
      out += s
      n -= v
    }
  }
  return out
}

/** "XIV" -> 14. Returns null for anything that is not a canonical numeral up to 89. */
export function romanToInt(s: string): number | null {
  if (!/^[IVXL]+$/.test(s)) return null
  let total = 0
  for (let i = 0; i < s.length; i++) {
    const v = ROMAN_VALUES[s[i]]
    const next = ROMAN_VALUES[s[i + 1]] ?? 0
    total += v < next ? -v : v
  }
  return total > 0 && intToRoman(total) === s ? total : null
}

/** "4,00,001" -> "4 lakh 1"; "12,500" -> "12 thousand 500". Digits stay digits so the voice reads them naturally. */
export function indianAmount(digits: string): string {
  const n = Number(digits.replace(/,/g, ''))
  if (!Number.isFinite(n) || n < 0 || !Number.isInteger(n)) return digits
  const crore = Math.floor(n / 1e7)
  const lakh = Math.floor((n % 1e7) / 1e5)
  const thousand = Math.floor((n % 1e5) / 1e3)
  const rest = n % 1e3
  const parts: string[] = []
  if (crore) parts.push(`${crore} crore`)
  if (lakh) parts.push(`${lakh} lakh`)
  if (thousand) parts.push(`${thousand} thousand`)
  if (rest) parts.push(String(rest))
  return parts.join(' ') || '0'
}

/* ---------- citations (kept on screen, dropped from speech) ---------- */

const REPORTER = String.raw`(?:SCC(?:\s+OnLine\s+[A-Z][A-Za-z]*)?|ITR|SCR|AIR|CLR|AC|KB|QB|Ch|TC|ER|All\s+ER|WLR|LR|HL|ITD|CTR|DTR|SOT|TTJ|Taxman)`
const COURT = String.raw`\s*\((?:SC|PC|HL|Bom|Cal|Mad|Del|All|Ker|Guj|Pat|Kar|Raj|HC)\)`
/** (1981) 4 SCC 173 · [1981] 131 ITR 597 (SC) · [1936] AC 1 · (1938) 60 CLR 263 · 1995 Supp (2) SCC 453 */
const CITE_BRACKET_YEAR = new RegExp(
  String.raw`[\[(]\d{4}[\])]\s+(?:Supp\s+)?(?:\(\d+\)\s+)?(?:\d+\s+)?${REPORTER}\s+\d+(?:${COURT})?`,
  'g',
)
/** AIR 1954 SC 282 */
const CITE_AIR = new RegExp(String.raw`\bAIR\s+\d{4}\s+[A-Z][A-Za-z]*\s+\d+(?:${COURT})?`, 'g')
/** 1985 Supp SCC 205 · 2024 SCC OnLine SC 1796 */
const CITE_BARE = /\b\d{4}\s+(?:Supp\s+(?:\(\d+\)\s+)?)?SCC(?:\s+OnLine\s+[A-Z][A-Za-z]*)?\s+\d+/g
const CITE_COURT_ONLY = /\s*\((?:SC|PC|HL)\)/g

export function stripCitations(s: string): string {
  return tidy(
    s.replace(CITE_BRACKET_YEAR, ' ').replace(CITE_AIR, ' ').replace(CITE_BARE, ' ').replace(CITE_COURT_ONLY, ' '),
  )
}

/** The party names of a case, without its law-report citations: "IRC v. Duke of Westminster". */
export function caseShortName(name: string): string {
  const cut = name.search(/\s(?:[\[(]\d{4}[\])]|AIR\s+\d{4}|\d{4}\s+(?:Supp|SCC)|\((?:Supreme Court|High Court|House of Lords))/)
  return (cut > 0 ? name.slice(0, cut) : name).replace(/[\s,;]+$/, '')
}

/** Tidy the punctuation left behind after removing text. */
function tidy(s: string): string {
  return s
    .replace(/\s+([,;:.!?)\]])/g, '$1')
    .replace(/([,;])(?:\s*[,;])+/g, '$1')
    .replace(/[,;]\s*([.:!?)\]])/g, '$1')
    .replace(/([(\[])\s*[,;]\s*/g, '$1')
    .replace(/\(\s*\)|\[\s*\]/g, '')
    .replace(/\s{2,}/g, ' ')
    .replace(/^[\s,;]+|[\s,;]+$/g, '')
}

/* ---------- speech-friendly rewriting ---------- */

/** Acronyms the voice should spell out letter by letter. */
const SPELL_OUT = new Set([
  'CIT', 'IRC', 'GST', 'CBDT', 'TRF', 'CSR', 'GVK', 'UCO', 'HUF', 'TDS', 'TCS', 'AOP', 'BOI', 'LLP', 'CBIC',
  'ITAT', 'FMV', 'SEZ', 'NRI', 'RBI', 'RNOR', 'ROR', 'NOR', 'DTAA', 'STT', 'ICDS', 'CPC', 'EPF', 'PPF', 'NPS',
  'HRA', 'LTA', 'VRS', 'CAG', 'PAC', 'UTI', 'LIC', 'SBI', 'ICAI', 'IGST', 'CGST', 'SGST', 'UTGST', 'VAT', 'GSR',
])

const ROMAN_AFTER =
  /\b(Chapters?|Parts?|Lists?|Schedules?|Units?|Entry|Entries|Titles?|Volumes?|Books?|Appendix|Annexure)\s+([IVXL]+)\b/g
const ROMAN_AFTER_CONJ = /\b(and|or|to)\s+([IVXL]{2,})\b/g

type Rule = [RegExp, string | ((...m: string[]) => string)]

const RULES: Rule[] = [
  [/&/g, ' and '],
  [/\s+vs?\.\s+/g, ' versus '],
  [/\bSl\.\s*No\.\s*/g, 'serial number '],
  [/\bNos\.\s*(?=\d)/g, 'numbers '],
  [/\bNo\.\s*(?=\d)/g, 'number '],
  [/\bArts\.\s*(?=\d)/g, 'Articles '],
  [/\bArt\.\s*(?=\d)/g, 'Article '],
  [/\b(?:ss|[sS]ecs)\.\s*(?=\d)/g, 'sections '],
  [/\b(?:[sS]|[sS]ec)\.\s*(?=\d)/g, 'section '],
  [/\bCl\.\s*(?=[\d(])/g, 'clause '],
  [/\bSch\.\s*/g, 'Schedule '],
  [/\bi\.\s?e\.,?/g, 'that is,'],
  [/\be\.\s?g\.,?/g, 'for example,'],
  [/\bviz\.,?/g, 'namely,'],
  [/\betc\./g, 'et cetera'],
  [/\bw\.e\.f\./g, 'with effect from'],
  [/\bu\/s\.?(?=\s)/g, 'under section'],
  [/\bp\.a\./g, 'per annum'],
  [/\(P\)\s*Ltd\./g, 'Private Limited'],
  [/\bPvt\.\s*/g, 'Private '],
  [/\bLtd\./g, 'Limited'],
  [/\bCo\.(?=[\s,;:)]|$)/g, 'Company'],
  [/\bBros\./g, 'Brothers'],
  [/\bCorpn\./g, 'Corporation'],
  [/\bGovt\./g, 'Government'],
  [/\bDept\./g, 'Department'],
  [/\bDr\.(?=\s)/g, 'Doctor'],
  // "Latham C.J." -> "Chief Justice Latham"; "Chinnappa Reddy J. said" -> "Justice Chinnappa Reddy said".
  [/\b((?:[A-Z][a-z]+ )?[A-Z][a-z]+) C\.\s?J\.(?=[\s,;:)]|$)/g, 'Chief Justice $1'],
  [/\b((?:[A-Z][a-z]+ )?[A-Z][a-z]+) J\.(?=\s+[a-z]|[,;:)]|$)/g, 'Justice $1'],
  // Money: "Rs. 4,00,000" -> "4 lakh rupees"; "Rs. 10 crore" -> "10 crore rupees".
  [
    /(?:\bRs\.?|₹)\s*(\d+(?:,\d+)*(?:\.\d+)?)(\s*(?:lakhs?|crores?)\b)?/g,
    (_m, num, unit) => `${num.includes(',') && !num.includes('.') ? indianAmount(num) : num}${unit ?? ''} rupees`,
  ],
  [/\bRs\.?(?=\s|$)|₹/g, 'rupees'],
  // Indian digit grouping without "Rs.": "1,50,000" -> "1 lakh 50 thousand".
  [/\b\d{1,2}(?:,\d{2})+,\d{3}\b/g, (m) => indianAmount(m)],
  [/(\d)\s*%/g, '$1 percent'],
  [ROMAN_AFTER, (m, w, r) => (romanToInt(r) ? `${w} ${romanToInt(r)}` : m)],
  [ROMAN_AFTER_CONJ, (m, w, r) => (romanToInt(r) ? `${w} ${romanToInt(r)}` : m)],
  // "(iii)" -> "(3)" and "(a)" -> "(A)" so the voice reads them as labels, not words.
  [/\((i{1,3}|iv|vi{0,3}|ix|x)\)/g, (m, r) => `(${romanToInt(r.toUpperCase()) ?? r})`],
  [/\(([a-z])\)/g, (_m, c) => `(${c.toUpperCase()})`],
  [/\bNITI\b/g, 'Neeti'],
  [/\b[A-Z]{2,5}\b/g, (m) => (SPELL_OUT.has(m) ? m.split('').join(' ') : m)],
  [/[“”"]/g, ''],
]

/** Turns notes text into something a speech engine reads well. The screen keeps the original text. */
export function speechify(display: string): string {
  let s = stripCitations(display)
  for (const [re, rep] of RULES) s = s.replace(re, rep as never)
  return tidy(s)
}

/* ---------- sentences ---------- */

const ABBREVIATIONS = new Set([
  'v', 'vs', 'ltd', 'co', 'pvt', 'no', 'nos', 'sl', 'rs', 'mr', 'mrs', 'ms', 'dr', 'st', 'sr', 'jr', 'art', 'arts',
  'sec', 'secs', 's', 'ss', 'cl', 'sch', 'viz', 'inc', 'corp', 'corpn', 'bros', 'govt', 'dept', 'supp', 'vol', 'para',
  'paras', 'p', 'pp', 'cf', 'ch', 'ed', 'approx', 'hon', 'smt', 'shri', 'sh', 'u/s', 'ors', 'anr',
])

function isAbbreviation(token: string): boolean {
  const t = token.replace(/^[“"‘(\[]+/, '')
  if (!t.endsWith('.')) return false
  if (/^[A-Z]\.$/.test(t)) return true // an initial: "Sunil J. Kinariwala"
  if (/^(?:[A-Za-z]\.){2,}$/.test(t)) return true // "H.S.", "C.J.", "e.g."
  return ABBREVIATIONS.has(t.slice(0, -1).toLowerCase())
}

/** Character ranges [start, end) of the sentences in a text. Abbreviations and initials do not end sentences. */
export function sentenceRanges(text: string): [number, number][] {
  const out: [number, number][] = []
  const re = /[.!?]+["”’)\]]*(?=\s+["“‘(\[]?[A-Z0-9])/g
  let start = 0
  while (start < text.length && /\s/.test(text[start])) start++
  for (let m = re.exec(text); m; m = re.exec(text)) {
    const end = m.index + m[0].length
    if (end <= start) continue
    const head = text.slice(start, m.index + 1)
    const token = head.slice(head.search(/\S+$/))
    if (isAbbreviation(token)) continue
    out.push([start, end])
    start = end
    while (start < text.length && /\s/.test(text[start])) start++
  }
  let end = text.length
  while (end > start && /\s/.test(text[end - 1])) end--
  if (end > start) out.push([start, end])
  return out
}

/**
 * Breaks a very long sentence into readable chunks at clause boundaries outside brackets:
 * "; " first, then ": ", then ", ". Short sentences come back whole.
 */
export function chunkRanges(text: string, max = 300, target = 210, min = 90): [number, number][] {
  if (text.length <= max) return [[0, text.length]]
  const breaks: { at: number; pri: number }[] = []
  let depth = 0
  for (let i = 0; i < text.length - 1; i++) {
    const c = text[i]
    if (c === '(' || c === '[') depth++
    else if ((c === ')' || c === ']') && depth > 0) depth--
    else if (depth === 0 && text[i + 1] === ' ') {
      if (c === ';') breaks.push({ at: i + 2, pri: 3 })
      else if (c === ':') breaks.push({ at: i + 2, pri: 2 })
      else if (c === ',') breaks.push({ at: i + 2, pri: 1 })
    }
  }
  const out: [number, number][] = []
  let start = 0
  while (text.length - start > max) {
    const options = breaks.filter((b) => b.at > start + min && b.at <= start + max && text.length - b.at >= min / 2)
    let cut: number
    if (options.length) {
      const pri = Math.max(...options.map((o) => o.pri))
      cut = options
        .filter((o) => o.pri === pri)
        .reduce((best, o) => (Math.abs(o.at - start - target) < Math.abs(best.at - start - target) ? o : best)).at
    } else {
      const space = text.lastIndexOf(' ', start + max)
      cut = space > start + min ? space + 1 : start + max
    }
    out.push([start, cut])
    start = cut
  }
  out.push([start, text.length])
  return out
}

/* ---------- word alignment (for highlighting the word being spoken) ---------- */

export interface WordSpan {
  start: number
  end: number
}

/** Positions of the whitespace-separated words in a text. */
export function wordSpans(text: string): WordSpan[] {
  const out: WordSpan[] = []
  const re = /\S+/g
  for (let m = re.exec(text); m; m = re.exec(text)) out.push({ start: m.index, end: m.index + m[0].length })
  return out
}

function alignKey(w: string): string {
  return w
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
}

/**
 * Maps every speech word to the range of display words it stands for, [first, last] inclusive,
 * or [-1, -1] before anything on screen has been reached. Uses a longest common subsequence
 * over normalised words, so rewrites such as "Rs. 4,00,000" -> "4 lakh rupees" map to the
 * original words and dropped citations are simply skipped.
 */
export function alignWords(speechWords: string[], displayWords: string[], connective?: boolean[]): [number, number][] {
  const a = speechWords.map((w, k) => (connective?.[k] ? '' : alignKey(w)))
  const b = displayWords.map(alignKey)
  const n = a.length
  const m = b.length
  const W = m + 1
  const dp = new Uint16Array((n + 1) * W)
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i * W + j] = a[i] && a[i] === b[j] ? dp[(i + 1) * W + j + 1] + 1 : Math.max(dp[(i + 1) * W + j], dp[i * W + j + 1])
    }
  }
  const match = new Int32Array(n).fill(-1)
  let i = 0
  let j = 0
  while (i < n && j < m) {
    if (a[i] && a[i] === b[j]) {
      match[i] = j
      i++
      j++
    } else if (dp[(i + 1) * W + j] >= dp[i * W + j + 1]) i++
    else j++
  }
  const out: [number, number][] = []
  let prev = -1
  let lastEnd = -1
  for (let k = 0; k < n; k++) {
    if (match[k] >= 0) {
      out.push([match[k], match[k]])
      prev = lastEnd = match[k]
      continue
    }
    // Connective teaching words ("Point two.") never claim words on screen.
    if (connective?.[k]) {
      out.push(lastEnd >= 0 ? [lastEnd, lastEnd] : [-1, -1])
      continue
    }
    let nk = k + 1
    while (nk < n && match[nk] < 0) nk++
    const next = nk < n ? match[nk] : m
    const from = prev + 1
    const to = next - 1
    if (to >= from) {
      out.push([from, to])
      lastEnd = to
    } else out.push(lastEnd >= 0 ? [lastEnd, lastEnd] : [-1, -1])
  }
  return out
}

/** Index of the word containing (or last starting before) a character offset; -1 before the first word. */
export function wordIndexAt(starts: readonly number[], charIndex: number): number {
  let lo = 0
  let hi = starts.length - 1
  let ans = -1
  while (lo <= hi) {
    const mid = (lo + hi) >> 1
    if (starts[mid] <= charIndex) {
      ans = mid
      lo = mid + 1
    } else hi = mid - 1
  }
  return ans
}

/** Rough speaking time for a text at a given rate (about 165 words a minute at 1x). */
export function estimateMs(text: string, rate = 1): number {
  const words = text.split(/\s+/).filter(Boolean).length
  return Math.max(1200, (words * 60_000) / (165 * Math.max(0.5, rate)))
}

/** "a, b and c" */
export function joinList(items: string[]): string {
  if (items.length <= 1) return items.join('')
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`
}

/** Drops the heading number: "4.2 Residence of an individual" -> "Residence of an individual". */
export function stripHeadingNumber(title: string): string {
  return title.replace(/^\s*\d+(?:\.\d+)*\.?\s+/, '').trim() || title
}

/* ---------- keywords (for matching quick-check questions to a slide) ---------- */

const STOP_WORDS = new Set(
  (
    'about above after again against among another because before being below between both could does doing during ' +
    'each every first further having other others ought shall should since their theirs there these those through ' +
    'under until where which while whose would within without whether always never often still hence therefore ' +
    'however also only very such same than then them they this that with from have were been into upon what when ' +
    'your yours itself himself herself following given means least where whatever whichever'
  ).split(' '),
)

/** Distinctive words (5+ letters, no stop words, light plural folding), de-duplicated. */
export function keywords(text: string): string[] {
  const words =
    text
      .replace(/<[^>]+>/g, ' ')
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .match(/[a-z]{5,}/g) ?? []
  const out = new Set<string>()
  for (const w of words) {
    if (STOP_WORDS.has(w)) continue
    out.add(w.endsWith('s') && !w.endsWith('ss') ? w.slice(0, -1) : w)
  }
  return [...out]
}
