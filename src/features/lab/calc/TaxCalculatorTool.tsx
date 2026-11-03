import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react'
import { AnimatePresence, animate, motion, useReducedMotion } from 'framer-motion'
import { BookOpenCheck, Footprints, Lightbulb, ListOrdered, MoveHorizontal, Pause, Play, Table2, WandSparkles } from 'lucide-react'
import { compact, inr, pct, rs } from './format'
import {
  MEERA,
  REBATE_CAP,
  REBATE_INCOME_LIMIT,
  SLABS,
  STANDARD_DEDUCTION_NEW,
  computeTax,
  grossForTotalIncome,
  matchesMeera,
  reliefEndsAt,
  salaryNilTaxUpTo,
  slabTaxOn,
  type IncomeMode,
  type Slab,
  type TaxResult,
} from './taxMath'
import {
  AnimatedNumber,
  LeftOut,
  MatchBadge,
  MoneyField,
  NotesCallout,
  Panel,
  RangeSlider,
  Segmented,
  Step,
  Switch,
  useDebounced,
  useElementWidth,
  useGeoTransition,
  useSvgId,
} from './ui'
import './tax.css'

/*
 * New regime tax calculator (Unit IV, s96; rates and rebate s69 / appB; standard deduction s95).
 * All arithmetic lives in taxMath.ts and is machine-checked against the notes' illustration (Meera, s96).
 */

const SLIDER_MAX = 3000000
const SLIDER_STEP = 5000
/** Chart band only: the open 30% slab is drawn from Rs. 24 lakh to Rs. 28 lakh, with an overflow marker beyond. */
const DISPLAY_MAX = 2800000
const LAKH = 100000

function slabRangeLong(s: Slab): string {
  if (s.from === 0) return `Up to ${inr(s.to ?? 0)}`
  if (s.to === null) return `Above ${inr(s.from)}`
  return `${inr(s.from + 1)} – ${inr(s.to)}`
}

function slabRangeShort(s: Slab): string {
  if (s.from === 0) return `Up to ${s.to! / LAKH}L`
  if (s.to === null) return `Above ${s.from / LAKH}L`
  return `${s.from / LAKH}L – ${s.to / LAKH}L`
}

function rateLabel(s: Slab): string {
  return s.ratePct === 0 ? 'Nil' : pct(s.ratePct)
}

/** Share of a slab's chart band that is filled (the open slab uses its 4 lakh display band). */
function slabFill(s: Slab, amount: number): number {
  const width = (s.to ?? s.from + 4 * LAKH) - s.from
  return Math.max(0, Math.min(1, amount / width))
}

export default function TaxCalculatorTool() {
  const reduce = useReducedMotion()
  const [mode, setMode] = useState<IncomeMode>('salary')
  const [amount, setAmount] = useState<number>(MEERA.grossSalary)
  const [resident, setResident] = useState(true)
  /** True while the notes' illustration is loaded and untouched. */
  const [preset, setPreset] = useState(true)
  const [hot, setHot] = useState<number | null>(null)
  const [playing, setPlaying] = useState(false)

  const r = useMemo(() => computeTax({ mode, amount, residentIndividual: resident }), [mode, amount, resident])
  const meeraOk = preset && matchesMeera(r)

  // Sweep total income from 0 to the top of the chart ("play the stairs").
  const modeRef = useRef(mode)
  modeRef.current = mode
  useEffect(() => {
    if (!playing) return
    if (reduce) {
      setPlaying(false)
      return
    }
    const controls = animate(0, DISPLAY_MAX, {
      duration: 5,
      ease: 'linear',
      onUpdate: (v) => {
        const ti = Math.round(v / SLIDER_STEP) * SLIDER_STEP
        setAmount(modeRef.current === 'salary' ? grossForTotalIncome(ti) : ti)
      },
      onComplete: () => setPlaying(false),
    })
    return () => controls.stop()
  }, [playing, reduce])

  function edit(next: { mode?: IncomeMode; amount?: number; resident?: boolean }) {
    setPreset(false)
    setPlaying(false)
    if (next.mode !== undefined) setMode(next.mode)
    if (next.amount !== undefined) setAmount(Math.max(0, next.amount))
    if (next.resident !== undefined) setResident(next.resident)
  }

  function changeMode(m: IncomeMode) {
    if (m === mode) return
    // Keep the same total income when switching, so the chart does not jump.
    edit({ mode: m, amount: m === 'total' ? r.totalIncome : grossForTotalIncome(r.totalIncome) })
  }

  function setTotalIncome(ti: number) {
    edit({ amount: mode === 'salary' ? grossForTotalIncome(ti) : ti })
  }

  function togglePlay() {
    if (playing) {
      setPlaying(false)
      return
    }
    setPreset(false)
    setPlaying(true)
  }

  function loadMeera() {
    setPlaying(false)
    setMode('salary')
    setAmount(MEERA.grossSalary)
    setResident(true)
    setPreset(true)
  }

  const live = useDebounced(
    `Total income ${rs(r.totalIncome)}. Tax on slabs ${rs(r.slabTax)}. Rebate ${rs(r.rebate)}. ${r.rebateKind === 'not-applied' ? 'Tax before any rebate' : 'Tax payable'} ${rs(r.tax)}, before cess.`,
  )

  return (
    <div className="lab-calc lab-tax">
      <p className="sr-only" aria-live="polite">
        {live}
      </p>

      <div className="lab-calc__grid">
        <Panel title="Your figures" icon={<WandSparkles size={16} />}>
          <Segmented
            label="Income entered as"
            value={mode}
            onChange={changeMode}
            options={[
              { value: 'salary', label: 'Gross salary' },
              { value: 'total', label: 'Total income' },
            ]}
          />
          <div className="lab-fields">
            <MoneyField
              size="lg"
              label={mode === 'salary' ? 'Gross salary for the tax year' : 'Total income for the tax year'}
              value={amount}
              onChange={(n) => edit({ amount: n })}
              hint={
                mode === 'salary'
                  ? 'Under the new regime house rent allowance is fully taxable, so include it (s96).'
                  : 'Income already computed under every head; no standard deduction is taken.'
              }
            />
            <RangeSlider
              label={mode === 'salary' ? 'Gross salary' : 'Total income'}
              value={amount}
              min={0}
              max={SLIDER_MAX}
              step={SLIDER_STEP}
              onChange={(n) => edit({ amount: n })}
              marks={[
                [0, '0'],
                [1000000, '10L'],
                [2000000, '20L'],
                [SLIDER_MAX, '30L'],
              ]}
            />
          </div>
          <Switch
            checked={resident}
            onChange={(v) => edit({ resident: v })}
            label="Resident individual"
            hint="Your notes give the Rs. 60,000 rebate to a resident individual (s69). For anyone else they don’t settle which rebate applies, so none is applied when this is off."
          />
          <div className="lab-preset">
            <div className="lab-preset__head">
              <BookOpenCheck size={18} aria-hidden="true" />
              Notes’ illustration: Meera (s96)
            </div>
            <p className="lab-preset__text">
              Basic {rs(MEERA.basic)}, dearness allowance {rs(MEERA.dearnessAllowance)} and house rent allowance {rs(MEERA.houseRentAllowance)}, private
              company in Pune, new regime.
            </p>
            <div className="lab-preset__actions">
              <AnimatePresence mode="wait" initial={false}>
                {meeraOk ? (
                  <MatchBadge key="ok">Matches the notes: tax {rs(MEERA.expected.tax)}</MatchBadge>
                ) : (
                  <motion.button
                    key="load"
                    type="button"
                    className="btn btn-unit btn-sm"
                    onClick={loadMeera}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                  >
                    <BookOpenCheck size={15} aria-hidden="true" /> Load the notes’ illustration
                  </motion.button>
                )}
              </AnimatePresence>
            </div>
          </div>
        </Panel>

        <Panel
          title="Tax under section 202"
          icon={<Footprints size={16} />}
          aside={
            reduce ? undefined : (
              <button type="button" className="btn btn-sm" onClick={togglePlay} aria-pressed={playing}>
                {playing ? <Pause size={15} aria-hidden="true" /> : <Play size={15} aria-hidden="true" />}
                {playing ? 'Pause' : 'Play the stairs'}
              </button>
            )
          }
        >
          <div className="lab-tax-result">
            <div className="lab-tax-result__top">
              <div className="lab-hero">
                <span className="lab-hero__label lab-tax-paylabel">
                  <span className="lab-bill__sw lab-bill__sw--pay" aria-hidden="true" />
                  {r.rebateKind === 'not-applied' ? 'Tax before any rebate' : 'Tax payable'}
                </span>
                <AnimatedNumber className="lab-hero__value" value={r.tax} />
                <span className="lab-hero__sub">plus cess and any surcharge under the Finance Act</span>
              </div>
            </div>
            <TaxBill r={r} />
          </div>
          <Staircase r={r} resident={resident} hot={hot} setHot={setHot} onScrub={setTotalIncome} />
        </Panel>
      </div>

      <div className="lab-calc__grid lab-calc__grid--even">
        <Panel title="Exam-style working" icon={<ListOrdered size={16} />}>
          <Working r={r} preset={preset} />
        </Panel>
        <Panel title="Slab by slab" icon={<Table2 size={16} />}>
          <SlabTable r={r} hot={hot} setHot={setHot} />
        </Panel>
      </div>

      <Panel title="Memory hooks" icon={<Lightbulb size={16} />}>
        <Hooks
          onPlay={() => {
            if (!playing) togglePlay()
          }}
          canPlay={!reduce}
          onTry={(m, a) => edit({ mode: m, amount: a, resident: true })}
        />
      </Panel>

      <div className="lab-calc__grid lab-calc__grid--even">
        <NotesCallout slideIds={['s96', 's69', 's95']}>
          <p>
            <strong>Rates (section 202(1)):</strong> nil up to Rs. 4,00,000; 5% from Rs. 4,00,001 to Rs. 8,00,000; 10% to Rs. 12,00,000; 15% to Rs.
            16,00,000; 20% to Rs. 20,00,000; 25% to Rs. 24,00,000; and 30% above that.
          </p>
          <p>
            <strong>Standard deduction (section 19):</strong> Rs. 75,000 or the salary, whichever is less, under the new regime.
          </p>
          <p>
            <strong>Rebate (section 156):</strong> a resident individual with total income up to Rs. 12,00,000 gets a rebate of the full tax or Rs. 60,000,
            whichever is less, with marginal relief just above that level. Marginal relief under section 156(2)(b) limits the tax to the income above Rs.
            12,00,000.
          </p>
          <p>
            <strong>If Meera opts out:</strong> Rs. 2,60,000 of the allowance is exempt, gross salary is Rs. 10,40,000, and after the Rs. 50,000 standard
            deduction and Rs. 2,500 tax on employment, income from salary is Rs. 9,87,500. Tax then follows the Finance Act rates.
          </p>
        </NotesCallout>
        <LeftOut
          items={[
            <>Cess and surcharge: imposed by the Finance Act (s69); your notes give no rate.</>,
            <>Rounding off total income under section 516 (s81): the rule isn’t given.</>,
            <>Tax for someone who opts out: the Finance Act rates aren’t in your notes (s96), so neither that tax nor its Rs. 12,500 rebate (s69) is worked out.</>,
            <>A rebate for anyone other than a resident individual: s69 and appendix B don’t settle it.</>,
            <>Chapter VIII deductions: most are not available under the new regime (s78).</>,
          ]}
        />
      </div>
    </div>
  )
}

/* ---------- result bar ---------- */

function TaxBill({ r }: { r: TaxResult }) {
  const [ref, width] = useElementWidth<HTMLDivElement>()
  const geo = useGeoTransition()
  const clip = useSvgId('lab-bill')
  const h = 14
  const total = r.slabTax
  const payW = total > 0 ? (r.tax / total) * width : 0
  const gap = r.tax > 0 && r.rebate > 0 ? 1 : 0
  return (
    <div className="lab-bill">
      <div ref={ref} role="img" aria-label={`Tax on slabs ${rs(total)}: rebate ${rs(r.rebate)}, payable ${rs(r.tax)}.`}>
        {width > 0 && (
          <svg className="lab-bill__svg" width={width} height={h} aria-hidden="true">
            <defs>
              <clipPath id={clip}>
                <rect x={0} y={0} width={width} height={h} rx={h / 2} />
              </clipPath>
            </defs>
            <g clipPath={`url(#${clip})`}>
              <rect className="lab-bill__track" x={0} y={0} width={width} height={h} />
              <motion.rect
                className="lab-bill__pay"
                y={0}
                height={h}
                initial={{ x: 0, width: 0 }}
                animate={{ x: 0, width: Math.max(0, payW - gap) }}
                transition={geo}
              />
              <motion.rect
                className="lab-bill__rebate"
                y={0}
                height={h}
                initial={{ x: width, width: 0 }}
                animate={{ x: Math.min(width, payW + gap), width: total > 0 ? Math.max(0, width - payW - gap) : 0 }}
                transition={geo}
              />
            </g>
          </svg>
        )}
      </div>
      <div className="lab-stats lab-bill__stats">
        <div className="lab-stat">
          <span className="lab-stat__label">Total income</span>
          <AnimatedNumber className="lab-stat__value" value={r.totalIncome} />
        </div>
        <div className="lab-stat">
          <span className="lab-stat__label">
            <span className="lab-bill__sw lab-bill__sw--slab" aria-hidden="true" />
            Tax on slabs
          </span>
          <AnimatedNumber className="lab-stat__value" value={r.slabTax} />
        </div>
        <div className="lab-stat">
          <span className="lab-stat__label">
            <span className="lab-bill__sw lab-bill__sw--rebate" aria-hidden="true" />
            Rebate (s156)
          </span>
          <AnimatedNumber className="lab-stat__value" value={r.rebate} />
        </div>
      </div>
    </div>
  )
}

/* ---------- staircase chart ---------- */

const CH = 236
const PAD = { l: 6, r: 12, t: 44, b: 30 }

function Staircase({
  r,
  resident,
  hot,
  setHot,
  onScrub,
}: {
  r: TaxResult
  resident: boolean
  hot: number | null
  setHot: (i: number | null) => void
  onScrub: (totalIncome: number) => void
}) {
  const [ref, width] = useElementWidth<HTMLDivElement>()
  const geo = useGeoTransition()
  const clip = useSvgId('lab-stair')
  const scrubbing = useRef(false)
  const ti = r.totalIncome

  const plotW = Math.max(0, width - PAD.l - PAD.r)
  const plotH = CH - PAD.t - PAD.b
  const base = PAD.t + plotH
  const xOf = (v: number) => PAD.l + (Math.min(Math.max(v, 0), DISPLAY_MAX) / DISPLAY_MAX) * plotW
  const yOf = (ratePct: number) => PAD.t + plotH * (1 - ratePct / 30)

  const slabs = SLABS.map((s, i) => {
    const last = i === SLABS.length - 1
    const x0 = xOf(s.from) + (i === 0 ? 0 : 1)
    const x1 = xOf(s.to ?? DISPLAY_MAX) - (last ? 0 : 1)
    const top = s.ratePct === 0 ? base - 4 : yOf(s.ratePct)
    const on = ti > s.from
    const fillW = on ? Math.max(0, Math.min(xOf(ti), x1) - x0) : 0
    return { s, i, x0, x1, top, on, fillW }
  })

  const markerX = xOf(ti)
  const current = SLABS.findIndex((s) => ti <= (s.to ?? Infinity))
  const currentSlab = SLABS[Math.max(0, current)]
  const dotY = ti <= 0 ? base : currentSlab.ratePct === 0 ? base - 4 : yOf(currentSlab.ratePct)
  const over = ti > DISPLAY_MAX
  const bubbleText = `${rs(ti)}${over ? ' ›' : ''}`
  const bubbleW = bubbleText.length * 7 + 18
  const bubbleX = Math.min(Math.max(markerX - bubbleW / 2, 0), Math.max(0, width - bubbleW))
  const reliefEnd = reliefEndsAt()

  function valueAt(clientX: number): number {
    const el = ref.current
    if (!el || plotW <= 0) return ti
    const px = clientX - el.getBoundingClientRect().left - PAD.l
    const v = (Math.min(Math.max(px, 0), plotW) / plotW) * DISPLAY_MAX
    return Math.round(v / SLIDER_STEP) * SLIDER_STEP
  }
  function slabAt(v: number): number {
    return Math.max(
      0,
      SLABS.findIndex((s) => v <= (s.to ?? Infinity)),
    )
  }
  /*
   * Mouse: press and drag scrubs at once. Touch and pen: a vertical swipe must still scroll the page, so nothing
   * changes until the finger has clearly moved sideways (> 8px and more than vertically); a tap sets the value once.
   * If the browser takes the gesture for scrolling it fires pointercancel, and nothing has been changed.
   */
  const touch = useRef<{ id: number; x: number; y: number; active: boolean } | null>(null)

  function onDown(e: ReactPointerEvent<SVGSVGElement>) {
    if (e.pointerType !== 'mouse') {
      touch.current = { id: e.pointerId, x: e.clientX, y: e.clientY, active: false }
      return
    }
    scrubbing.current = true
    e.currentTarget.setPointerCapture(e.pointerId)
    const v = valueAt(e.clientX)
    setHot(slabAt(v))
    onScrub(v)
  }
  function onMove(e: ReactPointerEvent<SVGSVGElement>) {
    const v = valueAt(e.clientX)
    if (e.pointerType === 'mouse') {
      setHot(slabAt(v))
      if (scrubbing.current) onScrub(v)
      return
    }
    const t = touch.current
    if (!t || t.id !== e.pointerId) return
    if (!t.active) {
      const dx = Math.abs(e.clientX - t.x)
      const dy = Math.abs(e.clientY - t.y)
      if (dx <= 8 || dx <= dy) return
      t.active = true
      e.currentTarget.setPointerCapture(e.pointerId)
    }
    setHot(slabAt(v))
    onScrub(v)
  }
  function onUp(e: ReactPointerEvent<SVGSVGElement>) {
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId)
    if (e.pointerType === 'mouse') {
      scrubbing.current = false
      return
    }
    const t = touch.current
    touch.current = null
    if (t && t.id === e.pointerId && !t.active && Math.abs(e.clientX - t.x) <= 8 && Math.abs(e.clientY - t.y) <= 8) onScrub(valueAt(e.clientX))
    setHot(null)
  }
  function onCancel(e: ReactPointerEvent<SVGSVGElement>) {
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId)
    touch.current = null
    scrubbing.current = false
    setHot(null)
  }

  const hotSlab = hot !== null ? slabs[hot] : null
  const hotLine = hot !== null ? r.lines[hot] : null
  const tipW = 200
  const tipLeft = hotSlab ? Math.min(Math.max((hotSlab.x0 + hotSlab.x1) / 2 - tipW / 2, 0), Math.max(0, width - tipW)) : 0

  const label = `Staircase of slab rates. Total income ${rs(ti)} reaches the ${rateLabel(currentSlab)} slab; tax on slabs ${rs(r.slabTax)}.`

  return (
    <div className="lab-chart-block">
      <div ref={ref} className="lab-chart" style={{ height: CH }}>
        {width > 0 && (
          <svg
            className="lab-stair"
            width={width}
            height={CH}
            role="img"
            aria-label={label}
            onPointerDown={onDown}
            onPointerMove={onMove}
            onPointerUp={onUp}
            onPointerCancel={onCancel}
            onPointerLeave={() => {
              if (!scrubbing.current && !touch.current?.active) setHot(null)
            }}
          >
            <defs>
              <clipPath id={clip}>
                <rect x={0} y={0} width={width} height={base} />
              </clipPath>
            </defs>

            <g clipPath={`url(#${clip})`}>
              {slabs.map((sl) => (
                <g key={sl.i} className={`lab-stair__slab${sl.on ? ' is-on' : ''}${hot === sl.i ? ' is-hot' : ''}`}>
                  <rect className="lab-stair__track" x={sl.x0} y={sl.top} width={Math.max(0, sl.x1 - sl.x0)} height={base - sl.top + 6} rx={4} />
                  <motion.rect
                    className="lab-stair__fill"
                    x={sl.x0}
                    y={sl.top}
                    height={base - sl.top + 6}
                    rx={4}
                    initial={{ width: 0 }}
                    animate={{ width: sl.fillW }}
                    transition={geo}
                  />
                  {sl.s.ratePct > 0 && (
                    <motion.rect className="lab-stair__cap" x={sl.x0} y={sl.top} height={2.5} initial={{ width: 0 }} animate={{ width: sl.fillW }} transition={geo} />
                  )}
                </g>
              ))}
            </g>

            {slabs.map((sl) => (
              <g key={`l${sl.i}`} className={`lab-stair__slab${sl.on ? ' is-on' : ''}`}>
                <text className="lab-stair__rate" x={(sl.x0 + sl.x1) / 2} y={sl.top - 8}>
                  {rateLabel(sl.s)}
                </text>
              </g>
            ))}

            <line className="lab-stair__base" x1={PAD.l} x2={width - PAD.r} y1={base + 0.5} y2={base + 0.5} />
            {SLABS.map((s) => (
              <text key={`t${s.from}`} className="lab-stair__tick" x={xOf(s.from)} y={base + 18} textAnchor={s.from === 0 ? 'start' : 'middle'}>
                {s.from === 0 ? '0' : `${s.from / LAKH}L`}
              </text>
            ))}
            <text className="lab-stair__more" x={width - PAD.r} y={base + 18} textAnchor="end">
              ›
            </text>

            {/* marginal relief zone (computed from the s96 rule) and the rebate line (s69) */}
            {resident && (
              <>
                <rect
                  className="lab-stair__relief"
                  x={xOf(REBATE_INCOME_LIMIT)}
                  y={PAD.t - 10}
                  width={Math.max(2, xOf(reliefEnd) - xOf(REBATE_INCOME_LIMIT))}
                  height={base - PAD.t + 10}
                />
                <line className="lab-stair__rebate-line" x1={xOf(REBATE_INCOME_LIMIT)} x2={xOf(REBATE_INCOME_LIMIT)} y1={PAD.t - 10} y2={base} />
              </>
            )}

            {/* income marker */}
            <motion.g initial={false} animate={{ x: markerX }} transition={geo}>
              <line className="lab-stair__marker" x1={0} x2={0} y1={26} y2={base} />
            </motion.g>
            <motion.circle className="lab-stair__dot" r={5} cx={0} initial={false} animate={{ cx: markerX, cy: dotY }} transition={geo} />
            <motion.g className="lab-stair__bubble" initial={false} animate={{ x: bubbleX }} transition={geo}>
              <rect x={0} y={4} width={bubbleW} height={22} rx={11} />
              <text x={bubbleW / 2} y={19.5} textAnchor="middle">
                {bubbleText}
              </text>
            </motion.g>
          </svg>
        )}
        <AnimatePresence>
          {hotSlab && hotLine && (
            <motion.div
              key="tip"
              className="lab-tip"
              style={{ width: tipW, left: tipLeft, top: Math.max(0, hotSlab.top - 70) }}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
            >
              <b>
                {slabRangeLong(hotSlab.s)} · {rateLabel(hotSlab.s)}
              </b>
              Income in this slab {rs(hotLine.amount)}
              <br />
              Tax {rs(hotLine.tax)}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      <div className="lab-legend lab-stair-legend">
        <span>
          <span className="lab-legend__sw lab-legend__sw--fill" aria-hidden="true" />
          Income taxed at each rate (area = tax)
        </span>
        {resident && (
          <>
            <span>
              <span className="lab-legend__line" aria-hidden="true" />
              Rs. 12,00,000 rebate line
            </span>
            <span>
              <span className="lab-legend__sw lab-legend__sw--relief" aria-hidden="true" />
              Marginal relief zone (computed)
            </span>
          </>
        )}
      </div>
      <p className="lab-tax-hint">
        <MoveHorizontal size={16} aria-hidden="true" /> Drag sideways across the stairs, or tap a point, to set the total income. The 30% slab continues
        past {compact(DISPLAY_MAX)}.
      </p>
    </div>
  )
}

/* ---------- exam-style working ---------- */

function Working({ r, preset }: { r: TaxResult; preset: boolean }) {
  const taxed = r.lines.filter((l) => l.slab.ratePct > 0 && l.amount > 0)
  const steps: { key: string; title: string; body: ReactNode; tone?: 'result' | 'muted' }[] = []

  if (r.mode === 'salary') {
    steps.push({
      key: 'gross',
      title: `Gross salary: ${rs(r.entered)}`,
      body:
        preset && r.entered === MEERA.grossSalary ? (
          <p>
            Basic {rs(MEERA.basic)} + dearness allowance {rs(MEERA.dearnessAllowance)} + house rent allowance {rs(MEERA.houseRentAllowance)}. Under the
            new regime the whole allowance is taxable.
          </p>
        ) : (
          <p>Everything received as salary, including house rent allowance, which the new regime does not exempt.</p>
        ),
    })
    steps.push({
      key: 'sd',
      title: `Less: standard deduction ${rs(r.standardDeduction)}`,
      body: (
        <p>
          Section 19, Sl. No. 2: {rs(STANDARD_DEDUCTION_NEW)} or the salary, whichever is less, under the new regime
          {r.standardDeduction < STANDARD_DEDUCTION_NEW ? ' (here the salary is less).' : '.'}
        </p>
      ),
    })
    steps.push({
      key: 'ti',
      title: `Total income: ${rs(r.totalIncome)}`,
      body: (
        <p>
          {rs(r.entered)} − {rs(r.standardDeduction)} = {rs(r.totalIncome)}.
        </p>
      ),
    })
  } else {
    steps.push({
      key: 'ti',
      title: `Total income: ${rs(r.totalIncome)}`,
      body: <p>Entered directly, so no standard deduction is taken here.</p>,
    })
  }

  steps.push({
    key: 'slabs',
    title: `Tax at the section 202(1) rates: ${rs(r.slabTax)}`,
    body:
      r.totalIncome <= 0 ? (
        <p>No income, no tax.</p>
      ) : (
        <ul className="lab-lines">
          <li>
            <span>Nil on the first {rs(Math.min(r.totalIncome, SLABS[0].to ?? 0))}</span>
            <span>Rs. 0</span>
          </li>
          {taxed.map((l) => (
            <li key={l.index}>
              <span>
                {pct(l.slab.ratePct)} of {rs(l.amount)}
              </span>
              <span>{rs(l.tax)}</span>
            </li>
          ))}
          {taxed.length > 1 && (
            <li className="is-total">
              <span>Total</span>
              <span>{rs(r.slabTax)}</span>
            </li>
          )}
        </ul>
      ),
  })

  let rebateBody: ReactNode
  if (r.rebateKind === 'not-applied') {
    rebateBody = (
      <p>
        Section 156 gives the {rs(REBATE_CAP)} rebate to a resident individual (s69). For other cases s69 mentions a rebate of up to Rs. 12,500 where income
        is up to Rs. 5,00,000, which appendix B ties to opting out of the new regime. Your notes don’t settle what applies here, so no rebate is applied.
      </p>
    )
  } else if (r.rebateKind === 'full') {
    rebateBody =
      r.slabTax === 0 ? (
        <p>There is no tax on the slabs, so there is nothing to rebate.</p>
      ) : (
        <p>
          Total income does not exceed {rs(REBATE_INCOME_LIMIT)}, so the rebate is the full tax or {rs(REBATE_CAP)}, whichever is less: {rs(r.rebate)}.
        </p>
      )
  } else if (r.rebateKind === 'marginal') {
    rebateBody = (
      <p>
        Total income exceeds {rs(REBATE_INCOME_LIMIT)} by {rs(r.excess)}. Marginal relief under section 156(2)(b) limits the tax to that excess, so the
        rebate is {rs(r.slabTax)} − {rs(r.excess)} = {rs(r.rebate)}.
      </p>
    )
  } else {
    rebateBody = (
      <p>
        Total income exceeds {rs(REBATE_INCOME_LIMIT)} by {rs(r.excess)}, which is more than the tax of {rs(r.slabTax)}, so marginal relief gives nothing.
      </p>
    )
  }
  steps.push({
    key: 'rebate',
    title: r.rebateKind === 'not-applied' ? 'Rebate under section 156: not applied' : `Less: rebate under section 156 ${rs(r.rebate)}`,
    body: rebateBody,
    tone: r.rebate > 0 ? undefined : 'muted',
  })

  steps.push({
    key: 'tax',
    title: r.rebateKind === 'not-applied' ? `Tax before any rebate: ${rs(r.tax)}` : `Tax: ${rs(r.tax)}`,
    body: (
      <p>
        {r.rebateKind === 'not-applied' ? `${rs(r.slabTax)}, with no rebate applied` : `${rs(r.slabTax)} − ${rs(r.rebate)} = ${rs(r.tax)}`}, plus cess
        (and any surcharge) under the Finance Act. Their rates are not in your notes, so the working stops here.
      </p>
    ),
    tone: 'result',
  })

  return (
    <ol className="lab-steps">
      <AnimatePresence initial={false}>
        {steps.map((s, i) => (
          <Step key={s.key} n={i + 1} title={s.title} tone={s.tone}>
            {s.body}
          </Step>
        ))}
      </AnimatePresence>
    </ol>
  )
}

/* ---------- slab table ---------- */

function SlabTable({ r, hot, setHot }: { r: TaxResult; hot: number | null; setHot: (i: number | null) => void }) {
  return (
    <table className="lab-table lab-tax-table">
      <caption className="sr-only">Tax under section 202(1), slab by slab</caption>
      <thead>
        <tr>
          <th scope="col">Slab and rate</th>
          <th scope="col" className="num">
            Income in slab
          </th>
          <th scope="col" className="num">
            Tax
          </th>
        </tr>
      </thead>
      <tbody>
        {r.lines.map((l) => {
          const on = l.amount > 0
          const cls = [on ? 'is-on' : 'is-idle', hot === l.index ? 'is-hot' : ''].join(' ')
          return (
            <tr key={l.index} className={cls} onMouseEnter={() => setHot(l.index)} onMouseLeave={() => setHot(null)}>
              <td>
                <span className="lab-tax-table__range">
                  <span className="lab-tax-table__long">{slabRangeLong(l.slab)}</span>
                  <span className="lab-tax-table__short">{slabRangeShort(l.slab)}</span>
                </span>
                <span className="lab-tax-table__rate">{rateLabel(l.slab)}</span>
                <span className="lab-tax-table__bar" aria-hidden="true">
                  <motion.span initial={false} animate={{ scaleX: slabFill(l.slab, l.amount) }} transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }} />
                </span>
              </td>
              <td className="num">{inr(l.amount)}</td>
              <td className="num">{inr(l.tax)}</td>
            </tr>
          )
        })}
      </tbody>
      <tfoot>
        <tr>
          <td>Total</td>
          <td className="num">{inr(r.totalIncome)}</td>
          <td className="num">{inr(r.slabTax)}</td>
        </tr>
      </tfoot>
    </table>
  )
}

/* ---------- memory hooks ---------- */

function Hooks({ onPlay, canPlay, onTry }: { onPlay: () => void; canPlay: boolean; onTry: (mode: IncomeMode, amount: number) => void }) {
  const atLimit = slabTaxOn(REBATE_INCOME_LIMIT) // computed: 60,000 on these slabs
  const reliefEnd = Math.floor(reliefEndsAt()) // computed: about 12,70,588
  const hooks = [
    {
      key: 'stairs',
      title: 'Every 4 lakh, up 5%',
      text: 'Nil up to Rs. 4,00,000, then 5%, 10%, 15%, 20% and 25% for each further Rs. 4,00,000, and 30% above Rs. 24,00,000.',
      tag: 'From appendix B',
      action: canPlay ? (
        <button type="button" className="btn btn-sm" onClick={onPlay}>
          <Play size={14} aria-hidden="true" /> Play the stairs
        </button>
      ) : null,
    },
    {
      key: 'sixty',
      title: '20,000 + 40,000 = the rebate cap',
      text: `At ${rs(REBATE_INCOME_LIMIT)} the slab tax is exactly ${rs(atLimit)}, the same as the ${rs(REBATE_CAP)} cap, so a resident individual pays nil up to Rs. 12 lakh.`,
      tag: 'Computed from your notes',
      action: (
        <button type="button" className="btn btn-sm" onClick={() => onTry('total', REBATE_INCOME_LIMIT)}>
          Try {compact(REBATE_INCOME_LIMIT)}
        </button>
      ),
    },
    {
      key: 'salary',
      title: `Salaried: nil up to ${rs(salaryNilTaxUpTo())}`,
      text: `${rs(REBATE_INCOME_LIMIT)} plus the ${rs(STANDARD_DEDUCTION_NEW)} standard deduction. For a resident individual whose only income is salary.`,
      tag: 'Computed from your notes',
      action: (
        <button type="button" className="btn btn-sm" onClick={() => onTry('salary', salaryNilTaxUpTo())}>
          Try {compact(salaryNilTaxUpTo())} salary
        </button>
      ),
    },
    {
      key: 'relief',
      title: `Relief fades out by about ${rs(reliefEnd)}`,
      text: `Just above Rs. 12 lakh, marginal relief caps the tax at the income above Rs. 12 lakh (s96). The cap stops helping once the slab tax falls below that excess, at about ${rs(reliefEnd)} of total income.`,
      tag: 'Computed from your notes',
      action: (
        <button type="button" className="btn btn-sm" onClick={() => onTry('total', 1250000)}>
          Try 12.5L
        </button>
      ),
    },
  ]
  return (
    <div className="lab-hooks">
      {hooks.map((h) => (
        <div key={h.key} className="lab-hook">
          <div className="lab-hook__title">{h.title}</div>
          <p className="lab-hook__text">{h.text}</p>
          <div className="lab-hook__foot">
            <span className="lab-hook__tag">{h.tag}</span>
            {h.action}
          </div>
        </div>
      ))}
    </div>
  )
}
