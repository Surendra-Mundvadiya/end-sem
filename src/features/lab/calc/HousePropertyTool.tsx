import { useState, type ReactNode } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { ArrowRightLeft, BookOpenCheck, ChartColumnDecreasing, House, ListOrdered, TriangleAlert } from 'lucide-react'
import { easeOut } from '../../../lib/motion'
import { compact, inr, rs, rsLess } from './format'
import {
  ANIL,
  ANIL_EXPECTED,
  LOSS_CARRY_FORWARD_YEARS,
  LOSS_SET_OFF_LIMIT,
  PRE_CONSTRUCTION_INSTALMENTS,
  SELF_OCCUPIED_CAP,
  SELF_OCCUPIED_CAP_OTHER,
  STANDARD_DEDUCTION_PCT,
  SUNITA,
  SUNITA_EXPECTED,
  computeHouse,
  lossTreatment,
  type HouseInput,
  type HouseResult,
  type Occupancy,
  type Regime,
} from './houseMath'
import { AnimatedNumber, Check, LeftOut, MatchBadge, MoneyField, NotesCallout, Panel, Segmented, Switch, useDebounced, useElementWidth, useGeoTransition } from './ui'
import './house.css'

/*
 * Income from house property (Unit V): annual value under section 21 and deductions under section 22, as the notes
 * state them (s103 to s107). Arithmetic in houseMath.ts, machine-checked against Anil and Sunita (s107).
 */

type Preset = 'anil' | 'sunita' | null

interface Conditions {
  loan: boolean
  within5: boolean
  certificate: boolean
}

const ALL_MET: Conditions = { loan: true, within5: true, certificate: true }

export default function HousePropertyTool() {
  const [input, setInput] = useState<HouseInput>(ANIL)
  const [conds, setConds] = useState<Conditions>(ALL_MET)
  const [preset, setPreset] = useState<Preset>('anil')
  const [hot, setHot] = useState<number | null>(null)

  const full: HouseInput = { ...input, capConditionsMet: conds.loan && conds.within5 && conds.certificate }
  const r = computeHouse(full)
  const other = computeHouse({ ...full, regime: input.regime === 'new' ? 'old' : 'new' })
  const loss = lossTreatment(r.income, input.regime)
  const steps = buildSteps(full, r)

  const matches =
    preset === 'anil'
      ? r.annualValue === ANIL_EXPECTED.annualValue &&
        r.standardDeduction === ANIL_EXPECTED.standardDeduction &&
        r.interestAllowed === ANIL_EXPECTED.interestAllowed &&
        r.income === ANIL_EXPECTED.income
      : preset === 'sunita'
        ? r.income === SUNITA_EXPECTED[input.regime]
        : false

  function set<K extends keyof HouseInput>(key: K, value: HouseInput[K]) {
    // Flipping the regime keeps an illustration loaded: the notes give Sunita's answer under both regimes,
    // and Anil's let-out answer does not depend on the regime.
    if (key !== 'regime') setPreset(null)
    setInput((p) => ({ ...p, [key]: value }))
  }

  function setCond(key: keyof Conditions, v: boolean) {
    setPreset(null)
    setConds((c) => ({ ...c, [key]: v }))
  }

  function load(p: 'anil' | 'sunita') {
    setInput(p === 'anil' ? ANIL : SUNITA)
    setConds(ALL_MET)
    setPreset(p)
  }

  const isLoss = r.income < 0
  const live = useDebounced(`Annual value ${rs(r.annualValue)}. Income from house property ${rs(r.income)}.`)

  return (
    <div className="lab-calc lab-hp">
      <p className="sr-only" aria-live="polite">
        {live}
      </p>

      <div className="lab-calc__grid">
        <Panel title="The property" icon={<House size={16} />}>
          <Segmented<Occupancy>
            label="How it is used"
            value={input.occupancy}
            onChange={(v) => set('occupancy', v)}
            options={[
              { value: 'let', label: 'Let out' },
              { value: 'self', label: 'Self occupied' },
            ]}
          />
          <Segmented<Regime>
            label="Tax regime"
            value={input.regime}
            onChange={(v) => set('regime', v)}
            options={[
              { value: 'new', label: 'New regime' },
              { value: 'old', label: 'Opted out' },
            ]}
          />

          <AnimatePresence mode="wait" initial={false}>
            {input.occupancy === 'let' ? (
              <motion.div
                key="let"
                className="lab-fields"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.22, ease: easeOut }}
              >
                <div className="lab-fields lab-fields--2">
                  <MoneyField
                    label="Expected rent for the year"
                    value={input.expectedRent}
                    onChange={(n) => set('expectedRent', n)}
                    hint="What it might reasonably fetch if let from year to year (s103)."
                  />
                  <MoneyField
                    label="Actual rent for the year"
                    value={input.actualRent}
                    onChange={(n) => set('actualRent', n)}
                    hint="Received or receivable (s103)."
                  />
                </div>
                <Switch
                  checked={input.vacancy}
                  onChange={(v) => set('vacancy', v)}
                  label="Let, but vacant for the whole or part of the year"
                  hint="If the vacancy is why actual rent is below expected rent, the actual rent is taken (s21(2))."
                />
                <div className="lab-fields lab-fields--2">
                  <MoneyField
                    label="Municipal taxes paid by the owner"
                    value={input.municipalTaxes}
                    onChange={(n) => set('municipalTaxes', n)}
                    hint="Actually paid this year, whatever year they relate to (s21(3))."
                  />
                  <MoneyField
                    label="Interest on borrowed capital"
                    value={input.interest}
                    onChange={(n) => set('interest', n)}
                    hint="For the year, on an accrual basis (s22(b))."
                  />
                </div>
                <MoneyField
                  label="Pre-construction interest (total, optional)"
                  value={input.preConstruction}
                  onChange={(n) => set('preConstruction', n)}
                  hint={`Allowed in ${PRE_CONSTRUCTION_INSTALMENTS} equal instalments from the year of completion (s22(c)).`}
                />
              </motion.div>
            ) : (
              <motion.div
                key="self"
                className="lab-fields"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.22, ease: easeOut }}
              >
                <div className="lab-fields lab-fields--2">
                  <MoneyField label="Interest for the year" value={input.interest} onChange={(n) => set('interest', n)} hint="On the loan for the house (s22(b))." />
                  <MoneyField
                    label="Pre-construction interest (total)"
                    value={input.preConstruction}
                    onChange={(n) => set('preConstruction', n)}
                    hint={`One fifth a year, inside the same limit (s22(c)).`}
                  />
                </div>
                <fieldset className="lab-hp-conds" disabled={input.regime === 'new'}>
                  <legend className="lab-field__label">For the {rs(SELF_OCCUPIED_CAP)} limit (otherwise {rs(SELF_OCCUPIED_CAP_OTHER)})</legend>
                  <Check checked={conds.loan} onChange={(v) => setCond('loan', v)}>
                    Bought or built with a loan taken for that purpose
                  </Check>
                  <Check checked={conds.within5} onChange={(v) => setCond('within5', v)}>
                    Completed within five years from the end of the year of borrowing
                  </Check>
                  <Check checked={conds.certificate} onChange={(v) => setCond('certificate', v)}>
                    Lender’s certificate furnished
                  </Check>
                </fieldset>
                {input.regime === 'new' && (
                  <p className="lab-warn">
                    <TriangleAlert size={16} aria-hidden="true" />
                    Under the new regime no interest deduction is allowed on a self occupied house (s105), so the limit does not matter.
                  </p>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          <div className="lab-preset">
            <div className="lab-preset__head">
              <BookOpenCheck size={18} aria-hidden="true" />
              Notes’ illustrations (s107)
            </div>
            <div className="lab-preset__actions">
              <button type="button" className={`btn btn-sm${preset === 'anil' ? ' btn-unit' : ''}`} aria-pressed={preset === 'anil'} onClick={() => load('anil')}>
                Anil: let out
              </button>
              <button type="button" className={`btn btn-sm${preset === 'sunita' ? ' btn-unit' : ''}`} aria-pressed={preset === 'sunita'} onClick={() => load('sunita')}>
                Sunita: self occupied
              </button>
            </div>
            <AnimatePresence initial={false}>
              {matches && (
                <motion.div key={`${preset}-${input.regime}`} initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}>
                  <MatchBadge>
                    {preset === 'anil'
                      ? `Matches the notes: income ${rs(ANIL_EXPECTED.income)}`
                      : input.regime === 'old'
                        ? `Matches the notes: loss of ${rs(-SUNITA_EXPECTED.old)} outside the new regime`
                        : 'Matches the notes: nil under the new regime'}
                  </MatchBadge>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </Panel>

        <Panel title="The waterfall" icon={<ChartColumnDecreasing size={16} />}>
          <div className="lab-hero">
            <span className="lab-hero__label">{isLoss ? 'Loss from house property' : 'Income from house property'}</span>
            <AnimatedNumber className="lab-hero__value" value={Math.abs(r.income)} />
            <span className="lab-hero__sub">
              Annual value {rs(r.annualValue)} · deductions {rs(r.standardDeduction + r.interestAllowed)}
            </span>
          </div>
          <Waterfall steps={steps} hot={hot} setHot={setHot} />
          <RegimeCheck occupancy={input.occupancy} regime={input.regime} r={r} other={other} />
        </Panel>
      </div>

      <div className="lab-calc__grid lab-calc__grid--even">
        <Panel title="Exam-style working" icon={<ListOrdered size={16} />}>
          <ol className="lab-hp-rows">
            <AnimatePresence initial={false}>
              {steps.map((s, i) => (
                <motion.li
                  key={s.key}
                  layout="position"
                  className={`lab-hp-row lab-hp-row--${s.kind}${hot === i ? ' is-hot' : ''}`}
                  onMouseEnter={() => setHot(i)}
                  onMouseLeave={() => setHot(null)}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.25, ease: easeOut }}
                >
                  <span className="lab-hp-row__n" aria-hidden="true">
                    {i + 1}
                  </span>
                  <span className="lab-hp-row__text">
                    <span className="lab-hp-row__title">
                      <span className="sr-only">Step {i + 1}: </span>
                      {s.title}
                    </span>
                    <span className="lab-hp-row__detail">{s.detail}</span>
                  </span>
                  <span className="lab-hp-row__value">{s.kind === 'delta' ? rsLess(s.delta) : rs(s.end)}</span>
                </motion.li>
              ))}
            </AnimatePresence>
          </ol>
          {loss && <LossBox loss={loss.loss} canSetOff={loss.canSetOffOtherHeads} setOff={loss.setOffOtherHeads} carried={loss.carriedForward} />}
        </Panel>

        <div className="lab-hp-side">
          <NotesCallout slideIds={['s103', 's104', 's105', 's106', 's107']}>
            <p>
              <strong>Annual value (section 21(1)):</strong> the higher of the sum for which the property might reasonably be expected to let from year to year
              and the actual rent received or receivable. Municipal taxes actually paid by the owner during the year reduce it (section 21(3)).
            </p>
            <p>
              <strong>Deductions (section 22):</strong> 30% of the annual value, whatever the actual expenditure; interest on borrowed capital; and
              pre-construction interest in five equal instalments.
            </p>
            <p>
              <strong>Self occupied:</strong> nil annual value; interest limited to Rs. 2,00,000 (loan to buy or build, completed within five years, lender’s
              certificate) or Rs. 30,000; no interest deduction under the new regime. For let out houses, section 22 sets no limit on interest.
            </p>
          </NotesCallout>
          <LeftOut
            note="read these in your notes"
            items={[
              <>Unrealised rent (s21(4)): excluded from actual rent subject to the Rules (s104). Enter actual rent without it.</>,
              <>Arrears and unrealised rent received later: taxed in the year of receipt less 30% (s23, s106).</>,
              <>Rent control: enter expected rent already limited by the standard rent (Sheila Kaushish, s103).</>,
              <>More than one self occupied house: the combined interest limit is Rs. 2,00,000 (s22(5), s105). Co owners: s24 (s106).</>,
            ]}
          />
        </div>
      </div>
    </div>
  )
}

/* ---------- steps (shared by the chart and the working) ---------- */

interface HpStep {
  key: string
  kind: 'total' | 'delta' | 'result'
  title: string
  detail: ReactNode
  /** Chart label, one or two short lines. */
  label: [string, string?]
  start: number
  end: number
  /** Signed change for deltas. */
  delta: number
  /** For the interest bar: the claimed amount beyond what is allowed (drawn as a ghost). */
  ghost?: number
}

function buildSteps(input: HouseInput, r: HouseResult): HpStep[] {
  const steps: HpStep[] = []
  if (input.occupancy === 'let') {
    const ruleText =
      r.rentRule === 'vacancy'
        ? `Vacancy made actual rent (${rs(input.actualRent)}) lower than expected rent (${rs(input.expectedRent)}), so actual rent is taken (s21(2)).`
        : `Higher of expected rent ${rs(input.expectedRent)} and actual rent ${rs(input.actualRent)} (s21(1)).`
    steps.push({ key: 'rent', kind: 'total', title: 'Rent figure', detail: ruleText, label: ['Rent', 'figure'], start: 0, end: r.rentFigure, delta: r.rentFigure })
    steps.push({
      key: 'muni',
      kind: 'delta',
      title: 'Less: municipal taxes',
      detail: r.municipalLimited
        ? 'Limited here to the rent figure: your notes don’t cover municipal taxes larger than the rent.'
        : 'Levied by a local authority and actually paid by the owner during the year (s21(3)).',
      label: ['Municipal', 'taxes'],
      start: r.rentFigure,
      end: r.annualValue,
      delta: -r.municipalApplied,
    })
    steps.push({
      key: 'av',
      kind: 'total',
      title: 'Annual value',
      detail: `${rs(r.rentFigure)} − ${rs(r.municipalApplied)}.`,
      label: ['Annual', 'value'],
      start: 0,
      end: r.annualValue,
      delta: r.annualValue,
    })
    const afterSd = r.annualValue - r.standardDeduction
    steps.push({
      key: 'sd',
      kind: 'delta',
      title: `Less: standard deduction ${STANDARD_DEDUCTION_PCT}%`,
      detail: `${STANDARD_DEDUCTION_PCT}% of the annual value ${rs(r.annualValue)}, whatever the actual expenditure (s22(a)).`,
      label: ['30%', 'deduction'],
      start: r.annualValue,
      end: afterSd,
      delta: -r.standardDeduction,
    })
    const afterInt = afterSd - r.interest
    steps.push({
      key: 'int',
      kind: 'delta',
      title: 'Less: interest on borrowed capital',
      detail: 'No limit for a let out house (s22(b), s105).',
      label: ['Interest'],
      start: afterSd,
      end: afterInt,
      delta: -r.interest,
    })
    if (r.preConInstalment > 0) {
      steps.push({
        key: 'pre',
        kind: 'delta',
        title: 'Less: pre-construction interest, one fifth',
        detail: `${rs(input.preConstruction)} ÷ ${PRE_CONSTRUCTION_INSTALMENTS} (s22(c)).`,
        label: ['Pre-constr.', '1/5'],
        start: afterInt,
        end: afterInt - r.preConInstalment,
        delta: -r.preConInstalment,
      })
    }
  } else {
    steps.push({
      key: 'av',
      kind: 'total',
      title: 'Annual value: nil',
      detail: 'The owner lives in it, or cannot occupy it for any reason; up to two houses (s21(6), (7)).',
      label: ['Annual', 'value'],
      start: 0,
      end: 0,
      delta: 0,
    })
    steps.push({
      key: 'sd',
      kind: 'delta',
      title: `Less: standard deduction ${STANDARD_DEDUCTION_PCT}%`,
      detail: `${STANDARD_DEDUCTION_PCT}% of nil is nil.`,
      label: ['30%', 'deduction'],
      start: 0,
      end: 0,
      delta: 0,
    })
    let detail: string
    if (input.regime === 'new') {
      detail = `Claimed ${rs(r.interestClaimed)}, but no interest deduction is allowed on a self occupied house under the new regime (s105).`
    } else {
      const capText = r.interestCap === SELF_OCCUPIED_CAP ? 'all three conditions hold' : 'not all three conditions hold'
      detail = `Claimed ${rs(r.interestClaimed)}${r.preConInstalment > 0 ? ` (including one fifth of pre-construction interest, ${rs(r.preConInstalment)})` : ''}; limited to ${rs(r.interestCap ?? 0)} because ${capText} (s22(2), (4)).`
    }
    steps.push({
      key: 'int',
      kind: 'delta',
      title: 'Less: interest allowed',
      detail,
      label: ['Interest', 'allowed'],
      start: 0,
      end: -r.interestAllowed,
      delta: -r.interestAllowed,
      ghost: r.interestDisallowed,
    })
  }
  steps.push({
    key: 'income',
    kind: 'result',
    title: r.income < 0 ? 'Loss from house property' : 'Income from house property',
    detail: r.income < 0 ? 'A negative figure is a loss; see how it is set off below.' : 'Goes into total income under this head.',
    label: ['Income'],
    start: 0,
    end: r.income,
    delta: r.income,
  })
  return steps
}

/* ---------- waterfall chart ---------- */

const WH = 264
const WPAD = { l: 8, r: 8, t: 28, b: 46 }

function Waterfall({ steps, hot, setHot }: { steps: HpStep[]; hot: number | null; setHot: (i: number | null) => void }) {
  const [ref, width] = useElementWidth<HTMLDivElement>()
  const geo = useGeoTransition()

  const plotW = Math.max(0, width - WPAD.l - WPAD.r)
  const plotH = WH - WPAD.t - WPAD.b
  const n = steps.length
  const band = n > 0 ? plotW / n : 0
  const barW = Math.min(34, band * 0.56)
  const ends = steps.flatMap((s) => [s.start, s.end, s.end - (s.ghost ?? 0)])
  let lo = Math.min(0, ...ends)
  let hi = Math.max(0, ...ends)
  if (hi - lo < 1) hi = lo + 1
  const span = hi - lo
  hi += span * 0.12
  if (lo < 0) lo -= span * 0.14
  const yOf = (v: number) => WPAD.t + ((hi - v) / (hi - lo)) * plotH
  const narrow = band < 74
  const fmt = narrow ? compact : inr
  const signed = (v: number) => (v < 0 ? `−${fmt(-v)}` : fmt(v))

  const bars = steps.map((s, i) => {
    const cx = WPAD.l + band * (i + 0.5)
    const top = yOf(Math.max(s.start, s.end))
    const bottom = yOf(Math.min(s.start, s.end))
    const h = Math.max(2, bottom - top)
    const ghostH = s.ghost ? Math.max(0, yOf(s.end - s.ghost) - bottom) : 0
    return { s, i, cx, x: cx - barW / 2, top, h, ghostH, bottom }
  })

  const hotBar = hot !== null ? bars[hot] : null
  const tipW = 210
  const tipLeft = hotBar ? Math.min(Math.max(hotBar.cx - tipW / 2, 0), Math.max(0, width - tipW)) : 0

  return (
    <div className="lab-chart-block">
      <div ref={ref} className="lab-chart" style={{ height: WH }} onPointerLeave={() => setHot(null)}>
        {width > 0 && (
          <svg
            width={width}
            height={WH}
            role="img"
            aria-label={`Waterfall: ${steps.map((s) => `${s.title} ${s.kind === 'delta' ? rsLess(s.delta) : rs(s.end)}`).join('; ')}.`}
          >
            <line className="lab-wf__zero" x1={WPAD.l} x2={width - WPAD.r} y1={yOf(0)} y2={yOf(0)} />
            {bars.slice(0, -1).map((b, i) => {
              const next = bars[i + 1]
              const level = b.s.end
              return (
                <motion.line
                  key={`c${b.s.key}`}
                  className="lab-wf__link"
                  initial={false}
                  animate={{ x1: b.cx + barW / 2, x2: next.cx - barW / 2, y1: yOf(level), y2: yOf(level) }}
                  transition={geo}
                />
              )
            })}
            {bars.map((b) => {
              const cls = b.s.kind === 'result' ? (b.s.end < 0 ? 'is-loss' : 'is-result') : b.s.kind === 'total' ? 'is-total' : 'is-delta'
              const labelY = b.s.kind === 'result' && b.s.end < 0 ? b.bottom + b.ghostH + 15 : b.s.kind === 'delta' && b.s.delta < 0 && b.s.start <= 0 ? b.bottom + b.ghostH + 15 : b.top - 7
              const value = b.s.kind === 'delta' ? (b.s.delta === 0 ? '0' : `−${fmt(Math.abs(b.s.delta))}`) : signed(b.s.end)
              return (
                <g key={b.s.key} className={`lab-wf__col ${cls}${hot === b.i ? ' is-hot' : ''}`} onPointerEnter={() => setHot(b.i)}>
                  <rect className="lab-wf__hit" x={b.cx - band / 2} y={WPAD.t - 20} width={band} height={plotH + 20 + WPAD.b} />
                  {b.ghostH > 0 && (
                    <motion.rect className="lab-wf__ghost" x={b.x} width={barW} rx={4} initial={false} animate={{ y: b.bottom, height: b.ghostH }} transition={geo} />
                  )}
                  <motion.rect className="lab-wf__bar" x={b.x} width={barW} rx={4} initial={{ y: yOf(0), height: 0 }} animate={{ y: b.top, height: b.h }} transition={geo} />
                  <motion.text className="lab-wf__value" x={b.cx} textAnchor="middle" initial={false} animate={{ y: labelY }} transition={geo}>
                    {value}
                  </motion.text>
                  {narrow ? (
                    <text className="lab-wf__label" x={b.cx} y={WH - WPAD.b + 20} textAnchor="middle">
                      {b.i + 1}
                    </text>
                  ) : (
                    <text className="lab-wf__label" x={b.cx} y={WH - WPAD.b + 18} textAnchor="middle">
                      <tspan x={b.cx}>{b.s.label[0]}</tspan>
                      {b.s.label[1] && (
                        <tspan x={b.cx} dy={13}>
                          {b.s.label[1]}
                        </tspan>
                      )}
                    </text>
                  )}
                </g>
              )
            })}
          </svg>
        )}
        <AnimatePresence>
          {hotBar && (
            <motion.div
              key="tip"
              className="lab-tip"
              style={{ width: tipW, left: tipLeft, top: 0 }}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
            >
              <b>
                {hotBar.i + 1}. {hotBar.s.title}
              </b>
              {hotBar.s.kind === 'delta' ? rsLess(hotBar.s.delta) : rs(hotBar.s.end)}
              {hotBar.s.ghost ? (
                <>
                  <br />
                  {rs(hotBar.s.ghost)} claimed but not allowed
                </>
              ) : null}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      <div className="lab-legend lab-wf-legend">
        <span>
          <span className="lab-legend__sw lab-wf__sw--total" aria-hidden="true" />
          Running figure
        </span>
        <span>
          <span className="lab-legend__sw lab-wf__sw--delta" aria-hidden="true" />
          Deduction
        </span>
        {steps.some((s) => s.ghost) && (
          <span>
            <span className="lab-legend__sw lab-wf__sw--ghost" aria-hidden="true" />
            Interest not allowed
          </span>
        )}
        {narrow && <span>Numbers match the working below.</span>}
      </div>
    </div>
  )
}

/* ---------- side notes ---------- */

function RegimeCheck({ occupancy, regime, r, other }: { occupancy: Occupancy; regime: Regime; r: HouseResult; other: HouseResult }) {
  const otherName = regime === 'new' ? 'If the owner opts out' : 'Under the new regime'
  const same = Math.round(r.income) === Math.round(other.income)
  return (
    <div className="lab-hp-regime">
      <ArrowRightLeft size={16} aria-hidden="true" />
      <p>
        <b>{otherName}:</b> {rs(other.income)}.{' '}
        {same
          ? occupancy === 'let'
            ? 'The same: the notes bar interest only on a self occupied house.'
            : 'The same here.'
          : regime === 'new'
            ? 'Outside the new regime the interest deduction is allowed, up to the limit.'
            : 'The new regime allows no interest deduction on a self occupied house.'}
      </p>
    </div>
  )
}

function LossBox({ loss, canSetOff, setOff, carried }: { loss: number; canSetOff: boolean; setOff: number; carried: number }) {
  return (
    <motion.div className="lab-hp-lossbox" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, ease: easeOut }}>
      <b>What happens to the loss of {rs(loss)} (s106)</b>
      {canSetOff ? (
        <ul>
          <li>
            Set off against other heads this year (up to {rs(LOSS_SET_OFF_LIMIT)}, section 109(1)(b)): <b>{rs(setOff)}</b>
          </li>
          {carried > 0 ? (
            <li>
              Carried forward for up to {LOSS_CARRY_FORWARD_YEARS} tax years, against house property income only (section 110): <b>{rs(carried)}</b>
            </li>
          ) : (
            <li>Nothing is left to carry forward (any balance would go forward for up to {LOSS_CARRY_FORWARD_YEARS} tax years, section 110).</li>
          )}
        </ul>
      ) : (
        <p>Under the new regime a house property loss cannot be set off against other heads.</p>
      )}
    </motion.div>
  )
}
