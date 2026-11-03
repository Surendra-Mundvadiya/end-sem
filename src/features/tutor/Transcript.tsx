import { memo, useEffect, useRef } from 'react'
import { useReducedMotion } from 'framer-motion'
import { ChevronDown, CircleHelp, ListOrdered } from 'lucide-react'
import { transcriptText, type Segment } from './script'
import { KindIcon, Words, type Highlight } from './Stage'
import { keepFocus } from './Transport'

interface Props {
  segments: Segment[]
  /** Current segment; equal to segments.length while the quick check is on. */
  current: number
  hl: Highlight
  quizLabel: string | null
  open: boolean
  onToggle: () => void
  onJump: (index: number) => void
}

const Line = memo(function Line({
  segment,
  state,
  onJump,
}: {
  segment: Segment
  state: 'done' | 'todo'
  onJump: (index: number) => void
}) {
  return (
    <li>
      <button type="button" className="tt-line" data-state={state} data-i={segment.index} onMouseDown={keepFocus} onClick={() => onJump(segment.index)}>
        <span className="tt-line-icon" data-kind={segment.kind}>
          <KindIcon segment={segment} />
        </span>
        <span className="tt-line-text">{transcriptText(segment)}</span>
      </button>
    </li>
  )
})

/** Karaoke-style transcript: the current line follows the voice; click any line to jump there. */
export default function Transcript({ segments, current, hl, quizLabel, open, onToggle, onJump }: Props) {
  const listRef = useRef<HTMLOListElement>(null)
  const userScrolledAt = useRef(0)
  const reduce = useReducedMotion()

  useEffect(() => {
    const list = listRef.current
    if (!list || list.offsetParent === null) return
    if (Date.now() - userScrolledAt.current < 4000) return
    const el = list.querySelector<HTMLElement>(`[data-i="${current}"]`)
    if (!el) return
    const top = el.offsetTop - list.clientHeight / 2 + el.offsetHeight / 2
    list.scrollTo({ top: Math.max(0, top), behavior: reduce ? 'auto' : 'smooth' })
  }, [current, open, reduce])

  const markUserScroll = () => {
    userScrolledAt.current = Date.now()
  }

  const seg = segments[current]
  return (
    <aside className="tt-transcript card" data-open={open ? 'true' : 'false'} aria-label="Transcript">
      <div className="tt-transcript-head">
        <ListOrdered size={16} aria-hidden="true" />
        <h2 className="tt-transcript-title">Transcript</h2>
        <span className="tt-transcript-count">
          {Math.min(current + 1, segments.length)}/{segments.length}
        </span>
        <button
          type="button"
          className="btn btn-ghost btn-sm tt-transcript-toggle"
          aria-expanded={open}
          aria-controls="tt-lines"
          onClick={onToggle}
        >
          {open ? 'Hide' : 'Show'}
          <ChevronDown size={14} className="tt-chevron" data-open={open ? 'true' : 'false'} aria-hidden="true" />
        </button>
      </div>
      <ol className="tt-lines" id="tt-lines" ref={listRef} onWheel={markUserScroll} onTouchMove={markUserScroll}>
        {segments.map((s) =>
          s.index === current && seg ? (
            <li key={s.key}>
              <button type="button" className="tt-line" data-state="now" data-i={s.index} aria-current="true" onMouseDown={keepFocus} onClick={() => onJump(s.index)}>
                <span className="tt-line-icon" data-kind={s.kind}>
                  <KindIcon segment={s} />
                </span>
                <span className="tt-line-text">
                  {s.kind === 'case' && s.part === 0 && s.head && (
                    <>
                      <Words runs={s.head} hl={hl} /> —{' '}
                    </>
                  )}
                  <Words runs={s.runs} hl={hl} />
                </span>
              </button>
            </li>
          ) : (
            <Line key={s.key} segment={s} state={s.index < current ? 'done' : 'todo'} onJump={onJump} />
          ),
        )}
        {quizLabel && (
          <li>
            <div className="tt-line tt-line--quiz" data-state={current >= segments.length ? 'now' : 'todo'} data-i={segments.length}>
              <span className="tt-line-icon" data-kind="quiz">
                <CircleHelp size={14} />
              </span>
              <span className="tt-line-text">{quizLabel}</span>
            </div>
          </li>
        )}
      </ol>
    </aside>
  )
}
