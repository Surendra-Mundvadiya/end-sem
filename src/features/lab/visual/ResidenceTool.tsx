import './visual.css'
import { useId, useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { ArrowRight, Check, Globe, Info, MapPin, Sparkles, Wallet, X } from 'lucide-react'
import { CASES, unitVars } from '../../../data'
import { bouncy, easeOut, softSpring } from '../../../lib/motion'
import {
  decideIndividual,
  decideOther,
  INDIVIDUAL_TREE,
  OTHER_TREES,
  PRESETS,
  RS_15_LAKH,
  SCOPE_BUCKETS,
  scopeFor,
  type IndividualFacts,
  type Nationality,
  type OtherFacts,
  type PersonKind,
  type Situation,
  type TreeNode,
  type Verdict,
} from './residence'
import { casesHtml, DaysField, SourceLink, Switch } from './ui'

/*
 * Residential status (Unit III, part 9). Rules: s70 (individuals), s71 (other persons), s72 (scope of income).
 * The decision logic lives in residence.ts; this file is the questionnaire and the animated tree.
 */

const KINDS: { id: PersonKind; label: string }[] = [
  { id: 'individual', label: 'Individual' },
  { id: 'huf', label: 'Hindu undivided family' }, // s71
  { id: 'firm', label: 'Firm or association of persons' }, // s71
  { id: 'company', label: 'Company' }, // s71
  { id: 'other', label: 'Every other person' }, // s71
]

const NATIONALITIES: { id: Nationality; label: string }[] = [
  { id: 'citizen', label: 'Indian citizen' },
  { id: 'pio', label: 'Person of Indian origin' },
  { id: 'other', label: 'Neither' },
]

const OTHER_DEFAULT: OtherFacts = { controlWhollyOutside: false, managerNorHistory: false, indianCompany: false, poemInIndia: false }

const STEP_DELAY = 0.3

export default function ResidenceTool() {
  const [kind, setKind] = useState<PersonKind>('individual')
  const [facts, setFacts] = useState<IndividualFacts>(PRESETS[0].facts)
  const [presetId, setPresetId] = useState<string | null>(PRESETS[0].id)
  const [other, setOther] = useState<OtherFacts>(OTHER_DEFAULT)
  const kindsLabel = useId()

  const verdict: Verdict = useMemo(() => (kind === 'individual' ? decideIndividual(facts) : decideOther(kind, other)), [kind, facts, other])
  const nodes: TreeNode[] = kind === 'individual' ? INDIVIDUAL_TREE : OTHER_TREES[kind]

  const update = (patch: Partial<IndividualFacts>) => {
    setPresetId(null)
    setFacts((f) => {
      const next = { ...f, ...patch }
      // Days in the seven preceding years include the four preceding years.
      if (next.daysPrev7 < next.daysPrev4) next.daysPrev7 = next.daysPrev4
      return next
    })
  }
  const used = new Set(verdict.used)
  const isUnused = (key: string) => !used.has(key)

  const citizenOrPio = facts.nationality !== 'other'
  const situations: { id: Situation; label: string }[] = [
    { id: 'visiting', label: 'Visiting India' }, // s70: section 6(4)
    ...(facts.nationality === 'citizen'
      ? [{ id: 'leaving' as const, label: 'Leaving India as a crew member of an Indian ship or for employment abroad' }] // s70: section 6(3)
      : []),
    { id: 'none', label: 'Neither of these' },
  ]

  return (
    <div className="lv-tool lv-res" style={unitVars('u3')}>
      <section className="lv-card" aria-labelledby={kindsLabel}>
        <div className="lv-spread">
          <div>
            <h3 id={kindsLabel} className="lv-h">
              Whose residence are we testing?
            </h3>
            <p className="lv-lead">Answer the questions and watch the tree light up the route the notes take, one test at a time.</p>
          </div>
        </div>
        <div className="lv-res__kinds" role="group" aria-labelledby={kindsLabel} style={{ marginTop: 14 }}>
          {KINDS.map((k) => (
            <button key={k.id} type="button" className="chip" aria-pressed={kind === k.id} onClick={() => setKind(k.id)}>
              {k.label}
            </button>
          ))}
        </div>
      </section>

      <div className="lv-res__layout">
        <div className="lv-stack">
          {kind === 'individual' ? (
            <>
              <section className="lv-card" aria-label="Preset scenarios">
                <div className="lv-spread">
                  <h3 className="lv-h">Try a scenario</h3>
                  <span className="lv-tag">
                    <Sparkles size={12} aria-hidden="true" /> Illustrations
                  </span>
                </div>
                <div className="lv-presets" style={{ marginTop: 12 }}>
                  {PRESETS.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      className="lv-preset"
                      aria-pressed={presetId === p.id}
                      onClick={() => {
                        setFacts(p.facts)
                        setPresetId(p.id)
                      }}
                    >
                      <span className="lv-preset__src">{p.source}</span>
                      <span className="lv-preset__name">{p.name}</span>
                      <span>{p.blurb}</span>
                    </button>
                  ))}
                </div>
              </section>

              <section className="lv-card" aria-label="Facts about the individual">
                <h3 className="lv-h">The facts</h3>
                <div className="lv-form-group" style={{ borderTop: 0, marginTop: 8, paddingTop: 0 }}>
                  <ChoiceGroup
                    label="Nationality"
                    options={NATIONALITIES}
                    value={facts.nationality}
                    onChange={(nationality) =>
                      update({
                        nationality,
                        situation: nationality === 'other' ? 'none' : nationality === 'pio' && facts.situation === 'leaving' ? 'none' : facts.situation,
                      })
                    }
                  />
                  {citizenOrPio && (
                    <>
                      <ChoiceGroup label="This tax year, he is" options={situations} value={facts.situation} onChange={(situation) => update({ situation })} />
                      <Switch checked={facts.incomeAbove} onChange={(incomeAbove) => update({ incomeAbove })} unused={isUnused('incomeAbove')}>
                        Income other than income from foreign sources exceeds {RS_15_LAKH}
                      </Switch>
                    </>
                  )}
                  {facts.nationality === 'citizen' && (
                    <Switch checked={facts.notLiableElsewhere} onChange={(notLiableElsewhere) => update({ notLiableElsewhere })} unused={isUnused('notLiableElsewhere')}>
                      Not liable to tax in any other country because of domicile or residence
                    </Switch>
                  )}
                </div>

                <div className="lv-form-group">
                  <p className="lv-form-group__title">Days in India</p>
                  <DaysField label="In this tax year" value={facts.daysYear} max={366} ticks={[60, 120, 182]} onChange={(daysYear) => update({ daysYear })} />
                  <DaysField
                    label="In the four preceding years"
                    value={facts.daysPrev4}
                    max={1461}
                    ticks={[365]}
                    onChange={(daysPrev4) => update({ daysPrev4 })}
                    unused={isUnused('daysPrev4')}
                  />
                </div>

                <div className="lv-form-group">
                  <p className="lv-form-group__title">Ordinary residence · section 6(13)</p>
                  <Switch checked={facts.nr9of10} onChange={(nr9of10) => update({ nr9of10 })} unused={isUnused('nr9of10')}>
                    Non resident in nine of the ten preceding years
                  </Switch>
                  <DaysField
                    label="Days in India in the seven preceding years"
                    hint={`Includes the four preceding years, so it cannot be below ${facts.daysPrev4}.`}
                    value={facts.daysPrev7}
                    max={2557}
                    ticks={[729]}
                    onChange={(daysPrev7) => update({ daysPrev7 })}
                    unused={isUnused('daysPrev7')}
                  />
                </div>
              </section>
            </>
          ) : (
            <OtherPersonForm kind={kind} facts={other} onChange={setOther} isUnused={isUnused} />
          )}
        </div>

        <div className="lv-res__right lv-stack">
          <section className="lv-card" aria-label="Decision tree">
            <div className="lv-spread" style={{ marginBottom: 14 }}>
              <h3 className="lv-h">The route through section 6</h3>
              <span className="lv-cite">
                <MapPin size={13} aria-hidden="true" /> lit = path taken
              </span>
            </div>
            <DecisionTree nodes={nodes} verdict={verdict} />
          </section>
          <VerdictCard verdict={verdict} kind={kind} />
        </div>
      </div>
    </div>
  )
}

function ChoiceGroup<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string
  options: { id: T; label: string }[]
  value: T
  onChange: (v: T) => void
}) {
  const id = useId()
  return (
    <div className="lv-field">
      <p id={id} className="lv-field__label">
        {label}
      </p>
      <div className="lv-choices" role="group" aria-labelledby={id}>
        {options.map((o) => (
          <button key={o.id} type="button" className="lv-choice" aria-pressed={value === o.id} onClick={() => onChange(o.id)}>
            <span className="lv-choice__dot" aria-hidden="true" />
            <span>{o.label}</span>
          </button>
        ))}
      </div>
    </div>
  )
}

function OtherPersonForm({
  kind,
  facts,
  onChange,
  isUnused,
}: {
  kind: Exclude<PersonKind, 'individual'>
  facts: OtherFacts
  onChange: (f: OtherFacts) => void
  isUnused: (key: string) => boolean
}) {
  const set = (patch: Partial<OtherFacts>) => onChange({ ...facts, ...patch })
  const cases = CASES.filter((c) => c.slideId === 's71')
  return (
    <section className="lv-card lv-stack" aria-label="Facts about the person">
      <h3 className="lv-h">The facts</h3>
      {kind === 'company' ? (
        <>
          <Switch checked={facts.indianCompany} onChange={(indianCompany) => set({ indianCompany })} unused={isUnused('indianCompany')}>
            It is an Indian company
          </Switch>
          <Switch checked={facts.poemInIndia} onChange={(poemInIndia) => set({ poemInIndia })} unused={isUnused('poemInIndia')}>
            Its place of effective management is in India
          </Switch>
          {/* s71 */}
          <p className="lv-tip">
            <Info size={17} aria-hidden="true" />
            <span>
              The place of effective management is where key management and commercial decisions for the business as a whole are in substance made. The
              test draws on the English “central management and control” test in <em>De Beers Consolidated Mines Ltd. v. Howe</em> [1906] AC 455.
            </span>
          </p>
        </>
      ) : (
        <>
          <Switch checked={facts.controlWhollyOutside} onChange={(controlWhollyOutside) => set({ controlWhollyOutside })} unused={isUnused('controlWhollyOutside')}>
            The control and management of its affairs is situated wholly outside India
          </Switch>
          {kind === 'huf' && (
            <Switch checked={facts.managerNorHistory} onChange={(managerNorHistory) => set({ managerNorHistory })} unused={isUnused('managerNorHistory')}>
              The manager was non resident in nine of the ten preceding years, or in India for 729 days or less in the seven preceding years
            </Switch>
          )}
          {/* s71 */}
          <p className="lv-tip">
            <Info size={17} aria-hidden="true" />
            <span>Even partial control exercised in India makes it resident. A person resident for one source is resident for all sources (section 6(12)).</span>
          </p>
          <div className="notes" style={{ fontSize: '0.98rem' }} dangerouslySetInnerHTML={{ __html: casesHtml(cases) }} />
        </>
      )}
      <div className="lv-row">
        <SourceLink slideId="s71" />
      </div>
    </section>
  )
}

type NodeState = 'visited' | 'skipped' | 'unreached'

function DecisionTree({ nodes, verdict }: { nodes: TreeNode[]; verdict: Verdict }) {
  const stepIndex = new Map(verdict.steps.map((s, i) => [s.id, i]))
  const lastNode = nodes.reduce((acc, n, i) => (stepIndex.has(n.id) ? i : acc), -1)
  // Every node is drawn; the ones the route skipped or never reached are dimmed.
  // Replay the lighting only when the route itself changes, not on every keystroke.
  const signature = `${verdict.steps.map((s) => `${s.id}:${s.yes ? 1 : 0}`).join('|')}>${verdict.status}`

  let order = 0
  const rows = nodes.map((n, i) => {
    const visitedAt = stepIndex.get(n.id)
    const state: NodeState = visitedAt != null ? 'visited' : i < lastNode ? 'skipped' : 'unreached'
    if (visitedAt != null) order = visitedAt
    return { node: n, state, step: visitedAt != null ? verdict.steps[visitedAt] : undefined, order, first: i === 0 || nodes[i - 1].phase !== n.phase }
  })
  const finalOrder = verdict.steps.length

  return (
    <ol className="lv-tree" key={signature}>
      {rows.map(({ node, state, step, order: o, first }, i) => {
        const delay = o * STEP_DELAY
        // The route always ends at the Status node below, so every rail is lit; rails that pass a node
        // the route did not ask are drawn dashed, as a jump.
        const nextVisited = i === rows.length - 1 || rows[i + 1].state === 'visited'
        const jump = state !== 'visited' || !nextVisited
        const content = (
          <>
            {first && (
              <p className="eyebrow" style={{ marginBottom: 6 }}>
                {node.phase}
              </p>
            )}
            <p className="lv-node__q">{node.question}</p>
            <div className="lv-node__meta">
              <span className="lv-cite">{node.cite}</span>
            </div>
            {step ? (
              <>
                <div className="lv-node__answer">
                  <span className={`lv-yn ${step.yes ? 'is-yes' : 'is-no'}`}>{step.answer}</span>
                  {step.detail && <span className="lv-node__detail">{step.detail}</span>}
                </div>
                {step.note && <p className="lv-node__note">{step.note}</p>}
                {step.ends && (
                  <p className="lv-node__ends">
                    <ArrowRight size={15} aria-hidden="true" /> {step.ends}
                  </p>
                )}
              </>
            ) : (
              <p className="lv-node__skip">{state === 'skipped' ? 'Skipped on this route.' : 'Not reached on this route.'}</p>
            )}
          </>
        )
        return (
          <li key={node.id} className={`lv-node is-${state}`}>
            <span className={`lv-node__rail${jump ? ' is-jump' : ''}`} aria-hidden="true">
              <motion.span initial={{ scaleY: 0 }} animate={{ scaleY: 1 }} transition={{ duration: 0.3, ease: easeOut, delay: delay + 0.16 }} />
            </span>
            <span className="lv-node__dot" aria-hidden="true">
              {i + 1}
              {state === 'visited' && (
                <motion.span className="lv-node__dot-fill" initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ ...bouncy, delay }}>
                  {step?.yes ? <Check size={16} strokeWidth={3} /> : <X size={15} strokeWidth={3} />}
                </motion.span>
              )}
            </span>
            {state === 'visited' ? (
              <motion.div className="lv-node__body" initial={{ opacity: 0.35, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ ...softSpring, delay }}>
                {content}
              </motion.div>
            ) : (
              <div className="lv-node__body">{content}</div>
            )}
          </li>
        )
      })}
      <li className="lv-node is-visited" style={{ paddingBottom: 0 }}>
        <span className="lv-node__dot" aria-hidden="true">
          <motion.span className="lv-node__dot-fill" initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ ...bouncy, delay: finalOrder * STEP_DELAY }}>
            <Sparkles size={15} />
          </motion.span>
        </span>
        <motion.div
          className="lv-node__body"
          initial={{ opacity: 0, x: -8 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ ...softSpring, delay: finalOrder * STEP_DELAY }}
        >
          <p className="eyebrow">Status</p>
          <p className="lv-node__q" style={{ fontSize: '1.05rem', marginTop: 4 }}>
            {verdict.title}
          </p>
          <span className="lv-cite">{verdict.cite}</span>
        </motion.div>
      </li>
    </ol>
  )
}

function VerdictCard({ verdict, kind }: { verdict: Verdict; kind: PersonKind }) {
  const scope = scopeFor(verdict.status)
  const Icon = verdict.status === 'NR' ? Globe : verdict.status === 'NOR' ? Wallet : Check
  return (
    <>
      <p className="sr-only" aria-live="polite" aria-atomic="true">
        Result: {verdict.title}. {verdict.cite}. {verdict.why}
      </p>
      <AnimatePresence mode="wait" initial={false}>
        <motion.section
          key={`${verdict.status}-${verdict.cite}`}
          className="lv-verdict"
          data-status={verdict.status}
          aria-label="Result"
          initial={{ opacity: 0, y: 12, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -6, scale: 0.99 }}
          transition={softSpring}
        >
          <div className="lv-verdict__head">
            <span className="lv-verdict__icon" aria-hidden="true">
              <Icon size={24} />
            </span>
            <div>
              <p className="eyebrow">Result</p>
              <p className="lv-verdict__title">{verdict.title}</p>
            </div>
          </div>
          <p className="lv-verdict__why">
            {verdict.why} <span className="lv-cite">{verdict.cite}</span>
          </p>
          <div className="lv-scope">
            <p className="eyebrow">Scope of income taxed · section 5</p>
            {SCOPE_BUCKETS.map((b, i) => {
              const state = scope[b.id]
              return (
                <div key={b.id} className="lv-scope__item" data-state={state}>
                  <motion.span
                    className="lv-scope__fill"
                    initial={{ scaleX: 0 }}
                    animate={{ scaleX: state === 'no' ? 0 : 1 }}
                    transition={{ duration: 0.5, ease: easeOut, delay: 0.15 + i * 0.12 }}
                    aria-hidden="true"
                  />
                  <span>{b.label}</span>
                  <span className="lv-scope__mark">{state === 'yes' ? 'Taxed' : state === 'part' ? 'Only some' : 'Not taxed'}</span>
                </div>
              )
            })}
            {verdict.status === 'NOR' && (
              // s72
              <p className="lv-node__detail">Foreign income is taxed only if derived from a business controlled in or a profession set up in India.</p>
            )}
          </div>
          <div className="lv-row">
            <SourceLink slideId={kind === 'individual' ? 's70' : 's71'} />
            <SourceLink slideId="s72" />
          </div>
        </motion.section>
      </AnimatePresence>
    </>
  )
}
