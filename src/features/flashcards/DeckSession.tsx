import { AnimatePresence, motion } from 'framer-motion'
import { Check, Info, RotateCcw, RotateCw, Undo2 } from 'lucide-react'
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type MouseEvent, type ReactNode } from 'react'
import type { Card } from '../../data'
import { easeOut, spring } from '../../lib/motion'
import { getProgress, reviewCard, updateProgress, useProgress, type CardState } from '../../lib/progress'
import { shuffle } from '../../lib/text'
import { celebrate } from './confetti'
import { boxInterval, buildQueue, cardById, formatInterval, htmlToText, releaseMouseFocus, type Mode, type SessionSize } from './deck'
import SessionSummary from './SessionSummary'
import StackCard from './StackCard'

interface HistoryEntry {
  id: string
  /** Card state before the grade (undefined = never reviewed), restored by undo. */
  prev: CardState | undefined
  knewIt: boolean
}

interface SessionState {
  /** Snapshot taken when the session starts; grading never reshuffles it. */
  ids: string[]
  pos: number
  results: Record<string, boolean>
  history: HistoryEntry[]
  flipped: boolean
  /** Where the card leaving the stack goes: 1 right (knew it), -1 left (again), 0 sinks back (undo). */
  exitDir: -1 | 0 | 1
  enterFrom: { id: string; dir: -1 | 1 } | null
}

interface Toast {
  n: number
  tone: 'ok' | 'bad' | 'neutral'
  text: string
}

export interface DeckSessionProps {
  deck: readonly Card[]
  mode: Mode
  size: SessionSize
  /** When set, the session reviews exactly these cards (the "review the ones I missed" round). */
  customIds: readonly string[] | null
  label: string
  quizHref: string
  dueNow: number
  /** Shown instead of the stack when the session has no cards. */
  empty: ReactNode
  onStudyAgain: () => void
  onReviewMissed: (ids: string[]) => void
}

function startSession(deck: readonly Card[], mode: Mode, size: SessionSize, customIds: readonly string[] | null): SessionState {
  const ids = customIds
    ? shuffle(customIds.filter((id) => cardById.has(id)))
    : buildQueue(deck, getProgress().cards, mode, size, Date.now())
  return { ids, pos: 0, results: {}, history: [], flipped: false, exitDir: 1, enterFrom: null }
}

const isKeyboardClick = (e: MouseEvent) => e.detail === 0

export default function DeckSession({ deck, mode, size, customIds, label, quizHref, dueNow, empty, onStudyAgain, onReviewMissed }: DeckSessionProps) {
  const progress = useProgress()
  const [s, setS] = useState(() => startSession(deck, mode, size, customIds))
  const ref = useRef(s)
  const [toast, setToast] = useState<Toast | null>(null)
  const [announce, setAnnounce] = useState('')
  /** Set by keyboard actions: after the next render, focus the top card so Space keeps flipping and 1/2 keep grading. */
  const focusCard = useRef(false)
  const stackRef = useRef<HTMLDivElement>(null)
  const toastSeq = useRef(0)

  // Handlers read and write the ref synchronously, so two fast key presses can't grade the same card twice.
  const commit = useCallback((next: SessionState) => {
    ref.current = next
    setS(next)
  }, [])
  useLayoutEffect(() => {
    ref.current = s
  }, [s])

  const flip = useCallback(() => {
    const cur = ref.current
    if (cur.pos >= cur.ids.length) return
    const next = { ...cur, flipped: !cur.flipped }
    commit(next)
    const card = cardById.get(cur.ids[cur.pos])
    setAnnounce(next.flipped && card ? `Answer: ${htmlToText(card.back)}` : 'Question side.')
  }, [commit])

  const grade = useCallback(
    (knewIt: boolean) => {
      const cur = ref.current
      if (!cur.flipped || cur.pos >= cur.ids.length) return
      const id = cur.ids[cur.pos]
      const prev = getProgress().cards[id]
      // The graded card is about to leave (and go inert); keep focus in the deck if it was there.
      if (stackRef.current?.contains(document.activeElement)) focusCard.current = true
      reviewCard(id, knewIt)
      const box = getProgress().cards[id]?.box ?? 1
      const pos = cur.pos + 1
      const results = { ...cur.results, [id]: knewIt }
      commit({
        ...cur,
        pos,
        results,
        history: [...cur.history, { id, prev, knewIt }],
        flipped: false,
        exitDir: knewIt ? 1 : -1,
        enterFrom: null,
      })

      const wait = boxInterval(box)
      const where = !knewIt ? 'Back to box 1' : box > (prev?.box ?? 0) ? `Up to box ${box}` : `Stays in box ${box}`
      setToast({
        n: ++toastSeq.current,
        tone: knewIt ? 'ok' : 'bad',
        text: `${where} · ${wait > 0 ? `next review in ${formatInterval(wait)}` : 'due again right away'}`,
      })

      if (pos >= cur.ids.length) {
        const knew = Object.values(results).filter(Boolean).length
        setAnnounce(`Session complete. You knew ${knew} of ${cur.ids.length}.`)
        focusCard.current = false // the summary takes focus instead
        celebrate(knew / cur.ids.length)
      } else {
        setAnnounce(`${knewIt ? 'Knew it' : 'Again'}. Card ${pos + 1} of ${cur.ids.length}.`)
      }
    },
    [commit],
  )

  const undo = useCallback(() => {
    const cur = ref.current
    const last = cur.history[cur.history.length - 1]
    if (!last) return
    updateProgress((p) => {
      const cards = { ...p.cards }
      if (last.prev) cards[last.id] = last.prev
      else delete cards[last.id]
      return { ...p, cards }
    })
    const results = { ...cur.results }
    delete results[last.id]
    if (stackRef.current?.contains(document.activeElement)) focusCard.current = true
    commit({
      ...cur,
      pos: cur.pos - 1,
      results,
      history: cur.history.slice(0, -1),
      flipped: true,
      exitDir: 0,
      enterFrom: { id: last.id, dir: last.knewIt ? 1 : -1 },
    })
    setToast({ n: ++toastSeq.current, tone: 'neutral', text: 'Grade undone. Grade the card again.' })
    setAnnounce('Last grade undone. Showing the answer again.')
  }, [commit])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.repeat || e.ctrlKey || e.metaKey || e.altKey) return
      if (document.body.dataset.modal === 'open') return
      const t = e.target instanceof HTMLElement ? e.target : null
      if (t && (t.isContentEditable || t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT')) return
      const cur = ref.current
      const active = cur.pos < cur.ids.length
      if (e.key === ' ' || e.key === 'Enter') {
        // A focused button or link handles Space/Enter itself; flipping as well would double the action.
        if (!active || (t && t.closest('button, a, [role="button"], summary'))) return
        e.preventDefault()
        flip()
      } else if (e.key === '1' || e.key === '2') {
        if (!active || !cur.flipped) return
        e.preventDefault()
        grade(e.key === '2')
      } else if (e.key === 'u' || e.key === 'U') {
        if (!cur.history.length) return
        e.preventDefault()
        undo()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [flip, grade, undo])

  useEffect(() => {
    if (!toast) return
    const id = window.setTimeout(() => setToast(null), 2800)
    return () => window.clearTimeout(id)
  }, [toast])

  // After a keyboard action, focus the (new) top card rather than a grade button, so a following Space flips
  // the card instead of pressing "Knew it" and recording a grade.
  useEffect(() => {
    if (!focusCard.current) return
    focusCard.current = false
    stackRef.current?.querySelector<HTMLElement>('.fc-card[data-top]:not([data-leaving])')?.focus({ preventScroll: true })
  }, [s])

  const total = s.ids.length
  if (total === 0) return <div className="fc-deck">{empty}</div>

  const done = s.pos >= total
  const visible = s.ids
    .slice(s.pos, s.pos + 3)
    .map((id) => cardById.get(id))
    .filter((c): c is Card => c !== undefined)
  const knew = Object.values(s.results).filter(Boolean).length
  const again = Object.keys(s.results).length - knew
  const missed = s.ids.filter((id) => s.results[id] === false)
  const counter = Math.min(s.pos + 1, total)

  return (
    <div className="fc-deck">
      <div className="fc-sessionbar">
        <span className="fc-tag">{label}</span>
        <span className="fc-counter">
          <strong>{done ? total : counter}</strong> / {total}
        </span>
        <div
          className="fc-progress"
          role="progressbar"
          aria-label="Cards graded this session"
          aria-valuemin={0}
          aria-valuemax={total}
          aria-valuenow={s.pos}
        >
          <span className="fc-progress__ok" style={{ transform: `scaleX(${knew / total})` }} />
          <span className="fc-progress__bad" style={{ transform: `translateX(${(knew / total) * 100}%) scaleX(${again / total})` }} />
        </div>
        <button
          type="button"
          className="btn btn-ghost btn-sm fc-undo"
          onClick={(e) => {
            releaseMouseFocus(e)
            undo()
          }}
          disabled={s.history.length === 0}
          aria-label="Undo last grade"
          title="Undo last grade (U)"
        >
          <Undo2 size={15} aria-hidden />
          <span className="fc-undo__text">Undo</span>
          <span className="kbd" aria-hidden>
            U
          </span>
        </button>
      </div>

      <div className="fc-stage">
        <div className="fc-stack" ref={stackRef}>
          <AnimatePresence custom={s.exitDir}>
            {visible.map((card, depth) => (
              <StackCard
                key={card.id}
                card={card}
                depth={depth}
                flipped={depth === 0 && s.flipped}
                box={progress.cards[card.id]?.box ?? 0}
                index={s.pos + depth + 1}
                total={total}
                enterFrom={s.enterFrom?.id === card.id ? s.enterFrom.dir : 0}
                dealDelay={s.history.length === 0 ? depth * 0.07 : 0}
                onFlip={flip}
                onSwipe={grade}
              />
            ))}
          </AnimatePresence>
        </div>
        <AnimatePresence>
          {done && (
            <SessionSummary
              key="summary"
              total={total}
              knew={knew}
              again={again}
              missed={missed.map((id) => cardById.get(id)).filter((c): c is Card => c !== undefined)}
              mode={mode}
              dueNow={dueNow}
              quizHref={quizHref}
              onStudyAgain={onStudyAgain}
              onReviewMissed={() => onReviewMissed(missed)}
            />
          )}
        </AnimatePresence>
      </div>

      {!done && (
        <>
          <div className="fc-actions">
            <AnimatePresence mode="popLayout" initial={false}>
              {s.flipped ? (
                <motion.div
                  key="grade"
                  className="fc-actions__grade"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={spring}
                >
                  <button
                    type="button"
                    className="btn btn-lg fc-again"
                    onClick={(e) => {
                      if (isKeyboardClick(e)) focusCard.current = true
                      grade(false)
                    }}
                  >
                    <RotateCcw size={18} strokeWidth={2.4} aria-hidden />
                    Again
                    <span className="kbd" aria-hidden>
                      1
                    </span>
                  </button>
                  <button
                    type="button"
                    className="btn btn-lg fc-knew"
                    onClick={(e) => {
                      if (isKeyboardClick(e)) focusCard.current = true
                      grade(true)
                    }}
                  >
                    <Check size={18} strokeWidth={2.6} aria-hidden />
                    Knew it
                    <span className="kbd" aria-hidden>
                      2
                    </span>
                  </button>
                </motion.div>
              ) : (
                <motion.div
                  key="reveal"
                  className="fc-actions__reveal"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={spring}
                >
                  <button
                    type="button"
                    className="btn btn-primary btn-lg fc-reveal"
                    onClick={(e) => {
                      if (isKeyboardClick(e)) focusCard.current = true
                      flip()
                    }}
                  >
                    <RotateCw size={18} strokeWidth={2.4} aria-hidden />
                    Show answer
                    <span className="kbd" aria-hidden>
                      Space
                    </span>
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <div className="fc-foot">
            <AnimatePresence mode="wait" initial={false}>
              {toast ? (
                <motion.p
                  key={toast.n}
                  className="fc-toast"
                  data-tone={toast.tone}
                  initial={{ opacity: 0, y: 8, scale: 0.96 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.22, ease: easeOut }}
                >
                  {toast.tone === 'ok' ? (
                    <Check size={15} strokeWidth={2.8} aria-hidden />
                  ) : toast.tone === 'bad' ? (
                    <RotateCcw size={15} strokeWidth={2.6} aria-hidden />
                  ) : (
                    <Info size={15} aria-hidden />
                  )}
                  {toast.text}
                </motion.p>
              ) : (
                <motion.div
                  key="hints"
                  className="fc-hints"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.2 }}
                >
                  <span className="fc-hints__keys">
                    <span className="fc-hint">
                      <span className="kbd">Space</span> flip
                    </span>
                    <span className="fc-hint">
                      <span className="kbd">1</span> again
                    </span>
                    <span className="fc-hint">
                      <span className="kbd">2</span> knew it
                    </span>
                    <span className="fc-hint">
                      <span className="kbd">U</span> undo
                    </span>
                  </span>
                  <span className="fc-hints__touch">Tap the card to flip it, then swipe right if you knew it or left to go again.</span>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </>
      )}

      <p className="sr-only" aria-live="polite">
        {announce}
      </p>
    </div>
  )
}
