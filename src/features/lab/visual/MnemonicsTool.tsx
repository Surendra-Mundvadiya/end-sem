import './visual.css'
import { useEffect, useId, useRef, useState, type CSSProperties, type ReactNode, type Ref } from 'react'
import { AnimatePresence, LayoutGroup, motion } from 'framer-motion'
import { Eye, Layers, Repeat2, RotateCcw, Shuffle } from 'lucide-react'
import UnitPill from '../../../components/UnitPill'
import { UNITS, unitVars, type UnitId } from '../../../data'
import { softSpring } from '../../../lib/motion'
import { shuffle } from '../../../lib/text'
import { MNEMONICS, type HookKind, type Mnemonic, type MnItem } from './mnemonics'
import { SourceLink } from './ui'

/*
 * Memory hooks across all six units. The hooks are ours; the items they encode are quoted from the notes
 * (see mnemonics.ts, where each card names its source slide).
 */

const KIND_LABEL: Record<HookKind, string> = { acronym: 'Acronym', phrase: 'Phrase', picture: 'Picture', numbers: 'Numbers' }

const TONE: Record<NonNullable<MnItem['tone']>, string> = { ok: 'var(--ok)', warn: 'var(--warn)', bad: 'var(--bad)' }

export default function MnemonicsTool() {
  const [unit, setUnit] = useState<UnitId | 'all'>('all')
  const [recall, setRecall] = useState(false)
  const [flipped, setFlipped] = useState<Set<string>>(() => new Set())
  const [order, setOrder] = useState<string[]>(() => MNEMONICS.map((m) => m.id))
  const filterId = useId()

  const byId = new Map(MNEMONICS.map((m) => [m.id, m]))
  const list = order.map((id) => byId.get(id)).filter((m): m is Mnemonic => !!m && (unit === 'all' || m.unitId === unit))
  const allFlipped = list.length > 0 && list.every((m) => flipped.has(m.id))

  const toggle = (id: string) =>
    setFlipped((s) => {
      const next = new Set(s)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  const flipAll = () =>
    setFlipped((s) => {
      const next = new Set(s)
      for (const m of list) {
        if (allFlipped) next.delete(m.id)
        else next.add(m.id)
      }
      return next
    })

  const count = (u: UnitId) => MNEMONICS.filter((m) => m.unitId === u).length

  return (
    <div className="lv-tool lv-mn">
      <section className="lv-card lv-stack" aria-labelledby={filterId}>
        <div className="lv-spread">
          <div>
            <h3 id={filterId} className="lv-h">
              Memory hooks
            </h3>
            <p className="lv-lead">
              Read the hook, say the list out loud, then flip the card to check. Every item is worded as in the notes; only the hook is invented.
            </p>
          </div>
        </div>
        <div className="lv-wrapchips" role="group" aria-labelledby={filterId}>
          <button type="button" className="chip" aria-pressed={unit === 'all'} onClick={() => setUnit('all')}>
            All units · {MNEMONICS.length}
          </button>
          {UNITS.map((u) => (
            <button key={u.id} type="button" className="chip" style={unitVars(u.id)} aria-pressed={unit === u.id} onClick={() => setUnit(u.id)}>
              {u.short} · {count(u.id)}
            </button>
          ))}
        </div>
        <div className="lv-spread">
          <div className="segmented" role="group" aria-label="Back of the card">
            <button type="button" aria-pressed={!recall} onClick={() => setRecall(false)}>
              Show answers
            </button>
            <button type="button" aria-pressed={recall} onClick={() => setRecall(true)}>
              Test my recall
            </button>
          </div>
          <div className="lv-row">
            <button type="button" className="btn btn-sm" onClick={flipAll}>
              <Layers size={15} aria-hidden="true" /> {allFlipped ? 'Turn all back' : 'Flip all'}
            </button>
            <button
              type="button"
              className="btn btn-sm btn-ghost"
              onClick={() => {
                setOrder(shuffle(MNEMONICS.map((m) => m.id)))
                setFlipped(new Set())
              }}
            >
              <Shuffle size={15} aria-hidden="true" /> Shuffle
            </button>
          </div>
        </div>
        <p className="sr-only" aria-live="polite">
          Showing {list.length} hooks{unit === 'all' ? '' : ` for ${UNITS.find((u) => u.id === unit)?.short}`}.
        </p>
      </section>

      <LayoutGroup>
        <div className="lv-mn__grid">
          <AnimatePresence mode="popLayout" initial={false}>
            {list.map((m, i) => (
              <HookCard key={m.id} m={m} index={i} flipped={flipped.has(m.id)} onFlip={() => toggle(m.id)} recall={recall} />
            ))}
          </AnimatePresence>
        </div>
      </LayoutGroup>
    </div>
  )
}

function renderHook(m: Mnemonic): ReactNode {
  if (m.kind !== 'phrase') return m.hook
  // Phrase hooks: bold the first letter of each word, the letter that stands for an item.
  return m.hook.split(' ').map((word, i) => {
    const at = word.search(/[A-Za-z]/)
    if (at < 0) return <span key={i}>{(i ? ' ' : '') + word}</span>
    return (
      <span key={i}>
        {i ? ' ' : ''}
        {word.slice(0, at)}
        <b>{word[at]}</b>
        {word.slice(at + 1)}
      </span>
    )
  })
}

function HookCard({
  m,
  index,
  flipped,
  onFlip,
  recall,
  ref,
}: {
  m: Mnemonic
  index: number
  flipped: boolean
  onFlip: () => void
  recall: boolean
  /** AnimatePresence (popLayout) measures the card through this ref. */
  ref?: Ref<HTMLElement>
}) {
  const frontBtn = useRef<HTMLButtonElement>(null)
  const backBtn = useRef<HTMLButtonElement>(null)
  const moveFocus = useRef(false)
  const [revealed, setRevealed] = useState<Set<number>>(() => new Set())
  const titleId = useId()

  // When this card's own button flips it, move focus to the button on the face now showing.
  useEffect(() => {
    if (!moveFocus.current) return
    moveFocus.current = false
    ;(flipped ? backBtn : frontBtn).current?.focus({ preventScroll: true })
  }, [flipped])

  // Start every recall attempt (each flip, or switching mode) with the answers hidden.
  useEffect(() => {
    setRevealed(new Set())
  }, [flipped, recall])

  const flip = () => {
    moveFocus.current = true
    onFlip()
  }
  const allShown = !recall || revealed.size === m.items.length

  return (
    <motion.article
      ref={ref}
      layout="position"
      className="lv-flip"
      style={unitVars(m.unitId)}
      aria-labelledby={titleId}
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0, transition: { ...softSpring, delay: Math.min(index, 8) * 0.04 } }}
      exit={{ opacity: 0, scale: 0.96, transition: { duration: 0.18 } }}
    >
      <motion.div className="lv-flip__inner" initial={false} animate={{ rotateY: flipped ? 180 : 0 }} transition={{ type: 'spring', stiffness: 210, damping: 24 }}>
        <div className="lv-face lv-face--front" inert={flipped} aria-hidden={flipped || undefined}>
          <div className="lv-spread">
            <UnitPill unitId={m.unitId} />
            <span className="lv-tag">{KIND_LABEL[m.kind]}</span>
          </div>
          <div className="lv-stack" style={{ gap: 10 }}>
            <h4 id={titleId} className="lv-mn__title">
              {m.title}
            </h4>
            <p className={`lv-mn__hook${m.kind === 'phrase' ? ' is-phrase' : ''}`}>{renderHook(m)}</p>
            <p className="lv-mn__tagline">{m.tagline}</p>
          </div>
          <div className="lv-mn__foot">
            <span className="lv-cite">{m.items.length} items to recall</span>
            <button ref={frontBtn} type="button" className="lv-flipbtn" onClick={flip} aria-label={`Flip: what “${m.hook}” stands for`}>
              <Repeat2 size={15} aria-hidden="true" /> Flip
            </button>
          </div>
        </div>

        <div className="lv-face lv-face--back" inert={!flipped} aria-hidden={!flipped || undefined}>
          <div className="lv-spread">
            <p className="lv-mn__title">{m.hook}</p>
            {recall && (
              <button
                type="button"
                className="btn btn-sm btn-ghost"
                onClick={() => setRevealed(allShown ? new Set() : new Set(m.items.map((_, i) => i)))}
              >
                {allShown ? <RotateCcw size={14} aria-hidden="true" /> : <Eye size={14} aria-hidden="true" />} {allShown ? 'Hide again' : 'Reveal all'}
              </button>
            )}
          </div>
          <ol className="lv-mn__items">
            {m.items.map((it, i) => {
              const hidden = recall && !revealed.has(i)
              const tone: CSSProperties | undefined = it.tone ? { background: TONE[it.tone] } : undefined
              return (
                <motion.li
                  key={i}
                  className="lv-mn__item"
                  initial={false}
                  animate={flipped ? { opacity: 1, x: 0 } : { opacity: 0, x: 10 }}
                  transition={{ ...softSpring, delay: flipped ? 0.18 + i * 0.06 : 0 }}
                >
                  {recall ? (
                    <button
                      type="button"
                      className={`lv-mn__key${hidden ? ' is-hidden' : ''}`}
                      style={hidden ? undefined : tone}
                      aria-expanded={!hidden}
                      aria-label={hidden ? `Reveal what ${it.key} stands for` : `${it.key}: shown`}
                      onClick={() =>
                        setRevealed((s) => {
                          const next = new Set(s)
                          if (next.has(i)) next.delete(i)
                          else next.add(i)
                          return next
                        })
                      }
                    >
                      {it.key}
                    </button>
                  ) : (
                    <span className="lv-mn__key" style={tone}>
                      {it.key}
                    </span>
                  )}
                  <AnimatePresence mode="wait" initial={false}>
                    {hidden ? (
                      <motion.span key="h" className="lv-mn__placeholder" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                        Say it, then tap {it.key} to check.
                      </motion.span>
                    ) : (
                      <motion.span key="t" className="lv-mn__text" initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                        {it.text}
                      </motion.span>
                    )}
                  </AnimatePresence>
                </motion.li>
              )
            })}
          </ol>
          {m.weights && <Weights items={m.items} weights={m.weights} show={flipped} />}
          {m.note && <p className="lv-mn__note">{m.note}</p>}
          {m.reordered && <p className="lv-mn__note">The hook rearranges the order; the notes list these items in a different sequence.</p>}
          <div className="lv-mn__foot">
            <SourceLink slideId={m.slideId} />
            <button ref={backBtn} type="button" className="lv-flipbtn" onClick={flip} aria-label={`Flip back to the “${m.hook}” hook`}>
              <Repeat2 size={15} aria-hidden="true" /> Back
            </button>
          </div>
        </div>
      </motion.div>
    </motion.article>
  )
}

function Weights({ items, weights, show }: { items: MnItem[]; weights: number[]; show: boolean }) {
  return (
    <div className="lv-wbar" role="img" aria-label={`Weights: ${items.map((it) => it.text).join(', ')}`}>
      {weights.map((w, i) => (
        <motion.span
          key={i}
          className={`lv-wbar__seg${i % 2 ? ' is-soft' : ''}`}
          style={{ flexGrow: w, flexBasis: 0 }}
          initial={false}
          animate={{ scaleX: show ? 1 : 0 }}
          transition={{ ...softSpring, delay: show ? 0.25 + i * 0.08 : 0 }}
        >
          {w >= 10 ? items[i]?.key : ''}
        </motion.span>
      ))}
    </div>
  )
}
