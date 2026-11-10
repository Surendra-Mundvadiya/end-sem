import { Brain, Calculator, Columns3, GitBranch, History, ListOrdered, Route, Shapes, type LucideIcon } from 'lucide-react'
import {
  LAB,
  PARTS,
  SLIDES,
  UNITS,
  slideById,
  type CompareTool as CompareData,
  type FlowTool as FlowData,
  type FormulaTool as FormulaData,
  type MnemonicTool as MnemonicData,
  type SortTool as SortData,
  type TimelineTool as TimelineData,
  type UnitId,
} from '../../data'
import { plural } from '../../lib/text'
import { isAsidePart, plainText } from './util'

/*
 * Every Memory Lab tool as one flat, ordered list: the two whole-subject games built from the notes themselves,
 * then each unit's tools in the order the notes teach them, then the subject's cross-unit tools.
 */

export type LabKind = 'map' | 'order' | 'compare' | 'sort' | 'timeline' | 'mnemonic' | 'formula' | 'flow'

interface EntryBase {
  id: string
  title: string
  intro: string
  unitId: UnitId | null
  slideId?: string
  /** Short size line for the card, e.g. "4 rows · 3 columns". */
  meta: string
}

export type LabEntry = EntryBase &
  (
    | { kind: 'map' }
    | { kind: 'order' }
    | { kind: 'compare'; tool: CompareData }
    | { kind: 'sort'; tool: SortData }
    | { kind: 'timeline'; tool: TimelineData }
    | { kind: 'mnemonic'; tool: MnemonicData }
    | { kind: 'formula'; tool: FormulaData }
    | { kind: 'flow'; tool: FlowData }
  )

export const KIND_META: Record<LabKind, { label: string; icon: LucideIcon }> = {
  map: { label: 'Course map', icon: Route },
  order: { label: 'In order', icon: ListOrdered },
  compare: { label: 'Compare', icon: Columns3 },
  sort: { label: 'Sort', icon: Shapes },
  timeline: { label: 'Timeline', icon: History },
  mnemonic: { label: 'Memory hook', icon: Brain },
  formula: { label: 'Calculator', icon: Calculator },
  flow: { label: 'Decision tree', icon: GitBranch },
}

const topicCount = PARTS.filter((p) => !isAsidePart(p)).length

const BUILT_IN: LabEntry[] = [
  {
    kind: 'map',
    id: 'course-map',
    title: 'Course map',
    intro: 'The whole syllabus as one journey: every unit, every topic, in order. Walk it until you can see it with your eyes closed.',
    unitId: null,
    meta: `${plural(UNITS.length, 'unit')} · ${plural(topicCount, 'topic')}`,
  },
  {
    kind: 'order',
    id: 'topic-order',
    title: 'Put the topics in order',
    intro: 'Rebuild the syllabus from memory: the units, the topics in each unit, then the sub-topics in each topic.',
    unitId: null,
    meta: '3 ways to play',
  },
]

function truncate(s: string, n = 140): string {
  const t = plainText(s)
  return t.length > n ? `${t.slice(0, n - 1).trimEnd()}…` : t
}

function fromData(): (LabEntry & { order: number })[] {
  const out: (LabEntry & { order: number })[] = []
  let seq = 0
  // Type order breaks ties between tools on the same slide; seq keeps array order within a type.
  const push = (e: LabEntry) => {
    const slide = slideById(e.slideId)
    out.push({ ...e, order: (slide ? slide.index : SLIDES.length) * 10_000 + seq++ })
  }
  const base = (t: { id: string; title: string; unitId: UnitId | null; slideId?: string; intro?: string }, fallback: string) => ({
    id: t.id,
    title: t.title,
    unitId: t.unitId,
    slideId: t.slideId,
    intro: t.intro?.trim() || truncate(fallback),
  })

  for (const t of LAB.compare) {
    const cols = Math.max(0, (t.columns?.length ?? 1) - 1)
    push({ ...base(t, 'See the differences side by side, then test yourself cell by cell.'), kind: 'compare', tool: t, meta: `${plural(t.rows?.length ?? 0, 'row')} · ${plural(cols, 'column')}` })
  }
  for (const t of LAB.sort) {
    push({ ...base(t, t.prompt || 'Put each item in the right group.'), kind: 'sort', tool: t, meta: `${plural(t.items?.length ?? 0, 'item')} · ${plural(t.buckets?.length ?? 0, 'group')}` })
  }
  for (const t of LAB.timeline) {
    push({ ...base(t, 'The events one after another, in order.'), kind: 'timeline', tool: t, meta: plural(t.events?.length ?? 0, 'event') })
  }
  for (const t of LAB.mnemonics) {
    const keys = (t.items ?? []).map((i) => i.key).join(' · ')
    push({ ...base(t, t.hook || 'A hook to recall the list in order.'), kind: 'mnemonic', tool: t, meta: keys && keys.length <= 28 ? keys : plural(t.items?.length ?? 0, 'key') })
  }
  for (const t of LAB.formulas) {
    push({ ...base(t, t.meaning || 'Work it out with your own numbers.'), kind: 'formula', tool: t, meta: plural(t.vars?.length ?? 0, 'input') })
  }
  for (const t of LAB.flows) {
    const leaves = Object.values(t.nodes ?? {}).filter((n) => n.result).length
    push({ ...base(t, 'Answer each question to reach the right outcome.'), kind: 'flow', tool: t, meta: plural(leaves, 'outcome') })
  }
  return out.sort((a, b) => a.order - b.order)
}

const DATA = fromData()

/** Tools of each unit, in teaching order. */
export const UNIT_TOOLS: Map<UnitId, LabEntry[]> = new Map(UNITS.map((u) => [u.id, [] as LabEntry[]]))
/** Tools that span the subject (unitId null), in teaching order. */
export const SUBJECT_TOOLS: LabEntry[] = []

const seen = new Set(BUILT_IN.map((e) => e.id))
for (const { order: _order, ...e } of DATA) {
  // First id wins, so content can't shadow a built-in tool or another tool.
  if (!e.id || seen.has(e.id)) continue
  seen.add(e.id)
  const entry = e as LabEntry
  if (entry.unitId && UNIT_TOOLS.has(entry.unitId)) UNIT_TOOLS.get(entry.unitId)!.push(entry)
  else SUBJECT_TOOLS.push({ ...entry, unitId: null } as LabEntry)
}

export const WHOLE_SUBJECT: LabEntry[] = BUILT_IN

/** Every tool in the order the index shows them (used for previous / next). */
export const ALL_TOOLS: LabEntry[] = [...BUILT_IN, ...UNITS.flatMap((u) => UNIT_TOOLS.get(u.id) ?? []), ...SUBJECT_TOOLS]

/** Fewer items than this and an order game has nothing to remember. */
export const MIN_ORDER_ITEMS = 3

/** True when the unit has enough topics for "Topics within a unit". */
export function canOrderTopics(unitId: UnitId): boolean {
  return PARTS.filter((p) => p.unitId === unitId && !isAsidePart(p)).length >= MIN_ORDER_ITEMS
}

const byId = new Map(ALL_TOOLS.map((e) => [e.id, e]))

export function entryById(id: string | undefined): LabEntry | undefined {
  return id ? byId.get(id) : undefined
}
