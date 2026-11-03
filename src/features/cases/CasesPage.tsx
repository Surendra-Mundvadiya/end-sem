import { AnimatePresence, motion } from 'framer-motion'
import { Compass, Puzzle, Scale } from 'lucide-react'
import { useSearchParams } from 'react-router-dom'
import PageHeader from '../../components/PageHeader'
import { CASES, isUnitId, type UnitId } from '../../data'
import { easeOut, spring } from '../../lib/motion'
import { plural } from '../../lib/text'
import CasesExplore from './CasesExplore'
import ConceptMatch from './ConceptMatch'
import './cases.css'

type Mode = 'explore' | 'match'

const MODES: { id: Mode; label: string; Icon: typeof Compass }[] = [
  { id: 'explore', label: 'Explore', Icon: Compass },
  { id: 'match', label: 'Concept match', Icon: Puzzle },
]

/** /cases?q=…&unit=u3&mode=match — every view setting lives in the URL so it can be linked to. */
export default function CasesPage() {
  const [params, setParams] = useSearchParams()
  const mode: Mode = params.get('mode') === 'match' ? 'match' : 'explore'
  const unitParam = params.get('unit')
  const unit: UnitId | null = isUnitId(unitParam) ? unitParam : null

  const update = (fn: (p: URLSearchParams) => void) =>
    setParams(
      (prev) => {
        const p = new URLSearchParams(prev)
        fn(p)
        return p
      },
      { replace: true },
    )

  const setUnit = (u: UnitId | null) => update((p) => (u ? p.set('unit', u) : p.delete('unit')))
  const setMode = (m: Mode) => update((p) => (m === 'match' ? p.set('mode', 'match') : p.delete('mode')))

  return (
    <div className="page cs-page">
      <PageHeader
        eyebrow={
          <>
            <Scale size={14} aria-hidden="true" /> Case law · {plural(CASES.length, 'case')}
          </>
        }
        title={
          <>
            Leading <span className="gradient-text">cases</span>
          </>
        }
        subtitle="Every decided case in the notes, arranged by unit and topic. Search them, cover the holdings to test your recall, or match each holding to the concept it illustrates."
        actions={
          <div className="segmented cs-seg" role="group" aria-label="View">
            {MODES.map(({ id, label, Icon }) => (
              <button key={id} type="button" aria-pressed={mode === id} onClick={() => setMode(id)}>
                {mode === id && <motion.span layoutId="cs-seg-pill" className="cs-seg__pill" style={{ borderRadius: 999 }} transition={spring} />}
                <span className="cs-seg__label">
                  <Icon size={15} aria-hidden="true" />
                  {label}
                </span>
              </button>
            ))}
          </div>
        }
      />

      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={mode}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.28, ease: easeOut }}
        >
          {mode === 'explore' ? (
            <CasesExplore unit={unit} onUnit={setUnit} />
          ) : (
            <ConceptMatch unit={unit} onUnit={setUnit} onExplore={() => setMode('explore')} />
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  )
}
