/*
 * New tax regime arithmetic (section 202), exactly as the notes state it. Pure module, no imports.
 *
 * Sources in study-data.json:
 *   s69  – rates under section 202(1); rebate under section 156; "Surcharge and cess are imposed by the Finance Act".
 *   appB – "nil up to Rs. 4,00,000, then 5%, 10%, 15%, 20% and 25% for each further Rs. 4,00,000, and 30% above
 *          Rs. 24,00,000"; rebate up to Rs. 60,000 (income up to Rs. 12,00,000, new regime).
 *   s95  – standard deduction (section 19, Sl. No. 2): Rs. 75,000 or the salary, whichever is less, new regime.
 *   s96  – illustration (Meera) and marginal relief: section 156(2)(b) "limits the tax to the income above
 *          Rs. 12,00,000".
 *
 * Deliberately NOT implemented, because the notes do not state the rule or rate:
 *   cess and surcharge rates (Finance Act), rounding of total income (section 516, mentioned in s81 only),
 *   the rates for a person who opts out of the new regime (Finance Act), and Chapter VIII deductions.
 *
 * Rates are whole percentages so the arithmetic stays exact (5% of 4,00,000 is exactly 20,000).
 */

export interface Slab {
  /** Lower edge (exclusive, except the first slab which starts at 0). */
  from: number
  /** Upper edge (inclusive); null for the open top slab. */
  to: number | null
  /** Whole percentage. */
  ratePct: number
}

// s69 / appB: section 202(1) rates.
export const SLABS: readonly Slab[] = [
  { from: 0, to: 400000, ratePct: 0 },
  { from: 400000, to: 800000, ratePct: 5 },
  { from: 800000, to: 1200000, ratePct: 10 },
  { from: 1200000, to: 1600000, ratePct: 15 },
  { from: 1600000, to: 2000000, ratePct: 20 },
  { from: 2000000, to: 2400000, ratePct: 25 },
  { from: 2400000, to: null, ratePct: 30 },
]

/** s95: Rs. 75,000 or the salary, whichever is less (new regime). */
export const STANDARD_DEDUCTION_NEW = 75000
/** s69: the rebate applies where total income does not exceed Rs. 12,00,000 (new regime, resident individual). */
export const REBATE_INCOME_LIMIT = 1200000
/** s69: rebate of the full tax or Rs. 60,000, whichever is less. */
export const REBATE_CAP = 60000

export type IncomeMode = 'salary' | 'total'

/**
 * full        – total income up to Rs. 12,00,000: rebate = lesser of the tax and Rs. 60,000 (s69)
 * marginal    – above Rs. 12,00,000 and the tax exceeds the income above Rs. 12,00,000: tax limited to that excess (s96)
 * none-above  – above Rs. 12,00,000 and the excess already covers the tax: nothing to relieve
 * not-applied – not a resident individual. s69 gives the Rs. 60,000 branch to a resident individual and says that
 *               "in other cases" the rebate is up to Rs. 12,500 where income is up to Rs. 5,00,000, which appB ties
 *               to opting out. The notes do not settle which applies here, so no rebate is applied.
 */
export type RebateKind = 'full' | 'marginal' | 'none-above' | 'not-applied'

export interface SlabLine {
  index: number
  slab: Slab
  /** Part of total income that falls in this slab. */
  amount: number
  tax: number
}

export interface TaxInput {
  mode: IncomeMode
  /** Gross salary (mode 'salary') or total income (mode 'total'). */
  amount: number
  residentIndividual: boolean
}

export interface TaxResult {
  mode: IncomeMode
  entered: number
  standardDeduction: number
  totalIncome: number
  lines: SlabLine[]
  slabTax: number
  rebateKind: RebateKind
  rebate: number
  /** Tax before cess and surcharge (which the notes leave to the Finance Act). */
  tax: number
  /** Total income above Rs. 12,00,000 (0 if not above). */
  excess: number
}

export function standardDeduction(salary: number): number {
  return Math.min(STANDARD_DEDUCTION_NEW, Math.max(0, salary))
}

export function slabLines(totalIncome: number): SlabLine[] {
  const ti = Math.max(0, totalIncome)
  return SLABS.map((slab, index) => {
    const top = slab.to ?? Infinity
    const amount = Math.max(0, Math.min(ti, top) - slab.from)
    return { index, slab, amount, tax: (amount * slab.ratePct) / 100 }
  })
}

export function slabTaxOn(totalIncome: number): number {
  return slabLines(totalIncome).reduce((sum, l) => sum + l.tax, 0)
}

export function computeTax(input: TaxInput): TaxResult {
  const entered = Math.max(0, input.amount)
  const sd = input.mode === 'salary' ? standardDeduction(entered) : 0
  const totalIncome = entered - sd
  const lines = slabLines(totalIncome)
  const slabTax = lines.reduce((sum, l) => sum + l.tax, 0)
  const excess = Math.max(0, totalIncome - REBATE_INCOME_LIMIT)

  let rebateKind: RebateKind
  let rebate = 0
  if (!input.residentIndividual) {
    rebateKind = 'not-applied'
  } else if (totalIncome <= REBATE_INCOME_LIMIT) {
    rebateKind = 'full'
    rebate = Math.min(slabTax, REBATE_CAP)
  } else if (slabTax > excess) {
    // s96: marginal relief under section 156(2)(b) limits the tax to the income above Rs. 12,00,000.
    rebateKind = 'marginal'
    rebate = slabTax - excess
  } else {
    rebateKind = 'none-above'
  }

  return { mode: input.mode, entered, standardDeduction: sd, totalIncome, lines, slabTax, rebateKind, rebate, tax: slabTax - rebate, excess }
}

/**
 * COMPUTED, not stated in the notes: the total income at which marginal relief runs out, i.e. where the slab tax
 * equals the income above Rs. 12,00,000. Solved on whichever slab it falls in (the 15% slab on these rates):
 * T(s) + r(x − s) = x − L  →  x = (T(s) − r·s + L) / (1 − r).
 */
export function reliefEndsAt(): number {
  const L = REBATE_INCOME_LIMIT
  for (const slab of SLABS) {
    if ((slab.to ?? Infinity) <= L) continue
    const s = Math.max(slab.from, L)
    const r = slab.ratePct / 100
    const x = (slabTaxOn(s) - r * s + L) / (1 - r)
    if (x >= s && x <= (slab.to ?? Infinity)) return x
  }
  return L
}

/** COMPUTED: the gross salary at which a resident individual's tax under the new regime is still nil (12,00,000 + 75,000). */
export function salaryNilTaxUpTo(): number {
  return REBATE_INCOME_LIMIT + STANDARD_DEDUCTION_NEW
}

/** Inverse of the standard deduction, for setting the salary from a chosen total income. */
export function grossForTotalIncome(totalIncome: number): number {
  return totalIncome <= 0 ? 0 : totalIncome + STANDARD_DEDUCTION_NEW
}

/** s96 illustration: Meera, private company in Pune, tax year beginning 1 April 2026 (new regime part). */
export const MEERA = {
  basic: 900000,
  dearnessAllowance: 100000,
  houseRentAllowance: 300000,
  /** Under the new regime the whole allowance is taxable, so gross salary is Rs. 13,00,000 (s96). */
  grossSalary: 1300000,
  /** The answers printed in the notes, used to show a "matches the notes" check. */
  expected: { standardDeduction: 75000, totalIncome: 1225000, slabTax: 63750, rebate: 38750, tax: 25000 },
} as const

export function matchesMeera(r: TaxResult): boolean {
  const e = MEERA.expected
  return (
    r.mode === 'salary' &&
    r.entered === MEERA.grossSalary &&
    r.standardDeduction === e.standardDeduction &&
    r.totalIncome === e.totalIncome &&
    r.slabTax === e.slabTax &&
    r.rebate === e.rebate &&
    r.tax === e.tax
  )
}
