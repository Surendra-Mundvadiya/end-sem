import './visual.css'
import { useId, useMemo, useRef, useState } from 'react'
import { AnimatePresence, LayoutGroup, motion, useReducedMotion } from 'framer-motion'
import {
  ArrowRight,
  Briefcase,
  Building2,
  Check,
  ChevronDown,
  CircleDollarSign,
  HelpCircle,
  Layers,
  RotateCcw,
  Sigma,
  TrendingUp,
  X,
  type LucideIcon,
} from 'lucide-react'
import ProgressRing from '../../../components/ProgressRing'
import UnitPill from '../../../components/UnitPill'
import { unitVars, type UnitId } from '../../../data'
import { easeOut, softSpring, spring } from '../../../lib/motion'
import { shuffle } from '../../../lib/text'
import { SourceLink, useElementWidth } from './ui'

/*
 * Heads of income (Unit IV, part 1). Section ranges and the residuary rule: s80 and s46. Charging provisions:
 * section 15 (s86), section 20(1) (s99), section 26(2) (s109), section 92(1) (s80). The notes give capital gains only
 * as "sections 67 to 91" and "capital gains (section 67)" (s50), so no charging section is claimed for it.
 */

type HeadId = 'salaries' | 'house' | 'business' | 'capital' | 'other'
type NodeId = HeadId | 'total'

interface Point {
  text: string
  slideId: string
}

interface Head {
  id: HeadId
  name: string
  /** Short label for the hub diagram; the full name is used everywhere else. */
  short: string
  sections: string
  count: number
  unitId?: UnitId
  icon: LucideIcon
  chargeLabel: string
  charge: string
  chargeSlide: string
  covers: string
  points: Point[]
  slides: string[]
}

const HEADS: Head[] = [
  {
    id: 'salaries',
    name: 'Salaries',
    short: 'Salaries',
    sections: 'Sections 15 to 19', // s80
    count: 5,
    unitId: 'u4',
    icon: Briefcase,
    chargeLabel: 'Charging section · Section 15',
    // s86
    charge:
      'Chargeable: salary due from an employer (including a former employer) in the tax year, whether paid or not; salary paid or allowed in the tax year, though not due or before it became due (advance salary); and arrears of salary paid or allowed in the tax year, if not taxed earlier.',
    chargeSlide: 's86',
    // s87
    covers:
      '“Salary” includes wages; annuity or pension; gratuity; fees or commission; perquisites; profits in lieu of or in addition to salary; advance of salary; leave encashment; the taxable accretion and transferred balance in a recognised provident fund; the employer’s contribution to the pension scheme under section 124; and the Central Government’s contribution to the Agniveer Corpus Fund (section 16).',
    points: [
      { text: 'Salary is taxed on the due or receipt basis, whichever is earlier; the method of accounting under section 276 does not apply to it.', slideId: 's86' },
      { text: 'Remuneration of a partner from his firm is not salary (section 15(4)).', slideId: 's86' },
      { text: 'Salary arises only from a contract of service, in which the employer controls how the work is done. Payments under a contract for services give business or professional income.', slideId: 's88' },
      { text: 'Standard deduction (section 19): Rs. 75,000 or the salary, whichever is less, under the new regime; Rs. 50,000 or the salary, whichever is less, otherwise.', slideId: 's95' },
    ],
    slides: ['s86', 's87', 's88', 's91', 's95'],
  },
  {
    id: 'house',
    name: 'Income from house property',
    short: 'House property',
    sections: 'Sections 20 to 25', // s80
    count: 6,
    unitId: 'u5',
    icon: Building2,
    chargeLabel: 'Charging section · Section 20(1)',
    // s99
    charge:
      'The annual value of property consisting of buildings or lands appurtenant to them, of which the assessee is the owner, is chargeable under this head, except the portions he occupies for his own business or profession whose profits are taxable (section 20(2)).',
    chargeSlide: 's99',
    // s98
    covers: 'The charge is on the annual value of property, the amount it can reasonably be expected to fetch if let from year to year, or the actual rent if higher. It is not a tax on rent as such.',
    points: [
      { text: 'The annual value is the higher of the sum for which the property might reasonably be expected to let from year to year, and the actual rent received or receivable (section 21(1)).', slideId: 's103' },
      { text: 'Section 22 allows a standard deduction of 30% of the annual value, whatever the actual expenditure, and interest on capital borrowed for the property.', slideId: 's105' },
      { text: 'Up to two houses occupied by the owner, or which he cannot occupy for any reason, have a nil annual value (section 21(6) and (7)).', slideId: 's98' },
      { text: 'Income from letting out a residential house, or part of it, by the owner is chargeable only as income from house property (section 26(4)).', slideId: 's102' },
      { text: 'East India Housing: rent from shops and stalls built by a company dealing in land was taxable under the property head, whatever the object of the company.', slideId: 's80' },
    ],
    slides: ['s98', 's99', 's103', 's104', 's105'],
  },
  {
    id: 'business',
    name: 'Profits and gains of business or profession',
    short: 'Business or profession',
    sections: 'Sections 26 to 66', // s80
    count: 41,
    unitId: 'u6',
    icon: TrendingUp,
    chargeLabel: 'Charging section · Section 26(2)',
    // s109
    charge:
      'Chargeable: (a) profits and gains of any business or profession carried on during the tax year, and the special receipts in clauses (b) to (k), such as compensation on termination of a management, agency or business contract, export incentives, a partner’s remuneration from his firm, non compete fees and Keyman insurance sums.',
    chargeSlide: 's109',
    // s109
    covers: '“Business” includes any trade, commerce or manufacture, or any adventure or concern in the nature of trade, commerce or manufacture (section 2(20)). “Profession” includes vocation (section 2(86)).',
    points: [
      { text: 'A speculation business is treated as distinct from any other business (section 26(3)).', slideId: 's109' },
      { text: 'Business income is computed under sections 28 to 60, except section 58, which has its own presumptive scheme (section 27).', slideId: 's109' },
      { text: 'Narain Swadeshi Weaving Mills: “business” connotes a real, substantial and systematic or organised course of activity with a set purpose.', slideId: 's110' },
      { text: 'Section 34, the general deduction: expenditure not covered by the specific sections, not capital or personal, and laid out wholly and exclusively for the business or profession.', slideId: 's115' },
    ],
    slides: ['s109', 's110', 's114', 's115'],
  },
  {
    id: 'capital',
    name: 'Capital gains',
    short: 'Capital gains',
    sections: 'Sections 67 to 91', // s80
    count: 25,
    icon: CircleDollarSign,
    chargeLabel: 'Where it sits in the Act',
    // s46, s50
    charge: 'Capital gains are dealt with in sections 67 to 91 of Chapter IV, and the definition of income in section 2(49) includes capital gains (section 67).',
    chargeSlide: 's50',
    // s52
    covers: 'Capital receipts are not income unless a provision taxes them, such as capital gains.',
    points: [
      { text: 'Navinchandra Mafatlal: “income” in a legislative entry must be given its widest meaning; capital gains could be taxed as income.', slideId: 's51' },
      { text: 'Agricultural land is not a “capital asset” unless it is urban land (section 2(22)(iii)), so the sale of rural agricultural land gives no taxable capital gain.', slideId: 's66' },
      { text: 'Non compete fees are business income under section 26(2)(h), except a transfer of the right to manufacture or carry on business, which is taxable as capital gains.', slideId: 's109' },
      { text: 'Income accruing through the transfer of a capital asset situated in India is deemed to accrue in India (section 9(2)).', slideId: 's60' },
    ],
    slides: ['s50', 's51', 's52', 's66'],
  },
  {
    id: 'other',
    name: 'Income from other sources',
    short: 'Other sources',
    sections: 'Sections 92 to 95', // s80
    count: 4,
    icon: Layers,
    chargeLabel: 'The residuary head · Section 92(1)',
    // s80
    charge: 'It covers income of every kind, not excluded from total income, that is not chargeable under the other four heads.',
    chargeSlide: 's80',
    covers: 'Whatever is left over: it is the residuary head.', // s80
    points: [
      { text: 'Dividend income is taxable under other sources (section 92(2)(a)).', slideId: 's129' },
      { text: 'Section 92(2)(m) taxes, among other things, sums of money received without consideration where the total in a tax year exceeds Rs. 50,000.', slideId: 's52' },
      { text: 'Sultan Brothers: a building let with furniture or machinery, the two lettings being inseparable, gives income from other sources or business income, not house property income (now section 92(2)(g)).', slideId: 's102' },
      { text: 'Compensation connected with termination of employment that is not salary is taxed as income from other sources (section 92(2)(j)).', slideId: 's91' },
      { text: 'Family pension received by members of a deceased employee’s family is not salary; it is income from other sources.', slideId: 's88' },
    ],
    slides: ['s80', 's52', 's88', 's102'],
  },
]

const HEAD_BY_ID = new Map(HEADS.map((h) => [h.id, h]))

/** Seven steps from s81; the third is where the heads come in. */
const STEPS = [
  'Determine residential status (section 6) and the scope of income (section 5).',
  'Leave out exempt income (sections 11 and 12 with the Schedules).',
  'Compute income under each head, with the deductions allowed under that head.',
  'Add the income of other persons included by sections 96 to 100 (clubbing).',
  'Set off losses and brought forward losses (sections 108 to 121), giving the gross total income (section 122(10)).',
  'Subtract Chapter VIII deductions, unless the new regime bars them, giving the total income, rounded off under section 516.',
  'Apply the rates, then the rebate and reliefs, surcharge and cess, and credit for tax deducted or collected at source and advance tax.',
]

/* "Which head?" items, each decided by the notes. */
interface QuizItem {
  id: string
  text: string
  answer: HeadId
  why: string
  slideId: string
}

const QUIZ_ITEMS: QuizItem[] = [
  { id: 'q-shops', text: 'Rent from shops and stalls built by a company dealing in land', answer: 'house', why: 'East India Housing: taxable under the property head, whatever the object of the company.', slideId: 's80' },
  {
    id: 'q-partner',
    text: 'Interest and remuneration a partner receives from his firm, to the extent allowed to the firm',
    answer: 'business',
    why: 'A partner’s remuneration is not salary (section 15(4)); it is business income under section 26(2)(g) to the extent allowed to the firm under section 35(e).',
    slideId: 's109',
  },
  {
    id: 'q-family',
    text: 'Family pension received by the family of a deceased employee',
    answer: 'other',
    why: 'It is not salary, because the recipient was not the employee; it is income from other sources.',
    slideId: 's88',
  },
  { id: 'q-dividend', text: 'Dividend income', answer: 'other', why: 'Dividends are taxable under other sources (section 92(2)(a)).', slideId: 's129' },
  {
    id: 'q-letting',
    text: 'Rent from letting out a residential house, received by its owner',
    answer: 'house',
    why: 'Section 26(4) makes it chargeable only as income from house property.',
    slideId: 's102',
  },
  { id: 'q-arrears', text: 'Arrears of salary paid in the tax year, not taxed earlier', answer: 'salaries', why: 'Section 15 charges arrears of salary paid or allowed in the tax year, if not taxed earlier.', slideId: 's86' },
  {
    id: 'q-manufacture',
    text: 'A sum received on transferring the right to manufacture',
    answer: 'capital',
    why: 'Section 26(2)(h) taxes non compete receipts as business income, except a transfer of the right to manufacture or carry on business, which is taxable as capital gains.',
    slideId: 's109',
  },
  {
    id: 'q-termination',
    text: 'Compensation from an employer in connection with the termination of employment',
    answer: 'salaries',
    why: 'Section 18(1) includes it in “profits in lieu of salary”.',
    slideId: 's91',
  },
  {
    id: 'q-gift',
    text: 'Sums of money received without consideration, totalling more than Rs. 50,000 in the tax year',
    answer: 'other',
    why: 'Section 92(2)(m) taxes them under other sources.',
    slideId: 's52',
  },
  {
    id: 'q-agency',
    text: 'Compensation received in connection with the termination of an agency held in India',
    answer: 'business',
    why: 'Section 26(2)(b) now taxes compensation for termination of a management, agency or business contract as business income, reversing Kettlewell Bullen for these cases.',
    slideId: 's109',
  },
]

/* Hub geometry: angles start at the top and go clockwise. Positions are % of the hub box (aspect 1 : 0.92). */
const POS: Record<HeadId, { x: number; y: number }> = (() => {
  const out = {} as Record<HeadId, { x: number; y: number }>
  HEADS.forEach((h, i) => {
    const a = (-90 + i * 72) * (Math.PI / 180)
    out[h.id] = { x: 50 + 34 * Math.cos(a), y: 50 + 40 * Math.sin(a) }
  })
  return out
})()

const VB_H = 92

export default function HeadsTool() {
  const rootRef = useRef<HTMLDivElement>(null)
  const width = useElementWidth(rootRef)
  const radial = width >= 620
  const sidePanel = width >= 980
  const [selected, setSelected] = useState<NodeId>('total')
  const [mode, setMode] = useState<'explore' | 'quiz'>('explore')
  const titleId = useId()

  return (
    <div ref={rootRef} className="lv-tool lv-heads" style={unitVars('u4')}>
      <section className="lv-card lv-stack" aria-labelledby={titleId}>
        <div className="lv-spread">
          <div>
            <h3 id={titleId} className="lv-h">
              Five heads, one total
            </h3>
            <p className="lv-lead">
              Section 13 sorts all income into five mutually exclusive heads. Tap a head for its charging provision and key points, or test yourself.
            </p>
          </div>
          <div className="segmented" role="group" aria-label="Mode">
            <button type="button" aria-pressed={mode === 'explore'} onClick={() => setMode('explore')}>
              Explore
            </button>
            <button type="button" aria-pressed={mode === 'quiz'} onClick={() => setMode('quiz')}>
              Which head?
            </button>
          </div>
        </div>
        <SectionRuler selected={selected} onSelect={(id) => setSelected(id)} />
        <p className="sr-only" aria-live="polite">
          {mode === 'explore' ? `Showing ${selected === 'total' ? 'Total income' : HEAD_BY_ID.get(selected)?.name}` : ''}
        </p>
      </section>

      {mode === 'explore' ? (
        <LayoutGroup id="lv-heads">
          {radial ? (
            <div className={`lv-heads__layout${sidePanel ? ' is-wide' : ''}`}>
              <section className="lv-card" aria-label="Heads of income diagram">
                <Hub selected={selected} onSelect={setSelected} />
                <p className="lv-cite" style={{ justifyContent: 'center', marginTop: 10 }}>
                  Coloured heads each have a unit of their own: IV, V and VI.
                </p>
              </section>
              <AnimatePresence mode="wait" initial={false}>
                <motion.div
                  key={selected}
                  initial={{ opacity: 0, y: 14 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8, transition: { duration: 0.15 } }}
                  transition={softSpring}
                >
                  {selected === 'total' ? <TotalDetail /> : <HeadDetail head={HEAD_BY_ID.get(selected)!} />}
                </motion.div>
              </AnimatePresence>
            </div>
          ) : (
            <StackedList selected={selected} onSelect={setSelected} />
          )}
        </LayoutGroup>
      ) : (
        <WhichHead radial={radial} />
      )}
    </div>
  )
}

function SectionRuler({ selected, onSelect }: { selected: NodeId; onSelect: (id: HeadId) => void }) {
  const first = HEADS.map((h) => h.sections.replace('Sections ', '').replace(' to ', '–'))
  return (
    <div className="lv-ruler">
      <p className="eyebrow">Chapter IV, sections 13 to 95: where each head sits</p>
      <div className="lv-ruler__bar">
        {HEADS.map((h, i) => (
          <motion.button
            key={h.id}
            type="button"
            className="lv-ruler__seg"
            data-head={h.id}
            style={{ flexGrow: h.count, flexBasis: 0 }}
            aria-pressed={selected === h.id}
            aria-label={`${h.name}, ${h.sections}`}
            title={`${h.name}: ${h.sections}`}
            onClick={() => onSelect(h.id)}
            initial={{ scaleX: 0 }}
            animate={{ scaleX: 1 }}
            transition={{ duration: 0.55, ease: easeOut, delay: 0.1 + i * 0.09 }}
          >
            {h.count >= 20 ? first[i] : ''}
          </motion.button>
        ))}
      </div>
      <ul className="lv-ruler__legend">
        {HEADS.map((h, i) => (
          <li key={h.id} data-head={h.id}>
            <b>{first[i]}</b> {h.name}
          </li>
        ))}
      </ul>
    </div>
  )
}

function Hub({ selected, onSelect, quiz }: { selected: NodeId | null; onSelect: (id: NodeId) => void; quiz?: { chosen?: HeadId; answer?: HeadId } }) {
  const reduce = useReducedMotion()
  return (
    <div className="lv-hub">
      <svg className="lv-hub__svg" viewBox={`0 0 100 ${VB_H}`} aria-hidden="true">
        {HEADS.map((h, i) => {
          const p = POS[h.id]
          const y = (p.y * VB_H) / 100
          const active = selected === h.id || quiz?.answer === h.id
          return (
            <g key={h.id} data-head={h.id}>
              <motion.line
                x1={50}
                y1={VB_H / 2}
                x2={p.x}
                y2={y}
                stroke="var(--h)"
                strokeLinecap="round"
                initial={{ pathLength: 0, opacity: 0 }}
                animate={{ pathLength: 1, opacity: active ? 1 : 0.35, strokeWidth: active ? 0.9 : 0.45 }}
                transition={{
                  pathLength: { duration: 0.6, ease: easeOut, delay: 0.15 + i * 0.08 },
                  opacity: { duration: 0.25 },
                  strokeWidth: { duration: 0.25 },
                }}
              />
              {!reduce && (
                <motion.circle
                  r={active ? 1.1 : 0.7}
                  fill="var(--h)"
                  initial={{ cx: p.x, cy: y, opacity: 0 }}
                  animate={{ cx: [p.x, 50], cy: [y, VB_H / 2], opacity: [0, 1, 1, 0] }}
                  transition={{ duration: 1.8, ease: 'easeInOut', repeat: Infinity, repeatDelay: 0.6, delay: 0.8 + i * 0.35 }}
                />
              )}
            </g>
          )
        })}
      </svg>

      <button
        type="button"
        className="lv-hub__node lv-hub__centre"
        data-head="total"
        style={{ left: '50%', top: '50%' }}
        aria-pressed={selected === 'total'}
        onClick={() => onSelect('total')}
      >
        {selected === 'total' && <motion.span layoutId="lv-heads-ring" className="lv-hub__ring" transition={spring} />}
        <span className="lv-hub__icon" style={{ background: 'var(--u4)' }} aria-hidden="true">
          <Sigma size={20} />
        </span>
        <span className="lv-hub__name">Total income</span>
        <span className="lv-hub__secs">Section 2(108)</span>
      </button>

      {HEADS.map((h, i) => {
        const p = POS[h.id]
        const state = quiz?.answer ? (h.id === quiz.answer ? 'is-right' : h.id === quiz.chosen ? 'is-wrong' : '') : ''
        return (
          <motion.button
            key={h.id}
            type="button"
            className={`lv-hub__node ${state}`}
            data-head={h.id}
            style={{ left: `${p.x}%`, top: `${p.y}%`, x: '-50%', y: '-50%' }}
            aria-pressed={quiz ? undefined : selected === h.id}
            aria-label={`${h.name}, ${h.sections}`}
            onClick={() => onSelect(h.id)}
            initial={{ opacity: 0, scale: 0.85 }}
            animate={{ opacity: 1, scale: 1, transition: { ...softSpring, delay: 0.1 + i * 0.07 } }}
            whileHover={{ scale: 1.04 }}
            whileTap={{ scale: 0.97 }}
            transition={spring}
          >
            {selected === h.id && !quiz && <motion.span layoutId="lv-heads-ring" className="lv-hub__ring" transition={spring} />}
            {quiz?.answer && (h.id === quiz.answer || h.id === quiz.chosen) && (
              <span className="lv-hub__ring" style={{ borderColor: h.id === quiz.answer ? 'var(--ok)' : 'var(--bad)' }} />
            )}
            <span className="lv-hub__icon" aria-hidden="true">
              <h.icon size={19} />
            </span>
            <span className="lv-hub__name">{h.short}</span>
            <span className="lv-hub__secs">{h.sections}</span>
          </motion.button>
        )
      })}
    </div>
  )
}

function HeadDetail({ head }: { head: Head }) {
  return (
    <article className="lv-detail" data-head={head.id} aria-label={head.name}>
      <div className="lv-detail__head">
        <motion.span className="lv-hub__icon" style={{ width: 48, height: 48 }} aria-hidden="true" initial={{ scale: 0.6, rotate: -12 }} animate={{ scale: 1, rotate: 0 }} transition={spring}>
          <head.icon size={22} />
        </motion.span>
        <div>
          <div className="lv-row" style={{ gap: 6 }}>
            <span className="lv-cite">{head.sections}</span>
            {head.unitId && <UnitPill unitId={head.unitId} />}
          </div>
          <h4 className="lv-detail__title">{head.name}</h4>
        </div>
      </div>
      <div className="lv-charge">
        <p className="lv-charge__label">{head.chargeLabel}</p>
        <p className="lv-charge__text">{head.charge}</p>
      </div>
      <p className="lv-levy__text">{head.covers}</p>
      <div className="lv-stack" style={{ gap: 8 }}>
        <p className="eyebrow">Key points</p>
        <ul className="lv-points">
          {head.points.map((p, i) => (
            <motion.li key={p.text} initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} transition={{ ...softSpring, delay: 0.12 + i * 0.06 }}>
              <span>{p.text}</span>
            </motion.li>
          ))}
        </ul>
      </div>
      <div className="lv-row">
        {head.slides.map((s) => (
          <SourceLink key={s} slideId={s} />
        ))}
      </div>
    </article>
  )
}

function TotalDetail() {
  return (
    <article className="lv-detail" data-head="total" aria-label="Total income">
      <div className="lv-detail__head">
        <span className="lv-hub__icon" style={{ width: 48, height: 48, background: 'var(--u4)' }} aria-hidden="true">
          <Sigma size={22} />
        </span>
        <div>
          <span className="lv-cite">Section 2(108) · section 13</span>
          <h4 className="lv-detail__title">Total income</h4>
        </div>
      </div>
      {/* s81, s80 */}
      <div className="lv-charge" style={{ borderLeftColor: 'var(--u4)' }}>
        <p className="lv-charge__label" style={{ color: 'var(--u4)' }}>
          Definition
        </p>
        <p className="lv-charge__text">Total income is the income referred to in section 5, computed in the manner laid down in the Act (section 2(108)).</p>
      </div>
      <p className="lv-levy__text">
        The heads are <strong>mutually exclusive</strong>. Each has its own computation rules, and income that falls under a specific head must be computed under it.
      </p>
      <div className="lv-tip">
        <HelpCircle size={17} aria-hidden="true" />
        <span>
          <em>United Commercial Bank Ltd. v. CIT</em> (1957): interest on securities held by a bank as part of its business had to be computed under the specific head
          then provided for interest on securities, not as business income. Each head deals with a particular source.
        </span>
      </div>
      <div className="lv-stack" style={{ gap: 8 }}>
        <p className="eyebrow">How total income is computed</p>
        <ol className="lv-steps">
          {STEPS.map((s, i) => (
            <motion.li key={s} className={i === 2 ? 'is-key' : undefined} initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} transition={{ ...softSpring, delay: 0.1 + i * 0.05 }}>
              <span>
                {s}
                {i === 2 && <strong> The five heads come in here.</strong>}
              </span>
            </motion.li>
          ))}
        </ol>
      </div>
      <div className="lv-row">
        <SourceLink slideId="s80" />
        <SourceLink slideId="s81" />
      </div>
    </article>
  )
}

function StackedList({ selected, onSelect }: { selected: NodeId; onSelect: (id: NodeId) => void }) {
  const items: NodeId[] = ['total', ...HEADS.map((h) => h.id)]
  return (
    <ul className="lv-hlist" aria-label="Heads of income">
      {items.map((id, i) => {
        const head = id === 'total' ? null : HEAD_BY_ID.get(id)!
        const open = selected === id
        const Icon = head ? head.icon : Sigma
        return (
          <motion.li key={id} layout="position" className="lv-hlist__item" data-head={id} transition={softSpring}>
            <motion.button
              layout="position"
              type="button"
              className="lv-hbtn"
              aria-expanded={open}
              onClick={() => onSelect(open && id !== 'total' ? 'total' : id)}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ ...softSpring, delay: i * 0.05 }}
            >
              <span className="lv-hub__icon" style={id === 'total' ? { background: 'var(--u4)' } : undefined} aria-hidden="true">
                <Icon size={20} />
              </span>
              <span>
                <span className="lv-hbtn__name">{head ? head.name : 'Total income'}</span>
                <span className="lv-hub__secs" style={{ display: 'block', marginTop: 2 }}>
                  {head ? head.sections : 'Section 2(108)'}
                </span>
              </span>
              <motion.span animate={{ rotate: open ? 180 : 0 }} transition={spring} aria-hidden="true">
                <ChevronDown size={18} />
              </motion.span>
            </motion.button>
            <AnimatePresence initial={false}>
              {open && (
                <motion.div key="d" initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, transition: { duration: 0.12 } }} transition={softSpring}>
                  {head ? <HeadDetail head={head} /> : <TotalDetail />}
                </motion.div>
              )}
            </AnimatePresence>
          </motion.li>
        )
      })}
    </ul>
  )
}

function WhichHead({ radial }: { radial: boolean }) {
  const [order, setOrder] = useState<string[]>(() => shuffle(QUIZ_ITEMS.map((q) => q.id)))
  const [pos, setPos] = useState(0)
  const [answers, setAnswers] = useState<Record<string, HeadId>>({})
  const byId = useMemo(() => new Map(QUIZ_ITEMS.map((q) => [q.id, q])), [])
  const item = pos < order.length ? byId.get(order[pos]) : undefined
  const chosen = item ? answers[item.id] : undefined
  const score = order.filter((id) => answers[id] && answers[id] === byId.get(id)?.answer).length
  const name = (id: HeadId) => HEAD_BY_ID.get(id)?.name ?? id

  const choose = (id: NodeId) => {
    if (!item || chosen || id === 'total') return
    setAnswers((a) => ({ ...a, [item.id]: id }))
  }
  const restart = () => {
    setOrder(shuffle(QUIZ_ITEMS.map((q) => q.id)))
    setPos(0)
    setAnswers({})
  }

  if (!item) {
    const ratio = score / order.length
    return (
      <motion.section className="lv-card lv-stack" initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} transition={softSpring} aria-label="Score">
        <div className="lv-score" role="status">
          <ProgressRing value={ratio} size={78} stroke={8} color={ratio >= 0.8 ? 'var(--ok)' : 'var(--unit)'} label={`${score} of ${order.length} right`}>
            <strong>
              {score}/{order.length}
            </strong>
          </ProgressRing>
          <div>
            <p className="lv-display">{ratio === 1 ? 'Every item in the right head.' : 'Good practice. Go again?'}</p>
            <p className="lv-muted">The heads are mutually exclusive: each income belongs to one of them.</p>
          </div>
        </div>
        <div className="lv-row">
          <button type="button" className="btn btn-unit" onClick={restart}>
            <RotateCcw size={16} aria-hidden="true" /> Play again
          </button>
        </div>
      </motion.section>
    )
  }

  const right = chosen === item.answer
  return (
    <section className="lv-card lv-whichhead" aria-label="Which head?">
      <div className="lv-spread">
        <p className="eyebrow">
          Item {pos + 1} of {order.length} · {score} right
        </p>
        <div className="bar" style={{ flex: '1 1 140px', maxWidth: 280 }} aria-hidden="true">
          <span style={{ width: `${(Object.keys(answers).length / order.length) * 100}%` }} />
        </div>
      </div>
      <AnimatePresence mode="wait">
        <motion.p
          key={item.id}
          className="lv-whichhead__prompt"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8, transition: { duration: 0.14 } }}
          transition={softSpring}
        >
          Under which head is this charged? <strong>{item.text}</strong>
        </motion.p>
      </AnimatePresence>

      {radial ? (
        <Hub selected={null} onSelect={choose} quiz={{ chosen, answer: chosen ? item.answer : undefined }} />
      ) : (
        <div className="lv-headpick" role="group" aria-label="Heads">
          {HEADS.map((h) => {
            const state = chosen ? (h.id === item.answer ? 'is-right' : h.id === chosen ? 'is-wrong' : '') : ''
            return (
              <button key={h.id} type="button" data-head={h.id} className={`lv-choice ${state}`} disabled={!!chosen} onClick={() => choose(h.id)}>
                <span className="lv-hub__icon" aria-hidden="true">
                  <h.icon size={16} />
                </span>
                <span>{h.name}</span>
              </button>
            )
          })}
        </div>
      )}

      <AnimatePresence mode="wait">
        {chosen && (
          <motion.div
            key={item.id}
            className={`lv-feedback ${right ? 'is-right' : 'is-wrong'}`}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, transition: { duration: 0.12 } }}
            transition={softSpring}
            role="status"
          >
            <p className="lv-feedback__title">
              {right ? <Check size={18} aria-hidden="true" /> : <X size={18} aria-hidden="true" />}
              {right ? `Right: ${name(item.answer)}.` : `It goes under ${name(item.answer)}, not ${name(chosen)}.`}
            </p>
            <p className="lv-feedback__why">{item.why}</p>
            <div className="lv-spread">
              <SourceLink slideId={item.slideId} />
              <button type="button" className="btn btn-unit" onClick={() => setPos((p) => p + 1)} autoFocus>
                {pos === order.length - 1 ? 'See my score' : 'Next item'} <ArrowRight size={16} aria-hidden="true" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  )
}
