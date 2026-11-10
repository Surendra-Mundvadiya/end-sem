import { useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { Brain, Eye, EyeOff, Lightbulb, RefreshCw, RotateCw, SkipForward } from 'lucide-react'
import type { MnemonicTool as MnemonicData } from '../../../data'
import { easeOut, fadeUp, stagger } from '../../../lib/motion'
import { Rich, pct, plainText } from '../util'
import './mnemonic.css'

/*
 * A memory hook: the hook big on the front of a card that flips to what each key stands for.
 * Recall mode shows only the keys, in order; tap each to check yourself.
 */

type Mode = 'flip' | 'recall'

/** "Human capital" with key "H" → the "H" is picked out, so the key visibly comes from the word. */
function Expansion({ k, text }: { k: string; text: string }) {
  const plain = plainText(text)
  if (plain !== text || !k) return <Rich text={text} />
  const n = k.length
  if (plain.slice(0, n).toLowerCase() === k.toLowerCase()) {
    return (
      <span>
        <span className="lab-mn__initial">{plain.slice(0, n)}</span>
        {plain.slice(n)}
      </span>
    )
  }
  return <span>{plain}</span>
}

export default function MnemonicTool({ tool }: { tool: MnemonicData }) {
  const items = (tool.items ?? []).filter((i) => i && (i.key || i.text))
  const [mode, setMode] = useState<Mode>('flip')

  return (
    <div className="lab-mn">
      <div className="lab-bar">
        <div className="segmented lab-seg" role="group" aria-label="Mode">
          <button type="button" aria-pressed={mode === 'flip'} onClick={() => setMode('flip')}>
            <RotateCw size={14} aria-hidden="true" /> Flip card
          </button>
          <button type="button" aria-pressed={mode === 'recall'} onClick={() => setMode('recall')} disabled={!items.length}>
            <Brain size={14} aria-hidden="true" /> Recall
          </button>
        </div>
        {items.length > 0 && <span className="lab-mn__count">{items.length} keys, in order</span>}
      </div>

      <AnimatePresence mode="wait" initial={false}>
        <motion.div key={mode} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.22, ease: easeOut }}>
          {mode === 'flip' ? <FlipCard tool={tool} items={items} /> : <Recall items={items} />}
        </motion.div>
      </AnimatePresence>

      {tool.note && (
        <p className="lab-mn__note">
          <Lightbulb size={16} aria-hidden="true" />
          <Rich text={tool.note} />
        </p>
      )}
    </div>
  )
}

function FlipCard({ tool, items }: { tool: MnemonicData; items: MnemonicData['items'] }) {
  const [flipped, setFlipped] = useState(false)
  const reduce = useReducedMotion()
  const flip = () => setFlipped((f) => !f)

  const front = (
    <div className="lab-mn__face lab-mn__face--front">
      <span className="lab-mn__kicker">
        <Brain size={14} aria-hidden="true" /> Memory hook
      </span>
      <Rich text={tool.hook} as="p" className="lab-mn__hook" />
      {items.length > 0 && (
        <span className="lab-mn__keys" aria-hidden="true">
          {items.map((it, i) => (
            <span key={i} className="lab-mn__keychip">
              {it.key}
            </span>
          ))}
        </span>
      )}
    </div>
  )

  const back = (
    <div className="lab-mn__face lab-mn__face--back">
      <span className="lab-mn__kicker">
        <Lightbulb size={14} aria-hidden="true" /> What it stands for
      </span>
      {items.length > 0 ? (
        <ol className="lab-mn__list">
          {items.map((it, i) => (
            <motion.li
              key={i}
              initial={false}
              animate={flipped ? { opacity: 1, x: 0 } : { opacity: 0, x: -8 }}
              transition={{ duration: 0.35, ease: easeOut, delay: flipped ? 0.18 + i * 0.06 : 0 }}
            >
              <span className="lab-mn__key">{it.key}</span>
              <span className="lab-mn__text">
                <Expansion k={it.key} text={it.text} />
              </span>
            </motion.li>
          ))}
        </ol>
      ) : (
        <Rich text={tool.hook} as="p" className="lab-mn__hook" />
      )}
    </div>
  )

  return (
    <div className="lab-mn__stage">
      <div
        className={`lab-mn__card${flipped ? ' is-flipped' : ''}${reduce ? ' is-fade' : ''}`}
        onClick={(e) => {
          // The whole card flips for pointer users; the button below is the keyboard path.
          if ((e.target as HTMLElement).closest('button, a')) return
          flip()
        }}
      >
        {reduce ? (
          <AnimatePresence mode="wait" initial={false}>
            <motion.div key={flipped ? 'back' : 'front'} className="lab-mn__fade" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
              {flipped ? back : front}
            </motion.div>
          </AnimatePresence>
        ) : (
          <motion.div className="lab-mn__inner" initial={false} animate={{ rotateY: flipped ? 180 : 0 }} transition={{ type: 'spring', stiffness: 160, damping: 20 }}>
            <div className="lab-mn__side lab-mn__side--front" aria-hidden={flipped} inert={flipped}>
              {front}
            </div>
            <div className="lab-mn__side lab-mn__side--back" aria-hidden={!flipped} inert={!flipped}>
              {back}
            </div>
          </motion.div>
        )}
      </div>
      <div className="lab-mn__actions">
        <button type="button" className="btn btn-unit" onClick={flip} aria-pressed={flipped}>
          <RotateCw size={16} aria-hidden="true" /> {flipped ? 'Back to the hook' : 'Show what it stands for'}
        </button>
      </div>
    </div>
  )
}

function Recall({ items }: { items: MnemonicData['items'] }) {
  const [shown, setShown] = useState<Set<number>>(() => new Set())
  const total = items.length
  const toggle = (i: number) =>
    setShown((s) => {
      const n = new Set(s)
      if (n.has(i)) n.delete(i)
      else n.add(i)
      return n
    })
  const nextHidden = items.findIndex((_, i) => !shown.has(i))

  return (
    <div className="lab-mn__recall">
      <div className="lab-bar">
        <div className="lab-score" aria-live="polite">
          <span>
            {shown.size} of {total} revealed
          </span>
          <span className="bar lab-score__bar" aria-hidden="true">
            <span style={{ width: `${pct(shown.size, total)}%` }} />
          </span>
        </div>
        <div className="lab-bar__group">
          <button type="button" className="btn btn-sm btn-unit" onClick={() => nextHidden >= 0 && toggle(nextHidden)} disabled={nextHidden < 0}>
            <SkipForward size={15} aria-hidden="true" /> Reveal next
          </button>
          <button type="button" className="btn btn-sm" onClick={() => setShown(new Set(items.map((_, i) => i)))} disabled={shown.size === total}>
            <Eye size={15} aria-hidden="true" /> All
          </button>
          <button type="button" className="btn btn-sm" onClick={() => setShown(new Set())} disabled={shown.size === 0}>
            <RefreshCw size={15} aria-hidden="true" /> Hide all
          </button>
        </div>
      </div>

      <p className="lab-mn__ask">Say what each key stands for, in order, before you tap it.</p>

      <motion.ol className="lab-mn__tiles" variants={stagger(0.06)} initial="hidden" animate="show">
        {items.map((it, i) => {
          const on = shown.has(i)
          return (
            <motion.li key={i} variants={fadeUp}>
              <button type="button" className={`lab-mn__tile${on ? ' is-on' : ''}`} onClick={() => toggle(i)} aria-expanded={on}>
                <span className="lab-mn__tile-num" aria-hidden="true">
                  {i + 1}
                </span>
                <span className="lab-mn__tile-key">{it.key}</span>
                <span className="lab-mn__tile-body">
                  <AnimatePresence mode="wait" initial={false}>
                    {on ? (
                      <motion.span key="on" className="lab-mn__tile-text" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.22, ease: easeOut }}>
                        <Expansion k={it.key} text={it.text} />
                      </motion.span>
                    ) : (
                      <motion.span key="off" className="lab-mn__tile-hint" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}>
                        <EyeOff size={14} aria-hidden="true" /> Tap to check
                      </motion.span>
                    )}
                  </AnimatePresence>
                </span>
              </button>
            </motion.li>
          )
        })}
      </motion.ol>
    </div>
  )
}
