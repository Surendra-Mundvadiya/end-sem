import { useEffect, useRef, useState, type CSSProperties, type MouseEvent } from 'react'
import { motion } from 'framer-motion'
import { ChevronLeft, ChevronRight, Pause, Play, SkipBack, SkipForward } from 'lucide-react'
import { bouncy } from '../../lib/motion'
import type { Segment } from './script'

/** Mouse clicks on secondary controls keep focus where it was, so Space still means play/pause. */
export const keepFocus = (e: MouseEvent) => e.preventDefault()

interface ScrubberProps {
  segments: Segment[]
  index: number
  /** Quick check after the last segment: none, still to come, on now, or over. */
  quiz: 'none' | 'todo' | 'now' | 'done'
  /** Everything has been spoken. */
  finished: boolean
  onSeek: (index: number) => void
}

/** Segment progress: one tick per segment, coloured by type; drag or use arrow keys to move. */
export function Scrubber({ segments, index, quiz, finished, onSeek }: ScrubberProps) {
  const [preview, setPreview] = useState<number | null>(null)
  const timer = useRef(0)
  useEffect(() => () => clearTimeout(timer.current), [])
  const shown = preview ?? index
  const count = segments.length
  const seg = segments[Math.min(shown, count - 1)]

  const change = (v: number) => {
    setPreview(v)
    clearTimeout(timer.current)
    // Wait for the drag or key repeat to settle before moving the voice.
    timer.current = window.setTimeout(() => {
      setPreview(null)
      onSeek(v)
    }, 220)
  }

  return (
    <div className="tt-scrub" style={{ '--tt-ticks': count + (quiz === 'none' ? 0 : 1) } as CSSProperties}>
      <div className="tt-ticks" aria-hidden="true">
        {segments.map((s, i) => (
          <span
            key={s.key}
            className="tt-tick"
            data-kind={s.kind}
            data-state={finished || i < shown ? 'done' : i === shown ? 'now' : 'todo'}
          />
        ))}
        {quiz !== 'none' && <span className="tt-tick" data-kind="quiz" data-state={quiz} />}
      </div>
      <input
        type="range"
        className="tt-range"
        min={0}
        max={Math.max(0, count - 1)}
        step={1}
        value={Math.min(shown, count - 1)}
        onChange={(e) => change(Number(e.target.value))}
        onPointerUp={(e) => e.currentTarget.blur()}
        aria-label="Position in the lesson"
        aria-valuetext={seg ? `Part ${Math.min(shown, count - 1) + 1} of ${count}${seg.label ? `: ${seg.label}` : ''}` : undefined}
      />
    </div>
  )
}

interface TransportProps {
  playing: boolean
  playLabel: string
  onToggle: () => void
  onPrev: () => void
  onNext: () => void
  onPrevSlide: () => void
  onNextSlide: () => void
  canPrev: boolean
  canNext: boolean
  canPrevSlide: boolean
  canNextSlide: boolean
}

/** Previous / play-pause / next, plus previous and next slide. */
export function Transport(p: TransportProps) {
  return (
    <div className="tt-transport" role="group" aria-label="Playback">
      <button type="button" className="btn btn-ghost btn-icon tt-tbtn" onMouseDown={keepFocus} onClick={p.onPrevSlide} disabled={!p.canPrevSlide} aria-label="Previous slide" title="Previous slide (Shift + ←)">
        <SkipBack size={18} />
      </button>
      <button type="button" className="btn btn-ghost btn-icon tt-tbtn" onMouseDown={keepFocus} onClick={p.onPrev} disabled={!p.canPrev} aria-label="Previous part" title="Previous part (←)">
        <ChevronLeft size={22} />
      </button>
      <motion.button
        type="button"
        className="tt-play"
        onClick={p.onToggle}
        aria-label={p.playLabel}
        title={`${p.playLabel} (Space)`}
        whileTap={{ scale: 0.92 }}
        transition={bouncy}
      >
        <motion.span key={p.playing ? 'pause' : 'play'} initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={bouncy} className="tt-play-icon">
          {p.playing ? <Pause size={26} fill="currentColor" /> : <Play size={26} fill="currentColor" />}
        </motion.span>
      </motion.button>
      <button type="button" className="btn btn-ghost btn-icon tt-tbtn" onMouseDown={keepFocus} onClick={p.onNext} disabled={!p.canNext} aria-label="Next part" title="Next part (→)">
        <ChevronRight size={22} />
      </button>
      <button type="button" className="btn btn-ghost btn-icon tt-tbtn" onMouseDown={keepFocus} onClick={p.onNextSlide} disabled={!p.canNextSlide} aria-label="Next slide" title="Next slide (Shift + →)">
        <SkipForward size={18} />
      </button>
    </div>
  )
}
