import { useEffect, useId, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Blocks, ChartColumnDecreasing, FlaskConical, Pause, Play, Table2, TriangleAlert } from 'lucide-react'
import { easeOut } from '../../../lib/motion'
import { compact, inr, pct, rs } from './format'
import { HALF_RATE_DAYS, RATE_PRESETS, computeDepreciation, type DepInput, type DepYear } from './depMath'
import { AnimatedNumber, LeftOut, MoneyField, NotesCallout, Panel, RangeSlider, Switch, useDebounced, useElementWidth, useGeoTransition } from './ui'
import './dep.css'

/*
 * Written down value depreciation on a block of assets (Unit VI, s118 and s119). Arithmetic in depMath.ts.
 * The notes contain no worked WDV illustration, so the presets here are example figures, labelled as such.
 */

type RateId = (typeof RATE_PRESETS)[number]['id'] | 'custom'

interface Example {
  id: string
  title: string
  text: string
  rateId: RateId
  input: Omit<DepInput, 'ratePct'>
}

// Example figures only (not from the notes). The rate is the notes' 1962 Rules figure for plant and machinery (s118).
const EXAMPLES: Example[] = [
  {
    id: 'late',
    title: 'Machine bought late in the year',
    text: 'Rs. 10,00,000 machine, used for under 180 days in year 1.',
    rateId: 'plant',
    input: { openingWdv: 0, addition: 1000000, halfRate: true, saleYear: 0, saleAmount: 0, years: 5 },
  },
  {
    id: 'sale',
    title: 'A block with a sale',
    text: 'Block of Rs. 8,00,000 plus Rs. 2,00,000 added; Rs. 1,50,000 sold in year 3.',
    rateId: 'plant',
    input: { openingWdv: 800000, addition: 200000, halfRate: false, saleYear: 3, saleAmount: 150000, years: 5 },
  },
]

export default function DepreciationTool() {
  const first = EXAMPLES[0]
  const [rateId, setRateId] = useState<RateId>(first.rateId)
  const [customRate, setCustomRate] = useState(15)
  const [input, setInput] = useState<Omit<DepInput, 'ratePct'>>(first.input)
  const [example, setExample] = useState<string | null>(first.id)
  const [selected, setSelected] = useState(1)
  const [playing, setPlaying] = useState(false)

  const ratePct = rateId === 'custom' ? customRate : (RATE_PRESETS.find((p) => p.id === rateId)?.ratePct ?? 15)
  const years = computeDepreciation({ ...input, ratePct })
  const sel = years[Math.min(selected, years.length) - 1]
  const total = years.reduce((s, y) => s + y.depreciation, 0)
  const conflict = input.halfRate && input.addition > 0

  useEffect(() => {
    if (selected > input.years) setSelected(input.years)
  }, [input.years, selected])

  useEffect(() => {
    if (!playing) return
    const t = window.setInterval(() => {
      setSelected((s) => {
        if (s >= input.years) {
          setPlaying(false)
          return s
        }
        return s + 1
      })
    }, 1100)
    return () => window.clearInterval(t)
  }, [playing, input.years])

  function edit(patch: Partial<Omit<DepInput, 'ratePct'>>) {
    setExample(null)
    setInput((p) => {
      const next = { ...p, ...patch }
      // The notes don't say which part of the block a sale reduces when a half-rate addition is in the same year.
      if (next.saleYear > next.years) next.saleYear = next.years
      if (next.halfRate && next.addition > 0 && next.saleYear === 1) next.saleYear = next.years >= 2 ? 2 : 0
      return next
    })
  }

  function loadExample(ex: Example) {
    setRateId(ex.rateId)
    setInput(ex.input)
    setExample(ex.id)
    setSelected(1)
    setPlaying(false)
  }

  function togglePlay() {
    if (playing) {
      setPlaying(false)
      return
    }
    if (selected >= input.years) setSelected(1)
    setPlaying(true)
  }

  function pick(year: number) {
    setPlaying(false)
    setSelected(year)
  }

  const live = useDebounced(`Year ${sel.year}: depreciation ${rs(sel.depreciation)}, closing written down value ${rs(sel.closing)}.`)
  const rateGroup = useId()

  return (
    <div className="lab-calc lab-dep">
      <p className="sr-only" aria-live="polite">
        {live}
      </p>

      <div className="lab-calc__grid">
        <Panel title="The block" icon={<Blocks size={16} />}>
          <div className="lab-field">
            <span className="lab-field__label" id={rateGroup}>
              Block of assets and its rate
            </span>
            <div className="lab-dep-rates" role="group" aria-labelledby={rateGroup}>
              {RATE_PRESETS.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  className="chip"
                  aria-pressed={rateId === p.id}
                  onClick={() => {
                    setExample(null)
                    setRateId(p.id)
                  }}
                >
                  {p.label} · {pct(p.ratePct)}
                </button>
              ))}
              <button
                type="button"
                className="chip"
                aria-pressed={rateId === 'custom'}
                onClick={() => {
                  setExample(null)
                  setRateId('custom')
                }}
              >
                Custom
              </button>
            </div>
            <AnimatePresence initial={false}>
              {rateId === 'custom' && (
                <motion.label
                  className="lab-dep-custom"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.22, ease: easeOut }}
                >
                  <span>Rate (%)</span>
                  <input
                    className="input"
                    type="number"
                    inputMode="decimal"
                    min={0.5}
                    max={100}
                    step={0.5}
                    value={customRate}
                    onChange={(e) => {
                      const v = Number(e.currentTarget.value)
                      setExample(null)
                      setCustomRate(Number.isFinite(v) ? Math.min(100, Math.max(0, v)) : 0)
                    }}
                  />
                </motion.label>
              )}
            </AnimatePresence>
            <p className="lab-warn">
              <TriangleAlert size={16} aria-hidden="true" />
              Rates are prescribed in the Rules. These are the 1962 Rules rates quoted in your notes, which say to confirm the 2026 rates before use (s118).
            </p>
          </div>

          <div className="lab-fields">
            <MoneyField
              label="WDV of the block at the start of year 1"
              value={input.openingWdv}
              onChange={(n) => edit({ openingWdv: n })}
              hint="Last year’s figure less the depreciation allowed for it (s41(1)(c), s118)."
            />
            <MoneyField
              label="Assets added in year 1 (actual cost)"
              value={input.addition}
              onChange={(n) => edit({ addition: n })}
              hint="Actual cost is reduced by subsidies and GST input credit; cash payments above Rs. 10,000 a day are excluded (s39, s118)."
            />
            <Switch
              checked={input.halfRate}
              onChange={(v) => edit({ halfRate: v })}
              label={`Put to use for less than ${HALF_RATE_DAYS} days in year 1`}
              hint="Only 50% of the rate on that addition, in that year (s33(4), s119)."
            />
            <MoneyField
              label="Sale price and scrap value of assets sold (optional)"
              value={input.saleAmount}
              onChange={(n) => edit({ saleAmount: n, saleYear: n > 0 && input.saleYear === 0 ? (conflict ? 2 : 1) : input.saleYear })}
              hint="Reduces the block, but never below nil (s118)."
            />
            {input.saleAmount > 0 && (
              <div className="lab-field">
                <span className="lab-field__label">Sold in</span>
                <div className="lab-dep-years" role="group" aria-label="Year of sale">
                  {Array.from({ length: input.years }, (_, i) => i + 1).map((y) => (
                    <button
                      key={y}
                      type="button"
                      className="chip"
                      aria-pressed={input.saleYear === y}
                      disabled={y === 1 && conflict}
                      onClick={() => edit({ saleYear: y })}
                    >
                      Year {y}
                    </button>
                  ))}
                </div>
                {conflict && (
                  <p className="lab-field__hint">
                    Not year 1 here: your notes don’t say which part of the block a sale reduces when a half-rate addition is in the same year.
                  </p>
                )}
              </div>
            )}
            <div className="lab-field">
              <span className="lab-field__label">Years to show: {input.years}</span>
              <RangeSlider label="Years to show" value={input.years} min={2} max={10} step={1} onChange={(n) => edit({ years: n })} format={(n) => `${n} years`} />
            </div>
          </div>

          <div className="lab-preset">
            <div className="lab-preset__head">
              <FlaskConical size={18} aria-hidden="true" />
              Try an example
            </div>
            <p className="lab-preset__text">Example figures, not from your notes: the notes have no worked WDV illustration.</p>
            <div className="lab-preset__actions">
              {EXAMPLES.map((ex) => (
                <button
                  key={ex.id}
                  type="button"
                  className={`btn btn-sm${example === ex.id ? ' btn-unit' : ''}`}
                  aria-pressed={example === ex.id}
                  title={ex.text}
                  onClick={() => loadExample(ex)}
                >
                  {ex.title}
                </button>
              ))}
            </div>
          </div>
        </Panel>

        <Panel
          title="Year by year"
          icon={<ChartColumnDecreasing size={16} />}
          aside={
            <button type="button" className="btn btn-sm" onClick={togglePlay} aria-pressed={playing}>
              {playing ? <Pause size={15} aria-hidden="true" /> : <Play size={15} aria-hidden="true" />}
              {playing ? 'Pause' : 'Play the years'}
            </button>
          }
        >
          <div className="lab-dep-top">
            <div className="lab-hero">
              <span className="lab-hero__label">Depreciation, year {sel.year}</span>
              <AnimatedNumber className="lab-hero__value" value={sel.depreciation} />
              <span className="lab-hero__sub">
                Closing WDV {rs(sel.closing)} · rate {pct(ratePct)}
                {sel.halfPortion > 0 ? `, ${pct(ratePct / 2)} on the new asset` : ''}
              </span>
            </div>
            <div className="lab-dep-yearpick" role="group" aria-label="Choose a year">
              {years.map((y) => (
                <button key={y.year} type="button" aria-pressed={sel.year === y.year} aria-label={`Year ${y.year}`} onClick={() => pick(y.year)}>
                  {y.year}
                </button>
              ))}
            </div>
          </div>

          <DepChart years={years} selected={sel.year} onSelect={pick} />

          <Formula y={sel} ratePct={ratePct} />
        </Panel>
      </div>

      <div className="lab-calc__grid lab-calc__grid--even">
        <Panel title="The schedule" icon={<Table2 size={16} />}>
          <DepTable years={years} selected={sel.year} onSelect={pick} />
          <p className="lab-sub">
            Written off over {years.length} years: {rs(total)}.
            {ratePct < 100 ? ' On the WDV method the block never quite reaches nil, because each year takes the rate of what is left.' : ''} Depreciation is
            rounded to the nearest rupee.
          </p>
        </Panel>
        <div className="lab-dep-side">
          <NotesCallout slideIds={['s118', 's119']}>
            <p>
              <strong>Block of assets:</strong> depreciation is charged at the prescribed rate on the written down value of each block, a class of assets
              carrying the same rate (sections 2(17) and 33(3)(a)).
            </p>
            <p>
              <strong>Written down value (section 41(1)(c)):</strong> the previous year’s figure less the depreciation allowed for that year, plus the actual
              cost of assets added, less the sale price and scrap value of assets sold, discarded or destroyed (not exceeding the amount so far computed).
            </p>
            <p>
              <strong>Half rate:</strong> only 50% of the rate if the asset is acquired and used for less than 180 days in the year (section 33(4)).{' '}
              <strong>Compulsory:</strong> depreciation applies whether or not claimed (section 33(7)).
            </p>
          </NotesCallout>
          <NotesCallout slideIds={['s129']} title="Where it fits">
            <p>
              In the notes’ worked illustration of business income, book depreciation of Rs. 3,00,000 is added back to the net profit and tax depreciation
              under section 33 of Rs. 3,60,000 is deducted instead.
            </p>
          </NotesCallout>
          <LeftOut
            note="read these in your notes"
            items={[
              <>Additional depreciation for new plant and machinery: 20%, or 10% and 10% if used for under 180 days (s33(8), (9), s119).</>,
              <>Power undertakings, which may claim depreciation on actual cost (s33(2), s119).</>,
              <>Unabsorbed depreciation, carried forward without time limit (s33(11), s119).</>,
              <>A sale price above the block’s WDV: the notes only say the reduction cannot exceed it (s118).</>,
            ]}
          />
        </div>
      </div>
    </div>
  )
}

/* ---------- chart ---------- */

const DH = 250
const DPAD = { l: 46, r: 10, t: 30, b: 34 }

function niceTicks(max: number, count = 4): number[] {
  if (max <= 0) return [0, 1]
  const raw = max / count
  const mag = Math.pow(10, Math.floor(Math.log10(raw)))
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s * count >= max) ?? 10 * mag
  const ticks: number[] = []
  for (let v = 0; v < max + step * 0.999; v += step) ticks.push(v)
  return ticks
}

function DepChart({ years, selected, onSelect }: { years: DepYear[]; selected: number; onSelect: (y: number) => void }) {
  const [ref, width] = useElementWidth<HTMLDivElement>()
  const geo = useGeoTransition()
  const [hover, setHover] = useState<number | null>(null)

  const plotW = Math.max(0, width - DPAD.l - DPAD.r)
  const plotH = DH - DPAD.t - DPAD.b
  const ticks = niceTicks(Math.max(1, ...years.map((y) => y.base)))
  const top = ticks[ticks.length - 1]
  const yOf = (v: number) => DPAD.t + plotH * (1 - v / top)
  const zero = yOf(0)
  const band = years.length ? plotW / years.length : 0
  const barW = Math.min(30, band * 0.52)
  const short = band < 58

  const hot = hover ?? selected
  const hy = years[hot - 1]
  const hx = DPAD.l + band * (hot - 0.5)
  const tipW = 200
  const tipLeft = Math.min(Math.max(hx - tipW / 2, 0), Math.max(0, width - tipW))

  return (
    <div className="lab-chart-block">
      <div ref={ref} className="lab-chart" style={{ height: DH }} onPointerLeave={() => setHover(null)}>
        {width > 0 && (
          <svg width={width} height={DH} role="img" aria-label={`Written down value over ${years.length} years: ${years.map((y) => `year ${y.year} depreciation ${rs(y.depreciation)}, closing ${rs(y.closing)}`).join('; ')}.`}>
            {ticks.map((t) => (
              <g key={t}>
                <line className="lab-dep__grid" x1={DPAD.l} x2={width - DPAD.r} y1={yOf(t)} y2={yOf(t)} />
                <text className="lab-dep__ytick" x={DPAD.l - 8} y={yOf(t) + 4} textAnchor="end">
                  {t === 0 ? '0' : compact(t)}
                </text>
              </g>
            ))}
            {years.map((y, i) => {
              const cx = DPAD.l + band * (i + 0.5)
              const x = cx - barW / 2
              const closeTop = yOf(y.closing)
              const baseTop = yOf(y.base)
              const depH = Math.max(0, closeTop - baseTop - (y.depreciation > 0 && y.closing > 0 ? 2 : 0))
              const isSel = y.year === selected
              const events = [y.added > 0 ? '+ add' : '', y.sale > 0 ? '− sale' : ''].filter(Boolean).join(' ')
              return (
                <g
                  key={y.year}
                  className={`lab-dep__col${isSel ? ' is-sel' : ''}${hover === y.year ? ' is-hover' : ''}`}
                  onPointerEnter={() => setHover(y.year)}
                  onClick={() => onSelect(y.year)}
                >
                  <rect className="lab-dep__hit" x={cx - band / 2} y={DPAD.t - 24} width={band} height={plotH + 24 + DPAD.b} />
                  <motion.rect
                    className="lab-dep__close"
                    x={x}
                    width={barW}
                    rx={3}
                    initial={{ y: zero, height: 0 }}
                    animate={{ y: closeTop, height: Math.max(0, zero - closeTop) }}
                    transition={geo}
                  />
                  <motion.rect
                    className="lab-dep__dep"
                    x={x}
                    width={barW}
                    rx={4}
                    initial={{ y: zero, height: 0 }}
                    animate={{ y: baseTop, height: depH }}
                    transition={geo}
                  />
                  {isSel && (
                    <motion.text className="lab-dep__cap" x={cx} textAnchor="middle" initial={false} animate={{ y: baseTop - 8 }} transition={geo}>
                      {compact(y.depreciation)}
                    </motion.text>
                  )}
                  <text className="lab-dep__xlabel" x={cx} y={zero + 17} textAnchor="middle">
                    {short ? `Y${y.year}` : `Year ${y.year}`}
                  </text>
                  {events && !short && (
                    <text className="lab-dep__event" x={cx} y={zero + 30} textAnchor="middle">
                      {events}
                    </text>
                  )}
                </g>
              )
            })}
          </svg>
        )}
        <AnimatePresence>
          {hover !== null && hy && (
            <motion.div
              key="tip"
              className="lab-tip"
              style={{ width: tipW, left: tipLeft, top: 0 }}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
            >
              <b>Year {hy.year}</b>
              WDV for the year {rs(hy.base)}
              <br />
              Depreciation {rs(hy.depreciation)} · closing {rs(hy.closing)}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      <div className="lab-legend">
        <span>
          <span className="lab-legend__sw lab-dep__sw--close" aria-hidden="true" />
          Closing WDV (carried to next year)
        </span>
        <span>
          <span className="lab-legend__sw lab-dep__sw--dep" aria-hidden="true" />
          Depreciation for the year
        </span>
      </div>
    </div>
  )
}

/* ---------- formula strip ---------- */

function Term({ label, value, tone }: { label: string; value: number; tone?: 'strong' | 'accent' }) {
  return (
    <div className={`lab-dep-term${tone ? ` lab-dep-term--${tone}` : ''}`}>
      <span className="lab-dep-term__label">{label}</span>
      <AnimatedNumber className="lab-dep-term__value" value={value} />
    </div>
  )
}

function Formula({ y, ratePct }: { y: DepYear; ratePct: number }) {
  const parts: string[] = []
  if (y.fullPortion > 0 || y.halfPortion === 0) parts.push(`${pct(ratePct)} of ${rs(y.fullPortion)}`)
  if (y.halfPortion > 0) parts.push(`${pct(ratePct / 2)} of ${rs(y.halfPortion)} (half rate, s33(4))`)
  return (
    <div className="lab-dep-formula">
      <div className="lab-dep-formula__row">
        <Term label="Opening WDV" value={y.opening} />
        <span className="lab-dep-op" aria-hidden="true">
          +
        </span>
        <Term label="Added" value={y.added} />
        <span className="lab-dep-op" aria-hidden="true">
          −
        </span>
        <Term label={y.saleLimited ? 'Sold (limited)' : 'Sold'} value={y.sale} />
        <span className="lab-dep-op" aria-hidden="true">
          =
        </span>
        <Term label="WDV for the year" value={y.base} tone="strong" />
      </div>
      <p className="lab-dep-formula__line">
        Depreciation: {parts.join(' + ')} = <b>{rs(y.depreciation)}</b>. Closing WDV: {rs(y.base)} − {rs(y.depreciation)} = <b>{rs(y.closing)}</b>.
      </p>
      {y.saleLimited && (
        <p className="lab-warn">
          <TriangleAlert size={16} aria-hidden="true" />
          The sale price ({rs(y.saleEntered)}) is more than the block, so the reduction stops at {rs(y.sale)} and the block is nil. Your notes don’t cover the
          excess.
        </p>
      )}
    </div>
  )
}

/* ---------- table ---------- */

function DepTable({ years, selected, onSelect }: { years: DepYear[]; selected: number; onSelect: (y: number) => void }) {
  return (
    <table className="lab-table lab-dep-table">
      <caption className="sr-only">Depreciation schedule, written down value method</caption>
      <thead>
        <tr>
          <th scope="col">Year</th>
          <th scope="col" className="num">
            WDV for the year
          </th>
          <th scope="col" className="num">
            Depreciation
          </th>
          <th scope="col" className="num">
            Closing
          </th>
        </tr>
      </thead>
      <tbody>
        {years.map((y) => (
          <tr key={y.year} className={y.year === selected ? 'is-hot' : ''} onClick={() => onSelect(y.year)}>
            <td>
              <b className="lab-dep-table__year">{y.year}</b>
              {y.added > 0 && <span className="lab-dep-table__note">+ {inr(y.added)} added{y.halfPortion > 0 ? ', half rate' : ''}</span>}
              {y.sale > 0 && <span className="lab-dep-table__note">− {inr(y.sale)} sold</span>}
            </td>
            <td className="num">{inr(y.base)}</td>
            <td className="num">{inr(y.depreciation)}</td>
            <td className="num">{inr(y.closing)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
