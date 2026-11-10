import { useEffect, type ComponentType, type CSSProperties } from 'react'
import { AnimatePresence, motion, type Variants } from 'framer-motion'
import { Link, Navigate, useParams } from 'react-router-dom'
import { ArrowLeft, ArrowRight, BookOpen, FlaskConical, ListOrdered } from 'lucide-react'
import PageHeader from '../../components/PageHeader'
import UnitPill from '../../components/UnitPill'
import {
  SUBJECT,
  UNITS,
  getUnit,
  slideById,
  unitVars,
  type FlowTool as FlowData,
  type FormulaTool as FormulaData,
  type TimelineTool as TimelineData,
  type Unit,
} from '../../data'
import { easeOut, fadeUp, spring, stagger } from '../../lib/motion'
import { plural } from '../../lib/text'
import { ALL_TOOLS, KIND_META, SUBJECT_TOOLS, UNIT_TOOLS, WHOLE_SUBJECT, canOrderTopics, entryById, type LabEntry } from './registry'
import CompareTool from './tools/CompareTool'
import CourseMap from './tools/CourseMap'
import FlowToolImpl from './tools/FlowTool'
import FormulaToolImpl from './tools/FormulaTool'
import MnemonicTool from './tools/MnemonicTool'
import SortTool from './tools/SortTool'
import TimelineToolImpl from './tools/TimelineTool'
import TopicOrder from './tools/TopicOrder'
import './lab.css'

// Written separately; typed here so they take the same { tool } props as the rest.
const FormulaView: ComponentType<{ tool: FormulaData }> = FormulaToolImpl
const TimelineView: ComponentType<{ tool: TimelineData }> = TimelineToolImpl
const FlowView: ComponentType<{ tool: FlowData }> = FlowToolImpl

const MotionLink = motion.create(Link)

const cardVariants: Variants = {
  rest: { y: 0, scale: 1, transition: spring },
  hover: { y: -5, transition: spring },
  press: { scale: 0.985, transition: spring },
}
const iconVariants: Variants = {
  rest: { rotate: 0, scale: 1, transition: spring },
  hover: { rotate: -8, scale: 1.08, transition: spring },
}
const arrowVariants: Variants = {
  rest: { x: 0, transition: spring },
  hover: { x: 4, transition: spring },
}

function toolStyle(e: LabEntry): CSSProperties | undefined {
  return e.unitId ? unitVars(e.unitId) : undefined
}

function ScopeLabel({ entry, withName = false }: { entry: LabEntry; withName?: boolean }) {
  if (entry.unitId) return <UnitPill unitId={entry.unitId} withName={withName} />
  return <span className="unit-pill lab-pill-subject">Whole subject</span>
}

function ToolBody({ entry }: { entry: LabEntry }) {
  switch (entry.kind) {
    case 'map':
      return <CourseMap />
    case 'order':
      return <TopicOrder />
    case 'compare':
      return <CompareTool tool={entry.tool} />
    case 'sort':
      return <SortTool tool={entry.tool} />
    case 'timeline':
      return <TimelineView tool={entry.tool} />
    case 'mnemonic':
      return <MnemonicTool tool={entry.tool} />
    case 'formula':
      return <FormulaView tool={entry.tool} />
    case 'flow':
      return <FlowView tool={entry.tool} />
  }
}

export default function LabPage() {
  const { toolId } = useParams()
  const entry = entryById(toolId)

  // The app animates between sections only, so moving between /lab and /lab/:toolId is animated here.
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [])

  if (toolId && !entry) return <Navigate to="/lab" replace />

  return (
    <AnimatePresence mode="wait" initial={false} onExitComplete={() => window.scrollTo(0, 0)}>
      <motion.div
        key={entry?.id ?? 'index'}
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -8 }}
        transition={{ duration: 0.28, ease: easeOut }}
      >
        {entry ? <ToolFrame entry={entry} /> : <LabIndex />}
      </motion.div>
    </AnimatePresence>
  )
}

/* ---------- /lab ---------- */

function LabIndex() {
  const dataCount = ALL_TOOLS.length - WHOLE_SUBJECT.length
  return (
    <div className="page lab">
      <PageHeader
        eyebrow={
          <>
            <FlaskConical size={14} aria-hidden="true" /> {plural(ALL_TOOLS.length, 'interactive tool')}
          </>
        }
        title="Memory Lab"
        subtitle={`See ${SUBJECT.title} as one journey, put it back together in order, then drill each unit with ${dataCount > 0 ? 'matrices, sorting games, hooks and more' : 'the games below'}.`}
      />

      <ToolSection id="lab-whole" title="Whole subject" blurb="Start here: the syllabus in order, from the first unit to the last." tools={WHOLE_SUBJECT} />

      {UNITS.map((u) => (
        <UnitSection key={u.id} unit={u} tools={UNIT_TOOLS.get(u.id) ?? []} />
      ))}

      {SUBJECT_TOOLS.length > 0 && (
        <ToolSection id="lab-across" title="Across the units" blurb="Tools that tie several units together." tools={SUBJECT_TOOLS} />
      )}
    </div>
  )
}

function SectionGrid({ tools }: { tools: LabEntry[] }) {
  return (
    <motion.ul className="lab-grid" variants={stagger(0.06, 0.04)} initial="hidden" whileInView="show" viewport={{ once: true, margin: '0px 0px -40px 0px' }}>
      {tools.map((t) => (
        <ToolCard key={t.id} entry={t} />
      ))}
    </motion.ul>
  )
}

function ToolSection({ id, title, blurb, tools }: { id: string; title: string; blurb: string; tools: LabEntry[] }) {
  return (
    <section className="lab-section" aria-labelledby={id}>
      <div className="lab-section__head">
        <h2 id={id} className="lab-section__title">
          {title}
        </h2>
        <p className="lab-section__blurb">{blurb}</p>
      </div>
      <SectionGrid tools={tools} />
    </section>
  )
}

function UnitSection({ unit, tools }: { unit: Unit; tools: LabEntry[] }) {
  const id = `lab-${unit.id}`
  return (
    <section className="lab-section lab-section--unit" aria-labelledby={id} style={unitVars(unit.id)}>
      <div className="lab-section__head">
        <span className="lab-section__badge" aria-hidden="true">
          {unit.index + 1}
        </span>
        <div className="lab-section__text">
          <div className="eyebrow lab-section__eyebrow">{unit.short}</div>
          <h2 id={id} className="lab-section__title">
            {unit.name}
          </h2>
        </div>
        {canOrderTopics(unit.id) && (
          <Link to={`/lab/topic-order?mode=topics&unit=${unit.id}`} className="chip lab-section__order">
            <ListOrdered size={14} aria-hidden="true" /> Order its topics
          </Link>
        )}
      </div>
      {tools.length > 0 ? <SectionGrid tools={tools} /> : <p className="lab-section__none">No tools for this unit yet. The course map and the order game still cover it.</p>}
    </section>
  )
}

function ToolCard({ entry }: { entry: LabEntry }) {
  const { icon: Icon, label } = KIND_META[entry.kind]
  return (
    <motion.li variants={fadeUp} className="lab-grid__item">
      <MotionLink
        to={`/lab/${entry.id}`}
        className={`lab-card lab-card--${entry.kind}`}
        style={toolStyle(entry)}
        variants={cardVariants}
        initial="rest"
        animate="rest"
        whileHover="hover"
        whileFocus="hover"
        whileTap="press"
      >
        <span className="lab-card__glow" aria-hidden="true" />
        <span className="lab-card__top">
          <motion.span className="lab-card__icon" variants={iconVariants} aria-hidden="true">
            <Icon size={22} />
          </motion.span>
          <span className="lab-card__kind">{label}</span>
        </span>
        <span className="lab-card__title">{entry.title}</span>
        <span className="lab-card__hook">{entry.intro}</span>
        <span className="lab-card__foot">
          <span className="lab-card__meta">{entry.meta}</span>
          <span className="lab-card__go">
            Open
            <motion.span className="lab-card__arrow" variants={arrowVariants} aria-hidden="true">
              <ArrowRight size={16} />
            </motion.span>
          </span>
        </span>
      </MotionLink>
    </motion.li>
  )
}

/* ---------- /lab/:toolId ---------- */

function ToolFrame({ entry }: { entry: LabEntry }) {
  const slide = slideById(entry.slideId)
  const at = ALL_TOOLS.findIndex((t) => t.id === entry.id)
  const prev = at > 0 ? ALL_TOOLS[at - 1] : undefined
  const next = at >= 0 && at < ALL_TOOLS.length - 1 ? ALL_TOOLS[at + 1] : undefined
  const { label, icon: Icon } = KIND_META[entry.kind]

  return (
    <div className="page lab" style={toolStyle(entry)}>
      <Link to="/lab" className="lab-back">
        <ArrowLeft size={16} aria-hidden="true" /> Memory Lab
      </Link>
      <PageHeader
        eyebrow={
          <>
            <ScopeLabel entry={entry} withName />
            <span className="lab-frame__kind">
              <Icon size={13} aria-hidden="true" /> {label}
            </span>
          </>
        }
        title={entry.title}
        subtitle={entry.intro}
      />

      <div className="lab-tool">
        <ToolBody key={entry.id} entry={entry} />
      </div>

      {slide && (
        <motion.aside
          className="lab-notes"
          style={unitVars(slide.unitId)}
          aria-label="Read the notes"
          initial={{ opacity: 0, y: 14 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '0px 0px -40px 0px' }}
          transition={{ duration: 0.45, ease: easeOut }}
        >
          <span className="lab-notes__icon" aria-hidden="true">
            <BookOpen size={18} />
          </span>
          <div className="lab-notes__text">
            <div className="eyebrow">{getUnit(slide.unitId).short} · Notes</div>
            <p className="lab-notes__title">{slide.title}</p>
          </div>
          <Link to={`/learn/${slide.id}`} className="btn btn-unit lab-notes__go">
            Read the notes <ArrowRight size={16} aria-hidden="true" />
          </Link>
        </motion.aside>
      )}

      {(prev || next) && (
        <nav className="lab-pager" aria-label="Other Memory Lab tools">
          {prev ? (
            <Link to={`/lab/${prev.id}`} className="lab-pager__link" style={toolStyle(prev)}>
              <ArrowLeft size={18} aria-hidden="true" />
              <span>
                <span className="lab-pager__dir">Previous</span>
                <span className="lab-pager__title">{prev.title}</span>
              </span>
            </Link>
          ) : (
            <span />
          )}
          {next && (
            <Link to={`/lab/${next.id}`} className="lab-pager__link lab-pager__link--next" style={toolStyle(next)}>
              <span>
                <span className="lab-pager__dir">Next</span>
                <span className="lab-pager__title">{next.title}</span>
              </span>
              <ArrowRight size={18} aria-hidden="true" />
            </Link>
          )}
        </nav>
      )}
    </div>
  )
}
