/*
 * Depreciation on a block of assets by the written down value method (Unit VI), as the notes state it.
 * Pure module, no imports.
 *
 * Sources in study-data.json:
 *   s118 – depreciation at the prescribed rate on the WDV of each block (sections 2(17) and 33(3)(a)); section 41(1)(c):
 *          WDV = previous year's figure − depreciation allowed for that year + actual cost of assets added − sale price
 *          and scrap value of assets sold, discarded or destroyed (NOT EXCEEDING the amount so far computed).
 *          Rates are in the Rules; the notes quote the 1962 Rules: plant and machinery 15%, computers 40%,
 *          furniture 10%, intangible assets 25% – "Confirm the 2026 rates before use."
 *   s119 – section 33(4): only 50% of the rate if the asset is acquired and used for less than 180 days in the year;
 *          section 33(7): depreciation applies whether or not claimed.
 *
 * Not implemented: additional depreciation (section 33(8), (9)), power undertakings on actual cost (section 33(2)),
 * unabsorbed depreciation (section 33(11)), and what happens to a sale price above the block's WDV (the notes only say
 * the reduction cannot exceed the amount so far computed). The notes have no worked WDV illustration.
 *
 * Depreciation is rounded to the nearest rupee each year so the table adds up (a display choice, not a rule).
 */

export interface RatePreset {
  id: string
  label: string
  ratePct: number
}

// s118: rates under the 1962 Rules, as quoted in the notes (confirm the 2026 rates).
export const RATE_PRESETS: readonly RatePreset[] = [
  { id: 'plant', label: 'Plant and machinery', ratePct: 15 },
  { id: 'computers', label: 'Computers', ratePct: 40 },
  { id: 'furniture', label: 'Furniture', ratePct: 10 },
  { id: 'intangible', label: 'Intangible assets', ratePct: 25 },
]

/** s119: section 33(4) threshold. */
export const HALF_RATE_DAYS = 180

export interface DepInput {
  ratePct: number
  /** WDV of the block at the start of year 1. */
  openingWdv: number
  /** Actual cost of assets added to the block in year 1. */
  addition: number
  /** The year 1 addition was acquired and put to use for less than 180 days in year 1 (s119). */
  halfRate: boolean
  /** Year in which assets of the block are sold, discarded or destroyed (0 = none). */
  saleYear: number
  /** Sale price and scrap value. */
  saleAmount: number
  years: number
}

export interface DepYear {
  year: number
  opening: number
  added: number
  /** Sale price entered for this year. */
  saleEntered: number
  /** Reduction actually made: never more than opening + added (s118). */
  sale: number
  saleLimited: boolean
  /** WDV on which depreciation is charged this year. */
  base: number
  /** Part of the base that gets only half the rate (the year 1 addition, s119). */
  halfPortion: number
  fullPortion: number
  depreciation: number
  closing: number
}

export function computeDepreciation(input: DepInput): DepYear[] {
  const ratePct = Math.min(100, Math.max(0, input.ratePct))
  const years = Math.max(1, Math.min(15, Math.round(input.years)))
  const out: DepYear[] = []
  let opening = Math.max(0, input.openingWdv)
  for (let year = 1; year <= years; year++) {
    const added = year === 1 ? Math.max(0, input.addition) : 0
    const saleEntered = year === input.saleYear ? Math.max(0, input.saleAmount) : 0
    const before = opening + added
    const sale = Math.min(saleEntered, before) // s118: not exceeding the amount so far computed
    const base = before - sale
    // s119: half rate only on the asset acquired and used for under 180 days. The UI never combines this with a
    // sale in the same year, because the notes do not say which part of the block a sale comes out of.
    const halfPortion = year === 1 && input.halfRate ? Math.min(added, base) : 0
    const fullPortion = base - halfPortion
    const depreciation = Math.round((fullPortion * ratePct) / 100 + (halfPortion * ratePct) / 200)
    const closing = base - depreciation
    out.push({ year, opening, added, saleEntered, sale, saleLimited: saleEntered > before, base, halfPortion, fullPortion, depreciation, closing })
    opening = closing
  }
  return out
}
