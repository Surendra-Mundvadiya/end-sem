import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion, Reorder, useDragControls, useInView, useReducedMotion } from 'framer-motion'
import { ArrowDown, ArrowUp, Check, ChevronDown, Eye, GripVertical, ListChecks, RotateCcw, Trophy, X } from 'lucide-react'
import { unitVars, type TimelineTool as TimelineToolData } from '../../../data'
import { softSpring, spring } from '../../../lib/motion'
import { shuffle } from '../../../lib/text'
import './TimelineTool.css'

/*
 * A timeline built from the dated events in the notes: a vertical line that reveals itself as you
 * scroll, tap-to-expand detail, and a "put these in order" round with the dates hidden.
 */

interface TlEvent {
  id: string
  date: string
  sort: number
  title: string
  detail?: string
}

/** Keyed on the tool, so moving to another timeline starts fresh. */
export default function TimelineTool({ tool }: { tool: TimelineToolData }) {
  return <Timeline key={tool.id} tool={tool} />
}

function Timeline({ tool }: { tool: TimelineToolData }) {
  const events = useMemo<TlEvent[]>(
    () =>
      (tool.events ?? [])
        .map((e, i) => ({ ...e, id: `e${i}`, i, sort: Number.isFinite(e.sort) ? e.sort : 0 }))
        .sort((a, b) => a.sort - b.sort || a.i - b.i)
        .map(({ i: _i, ...e }) => e),
    [tool.events],
  )
  const [open, setOpen] = useState<Set<string>>(() => new Set())
  const [revealed, setRevealed] = useState(0)
  const withDetail = events.filter((e) => e.detail)
  const allOpen = withDetail.length > 0 && withDetail.every((e) => open.has(e.id))
  const style = tool.unitId ? unitVars(tool.unitId) : undefined

  const toggle = (id: string) =>
    setOpen((s) => {
      const next = new Set(s)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  if (!events.length) {
    return (
      <div className="tml" style={style}>
        <p className="tml-card tml-empty">No dated events for this topic yet.</p>
      </div>
    )
  }

  return (
    <div className="tml" style={style}>
      <section className="tml-card" aria-label="Timeline">
        <div className="tml-spread">
          <p className="tml-lead">
            {events.length} {events.length === 1 ? 'milestone' : 'milestones'}, earliest first.
            {withDetail.length > 0 && ' Tap one for the detail in the notes.'}
          </p>
          {withDetail.length > 0 && (
            <button type="button" className="btn btn-sm" onClick={() => setOpen(allOpen ? new Set() : new Set(withDetail.map((e) => e.id)))}>
              <Eye size={15} aria-hidden="true" /> {allOpen ? 'Close all' : 'Open all'}
            </button>
          )}
        </div>
        <div className="tml-wrap">
          <span className="tml-spine" aria-hidden="true">
            <motion.span className="tml-spine__fill" initial={{ scaleY: 0 }} animate={{ scaleY: revealed / events.length }} transition={softSpring} />
          </span>
          <ol className="tml-line">
            {events.map((e, index) => (
              <EventItem
                key={e.id}
                e={e}
                side={index % 2 ? 'right' : 'left'}
                open={open.has(e.id)}
                onToggle={() => toggle(e.id)}
                onReveal={() => setRevealed((r) => Math.max(r, index + 1))}
              />
            ))}
          </ol>
        </div>
      </section>

      {distinctSorts(events) >= 2 && <OrderGame events={events} />}
    </div>
  )
}

function EventItem({ e, side, open, onToggle, onReveal }: { e: TlEvent; side: 'left' | 'right'; open: boolean; onToggle: () => void; onReveal: () => void }) {
  const ref = useRef<HTMLLIElement>(null)
  const inView = useInView(ref, { once: true, margin: '0px 0px -10% 0px' })
  const reduce = useReducedMotion()
  const shown = inView || !!reduce
  const detailId = useId()
  const reveal = useRef(onReveal)
  reveal.current = onReveal
  useEffect(() => {
    if (shown) reveal.current()
  }, [shown])

  const offset = side === 'right' ? 24 : -24
  const head = (
    <>
      <span className="tml-event__date">{e.date}</span>
      <span className="tml-event__title">{e.title}</span>
    </>
  )

  return (
    <motion.li
      ref={ref}
      className={`tml-event${side === 'right' ? ' is-right' : ''}`}
      initial={{ opacity: 0, x: offset }}
      animate={shown ? { opacity: 1, x: 0 } : { opacity: 0, x: offset }}
      transition={softSpring}
    >
      <motion.span className="tml-event__dot" aria-hidden="true" initial={{ scale: 0 }} animate={{ scale: shown ? 1 : 0 }} transition={{ ...spring, delay: 0.1 }} />
      <div className={`tml-event__card${open ? ' is-open' : ''}`}>
        {e.detail ? (
          <>
            <button type="button" className="tml-event__toggle" aria-expanded={open} aria-controls={detailId} onClick={onToggle}>
              {head}
              <span className="tml-event__more">
                {open ? 'Less' : 'More'}
                <motion.span animate={{ rotate: open ? 180 : 0 }} transition={spring} className="tml-event__chev" aria-hidden="true">
                  <ChevronDown size={15} />
                </motion.span>
              </span>
            </button>
            <AnimatePresence initial={false}>
              {open && (
                <motion.div
                  id={detailId}
                  key="detail"
                  className="tml-event__detail"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0, transition: { duration: 0.16 } }}
                  transition={softSpring}
                >
                  <p>{e.detail}</p>
                </motion.div>
              )}
            </AnimatePresence>
          </>
        ) : (
          <div className="tml-event__static">{head}</div>
        )}
      </div>
    </motion.li>
  )
}

/* ---------- "Put these in order" ---------- */

const ROUND_SIZE = 6

function distinctSorts(events: TlEvent[]): number {
  return new Set(events.map((e) => e.sort)).size
}

function isSorted(items: TlEvent[]): boolean {
  return items.every((e, i) => i === 0 || items[i - 1].sort <= e.sort)
}

/** Up to six events with different dates, shuffled so they are not already in order. */
function makeRound(events: TlEvent[]): TlEvent[] {
  const picked: TlEvent[] = []
  const seen = new Set<number>()
  for (const e of shuffle(events)) {
    if (seen.has(e.sort)) continue
    seen.add(e.sort)
    picked.push(e)
    if (picked.length === ROUND_SIZE) break
  }
  let order = shuffle(picked)
  for (let guard = 0; isSorted(order) && guard < 20; guard++) order = shuffle(picked)
  // Two items can only be out of order one way.
  if (isSorted(order)) order = [...picked].sort((a, b) => b.sort - a.sort)
  return order
}

function OrderGame({ events }: { events: TlEvent[] }) {
  const [items, setItems] = useState<TlEvent[]>(() => makeRound(events))
  const [checked, setChecked] = useState(false)
  const [round, setRound] = useState(0)
  const [best, setBest] = useState<number | null>(null)
  const titleId = useId()
  const buttons = useRef(new Map<string, HTMLButtonElement>())
  const refocus = useRef<{ id: string; dir: 'up' | 'down' } | null>(null)

  const sortedSorts = useMemo(() => items.map((e) => e.sort).sort((a, b) => a - b), [items])
  // Tied dates are interchangeable: a slot is right when it holds an event from the right date.
  const rightAt = (i: number) => items[i]?.sort === sortedSorts[i]
  const score = items.filter((_, i) => rightAt(i)).length
  const perfect = score === items.length

  useEffect(() => {
    const target = refocus.current
    if (!target) return
    refocus.current = null
    const i = items.findIndex((e) => e.id === target.id)
    const atEdge = target.dir === 'up' ? i === 0 : i === items.length - 1
    const dir = atEdge ? (target.dir === 'up' ? 'down' : 'up') : target.dir
    buttons.current.get(`${target.id}:${dir}`)?.focus()
  }, [items])

  const newRound = () => {
    setItems(makeRound(events))
    setChecked(false)
    setRound((r) => r + 1)
  }
  const reorder = (next: TlEvent[]) => {
    setItems(next)
    setChecked(false)
  }
  const move = (i: number, dir: 'up' | 'down') => {
    const j = dir === 'up' ? i - 1 : i + 1
    if (j < 0 || j >= items.length) return
    const next = items.slice()
    ;[next[i], next[j]] = [next[j], next[i]]
    // Moving a row re-inserts its DOM node, which drops focus: put it back on the same control.
    refocus.current = { id: items[i].id, dir }
    reorder(next)
  }
  const check = () => {
    setChecked(true)
    setBest((b) => (b === null ? score : Math.max(b, score)))
  }

  return (
    <section className="tml-card tml-game" aria-labelledby={titleId}>
      <div className="tml-spread">
        <div className="tml-game__head">
          <h3 id={titleId} className="tml-h">
            Put these in order
          </h3>
          <p className="tml-lead">Earliest at the top. The dates are hidden: drag the handle or use the arrows, then check.</p>
        </div>
        {best !== null && (
          <p className="tml-best">
            <Trophy size={15} aria-hidden="true" /> Best: {best}/{items.length}
          </p>
        )}
      </div>

      <Reorder.Group as="ol" axis="y" values={items} onReorder={reorder} className="tml-order" key={round}>
        {items.map((e, i) => (
          <OrderRow
            key={e.id}
            e={e}
            index={i}
            count={items.length}
            checked={checked}
            right={rightAt(i)}
            onMove={move}
            registerButton={(dir, el) => {
              const k = `${e.id}:${dir}`
              if (el) buttons.current.set(k, el)
              else buttons.current.delete(k)
            }}
          />
        ))}
      </Reorder.Group>

      <div className="tml-spread">
        <div className="tml-row">
          <button type="button" className="btn btn-unit" onClick={check}>
            <ListChecks size={16} aria-hidden="true" /> Check order
          </button>
          <button
            type="button"
            className="btn"
            onClick={() => {
              setItems([...items].sort((a, b) => a.sort - b.sort))
              setChecked(true)
            }}
          >
            <Eye size={16} aria-hidden="true" /> Show answer
          </button>
          <button type="button" className="btn btn-ghost" onClick={newRound}>
            <RotateCcw size={16} aria-hidden="true" /> New round
          </button>
        </div>
        <p role="status" aria-live="polite" className={`tml-score${checked ? (perfect ? ' is-perfect' : ' is-partial') : ''}`}>
          {checked ? (perfect ? `All ${items.length} in order. Well done.` : `${score} of ${items.length} in the right place.`) : ''}
        </p>
      </div>
    </section>
  )
}

function OrderRow({
  e,
  index,
  count,
  checked,
  right,
  onMove,
  registerButton,
}: {
  e: TlEvent
  index: number
  count: number
  checked: boolean
  right: boolean
  onMove: (i: number, dir: 'up' | 'down') => void
  registerButton: (dir: 'up' | 'down', el: HTMLButtonElement | null) => void
}) {
  const controls = useDragControls()
  return (
    <Reorder.Item
      as="li"
      value={e}
      dragListener={false}
      dragControls={controls}
      className={`tml-order__item${checked ? (right ? ' is-right' : ' is-wrong') : ''}`}
      whileDrag={{ scale: 1.02 }}
      transition={spring}
    >
      <span className="tml-grip" onPointerDown={(ev) => controls.start(ev)} aria-hidden="true" title="Drag to reorder">
        <GripVertical size={18} />
      </span>
      <span className="tml-order__pos" aria-hidden="true">
        {index + 1}
      </span>
      <span className="tml-order__text">
        <span>{e.title}</span>
        <AnimatePresence initial={false}>
          {checked && (
            <motion.span
              key="when"
              className="tml-order__when"
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={softSpring}
            >
              {right ? <Check size={12} strokeWidth={3} aria-hidden="true" /> : <X size={12} strokeWidth={3} aria-hidden="true" />}
              <span className="sr-only">{right ? 'Right place. ' : 'Wrong place. '}</span>
              {e.date}
            </motion.span>
          )}
        </AnimatePresence>
      </span>
      <span className="tml-order__btns">
        <button
          ref={(el) => registerButton('up', el)}
          type="button"
          className="btn btn-icon btn-sm btn-ghost"
          onClick={() => onMove(index, 'up')}
          disabled={index === 0}
          aria-label={`Move up: ${e.title}`}
        >
          <ArrowUp size={16} aria-hidden="true" />
        </button>
        <button
          ref={(el) => registerButton('down', el)}
          type="button"
          className="btn btn-icon btn-sm btn-ghost"
          onClick={() => onMove(index, 'down')}
          disabled={index === count - 1}
          aria-label={`Move down: ${e.title}`}
        >
          <ArrowDown size={16} aria-hidden="true" />
        </button>
      </span>
    </Reorder.Item>
  )
}
