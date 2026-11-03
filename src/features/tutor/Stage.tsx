import type { ReactNode } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { BookMarked, Lightbulb, Scale, ScrollText, Sparkles } from 'lucide-react'
import UnitPill from '../../components/UnitPill'
import type { Slide } from '../../data'
import { easeOut, softSpring } from '../../lib/motion'
import type { Run, Segment } from './script'

/** How the words of the current segment are lit up. */
export type Highlight =
  | { mode: 'word'; range: [number, number] }
  /** Speaking, but the voice gives no word timings: the whole line is current. */
  | { mode: 'line' }
  | { mode: 'none' }

export const NO_HIGHLIGHT: Highlight = { mode: 'none' }

function wordState(w: number, hl: Highlight): string {
  if (hl.mode !== 'word' || w < 0) return ''
  const [a, b] = hl.range
  if (a < 0) return ' is-todo'
  if (w < a) return ' is-done'
  if (w <= b) return ' is-now'
  return ' is-todo'
}

/** Renders runs of notes text, keeping bold/italic, with karaoke-style word states. */
export function Words({ runs, hl }: { runs: Run[]; hl: Highlight }) {
  return (
    <>
      {runs.map((r, i) => {
        if (r.w < 0 && !r.marker) return r.text
        let cls = 'tt-w'
        if (r.strong) cls += ' is-strong'
        if (r.em) cls += ' is-em'
        if (r.marker) cls += ' is-marker'
        cls += wordState(r.w, hl)
        return (
          <span key={i} className={cls}>
            {r.text}
          </span>
        )
      })}
    </>
  )
}

function sizeClass(text: string): string {
  const n = text.length
  return n <= 110 ? 'tt-size-l' : n <= 220 ? 'tt-size-m' : 'tt-size-s'
}

function CardHead({ icon, label, detail }: { icon: ReactNode; label: string; detail?: ReactNode }) {
  return (
    <div className="tt-card-head">
      <span className="tt-card-icon" aria-hidden="true">
        {icon}
      </span>
      <span className="tt-card-label">{label}</span>
      {detail && <span className="tt-card-detail">{detail}</span>}
    </div>
  )
}

interface Props {
  slide: Slide
  segment: Segment
  hl: Highlight
  /** Segments in the lesson and rough listening time, shown on the intro card. */
  count: number
  minutes: number
}

/** The current segment, large and centred, with a visual cue for its type. */
export default function Stage({ slide, segment, hl, count, minutes }: Props) {
  const cardKey = `${segment.kind}:${segment.block}`
  const text = (
    <AnimatePresence mode="wait" initial={false}>
      <motion.p
        key={segment.key}
        className={`tt-text ${sizeClass(segment.display)}${segment.kind === 'text' ? '' : ' tt-text--boxed'}`}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -6, transition: { duration: 0.14 } }}
        transition={{ duration: 0.34, ease: easeOut }}
      >
        {segment.cont && <span className="tt-ellipsis">… </span>}
        <Words runs={segment.runs} hl={hl} />
        {segment.more && <span className="tt-ellipsis"> …</span>}
      </motion.p>
    </AnimatePresence>
  )

  let body: ReactNode
  switch (segment.kind) {
    case 'intro':
      body = (
        <>
          <div className="tt-intro-pill">
            <UnitPill unitId={slide.unitId} withName />
          </div>
          <h2 className="tt-intro-title">
            <Words runs={segment.runs} hl={hl} />
          </h2>
          {slide.part !== slide.title && <p className="tt-intro-part">{slide.part}</p>}
          <p className="tt-intro-meta">
            {count} parts · about {minutes} min
          </p>
        </>
      )
      break
    case 'point':
      body = (
        <>
          <CardHead icon={<span className="tt-point-no">{segment.point}</span>} label={segment.label} />
          {text}
        </>
      )
      break
    case 'case':
      body = (
        <>
          <CardHead icon={<Scale size={16} />} label="Leading case" />
          <p className="tt-case-name">{segment.head ? <Words runs={segment.head} hl={hl} /> : segment.caseName}</p>
          {text}
        </>
      )
      break
    case 'clause':
      body = (
        <>
          <CardHead icon={<ScrollText size={16} />} label={segment.label} detail="Statutory text" />
          {text}
        </>
      )
      break
    case 'focus':
      body = (
        <>
          <CardHead icon={<Lightbulb size={16} />} label="Exam tip" detail={segment.focusLabel} />
          {text}
        </>
      )
      break
    case 'recap':
      body = (
        <>
          <CardHead icon={<Sparkles size={16} />} label={segment.label} />
          <motion.ul className="tt-terms" initial="hidden" animate="show" variants={{ hidden: {}, show: { transition: { staggerChildren: 0.06 } } }}>
            {(segment.terms ?? []).map((t) => {
              let state = ''
              if (hl.mode === 'word') {
                const [a, b] = hl.range
                state = a < 0 ? 'todo' : b < t.from ? 'todo' : a > t.to ? 'done' : 'now'
              }
              return (
                <motion.li
                  key={t.text}
                  className="tt-term"
                  data-state={state || undefined}
                  variants={{ hidden: { opacity: 0, y: 8, scale: 0.96 }, show: { opacity: 1, y: 0, scale: 1, transition: softSpring } }}
                >
                  {t.text}
                </motion.li>
              )
            })}
          </motion.ul>
        </>
      )
      break
    default:
      body = text
  }

  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={cardKey}
        className={`tt-card tt-card--${segment.kind}`}
        data-line={hl.mode === 'line' ? 'on' : undefined}
        initial={{ opacity: 0, y: 18, scale: 0.985 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -10, scale: 0.99, transition: { duration: 0.18 } }}
        transition={softSpring}
      >
        {body}
        {segment.kind === 'text' && segment.parts > 1 && (
          <span className="tt-sentence-dots" aria-hidden="true">
            {Array.from({ length: segment.parts }, (_, i) => (
              <span key={i} data-on={i <= segment.part ? 'true' : undefined} />
            ))}
          </span>
        )}
      </motion.div>
    </AnimatePresence>
  )
}

/** Small icon for a segment type, for the transcript. */
export function KindIcon({ segment }: { segment: Segment }) {
  switch (segment.kind) {
    case 'point':
      return <span className="tt-line-no">{segment.point}</span>
    case 'case':
      return <Scale size={14} />
    case 'clause':
      return <ScrollText size={14} />
    case 'focus':
      return <Lightbulb size={14} />
    case 'recap':
      return <Sparkles size={14} />
    case 'intro':
      return <BookMarked size={14} />
    default:
      return <span className="tt-line-dot" />
  }
}
