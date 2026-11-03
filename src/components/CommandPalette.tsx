import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import { BookOpen, CornerDownLeft, Layers, Scale, Search, type LucideIcon } from 'lucide-react'
import { CARDS, CASES, SLIDES, getUnit, slideById, unitVars, type UnitId } from '../data'
import { easeOut } from '../lib/motion'
import { getProgress } from '../lib/progress'
import { normalize, stripHtml } from '../lib/text'
import { NAV_ITEMS } from './nav'
import './CommandPalette.css'

type Kind = 'page' | 'note' | 'case' | 'card'

interface Entry {
  kind: Kind
  key: string
  title: string
  sub: string
  to: string
  unitId?: UnitId
  icon?: LucideIcon
  titleN: string
  textN: string
  raw: string
}

const GROUPS: { kind: Kind; label: string; limit: number }[] = [
  { kind: 'page', label: 'Go to', limit: 6 },
  { kind: 'note', label: 'Notes', limit: 8 },
  { kind: 'case', label: 'Cases', limit: 6 },
  { kind: 'card', label: 'Key facts', limit: 5 },
]

const KIND_ICON: Record<Kind, LucideIcon> = { page: Search, note: BookOpen, case: Scale, card: Layers }

let cachedIndex: Entry[] | null = null

function buildIndex(): Entry[] {
  if (cachedIndex) return cachedIndex
  const pages: Entry[] = NAV_ITEMS.map((n) => ({
    kind: 'page',
    key: n.to,
    title: n.label,
    sub: n.hint,
    to: n.to,
    icon: n.icon,
    titleN: normalize(`${n.label} ${n.hint}`),
    textN: '',
    raw: '',
  }))
  const notes: Entry[] = SLIDES.map((s) => ({
    kind: 'note',
    key: s.id,
    title: s.title,
    sub: `${getUnit(s.unitId).short} · ${s.part}`,
    to: `/learn/${s.id}`,
    unitId: s.unitId,
    titleN: normalize(`${s.title} ${s.part}`),
    textN: normalize(s.plain),
    raw: s.plain,
  }))
  const cases: Entry[] = CASES.map((c) => ({
    kind: 'case',
    key: c.id,
    title: c.name,
    sub: `${getUnit(c.unitId).short} · ${c.part}`,
    to: `/cases?q=${encodeURIComponent(c.name.split(/ \(| \[/)[0])}`,
    unitId: c.unitId,
    titleN: normalize(c.name),
    textN: normalize(c.plain),
    raw: stripHtml(c.held),
  }))
  const cards: Entry[] = CARDS.filter((c) => c.kind !== 'case').map((c) => ({
    kind: 'card',
    key: c.id,
    title: stripHtml(c.front),
    sub: stripHtml(c.back),
    to: `/flashcards?unit=${c.unitId}&kind=${c.kind}`,
    unitId: c.unitId,
    titleN: normalize(stripHtml(c.front)),
    textN: normalize(stripHtml(c.back)),
    raw: stripHtml(c.back),
  }))
  cachedIndex = [...pages, ...notes, ...cases, ...cards]
  return cachedIndex
}

function search(query: string): Entry[] {
  const q = normalize(query)
  const index = buildIndex()
  if (!q) {
    const last = slideById(getProgress().lastSlide)
    const pages = index.filter((e) => e.kind === 'page')
    if (!last) return pages
    const resume = index.find((e) => e.kind === 'note' && e.key === last.id)
    return resume ? [{ ...resume, sub: `Continue reading · ${resume.sub}` }, ...pages] : pages
  }
  const words = q.split(' ')
  const scored: { e: Entry; score: number }[] = []
  for (const e of index) {
    let score = 0
    let ok = true
    for (const w of words) {
      if (e.titleN.includes(w)) score += 3
      else if (e.textN.includes(w)) score += 1
      else {
        ok = false
        break
      }
    }
    if (!ok) continue
    if (e.titleN.startsWith(q)) score += 6
    else if (e.titleN.includes(q)) score += 3
    scored.push({ e, score })
  }
  scored.sort((a, b) => b.score - a.score)
  return GROUPS.flatMap((g) => scored.filter((s) => s.e.kind === g.kind).slice(0, g.limit).map((s) => s.e))
}

function escapeRegExp(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function highlight(text: string, query: string): ReactNode {
  const words = normalize(query).split(' ').filter((w) => w.length > 1)
  if (!words.length) return text
  const re = new RegExp(`(${words.map(escapeRegExp).join('|')})`, 'gi')
  return text.split(re).map((part, i) => (i % 2 === 1 ? <mark key={i}>{part}</mark> : part))
}

function snippet(raw: string, query: string): string {
  if (!raw) return ''
  const first = normalize(query).split(' ').find((w) => w.length > 2)
  const at = first ? raw.toLowerCase().indexOf(first) : -1
  if (at < 0) return raw.slice(0, 120) + (raw.length > 120 ? '…' : '')
  const start = Math.max(0, at - 50)
  return (start > 0 ? '…' : '') + raw.slice(start, start + 140) + (start + 140 < raw.length ? '…' : '')
}

export default function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)
  const listRef = useRef<HTMLDivElement>(null)
  const results = useMemo(() => (open ? search(query) : []), [open, query])

  useEffect(() => {
    if (!open) return
    setQuery('')
    setActive(0)
    document.body.dataset.modal = 'open'
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      delete document.body.dataset.modal
      document.body.style.overflow = prevOverflow
    }
  }, [open])

  useEffect(() => setActive(0), [query])

  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>(`[data-index="${active}"]`)?.scrollIntoView({ block: 'nearest' })
  }, [active])

  function go(e: Entry | undefined) {
    if (!e) return
    onClose()
    navigate(e.to)
  }

  function onKeyDown(ev: KeyboardEvent) {
    if (ev.key === 'ArrowDown') {
      ev.preventDefault()
      setActive((i) => (results.length ? (i + 1) % results.length : 0))
    } else if (ev.key === 'ArrowUp') {
      ev.preventDefault()
      setActive((i) => (results.length ? (i - 1 + results.length) % results.length : 0))
    } else if (ev.key === 'Enter') {
      ev.preventDefault()
      go(results[active])
    } else if (ev.key === 'Escape') {
      ev.preventDefault()
      onClose()
    }
  }

  let flat = -1

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          className="cp-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) onClose()
          }}
        >
          <motion.div
            className="cp-panel"
            role="dialog"
            aria-modal="true"
            aria-label="Search the study kit"
            initial={{ opacity: 0, y: -16, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.98 }}
            transition={{ duration: 0.24, ease: easeOut }}
          >
            <div className="cp-input-row">
              <Search size={18} aria-hidden="true" />
              <input
                autoFocus
                className="cp-input"
                placeholder="Search notes, cases, sections, figures…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={onKeyDown}
                aria-label="Search"
                aria-controls="cp-results"
                aria-activedescendant={results[active] ? `cp-item-${active}` : undefined}
              />
              <span className="kbd">Esc</span>
            </div>
            <div className="cp-results" id="cp-results" role="listbox" ref={listRef}>
              {results.length === 0 && <p className="cp-empty">No matches. Try a case name, a section number or a topic.</p>}
              {GROUPS.map((g) => {
                const items = results.filter((r) => r.kind === g.kind)
                if (!items.length) return null
                return (
                  <div key={g.kind} className="cp-group">
                    <div className="cp-group__label">{query ? g.label : g.kind === 'note' ? 'Continue' : g.label}</div>
                    {items.map((e) => {
                      flat++
                      const i = flat
                      const Icon = e.icon ?? KIND_ICON[e.kind]
                      return (
                        <div
                          key={`${e.kind}-${e.key}`}
                          id={`cp-item-${i}`}
                          data-index={i}
                          role="option"
                          aria-selected={i === active}
                          className={`cp-item${i === active ? ' is-active' : ''}`}
                          style={e.unitId ? unitVars(e.unitId) : undefined}
                          onMouseMove={() => setActive(i)}
                          onClick={() => go(e)}
                        >
                          <span className="cp-item__icon">
                            <Icon size={16} />
                          </span>
                          <span className="cp-item__text">
                            <span className="cp-item__title">{highlight(e.title, query)}</span>
                            <span className="cp-item__sub">
                              {query && e.kind !== 'page' && e.kind !== 'card' ? highlight(snippet(e.raw, query), query) : e.sub}
                            </span>
                          </span>
                          {i === active && <CornerDownLeft size={15} className="cp-item__enter" aria-hidden="true" />}
                        </div>
                      )
                    })}
                  </div>
                )
              })}
            </div>
            <div className="cp-foot">
              <span>
                <span className="kbd">↑</span> <span className="kbd">↓</span> to move
              </span>
              <span>
                <span className="kbd">Enter</span> to open
              </span>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  )
}
