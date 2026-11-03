import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type MouseEvent as ReactMouseEvent } from 'react'
import { AnimatePresence, motion, type Variants } from 'framer-motion'
import { Link } from 'react-router-dom'
import { ArrowLeft, ArrowRight, Brain, Check, ChevronRight, Eye, EyeOff, Hand, Hash, Headphones } from 'lucide-react'
import { SLIDES, getUnit, unitVars, type Slide } from '../../data'
import UnitPill from '../../components/UnitPill'
import { bouncy, easeOut, spring } from '../../lib/motion'
import CheckMark from './CheckMark'
import EndOfUnit from './EndOfUnit'
import { crumbPart, isUnitEnd, neighbours, splitTitle, topicOf } from './outline'
import { NO_RECALL, nextHidden, prepareRecall, readStats, revealAll, revealItem, type RecallStats } from './recall'

/** Directional page turn: forward slides in from the right, back from the left; jumps without a direction rise in. */
export const slideVariants: Variants = {
  enter: (dir: number) => (dir === 0 ? { opacity: 0, x: 0, y: 14 } : { opacity: 0, x: dir * 56, y: 0 }),
  center: {
    opacity: 1,
    x: 0,
    y: 0,
    transition: {
      x: { type: 'spring', stiffness: 260, damping: 32 },
      y: { duration: 0.4, ease: easeOut },
      opacity: { duration: 0.26, ease: easeOut },
    },
  },
  exit: (dir: number) => ({ opacity: 0, x: dir === 0 ? 0 : dir * -36, y: 0, transition: { duration: 0.15, ease: easeOut } }),
}

interface Props {
  slide: Slide
  dir: number
  understood: boolean
  recall: boolean
  numbers: boolean
  onToggleNumbers: () => void
  onToggleUnderstood: () => void
  onRecallStats: (s: RecallStats) => void
  /** Tells the toolbar whether the big title is on screen (it shows a compact title otherwise). */
  onTitleVisible: (visible: boolean) => void
  announce: (msg: string) => void
}

/** A hidden case is revealed through its button; a term is focusable itself. */
function focusItem(el: HTMLElement) {
  const target = el.dataset.lrnItem === 'case' && !el.classList.contains('is-revealed') ? el.querySelector<HTMLElement>('.lrn-holding-btn') : el
  target?.focus()
}

export default function SlideBody({
  slide,
  dir,
  understood,
  recall,
  numbers,
  onToggleNumbers,
  onToggleUnderstood,
  onRecallStats,
  onTitleVisible,
  announce,
}: Props) {
  const notesRef = useRef<HTMLDivElement>(null)
  const titleRef = useRef<HTMLHeadingElement>(null)
  const [round, setRound] = useState(0)
  const [stats, setStats] = useState<RecallStats>(NO_RECALL)
  const topic = topicOf(slide)
  const { num, text } = splitTitle(slide.title)
  const { prev, next } = neighbours(slide)
  const unitEnd = isUnitEnd(slide)
  const part = crumbPart(slide)

  // The notes element is remounted (clean HTML) whenever the mode changes, so this only ever adds.
  useLayoutEffect(() => {
    const root = notesRef.current
    setStats(recall && root ? prepareRecall(root, { numbers }) : NO_RECALL)
  }, [recall, numbers, round])

  useEffect(() => {
    onRecallStats(stats)
  }, [stats, onRecallStats])

  useEffect(() => {
    const el = titleRef.current
    if (!el || typeof IntersectionObserver === 'undefined') return
    // The sticky toolbar covers roughly the top 100px.
    const io = new IntersectionObserver((entries) => onTitleVisible(entries[entries.length - 1].isIntersecting), {
      rootMargin: '-100px 0px 0px 0px',
    })
    io.observe(el)
    return () => io.disconnect()
  }, [onTitleVisible])

  function reveal(item: HTMLElement, viaKeyboard: boolean) {
    const root = notesRef.current
    if (!root) return
    const after = viaKeyboard ? nextHidden(root, item) : null
    const msg = revealItem(item)
    if (!msg) return
    // Keyboard flow: Enter, Enter, Enter walks through the hidden items in reading order.
    if (viaKeyboard) focusItem(after ?? item)
    setStats(readStats(root, numbers))
    announce(msg)
  }

  function onNotesClick(e: ReactMouseEvent<HTMLDivElement>) {
    if (!recall) return
    const item = (e.target as Element).closest<HTMLElement>('[data-lrn-item]:not(.is-revealed)')
    if (!item || !e.currentTarget.contains(item)) return
    e.preventDefault()
    reveal(item, e.detail === 0)
  }

  function onNotesKey(e: ReactKeyboardEvent<HTMLDivElement>) {
    if (!recall || (e.key !== 'Enter' && e.key !== ' ')) return
    const t = e.target as HTMLElement
    if (!t.matches('.lrn-term:not(.is-revealed)')) return
    e.preventDefault() // Space would scroll the page
    reveal(t, true)
  }

  const complete = stats.total > 0 && stats.revealed === stats.total

  // aria-disabled (not disabled) so a focused button keeps focus when it becomes unavailable.
  function onRevealAll() {
    const root = notesRef.current
    if (!root || !stats.total || complete) return
    revealAll(root)
    setStats(readStats(root, numbers))
    announce('Everything on this page is revealed')
  }

  function onHideAll() {
    if (!stats.revealed) return
    setRound((r) => r + 1)
    announce('Hidden again')
  }
  const notesKey = `${recall ? (numbers ? 'rn' : 'r') : 'off'}-${round}`

  return (
    <motion.article className="lrn-article" custom={dir} variants={slideVariants} initial="enter" animate="center" exit="exit">
      <header className="lrn-head">
        <div className="lrn-crumbs">
          <UnitPill unitId={slide.unitId} />
          {part && (
            <>
              <ChevronRight size={14} className="lrn-crumbs-sep" aria-hidden="true" />
              <span className="lrn-crumbs-part">{part}</span>
            </>
          )}
        </div>
        <div className="lrn-title-row">
          <h1 ref={titleRef} className="lrn-title">
            {num && (
              <>
                <span className="lrn-title-num">{num}</span>{' '}
              </>
            )}
            {text}
          </h1>
          <Link to={`/tutor/${slide.id}`} className="btn btn-sm lrn-listen" title="Hear this section explained">
            <Headphones size={16} aria-hidden="true" />
            Listen
          </Link>
        </div>
        <div className="lrn-meta">
          <span>{topic ? `Topic ${topic.index} of ${topic.count}` : 'Practice questions'}</span>
          <span className="lrn-meta-dot" aria-hidden="true" />
          <span aria-label={`Section ${slide.index + 1} of ${SLIDES.length}`}>
            {slide.index + 1} / {SLIDES.length}
          </span>
          <AnimatePresence initial={false}>
            {understood && (
              <motion.span
                className="lrn-meta-done"
                initial={{ opacity: 0, scale: 0.7 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.7 }}
                transition={bouncy}
              >
                <Check size={12} strokeWidth={3} aria-hidden="true" /> Understood
              </motion.span>
            )}
          </AnimatePresence>
        </div>
      </header>

      <AnimatePresence initial={false}>
        {recall && (
          <motion.div
            key="recall"
            className="lrn-recall-wrap"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ height: { duration: 0.3, ease: easeOut }, opacity: { duration: 0.2 } }}
          >
            <div className={`lrn-recall${complete ? ' is-complete' : ''}`}>
              <div className="lrn-recall-main">
                <span className="lrn-recall-icon" aria-hidden="true">
                  {complete ? <Check size={18} strokeWidth={3} /> : <Brain size={18} />}
                </span>
                <div className="lrn-recall-copy">
                  {stats.total > 0 ? (
                    <>
                      <span className="lrn-recall-count">
                        <strong>{stats.revealed}</strong> / {stats.total} revealed
                      </span>
                      <span className="lrn-recall-hint">
                        {complete ? 'All revealed. Hide them again for another pass.' : 'Recall each hidden item first, then tap it to check.'}
                      </span>
                    </>
                  ) : (
                    <>
                      <span className="lrn-recall-count">Nothing hidden on this page</span>
                      <span className="lrn-recall-hint">
                        {slide.isPractice
                          ? 'Answer each question from memory, aloud or on paper, before you check the notes.'
                          : stats.numbers > 0
                            ? `Turn on Numbers to hide the ${stats.numbers} numbers and amounts here.`
                            : 'Try explaining this section aloud without looking.'}
                      </span>
                    </>
                  )}
                </div>
              </div>
              {stats.total > 0 && (
                <div className="bar lrn-recall-bar" aria-hidden="true">
                  <span style={{ width: `${(stats.revealed / stats.total) * 100}%` }} />
                </div>
              )}
              <div className="lrn-recall-actions">
                <button
                  type="button"
                  className="chip"
                  aria-pressed={numbers}
                  onClick={onToggleNumbers}
                  title="Also hide section numbers, amounts and percentages"
                >
                  <Hash size={14} aria-hidden="true" />
                  Numbers
                </button>
                <span className="lrn-recall-spacer" />
                <button type="button" className="btn btn-sm btn-ghost" onClick={onRevealAll} aria-disabled={!stats.total || complete}>
                  <Eye size={15} aria-hidden="true" />
                  Reveal all
                </button>
                <button type="button" className="btn btn-sm btn-ghost" onClick={onHideAll} aria-disabled={!stats.revealed}>
                  <EyeOff size={15} aria-hidden="true" />
                  Hide all
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div
        key={notesKey}
        ref={notesRef}
        className={`notes lrn-notes${recall ? ' is-recall' : ''}`}
        onClick={onNotesClick}
        onKeyDown={onNotesKey}
        dangerouslySetInnerHTML={{ __html: slide.html }}
      />

      <div className="lrn-done-wrap">
        <button type="button" className="lrn-done" aria-pressed={understood} onClick={onToggleUnderstood} aria-keyshortcuts="M">
          <CheckMark on={understood} size={34} />
          <span className="lrn-done-text">
            <AnimatePresence mode="popLayout" initial={false}>
              <motion.span
                key={understood ? 'yes' : 'no'}
                className="lrn-done-title"
                initial={{ y: 12, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: -12, opacity: 0 }}
                transition={spring}
              >
                {understood ? 'Understood' : 'Mark as understood'}
              </motion.span>
            </AnimatePresence>
            <span className="lrn-done-sub">
              {understood
                ? 'Counted in your unit progress. Press again to undo.'
                : slide.isPractice
                  ? 'Mark it once you can answer every question.'
                  : 'Could you explain this section without your notes?'}
            </span>
          </span>
          <span className="kbd lrn-done-kbd" aria-hidden="true">
            M
          </span>
        </button>
      </div>

      {unitEnd && <EndOfUnit slide={slide} />}

      <nav className="lrn-nav" aria-label="Previous and next section">
        {prev ? (
          <Link to={`/learn/${prev.id}`} className="lrn-nav-card lrn-nav-card--prev" style={unitVars(prev.unitId)} rel="prev">
            <span className="lrn-nav-dir">
              <ArrowLeft size={14} aria-hidden="true" />
              Previous{prev.unitId !== slide.unitId ? ` · ${getUnit(prev.unitId).short}` : ''}
            </span>
            <span className="lrn-nav-title">{prev.title}</span>
          </Link>
        ) : (
          <span className="lrn-nav-spacer" aria-hidden="true" />
        )}
        {next ? (
          <Link to={`/learn/${next.id}`} className="lrn-nav-card lrn-nav-card--next" style={unitVars(next.unitId)} rel="next">
            <span className="lrn-nav-dir">
              {next.unitId !== slide.unitId ? `Next unit · ${getUnit(next.unitId).short}` : 'Next'}
              <ArrowRight size={14} aria-hidden="true" />
            </span>
            <span className="lrn-nav-title">{next.title}</span>
          </Link>
        ) : (
          <Link to="/reference?tab=figures" className="lrn-nav-card lrn-nav-card--next">
            <span className="lrn-nav-dir">
              Reference
              <ArrowRight size={14} aria-hidden="true" />
            </span>
            <span className="lrn-nav-title">Key figures at a glance</span>
          </Link>
        )}
      </nav>

      <div className="lrn-keys" aria-hidden="true">
        <span>
          <span className="kbd">←</span>
          <span className="kbd">→</span> Previous / next
        </span>
        <span>
          <span className="kbd">M</span> Understood
        </span>
        <span>
          <span className="kbd">B</span> Bookmark
        </span>
        <span>
          <span className="kbd">R</span> Recall mode
        </span>
      </div>
      <p className="lrn-swipe-tip" aria-hidden="true">
        <Hand size={15} />
        Swipe left or right to turn the page
      </p>
    </motion.article>
  )
}
