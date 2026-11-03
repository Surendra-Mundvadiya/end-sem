import { getUnit, SLIDES, type Slide } from '../../data'
import {
  alignWords,
  caseShortName,
  chunkRanges,
  joinList,
  numberWord,
  numberWordCap,
  sentenceRanges,
  speechify,
  stripHeadingNumber,
  wordSpans,
} from './speechText'

/*
 * Turns one slide of notes into an ordered lesson script. Every segment keeps the text exactly
 * as it appears in the notes (display) and a speech-friendly version for the voice (speech).
 * The only words added are connective teaching phrases ("Point two.", "A leading case:", "To recap").
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
  const block = tag === 'p' || tag === 'div' || tag === 'li' || tag === 'aside' || tag === 'h3' || tag === 'h4'
  if (block) out.space()
  for (const c of Array.from(node.childNodes)) collect(c, out, f)
  if (block) out.space()
}

function styledOf(nodes: MiniNode[]): Styled {
  const s = new Styled()
  for (const n of nodes) collect(n, s, 0)
  return s.trimmed()
}

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
  const ranges = sentenceRanges(s.text)
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

function recapTerms(nodes: MiniNode[]): string[] {
  const found: string[] = []
  const seen = new Set<string>()
  const visit = (n: MiniNode, inClause: boolean, inCaseName: boolean) => {
    if (n.nodeType !== 1) return
    const tag = tagOf(n)
    if (tag === 'strong' || tag === 'b') {
      const s = styledOf([n]).text.replace(/[\s.:;,]+$/, '').trim()
      const key = s.toLowerCase()
      const isLabel = /^\(?[a-z0-9]{1,4}\)?$/i.test(s) || /^exam focus$/i.test(s)
      if (s && !isLabel && !inCaseName && s.length <= BOLD_TERM_MAX && !seen.has(key)) {
        seen.add(key)
        found.push(s)
      }
      return
    }
    const clause = inClause || hasClass(n, 'clause')
    const cname = inCaseName || hasClass(n, 'cname')
    for (const c of elements(n)) visit(c, clause, cname)
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
  const nodes = parse(slide.html).filter((n) => n.nodeType === 1)
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

  /**
   * Adds one block (paragraph, point, case, clause or exam focus) as a run of segments.
   * `prefix` is spoken before the first piece; `head` (a case name) is spoken with it too.
   */
  const pushBlock = (
    kind: SegmentKind,
    styled: Styled,
    label: string,
    prefix: SpeechPart[],
    extra: Partial<Draft> = {},
    head?: Styled,
  ) => {
    const pieces = sentencesOf(styled)
    pieces.forEach(({ s, cont, more }, part) => {
      const first = part === 0
      const headRuns = head ? toRuns(head) : null
      const body = toRuns(s, first && headRuns ? headRuns.words.length : 0)
      let text = speechify(s.text)
      const parts: SpeechPart[] = first ? [...prefix] : []
      if (kind === 'clause' && first) {
        const m = /^\((\w{1,4})\)\s*/.exec(text)
        if (m) {
          parts.push({ c: 'Clause' }, `${m[1]}:`)
          text = text.slice(m[0].length)
        }
      }
      parts.push(text)
      drafts.push({
        kind, block, part, parts: pieces.length, label, display: s.text, runs: body.runs,
        words: first && headRuns ? [...headRuns.words, ...body.words] : body.words,
        head: headRuns ? (first ? headRuns.runs : headRuns.runs.map((r) => ({ ...r, w: -1 }))) : undefined,
        cont: cont || undefined, more: more || undefined,
        ...joinSpeech(parts),
        ...extra,
      })
    })
    block++
    prevKind = kind
  }

  for (const el of nodes) {
    const tag = tagOf(el)
    if (tag === 'ol' || tag === 'ul') {
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
      continue
    }
    if (tag === 'div' && hasClass(el, 'case')) {
      const kids = elements(el)
      const nameEl = kids.find((k) => hasClass(k, 'cname'))
      const caseName = nameEl ? styledOf([nameEl]).text : ''
      const held = styledOf(kids.filter((k) => k !== nameEl))
      const head = new Styled()
      head.add(caseName, 0)
      const opener = prevKind === 'case' ? 'Another leading case:' : 'A leading case:'
      // A neutral bridge: many case notes open with the facts, so "The court held" would misstate them.
      pushBlock('case', held, 'Leading case', [{ c: opener }, `${speechify(caseName)}.`, { c: 'In this case:' }], { caseName }, head.trimmed())
      continue
    }
    if (tag === 'aside' || hasClass(el, 'focus')) {
      const styled = styledOf([el])
      // The bold lead-in ("Exam focus.") becomes the callout's heading.
      let cut = 0
      while (cut < styled.text.length && (styled.flags[cut] & STRONG || styled.text[cut] === ' ')) cut++
      const lead = styled.text.slice(0, cut).trim()
      const hasLead = lead.length > 0 && lead.length < 40 && cut < styled.text.length
      const body = hasLead ? styled.slice(cut, styled.text.length) : styled
      const focusLabel = hasLead ? lead.replace(/[.:]+$/, '') : 'Exam focus'
      pushBlock('focus', body, 'Exam tip', [{ c: 'Exam tip:' }], { focusLabel })
      continue
    }
    if (tag === 'div' && hasClass(el, 'clause')) {
      const styled = styledOf([el])
      const m = /^\(([0-9a-z]{1,4})\)/i.exec(styled.text)
      pushBlock('clause', styled, m ? `Clause (${m[1]})` : 'Statutory text', [])
      continue
    }
    pushBlock('text', styledOf([el]), '', [])
  }

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
