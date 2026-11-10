import { useMemo, useRef, useState, type MouseEvent as ReactMouseEvent } from 'react'
import { AnimatePresence, LayoutGroup, motion, useAnimate } from 'framer-motion'
import { Check, CircleCheck, CircleX, Hand, RotateCcw, Shuffle, Sparkles, X } from 'lucide-react'
import type { SortTool as SortData } from '../../../data'
import { easeOut, pop, spring } from '../../../lib/motion'
import { shuffle } from '../../../lib/text'
import { celebrate } from '../../flashcards/confetti'
import { useHotkeys } from '../../quiz/useHotkeys'
import { Rich, pct, plainText, useMedia } from '../util'
import './sort.css'

/*
 * Sort the items into their buckets: tap an item, then a bucket (or drag it there with a mouse).
 * The first try is what counts; a wrong item still lands in its right bucket, marked, with the reason.
 */

interface Placement {
  /** Bucket the student chose first. */
  chose: string
  ok: boolean
}

interface Feedback {
  item: number
  ok: boolean
  chose: string
}

function clientPoint(e: MouseEvent | TouchEvent | PointerEvent): { x: number; y: number } | null {
  if ('changedTouches' in e && e.changedTouches.length) return { x: e.changedTouches[0].clientX, y: e.changedTouches[0].clientY }
  if ('clientX' in e) return { x: e.clientX, y: e.clientY }
  return null
}

function bucketAt(x: number, y: number): string | null {
  for (const el of document.elementsFromPoint(x, y)) {
    const b = (el as HTMLElement).closest?.('[data-lab-bucket]')
    if (b) return b.getAttribute('data-lab-bucket')
  }
  return null
}

export default function SortTool({ tool }: { tool: SortData }) {
  const buckets = useMemo(() => (tool.buckets ?? []).filter((b) => b && b.id), [tool])
  const items = useMemo(() => {
    const ids = new Set(buckets.map((b) => b.id))
    return (tool.items ?? []).filter((i) => i && ids.has(i.bucket))
  }, [tool, buckets])
  const bucketById = useMemo(() => new Map(buckets.map((b) => [b.id, b])), [buckets])

  const [pool, setPool] = useState<number[]>(() => shuffle(items.map((_, i) => i)))
  const [placed, setPlaced] = useState<Record<number, Placement>>({})
  const [selected, setSelected] = useState<number | null>(null)
  const [feedback, setFeedback] = useState<Feedback | null>(null)
  const [dragOver, setDragOver] = useState<string | null>(null)
  const [dragging, setDragging] = useState<number | null>(null)
  const canDrag = useMedia('(pointer: fine)')
  const rootRef = useRef<HTMLDivElement>(null)
  const [bucketsRef, animate] = useAnimate<HTMLDivElement>()
  // A drag ends with a click on the same button; this swallows it.
  const justDragged = useRef(false)
  const uid = tool.id

  const total = items.length
  const done = Object.keys(placed).length
  const right = Object.values(placed).filter((p) => p.ok).length
  const finished = total > 0 && done === total

  useHotkeys((e) => {
    if (e.key === 'Escape' && selected !== null) {
      setSelected(null)
      return
    }
    const n = Number(e.key)
    if (selected !== null && Number.isInteger(n) && n >= 1 && n <= buckets.length) {
      e.preventDefault()
      place(selected, buckets[n - 1].id)
    }
  })

  if (!buckets.length || !items.length) {
    return <p className="lab-empty">This sorting game has no items yet.</p>
  }

  const focusPoolItem = (index: number) => {
    window.setTimeout(() => {
      const root = rootRef.current
      const active = document.activeElement
      // Only steer focus when it is already in the tool (or was dropped with an unmounted button).
      if (!root || (active && active !== document.body && !root.contains(active))) return
      const btns = root.querySelectorAll<HTMLButtonElement>('.lab-sort__item')
      if (btns.length) btns[Math.min(index, btns.length - 1)].focus({ preventScroll: true })
      // The last item: the summary appears once the pool has faded out.
      else window.setTimeout(() => root.querySelector<HTMLButtonElement>('.lab-sort__again')?.focus({ preventScroll: true }), 380)
    }, 60)
  }

  const place = (item: number, bucket: string) => {
    if (placed[item] || !bucketById.has(bucket)) return
    const ok = items[item].bucket === bucket
    const at = pool.indexOf(item)
    const nextPlaced = { ...placed, [item]: { chose: bucket, ok } }
    setPlaced(nextPlaced)
    setPool((p) => p.filter((i) => i !== item))
    setSelected(null)
    setFeedback({ item, ok, chose: bucket })
    const scope = bucketsRef.current
    if (!ok && scope) {
      const el = Array.from(scope.querySelectorAll<HTMLElement>('[data-lab-bucket]')).find((b) => b.dataset.labBucket === bucket)
      if (el) void animate(el, { x: [0, -7, 7, -4, 4, 0] }, { duration: 0.4 })
    }
    const values = Object.values(nextPlaced)
    if (values.length === total && values.every((v) => v.ok)) celebrate(1)
    focusPoolItem(Math.max(0, at))
  }

  const reset = () => {
    setPool(shuffle(items.map((_, i) => i)))
    setPlaced({})
    setSelected(null)
    setFeedback(null)
  }

  const onBucketClick = (bucket: string) => {
    if (selected !== null) place(selected, bucket)
  }

  const fbItem = feedback ? items[feedback.item] : null
  const fbRight = fbItem ? bucketById.get(fbItem.bucket) : undefined
  const fbChose = feedback ? bucketById.get(feedback.chose) : undefined

  return (
    <div className="lab-sort" ref={rootRef}>
      <div className="lab-bar">
        <div className="lab-score">
          <span>
            {done} of {total} sorted
          </span>
          <span className="bar lab-score__bar" aria-hidden="true">
            <span style={{ width: `${pct(done, total)}%` }} />
          </span>
          <span className="lab-score__ok" title="Right first time">
            <Check size={14} aria-hidden="true" className="lab-inline-icon" /> {right}
            <span className="sr-only"> right first time</span>
          </span>
          <span className="lab-score__bad" title="Wrong first time">
            <X size={14} aria-hidden="true" className="lab-inline-icon" /> {done - right}
            <span className="sr-only"> wrong first time</span>
          </span>
        </div>
        <div className="lab-bar__group">
          <button type="button" className="btn btn-sm" onClick={() => setPool((p) => shuffle(p))} disabled={pool.length < 2}>
            <Shuffle size={15} aria-hidden="true" /> Shuffle
          </button>
          <button type="button" className="btn btn-sm" onClick={reset} disabled={done === 0}>
            <RotateCcw size={15} aria-hidden="true" /> Reset
          </button>
        </div>
      </div>

      {tool.prompt && <p className="lab-sort__prompt">{tool.prompt}</p>}

      <LayoutGroup id={`lab-sort-${uid}`}>
        <AnimatePresence initial={false} mode="wait">
          {!finished ? (
            <motion.div
              key="pool"
              className="lab-sort__pool"
              role="group"
              aria-label="Items to sort"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.25, ease: easeOut }}
            >
              <div className="lab-sort__pool-head">
                <span className="lab-sort__pool-label">
                  <Hand size={14} aria-hidden="true" /> {selected === null ? 'Pick an item' : 'Now pick its group'}
                </span>
                <span className="lab-sort__pool-count">{pool.length} left</span>
              </div>
              <ul className="lab-sort__items">
                {pool.map((i) => (
                  <motion.li key={i} layout="position" transition={spring}>
                    <motion.button
                      type="button"
                      layoutId={`lab-sort-${uid}-${i}`}
                      className={`lab-sort__item${selected === i ? ' is-selected' : ''}${dragging === i ? ' is-dragging' : ''}`}
                      aria-pressed={selected === i}
                      onClick={() => {
                        if (justDragged.current) return
                        setSelected((s) => (s === i ? null : i))
                      }}
                      drag={canDrag}
                      dragSnapToOrigin
                      dragElastic={0.9}
                      dragMomentum={false}
                      whileDrag={{ scale: 1.04, zIndex: 20, boxShadow: 'var(--shadow-lg)' }}
                      onDragStart={() => {
                        setDragging(i)
                        setSelected(i)
                      }}
                      onDrag={(e) => {
                        const p = clientPoint(e)
                        setDragOver(p ? bucketAt(p.x, p.y) : null)
                      }}
                      onDragEnd={(e) => {
                        const p = clientPoint(e)
                        const b = p ? bucketAt(p.x, p.y) : null
                        justDragged.current = true
                        window.setTimeout(() => (justDragged.current = false), 0)
                        setDragging(null)
                        setDragOver(null)
                        if (b) place(i, b)
                      }}
                      transition={spring}
                    >
                      <Rich text={items[i].text} />
                    </motion.button>
                  </motion.li>
                ))}
              </ul>
            </motion.div>
          ) : (
            <motion.div key="done" className="lab-done lab-sort__done" variants={pop} initial="hidden" animate="show" role="status">
              <span className="lab-sort__done-icon" aria-hidden="true">
                {right === total ? <Sparkles size={22} /> : <CircleCheck size={22} />}
              </span>
              <div className="lab-done__text">
                <div className="lab-done__title">{right === total ? 'All sorted, all right first time.' : 'All sorted.'}</div>
                <p className="lab-done__sub">
                  {right} of {total} right first time · <span className="lab-done__pct">{pct(right, total)}%</span>
                  {right < total && ' · the red ones are worth another look.'}
                </p>
              </div>
              <div className="lab-done__actions">
                <button type="button" className="btn btn-unit lab-sort__again" onClick={reset}>
                  <RotateCcw size={16} aria-hidden="true" /> Sort again
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="lab-sort__live" aria-live="polite">
          <AnimatePresence mode="wait" initial={false}>
            {feedback && fbItem && (
              <motion.div
                key={`${feedback.item}-${done}`}
                className={`lab-feedback ${feedback.ok ? 'lab-feedback--ok' : 'lab-feedback--bad'}`}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.22, ease: easeOut }}
              >
                {feedback.ok ? <CircleCheck size={18} aria-hidden="true" /> : <CircleX size={18} aria-hidden="true" />}
                <span>
                  <span className="lab-feedback__title">
                    {feedback.ok ? 'Right: ' : `Not ${fbChose?.label ?? ''}. `}
                    {plainText(fbItem.text)} → {fbRight?.label}
                  </span>
                  {fbItem.why && <Rich text={fbItem.why} className="lab-feedback__why" />}
                </span>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="lab-sort__buckets" ref={bucketsRef}>
          {buckets.map((b, n) => {
            const inside = Object.keys(placed)
              .map(Number)
              .filter((i) => items[i].bucket === b.id)
              .sort((a, c) => a - c)
            const armed = selected !== null
            return (
              <div
                key={b.id}
                data-lab-bucket={b.id}
                className={`lab-sort__bucket${armed ? ' is-armed' : ''}${dragOver === b.id ? ' is-over' : ''}`}
                onClick={(e: ReactMouseEvent<HTMLDivElement>) => {
                  // The header button is the accessible target; the rest of the bucket is a bigger one for pointers.
                  if ((e.target as HTMLElement).closest('button')) return
                  onBucketClick(b.id)
                }}
              >
                <button
                  type="button"
                  className="lab-sort__bucket-head"
                  onClick={() => onBucketClick(b.id)}
                  aria-disabled={!armed || undefined}
                  aria-label={armed ? `Put “${plainText(items[selected].text)}” in ${b.label}` : `${b.label}: pick an item first`}
                >
                  <span className="kbd lab-sort__bucket-key" aria-hidden="true">
                    {n + 1}
                  </span>
                  <span className="lab-sort__bucket-text">
                    <span className="lab-sort__bucket-label">{b.label}</span>
                    {b.hint && <span className="lab-sort__bucket-hint">{b.hint}</span>}
                  </span>
                  <span className="lab-sort__bucket-count">{inside.length}</span>
                </button>
                <ul className="lab-sort__placed">
                  {inside.map((i) => {
                    const p = placed[i]
                    return (
                      <motion.li key={i} layout="position">
                        <motion.button
                          type="button"
                          layoutId={`lab-sort-${uid}-${i}`}
                          className={`lab-sort__chip ${p.ok ? 'is-ok' : 'is-bad'}`}
                          onClick={() => setFeedback({ item: i, ok: p.ok, chose: p.chose })}
                          aria-label={`${plainText(items[i].text)}: ${p.ok ? 'right first time' : `first put in ${bucketById.get(p.chose)?.label ?? ''}`}. Show why.`}
                          transition={spring}
                        >
                          {p.ok ? <Check size={14} aria-hidden="true" /> : <X size={14} aria-hidden="true" />}
                          <Rich text={items[i].text} />
                        </motion.button>
                      </motion.li>
                    )
                  })}
                </ul>
                {inside.length === 0 && <p className="lab-sort__empty">{armed ? 'Tap to put it here' : 'Empty'}</p>}
              </div>
            )
          })}
        </div>
      </LayoutGroup>

      <p className="lab-hint lab-hint--keys">
        Tab to an item and press <span className="kbd">Enter</span>, then <span className="kbd">1</span>–<span className="kbd">{buckets.length}</span> for its group.
        {canDrag && ' Or drag it onto a group.'}
      </p>
    </div>
  )
}
