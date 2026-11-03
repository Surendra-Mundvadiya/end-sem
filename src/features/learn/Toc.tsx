import { memo, useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, LayoutGroup, motion, useDragControls } from 'framer-motion'
import { Link, useNavigate } from 'react-router-dom'
import { Bookmark, Check, ChevronRight, ListChecks, Search, X } from 'lucide-react'
import { SLIDES, UNITS, getUnit, partsOfUnit, slideById, slidesOfUnit, unitVars, type Part, type Slide, type UnitId } from '../../data'
import { useProgress, type Progress } from '../../lib/progress'
import { easeOut, spring } from '../../lib/motion'
import { matchesQuery, normalize } from '../../lib/text'
import ProgressRing from '../../components/ProgressRing'
import { prefersReducedMotion } from './hooks'
import { splitTitle, tocLabel } from './outline'

/* ---------- helpers ---------- */

function escapeRe(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function highlight(text: string, words: string[]): ReactNode {
  if (!words.length) return text
  const re = new RegExp(`(${words.map(escapeRe).join('|')})`, 'gi')
  return text.split(re).map((piece, i) => (i % 2 ? <mark key={i}>{piece}</mark> : piece))
}

interface TocProps {
  currentId: string
  /** "side" renders in the sticky column; "drawer" inside the slide-over panel. */
  variant: 'side' | 'drawer'
  onNavigate?: () => void
  onClose?: () => void
}

/* ---------- table of contents ---------- */

export default memo(Toc)

function Toc({ currentId, variant, onNavigate, onClose }: TocProps) {
  const progress = useProgress()
  const navigate = useNavigate()
  const current = slideById(currentId)
  const currentUnit: UnitId = current?.unitId ?? 'u1'
  const [query, setQuery] = useState('')
  const [onlyMarked, setOnlyMarked] = useState(false)
  const [open, setOpen] = useState<Set<UnitId>>(() => new Set([currentUnit]))
  const scrollRef = useRef<HTMLDivElement>(null)
  const firstScroll = useRef(true)
  const lastUnit = useRef(currentUnit)
  const filterId = useId()

  // Opening a new unit closes the previous one, so the outline stays short.
  const [seenUnit, setSeenUnit] = useState(currentUnit)
  if (seenUnit !== currentUnit) {
    setSeenUnit(currentUnit)
    setOpen(new Set([currentUnit]))
  }

  const words = useMemo(() => normalize(query).split(' ').filter(Boolean), [query])
  const filtering = words.length > 0 || onlyMarked
  const bookmarkCount = Object.keys(progress.bookmarks).filter((id) => slideById(id)).length
  const understoodCount = Object.keys(progress.understood).filter((id) => slideById(id)).length
  const total = SLIDES.length

  const matches = useMemo(() => {
    if (!filtering) return null
    const ids = new Set<string>()
    for (const u of UNITS)
      for (const s of slidesOfUnit(u.id)) {
        if (onlyMarked && !progress.bookmarks[s.id]) continue
        if (words.length && !matchesQuery(`${s.title} ${s.part}`, query)) continue
        ids.add(s.id)
      }
    return ids
  }, [filtering, onlyMarked, progress.bookmarks, words, query])

  const firstMatch = useMemo(() => {
    if (!matches) return null
    for (const u of UNITS) for (const s of slidesOfUnit(u.id)) if (matches.has(s.id)) return s
    return null
  }, [matches])

  // Keep the current section in view inside the outline (never scrollIntoView: it would scroll the page too).
  useLayoutEffect(() => {
    const box = scrollRef.current
    if (!box) return
    const instant = firstScroll.current
    const unitChanged = lastUnit.current !== currentUnit
    firstScroll.current = false
    lastUnit.current = currentUnit
    const run = () => {
      const el = box.querySelector<HTMLElement>('[aria-current="page"]')
      if (!el) return
      const b = box.getBoundingClientRect()
      const r = el.getBoundingClientRect()
      if (!instant && r.top >= b.top + 48 && r.bottom <= b.bottom - 48) return
      const top = box.scrollTop + (r.top - b.top) - b.height / 2 + r.height / 2
      box.scrollTo({ top: Math.max(0, top), behavior: instant || prefersReducedMotion() ? 'auto' : 'smooth' })
    }
    if (instant) {
      run()
      return
    }
    // Wait for a unit to finish expanding before measuring.
    const t = window.setTimeout(run, unitChanged ? 380 : 40)
    return () => window.clearTimeout(t)
  }, [currentId, currentUnit])

  function toggleUnit(id: UnitId) {
    setOpen((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  return (
    <div className={`lrn-toc lrn-toc--${variant}`}>
      <div className="lrn-toc-head">
        <div className="lrn-toc-top">
          <ProgressRing value={total ? understoodCount / total : 0} size={44} stroke={5} color="var(--brand)" label={`${understoodCount} of ${total} sections understood`}>
            <span className="lrn-toc-ring-num">{Math.round((understoodCount / Math.max(1, total)) * 100)}%</span>
          </ProgressRing>
          <div className="lrn-toc-top-text">
            <span className="eyebrow">Contents</span>
            <span className="lrn-toc-top-sub">
              {understoodCount} of {total} understood
            </span>
          </div>
          {onClose && (
            <button type="button" className="btn btn-icon btn-ghost btn-sm lrn-toc-close" onClick={onClose} aria-label="Close contents">
              <X size={18} />
            </button>
          )}
        </div>
        <div className="lrn-toc-filter">
          <label htmlFor={filterId} className="sr-only">
            Filter sections by title
          </label>
          <div className="lrn-toc-search">
            <Search size={16} aria-hidden="true" />
            <input
              id={filterId}
              className="input"
              type="text"
              inputMode="search"
              enterKeyHint="go"
              placeholder="Filter sections"
              autoComplete="off"
              spellCheck={false}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && firstMatch) {
                  e.preventDefault()
                  navigate(`/learn/${firstMatch.id}`)
                  onNavigate?.()
                } else if (e.key === 'Escape' && query) {
                  e.preventDefault()
                  e.stopPropagation()
                  setQuery('')
                }
              }}
            />
            {query && (
              <button type="button" className="lrn-toc-clear" onClick={() => setQuery('')} aria-label="Clear filter">
                <X size={14} />
              </button>
            )}
          </div>
          <button
            type="button"
            className="chip lrn-toc-bm-chip"
            aria-pressed={onlyMarked}
            onClick={() => setOnlyMarked((v) => !v)}
            aria-label={`Show bookmarked sections only (${bookmarkCount})`}
            title="Bookmarked only"
          >
            <Bookmark size={14} fill={onlyMarked ? 'currentColor' : 'none'} aria-hidden="true" />
            {bookmarkCount}
          </button>
        </div>
        <div className="sr-only" aria-live="polite">
          {matches ? `${matches.size} matching sections` : ''}
        </div>
      </div>

      <motion.div className="lrn-toc-scroll" ref={scrollRef} layoutScroll>
        <LayoutGroup id={`lrn-toc-${variant}`}>
          <nav aria-label="Sections">
            {matches && matches.size === 0 ? (
              <div className="lrn-toc-empty">
                {onlyMarked && !words.length ? (
                  <>
                    No bookmarks yet. Press <span className="kbd">B</span> on any section to keep it here.
                  </>
                ) : (
                  <>No section titles match “{query.trim()}”.</>
                )}
              </div>
            ) : (
              <ul className="lrn-toc-units">
                {UNITS.map((u) => {
                  const unitSlides = slidesOfUnit(u.id)
                  if (matches && !unitSlides.some((s) => matches.has(s.id))) return null
                  return (
                    <TocUnit
                      key={u.id}
                      unitId={u.id}
                      isOpen={filtering || open.has(u.id)}
                      onToggle={() => toggleUnit(u.id)}
                      currentId={currentId}
                      progress={progress}
                      matches={matches}
                      words={words}
                      onNavigate={onNavigate}
                      locked={filtering}
                    />
                  )
                })}
              </ul>
            )}
          </nav>
        </LayoutGroup>
      </motion.div>
    </div>
  )
}

interface UnitProps {
  unitId: UnitId
  isOpen: boolean
  locked: boolean
  onToggle: () => void
  currentId: string
  progress: Progress
  matches: Set<string> | null
  words: string[]
  onNavigate?: () => void
}

function TocUnit({ unitId, isOpen, locked, onToggle, currentId, progress, matches, words, onNavigate }: UnitProps) {
  const unit = getUnit(unitId)
  const slides = slidesOfUnit(unitId)
  const done = slides.filter((s) => progress.understood[s.id]).length
  const parts = partsOfUnit(unitId)
  const regionId = useId()
  const isCurrent = slides.some((s) => s.id === currentId)

  return (
    <li className="lrn-toc-unit" style={unitVars(unitId)} data-current={isCurrent || undefined}>
      <button type="button" className="lrn-toc-unit-btn" aria-expanded={isOpen} aria-controls={regionId} onClick={onToggle} disabled={locked}>
        <motion.span className="lrn-toc-chev" animate={{ rotate: isOpen ? 90 : 0 }} transition={spring} aria-hidden="true">
          <ChevronRight size={16} />
        </motion.span>
        <span className="lrn-toc-unit-text">
          <span className="lrn-toc-unit-short">{unit.short}</span>
          <span className="lrn-toc-unit-name">{unit.name}</span>
        </span>
        <span className="lrn-toc-unit-count" aria-label={`${done} of ${slides.length} understood`}>
          {done}/{slides.length}
        </span>
        <span className="bar lrn-toc-unit-bar" aria-hidden="true">
          <span style={{ width: `${(done / Math.max(1, slides.length)) * 100}%` }} />
        </span>
      </button>
      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            id={regionId}
            className="lrn-toc-unit-body"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ height: { duration: 0.32, ease: easeOut }, opacity: { duration: 0.2 } }}
          >
            <ul className="lrn-toc-parts">
              {parts.map((p) => (
                <TocPart key={p.key} part={p} currentId={currentId} progress={progress} matches={matches} words={words} onNavigate={onNavigate} />
              ))}
            </ul>
          </motion.div>
        )}
      </AnimatePresence>
    </li>
  )
}

/**
 * A topic. When its first slide carries the topic's own title (an introduction), that slide is the
 * topic-level link; otherwise the topic title is a plain label. Sub-sections are indented below.
 */
function TocPart({
  part,
  currentId,
  progress,
  matches,
  words,
  onNavigate,
}: {
  part: Part
  currentId: string
  progress: Progress
  matches: Set<string> | null
  words: string[]
  onNavigate?: () => void
}) {
  const visible = matches ? part.slides.filter((s) => matches.has(s.id)) : part.slides
  if (!visible.length) return null
  const intro = part.slides[0].title === part.title ? part.slides[0] : null
  const subs = visible.filter((s) => s !== intro)
  const { num, text } = splitTitle(part.title)

  return (
    <li className="lrn-toc-part">
      {intro && visible.includes(intro) ? (
        <TocLink slide={intro} label={tocLabel(intro)} level={1} currentId={currentId} progress={progress} words={words} onNavigate={onNavigate} />
      ) : (
        <div className="lrn-toc-part-label">
          <span className="lrn-toc-dot lrn-toc-dot--none" aria-hidden="true" />
          <span className="lrn-toc-label">
            {num && <span className="lrn-toc-num">{num}</span>}
            <span>{highlight(text, words)}</span>
          </span>
        </div>
      )}
      {subs.length > 0 && (
        <ul className="lrn-toc-subs">
          {subs.map((s) => (
            <li key={s.id}>
              <TocLink slide={s} label={tocLabel(s)} level={2} currentId={currentId} progress={progress} words={words} onNavigate={onNavigate} />
            </li>
          ))}
        </ul>
      )}
    </li>
  )
}

function TocLink({
  slide,
  label,
  level,
  currentId,
  progress,
  words,
  onNavigate,
}: {
  slide: Slide
  label: string
  level: 1 | 2
  currentId: string
  progress: Progress
  words: string[]
  onNavigate?: () => void
}) {
  const active = slide.id === currentId
  const done = Boolean(progress.understood[slide.id])
  const marked = Boolean(progress.bookmarks[slide.id])
  const { num, text } = splitTitle(label)

  return (
    <Link
      to={`/learn/${slide.id}`}
      className={`lrn-toc-item lrn-toc-item--l${level}`}
      aria-current={active ? 'page' : undefined}
      data-done={done || undefined}
      data-practice={slide.isPractice || undefined}
      onClick={() => onNavigate?.()}
    >
      {active && <motion.span layoutId="lrn-toc-active" className="lrn-toc-active" transition={spring} aria-hidden="true" />}
      <span className="lrn-toc-dot" aria-hidden="true">
        {slide.isPractice && !done ? <ListChecks size={11} strokeWidth={2.4} /> : <Check size={12} strokeWidth={3.4} />}
      </span>
      <span className="lrn-toc-label">
        {num && <span className="lrn-toc-num">{num}</span>}
        <span>{highlight(text, words)}</span>
      </span>
      {done && <span className="sr-only">, understood</span>}
      {marked && (
        <span className="lrn-toc-bm" title="Bookmarked">
          <Bookmark size={13} fill="currentColor" aria-hidden="true" />
          <span className="sr-only">, bookmarked</span>
        </span>
      )}
    </Link>
  )
}

/* ---------- slide-over drawer (below the wide breakpoint) ---------- */

export function TocDrawer({
  open,
  onClose,
  returnFocus,
  children,
}: {
  open: boolean
  onClose: () => void
  returnFocus: RefObject<HTMLElement | null>
  children: ReactNode
}) {
  const panelRef = useRef<HTMLDivElement>(null)
  const dragControls = useDragControls()

  useEffect(() => {
    if (!open) return
    const root = document.documentElement
    const prevOverflow = root.style.overflow
    const prevPadding = root.style.paddingRight
    // Compensate for a classic (space-taking) scrollbar so the page does not shift sideways.
    const scrollbar = window.innerWidth - root.clientWidth
    if (scrollbar > 0) root.style.paddingRight = `${scrollbar}px`
    root.style.overflow = 'hidden'
    const focusTimer = window.setTimeout(() => {
      const panel = panelRef.current
      const target = panel?.querySelector<HTMLElement>('[aria-current="page"]') ?? panel?.querySelector<HTMLElement>('input')
      target?.focus({ preventScroll: true })
    }, 30)

    const onKey = (e: KeyboardEvent) => {
      if (document.body.dataset.modal === 'open') return
      if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
        return
      }
      if (e.key !== 'Tab') return
      const panel = panelRef.current
      if (!panel) return
      const items = Array.from(panel.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), input, [tabindex]:not([tabindex="-1"])')).filter(
        (el) => el.offsetParent !== null,
      )
      if (!items.length) return
      const first = items[0]
      const last = items[items.length - 1]
      if (e.shiftKey && (document.activeElement === first || !panel.contains(document.activeElement))) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault()
        first.focus()
      }
    }
    window.addEventListener('keydown', onKey)
    const back = returnFocus.current
    return () => {
      window.clearTimeout(focusTimer)
      root.style.overflow = prevOverflow
      root.style.paddingRight = prevPadding
      window.removeEventListener('keydown', onKey)
      back?.focus({ preventScroll: true })
    }
  }, [open, onClose, returnFocus])

  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="lrn-drawer-layer" key="lrn-drawer">
          <motion.div
            className="lrn-drawer-scrim"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.22, ease: easeOut }}
            onClick={onClose}
            aria-hidden="true"
          />
          <motion.div
            ref={panelRef}
            className="lrn-drawer"
            role="dialog"
            aria-modal="true"
            aria-label="Contents"
            initial={{ x: '-104%' }}
            animate={{ x: 0 }}
            exit={{ x: '-104%' }}
            transition={{ type: 'spring', stiffness: 340, damping: 36 }}
            drag="x"
            dragListener={false}
            dragControls={dragControls}
            dragDirectionLock
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={{ left: 0.5, right: 0 }}
            onPointerDown={(e) => {
              // Swipe-to-close is a touch gesture; a mouse drag here is text selection.
              if (e.pointerType === 'touch') dragControls.start(e)
            }}
            onDragEnd={(_, info) => {
              if (info.offset.x < -90 || info.velocity.x < -450) onClose()
            }}
          >
            {children}
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  )
}
