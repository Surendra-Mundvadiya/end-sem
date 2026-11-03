import { useEffect, useId, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode, type RefObject } from 'react'
import { animate, motion, useMotionValue, useReducedMotion, useTransform, type Transition } from 'framer-motion'
import { Link } from 'react-router-dom'
import { ArrowUpRight, BadgeCheck, BookOpen, CircleSlash } from 'lucide-react'
import { slideById } from '../../../data'
import { easeOut, spring } from '../../../lib/motion'
import { inr, parseDigits, rs } from './format'
import './calc.css'

/* Shared building blocks for the three calculators. Class prefix: lab-. */

/* ---------- motion helpers ---------- */

/** Tween for SVG geometry: springs overshoot, and an overshooting height or width goes negative. */
export function useGeoTransition(duration = 0.55): Transition {
  const reduce = useReducedMotion()
  return reduce ? { duration: 0 } : { duration, ease: easeOut }
}

/**
 * A number that glides to its new value. The visible digits are aria-hidden; a static copy of the final value
 * is kept for screen readers, so assistive tech never hears the in-between frames.
 */
export function AnimatedNumber({
  value,
  format = rs,
  className,
  startFrom,
}: {
  value: number
  format?: (n: number) => string
  className?: string
  /** Count up from this value on first render (e.g. 0). Defaults to no entrance animation. */
  startFrom?: number
}) {
  const reduce = useReducedMotion()
  const mv = useMotionValue(reduce || startFrom === undefined ? value : startFrom)
  const text = useTransform(mv, (v) => format(v))
  useEffect(() => {
    if (reduce) {
      mv.set(value)
      return
    }
    const controls = animate(mv, value, { duration: 0.6, ease: easeOut })
    return () => controls.stop()
  }, [value, reduce, mv])
  return (
    <span className={className}>
      <motion.span aria-hidden="true">{text}</motion.span>
      <span className="sr-only">{format(value)}</span>
    </span>
  )
}

/** The value, but only after it has stopped changing for `ms` (keeps aria-live quiet while a slider moves). */
export function useDebounced<T>(value: T, ms = 700): T {
  const [v, setV] = useState(value)
  useEffect(() => {
    const t = window.setTimeout(() => setV(value), ms)
    return () => window.clearTimeout(t)
  }, [value, ms])
  return v
}

/** A stable id that is safe inside url(#…) references. */
export function useSvgId(prefix: string): string {
  return `${prefix}-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`
}

/* ---------- measuring ---------- */

/** Width of an element, kept current with a ResizeObserver (charts lay out in pixels so text stays crisp). */
export function useElementWidth<T extends HTMLElement>(): [RefObject<T | null>, number] {
  const ref = useRef<T | null>(null)
  const [width, setWidth] = useState(0)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    setWidth(el.getBoundingClientRect().width)
    if (typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width
      if (w != null) setWidth((prev) => (Math.abs(prev - w) > 0.5 ? w : prev))
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  return [ref, width]
}

/* ---------- inputs ---------- */

interface MoneyFieldProps {
  label: ReactNode
  value: number
  onChange: (n: number) => void
  hint?: ReactNode
  max?: number
  size?: 'md' | 'lg'
  disabled?: boolean
}

/**
 * Rupee input in Indian grouping. Shows "12,25,000"; while focused the text is left as typed (so the caret never
 * jumps) and every keystroke still updates the value; the grouping is restored on blur.
 */
export function MoneyField({ label, value, onChange, hint, max = 99_99_99_99_999, size = 'md', disabled }: MoneyFieldProps) {
  const id = useId()
  const hintId = `${id}-hint`
  const [draft, setDraft] = useState<string | null>(null)
  return (
    <div className="lab-field">
      <label className="lab-field__label" htmlFor={id}>
        {label}
      </label>
      <div className={`lab-money lab-money--${size}${disabled ? ' is-disabled' : ''}`}>
        <span className="lab-money__prefix" aria-hidden="true">
          Rs.
        </span>
        <input
          id={id}
          className="lab-money__input"
          type="text"
          inputMode="numeric"
          autoComplete="off"
          spellCheck={false}
          disabled={disabled}
          value={draft ?? inr(value)}
          aria-describedby={hint ? hintId : undefined}
          onFocus={(e) => {
            setDraft(inr(value))
            e.currentTarget.select()
          }}
          onChange={(e) => {
            const text = e.currentTarget.value.replace(/[^\d,\s]/g, '')
            setDraft(text)
            onChange(Math.min(max, parseDigits(text)))
          }}
          onBlur={() => setDraft(null)}
        />
      </div>
      {hint && (
        <p id={hintId} className="lab-field__hint">
          {hint}
        </p>
      )}
    </div>
  )
}

interface RangeProps {
  label: string
  value: number
  min: number
  max: number
  step: number
  onChange: (n: number) => void
  format?: (n: number) => string
  /** Optional labels under the track: [value, text]. */
  marks?: [number, string][]
  disabled?: boolean
}

/** Styled range input. Values above max are shown pinned at the end of the track (the value itself is not changed). */
export function RangeSlider({ label, value, min, max, step, onChange, format = rs, marks, disabled }: RangeProps) {
  const clamped = Math.min(max, Math.max(min, value))
  const fill = max > min ? ((clamped - min) / (max - min)) * 100 : 0
  return (
    <div className="lab-range-wrap">
      <input
        type="range"
        className="lab-range"
        aria-label={label}
        aria-valuetext={format(value)}
        min={min}
        max={max}
        step={step}
        value={clamped}
        disabled={disabled}
        onChange={(e) => onChange(Number(e.currentTarget.value))}
        style={{ '--fill': `${fill}%` } as CSSProperties}
      />
      {marks && (
        <div className="lab-range__marks" aria-hidden="true">
          {marks.map(([v, text]) => (
            <span key={v} style={{ left: `${((v - min) / (max - min)) * 100}%` }}>
              {text}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

export function Switch({ checked, onChange, label, hint }: { checked: boolean; onChange: (v: boolean) => void; label: ReactNode; hint?: ReactNode }) {
  return (
    <button type="button" role="switch" aria-checked={checked} className="lab-switch" onClick={() => onChange(!checked)}>
      <span className="lab-switch__track" aria-hidden="true">
        <motion.span className="lab-switch__thumb" initial={false} animate={{ x: checked ? 18 : 0 }} transition={spring} />
      </span>
      <span className="lab-switch__text">
        <span className="lab-switch__label">{label}</span>
        {hint && <span className="lab-switch__hint">{hint}</span>}
      </span>
    </button>
  )
}

export function Check({ checked, onChange, children }: { checked: boolean; onChange: (v: boolean) => void; children: ReactNode }) {
  return (
    <label className="lab-check">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.currentTarget.checked)} />
      <span className="lab-check__box" aria-hidden="true">
        <svg viewBox="0 0 16 16" width="12" height="12">
          <motion.path
            d="M3.5 8.5l3 3 6-7"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
            initial={false}
            animate={{ pathLength: checked ? 1 : 0, opacity: checked ? 1 : 0 }}
            transition={{ duration: 0.22, ease: easeOut }}
          />
        </svg>
      </span>
      <span className="lab-check__text">{children}</span>
    </label>
  )
}

export interface SegOption<T extends string> {
  value: T
  label: ReactNode
}

export function Segmented<T extends string>({ label, value, options, onChange }: { label: string; value: T; options: SegOption<T>[]; onChange: (v: T) => void }) {
  return (
    <div className="lab-seg">
      <span className="lab-field__label" aria-hidden="true">
        {label}
      </span>
      <div className="segmented lab-seg__group" role="group" aria-label={label}>
        {options.map((o) => (
          <button key={o.value} type="button" aria-pressed={o.value === value} onClick={() => onChange(o.value)}>
            {o.label}
          </button>
        ))}
      </div>
    </div>
  )
}

/* ---------- panels and callouts ---------- */

export function Panel({ title, icon, children, className = '', aside }: { title: ReactNode; icon?: ReactNode; children: ReactNode; className?: string; aside?: ReactNode }) {
  const id = useId()
  return (
    <section className={`card lab-panel ${className}`} aria-labelledby={id}>
      <div className="lab-panel__head">
        <h2 id={id} className="lab-panel__title">
          {icon && (
            <span className="lab-panel__icon" aria-hidden="true">
              {icon}
            </span>
          )}
          {title}
        </h2>
        {aside}
      </div>
      {children}
    </section>
  )
}

/** "From your notes": the rule the tool applies, quoted from the notes, with links to the slides. */
export function NotesCallout({ slideIds, children, title = 'From your notes' }: { slideIds: string[]; children: ReactNode; title?: ReactNode }) {
  return (
    <aside className="lab-notes">
      <div className="lab-notes__head">
        <span className="lab-notes__icon" aria-hidden="true">
          <BookOpen size={16} />
        </span>
        <b>{title}</b>
      </div>
      <div className="lab-notes__body">{children}</div>
      <div className="lab-notes__links">
        {slideIds.map((id) => {
          const s = slideById(id)
          if (!s) return null
          return (
            <Link key={id} to={`/learn/${id}`} className="lab-notes__link">
              {s.title}
              <ArrowUpRight size={14} aria-hidden="true" />
            </Link>
          )
        })}
      </div>
    </aside>
  )
}

/** "Not computed here": what the tool leaves out, said plainly instead of guessed. */
export function LeftOut({ items, note = 'because your notes don’t state the rule or rate' }: { items: ReactNode[]; note?: ReactNode }) {
  return (
    <aside className="lab-leftout">
      <div className="lab-leftout__head">
        <CircleSlash size={16} aria-hidden="true" />
        <b>Not computed here</b>
        <span>{note}</span>
      </div>
      <ul>
        {items.map((it, i) => (
          <li key={i}>{it}</li>
        ))}
      </ul>
    </aside>
  )
}

/** Green "matches the notes" check shown while a notes illustration is loaded and reproduced. */
export function MatchBadge({ children }: { children: ReactNode }) {
  return (
    <motion.span className="lab-match" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={spring}>
      <BadgeCheck size={16} aria-hidden="true" />
      {children}
    </motion.span>
  )
}

/** A short "Step n" entry of an exam-style working. */
export function Step({ n, title, children, tone }: { n: number; title: ReactNode; children?: ReactNode; tone?: 'result' | 'muted' }) {
  return (
    <motion.li
      layout="position"
      className={`lab-step${tone ? ` lab-step--${tone}` : ''}`}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -6 }}
      transition={{ duration: 0.3, ease: easeOut }}
    >
      <span className="lab-step__dot" aria-hidden="true" />
      <div className="lab-step__body">
        <div className="lab-step__kicker">Step {n}</div>
        <div className="lab-step__title">{title}</div>
        {children && <div className="lab-step__text">{children}</div>}
      </div>
    </motion.li>
  )
}
