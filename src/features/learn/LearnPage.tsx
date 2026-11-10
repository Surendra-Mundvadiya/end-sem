import { useCallback, useEffect, useEffectEvent, useRef, useState, type CSSProperties } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, animate, motion, useMotionValue, useSpring, useTransform, type MotionValue, type PanInfo } from 'framer-motion'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import confetti from 'canvas-confetti'
import { AArrowDown, AArrowUp, ArrowLeft, ArrowRight, Bookmark, Brain, ListTree, PartyPopper, X } from 'lucide-react'
import { HAS_QUIZ, SLIDES, getUnit, slideById, slidesOfUnit, unitVars, type Slide, type UnitId } from '../../data'
import { setLastSlide, setUnderstood, toggleBookmark, useProgress } from '../../lib/progress'
import { bouncy, easeOut, spring } from '../../lib/motion'
import UnitPill from '../../components/UnitPill'
import CheckMark from './CheckMark'
import SlideBody from './SlideBody'
import Toc, { TocDrawer } from './Toc'
import { isBool, prefersReducedMotion, shouldIgnoreShortcut, tokenValue, useMediaQuery, useStoredState } from './hooks'
import { neighbours } from './outline'
import { NO_RECALL, type RecallStats } from './recall'
import './learn.css'

const SIZES = [
  { label: 'Small', rem: 0.98 },
  { label: 'Medium', rem: 1.08 },
  { label: 'Large', rem: 1.2 },
  { label: 'Extra large', rem: 1.32 },
] as const

const isSizeIndex = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v) && v >= 0 && v < SIZES.length

/*
 * The outline gets its own column only when the reading column still holds a full measure next to it:
 * 264px app sidebar + gutters + 272px outline + ~580px of text needs about 1240px.
 */
const WIDE_QUERY = '(min-width: 1240px)'

/** Swipe: distance (px) or flick velocity (px/s) needed to turn the page. */
const SWIPE_DISTANCE = 80
const SWIPE_VELOCITY = 500

export default function LearnPage() {
  const { slideId } = useParams()
  const progress = useProgress()
  const slide = slideById(slideId)
  if (!slide) {
    const fallback = slideById(progress.lastSlide)?.id ?? SLIDES[0].id
    return <Navigate to={`/learn/${fallback}`} replace />
  }
  return <Reader slide={slide} />
}

function Reader({ slide }: { slide: Slide }) {
  const progress = useProgress()
  const navigate = useNavigate()
  const wide = useMediaQuery(WIDE_QUERY)
  const [sizeIndex, setSizeIndex] = useStoredState('taxlaw-reader-size', 1, isSizeIndex)
  const [recall, setRecall] = useStoredState('taxlaw-reader-recall', false, isBool)
  const [numbers, setNumbers] = useStoredState('taxlaw-reader-numbers', false, isBool)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [recallStats, setRecallStats] = useState<RecallStats>(NO_RECALL)
  const [toast, setToast] = useState<{ id: number; unitId: UnitId } | null>(null)
  const [message, setMessage] = useState('')
  const [bmPulse, setBmPulse] = useState(0)
  const [isLong, setIsLong] = useState(false)
  const [titleVisible, setTitleVisible] = useState(true)
  const contentsBtn = useRef<HTMLButtonElement>(null)
  const readerRef = useRef<HTMLDivElement>(null)
  const swipeRef = useRef<HTMLDivElement>(null)
  const touchPan = useRef(false)
  const dragX = useMotionValue(0)
  const readMV = useMotionValue(0)
  const readProgress = useSpring(readMV, { stiffness: 260, damping: 40, restDelta: 0.001 })

  // Page-turn direction, derived when the slide changes (kept in state so it is stable during the exit).
  const [turn, setTurn] = useState({ id: slide.id, index: slide.index, dir: 0 })
  if (turn.id !== slide.id) setTurn({ id: slide.id, index: slide.index, dir: slide.index > turn.index ? 1 : -1 })
  const dir = turn.id === slide.id ? turn.dir : slide.index > turn.index ? 1 : -1

  const { prev, next } = neighbours(slide)
  const understood = Boolean(progress.understood[slide.id])
  const bookmarked = Boolean(progress.bookmarks[slide.id])
  const size = SIZES[sizeIndex] ?? SIZES[1]

  useEffect(() => {
    setLastSlide(slide.id)
  }, [slide.id])

  useEffect(() => {
    setDrawerOpen(false)
  }, [slide.id, wide])

  const announce = useCallback((m: string) => setMessage((prev) => (prev === m ? `${m} ` : m)), [])
  const closeDrawer = useCallback(() => setDrawerOpen(false), [])
  const closeToast = useCallback(() => setToast(null), [])
  const go = useCallback((id: string) => navigate(`/learn/${id}`), [navigate])

  // Reading progress for long slides. Capturing on window catches scrolling of whichever ancestor scrolls.
  useEffect(() => {
    let raf = 0
    const measure = () => {
      raf = 0
      const el = swipeRef.current
      if (!el) return
      const r = el.getBoundingClientRect()
      const vh = window.innerHeight
      const long = r.height > vh * 1.1
      setIsLong(long)
      readMV.set(long ? Math.min(1, Math.max(0, -r.top / (r.height - vh))) : 0)
    }
    const schedule = () => {
      if (!raf) raf = requestAnimationFrame(measure)
    }
    schedule()
    window.addEventListener('scroll', schedule, { capture: true, passive: true })
    window.addEventListener('resize', schedule, { passive: true })
    const ro = new ResizeObserver(schedule)
    if (swipeRef.current) ro.observe(swipeRef.current)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('scroll', schedule, true)
      window.removeEventListener('resize', schedule)
      ro.disconnect()
    }
  }, [readMV])

  // After the old slide has left, bring the top of the reader back into view
  // (scroll-padding-top accounts for the fixed top bar on small screens).
  const scrollToReader = useCallback(() => {
    const el = readerRef.current
    if (!el) return
    const pad = parseFloat(getComputedStyle(document.documentElement).scrollPaddingTop) || 0
    if (el.getBoundingClientRect().top < pad - 1) el.scrollIntoView({ block: 'start' })
  }, [])

  // Arriving from another page that was scrolled down.
  useEffect(() => {
    scrollToReader()
  }, [scrollToReader])

  function toggleUnderstoodHere() {
    const was = understood
    setUnderstood(slide.id, !was)
    announce(was ? 'No longer marked as understood' : 'Marked as understood')
    if (!was && slidesOfUnit(slide.unitId).every((s) => s.id === slide.id || progress.understood[s.id])) {
      celebrate(slide.unitId)
      setToast({ id: Date.now(), unitId: slide.unitId })
    }
  }

  function toggleBookmarkHere() {
    toggleBookmark(slide.id)
    setBmPulse((p) => p + 1)
    announce(bookmarked ? 'Bookmark removed' : 'Bookmarked')
  }

  function toggleRecall() {
    setRecall((r) => !r)
    announce(recall ? 'Recall mode off' : 'Recall mode on. Key terms are hidden; select one to reveal it.')
  }

  function changeSize(delta: number) {
    const n = Math.min(SIZES.length - 1, Math.max(0, sizeIndex + delta))
    if (n === sizeIndex) return
    setSizeIndex(n)
    announce(`Text size ${SIZES[n].label}`)
  }

  const onKey = useEffectEvent((e: KeyboardEvent) => {
    if (drawerOpen || e.repeat || shouldIgnoreShortcut(e)) return
    const k = e.key
    if ((k === 'ArrowLeft' || k === 'ArrowRight') && !e.shiftKey) {
      const target = k === 'ArrowLeft' ? prev : next
      if (target) {
        e.preventDefault()
        go(target.id)
      }
      return
    }
    const lower = k.toLowerCase()
    if (lower === 'm') toggleUnderstoodHere()
    else if (lower === 'b') toggleBookmarkHere()
    else if (lower === 'r') toggleRecall()
    else return
    e.preventDefault()
  })

  useEffect(() => {
    const handler = (e: KeyboardEvent) => onKey(e)
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  /* Touch swipe: the page follows the finger (with resistance) and turns past a distance or flick threshold. */
  function onPanStart(e: PointerEvent) {
    touchPan.current = e.pointerType === 'touch'
  }

  function onPan(_: PointerEvent, info: PanInfo) {
    if (!touchPan.current) return
    const { x, y } = info.offset
    if (Math.abs(x) < Math.abs(y) * 1.2) {
      dragX.set(0)
      return
    }
    const canTurn = x < 0 ? next : prev
    dragX.set(x * (canTurn ? 0.3 : 0.1))
  }

  function onPanEnd(_: PointerEvent, info: PanInfo) {
    if (!touchPan.current) return
    touchPan.current = false
    animate(dragX, 0, spring)
    const { x, y } = info.offset
    const vx = info.velocity.x
    if (drawerOpen || Math.abs(x) <= Math.abs(y) * 1.5) return
    if (window.getSelection()?.toString()) return
    if ((x < -SWIPE_DISTANCE || (vx < -SWIPE_VELOCITY && x < -30)) && next) go(next.id)
    else if ((x > SWIPE_DISTANCE || (vx > SWIPE_VELOCITY && x > 30)) && prev) go(prev.id)
  }

  const readerStyle = { ...unitVars(slide.unitId), '--lrn-fs': `${size.rem}rem` } as CSSProperties

  return (
    <div className={`page lrn${wide ? ' lrn--wide' : ''}`}>
      {wide && (
        <aside className="lrn-side" aria-label="Contents">
          <Toc currentId={slide.id} variant="side" />
        </aside>
      )}

      <div className="lrn-main">
        <div ref={readerRef} className="lrn-reader" style={readerStyle}>
          <div className="lrn-toolbar">
            {!wide && (
              <button
                ref={contentsBtn}
                type="button"
                className="lrn-tool lrn-tool--contents"
                onClick={() => setDrawerOpen(true)}
                aria-haspopup="dialog"
                aria-expanded={drawerOpen}
                aria-label="Contents"
                title="Contents"
              >
                <ListTree size={18} aria-hidden="true" />
                <span className="lrn-tool-label" aria-hidden="true">
                  Contents
                </span>
              </button>
            )}
            <div className="lrn-crumb">
              <UnitPill unitId={slide.unitId} />
              <AnimatePresence initial={false}>
                {!titleVisible && (
                  <motion.span
                    className="lrn-crumb-title"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: 0.22, ease: easeOut }}
                    aria-hidden="true"
                  >
                    {slide.title}
                  </motion.span>
                )}
              </AnimatePresence>
            </div>
            <div className="lrn-tools">
              <button
                type="button"
                className="lrn-tool lrn-tool--recall"
                aria-pressed={recall}
                onClick={toggleRecall}
                aria-label="Recall mode"
                title="Recall mode: hide key terms and test yourself (R)"
                aria-keyshortcuts="R"
              >
                <Brain size={18} aria-hidden="true" />
                <span className="lrn-tool-label" aria-hidden="true">
                  Recall
                </span>
                <AnimatePresence initial={false}>
                  {recall && recallStats.total > 0 && (
                    <motion.span
                      key="badge"
                      className="lrn-tool-badge"
                      initial={{ opacity: 0, scale: 0.6 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.6 }}
                      transition={bouncy}
                      aria-hidden="true"
                    >
                      {recallStats.revealed}/{recallStats.total}
                    </motion.span>
                  )}
                </AnimatePresence>
              </button>
              <span className="lrn-tool-sep" aria-hidden="true" />
              <div className="lrn-size" role="group" aria-label={`Text size: ${size.label}`}>
                <button
                  type="button"
                  className="lrn-tool lrn-tool--icon"
                  onClick={() => changeSize(-1)}
                  aria-disabled={sizeIndex === 0}
                  aria-label="Smaller text"
                  title="Smaller text"
                >
                  <AArrowDown size={19} aria-hidden="true" />
                </button>
                <button
                  type="button"
                  className="lrn-tool lrn-tool--icon"
                  onClick={() => changeSize(1)}
                  aria-disabled={sizeIndex === SIZES.length - 1}
                  aria-label="Larger text"
                  title="Larger text"
                >
                  <AArrowUp size={19} aria-hidden="true" />
                </button>
              </div>
              <span className="lrn-tool-sep" aria-hidden="true" />
              <button
                type="button"
                className="lrn-tool lrn-tool--icon"
                aria-pressed={bookmarked}
                onClick={toggleBookmarkHere}
                aria-label="Bookmark this section"
                title="Bookmark (B)"
                aria-keyshortcuts="B"
              >
                <motion.span key={bmPulse} className="lrn-tool-pop" initial={bmPulse ? { scale: 0.55 } : false} animate={{ scale: 1 }} transition={bouncy}>
                  <Bookmark size={18} fill={bookmarked ? 'currentColor' : 'none'} aria-hidden="true" />
                </motion.span>
              </button>
              <button
                type="button"
                className="lrn-tool lrn-tool--icon"
                aria-pressed={understood}
                onClick={toggleUnderstoodHere}
                aria-label="Mark as understood"
                title="Mark as understood (M)"
                aria-keyshortcuts="M"
              >
                <CheckMark key={slide.id} on={understood} size={22} />
              </button>
            </div>
            <div className="lrn-progress" data-show={isLong || undefined} aria-hidden="true">
              <motion.span style={{ scaleX: readProgress }} />
            </div>
          </div>

          <motion.div ref={swipeRef} className="lrn-swipe" style={{ x: dragX }} onPanStart={onPanStart} onPan={onPan} onPanEnd={onPanEnd}>
            <AnimatePresence mode="wait" initial={false} custom={dir} onExitComplete={scrollToReader}>
              <SlideBody
                key={slide.id}
                slide={slide}
                dir={dir}
                understood={understood}
                recall={recall}
                numbers={numbers}
                onToggleNumbers={() => setNumbers((v) => !v)}
                onToggleUnderstood={toggleUnderstoodHere}
                onRecallStats={setRecallStats}
                onTitleVisible={setTitleVisible}
                announce={announce}
              />
            </AnimatePresence>
          </motion.div>
        </div>
      </div>

      {!wide && (
        <TocDrawer open={drawerOpen} onClose={closeDrawer} returnFocus={contentsBtn}>
          <Toc currentId={slide.id} variant="drawer" onNavigate={closeDrawer} onClose={closeDrawer} />
        </TocDrawer>
      )}
      <SwipeCues x={dragX} unitId={slide.unitId} canPrev={Boolean(prev)} canNext={Boolean(next)} />
      <UnitToast toast={toast} onClose={closeToast} />
      <div className="sr-only" aria-live="polite" aria-atomic="true">
        {message}
      </div>
    </div>
  )
}

/** Confetti in the unit's colours when its last section is marked as understood. */
function celebrate(unitId: UnitId) {
  if (prefersReducedMotion()) return
  const colors = [tokenValue(`--${unitId}`), tokenValue('--brand'), tokenValue('--brand-2'), tokenValue('--ok')].filter(Boolean)
  const base = {
    particleCount: 70,
    spread: 72,
    startVelocity: 46,
    ticks: 220,
    zIndex: 95,
    disableForReducedMotion: true,
    ...(colors.length ? { colors } : {}),
  }
  void confetti({ ...base, angle: 60, origin: { x: 0, y: 0.8 } })
  void confetti({ ...base, angle: 120, origin: { x: 1, y: 0.8 } })
}

function SwipeCues({ x, unitId, canPrev, canNext }: { x: MotionValue<number>; unitId: UnitId; canPrev: boolean; canNext: boolean }) {
  // x is the damped finger offset (0.3x), so ±24 is the turn threshold.
  const nextOpacity = useTransform(x, [-24, -6], [1, 0])
  const nextScale = useTransform(x, [-24, -6], [1, 0.6])
  const prevOpacity = useTransform(x, [6, 24], [0, 1])
  const prevScale = useTransform(x, [6, 24], [0.6, 1])
  return createPortal(
    <div style={unitVars(unitId)} aria-hidden="true">
      {canNext && (
        <motion.div className="lrn-cue lrn-cue--next" style={{ opacity: nextOpacity, scale: nextScale }}>
          <ArrowRight size={20} />
        </motion.div>
      )}
      {canPrev && (
        <motion.div className="lrn-cue lrn-cue--prev" style={{ opacity: prevOpacity, scale: prevScale }}>
          <ArrowLeft size={20} />
        </motion.div>
      )}
    </div>,
    document.body,
  )
}

function UnitToast({ toast, onClose }: { toast: { id: number; unitId: UnitId } | null; onClose: () => void }) {
  useEffect(() => {
    if (!toast) return
    const t = window.setTimeout(onClose, 7000)
    return () => window.clearTimeout(t)
  }, [toast, onClose])

  const unit = toast ? getUnit(toast.unitId) : null
  return createPortal(
    <div className="lrn-toast-layer" aria-live="polite">
      <AnimatePresence>
        {toast && unit && (
          <motion.div
            key={toast.id}
            className="lrn-toast"
            style={unitVars(unit.id)}
            initial={{ opacity: 0, y: 28, scale: 0.94 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 14, scale: 0.97 }}
            transition={bouncy}
          >
            <span className="lrn-toast-icon" aria-hidden="true">
              <PartyPopper size={20} />
            </span>
            <span className="lrn-toast-text">
              <strong>{unit.short} complete</strong>
              <span>Every section is marked as understood.</span>
            </span>
            {HAS_QUIZ && (
              <Link className="btn btn-sm btn-unit" to={`/quiz?units=${unit.id}&count=10&start=1`} onClick={onClose}>
                Quiz yourself
              </Link>
            )}
            <button type="button" className="btn btn-icon btn-sm btn-ghost" onClick={onClose} aria-label="Dismiss">
              <X size={16} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>,
    document.body,
  )
}
