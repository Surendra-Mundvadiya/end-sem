import { getUnit, SLIDES, type Slide } from '../../data'
import {
  alignWords,
  caseShortName,
  chunkRanges,
  joinList,
  lowerFirst,
  numberWord,
  numberWordCap,
  sentenceRanges,
  speakEquation,
  speechify,
  stripHeadingNumber,
  trimEndPunct,
  wordSpans,
} from './speechText'

/*
 * Turns one slide of notes into an ordered lesson script. Every segment keeps the text exactly
 * as it appears in the notes (display) and a speech-friendly version for the voice (speech).
 * The only words added are connective teaching phrases ("Point two.", "A leading case:", "To recap",
 * "The big idea:", "Step one.") and, on screen, separators such as the ":" after a term or a row label.
 *
 * Blocks (CONTENT-SPEC section 3) map onto the stage's segment kinds:
 *   p.lead, p.eq, div.example, aside.update, div.remember, p.plan-q   -> 'text' (with a label)
 *   ol.pts / ol.steps items, table.cmp rows, dl.terms pairs, tiles     -> 'point' ("Step 2 of 4")
 *   div.case (with or without dl.brief)                                -> 'case'
 * Containers (div.formula, div.example, div.grid, div.plan, unknown divs) are walked recursively,
 * so every piece of text in a slide is spoken.
 */

export type SegmentKind = 'intro' | 'text' | 'point' | 'case' | 'clause' | 'focus' | 'recap'

/** A piece of display text in one style. `w` is its display word index, -1 for spaces. */
export interface Run {
  text: string
  w: number
  strong?: boolean
  em?: boolean
  marker?: boolean
}

export interface RecapTerm {
  text: string
  /** Display word range [from, to] of this term inside the recap runs. */
  from: number
  to: number
}

export interface Segment {
  /** Unique key, e.g. "s7:4". */
  key: string
  index: number
  kind: SegmentKind
  /** Source block in the slide. Sentences of one paragraph, point or case share it. */
  block: number
  /** Position of this sentence inside its block, and the number of sentences in the block. */
  part: number
  parts: number
  /** Short label for the stage and the transcript: "Point 2 of 5", "Leading case", "Exam tip". */
  label: string
  /** 1-based point number, for points. */
  point?: number
  /** For cases: the case name exactly as printed in the notes. */
  caseName?: string
  /** Case-name runs. They carry word indices only on the segment that speaks the name. */
  head?: Run[]
  /** For the recap: the terms listed. */
  terms?: RecapTerm[]
  /** For exam focus: the label printed in the notes ("Exam focus"). */
  focusLabel?: string
  /** Starts mid-sentence (a long sentence split at a clause boundary). */
  cont?: boolean
  /** The sentence carries on in the next segment. */
  more?: boolean
  /** Display text (exactly as in the notes; generated for intro and recap). */
  display: string
  runs: Run[]
  /** What the voice says. */
  speech: string
  /** Character offset of every speech word. */
  speechStarts: number[]
  /** For every speech word, the display words [first, last] it covers ([-1, -1] = none yet). */
  wordMap: [number, number][]
}

export interface LessonScript {
  slideId: string
  segments: Segment[]
}

/* ---------- minimal DOM access (works with DOMParser and with a test shim) ---------- */

export interface MiniNode {
  nodeType: number
  nodeName: string
  nodeValue: string | null
  childNodes: ArrayLike<MiniNode>
  getAttribute?(name: string): string | null
}

export type ParseHtml = (html: string) => MiniNode[]

function browserParse(html: string): MiniNode[] {
  const doc = new DOMParser().parseFromString(`<!doctype html><body>${html}</body>`, 'text/html')
  return Array.from(doc.body.childNodes) as unknown as MiniNode[]
}

const tagOf = (n: MiniNode) => n.nodeName.toLowerCase()
const hasClass = (n: MiniNode, c: string) => (n.getAttribute?.('class') ?? '').split(/\s+/).includes(c)
const elements = (n: MiniNode) => Array.from(n.childNodes).filter((c) => c.nodeType === 1)

/* ---------- styled text: one flag per character ---------- */

const STRONG = 1
const EM = 2
const MARKER = 4

class Styled {
  text = ''
  flags: number[] = []

  add(raw: string, flags: number) {
    for (const ch of raw.replace(/\s+/g, ' ')) {
      if (ch === ' ') this.space()
      else {
        this.text += ch
        this.flags.push(flags)
      }
    }
  }

  space() {
    if (this.text && !this.text.endsWith(' ')) {
      this.text += ' '
      this.flags.push(0)
    }
  }

  /** Trimmed copy of [start, end). */
  slice(start: number, end: number): Styled {
    while (start < end && this.text[start] === ' ') start++
    while (end > start && this.text[end - 1] === ' ') end--
    const s = new Styled()
    s.text = this.text.slice(start, end)
    s.flags = this.flags.slice(start, end)
    return s
  }

  trimmed(): Styled {
    return this.slice(0, this.text.length)
  }

  /** True when every non-space character is bold. */
  allStrong(): boolean {
    for (let i = 0; i < this.text.length; i++) if (this.text[i] !== ' ' && !(this.flags[i] & STRONG)) return false
    return this.text.length > 0
  }
}

/** Elements whose text is separated from its neighbours by a space when flattened. */
const BLOCK_TAGS = new Set([
  'p', 'div', 'li', 'aside', 'h3', 'h4', 'blockquote', 'section',
  'dl', 'dt', 'dd', 'table', 'caption', 'thead', 'tbody', 'tfoot', 'tr', 'th', 'td',
])

/** Inline content: grouped into a paragraph when it sits loose inside a container. */
const INLINE_TAGS = new Set(['strong', 'b', 'em', 'i', 'sup', 'sub', 'span', 'br', 'a', 'code', 'small', 'mark', 'u', 's'])

function toRoman(n: number): string {
  const table: [number, string][] = [[10, 'x'], [9, 'ix'], [5, 'v'], [4, 'iv'], [1, 'i']]
  let out = ''
  for (const [v, s] of table) {
    while (n >= v) {
      out += s
      n -= v
    }
  }
  return out
}

function collect(node: MiniNode, out: Styled, flags: number) {
  if (node.nodeType === 3) {
    out.add(node.nodeValue ?? '', flags)
    return
  }
  if (node.nodeType !== 1) return
  const tag = tagOf(node)
  if (tag === 'br') {
    out.space()
    return
  }
  let f = flags
  if (tag === 'strong' || tag === 'b') f |= STRONG
  if (tag === 'em' || tag === 'i') f |= EM
  if (tag === 'ol' || tag === 'ul') {
    const roman = hasClass(node, 'roman')
    let n = 0
    for (const li of elements(node)) {
      n++
      out.space()
      out.add(roman ? `(${toRoman(n)})` : `${n}.`, MARKER)
      out.space()
      collect(li, out, f)
      out.space()
    }
    return
  }
  const block = BLOCK_TAGS.has(tag)
  if (block) out.space()
  for (const c of Array.from(node.childNodes)) collect(c, out, f)
  if (block) out.space()
}

function styledOf(nodes: MiniNode[]): Styled {
  const s = new Styled()
  for (const n of nodes) collect(n, s, 0)
  return s.trimmed()
}

/** Pieces of styled text joined by single spaces (empty pieces are skipped). */
function joinStyled(...parts: (Styled | null | undefined)[]): Styled {
  const out = new Styled()
  for (const p of parts) {
    if (!p?.text) continue
    out.space()
    out.text += p.text
    out.flags.push(...p.flags)
  }
  return out.trimmed()
}

/** A generated separator (" — ", " · "), styled like a list marker. */
function markerOf(text: string): Styled {
  const s = new Styled()
  s.add(text, MARKER)
  return s
}

/** A label shown before its text ("Facts", a term, a row label, a tile title): bold, with a ":" unless it ends in punctuation. */
function labelOf(s: Styled, bold = true, colon = true): Styled {
  const out = new Styled()
  out.text = s.text
  out.flags = s.flags.map((f) => (bold ? f | STRONG : f))
  if (colon && out.text && !/[:.?!–—-]$/.test(out.text)) {
    out.text += ':'
    out.flags.push(MARKER)
  }
  return out
}

/** "Facts:" spoken as "Facts:"; the colon gives the voice a short pause. */
function spokenLabel(text: string): string {
  return `${speechify(trimEndPunct(text))}:`
}

const isBlockEl = (n: MiniNode) => n.nodeType === 1 && !INLINE_TAGS.has(tagOf(n))

function toRuns(s: Styled, wordBase = 0): { runs: Run[]; words: string[] } {
  const runs: Run[] = []
  const words: string[] = []
  const { text, flags } = s
  let i = 0
  let w = wordBase - 1
  while (i < text.length) {
    if (text[i] === ' ') {
      runs.push({ text: ' ', w: -1 })
      i++
      continue
    }
    let j = i
    while (j < text.length && text[j] !== ' ') j++
    w++
    words.push(text.slice(i, j))
    let k = i
    while (k < j) {
      let l = k
      while (l < j && flags[l] === flags[k]) l++
      const run: Run = { text: text.slice(k, l), w }
      if (flags[k] & STRONG) run.strong = true
      if (flags[k] & EM) run.em = true
      if (flags[k] & MARKER) run.marker = true
      runs.push(run)
      k = l
    }
    i = j
  }
  return { runs, words }
}

/** Plain runs (no styling) for generated text. */
function plainRuns(text: string, wordBase = 0) {
  const s = new Styled()
  s.add(text, 0)
  return toRuns(s.trimmed(), wordBase)
}

interface Piece {
  s: Styled
  /** Starts in the middle of a sentence. */
  cont: boolean
  /** The sentence carries on in the next piece. */
  more: boolean
}

/**
 * Splits a block into sentences, folding short bold labels ("Urban land.") into the next
 * sentence, and breaks very long sentences at clause boundaries.
 */
function sentencesOf(s: Styled): Piece[] {
  // A list marker ("2." in a flattened list) never ends a sentence: join it to what follows.
  const ranges: [number, number][] = []
  for (const [a, b] of sentenceRanges(s.text)) {
    const last = ranges[ranges.length - 1]
    if (last && s.flags[last[1] - 1] & MARKER) last[1] = b
    else ranges.push([a, b])
  }
  const sentences: Styled[] = []
  let start = -1
  for (let r = 0; r < ranges.length; r++) {
    const [a, b] = ranges[r]
    if (start < 0) start = a
    const piece = s.slice(start, b)
    const words = piece.text.split(' ').length
    const isLabel = words <= 2 || (words <= 5 && piece.allStrong())
    if (isLabel && r < ranges.length - 1) continue
    sentences.push(piece)
    start = -1
  }
  if (!sentences.length) sentences.push(s)
  const out: Piece[] = []
  for (const sentence of sentences) {
    const chunks = chunkRanges(sentence.text)
    chunks.forEach(([a, b], i) => out.push({ s: sentence.slice(a, b), cont: i > 0, more: i < chunks.length - 1 }))
  }
  return out
}

/* ---------- building segments ---------- */

interface Draft {
  kind: SegmentKind
  block: number
  part: number
  parts: number
  label: string
  point?: number
  caseName?: string
  head?: Run[]
  terms?: RecapTerm[]
  focusLabel?: string
  cont?: boolean
  more?: boolean
  display: string
  runs: Run[]
  /** Display words used for alignment (head words first when the head is spoken). */
  words: string[]
  speech: string
  /** Character ranges of the speech that are connective teaching phrases, not notes text. */
  connective: [number, number][]
}

/** A speech part: plain text comes from the notes; `{ c }` is a connective teaching phrase. */
type SpeechPart = string | { c: string }

function joinSpeech(parts: SpeechPart[]): { speech: string; connective: [number, number][] } {
  let speech = ''
  const connective: [number, number][] = []
  for (const p of parts) {
    const text = (typeof p === 'string' ? p : p.c).trim()
    if (!text) continue
    if (speech) speech += ' '
    const start = speech.length
    speech += text
    if (typeof p !== 'string') connective.push([start, speech.length])
  }
  return { speech, connective }
}

const hasSpeech = (parts: SpeechPart[]) => parts.some((p) => (typeof p === 'string' ? p : p.c).trim() !== '')

/** One segment's worth of a block: what is shown and what is said. */
interface Unit {
  s: Styled
  speech: SpeechPart[]
  cont?: boolean
  more?: boolean
}

interface UnitOptions {
  /** How to speak the text (speechify by default). */
  speak?: (text: string) => string
  /** Read a leading "(a)" as "Clause A:". */
  clause?: boolean
  /** Leading display text left out of the speech, because a connective says it instead. */
  dropLead?: RegExp
  /** Shown and spoken before the first unit: a term, a heading, a tile title. */
  label?: Styled
  /** How the label is spoken; its text and a ":" by default. */
  labelSpeech?: SpeechPart[]
}

/** A table row longer than this (characters on screen) continues on a second card. */
const ROW_MAX = 260

interface GridCell {
  s: Styled
}

function spanOf(n: MiniNode, attr: string): number {
  const v = Number.parseInt(n.getAttribute?.(attr) ?? '', 10)
  return Number.isFinite(v) && v > 1 ? Math.min(v, 50) : 1
}

/** Table rows as a grid with colspan and rowspan expanded: a spanned cell fills every slot it covers. */
function tableGrid(rows: MiniNode[]): GridCell[][] {
  const grid: GridCell[][] = []
  /** Cells from earlier rows that still reach down, by column. */
  const carry: { cell: GridCell; left: number }[] = []
  for (const tr of rows) {
    const row: GridCell[] = []
    let col = 0
    const takeCarried = () => {
      while (carry[col]?.left) {
        row[col] = carry[col].cell
        carry[col].left--
        col++
      }
    }
    for (const td of elements(tr)) {
      const tag = tagOf(td)
      if (tag !== 'td' && tag !== 'th') continue
      takeCarried()
      const cell: GridCell = { s: styledOf([td]) }
      const cs = spanOf(td, 'colspan')
      const rs = spanOf(td, 'rowspan')
      for (let k = 0; k < cs; k++) {
        row[col + k] = cell
        carry[col + k] = { cell, left: rs - 1 }
      }
      col += cs
    }
    for (let c = col; c < carry.length; c++) {
      if (carry[c]?.left) {
        row[c] = carry[c].cell
        carry[c].left--
      }
    }
    grid.push(row)
  }
  return grid
}

/** dt/dd pairs of a definition list. Several dt before one dd share it; several dd after one dt are joined. */
function dlPairs(dl: MiniNode): { terms: MiniNode[]; defs: MiniNode[] }[] {
  const pairs: { terms: MiniNode[]; defs: MiniNode[] }[] = []
  const kids = elements(dl).flatMap((k) => (tagOf(k) === 'div' ? elements(k) : [k]))
  for (const k of kids) {
    const tag = tagOf(k)
    const last = pairs[pairs.length - 1]
    if (tag === 'dt') {
      if (last && !last.defs.length) last.terms.push(k)
      else pairs.push({ terms: [k], defs: [] })
    } else if (tag === 'dd') {
      if (last) last.defs.push(k)
      else pairs.push({ terms: [], defs: [k] })
    }
  }
  return pairs
}

function finish(slideId: string, drafts: Draft[]): Segment[] {
  return drafts.map((d, index) => {
    const spans = wordSpans(d.speech)
    const speechWords = spans.map((sp) => d.speech.slice(sp.start, sp.end))
    const isConnective = spans.map((sp) => d.connective.some(([a, b]) => sp.start >= a && sp.start < b))
    const { words, connective: _connective, ...rest } = d
    return {
      ...rest,
      key: `${slideId}:${index}`,
      index,
      speechStarts: spans.map((sp) => sp.start),
      wordMap: alignWords(speechWords, words, isConnective),
    }
  })
}

const BOLD_TERM_MAX = 70

/** Bold lead-ins that label a block rather than name something to remember. */
const STRUCTURAL_LABEL =
  /^(?:exam focus|exam tip|law update|update|current law|correction|caveat|note|remember|memory hook|worked example|example|illustration|key point|tip)$/i

function recapTerms(nodes: MiniNode[]): string[] {
  const found: string[] = []
  const seen = new Set<string>()
  const add = (raw: string) => {
    const s = raw.replace(/[\s.:;,]+$/, '').trim()
    const key = s.toLowerCase()
    const isLabel = /^\(?[a-z0-9]{1,4}\)?$/i.test(s) || STRUCTURAL_LABEL.test(s) || /^[†‡*]+$/.test(s)
    if (s && !isLabel && s.length <= BOLD_TERM_MAX && !seen.has(key)) {
      seen.add(key)
      found.push(s)
    }
  }
  const visit = (n: MiniNode, inCaseName: boolean, inTerms: boolean) => {
    if (n.nodeType !== 1) return
    const tag = tagOf(n)
    if (tag === 'strong' || tag === 'b') {
      if (!inCaseName) add(styledOf([n]).text)
      return
    }
    // The terms of a definitions list are the terms to recall.
    if (inTerms && tag === 'dt') {
      add(styledOf([n]).text)
      return
    }
    const cname = inCaseName || hasClass(n, 'cname')
    const terms = tag === 'dl' ? hasClass(n, 'terms') : inTerms
    for (const c of elements(n)) visit(c, cname, terms)
  }
  for (const n of nodes) visit(n, false, false)
  return found
}

export interface BuildOptions {
  /** Short intro, used when the lesson continues straight on from the previous slide. */
  brief?: boolean
}

export function buildScript(slide: Slide, opts: BuildOptions = {}, parse: ParseHtml = browserParse): LessonScript {
  const unit = getUnit(slide.unitId)
  const unitSpoken = `Unit ${numberWordCap(unit.index + 1)}`
  const title = stripHeadingNumber(slide.title)
  const topic = stripHeadingNumber(slide.part)
  const prev = SLIDES[slide.index - 1]
  const firstOfPart = !prev || prev.part !== slide.part || prev.unitId !== slide.unitId
  const all = parse(slide.html)
  const nodes = all.filter((n) => n.nodeType === 1)
  const drafts: Draft[] = []

  /* intro: built only from the unit and slide data */
  const unitLine = { c: `${unitSpoken}: ${speechify(unit.name)}.` }
  let intro: SpeechPart[]
  if (slide.isPractice) {
    intro = opts.brief
      ? [{ c: `Now, the practice questions for ${unitSpoken}.` }]
      : [unitLine, { c: 'Practice questions. Listen to each question, then pause and plan your answer.' }]
  } else if (opts.brief) {
    intro = firstOfPart
      ? [{ c: `Next topic: ${speechify(topic)}.` }, topic !== title ? `${speechify(title)}.` : '']
      : [{ c: 'Next:' }, `${speechify(title)}.`]
  } else if (firstOfPart || topic === title) {
    intro = [unitLine, `${speechify(title)}.`, { c: "Let's understand it, step by step." }]
  } else {
    intro = [unitLine, { c: `Topic: ${speechify(topic)}. In this lesson,` }, `${speechify(title)}.`, { c: "Let's understand it, step by step." }]
  }
  {
    const { runs, words } = plainRuns(slide.title)
    drafts.push({ kind: 'intro', block: -1, part: 0, parts: 1, label: 'Introduction', display: slide.title, runs, words, ...joinSpeech(intro) })
  }

  /* body */
  let block = 0
  let prevKind: SegmentKind | null = null
  /** A connective waiting for the next segment ("Worked example:" for an example without a title). */
  let pending: SpeechPart[] = []

  /** Splits a block into sentence-sized units. `prefix` is spoken before the first. */
  const unitsOf = (styled: Styled, prefix: SpeechPart[] = [], o: UnitOptions = {}): Unit[] => {
    const speak = o.speak ?? speechify
    return sentencesOf(styled).map(({ s, cont, more }, i) => {
      const first = i === 0
      const parts: SpeechPart[] = first ? [...prefix] : []
      let spoken = speak(first && o.dropLead ? s.text.replace(o.dropLead, '') : s.text)
      if (first && o.clause) {
        const m = /^\((\w{1,4})\)\s*/.exec(spoken)
        if (m) {
          parts.push({ c: 'Clause' }, `${m[1]}:`)
          spoken = spoken.slice(m[0].length)
        }
      }
      if (first && o.label?.text) parts.push(...(o.labelSpeech ?? [spokenLabel(o.label.text)]))
      parts.push(spoken)
      return { s: first && o.label ? joinStyled(o.label, s) : s, speech: parts, cont, more }
    })
  }

  /**
   * Adds one block as a run of segments that share a card on the stage.
   * `head` (a case name) is spoken with the first unit; units with nothing to say are dropped.
   */
  const pushUnits = (kind: SegmentKind, label: string, units: Unit[], extra: Partial<Draft> = {}, head?: Styled) => {
    const list = units.filter((u) => hasSpeech(u.speech))
    if (!list.length) return
    if (pending.length) {
      list[0] = { ...list[0], speech: [...pending, ...list[0].speech] }
      pending = []
    }
    const headRuns = head ? toRuns(head) : null
    list.forEach(({ s, speech, cont, more }, part) => {
      const first = part === 0
      const body = toRuns(s, first && headRuns ? headRuns.words.length : 0)
      drafts.push({
        kind, block, part, parts: list.length, label, display: s.text, runs: body.runs,
        words: first && headRuns ? [...headRuns.words, ...body.words] : body.words,
        head: headRuns ? (first ? headRuns.runs : headRuns.runs.map((r) => ({ ...r, w: -1 }))) : undefined,
        cont: cont || undefined, more: more || undefined,
        ...joinSpeech(speech),
        ...extra,
      })
    })
    block++
    prevKind = kind
  }

  /** Adds one block (paragraph, point, case, clause or exam focus); `prefix` is spoken before it. */
  const pushBlock = (kind: SegmentKind, styled: Styled, label: string, prefix: SpeechPart[], extra: Partial<Draft> = {}, head?: Styled) =>
    pushUnits(kind, label, unitsOf(styled, prefix, { clause: kind === 'clause' }), extra, head)

  /**
   * Speaks a run of nodes in order. Loose inline content is grouped into a paragraph; elements are
   * dispatched by `walk`, unless `custom` handles them (it returns true when it did).
   */
  const walkNodes = (list: ArrayLike<MiniNode>, custom?: (el: MiniNode) => boolean) => {
    let run: MiniNode[] = []
    const flush = () => {
      if (run.length) pushBlock('text', styledOf(run), '', [])
      run = []
    }
    for (const n of Array.from(list)) {
      if (n.nodeType === 3 || (n.nodeType === 1 && !isBlockEl(n))) run.push(n)
      else if (n.nodeType === 1) {
        flush()
        if (!custom?.(n)) walk(n)
      }
    }
    flush()
  }

  /* ----- lists ----- */

  const pushList = (el: MiniNode) => {
    const items = elements(el).filter((li) => tagOf(li) === 'li')
    const total = items.length
    const noun = slide.isPractice ? 'Question' : 'Point'
    items.forEach((li, i) => {
      const n = i + 1
      let lead = ''
      if (n === 1 && total >= 3) {
        lead = slide.isPractice ? `There are ${numberWord(total)} questions. ` : `Let's take these ${numberWord(total)} points one by one. `
      }
      pushBlock('point', styledOf([li]), `${noun} ${n} of ${total}`, [{ c: `${lead}${noun} ${numberWord(n)}.` }], { point: n })
    })
  }

  /** ol.steps: "Step one … Step two …" */
  const pushSteps = (el: MiniNode) => {
    const items = elements(el).filter((li) => tagOf(li) === 'li')
    const total = items.length
    items.forEach((li, i) => {
      const n = i + 1
      const lead = n === 1 && total >= 3 ? `Here are the ${numberWord(total)} steps, in order. ` : ''
      pushBlock('point', styledOf([li]), `Step ${n} of ${total}`, [{ c: `${lead}Step ${numberWord(n)}.` }], { point: n })
    })
  }

  /* ----- comparison table: one spoken row at a time ----- */

  const pushTable = (el: MiniNode) => {
    const sections = elements(el)
    const rowsIn = (sec: MiniNode) => (tagOf(sec) === 'tr' ? [sec] : elements(sec).filter((r) => tagOf(r) === 'tr'))
    const headRows = sections.filter((s) => tagOf(s) === 'thead').flatMap(rowsIn)
    let bodyRows = sections.filter((s) => tagOf(s) !== 'thead' && tagOf(s) !== 'caption').flatMap(rowsIn)
    // Without a thead, a first row made only of th cells is the header row.
    if (!headRows.length && bodyRows.length > 1) {
      const cells = elements(bodyRows[0])
      if (cells.length && cells.every((c) => tagOf(c) === 'th')) {
        headRows.push(bodyRows[0])
        bodyRows = bodyRows.slice(1)
      }
    }
    const caption = sections.find((s) => tagOf(s) === 'caption')
    if (caption) pushBlock('text', styledOf([caption]), 'Comparison', [])

    const head = tableGrid(headRows)
    const width = Math.max(0, ...head.map((r) => r.length))
    const headers: string[] = []
    for (let c = 0; c < width; c++) {
      const texts: string[] = []
      for (const r of head) {
        const t = r[c]?.s.text
        if (t && !texts.includes(t)) texts.push(t)
      }
      headers.push(texts.join(' – '))
    }

    const body = tableGrid(bodyRows)
    if (!body.length) {
      // A header row and nothing else: read the headings.
      const seen = new Set<GridCell>()
      for (const r of head) for (const c of r) if (c) seen.add(c)
      pushBlock('text', joinStyled(...[...seen].map((c) => c.s)), 'Comparison', [])
      return
    }

    const total = body.length
    body.forEach((row, i) => {
      const n = i + 1
      // Distinct cells in column order (a colspan cell once). A cell spanning several columns is read
      // without a heading, since no single heading names it.
      const cells: { cell: GridCell; col: number; header: string }[] = []
      for (let c = 0; c < row.length; c++) {
        const cell = row[c]
        if (!cell) continue
        const same = cells.find((x) => x.cell === cell)
        if (same) same.header = ''
        else cells.push({ cell, col: c, header: headers[c] ?? '' })
      }
      const rowLabel = cells[0] && cells[0].col === 0 && cells[0].cell.s.text && cells.length > 1 ? cells[0] : null
      const values = (rowLabel ? cells.slice(1) : cells)
        .filter((v) => v.cell.s.text)
        .map((v) => {
          // "What changes: A new technology" on screen; "what changes, a new technology" in speech.
          const h = v.header && v.header !== v.cell.s.text ? v.header : ''
          const hs = new Styled()
          hs.add(h, 0)
          const said = speechify(trimEndPunct(v.cell.s.text))
          return { s: h ? joinStyled(labelOf(hs, false), v.cell.s) : v.cell.s, said: h ? `${lowerFirst(speechify(trimEndPunct(h)))}, ${said}` : said }
        })

      const units: Unit[] = []
      let parts: Styled[] = []
      let speech: SpeechPart[] = n === 1 && total >= 2 ? [{ c: "Let's compare, row by row." }] : []
      let hasValue = false
      if (rowLabel) {
        parts.push(labelOf(rowLabel.cell.s, true, false))
        speech.push(values.length ? spokenLabel(rowLabel.cell.s.text) : `${speechify(trimEndPunct(rowLabel.cell.s.text))}.`)
        if (values.length) parts.push(markerOf('—'))
      }
      values.forEach((v, k) => {
        // Long rows continue on a second card, at a cell boundary.
        if (hasValue && joinStyled(...parts, v.s).text.length > ROW_MAX) {
          units.push({ s: joinStyled(...parts), speech, cont: units.length > 0, more: true })
          parts = []
          speech = []
          hasValue = false
        }
        if (hasValue) parts.push(markerOf('·'))
        parts.push(v.s)
        speech.push(`${v.said}${k < values.length - 1 ? ';' : '.'}`)
        hasValue = true
      })
      units.push({ s: joinStyled(...parts), speech, cont: units.length > 0 })
      pushUnits('point', `Row ${n} of ${total}`, units, { point: n })
    })
  }

  /* ----- definitions and case briefs ----- */

  /** dl.terms: "<term> means …" */
  const pushTerms = (el: MiniNode) => {
    const pairs = dlPairs(el)
    const total = pairs.length
    pairs.forEach(({ terms, defs }, i) => {
      const n = i + 1
      const term = styledOf(terms)
      const def = styledOf(defs)
      const prefix: SpeechPart[] = n === 1 && total >= 3 ? [{ c: `Here are ${numberWord(total)} terms to know.` }] : []
      const termSaid = speechify(trimEndPunct(term.text))
      // A definition that already starts "means …" or "is …" needs no joining word.
      const joined = /^(?:means|mean|is|are|refers|includes|denotes|[:–—-])/i.test(def.text)
      const labelSpeech: SpeechPart[] = !def.text ? [`${termSaid}.`] : joined ? [termSaid] : [termSaid, { c: 'means' }]
      pushUnits('point', `Term ${n} of ${total}`, unitsOf(def, prefix, { label: labelOf(term, true, !!def.text && !joined), labelSpeech }), { point: n })
    })
  }

  /** dl.brief: "Facts: … Issue: … Held: …", one unit (or more, for long entries) per heading. */
  const briefUnits = (el: MiniNode): Unit[] =>
    dlPairs(el).flatMap(({ terms, defs }) => {
      const def = styledOf(defs)
      return unitsOf(def, [], { label: labelOf(styledOf(terms), true, !!def.text) })
    })

  const pushCase = (el: MiniNode) => {
    const kids = Array.from(el.childNodes)
    const nameEl = kids.find((k) => k.nodeType === 1 && hasClass(k, 'cname'))
    const caseName = nameEl ? styledOf([nameEl]).text : ''
    const units: Unit[] = []
    let startsWithBrief = false
    let run: MiniNode[] = []
    const add = (s: Styled) => {
      if (s.text) units.push(...unitsOf(s))
    }
    const flush = () => {
      if (run.length) add(styledOf(run))
      run = []
    }
    for (const k of kids) {
      if (k === nameEl) continue
      if (k.nodeType === 1 && tagOf(k) === 'dl') {
        flush()
        if (!units.length) startsWithBrief = true
        units.push(...briefUnits(k))
      } else if (k.nodeType === 1 && isBlockEl(k)) {
        flush()
        add(styledOf([k]))
      } else run.push(k)
    }
    flush()
    const head = new Styled()
    head.add(caseName, 0)
    const opener = prevKind === 'case' ? 'Another leading case:' : 'A leading case:'
    // A neutral bridge: many case notes open with the facts, so "The court held" would misstate them.
    // A brief announces its own headings ("Facts: …"), so it needs no bridge.
    const prefix: SpeechPart[] = [
      { c: opener },
      caseName ? `${speechify(caseName)}.` : '',
      startsWithBrief || !units.length ? '' : { c: 'In this case:' },
    ]
    if (!units.length) units.push({ s: new Styled(), speech: [] })
    units[0] = { ...units[0], speech: [...prefix, ...units[0].speech] }
    pushUnits('case', 'Leading case', units, { caseName }, head.trimmed())
  }

  /* ----- callouts ----- */

  const pushFocus = (el: MiniNode) => {
    const styled = styledOf([el])
    // The bold lead-in ("Exam focus.") becomes the callout's heading.
    let cut = 0
    while (cut < styled.text.length && (styled.flags[cut] & STRONG || styled.text[cut] === ' ')) cut++
    const lead = styled.text.slice(0, cut).trim()
    const hasLead = lead.length > 0 && lead.length < 40 && cut < styled.text.length
    const body = hasLead ? styled.slice(cut, styled.text.length) : styled
    const focusLabel = hasLead ? lead.replace(/[.:]+$/, '') : 'Exam focus'
    pushBlock('focus', body, 'Exam tip', [{ c: 'Exam tip:' }], { focusLabel })
  }

  /** aside.update: "Law update: …" (the notes' own "Law update." lead-in is read as it is). */
  const pushUpdate = (el: MiniNode) => {
    const styled = styledOf([el])
    const announced = /^(?:law update|update|current law)\b/i.test(styled.text)
    pushBlock('text', styled, 'Law update', announced ? [] : [{ c: 'Law update:' }])
  }

  /** div.remember: "Memory hook: …" in place of the printed "Remember:". */
  const pushRemember = (el: MiniNode) => {
    pushUnits('text', 'Memory hook', unitsOf(styledOf([el]), [{ c: 'Memory hook:' }], { dropLead: /^(?:remember|memory hook)\b\s*[:.–—-]?\s*/i }))
  }

  const pushClause = (el: MiniNode) => {
    const styled = styledOf([el])
    const m = /^\(([0-9a-z]{1,4})\)/i.exec(styled.text)
    pushBlock('clause', styled, m ? `Clause (${m[1]})` : 'Statutory text', [])
  }

  /* ----- formulas, worked examples, tiles and answer plans ----- */

  /** p.eq: the equation read naturally ("÷" as "divided by", "=" as "equals" …). */
  const pushEquation = (el: MiniNode, opener: string) => {
    pushUnits('text', 'Formula', unitsOf(styledOf([el]), [{ c: opener }], { speak: speakEquation }))
  }

  /** div.formula: each equation, then its explanation. */
  const pushFormula = (el: MiniNode) => {
    if (!Array.from(el.childNodes).some(isBlockEl)) {
      pushEquation(el, 'The formula:')
      return
    }
    let eqs = 0
    walkNodes(el.childNodes, (k) => {
      if (!hasClass(k, 'eq')) return false
      pushEquation(k, eqs++ ? 'And:' : 'The formula:')
      return true
    })
  }

  /** div.example: the title ("Worked example", "Illustration"), then its contents. */
  const pushExample = (el: MiniNode) => {
    const kids = Array.from(el.childNodes)
    const titleEl = kids.find((k) => k.nodeType === 1 && hasClass(k, 'ex-title'))
    const title = titleEl ? styledOf([titleEl]) : null
    if (title?.text) {
      const said = `${speechify(trimEndPunct(title.text))}.`
      const named = /^(?:worked examples?|examples?|illustrations?)\b/i.test(title.text)
      pushUnits('text', 'Worked example', [{ s: title, speech: named ? [said] : [{ c: 'Worked example:' }, said] }])
    } else pending = [{ c: 'Worked example:' }]
    walkNodes(kids.filter((k) => k !== titleEl))
    pending = []
  }

  /** div.tile: "<title>: <text>" */
  const pushTile = (tile: MiniNode, n: number, total: number) => {
    const kids = Array.from(tile.childNodes)
    const titleEl = kids.find((k) => k.nodeType === 1 && hasClass(k, 'tile-t'))
    const title = titleEl ? styledOf([titleEl]) : null
    const body = styledOf(kids.filter((k) => k !== titleEl))
    const prefix: SpeechPart[] = n === 1 && total >= 3 ? [{ c: `Let's look at these ${numberWord(total)} side by side.` }] : []
    const opts: UnitOptions = title?.text
      ? { label: labelOf(title, true, !!body.text), labelSpeech: [body.text ? spokenLabel(title.text) : `${speechify(trimEndPunct(title.text))}.`] }
      : {}
    pushUnits('point', total > 1 ? `Concept ${n} of ${total}` : 'Concept', unitsOf(body, prefix, opts), { point: n })
  }

  const pushGrid = (el: MiniNode) => {
    const total = elements(el).filter((k) => hasClass(k, 'tile')).length
    let n = 0
    walkNodes(el.childNodes, (k) => {
      if (!hasClass(k, 'tile')) return false
      pushTile(k, ++n, total)
      return true
    })
  }

  /** div.plan: the question, then its steps. */
  const pushPlan = (el: MiniNode) => {
    walkNodes(el.childNodes, (k) => {
      if (!hasClass(k, 'plan-q')) return false
      // "Q1." is shown; "Question 1." is said.
      const speak = (t: string) => speechify(t.replace(/^Q\.?\s?(\d+)\s*[.:)]?\s*/i, 'Question $1. '))
      pushUnits('text', 'Answer plan', unitsOf(styledOf([k]), [{ c: 'Answer plan.' }], { speak }))
      return true
    })
  }

  /** Dispatches one element by its block type. */
  function walk(el: MiniNode) {
    const tag = tagOf(el)
    if (tag === 'ol' || tag === 'ul') return hasClass(el, 'steps') ? pushSteps(el) : pushList(el)
    if (tag === 'table') return pushTable(el)
    if (tag === 'dl') return hasClass(el, 'brief') ? pushUnits('text', 'Case brief', briefUnits(el)) : pushTerms(el)
    if (hasClass(el, 'case')) return pushCase(el)
    if (hasClass(el, 'update')) return pushUpdate(el)
    if (tag === 'aside' || hasClass(el, 'focus')) return pushFocus(el)
    if (hasClass(el, 'clause')) return pushClause(el)
    if (hasClass(el, 'remember')) return pushRemember(el)
    if (hasClass(el, 'formula')) return pushFormula(el)
    if (hasClass(el, 'eq')) return pushEquation(el, 'The formula:')
    if (hasClass(el, 'example')) return pushExample(el)
    if (hasClass(el, 'grid')) return pushGrid(el)
    if (hasClass(el, 'tile')) return pushTile(el, 1, 1)
    if (hasClass(el, 'plan')) return pushPlan(el)
    if (hasClass(el, 'lead')) return pushBlock('text', styledOf([el]), 'The big idea', [{ c: 'The big idea:' }])
    // Any other container: speak what is inside it, block by block, so nothing is skipped.
    if (tag !== 'p' && Array.from(el.childNodes).some(isBlockEl)) return walkNodes(el.childNodes)
    pushBlock('text', styledOf([el]), '', [])
  }

  walkNodes(all)

  /* recap */
  {
    let speech: SpeechPart[]
    let items: string[]
    let lead = 'To recap'
    if (slide.isPractice) {
      lead = 'Your turn'
      items = ['Plan an answer to each question', 'Check it against your notes']
      speech = [
        { c: `That's all the practice questions for ${unitSpoken}.` },
        'Plan an answer to each one, then check it against your notes.',
      ]
    } else {
      const terms = recapTerms(nodes).slice(0, 6)
      const cases = drafts.filter((d) => d.kind === 'case' && d.part === 0).map((d) => caseShortName(d.caseName ?? ''))
      if (terms.length) {
        items = terms
        speech = [{ c: 'To recap, remember:' }, `${joinList(terms.map(speechify))}.`]
      } else if (cases.length) {
        items = cases.slice(0, 4)
        speech = [{ c: `To recap, remember ${items.length === 1 ? 'the case' : 'the cases'}:` }, `${joinList(items.map(speechify))}.`]
      } else {
        // No bold terms or cases: repeat the opening sentence of the notes, if it is short enough.
        const opening = drafts.find((d) => d.kind === 'text' && !d.cont && !d.more && d.display.length <= 200)
        items = [opening ? opening.display : slide.title]
        speech = [{ c: 'To recap:' }, opening ? opening.speech : `${speechify(title)}.`]
      }
    }
    const runs: Run[] = []
    const words: string[] = []
    const recap: RecapTerm[] = []
    items.forEach((t, i) => {
      if (i > 0) runs.push({ text: ' · ', w: -1 })
      const r = plainRuns(t, words.length)
      recap.push({ text: t, from: words.length, to: words.length + r.words.length - 1 })
      runs.push(...r.runs)
      words.push(...r.words)
    })
    drafts.push({
      kind: 'recap', block, part: 0, parts: 1, label: lead, terms: recap,
      display: `${lead}: ${items.join(' · ')}`, runs, words, ...joinSpeech(speech),
    })
  }

  return { slideId: slide.id, segments: finish(slide.id, drafts) }
}

const cache = new Map<string, LessonScript>()

/** Memoised buildScript for the browser. */
export function scriptFor(slide: Slide, opts: BuildOptions = {}): LessonScript {
  const key = `${slide.id}|${opts.brief ? 1 : 0}`
  let s = cache.get(key)
  if (!s) {
    s = buildScript(slide, opts)
    cache.set(key, s)
  }
  return s
}

/** Display text for the transcript, case name included where it is spoken. */
export function transcriptText(seg: Segment): string {
  if (seg.kind === 'case' && seg.part === 0 && seg.caseName) return `${seg.caseName} — ${seg.display}`
  return seg.display
}
