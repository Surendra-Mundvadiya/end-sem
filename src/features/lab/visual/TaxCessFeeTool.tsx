import './visual.css'
import { useId, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion, type PanInfo } from 'framer-motion'
import {
  ArrowRight,
  Ban,
  Check,
  Hand,
  HandCoins,
  Landmark,
  Lightbulb,
  PiggyBank,
  RotateCcw,
  Share2,
  Tag,
  Target,
  UserRound,
  Wrench,
  X,
  type LucideIcon,
} from 'lucide-react'
import ProgressRing from '../../../components/ProgressRing'
import { CASES, slideById, unitVars } from '../../../data'
import { bouncy, easeOut, softSpring, spring } from '../../../lib/motion'
import { shuffle } from '../../../lib/text'
import { casesHtml, SourceLink, useHotkeys } from './ui'

/*
 * Tax, cess and fee (Unit I, part 10). Every statement is taken from s0, s12, s13, s14 (and s3, s10, s17, s20, s21, s23
 * where noted). Where the notes are silent, the cell says so instead of filling the gap.
 */

type LevyId = 'tax' | 'cess' | 'fee'
type Icon = LucideIcon

const LEVIES: { id: LevyId; name: string; hook: string; def: string; defSlide: string; icon: Icon }[] = [
  {
    id: 'tax',
    name: 'Tax',
    hook: 'A common burden', // s12
    def: 'A compulsory exaction of money by a public authority for public purposes, enforceable by law, and not a payment for services rendered.', // s0 (Shirur Mutt, adopting Latham C.J.)
    defSlide: 's0',
    icon: Landmark,
  },
  {
    id: 'cess',
    name: 'Cess',
    hook: 'For a specified purpose', // s14
    def: 'A levy for a specific purpose, usually charged as an addition to an existing tax, such as the Health and Education Cess that the Finance Acts levy on income tax.', // s13
    defSlide: 's13',
    icon: Target,
  },
  {
    id: 'fee',
    name: 'Fee',
    hook: 'Payment for a special benefit', // s12
    def: 'A charge for a special service rendered to individuals by a governmental agency.', // s12 (Shirur Mutt)
    defSlide: 's12',
    icon: HandCoins,
  },
]

type DimId = 'purpose' | 'qpq' | 'money' | 'entry' | 'bill' | 'cases'

const DIMS: { id: DimId; label: string }[] = [
  { id: 'purpose', label: 'Purpose' },
  { id: 'qpq', label: 'Quid pro quo' },
  { id: 'money', label: 'Where the money goes' },
  { id: 'entry', label: 'Legislative entry' },
  { id: 'bill', label: 'Money Bill' },
  { id: 'cases', label: 'Leading cases' },
]

interface FlowStep {
  title: string
  text: string
  icon: Icon
  blocked?: boolean
}

interface Cell {
  /** Plain text; null means the notes are silent on this point. */
  text: string | null
  flow?: FlowStep[]
  cases?: { name: string; held: string }[]
}

function caseByName(fragment: string) {
  const c = CASES.find((x) => x.name.includes(fragment))
  return c ? { name: c.name, held: c.held } : null
}

function buildCells(): Record<DimId, Record<LevyId, Cell>> {
  const liberty = caseByName('Liberty Cinema') // s12
  const kewal = caseByName('Kewal Krishan Puri') // s12
  const sreeni = caseByName('Sreenivasa General Traders') // s12
  const hingir = caseByName('Hingir Rampur') // s13
  const india = caseByName('India Cement') // s13
  const keep = (xs: ({ name: string; held: string } | null)[]) => xs.filter((x): x is { name: string; held: string } => x !== null)
  return {
    purpose: {
      tax: { text: 'For general purposes. The proceeds go to the Consolidated Fund (Article 266) and meet general public needs.' }, // s14, s0
      cess: { text: 'For a specified purpose, usually charged as an addition to an existing tax.' }, // s14, s13
      fee: { text: 'For a special service: it is levied in consideration of a service that individuals accept, willingly or unwillingly.' }, // s14, s12
    },
    qpq: {
      tax: { text: 'None. The payer cannot demand a special service in return.' }, // s14, s0
      cess: { text: 'None for a cess that is a tax. A cess is normally a tax, but it can be a fee if it has the character of a fee.' }, // s14, s13
      fee: { text: 'A broad correlation with the services, not an exact one. A regulatory fee, charged to regulate a trade, does not need a strict quid pro quo.' }, // s14, s12
    },
    money: {
      tax: {
        text: 'Union taxes are generally shared with the States under Article 270; income tax and corporation tax are shared under it.', // s14, s21
        flow: [
          { title: 'The payer', text: 'pays because the law compels it.', icon: UserRound }, // s0
          { title: 'Consolidated Fund', text: '(Article 266), to meet general public needs.', icon: PiggyBank }, // s0
          { title: 'Shared with the States', text: 'under Article 270.', icon: Share2 }, // s14
        ],
      },
      cess: {
        text: 'Because cesses and surcharges are outside the divisible pool, a larger use of them reduces the States’ share of total Union revenue.', // s23
        flow: [
          { title: 'The payer', text: 'pays it on top of an existing tax.', icon: UserRound }, // s13
          { title: 'The specified purpose', text: 'for which it was levied.', icon: Target }, // s14
          { title: 'Not shared', text: 'Article 270(1) excludes any cess levied for specific purposes from the taxes shared with the States.', icon: Ban, blocked: true }, // s13
        ],
      },
      fee: {
        text: 'Separate earmarking is a relevant sign rather than an absolute condition, because Article 266 requires all revenues to be credited to the Consolidated Fund.', // s12
        flow: [
          { title: 'The person served', text: 'pays for a special service.', icon: UserRound }, // s12
          { title: 'Cost of the service', text: 'the amount is meant to meet it rather than go to general revenue.', icon: Wrench }, // s12
          { title: 'Earmarking', text: 'a sign, not a condition.', icon: Tag }, // s12
        ],
      },
    },
    entry: {
      tax: { text: 'Taxes need a taxing entry. A power to legislate on a subject does not include a power to tax it unless there is a taxing entry.' }, // s14, s17 (M.P.V. Sundararamier)
      cess: { text: null },
      fee: { text: 'Fees fall under the fee entries: Entry 96 of List I, Entry 66 of List II and Entry 47 of List III.' }, // s14, s12
    },
    bill: {
      tax: { text: 'A Bill imposing a tax is a Money Bill. The Income Tax (No. 2) Bill, 2025 was passed in the Lok Sabha as a Money Bill.' }, // s14, s10
      cess: { text: null },
      fee: { text: 'A Bill providing only for fees is not a Money Bill. Under Article 110(2), a Bill is not a Money Bill merely because it provides for fees for licences or services.' }, // s14, s12
    },
    cases: {
      tax: {
        text: 'Shirur Mutt (AIR 1954 SC 282): Mukherjea J. adopted the definition given by Latham C.J. in Matthews v. Chicory Marketing Board (1938) 60 CLR 263.', // s0
        cases: keep([liberty]),
      },
      cess: { text: null, cases: keep([hingir, india]) },
      fee: { text: 'Shirur Mutt identified the two elements of a fee: a service accepted by individuals, and an amount meant to meet its cost.', cases: keep([kewal, sreeni]) }, // s12
    },
  }
}

/* ---------- sort game ---------- */

interface SortCard {
  id: string
  text: string
  answer: LevyId
  why: string
  slideId: string
  trick?: boolean
}

const EXAMPLES: SortCard[] = [
  {
    id: 'e-income',
    text: 'Income tax charged on total income under the Income Tax Act, 2025',
    answer: 'tax',
    why: 'A compulsory payment for public purposes with no quid pro quo. Income tax is shared with the States under Article 270.', // s0, s21
    slideId: 's0',
  },
  {
    id: 'e-gst',
    text: 'GST',
    answer: 'tax',
    why: 'An indirect tax, which can be passed on to others through prices; Parliament and the States levy it under Article 246A.', // s3
    slideId: 's3',
  },
  {
    id: 'e-profession',
    text: 'Tax on professions, trades and employments payable to a State and its local bodies',
    answer: 'tax',
    why: 'It has a taxing entry (Entry 60 of List II), and under Article 276 the total payable by one person to a State and its local bodies cannot exceed Rs. 2,500 a year.', // s17, s20
    slideId: 's20',
  },
  {
    id: 'e-liberty',
    text: 'A levy called a “licence fee”, for which no service is rendered',
    answer: 'tax',
    trick: true,
    why: 'Corporation of Calcutta v. Liberty Cinema: it was in substance a tax. The label does not decide the nature of a levy.', // s12
    slideId: 's12',
  },
  {
    id: 'e-hec',
    text: 'The Health and Education Cess that the Finance Acts levy on income tax',
    answer: 'cess',
    why: 'A levy for a specific purpose added to an existing tax. Article 270(1) keeps such cesses out of the taxes shared with the States.', // s13
    slideId: 's13',
  },
  {
    id: 'e-market',
    text: 'A market fee, a good and substantial portion of which is spent for the special benefit of the payers',
    answer: 'fee',
    why: 'Kewal Krishan Puri v. State of Punjab: a market fee must bear a close and reasonable relationship to services rendered to the payers.', // s12
    slideId: 's12',
  },
  {
    id: 'e-regulatory',
    text: 'A regulatory fee charged to regulate a trade',
    answer: 'fee',
    why: 'A regulatory fee is a fee, and it does not need a strict quid pro quo.', // s12
    slideId: 's12',
  },
  {
    id: 'e-hingir',
    text: 'A cess on mine owners, credited to a fund for developing mining areas',
    answer: 'fee',
    trick: true,
    why: 'Hingir Rampur Coal Co. v. State of Orissa: held to be a fee, because it was linked to services that benefited the payers. A cess can be a fee if it has the character of a fee.', // s13
    slideId: 's13',
  },
]

const CLUES: SortCard[] = [
  { id: 'c-common', text: 'A common burden', answer: 'tax', why: '“A tax is a common burden, while a fee is payment for a special benefit.”', slideId: 's12' }, // s12
  { id: 'c-benefit', text: 'Payment for a special benefit', answer: 'fee', why: '“A tax is a common burden, while a fee is payment for a special benefit.”', slideId: 's12' }, // s12
  {
    id: 'c-specific',
    text: 'Levied for a specified purpose, usually as an addition to an existing tax',
    answer: 'cess',
    why: 'A cess is a levy for a specific purpose, usually charged as an addition to an existing tax.', // s13, s14
    slideId: 's13',
  },
  {
    id: 'c-broad',
    text: 'A broad and general correlation with the services is enough',
    answer: 'fee',
    why: 'Sreenivasa General Traders: the correlation between a fee and the services need not be exact.', // s12
    slideId: 's12',
  },
  {
    id: 'c-excluded',
    text: 'Excluded by Article 270(1) from the taxes shared with the States',
    answer: 'cess',
    why: 'Article 270(1) excludes “any cess levied for specific purposes” from the taxes shared with the States.', // s13
    slideId: 's13',
  },
  { id: 'c-money', text: 'A Bill imposing it is a Money Bill', answer: 'tax', why: 'A Bill imposing a tax is a Money Bill; a Bill providing only for fees is not.', slideId: 's14' }, // s14
  {
    id: 'c-notmoney',
    text: 'A Bill providing only for it is not a Money Bill',
    answer: 'fee',
    why: 'Under Article 110(2), a Bill providing only for fees is not a Money Bill.', // s14, s12
    slideId: 's14',
  },
  {
    id: 'c-entries',
    text: 'Has its own entries: Entry 96 of List I, Entry 66 of List II and Entry 47 of List III',
    answer: 'fee',
    why: 'These are the fee entries in the three Lists.', // s12
    slideId: 's12',
  },
  {
    id: 'c-shared',
    text: 'Generally shared with the States under Article 270',
    answer: 'tax',
    why: 'Union taxes are generally shared under Article 270; cesses for specific purposes and surcharges are not.', // s14
    slideId: 's14',
  },
  {
    id: 'c-shrinks',
    text: 'Relying on it more shrinks the States’ share of total Union revenue',
    answer: 'cess',
    why: 'Cesses (and surcharges) are outside the divisible pool, so a larger use of them reduces the States’ share of total Union revenue even when their percentage share of the pool stays the same.', // s23
    slideId: 's23',
  },
  {
    id: 'c-normally',
    text: 'Normally a tax, but it can be a fee if it has the character of a fee',
    answer: 'cess',
    why: 'That is how the notes describe a cess; Hingir Rampur is the example of one held to be a fee.', // s13
    slideId: 's13',
  },
]

const DECKS = { examples: EXAMPLES, clues: CLUES }
type DeckId = keyof typeof DECKS

export default function TaxCessFeeTool() {
  const cells = useMemo(buildCells, [])
  const [dim, setDim] = useState<DimId | 'all'>('purpose')
  const dimLabel = useId()
  const focusHtml = useMemo(() => slideById('s14')?.html.match(/<aside class="focus">[\s\S]*?<\/aside>/)?.[0] ?? '', [])
  const shown: DimId[] = dim === 'all' ? DIMS.map((d) => d.id) : [dim]

  return (
    <div className="lv-tool lv-tcf" style={unitVars('u1')}>
      <section className="lv-card lv-stack" aria-labelledby={dimLabel}>
        <div>
          <h3 id={dimLabel} className="lv-h">
            Three levies, side by side
          </h3>
          <p className="lv-lead">Pick a point of difference. The three columns change together, so you compare like with like.</p>
        </div>
        <div className="lv-wrapchips" role="group" aria-labelledby={dimLabel}>
          {DIMS.map((d) => (
            <button key={d.id} type="button" className="chip" aria-pressed={dim === d.id} onClick={() => setDim(d.id)}>
              {d.label}
            </button>
          ))}
          <button type="button" className="chip" aria-pressed={dim === 'all'} onClick={() => setDim('all')}>
            All points
          </button>
        </div>
        <div className="lv-tcf__cols">
          {LEVIES.map((lv, col) => (
            <motion.article
              key={lv.id}
              className="lv-levy"
              data-levy={lv.id}
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ ...softSpring, delay: col * 0.08 }}
              aria-label={lv.name}
            >
              <div className="lv-levy__head">
                <span className="lv-levy__icon" aria-hidden="true">
                  <lv.icon size={22} />
                </span>
                <div>
                  <h4 className="lv-levy__name">{lv.name}</h4>
                  <p className="lv-levy__hook">{lv.hook}</p>
                </div>
              </div>
              <p className="lv-levy__def">{lv.def}</p>
              <AnimatePresence mode="wait" initial={false}>
                <motion.div
                  key={dim}
                  className="lv-stack"
                  style={{ gap: 10 }}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0, transition: { duration: 0.32, ease: easeOut, delay: col * 0.07 } }}
                  exit={{ opacity: 0, y: -6, transition: { duration: 0.14 } }}
                >
                  {shown.map((d) => (
                    <CellView key={d} label={DIMS.find((x) => x.id === d)?.label ?? ''} cell={cells[d][lv.id]} />
                  ))}
                </motion.div>
              </AnimatePresence>
              <div className="lv-row">
                <SourceLink slideId={lv.defSlide} />
              </div>
            </motion.article>
          ))}
        </div>
        {focusHtml && <div className="notes" dangerouslySetInnerHTML={{ __html: focusHtml }} />}
        <div className="lv-row">
          <SourceLink slideId="s14" />
        </div>
      </section>

      <SortGame />
    </div>
  )
}

function CellView({ label, cell }: { label: string; cell: Cell }) {
  return (
    <div className="lv-levy__cell">
      <p className="lv-levy__label">{label}</p>
      {cell.flow && <Flow steps={cell.flow} />}
      {cell.text ? (
        <p className="lv-levy__text">{cell.text}</p>
      ) : (
        !cell.cases?.length && <p className="lv-levy__text is-silent">The notes do not state a separate rule here.</p>
      )}
      {cell.cases && cell.cases.length > 0 && <div className="notes" dangerouslySetInnerHTML={{ __html: casesHtml(cell.cases) }} />}
    </div>
  )
}

function Flow({ steps }: { steps: FlowStep[] }) {
  const reduce = useReducedMotion()
  return (
    <div className="lv-flow" role="list">
      {steps.map((s, i) => {
        const next = steps[i + 1]
        return (
          <motion.div
            key={s.title}
            role="listitem"
            className="lv-flow__step"
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ ...softSpring, delay: 0.1 + i * 0.12 }}
          >
            {next && (
              <span className={`lv-flow__line${next.blocked ? ' is-blocked' : ''}`} aria-hidden="true">
                {!next.blocked && !reduce && (
                  <motion.span
                    className="lv-flow__coin"
                    initial={{ y: '-100%' }}
                    animate={{ y: '0%' }}
                    transition={{ duration: 1.3, ease: 'linear', repeat: Infinity, repeatDelay: 0.25, delay: i * 0.6 }}
                  />
                )}
              </span>
            )}
            <span className={`lv-flow__dot${s.blocked ? ' is-blocked' : ''}`} aria-hidden="true">
              <s.icon size={12} strokeWidth={2.5} />
            </span>
            <p className="lv-flow__text">
              <strong>{s.title}</strong> {s.text}
            </p>
          </motion.div>
        )
      })}
    </div>
  )
}

function SortGame() {
  const [deckId, setDeckId] = useState<DeckId>('examples')
  const deck = DECKS[deckId]
  const [order, setOrder] = useState<string[]>(() => shuffle(EXAMPLES.map((c) => c.id)))
  const [pos, setPos] = useState(0)
  const [answers, setAnswers] = useState<Record<string, LevyId>>({})
  const [hover, setHover] = useState<LevyId | null>(null)
  const binRefs = useRef<Partial<Record<LevyId, HTMLButtonElement | null>>>({})
  const titleId = useId()

  const byId = useMemo(() => new Map(deck.map((c) => [c.id, c])), [deck])
  const current = pos < order.length ? byId.get(order[pos]) : undefined
  const chosen = current ? answers[current.id] : undefined
  const done = pos >= order.length
  const correct = order.filter((id) => answers[id] && answers[id] === byId.get(id)?.answer).length
  const answeredCount = Object.keys(answers).length

  const restart = (next: DeckId = deckId) => {
    setDeckId(next)
    setOrder(shuffle(DECKS[next].map((c) => c.id)))
    setPos(0)
    setAnswers({})
    setHover(null)
  }

  const choose = (bin: LevyId) => {
    if (!current || chosen) return
    setAnswers((a) => ({ ...a, [current.id]: bin }))
  }
  const next = () => {
    if (!chosen) return
    setPos((p) => p + 1)
  }

  useHotkeys((e) => {
    if (done) return
    const map: Record<string, LevyId> = { '1': 'tax', '2': 'cess', '3': 'fee' }
    const bin = map[e.key]
    if (bin && !chosen) {
      e.preventDefault()
      choose(bin)
    } else if (e.key.toLowerCase() === 'n' && chosen) {
      e.preventDefault()
      next()
    }
  })

  const binAt = (info: PanInfo): LevyId | null => {
    const x = info.point.x - window.scrollX
    const y = info.point.y - window.scrollY
    for (const lv of LEVIES) {
      const r = binRefs.current[lv.id]?.getBoundingClientRect()
      if (r && x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) return lv.id
    }
    return null
  }

  // Where the filed card flies: towards the correct bin.
  const exitX = (id: LevyId | undefined) => (id === 'tax' ? -160 : id === 'fee' ? 160 : 0)

  return (
    <section className="lv-card lv-sort" aria-labelledby={titleId}>
      <div className="lv-spread">
        <div>
          <h3 id={titleId} className="lv-h">
            Sort it: tax, cess or fee?
          </h3>
          <p className="lv-lead">
            Drag the card onto a bin, or tap a bin. Keys <span className="kbd">1</span> <span className="kbd">2</span> <span className="kbd">3</span>, then{' '}
            <span className="kbd">N</span> for the next card.
          </p>
        </div>
        <div className="segmented" role="group" aria-label="Deck">
          <button type="button" aria-pressed={deckId === 'examples'} onClick={() => restart('examples')}>
            Examples
          </button>
          <button type="button" aria-pressed={deckId === 'clues'} onClick={() => restart('clues')}>
            Clues
          </button>
        </div>
      </div>

      <div className="lv-spread">
        <span className="lv-muted" style={{ fontSize: '0.92rem' }}>
          {done ? 'Finished' : `Card ${pos + 1} of ${order.length}`} · {correct} right
        </span>
        <div className="bar" style={{ flex: '1 1 160px', maxWidth: 320 }} aria-hidden="true">
          <span style={{ width: `${(answeredCount / order.length) * 100}%` }} />
        </div>
      </div>

      {done ? (
        <Results deck={deck} order={order} answers={answers} correct={correct} onRestart={() => restart()} />
      ) : (
        <div className="lv-sort__stage">
          <div className="lv-sort__deck">
            {pos < order.length - 1 && <div className="lv-sort__card-under" aria-hidden="true" />}
            <AnimatePresence mode="popLayout">
              {current && (
                <motion.div
                  key={current.id}
                  className="lv-sort__card"
                  custom={exitX(current.answer)}
                  variants={{
                    enter: { opacity: 0, scale: 0.9, y: 16 },
                    center: { opacity: 1, scale: 1, y: 0, x: 0, rotate: 0 },
                    exit: (x: number) => ({ opacity: 0, scale: 0.5, x, y: 150, rotate: x / 20, transition: { duration: 0.38, ease: easeOut } }),
                  }}
                  initial="enter"
                  animate="center"
                  exit="exit"
                  transition={softSpring}
                  drag={!chosen}
                  dragSnapToOrigin
                  dragElastic={0.6}
                  whileDrag={{ scale: 1.03, rotate: -1.5 }}
                  onDrag={(_, info) => setHover(binAt(info))}
                  onDragEnd={(_, info) => {
                    const bin = binAt(info)
                    setHover(null)
                    if (bin) choose(bin)
                  }}
                  aria-live="polite"
                >
                  <div className="lv-spread">
                    <span className="lv-tag">{deckId === 'examples' ? 'Example from the notes' : 'Clue from the notes'}</span>
                    {chosen && (
                      <motion.span
                        className={`lv-yn ${chosen === current.answer ? 'is-yes' : 'is-no'}`}
                        initial={{ scale: 0.6, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        transition={bouncy}
                        style={chosen === current.answer ? { background: 'var(--ok)' } : { background: 'var(--bad)', color: 'var(--brand-ink)' }}
                      >
                        {chosen === current.answer ? <Check size={13} strokeWidth={3} /> : <X size={13} strokeWidth={3} />}
                        {LEVIES.find((l) => l.id === current.answer)?.name}
                      </motion.span>
                    )}
                  </div>
                  <p className="lv-sort__card-text">{current.text}</p>
                  {!chosen && (
                    <p className="lv-sort__hint">
                      <Hand size={14} aria-hidden="true" /> Drag me to a bin, or tap one below
                    </p>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <div className="lv-bins" role="group" aria-label="Bins">
            {LEVIES.map((lv, i) => {
              const filed = order.slice(0, pos).filter((id) => byId.get(id)?.answer === lv.id).length
              const state = chosen ? (lv.id === current?.answer ? 'is-right' : lv.id === chosen ? 'is-wrong' : '') : hover === lv.id ? 'is-hover' : ''
              return (
                <motion.button
                  key={lv.id}
                  ref={(el) => {
                    binRefs.current[lv.id] = el
                  }}
                  type="button"
                  className={`lv-bin ${state}`}
                  data-levy={lv.id}
                  disabled={!!chosen}
                  onClick={() => choose(lv.id)}
                  animate={chosen && lv.id === chosen && chosen !== current?.answer ? { x: [0, -6, 6, -4, 4, 0] } : { x: 0 }}
                  transition={{ duration: 0.4 }}
                  aria-label={`${lv.name} (key ${i + 1})`}
                >
                  <span className="lv-bin__icon" aria-hidden="true">
                    <lv.icon size={18} />
                  </span>
                  <span className="lv-bin__name">{lv.name}</span>
                  <motion.span key={filed} className="lv-bin__count" initial={{ scale: 1.5 }} animate={{ scale: 1 }} transition={spring}>
                    {filed} filed
                  </motion.span>
                </motion.button>
              )
            })}
          </div>

          <AnimatePresence mode="wait">
            {chosen && current && (
              <motion.div
                key={current.id}
                className={`lv-feedback ${chosen === current.answer ? 'is-right' : 'is-wrong'}`}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6, transition: { duration: 0.15 } }}
                transition={softSpring}
                role="status"
              >
                <p className="lv-feedback__title">
                  {chosen === current.answer ? <Check size={18} aria-hidden="true" /> : <X size={18} aria-hidden="true" />}
                  {chosen === current.answer
                    ? `Right: it is a ${current.answer}.`
                    : `Not quite: it is a ${current.answer}, not a ${chosen}.`}
                  {current.trick && <span className="lv-tag">Label trap</span>}
                </p>
                <p className="lv-feedback__why">{current.why}</p>
                <div className="lv-spread">
                  <SourceLink slideId={current.slideId} />
                  <button type="button" className="btn btn-unit" onClick={next} autoFocus>
                    {pos === order.length - 1 ? 'See my score' : 'Next card'} <ArrowRight size={16} aria-hidden="true" />
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}
    </section>
  )
}

function Results({
  deck,
  order,
  answers,
  correct,
  onRestart,
}: {
  deck: SortCard[]
  order: string[]
  answers: Record<string, LevyId>
  correct: number
  onRestart: () => void
}) {
  const byId = new Map(deck.map((c) => [c.id, c]))
  const total = order.length
  const ratio = total ? correct / total : 0
  const name = (id: LevyId) => LEVIES.find((l) => l.id === id)?.name ?? id
  return (
    <motion.div className="lv-stack" initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} transition={softSpring}>
      <div className="lv-score" role="status">
        <ProgressRing value={ratio} size={78} stroke={8} color={ratio >= 0.75 ? 'var(--ok)' : 'var(--unit)'} label={`${correct} of ${total} right`}>
          <strong style={{ fontSize: '1.05rem' }}>
            {correct}/{total}
          </strong>
        </ProgressRing>
        <div>
          <p className="lv-display">{ratio === 1 ? 'A clean sweep.' : ratio >= 0.75 ? 'Nearly all filed correctly.' : 'Worth another round.'}</p>
          <p className="lv-muted">Labels do not decide the nature of a levy: watch for the “licence fee” and the mining cess.</p>
        </div>
      </div>
      <ul className="lv-results">
        {order.map((id) => {
          const c = byId.get(id)
          if (!c) return null
          const ok = answers[id] === c.answer
          return (
            <li key={id}>
              {ok ? <Check size={18} color="var(--ok)" aria-label="Right" /> : <X size={18} color="var(--bad)" aria-label="Wrong" />}
              <span>
                <strong>{c.text}</strong> — {name(c.answer)}
                {!ok && answers[id] ? ` (you said ${name(answers[id])})` : ''}. <span className="lv-muted">{c.why}</span>
              </span>
            </li>
          )
        })}
      </ul>
      <div className="lv-row">
        <button type="button" className="btn btn-unit" onClick={onRestart}>
          <RotateCcw size={16} aria-hidden="true" /> Play again
        </button>
        <span className="lv-cite">
          <Lightbulb size={13} aria-hidden="true" /> Try the other deck too
        </span>
      </div>
    </motion.div>
  )
}
