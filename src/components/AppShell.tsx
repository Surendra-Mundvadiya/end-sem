import { useEffect, useState, type MouseEvent, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { Link, useLocation } from 'react-router-dom'
import { Ellipsis, Flame, Moon, Search, Sun, X } from 'lucide-react'
import { SUBJECT, SUBJECTS, UNITS, slidesOfUnit, unitVars } from '../data'
import { easeOut, spring } from '../lib/motion'
import { studyStreak, unitStats, useProgress } from '../lib/progress'
import { toggleThemeAt, useTheme } from '../lib/theme'
import { switchSubject } from '../subjects/registry'
import CommandPalette from './CommandPalette'
import { NAV_ITEMS, isNavActive, type NavItem } from './nav'
import './AppShell.css'

const TAB_ITEMS = NAV_ITEMS.filter((n) => ['/', '/learn', '/tutor', NAV_ITEMS.some((x) => x.to === '/quiz') ? '/quiz' : '/flashcards'].includes(n.to))
const MORE_ITEMS = NAV_ITEMS.filter((n) => !TAB_ITEMS.includes(n))

function Brand() {
  return (
    <Link to="/" className="app-brand" aria-label={`${SUBJECT.title} study kit, home`}>
      <span className="app-brand__mark" aria-hidden="true">
        §
      </span>
      <span className="app-brand__text">
        <b>{SUBJECT.title}</b>
        <small>Study Kit · {SUBJECT.subtitle}</small>
      </span>
    </Link>
  )
}

/** Shown once there is more than one subject; switching reloads the app on that subject. */
function SubjectSwitcher() {
  if (SUBJECTS.length < 2) return null
  return (
    <label className="app-subject">
      <span className="eyebrow">Subject</span>
      <select className="select" value={SUBJECT.id} onChange={(e) => switchSubject(e.target.value)}>
        {SUBJECTS.map((s) => (
          <option key={s.id} value={s.id}>
            {s.title}
          </option>
        ))}
      </select>
    </label>
  )
}

function ThemeButton() {
  const { resolved } = useTheme()
  function onClick(e: MouseEvent<HTMLButtonElement>) {
    const r = e.currentTarget.getBoundingClientRect()
    toggleThemeAt(r.left + r.width / 2, r.top + r.height / 2)
  }
  return (
    <button type="button" className="btn btn-ghost btn-icon" onClick={onClick} aria-label={resolved === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}>
      <AnimatePresence mode="wait" initial={false}>
        <motion.span
          key={resolved}
          style={{ display: 'grid' }}
          initial={{ rotate: -90, scale: 0.4, opacity: 0 }}
          animate={{ rotate: 0, scale: 1, opacity: 1 }}
          exit={{ rotate: 90, scale: 0.4, opacity: 0 }}
          transition={{ duration: 0.22, ease: easeOut }}
        >
          {resolved === 'dark' ? <Moon size={18} /> : <Sun size={18} />}
        </motion.span>
      </AnimatePresence>
    </button>
  )
}

function SideLink({ item, active }: { item: NavItem; active: boolean }) {
  const Icon = item.icon
  return (
    <Link to={item.to} className={`app-nav__link${active ? ' is-active' : ''}`} aria-current={active ? 'page' : undefined}>
      {active && <motion.span layoutId="app-nav-pill" className="app-nav__pill" transition={spring} />}
      <Icon size={18} className="app-nav__icon" aria-hidden="true" />
      <span className="app-nav__label">{item.label}</span>
    </Link>
  )
}

function UnitProgress() {
  const progress = useProgress()
  return (
    <div className="app-units">
      <div className="eyebrow app-side-label">Your units</div>
      {UNITS.map((u) => {
        const s = unitStats(progress, u.id)
        return (
          <Link key={u.id} to={`/learn/${slidesOfUnit(u.id)[0].id}`} className="app-unit" style={unitVars(u.id)} title={`${u.short}: ${u.name}`}>
            <span className="app-unit__row">
              <span className="app-unit__dot" aria-hidden="true" />
              <span className="app-unit__name">{u.name}</span>
              <span className="app-unit__pct">{Math.round(s.mastery * 100)}%</span>
            </span>
            <span className="app-unit__bar" aria-hidden="true">
              <motion.span initial={false} animate={{ scaleX: Math.max(0.02, s.mastery) }} transition={spring} />
            </span>
          </Link>
        )
      })}
    </div>
  )
}

function SearchButton({ onClick, compact = false }: { onClick: () => void; compact?: boolean }) {
  if (compact) {
    return (
      <button type="button" className="btn btn-ghost btn-icon" onClick={onClick} aria-label="Search">
        <Search size={18} />
      </button>
    )
  }
  return (
    <button type="button" className="app-search" onClick={onClick}>
      <Search size={16} aria-hidden="true" />
      <span>Search notes, cases…</span>
      <span className="kbd">Ctrl K</span>
    </button>
  )
}

function MoreSheet({ open, onClose, pathname }: { open: boolean; onClose: () => void; pathname: string }) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  return createPortal(
    <AnimatePresence>
      {open && (
        <>
          <motion.div className="app-sheet-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} />
          <motion.div
            className="app-sheet"
            role="dialog"
            aria-modal="true"
            aria-label="More sections"
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', stiffness: 420, damping: 40 }}
            drag="y"
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.6 }}
            onDragEnd={(_, info) => {
              if (info.offset.y > 90 || info.velocity.y > 600) onClose()
            }}
          >
            <div className="app-sheet__grab" aria-hidden="true" />
            <div className="app-sheet__head">
              <b>More</b>
              <button type="button" className="btn btn-ghost btn-icon btn-sm" onClick={onClose} aria-label="Close">
                <X size={18} />
              </button>
            </div>
            <SubjectSwitcher />
            <div className="app-sheet__grid">
              {MORE_ITEMS.map((item) => {
                const Icon = item.icon
                return (
                  <Link key={item.to} to={item.to} className={`app-sheet__item${isNavActive(pathname, item.to) ? ' is-active' : ''}`} onClick={onClose}>
                    <Icon size={20} aria-hidden="true" />
                    <span>
                      <b>{item.label}</b>
                      <small>{item.hint}</small>
                    </span>
                  </Link>
                )
              })}
            </div>
            <UnitProgress />
          </motion.div>
        </>
      )}
    </AnimatePresence>,
    document.body,
  )
}

export default function AppShell({ children }: { children: ReactNode }) {
  const { pathname } = useLocation()
  const progress = useProgress()
  const streak = studyStreak(progress)
  const [paletteOpen, setPaletteOpen] = useState(false)
  const [moreOpen, setMoreOpen] = useState(false)

  useEffect(() => {
    setMoreOpen(false)
  }, [pathname])

  useEffect(() => {
    const onKey = (e: globalThis.KeyboardEvent) => {
      const t = e.target as HTMLElement | null
      const typing = !!t && (t.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName))
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setPaletteOpen((v) => !v)
      } else if (e.key === '/' && !typing && !e.ctrlKey && !e.metaKey && !e.altKey && document.body.dataset.modal !== 'open') {
        e.preventDefault()
        setPaletteOpen(true)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const study = NAV_ITEMS.filter((n) => n.group === 'study')
  const remember = NAV_ITEMS.filter((n) => n.group === 'remember')

  return (
    <div className="app">
      <aside className="app-sidebar" aria-label="Main navigation">
        <Brand />
        <SubjectSwitcher />
        <SearchButton onClick={() => setPaletteOpen(true)} />
        <nav className="app-nav">
          <div className="eyebrow app-side-label">Study</div>
          {study.map((item) => (
            <SideLink key={item.to} item={item} active={isNavActive(pathname, item.to)} />
          ))}
          <div className="eyebrow app-side-label">Remember</div>
          {remember.map((item) => (
            <SideLink key={item.to} item={item} active={isNavActive(pathname, item.to)} />
          ))}
        </nav>
        <UnitProgress />
        <div className="app-sidebar__foot">
          <span className={`app-streak${streak > 0 ? ' is-on' : ''}`} title="Days in a row with study activity">
            <Flame size={16} aria-hidden="true" />
            {streak > 0 ? `${streak}-day streak` : 'Start a streak today'}
          </span>
          <ThemeButton />
        </div>
      </aside>

      <header className="app-topbar">
        <Brand />
        <div className="app-topbar__actions">
          <SearchButton compact onClick={() => setPaletteOpen(true)} />
          <ThemeButton />
        </div>
      </header>

      <main className="app-main" id="main">
        {children}
      </main>

      <nav className="app-tabbar" aria-label="Main navigation">
        {TAB_ITEMS.map((item) => {
          const Icon = item.icon
          const active = isNavActive(pathname, item.to)
          return (
            <Link key={item.to} to={item.to} className={`app-tab${active ? ' is-active' : ''}`} aria-current={active ? 'page' : undefined}>
              {active && <motion.span layoutId="app-tab-pill" className="app-tab__pill" transition={spring} />}
              <Icon size={20} aria-hidden="true" />
              <span>{item.label}</span>
            </Link>
          )
        })}
        <button type="button" className={`app-tab${MORE_ITEMS.some((m) => isNavActive(pathname, m.to)) ? ' is-active' : ''}`} onClick={() => setMoreOpen(true)}>
          <Ellipsis size={20} aria-hidden="true" />
          <span>More</span>
        </button>
      </nav>

      <MoreSheet open={moreOpen} onClose={() => setMoreOpen(false)} pathname={pathname} />
      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
    </div>
  )
}
