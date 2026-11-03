/*
 * Income from house property (Unit V), exactly as the notes state it. Pure module, no imports.
 *
 * Sources in study-data.json:
 *   s103 – section 21(1): annual value is the HIGHER of the expected rent and the actual rent received or receivable.
 *   s104 – section 21(2) vacancy: let but vacant, and because of the vacancy actual rent < expected rent → actual rent;
 *          section 21(3): municipal taxes actually paid by the owner during the year reduce the annual value;
 *          section 21(6)/(7): a self occupied house (up to two) has a nil annual value.
 *   s105 – section 22(a) 30% of the annual value; (b) interest on borrowed capital, accrual basis; (c) pre construction
 *          interest in five equal instalments; self occupied cap Rs. 2,00,000 if bought or built with a loan, completed
 *          within five years and the lender's certificate is furnished, otherwise Rs. 30,000; no interest deduction on a
 *          self occupied house under the new regime; no limit on interest for let out houses.
 *   s106 – losses: set off against other heads up to Rs. 2,00,000 a year (section 109(1)(b)); balance carried forward
 *          for up to eight tax years against house property income only (section 110); under the new regime a house
 *          property loss cannot be set off against other heads.
 *   s107 – illustrations (Anil, let out; Sunita, self occupied).
 *
 * Not implemented (rules the notes leave to the Rules or do not spell out): unrealised rent (section 21(4)), arrears
 * (section 23), co owners (section 24), the combined limit across houses (section 22(5)), interest payable outside India.
 */

/** s105: section 22(a). */
export const STANDARD_DEDUCTION_PCT = 30
/** s105: self occupied interest cap when all three conditions hold (section 22(2) and (4)). */
export const SELF_OCCUPIED_CAP = 200000
/** s105: self occupied interest cap otherwise. */
export const SELF_OCCUPIED_CAP_OTHER = 30000
/** s105: section 22(c), pre construction interest instalments. */
export const PRE_CONSTRUCTION_INSTALMENTS = 5
/** s106: set off against other heads, per year (section 109(1)(b)). */
export const LOSS_SET_OFF_LIMIT = 200000
/** s106: carry forward period (section 110). */
export const LOSS_CARRY_FORWARD_YEARS = 8

export type Occupancy = 'let' | 'self'
/** 'new' = the default section 202 regime; 'old' = the person has opted out. */
export type Regime = 'new' | 'old'

export interface HouseInput {
  occupancy: Occupancy
  regime: Regime
  expectedRent: number
  actualRent: number
  /** Let but vacant for part of the year (s104, section 21(2)). */
  vacancy: boolean
  municipalTaxes: number
  /** Interest for the year on capital borrowed for the property (section 22(b)). */
  interest: number
  /** Total pre construction interest; one fifth is allowed this year (section 22(c)). */
  preConstruction: number
  /** Self occupied: loan to acquire or construct, completed within five years, lender's certificate (s105). */
  capConditionsMet: boolean
}

/**
 * higher-actual / higher-expected – section 21(1), the higher of the two
 * vacancy – section 21(2), actual rent taken because the vacancy made it lower
 * self – section 21(6), nil
 */
export type RentRule = 'higher-actual' | 'higher-expected' | 'vacancy' | 'self'

export interface HouseResult {
  rentRule: RentRule
  /** The section 21(1)/(2) figure before municipal taxes. */
  rentFigure: number
  municipalApplied: number
  /** True when the municipal taxes entered exceed the rent figure (not covered by the notes; limited to it). */
  municipalLimited: boolean
  annualValue: number
  standardDeduction: number
  /** Interest for the year, as entered. */
  interest: number
  /** One fifth of the pre construction interest. */
  preConInstalment: number
  /** Interest + instalment claimed before any limit. */
  interestClaimed: number
  /** null = no limit (let out); 0 = nothing allowed (self occupied, new regime). */
  interestCap: number | null
  interestAllowed: number
  /** Claimed but not allowed because of the limit or the regime. */
  interestDisallowed: number
  income: number
}

export function computeHouse(input: HouseInput): HouseResult {
  const expected = Math.max(0, input.expectedRent)
  const actual = Math.max(0, input.actualRent)
  const interest = Math.max(0, input.interest)
  const preConInstalment = Math.max(0, input.preConstruction) / PRE_CONSTRUCTION_INSTALMENTS
  const interestClaimed = interest + preConInstalment

  if (input.occupancy === 'self') {
    // s104: nil annual value (section 21(6)), so municipal taxes and the 30% deduction are both nil.
    // s105: no interest deduction on a self occupied house under the new regime; otherwise capped.
    const cap = input.regime === 'new' ? 0 : input.capConditionsMet ? SELF_OCCUPIED_CAP : SELF_OCCUPIED_CAP_OTHER
    const interestAllowed = Math.min(interestClaimed, cap)
    return {
      rentRule: 'self',
      rentFigure: 0,
      municipalApplied: 0,
      municipalLimited: false,
      annualValue: 0,
      standardDeduction: 0,
      interest,
      preConInstalment,
      interestClaimed,
      interestCap: cap,
      interestAllowed,
      interestDisallowed: interestClaimed - interestAllowed,
      income: interestAllowed > 0 ? -interestAllowed : 0, // avoid -0
    }
  }

  // Let out.
  let rentRule: RentRule
  let rentFigure: number
  if (input.vacancy && actual < expected) {
    rentRule = 'vacancy' // s104, section 21(2)
    rentFigure = actual
  } else if (actual >= expected) {
    rentRule = 'higher-actual' // s103, section 21(1)
    rentFigure = actual
  } else {
    rentRule = 'higher-expected'
    rentFigure = expected
  }
  const municipal = Math.max(0, input.municipalTaxes)
  const municipalApplied = Math.min(municipal, rentFigure)
  const annualValue = rentFigure - municipalApplied // s104, section 21(3)
  const standardDeduction = (annualValue * STANDARD_DEDUCTION_PCT) / 100 // s105, section 22(a): 30% of the annual value
  // s105: "For let out houses, section 22 sets no limit on interest" – and the regime does not change this.
  return {
    rentRule,
    rentFigure,
    municipalApplied,
    municipalLimited: municipal > rentFigure,
    annualValue,
    standardDeduction,
    interest,
    preConInstalment,
    interestClaimed,
    interestCap: null,
    interestAllowed: interestClaimed,
    interestDisallowed: 0,
    income: annualValue - standardDeduction - interestClaimed,
  }
}

export interface LossTreatment {
  loss: number
  /** Old regime only: the part that can be set off against other heads this year (s106). */
  setOffOtherHeads: number
  /** Old regime only: the balance carried forward against house property income (s106). */
  carriedForward: number
  canSetOffOtherHeads: boolean
}

export function lossTreatment(income: number, regime: Regime): LossTreatment | null {
  if (income >= 0) return null
  const loss = -income
  if (regime === 'new') return { loss, setOffOtherHeads: 0, carriedForward: 0, canSetOffOtherHeads: false }
  const setOffOtherHeads = Math.min(loss, LOSS_SET_OFF_LIMIT)
  return { loss, setOffOtherHeads, carriedForward: loss - setOffOtherHeads, canSetOffOtherHeads: true }
}

/** s107 illustrations, with the answers printed in the notes. */
export const ANIL: HouseInput = {
  occupancy: 'let',
  regime: 'new',
  expectedRent: 300000,
  actualRent: 360000,
  vacancy: false,
  municipalTaxes: 20000,
  interest: 150000,
  preConstruction: 0,
  capConditionsMet: true,
}
export const ANIL_EXPECTED = { annualValue: 340000, standardDeduction: 102000, interestAllowed: 150000, income: 88000 }

export const SUNITA: HouseInput = {
  occupancy: 'self',
  regime: 'old',
  expectedRent: 0,
  actualRent: 0,
  vacancy: false,
  municipalTaxes: 0,
  interest: 240000,
  preConstruction: 0,
  capConditionsMet: true,
}
/** Outside the new regime: loss of Rs. 2,00,000; under the new regime: nil (s107). */
export const SUNITA_EXPECTED = { old: -200000, new: 0 }
