import { useEffect, useId, useMemo, useState, type CSSProperties } from 'react'
import { AnimatePresence, animate, motion, useMotionValue, useReducedMotion, useTransform } from 'framer-motion'
import { BookOpen, CircleAlert, CircleCheck, RotateCcw } from 'lucide-react'
import { unitVars, type FormulaTool as FormulaToolData, type FormulaVar } from '../../../data'
import { compileFormula, type CompiledFormula, type FormulaVars } from '../../../lib/formula'
import { bouncy, easeOut } from '../../../lib/motion'
import './FormulaTool.css'

/*
 * A calculator for one formula from the notes. The expression is parsed by lib/formula.ts (no eval);
 * every input has a slider and a number box, and the working is shown with the values put in.
 */

/* ---------- numbers ---------- */

const formatters = new Map<string, Intl.NumberFormat>()

/** Indian digit grouping (1,00,000), a fixed or a maximum number of decimals. */
function fmt(n: number, decimals: number, fixed = false): string {
  const key = `${decimals}|${fixed}`
  let f = formatters.get(key)
  if (!f) {
    f = new Intl.NumberFormat('en-IN', { maximumFractionDigits: decimals, minimumFractionDigits: fixed ? decimals : 0 })
    formatters.set(key, f)
  }
  return f.format(n)
}

function decimalsOf(n: number): number {
  const s = String(n)
  if (/e-/i.test(s)) return Math.min(6, Number(s.split(/e-/i)[1]) || 0)
  return s.includes('.') ? s.split('.')[1].length : 0
}

/** Rounds up to 1, 2, 2.5 or 5 times a power of ten: 437 -> 500, 1200 -> 2000. */
function niceCeil(n: number): number {
  if (n <= 0) return 1
  const p = 10 ** Math.floor(Math.log10(n))
  for (const m of [1, 2, 2.5, 5, 10]) if (m * p >= n) return m * p
  return 10 * p
}

interface Range {
  min: number
  max: number
  step: number
}

/** Slider bounds: the notes' own min/max/step, or sensible ones built around the default value. */
function rangeOf(v: FormulaVar): Range {
  const value = Number.isFinite(v.value) ? v.value : 0
  const step = v.step && v.step > 0 ? v.step : Number.isInteger(value) ? 1 : 10 ** -Math.min(4, Math.max(1, decimalsOf(value)))
  const percent = /%|per ?cent/i.test(v.unit ?? '')
  let min = v.min ?? (value < 0 ? -niceCeil(Math.abs(value) * 2) : 0)
  let max = v.max ?? (percent && value >= 0 && value <= 100 ? 100 : niceCeil(Math.max(Math.abs(value) * 2, step * 10, 1)))
  if (max <= min) max = min + step * 100
  if (value < min) min = value
  if (value > max) max = value
  return { min, max, step }
}

/* ---------- the expression, for display ---------- */

interface DisplayToken {
  kind: 'var' | 'num' | 'op' | 'open' | 'close' | 'fn' | 'comma'
  text: string
  unary?: boolean
}

const OP_SYMBOL: Record<string, string> = { '*': '×', '/': '÷', '-': '−', '+': '+', '^': '^' }

function displayTokens(expr: string): DisplayToken[] {
  const out: DisplayToken[] = []
  const re = /\d*\.?\d+(?:e[+-]?\d+)?|[A-Za-z_][A-Za-z0-9_]*|[-+*/^(),]/gi
  for (let m = re.exec(expr); m; m = re.exec(expr)) {
    const text = m[0]
    const prev = out[out.length - 1]
    if (/^[A-Za-z_]/.test(text)) {
      const isCall = /^\s*\(/.test(expr.slice(re.lastIndex))
      out.push({ kind: isCall ? 'fn' : 'var', text })
    } else if (/^[\d.]/.test(text)) out.push({ kind: 'num', text })
    else if (text === '(') out.push({ kind: 'open', text })
    else if (text === ')') out.push({ kind: 'close', text })
    else if (text === ',') out.push({ kind: 'comma', text })
    else {
      const unary = (text === '-' || text === '+') && (!prev || prev.kind === 'op' || prev.kind === 'open' || prev.kind === 'comma')
      out.push({ kind: 'op', text, unary })
    }
  }
  return out
}

function Expression({
  tokens,
  vars,
  values,
}: {
  tokens: DisplayToken[]
  vars: Map<string, FormulaVar>
  /** With values: each variable is replaced by its current value. */
  values?: FormulaVars
}) {
  return (
    <>
      {tokens.map((t, i) => {
        switch (t.kind) {
          case 'var': {
            const v = vars.get(t.text)
            if (!values) {
              return (
                <var key={i} className="fx-var" title={v?.label}>
                  {t.text}
                </var>
              )
            }
            const n = values[t.text] ?? 0
            const shown = fmt(n, 6)
            return (
              <span key={i} className="fx-val" title={v ? `${v.label} (${t.text})` : t.text}>
                {n < 0 ? `(${shown})` : shown}
              </span>
            )
          }
          case 'op':
            return (
              <span key={i} className={t.unary ? 'fx-op is-unary' : 'fx-op'}>
                {OP_SYMBOL[t.text] ?? t.text}
              </span>
            )
          case 'comma':
            return (
              <span key={i} className="fx-comma">
                ,
              </span>
            )
          case 'fn':
            return (
              <span key={i} className="fx-fn">
                {t.text}
              </span>
            )
          default:
            return <span key={i}>{t.text}</span>
        }
      })}
    </>
  )
}

/* ---------- pieces ---------- */

/** The result, easing to each new value (imperative animate() ignores MotionConfig, so reduced motion is checked here). */
function AnimatedNumber({ value, decimals }: { value: number; decimals: number }) {
  const reduce = useReducedMotion()
  const mv = useMotionValue(value)
  const text = useTransform(mv, (v) => fmt(v, decimals, true))
  useEffect(() => {
    if (reduce) {
      mv.set(value)
      return
    }
    const controls = animate(mv, value, { duration: 0.55, ease: easeOut })
    return () => controls.stop()
  }, [mv, value, reduce])
  return <motion.span aria-hidden="true">{text}</motion.span>
}

/** The latest value once it has settled, so a screen reader is not flooded while a slider moves. */
function useSettled<T>(value: T, ms = 450): T {
  const [settled, setSettled] = useState(value)
  useEffect(() => {
    const t = window.setTimeout(() => setSettled(value), ms)
    return () => window.clearTimeout(t)
  }, [value, ms])
  return settled
}

function VarField({
  v,
  range,
  value,
  raw,
  onValue,
  onRaw,
  onBlur,
}: {
  v: FormulaVar
  range: Range
  value: number
  raw: string
  onValue: (n: number) => void
  onRaw: (s: string) => void
  onBlur: () => void
}) {
  const id = useId()
  const pct = range.max > range.min ? ((Math.min(range.max, Math.max(range.min, value)) - range.min) / (range.max - range.min)) * 100 : 0
  const unit = v.unit ? ` ${v.unit}` : ''
  return (
    <div className="fx-field">
      <div className="fx-field__head">
        <label htmlFor={`${id}-n`} className="fx-field__label">
          {v.label}
          <var className="fx-var fx-var--sm">{v.name}</var>
        </label>
        <span className="fx-field__num">
          <input
            id={`${id}-n`}
            className="fx-number"
            type="number"
            inputMode="decimal"
            step="any"
            value={raw}
            onChange={(e) => onRaw(e.target.value)}
            onBlur={onBlur}
          />
          {v.unit && <span className="fx-unit">{v.unit}</span>}
        </span>
      </div>
      <input
        className="fx-range"
        type="range"
        aria-label={`${v.label}, slider`}
        aria-valuetext={`${fmt(value, 6)}${unit}`}
        min={range.min}
        max={range.max}
        step={range.step}
        value={Math.min(range.max, Math.max(range.min, value))}
        style={{ '--fx-pct': `${pct}%` } as CSSProperties}
        onChange={(e) => onValue(Number(e.target.value))}
      />
      <span className="fx-field__scale" aria-hidden="true">
        <span>{fmt(range.min, 6)}</span>
        <span>{fmt(range.max, 6)}</span>
      </span>
    </div>
  )
}

/* ---------- the tool ---------- */

type Outcome = { ok: true; value: number } | { ok: false; error: string }

function compile(tool: FormulaToolData): { formula: CompiledFormula } | { error: string } {
  try {
    const formula = compileFormula(tool.expr)
    const declared = new Set(tool.vars.map((v) => v.name))
    const missing = formula.variables.filter((n) => !declared.has(n))
    if (missing.length) return { error: `The formula uses ${missing.join(', ')}, which has no input here.` }
    return { formula }
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) }
  }
}

function run(formula: CompiledFormula, values: FormulaVars): Outcome {
  try {
    const value = formula.evaluate(values)
    if (!Number.isFinite(value)) return { ok: false, error: 'No result for these values (for example, a division by zero). Change an input.' }
    return { ok: true, value }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }
}

function sameValues(a: FormulaVars, b: FormulaVars): boolean {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)])
  for (const k of keys) if (a[k] !== b[k]) return false
  return true
}

const toRaw = (values: FormulaVars): Record<string, string> => Object.fromEntries(Object.entries(values).map(([k, n]) => [k, String(n)]))

/** Keyed on the tool, so moving to another formula starts from its own defaults. */
export default function FormulaTool({ tool }: { tool: FormulaToolData }) {
  return <Calculator key={tool.id} tool={tool} />
}

function Calculator({ tool }: { tool: FormulaToolData }) {
  const decimals = Math.max(0, Math.min(8, tool.result.decimals ?? 2))
  const varMap = useMemo(() => new Map(tool.vars.map((v) => [v.name, v])), [tool.vars])
  const ranges = useMemo(() => new Map(tool.vars.map((v) => [v.name, rangeOf(v)])), [tool.vars])
  const defaults = useMemo<FormulaVars>(() => Object.fromEntries(tool.vars.map((v) => [v.name, Number.isFinite(v.value) ? v.value : 0])), [tool.vars])
  const exampleVars = useMemo<FormulaVars | null>(() => {
    if (!tool.example) return null
    const picked: FormulaVars = { ...defaults }
    for (const [k, n] of Object.entries(tool.example.vars ?? {})) if (varMap.has(k) && typeof n === 'number' && Number.isFinite(n)) picked[k] = n
    return picked
  }, [tool.example, defaults, varMap])

  const [values, setValues] = useState<FormulaVars>(defaults)
  const [raw, setRaw] = useState<Record<string, string>>(() => toRaw(defaults))
  const tokens = useMemo(() => displayTokens(tool.expr), [tool.expr])
  const compiled = useMemo(() => compile(tool), [tool])
  const outcome: Outcome = 'formula' in compiled ? run(compiled.formula, values) : { ok: false, error: compiled.error }

  const expected = tool.example?.expected
  const matches =
    outcome.ok &&
    typeof expected === 'number' &&
    Math.abs(outcome.value - expected) <= (expected !== 0 ? Math.abs(expected) * 0.005 : 0.5 * 10 ** -decimals)
  const onExample = exampleVars ? sameValues(values, exampleVars) : false
  const onDefaults = sameValues(values, defaults)

  const resultText = outcome.ok ? `${fmt(outcome.value, decimals, true)}${tool.result.unit ? ` ${tool.result.unit}` : ''}` : ''
  const announce = useSettled(
    outcome.ok ? `${tool.result.label} is ${resultText}.${matches ? ' This matches the answer in the notes.' : ''}` : `No result: ${outcome.error}`,
  )

  const setOne = (name: string, n: number) => {
    setValues((prev) => ({ ...prev, [name]: n }))
    setRaw((prev) => ({ ...prev, [name]: String(n) }))
  }
  const typeOne = (name: string, s: string) => {
    setRaw((prev) => ({ ...prev, [name]: s }))
    const n = Number(s)
    if (s.trim() !== '' && Number.isFinite(n)) setValues((prev) => ({ ...prev, [name]: n }))
  }
  // An empty or half-typed box goes back to the value in use.
  const settleOne = (name: string) => setRaw((prev) => ({ ...prev, [name]: String(values[name] ?? 0) }))
  const loadAll = (next: FormulaVars) => {
    setValues(next)
    setRaw(toRaw(next))
  }

  const style = tool.unitId ? unitVars(tool.unitId) : undefined

  return (
    <div className="fx" style={style}>
      <section className="fx-card fx-inputs" aria-label="Inputs">
        <div className="fx-card__head">
          <h3 className="fx-h">Your numbers</h3>
          <p className="fx-sub">Drag a slider or type a value; the answer updates as you go.</p>
        </div>
        <div className="fx-fields">
          {tool.vars.map((v) => (
            <VarField
              key={v.name}
              v={v}
              range={ranges.get(v.name) ?? rangeOf(v)}
              value={values[v.name] ?? 0}
              raw={raw[v.name] ?? ''}
              onValue={(n) => setOne(v.name, n)}
              onRaw={(s) => typeOne(v.name, s)}
              onBlur={() => settleOne(v.name)}
            />
          ))}
        </div>
        <div className="fx-actions">
          {exampleVars && (
            <button type="button" className="btn btn-unit" onClick={() => loadAll(exampleVars)}>
              <BookOpen size={16} aria-hidden="true" />
              Load the notes' example
            </button>
          )}
          <button type="button" className="btn btn-ghost" onClick={() => loadAll(defaults)} disabled={onDefaults}>
            <RotateCcw size={16} aria-hidden="true" />
            Reset
          </button>
        </div>
      </section>

      <section className="fx-card fx-out" aria-label="Result">
        <div className="fx-result">
          <p className="fx-result__label">{tool.result.label}</p>
          {outcome.ok ? (
            <p className="fx-result__value">
              <AnimatedNumber value={outcome.value} decimals={decimals} />
              {tool.result.unit && <span className="fx-result__unit">{tool.result.unit}</span>}
            </p>
          ) : (
            <p className="fx-error">
              <CircleAlert size={18} aria-hidden="true" />
              <span>{outcome.error}</span>
            </p>
          )}
          <p className="sr-only" aria-live="polite">
            {announce}
          </p>
          <AnimatePresence initial={false}>
            {matches && (
              <motion.p
                key="match"
                className="fx-badge"
                initial={{ opacity: 0, scale: 0.8, y: 6 }}
                animate={{ opacity: 1, scale: 1, y: 0, transition: bouncy }}
                exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.15 } }}
              >
                <CircleCheck size={16} aria-hidden="true" />
                Matches the notes ✓
              </motion.p>
            )}
          </AnimatePresence>
        </div>

        <div className="fx-working" aria-label="Working">
          <p className="fx-line">
            <span className="fx-line__lhs">{tool.result.label}</span>
            <span className="fx-op">=</span>
            <Expression tokens={tokens} vars={varMap} />
          </p>
          <p className="fx-line">
            <span className="fx-op fx-op--lead">=</span>
            <Expression tokens={tokens} vars={varMap} values={values} />
          </p>
          {outcome.ok && (
            <p className="fx-line fx-line--result">
              <span className="fx-op fx-op--lead">=</span>
              <strong>{resultText}</strong>
            </p>
          )}
        </div>

        {tool.meaning && (
          <div className="fx-meaning">
            <p className="fx-meaning__label">What it means</p>
            <p>{tool.meaning}</p>
          </div>
        )}

        {tool.example && (
          <div className="fx-example">
            <p>
              <span className="fx-example__label">The notes' answer:</span> {fmt(tool.example.expected, Math.max(decimals, decimalsOf(tool.example.expected)))}
              {tool.result.unit ? ` ${tool.result.unit}` : ''}
              {exampleVars && !onExample && <span className="fx-example__hint"> (load the example to check it)</span>}
            </p>
            {tool.example.note && <p className="fx-example__note">{tool.example.note}</p>}
          </div>
        )}
      </section>
    </div>
  )
}
