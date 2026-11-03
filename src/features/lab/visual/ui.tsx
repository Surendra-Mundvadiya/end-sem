import { useEffect, useId, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode, type RefObject } from 'react'
import { Link } from 'react-router-dom'
import { BookOpen } from 'lucide-react'
import { slideById } from '../../../data'

/* Small building blocks shared by the visual tools. */

/** Link to a notes slide, labelled with the slide title. */
export function SourceLink({ slideId, label, className }: { slideId: string; label?: string; className?: string }) {
  const slide = slideById(slideId)
  return (
    <Link to={`/learn/${slideId}`} className={`lv-source${className ? ` ${className}` : ''}`}>
      <BookOpen size={15} aria-hidden="true" />
      <span>{label ?? slide?.title ?? 'Read the notes'}</span>
    </Link>
  )
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

/** Decided cases as trusted HTML in the notes' own markup (div.case > p.cname + p). Names are plain text, so they are escaped. */
export function casesHtml(cases: { name: string; held: string }[]): string {
  return cases.map((c) => `<div class="case"><p class="cname">${escapeHtml(c.name)}</p><p>${c.held}</p></div>`).join('')
}

/** On/off switch whose visible text is its label. */
export function Switch({
  checked,
  onChange,
  children,
  unused = false,
}: {
  checked: boolean
  onChange: (next: boolean) => void
  children: ReactNode
  unused?: boolean
}) {
  return (
    <div className={`lv-field${unused ? ' is-unused' : ''}`}>
      <button type="button" role="switch" aria-checked={checked} className="lv-switch" onClick={() => onChange(!checked)}>
        <span className="lv-switch__track" aria-hidden="true" />
        <span style={{ flex: 1 }}>{children}</span>
        {unused && <span className="lv-unused">Not needed here</span>}
      </button>
    </div>
  )
}

/** A labelled number with a slider and threshold ticks (e.g. 60, 120, 182 days). */
export function DaysField({
  label,
  hint,
  value,
  max,
  ticks,
  onChange,
  unused = false,
}: {
  label: string
  hint?: string
  value: number
  max: number
  ticks: number[]
  onChange: (v: number) => void
  unused?: boolean
}) {
  const id = useId()
  const hintId = `${id}-hint`
  const pct = (Math.min(max, Math.max(0, value)) / max) * 100
  const clamp = (n: number) => Math.max(0, Math.min(max, Math.round(Number.isFinite(n) ? n : 0)))
  return (
    <div className={`lv-field${unused ? ' is-unused' : ''}`}>
      <div className="lv-field__label">
        <label htmlFor={`${id}-range`}>{label}</label>
        {unused && <span className="lv-unused">Not needed here</span>}
      </div>
      <div className="lv-days">
        <div className="lv-range-wrap">
          <input
            id={`${id}-range`}
            className="lv-range"
            type="range"
            min={0}
            max={max}
            step={1}
            value={value}
            aria-describedby={hint ? hintId : undefined}
            style={{ '--p': `${pct}%` } as CSSProperties}
            onChange={(e) => onChange(clamp(e.currentTarget.valueAsNumber))}
          />
          <div className="lv-ticks" aria-hidden="true">
            {ticks.map((t) => (
              <span key={t} className={`lv-tick${value >= t ? ' is-met' : ''}`} style={{ left: `${(t / max) * 100}%` }}>
                {t}
              </span>
            ))}
          </div>
        </div>
        <input
          className="input lv-num"
          type="number"
          inputMode="numeric"
          min={0}
          max={max}
          value={value}
          aria-label={`${label} (number)`}
          onChange={(e) => onChange(clamp(e.currentTarget.valueAsNumber))}
        />
      </div>
      {hint && (
        <p id={hintId} className="lv-field__hint">
          {hint}
        </p>
      )}
    </div>
  )
}

/** True when a keyboard shortcut should be ignored (typing, modifiers, or a modal is open). */
export function shouldIgnoreKey(e: KeyboardEvent): boolean {
  if (e.ctrlKey || e.metaKey || e.altKey) return true
  if (document.body.dataset.modal === 'open') return true
  const t = e.target as HTMLElement | null
  if (!t) return false
  const tag = t.tagName
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || t.isContentEditable
}

/** Window keydown listener that respects shouldIgnoreKey. The handler may change between renders. */
export function useHotkeys(handler: (e: KeyboardEvent) => void, enabled = true) {
  const ref = useRef(handler)
  useLayoutEffect(() => {
    ref.current = handler
  })
  useEffect(() => {
    if (!enabled) return
    const onKey = (e: KeyboardEvent) => {
      if (shouldIgnoreKey(e)) return
      ref.current(e)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [enabled])
}

/** Width of an element, kept up to date with a ResizeObserver. */
export function useElementWidth<T extends HTMLElement>(ref: RefObject<T | null>): number {
  const [width, setWidth] = useState(0)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    setWidth(el.getBoundingClientRect().width)
    if (typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width
      if (w != null) setWidth(w)
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [ref])
  return width
}
