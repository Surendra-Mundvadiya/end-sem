import { useEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react'
import { AnimatePresence, Reorder, motion, useDragControls } from 'framer-motion'
import { ArrowDown, ArrowRight, ArrowUp, Check, CircleCheck, Eye, GripVertical, Layers, ListOrdered, RotateCcw, Shuffle, Sparkles, X } from 'lucide-react'
import { useSearchParams } from 'react-router-dom'
import { PARTS, SUBJECT, UNITS, getUnit, isUnitId, unitVars, type Part, type UnitId } from '../../../data'
import { easeOut, pop } from '../../../lib/motion'
import { plural, shuffle } from '../../../lib/text'
import { celebrate } from '../../flashcards/confetti'
import { MIN_ORDER_ITEMS } from '../registry'
import { isAsidePart, pct, splitNumber } from '../util'
import './topic-order.css'

/*
 * Order recall built from the notes' own structure: the units, the topics of a unit, or the sub-topics (slide
 * titles) of a topic. Numbering is stripped so the order has to come from memory, and practice / answer-plan
 * topics are left out (they always come last).
 */

type Mode = 'units' | 'topics' | 'subtopics'
type Phase = 'play' | 'checked' | 'revealed'

interface Item {
  id: string
  text: string
  /** Shown once checked: the unit's short name or the section number. */
  tag?: string
  unitId: UnitId
}

const MIN_ITEMS = MIN_ORDER_ITEMS
const BEST_KEY = `studykit:${SUBJECT.id}:lab-order:v1`

const unitItems = (): Item[] => UNITS.map((u) => ({ id: u.id, text: u.name, tag: u.short, unitId: u.id }))

const topicParts = (unitId: UnitId): Part[] => PARTS.filter((p) => p.unitId === unitId && !isAsidePart(p))

const topicItems = (unitId: UnitId): Item[] =>
  topicParts(unitId).map((p) => {
    const { num, text } = splitNumber(p.title)
    return { id: p.key, text, tag: num ?? undefined, unitId }
  })

const subItems = (p: Part): Item[] =>
  p.slides
    .filter((s) => !s.isPractice)
    .map((s) => {
      const { num, text } = splitNumber(s.title)
      return { id: s.id, text, tag: num ?? undefined, unitId: s.unitId }
    })

const UNITS_OK = UNITS.length >= MIN_ITEMS
const TOPIC_UNITS = UNITS.filter((u) => topicItems(u.id).length >= MIN_ITEMS)
const SUB_PARTS = PARTS.filter((p) => !isAsidePart(p) && subItems(p).length >= MIN_ITEMS)

const norm = (s: string) => s.toLowerCase().replace(/\s+/g, ' ').trim()

/** A shuffle that is never already solved (compared by text, so duplicate titles can't count as a solve). */
function scramble(items: Item[]): string[] {
  const ids = items.map((i) => i.id)
  if (ids.length < 2) return ids
  const text = new Map(items.map((i) => [i.id, norm(i.text)]))
  for (let t = 0; t < 16; t++) {
    const s = shuffle(ids)
    if (s.some((id, i) => text.get(id) !== text.get(ids[i]))) return s
  }
  return ids.slice().reverse()
}

type Best = Record<string, number>

function loadBest(): Best {
  try {
    const v: unknown = JSON.parse(localStorage.getItem(BEST_KEY) || '{}')
    if (v && typeof v === 'object') return v as Best
  } catch {
    /* ignore */
  }
  return {}
}

function saveBest(b: Best) {
  try {
    localStorage.setItem(BEST_KEY, JSON.stringify(b))
  } catch {
    /* storage blocked: best scores just won't persist */
  }
}

function firstMode(param: string | null): Mode {
  const wanted = param === 'units' || param === 'topics' || param === 'subtopics' ? param : null
  const ok: Record<Mode, boolean> = { units: UNITS_OK, topics: TOPIC_UNITS.length > 0, subtopics: SUB_PARTS.length > 0 }
  if (wanted && ok[wanted]) return wanted
  return (['units', 'topics', 'subtopics'] as Mode[]).find((m) => ok[m]) ?? 'units'
}

export default function TopicOrder() {
  const [params, setParams] = useSearchParams()
  const [mode, setModeState] = useState<Mode>(() => firstMode(params.get('mode')))
  const [unitId, setUnitId] = useState<UnitId>(() => {
    const u = params.get('unit')
    return isUnitId(u) && TOPIC_UNITS.some((x) => x.id === u) ? u : (TOPIC_UNITS[0]?.id ?? UNITS[0].id)
  })
  const [partKey, setPartKey] = useState<string>(() => {
    const p = params.get('topic')
    return SUB_PARTS.some((x) => x.key === p) ? p! : (SUB_PARTS[0]?.key ?? '')
  })
  const [best, setBest] = useState<Best>(loadBest)

  const part = SUB_PARTS.find((p) => p.key === partKey)
  const scopeKey = mode === 'units' ? 'units' : mode === 'topics' ? `topics:${unitId}` : `sub:${partKey}`

  const items: Item[] = useMemo(() => {
    if (mode === 'units') return unitItems()
    if (mode === 'topics') return topicItems(unitId)
    return part ? subItems(part) : []
  }, [mode, unitId, part])

  // Keep the URL in step so a refresh (or a shared link) opens the same round.
  useEffect(() => {
    const next = new URLSearchParams()
    next.set('mode', mode)
    if (mode === 'topics') next.set('unit', unitId)
    if (mode === 'subtopics' && partKey) next.set('topic', partKey)
    if (next.toString() !== params.toString()) setParams(next, { replace: true })
  }, [mode, unitId, partKey, params, setParams])

  const setMode = (m: Mode) => setModeState(m)

  const onResult = (score: number, total: number) => {
    const p = pct(score, total)
    setBest((b) => {
      if ((b[scopeKey] ?? -1) >= p) return b
      const next = { ...b, [scopeKey]: p }
      saveBest(next)
      return next
    })
  }

  const nextScope = () => {
    if (mode === 'topics') {
      const i = TOPIC_UNITS.findIndex((u) => u.id === unitId)
      setUnitId(TOPIC_UNITS[(i + 1) % TOPIC_UNITS.length].id)
    } else if (mode === 'subtopics') {
      const i = SUB_PARTS.findIndex((p) => p.key === partKey)
      setPartKey(SUB_PARTS[(i + 1) % SUB_PARTS.length].key)
    }
  }
  const hasNext = (mode === 'topics' && TOPIC_UNITS.length > 1) || (mode === 'subtopics' && SUB_PARTS.length > 1)

  const modes: { id: Mode; label: string; ok: boolean; why: string }[] = [
    { id: 'units', label: 'Units in order', ok: UNITS_OK, why: `Needs at least ${MIN_ITEMS} units.` },
    { id: 'topics', label: 'Topics within a unit', ok: TOPIC_UNITS.length > 0, why: `No unit has ${MIN_ITEMS} or more topics yet.` },
    { id: 'subtopics', label: 'Sub-topics within a topic', ok: SUB_PARTS.length > 0, why: `No topic has ${MIN_ITEMS} or more sub-topics yet.` },
  ]
  const disabled = modes.filter((m) => !m.ok)

  const scopeStyle = mode === 'topics' ? unitVars(unitId) : mode === 'subtopics' && part ? unitVars(part.unitId) : undefined

  return (
    <div className="lab-ord" style={scopeStyle}>
      <div className="lab-bar">
        <div className="segmented lab-seg" role="group" aria-label="What to put in order">
          {modes.map((m) => (
            <button key={m.id} type="button" aria-pressed={mode === m.id} disabled={!m.ok} title={m.ok ? undefined : m.why} onClick={() => setMode(m.id)}>
              {m.label}
            </button>
          ))}
        </div>
      </div>
      {disabled.length > 0 && (
        <p className="lab-ord__note">
          {disabled.map((m) => `${m.label}: ${m.why}`).join(' ')}
        </p>
      )}

      {mode === 'topics' && (
        <div className="lab-ord__picker" role="group" aria-label="Unit">
          {TOPIC_UNITS.map((u) => (
            <button key={u.id} type="button" className="chip lab-ord__unit" style={unitVars(u.id)} aria-pressed={u.id === unitId} onClick={() => setUnitId(u.id)} title={u.name}>
              <span className="lab-ord__unit-dot" aria-hidden="true" />
              {u.short}
              {best[`topics:${u.id}`] === 100 && <Check size={13} aria-label="Perfect before" />}
            </button>
          ))}
        </div>
      )}

      {mode === 'subtopics' && (
        <label className="lab-ord__select">
          <span className="lab-ord__select-label">Topic</span>
          <select className="select" value={partKey} onChange={(e) => setPartKey(e.target.value)}>
            {UNITS.map((u) => {
              const parts = SUB_PARTS.filter((p) => p.unitId === u.id)
              if (!parts.length) return null
              return (
                <optgroup key={u.id} label={`${u.short} · ${u.name}`}>
                  {parts.map((p) => (
                    <option key={p.key} value={p.key}>
                      {best[`sub:${p.key}`] === 100 ? '✓ ' : ''}
                      {p.title}
                    </option>
                  ))}
                </optgroup>
              )
            })}
          </select>
        </label>
      )}

      {items.length >= 2 ? (
        <Round
          key={scopeKey}
          mode={mode}
          items={items}
          heading={
            mode === 'units'
              ? `Put the ${plural(items.length, 'unit')} of ${SUBJECT.title} in order`
              : mode === 'topics'
                ? `Put the ${plural(items.length, 'topic')} of ${getUnit(unitId).short} in order`
                : `Put the ${plural(items.length, 'sub-topic')} of “${part ? splitNumber(part.title).text : ''}” in order`
          }
          sub={mode === 'topics' ? getUnit(unitId).name : mode === 'subtopics' && part ? getUnit(part.unitId).short : undefined}
          best={best[scopeKey]}
          onResult={onResult}
          onNext={hasNext ? nextScope : undefined}
          nextLabel={mode === 'topics' ? 'Next unit' : 'Next topic'}
        />
      ) : (
        <p className="lab-empty">Nothing to put in order here yet.</p>
      )}
    </div>
  )
}

/* ---------- one round ---------- */

interface RoundProps {
  mode: Mode
  items: Item[]
  heading: string
  sub?: string
  best?: number
  onResult: (score: number, total: number) => void
  onNext?: () => void
  nextLabel: string
}

function Round({ mode, items, heading, sub, best, onResult, onNext, nextLabel }: RoundProps) {
  const byId = useMemo(() => new Map(items.map((i) => [i.id, i])), [items])
  const [order, setOrder] = useState<string[]>(() => scramble(items))
  const [phase, setPhase] = useState<Phase>('play')
  /** Position (0-based) each item was in when checked. */
  const [submitted, setSubmitted] = useState<Record<string, number>>({})
  const [verdict, setVerdict] = useState<Record<string, boolean>>({})
  const [announce, setAnnounce] = useState('')
  const btnRefs = useRef(new Map<string, HTMLButtonElement>())
  const revealRef = useRef<HTMLButtonElement>(null)

  const n = items.length
  const score = Object.values(verdict).filter(Boolean).length
  const correctIndex = useMemo(() => new Map(items.map((i, k) => [i.id, k])), [items])

  const move = (id: string, dir: -1 | 1, focusKey: string) => {
    if (phase !== 'play') return
    const from = order.indexOf(id)
    const to = from + dir
    if (from < 0 || to < 0 || to >= n) return
    const next = order.slice()
    ;[next[from], next[to]] = [next[to], next[from]]
    setOrder(next)
    setAnnounce(`“${byId.get(id)?.text}” moved to position ${to + 1} of ${n}.`)
    // The row moves in the DOM; keep focus on the control that moved it.
    requestAnimationFrame(() => btnRefs.current.get(focusKey)?.focus({ preventScroll: false }))
  }

  const check = () => {
    const pos: Record<string, number> = {}
    const v: Record<string, boolean> = {}
    order.forEach((id, k) => {
      pos[id] = k
      v[id] = norm(byId.get(id)?.text ?? '') === norm(items[k].text)
    })
    const s = Object.values(v).filter(Boolean).length
    setSubmitted(pos)
    setVerdict(v)
    setPhase('checked')
    setAnnounce(s === n ? `Perfect: all ${n} in the right place.` : `${s} of ${n} in the right place. Wrong ones are marked.`)
    onResult(s, n)
    if (s === n) {
      celebrate(1)
      setPhase('revealed')
    } else {
      window.setTimeout(() => revealRef.current?.focus({ preventScroll: true }), 40)
    }
  }

  const reveal = () => {
    setOrder(items.map((i) => i.id))
    setPhase('revealed')
    setAnnounce('Showing the correct order.')
  }

  const again = () => {
    setOrder(scramble(items))
    setPhase('play')
    setSubmitted({})
    setVerdict({})
    setAnnounce('Shuffled. Put them in order again.')
  }

  const checked = phase !== 'play'
  const perfect = checked && score === n

  return (
    <section className="lab-ord__round" aria-labelledby="lab-ord-heading">
      <div className="lab-ord__head">
        <span className="lab-ord__head-icon" aria-hidden="true">
          {mode === 'units' ? <Layers size={20} /> : <ListOrdered size={20} />}
        </span>
        <div className="lab-ord__head-text">
          <h2 id="lab-ord-heading" className="lab-ord__title">
            {heading}
          </h2>
          <p className="lab-ord__sub">
            {sub && <span>{sub} · </span>}
            {checked ? (perfect ? 'All in place.' : 'Green is in the right place, red is not.') : 'Drag the handles, or use the arrows.'}
            {best != null && <span className="lab-ord__best"> · Best {best}%</span>}
          </p>
        </div>
      </div>

      <Reorder.Group axis="y" values={order} onReorder={(v) => phase === 'play' && setOrder(v)} as="ol" className={`lab-ord__list is-${phase}`}>
        {order.map((id, k) => {
          const item = byId.get(id)
          if (!item) return null
          return (
            <OrderRow
              key={id}
              item={item}
              index={k}
              count={n}
              phase={phase}
              mode={mode}
              ok={verdict[id]}
              was={submitted[id]}
              correct={correctIndex.get(id) ?? k}
              onMove={move}
              setRef={(key, el) => {
                if (el) btnRefs.current.set(key, el)
                else btnRefs.current.delete(key)
              }}
            />
          )
        })}
      </Reorder.Group>

      <div className="sr-only" aria-live="polite">
        {announce}
      </div>

      <AnimatePresence mode="wait" initial={false}>
        {!checked ? (
          <motion.div key="play" className="lab-ord__actions" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
            <button type="button" className="btn btn-unit btn-lg" onClick={check}>
              <Check size={18} aria-hidden="true" /> Check
            </button>
            <button type="button" className="btn" onClick={again}>
              <Shuffle size={16} aria-hidden="true" /> Shuffle
            </button>
          </motion.div>
        ) : (
          <motion.div key="result" className="lab-done lab-ord__result" variants={pop} initial="hidden" animate="show">
            <span className={`lab-ord__score${perfect ? ' is-perfect' : ''}`} aria-hidden="true">
              {perfect ? <Sparkles size={22} /> : `${score}/${n}`}
            </span>
            <div className="lab-done__text">
              <div className="lab-done__title">{perfect ? 'Perfect order.' : score >= n * 0.7 ? 'Nearly there.' : 'Keep walking the route.'}</div>
              <p className="lab-done__sub">
                {score} of {n} in the right place · <span className="lab-done__pct">{pct(score, n)}%</span>
              </p>
            </div>
            <div className="lab-done__actions">
              {phase === 'checked' && (
                <button ref={revealRef} type="button" className="btn btn-unit" onClick={reveal}>
                  <Eye size={16} aria-hidden="true" /> Show the correct order
                </button>
              )}
              <button type="button" className="btn" onClick={again}>
                <RotateCcw size={16} aria-hidden="true" /> Try again
              </button>
              {onNext && (
                <button type="button" className="btn" onClick={onNext}>
                  {nextLabel} <ArrowRight size={16} aria-hidden="true" />
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  )
}

interface RowProps {
  item: Item
  index: number
  count: number
  phase: Phase
  mode: Mode
  ok: boolean | undefined
  was: number | undefined
  correct: number
  onMove: (id: string, dir: -1 | 1, focusKey: string) => void
  setRef: (key: string, el: HTMLButtonElement | null) => void
}

function OrderRow({ item, index, count, phase, mode, ok, was, correct, onMove, setRef }: RowProps) {
  const controls = useDragControls()
  const play = phase === 'play'
  const status = play ? '' : ok ? ' is-ok' : ' is-bad'
  // Unit colours follow the unit order, so in the units round they only appear once the answer is out.
  const style = mode === 'units' && phase === 'revealed' ? unitVars(item.unitId) : undefined

  const onHandleKey = (e: ReactKeyboardEvent<HTMLButtonElement>) => {
    if (e.ctrlKey || e.metaKey || e.altKey) return
    if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      e.preventDefault()
      onMove(item.id, e.key === 'ArrowUp' ? -1 : 1, `${item.id}:grip`)
    }
  }

  return (
    <Reorder.Item
      value={item.id}
      as="li"
      dragListener={false}
      dragControls={controls}
      className={`lab-ord__row${status}`}
      style={style}
      whileDrag={{ scale: 1.02, boxShadow: 'var(--shadow-lg)', zIndex: 5 }}
      transition={phase === 'revealed' ? { layout: { type: 'spring', stiffness: 260, damping: 30, delay: correct * 0.05 } } : undefined}
    >
      <span className="lab-ord__pos" aria-hidden="true">
        {index + 1}
      </span>
      <span className="lab-ord__text">
        <span className="lab-ord__label">{item.text}</span>
        {!play && (
          <motion.span className="lab-ord__meta" initial={{ opacity: 0, y: -2 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25, ease: easeOut }}>
            {item.tag && <span className="lab-ord__tag">{item.tag}</span>}
            {phase === 'revealed' && !ok && was != null && <span className="lab-ord__was">you had it at {was + 1}</span>}
            {phase === 'checked' && !ok && <span className="lab-ord__was">belongs at {correct + 1}</span>}
          </motion.span>
        )}
      </span>
      {play ? (
        <span className="lab-ord__controls">
          <button
            type="button"
            ref={(el) => setRef(`${item.id}:up`, el)}
            className="lab-ord__btn"
            aria-label={`Move “${item.text}” up`}
            aria-disabled={index === 0 || undefined}
            onClick={() => onMove(item.id, -1, `${item.id}:up`)}
          >
            <ArrowUp size={16} aria-hidden="true" />
          </button>
          <button
            type="button"
            ref={(el) => setRef(`${item.id}:down`, el)}
            className="lab-ord__btn"
            aria-label={`Move “${item.text}” down`}
            aria-disabled={index === count - 1 || undefined}
            onClick={() => onMove(item.id, 1, `${item.id}:down`)}
          >
            <ArrowDown size={16} aria-hidden="true" />
          </button>
          <button
            type="button"
            ref={(el) => setRef(`${item.id}:grip`, el)}
            className="lab-ord__grip"
            aria-label={`Reorder “${item.text}”: position ${index + 1} of ${count}. Use the up and down arrow keys.`}
            onPointerDown={(e) => {
              e.preventDefault()
              controls.start(e)
            }}
            onKeyDown={onHandleKey}
          >
            <GripVertical size={18} aria-hidden="true" />
          </button>
        </span>
      ) : (
        <span className="lab-ord__mark" role="img" aria-label={ok ? 'Right place' : 'Wrong place'}>
          {ok ? <CircleCheck size={20} /> : <X size={20} />}
        </span>
      )}
    </Reorder.Item>
  )
}
