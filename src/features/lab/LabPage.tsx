import { useEffect } from 'react'
import { AnimatePresence, motion, type Variants } from 'framer-motion'
import { Link, Navigate, useParams } from 'react-router-dom'
import { ArrowLeft, ArrowRight, BookOpen, FlaskConical, GraduationCap, MessageCircleQuestion } from 'lucide-react'
import PageHeader from '../../components/PageHeader'
import UnitPill from '../../components/UnitPill'
import { getUnit, slideById, unitVars, type Slide } from '../../data'
import { easeOut, fadeUp, spring, stagger } from '../../lib/motion'
import { LAB_TOOLS, toolById, type LabTool } from './tools'
import './lab.css'

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

function toolStyle(tool: LabTool) {
  return tool.unitId ? unitVars(tool.unitId) : undefined
}

function UnitLabel({ tool, withName = false }: { tool: LabTool; withName?: boolean }) {
  if (tool.unitId) return <UnitPill unitId={tool.unitId} withName={withName} />
  return <span className="unit-pill">All units</span>
}

export default function LabPage() {
  const { toolId } = useParams()
  const tool = toolById(toolId)

  // The app animates between sections only, so moving between /lab and /lab/:toolId is animated here.
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [])

  if (toolId && !tool) return <Navigate to="/lab" replace />

  return (
    <AnimatePresence mode="wait" initial={false} onExitComplete={() => window.scrollTo(0, 0)}>
      <motion.div
        key={tool?.id ?? 'index'}
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -8 }}
        transition={{ duration: 0.28, ease: easeOut }}
      >
        {tool ? <ToolFrame tool={tool} /> : <LabIndex />}
      </motion.div>
    </AnimatePresence>
  )
}

/* ---------- /lab ---------- */

function LabIndex() {
  const calculators = LAB_TOOLS.filter((t) => t.kind === 'calculator')
  const visuals = LAB_TOOLS.filter((t) => t.kind === 'visual')
  return (
    <div className="page lab">
      <PageHeader
        eyebrow={
          <>
            <FlaskConical size={14} aria-hidden="true" /> {LAB_TOOLS.length} interactive tools
          </>
        }
        title="Memory Lab"
        subtitle="Interactive tools that make the hardest parts stick."
      />
      <ToolSection
        id="lab-calculators"
        title="Work it out"
        blurb="Calculators that apply the rules in your notes step by step, exam style."
        tools={calculators}
      />
      <ToolSection
        id="lab-visuals"
        title="See it, remember it"
        blurb="Visual memory aids for the topics that are easiest to mix up."
        tools={visuals}
        delay={0.12}
      />
    </div>
  )
}

function ToolSection({ id, title, blurb, tools, delay = 0 }: { id: string; title: string; blurb: string; tools: LabTool[]; delay?: number }) {
  return (
    <section className="lab-section" aria-labelledby={id}>
      <div className="lab-section__head">
        <h2 id={id} className="lab-section__title">
          {title}
        </h2>
        <p className="lab-section__blurb">{blurb}</p>
      </div>
      <motion.ul className="lab-grid" variants={stagger(0.06, delay)} initial="hidden" animate="show">
        {tools.map((t) => (
          <ToolCard key={t.id} tool={t} />
        ))}
      </motion.ul>
    </section>
  )
}

function ToolCard({ tool }: { tool: LabTool }) {
  const Icon = tool.icon
  return (
    <motion.li variants={fadeUp} className="lab-grid__item">
      <MotionLink
        to={`/lab/${tool.id}`}
        className="lab-card"
        style={toolStyle(tool)}
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
          <span className="lab-card__kind">{tool.kind === 'calculator' ? 'Calculator' : 'Visual'}</span>
        </span>
        <span className="lab-card__title">{tool.title}</span>
        <span className="lab-card__hook">{tool.hook}</span>
        <span className="lab-card__foot">
          <UnitLabel tool={tool} />
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

function ToolFrame({ tool }: { tool: LabTool }) {
  const Tool = tool.component
  const slides = tool.sourceSlideIds.map((id) => slideById(id)).filter((s): s is Slide => !!s)
  const unit = tool.unitId ? getUnit(tool.unitId) : null
  const others = LAB_TOOLS.filter((t) => t.id !== tool.id)

  return (
    <div className="page lab">
      <Link to="/lab" className="lab-back">
        <ArrowLeft size={16} aria-hidden="true" /> Memory Lab
      </Link>
      <PageHeader eyebrow={<UnitLabel tool={tool} withName />} title={tool.title} subtitle={tool.hook} />

      <div className="lab-tool" style={toolStyle(tool)}>
        <Tool />
      </div>

      <motion.section
        className="lab-sources"
        style={toolStyle(tool)}
        aria-labelledby="lab-sources-title"
        initial={{ opacity: 0, y: 14 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-40px' }}
        transition={{ duration: 0.45, ease: easeOut }}
      >
        <div className="lab-sources__head">
          <span className="lab-sources__icon" aria-hidden="true">
            <BookOpen size={18} />
          </span>
          <div>
            <h2 id="lab-sources-title" className="lab-sources__title">
              Read the notes
            </h2>
            <p className="lab-sources__blurb">
              {slides.length ? 'The sections this tool is built from.' : 'This tool draws on every unit.'}
            </p>
          </div>
        </div>
        {slides.length > 0 ? (
          <div className="lab-sources__chips">
            {slides.map((s) => (
              <Link key={s.id} to={`/learn/${s.id}`} className="chip lab-source-chip" style={unitVars(s.unitId)}>
                <span className="lab-source-chip__dot" aria-hidden="true" />
                {s.title}
              </Link>
            ))}
          </div>
        ) : (
          <div className="lab-sources__chips">
            <Link to="/learn" className="chip lab-source-chip">
              Browse all the notes
            </Link>
          </div>
        )}
        {(slides[0] || unit) && (
          <div className="lab-sources__actions">
            {slides[0] && (
              <Link to={`/tutor/${slides[0].id}`} className="btn btn-sm">
                <MessageCircleQuestion size={16} aria-hidden="true" /> Ask the tutor
              </Link>
            )}
            {unit && (
              <Link to={`/quiz?units=${unit.id}&count=10&start=1`} className="btn btn-sm">
                <GraduationCap size={16} aria-hidden="true" /> Quiz {unit.short}
              </Link>
            )}
          </div>
        )}
      </motion.section>

      <nav className="lab-others" aria-label="Other Memory Lab tools">
        <div className="eyebrow">More in the lab</div>
        <ul className="lab-others__list">
          {others.map((t) => {
            const Icon = t.icon
            return (
              <li key={t.id}>
                <Link to={`/lab/${t.id}`} className="lab-other" style={toolStyle(t)}>
                  <span className="lab-other__icon" aria-hidden="true">
                    <Icon size={16} />
                  </span>
                  {t.title}
                </Link>
              </li>
            )
          })}
        </ul>
      </nav>
    </div>
  )
}
