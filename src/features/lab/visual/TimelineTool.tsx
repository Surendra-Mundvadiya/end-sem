import './visual.css'
import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react'
import { AnimatePresence, motion, Reorder, useDragControls, useInView, useReducedMotion } from 'framer-motion'
import { ArrowDown, ArrowUp, Check, ChevronDown, Eye, GripVertical, ListChecks, RotateCcw, X } from 'lucide-react'
import { unitVars } from '../../../data'
import { softSpring, spring } from '../../../lib/motion'
import { shuffle } from '../../../lib/text'
import { ERAS, EVENTS, GAME_EVENTS, formatWhen, type TimelineEvent } from './timeline'
import { SourceLink } from './ui'

/* History of taxation (Unit I, part 2, s2) plus dated milestones from the slides cited in timeline.ts. */

export default function TimelineTool() {
  const [open, setOpen] = useState<Set<string>>(() => new Set())
  const [revealed, setRevealed] = useState(0)
  const reduce = useReducedMotion()
  const baseId = useId()
  const titleId = `${baseId}-title`

  const rows = useMemo(() => {
    let n = 0
    return ERAS.map((era) => ({ era, events: EVENTS.filter((e) => e.era === era.id).map((e) => ({ e, index: n++ })) }))
  }, [])
  const total = EVENTS.length
  const allOpen = open.size === total

  const toggle = (id: string) =>
    setOpen((s) => {
      const next = new Set(s)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  const jump = (eraId: string) => {
    document.getElementById(`${baseId}-${eraId}`)?.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' })
  }

  return (
    <div className="lv-tool lv-tl" style={unitVars('u1')}>
      <section className="lv-card lv-stack" aria-labelledby={titleId}>
        <div className="lv-spread">
          <div>
            <h3 id={titleId} className="lv-h">
              From the leech and the bee to the tax year
            </h3>
            <p className="lv-lead">Scroll down the line; tap any milestone for the detail in the notes. Then put events in order below.</p>
          </div>
          <button type="button" className="btn btn-sm" onClick={() => setOpen(allOpen ? new Set() : new Set(EVENTS.map((e) => e.id)))}>
            <Eye size={15} aria-hidden="true" /> {allOpen ? 'Close all' : 'Open all'}
          </button>
        </div>
        <div className="lv-wrapchips lv-eras" role="group" aria-label="Jump to an era">
          {ERAS.map((era) => (
            <button key={era.id} type="button" className="chip" data-era={era.id} onClick={() => jump(era.id)}>
              {era.name}
            </button>
          ))}
        </div>
      </section>

      <section className="lv-card" aria-label="Timeline">
        <div className="lv-line-wrap">
          <span className="lv-line__spine" aria-hidden="true">
            <motion.span className="lv-line__fill" initial={{ scaleY: 0 }} animate={{ scaleY: total ? revealed / total : 0 }} transition={softSpring} />
          </span>
          <ol className="lv-line">
            {rows.map(({ era, events }) => (
              <EraBlock key={era.id} id={`${baseId}-${era.id}`} name={era.name} span={era.span} eraId={era.id}>
                {events.map(({ e, index }) => (
                  <EventItem
                    key={e.id}
                    e={e}
                    side={index % 2 ? 'right' : 'left'}
                    open={open.has(e.id)}
                    onToggle={() => toggle(e.id)}
                    onReveal={() => setRevealed((r) => Math.max(r, index + 1))}
                  />
                ))}
              </EraBlock>
            ))}
          </ol>
        </div>
      </section>

      <OrderGame />
    </div>
  )
}

function EraBlock({ id, name, span, eraId, children }: { id: string; name: string; span: string; eraId: string; children: ReactNode }) {
  return (
    <>
      <li id={id} className="lv-era-head" data-era={eraId}>
        <div className="lv-era-head__inner">
          <h4 className="lv-era-head__name">{name}</h4>
          <span className="lv-era-head__span">{span}</span>
        </div>
      </li>
      {children}
    </>
  )
}

function EventItem({ e, side, open, onToggle, onReveal }: { e: TimelineEvent; side: 'left' | 'right'; open: boolean; onToggle: () => void; onReveal: () => void }) {
  const ref = useRef<HTMLLIElement>(null)
  const inView = useInView(ref, { once: true, margin: '0px 0px -12% 0px' })
  const detailId = useId()
  const reveal = useRef(onReveal)
  reveal.current = onReveal
  useEffect(() => {
    if (inView) reveal.current()
  }, [inView])

  return (
    <motion.li
      ref={ref}
      layout="position"
      className={`lv-event${side === 'right' ? ' is-right' : ''}`}
      data-era={e.era}
      initial={{ opacity: 0, x: side === 'right' ? 26 : -26 }}
      animate={inView ? { opacity: 1, x: 0 } : { opacity: 0, x: side === 'right' ? 26 : -26 }}
      transition={softSpring}
    >
      <motion.span
        className="lv-event__dot"
        aria-hidden="true"
        initial={{ scale: 0 }}
        animate={{ scale: inView ? 1 : 0 }}
        transition={{ ...spring, delay: 0.12 }}
      />
      <div className={`lv-event__card${open ? ' is-open' : ''}`}>
        <button type="button" className="lv-event__toggle" aria-expanded={open} aria-controls={detailId} onClick={onToggle}>
          <span className="lv-event__top">
            <span className={`lv-event__year${e.sortKey ? '' : ' is-undated'}`}>{e.marker}</span>
            {e.dateLabel && <span className="lv-event__date">{e.dateLabel}</span>}
          </span>
          <span className="lv-event__title">{e.title}</span>
          <span className="lv-event__summary">{e.summary}</span>
          <span className="lv-event__more">
            {open ? 'Less' : 'More'}
            <motion.span animate={{ rotate: open ? 180 : 0 }} transition={spring} style={{ display: 'inline-flex' }} aria-hidden="true">
              <ChevronDown size={15} />
            </motion.span>
          </span>
        </button>
        <AnimatePresence initial={false}>
          {open && (
            <motion.div
              id={detailId}
              key="detail"
              className="lv-event__detail"
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, transition: { duration: 0.12 } }}
              transition={softSpring}
            >
              <p>{e.detail}</p>
              <SourceLink slideId={e.slideId} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.li>
  )
}

/* ---------- ordering game ---------- */

type RoundKind = 'centuries' | 'act'
const ROUND_SIZE = 6

const byDate = (a: TimelineEvent, b: TimelineEvent) => (a.sortKey ?? '').localeCompare(b.sortKey ?? '')

function isSorted(items: TimelineEvent[]) {
  return items.every((e, i) => i === 0 || byDate(items[i - 1], e) <= 0)
}

function makeRound(kind: RoundKind): TimelineEvent[] {
  const pool = GAME_EVENTS.filter((e) => (kind === 'act' ? e.era === 'act' : e.era !== 'act'))
  const picked: TimelineEvent[] = []
  const seen = new Set<string>()
  for (const e of shuffle(pool)) {
    // Distinct sort keys only, so there is exactly one right order.
    const k = e.sortKey ?? e.id
    if (seen.has(k)) continue
    seen.add(k)
    picked.push(e)
    if (picked.length === ROUND_SIZE) break
  }
  let order = shuffle(picked)
  for (let guard = 0; isSorted(order) && guard < 12; guard++) order = shuffle(picked)
  return order
}

function OrderGame() {
  const [kind, setKind] = useState<RoundKind>('centuries')
  const [items, setItems] = useState<TimelineEvent[]>(() => makeRound('centuries'))
  const [checked, setChecked] = useState(false)
  const [rounds, setRounds] = useState(0)
  const titleId = useId()

  const sorted = useMemo(() => [...items].sort(byDate), [items])
  const rightAt = (i: number) => items[i]?.id === sorted[i]?.id
  const score = items.filter((_, i) => rightAt(i)).length

  const newRound = (k: RoundKind = kind) => {
    setKind(k)
    setItems(makeRound(k))
    setChecked(false)
    setRounds((r) => r + 1)
  }
  const reorder = (next: TimelineEvent[]) => {
    setItems(next)
    setChecked(false)
  }
  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir
    if (j < 0 || j >= items.length) return
    const next = items.slice()
    ;[next[i], next[j]] = [next[j], next[i]]
    reorder(next)
  }

  return (
    <section className="lv-card lv-stack" aria-labelledby={titleId}>
      <div className="lv-spread">
        <div>
          <h3 id={titleId} className="lv-h">
            Put these in order
          </h3>
          <p className="lv-lead">Earliest at the top. Drag the handle, or use the arrow buttons; then check.</p>
        </div>
        <div className="segmented" role="group" aria-label="Round">
          <button type="button" aria-pressed={kind === 'centuries'} onClick={() => newRound('centuries')}>
            Across the centuries
          </button>
          <button type="button" aria-pressed={kind === 'act'} onClick={() => newRound('act')}>
            The 2025 Act
          </button>
        </div>
      </div>

      <Reorder.Group as="ol" axis="y" values={items} onReorder={reorder} className="lv-order" key={rounds}>
        {items.map((e, i) => (
          <OrderRow key={e.id} e={e} index={i} count={items.length} checked={checked} right={rightAt(i)} onMove={move} />
        ))}
      </Reorder.Group>

      <div className="lv-spread">
        <div className="lv-row">
          <button type="button" className="btn btn-unit" onClick={() => setChecked(true)}>
            <ListChecks size={16} aria-hidden="true" /> Check order
          </button>
          <button
            type="button"
            className="btn"
            onClick={() => {
              setItems(sorted)
              setChecked(true)
            }}
          >
            <Eye size={16} aria-hidden="true" /> Show answer
          </button>
          <button type="button" className="btn btn-ghost" onClick={() => newRound()}>
            <RotateCcw size={16} aria-hidden="true" /> New round
          </button>
        </div>
        <p role="status" aria-live="polite" className="lv-muted" style={{ fontSize: '0.95rem' }}>
          {checked ? (score === items.length ? 'All in order. Well done.' : `${score} of ${items.length} in the right place.`) : ''}
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
}: {
  e: TimelineEvent
  index: number
  count: number
  checked: boolean
  right: boolean
  onMove: (i: number, dir: -1 | 1) => void
}) {
  const controls = useDragControls()
  const label = e.gameLabel ?? e.title
  return (
    <Reorder.Item
      as="li"
      value={e}
      dragListener={false}
      dragControls={controls}
      className={`lv-order__item${checked ? (right ? ' is-right' : ' is-wrong') : ''}`}
      data-era={e.era}
      whileDrag={{ scale: 1.02 }}
      transition={spring}
    >
      <span className="lv-grip" onPointerDown={(ev) => controls.start(ev)} aria-hidden="true" title="Drag to reorder">
        <GripVertical size={18} />
      </span>
      <span className="lv-order__text">
        <span>{label}</span>
        <AnimatePresence initial={false}>
          {checked && (
            <motion.span
              key="when"
              className="lv-order__when"
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={softSpring}
            >
              {right ? <Check size={12} strokeWidth={3} aria-hidden="true" /> : <X size={12} strokeWidth={3} aria-hidden="true" />} {formatWhen(e)}
            </motion.span>
          )}
        </AnimatePresence>
      </span>
      <span className="lv-order__btns">
        <button type="button" className="btn btn-icon btn-sm btn-ghost" onClick={() => onMove(index, -1)} disabled={index === 0} aria-label={`Move up: ${label}`}>
          <ArrowUp size={16} aria-hidden="true" />
        </button>
        <button type="button" className="btn btn-icon btn-sm btn-ghost" onClick={() => onMove(index, 1)} disabled={index === count - 1} aria-label={`Move down: ${label}`}>
          <ArrowDown size={16} aria-hidden="true" />
        </button>
      </span>
    </Reorder.Item>
  )
}
