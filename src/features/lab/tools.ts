import type { ComponentType } from 'react'
import type { LucideIcon } from 'lucide-react'
import { Brain, Calculator, History, House, Layers, Plane, Scale, TrendingDown } from 'lucide-react'
import type { UnitId } from '../../data'
import DepreciationTool from './calc/DepreciationTool'
import HousePropertyTool from './calc/HousePropertyTool'
import TaxCalculatorTool from './calc/TaxCalculatorTool'
import HeadsTool from './visual/HeadsTool'
import MnemonicsTool from './visual/MnemonicsTool'
import ResidenceTool from './visual/ResidenceTool'
import TaxCessFeeTool from './visual/TaxCessFeeTool'
import TimelineTool from './visual/TimelineTool'

export type ToolKind = 'calculator' | 'visual'

export interface LabTool {
  id: string
  title: string
  /** One-line hook shown on the card and under the title. */
  hook: string
  /** null = spans every unit (shown with brand colours and an "All units" label). */
  unitId: UnitId | null
  icon: LucideIcon
  kind: ToolKind
  /** Slides the tool is built from; rendered as "Read the notes" links to /learn/:id. */
  sourceSlideIds: string[]
  /** Renders only the tool body; takes no props. */
  component: ComponentType
}

export const LAB_TOOLS: LabTool[] = [
  {
    id: 'tax-calculator',
    title: 'New regime tax calculator',
    hook: 'Watch each slab fill as income climbs, and see the section 156 rebate wipe the tax away.',
    unitId: 'u4',
    icon: Calculator,
    kind: 'calculator',
    // Unit IV part "9. The New Tax Regime and an Illustration" (s96), plus the rates and rebate (s69) and the
    // standard deduction (s95) it relies on.
    sourceSlideIds: ['s96', 's69', 's95'],
    component: TaxCalculatorTool,
  },
  {
    id: 'house-property',
    title: 'House property waterfall',
    hook: 'From rent to annual value to income, one deduction at a time: let out or self occupied.',
    unitId: 'u5',
    icon: House,
    kind: 'calculator',
    // Unit V parts 3 to 6: annual value (s103, s104), deductions (s105), losses (s106), illustrations (s107).
    sourceSlideIds: ['s103', 's104', 's105', 's106', 's107'],
    component: HousePropertyTool,
  },
  {
    id: 'depreciation',
    title: 'Written down value',
    hook: 'See a block of assets shrink year by year, with the half rate and sales worked in.',
    unitId: 'u6',
    icon: TrendingDown,
    kind: 'calculator',
    // Unit VI part "6. Depreciation: Section 33" (s117 to s119), and the worked illustration that uses it (s129).
    sourceSlideIds: ['s118', 's119', 's117', 's129'],
    component: DepreciationTool,
  },
  {
    id: 'timeline',
    title: 'History of taxation',
    hook: 'From the Manusmriti and the Arthashastra to the 2025 Act, on one timeline.',
    unitId: 'u1',
    icon: History,
    kind: 'visual',
    // Unit I part "2. History of Taxation".
    sourceSlideIds: ['s2'],
    component: TimelineTool,
  },
  {
    id: 'tax-cess-fee',
    title: 'Tax, cess or fee?',
    hook: 'Tell the three levies apart by purpose, quid pro quo and the cases that decide them.',
    unitId: 'u1',
    icon: Scale,
    kind: 'visual',
    // Unit I part "10. Tax, Cess and Fee".
    sourceSlideIds: ['s12', 's13', 's14'],
    component: TaxCessFeeTool,
  },
  {
    id: 'residence',
    title: 'Residential status',
    hook: 'Days in India and Indian income decide resident, not ordinarily resident or non resident.',
    unitId: 'u3',
    icon: Plane,
    kind: 'visual',
    // Unit III part "9. Residence".
    sourceSlideIds: ['s70', 's71', 's72'],
    component: ResidenceTool,
  },
  {
    id: 'heads',
    title: 'The five heads of income',
    hook: 'Salaries, house property, business, capital gains and other sources: every receipt in its place.',
    unitId: 'u4',
    icon: Layers,
    kind: 'visual',
    // Unit IV part "1. Heads of Income".
    sourceSlideIds: ['s80'],
    component: HeadsTool,
  },
  {
    id: 'mnemonics',
    title: 'Mnemonics',
    hook: 'Memory hooks for every unit, so the lists and numbers come back in the exam.',
    unitId: null,
    icon: Brain,
    kind: 'visual',
    // Spans all units; the tool links to its own sources.
    sourceSlideIds: [],
    component: MnemonicsTool,
  },
]

const toolMap = new Map(LAB_TOOLS.map((t) => [t.id, t]))

export function toolById(id: string | undefined): LabTool | undefined {
  return id ? toolMap.get(id) : undefined
}
