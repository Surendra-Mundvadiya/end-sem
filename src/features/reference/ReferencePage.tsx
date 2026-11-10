import { useEffect, useMemo, useRef, type KeyboardEvent } from 'react'
import { useSearchParams } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { ArrowLeftRight, BookMarked, BookOpen, Download, ExternalLink, FileText, Hash, Info, Library, Scale, type LucideIcon } from 'lucide-react'
import PageHeader from '../../components/PageHeader'
import { MATERIALS } from '../../data'
import { easeOut, spring, stagger, fadeUp } from '../../lib/motion'
import { ABOUT, figureCards, hasAbout, hasFinder, hasGlossary, hasKeyFigures } from './content'
import FiguresPanel from './FiguresPanel'
import FinderPanel from './FinderPanel'
import GlossaryPanel from './GlossaryPanel'
import './reference.css'

/* Tab ids stay stable ("figures" is the key-facts tab) so existing ?tab= links keep working. */
type TabId = 'glossary' | 'figures' | 'finder' | 'materials' | 'about'

interface TabDef {
  id: TabId
  label: string
  short: string
  icon: LucideIcon
}

const ALL_TABS: TabDef[] = [
  { id: 'glossary', label: 'Glossary', short: 'Glossary', icon: Library },
  { id: 'figures', label: 'Key facts', short: 'Facts', icon: Hash },
  { id: 'finder', label: 'Section finder', short: 'Finder', icon: ArrowLeftRight },
  { id: 'materials', label: 'Materials', short: 'Materials', icon: FileText },
  { id: 'about', label: 'About', short: 'About', icon: Info },
]

const TAB_PHRASE: Record<TabId, string> = {
  glossary: 'every term and its meaning',
  figures: 'the key facts and numbers',
  finder: 'where each section now sits',
  materials: 'the source PDFs',
  about: 'how to read the references',
}

function subtitleFor(tabs: TabDef[]): string {
  const p = tabs.map((t) => TAB_PHRASE[t.id])
  const list = p.length < 2 ? (p[0] ?? '') : `${p.slice(0, -1).join(', ')} and ${p[p.length - 1]}`
  return list ? `Look things up fast: ${list}.` : 'Look things up fast.'
}

/** Tabs whose content exists for the loaded subject; empty ones are left out entirely. */
function availableTabs(): TabDef[] {
  const has: Record<TabId, boolean> = {
    glossary: hasGlossary(),
    figures: hasKeyFigures() || figureCards().length > 0,
    finder: hasFinder(),
    materials: MATERIALS.length > 0,
    about: hasAbout(),
  }
  return ALL_TABS.filter((t) => has[t.id])
}

function Tabs({ tabs, active, onSelect }: { tabs: TabDef[]; active: TabId; onSelect: (id: TabId) => void }) {
  const refs = useRef<(HTMLButtonElement | null)[]>([])
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const i = tabs.findIndex((t) => t.id === active)
    const next =
      e.key === 'ArrowRight' ? (i + 1) % tabs.length : e.key === 'ArrowLeft' ? (i - 1 + tabs.length) % tabs.length : e.key === 'Home' ? 0 : e.key === 'End' ? tabs.length - 1 : -1
    if (next < 0) return
    e.preventDefault()
    onSelect(tabs[next].id)
    refs.current[next]?.focus()
  }
  return (
    <div className="ref-tabs" role="tablist" aria-label="Reference sections" onKeyDown={onKeyDown}>
      {tabs.map((t, i) => {
        const on = t.id === active
        const Icon = t.icon
        return (
          <button
            key={t.id}
            ref={(el) => {
              refs.current[i] = el
            }}
            type="button"
            role="tab"
            id={`ref-tab-${t.id}`}
            aria-selected={on}
            aria-controls={on ? `ref-panel-${t.id}` : undefined}
            tabIndex={on ? 0 : -1}
            className="ref-tab"
            onClick={() => onSelect(t.id)}
          >
            {on && <motion.span layoutId="ref-tab-pill" className="ref-tab__pill" transition={spring} />}
            <Icon className="ref-tab__icon" size={16} aria-hidden="true" />
            <span className="ref-tab__label">{t.label}</span>
            <span className="ref-tab__short">{t.short}</span>
          </button>
        )
      })}
    </div>
  )
}

function MaterialsPanel() {
  return (
    <motion.div className="ref-materials" variants={stagger(0.08)} initial="hidden" animate="show">
      {MATERIALS.map((m) => {
        const Icon = m.id === 'act' ? Scale : BookOpen
        return (
          <motion.article key={m.id} className="ref-material card" variants={fadeUp} whileHover={{ y: -4 }} transition={spring}>
            <div className="ref-material__art" aria-hidden="true">
              <span className="ref-material__page ref-material__page--back" />
              <span className="ref-material__page">
                <Icon size={26} />
                <i />
                <i />
                <i />
              </span>
            </div>
            <div className="ref-material__body">
              <span className="eyebrow">PDF</span>
              <h3 className="ref-material__title">{m.title}</h3>
              <p className="ref-material__sub">{m.subtitle}</p>
              <p className="ref-material__file">{m.file}</p>
            </div>
            <div className="ref-material__actions">
              <a className="btn btn-primary" href={m.url} target="_blank" rel="noopener">
                <ExternalLink size={16} aria-hidden="true" />
                Open PDF
                <span className="sr-only"> (opens in a new tab)</span>
              </a>
              <a className="btn" href={m.url} download={m.file}>
                <Download size={16} aria-hidden="true" />
                Download
              </a>
            </div>
          </motion.article>
        )
      })}
    </motion.div>
  )
}

function AboutPanel() {
  return (
    <motion.div className="ref-about card card-pad" variants={fadeUp} initial="hidden" animate="show">
      <div className="notes" dangerouslySetInnerHTML={{ __html: ABOUT }} />
    </motion.div>
  )
}

export default function ReferencePage() {
  const [params, setParams] = useSearchParams()
  const tabs = useMemo(availableTabs, [])
  const requested = params.get('tab')
  const active: TabId | undefined = tabs.find((t) => t.id === requested)?.id ?? tabs[0]?.id
  const initialQuery = params.get('q') ?? ''

  // The shell keeps the scroll position between routes; start this page at the top.
  useEffect(() => {
    window.scrollTo({ top: 0 })
  }, [])

  const select = (id: TabId) => {
    if (id === active) return
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        next.set('tab', id)
        next.delete('q')
        return next
      },
      { replace: true },
    )
  }

  return (
    <div className="page ref-page">
      <PageHeader
        eyebrow={
          <>
            <BookMarked size={14} aria-hidden="true" /> Reference
          </>
        }
        title="Reference desk"
        subtitle={subtitleFor(tabs)}
      />

      {active ? (
        <>
          {tabs.length > 1 && <Tabs tabs={tabs} active={active} onSelect={select} />}
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={active}
              className="ref-panel"
              role={tabs.length > 1 ? 'tabpanel' : undefined}
              id={`ref-panel-${active}`}
              aria-labelledby={tabs.length > 1 ? `ref-tab-${active}` : undefined}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.26, ease: easeOut }}
            >
              {active === 'glossary' && <GlossaryPanel initialQuery={initialQuery} />}
              {active === 'figures' && <FiguresPanel initialQuery={initialQuery} />}
              {active === 'finder' && <FinderPanel initialQuery={initialQuery} />}
              {active === 'materials' && <MaterialsPanel />}
              {active === 'about' && <AboutPanel />}
            </motion.div>
          </AnimatePresence>
        </>
      ) : (
        <p className="ref-empty card">There is no reference material for this subject yet.</p>
      )}
    </div>
  )
}
