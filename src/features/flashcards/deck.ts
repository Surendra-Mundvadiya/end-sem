import type { MouseEvent } from 'react'
import { CARDS, UNITS, isUnitId, type Card, type CardKind, type UnitId } from '../../data'
import { BOX_INTERVALS_MS, MAX_BOX, isCardDue, isCardMastered, type CardState } from '../../lib/progress'
import { shuffle } from '../../lib/text'

/*
 * Pure helpers for the flashcard deck: filtering, queue building, counts and formatting.
 * Card front/back are treated as generic prompt/answer HTML: nothing here depends on what a card says.
 */

export type UnitFilter = UnitId | 'all'
export type KindFilter = CardKind | 'all'
export type Mode = 'due' | 'all'
export type SessionSize = '10' | '20' | 'all'

export const MODE_KEY = 'taxlaw-fc-mode'
export const SIZE_KEY = 'taxlaw-fc-size'
export const MODES: readonly Mode[] = ['due', 'all']
export const SIZES: readonly SessionSize[] = ['10', '20', 'all']
export const KIND_FILTERS: readonly KindFilter[] = ['all', 'case', 'concept', 'figure']

/** Display labels for the card kinds in the data model. */
export const KIND_META: Record<CardKind, { label: string; plural: string; short: string }> = {
  case: { label: 'Case', plural: 'Cases', short: 'Cases' },
  concept: { label: 'Concept', plural: 'Concepts', short: 'Concepts' },
  figure: { label: 'Key figure', plural: 'Key figures', short: 'Figures' },
}

export const cardById = new Map(CARDS.map((c) => [c.id, c]))

export function parseUnit(v: string | null): UnitFilter {
  return isUnitId(v) ? v : 'all'
}

export function parseKind(v: string | null): KindFilter {
  return v === 'case' || v === 'concept' || v === 'figure' ? v : 'all'
}

export function filterDeck(unit: UnitFilter, kind: KindFilter): Card[] {
  return CARDS.filter((c) => (unit === 'all' || c.unitId === unit) && (kind === 'all' || c.kind === kind))
}

export interface DeckStats {
  total: number
  /** Never reviewed (these count as due). */
  fresh: number
  /** Reviewed before and due again now. */
  review: number
  /** fresh + review */
  due: number
  /** Box 4 or 5 (isCardMastered). */
  mastered: number
  /** Cards in each Leitner box, index 0 = box 1. */
  boxes: number[]
  /** Earliest future due time among cards that are not due yet. */
  nextDue: number | null
}

export function deckStats(deck: readonly Card[], states: Record<string, CardState>, now: number): DeckStats {
  const boxes = Array.from({ length: MAX_BOX }, () => 0)
  let fresh = 0
  let review = 0
  let mastered = 0
  let nextDue: number | null = null
  for (const c of deck) {
    const s = states[c.id]
    if (!s) {
      fresh++
      continue
    }
    boxes[Math.min(MAX_BOX, Math.max(1, s.box)) - 1]++
    if (isCardMastered(s)) mastered++
    if (isCardDue(s, now)) review++
    else if (nextDue === null || s.due < nextDue) nextDue = s.due
  }
  return { total: deck.length, fresh, review, due: fresh + review, mastered, boxes, nextDue }
}

/**
 * Snapshot of card ids for one session. "Due now" takes the most overdue reviews first, then new cards,
 * and mixes the chosen set so a session is not all one kind. "All" shuffles the whole filtered deck.
 */
export function buildQueue(deck: readonly Card[], states: Record<string, CardState>, mode: Mode, size: SessionSize, now: number): string[] {
  const limit = size === 'all' ? deck.length : Number(size)
  if (mode === 'all') return shuffle(deck).slice(0, limit).map((c) => c.id)
  const reviews = deck
    .filter((c) => states[c.id] && isCardDue(states[c.id], now))
    .sort((a, b) => states[a.id].due - states[b.id].due)
  const fresh = shuffle(deck.filter((c) => !states[c.id]))
  return shuffle([...reviews, ...fresh].slice(0, limit)).map((c) => c.id)
}

/** The wait after landing in a box, exactly as reviewCard computes it (BOX_INTERVALS_MS[box - 1]). */
export function boxInterval(box: number): number {
  return BOX_INTERVALS_MS[Math.min(MAX_BOX, Math.max(1, box)) - 1] ?? 0
}

export function formatInterval(ms: number, short = false): string {
  if (ms <= 0) return short ? 'Now' : 'right away'
  const min = Math.round(ms / 60_000)
  if (min < 60) return `${min} min`
  const h = Math.round(min / 60)
  if (h < 24) return `${h} h`
  const d = Math.round(h / 24)
  return d === 1 ? '1 day' : `${d} days`
}

function dayKey(d: Date): string {
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
}

/** "in 8 min", "today at 11:40 pm", "tomorrow at 9:30 am", "on Thu, 6 Nov". */
export function formatDue(due: number, now: number): string {
  const diff = due - now
  if (diff <= 60_000) return 'in under a minute'
  if (diff < 60 * 60_000) return `in ${Math.ceil(diff / 60_000)} min`
  const at = new Date(due)
  const time = at.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
  if (dayKey(at) === dayKey(new Date(now))) return `today at ${time}`
  const tomorrow = new Date(now)
  tomorrow.setDate(tomorrow.getDate() + 1)
  if (dayKey(at) === dayKey(tomorrow)) return `tomorrow at ${time}`
  return `on ${at.toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'short' })}`
}

const textCache = new Map<string, string>()

/** Plain text of trusted HTML with entities decoded (for recaps, sizing and screen-reader announcements). */
export function htmlToText(html: string): string {
  let t = textCache.get(html)
  if (t === undefined) {
    if (typeof DOMParser === 'undefined') t = html.replace(/<[^>]+>/g, ' ')
    else t = new DOMParser().parseFromString(html, 'text/html').body.textContent ?? ''
    t = t.replace(/\s+/g, ' ').trim()
    textCache.set(html, t)
  }
  return t
}

export function quizHref(unit: UnitFilter): string {
  const units = unit === 'all' ? UNITS.map((u) => u.id).join(',') : unit
  return `/quiz?units=${units}&count=10&start=1`
}

/**
 * After a mouse click, drop focus from a persistent control so Space flips the card instead of pressing the
 * control again. Keyboard and assistive-tech activations (no "mouse" pointerType) keep their focus.
 */
export function releaseMouseFocus(e: MouseEvent<HTMLElement>) {
  if ((e.nativeEvent as PointerEvent).pointerType === 'mouse') e.currentTarget.blur()
}

export function readPref<T extends string>(key: string, allowed: readonly T[], fallback: T): T {
  try {
    const v = localStorage.getItem(key)
    return v !== null && (allowed as readonly string[]).includes(v) ? (v as T) : fallback
  } catch {
    return fallback
  }
}

export function writePref(key: string, value: string) {
  try {
    localStorage.setItem(key, value)
  } catch {
    /* storage blocked: the preference just isn't remembered */
  }
}
