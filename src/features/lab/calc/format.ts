/*
 * Money and number formatting for the calculators. Indian grouping via Intl 'en-IN' ("Rs. 12,25,000").
 * Pure module with no imports, so the arithmetic checks can load it with plain Node.
 */

const INR = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 })

/** Nearest rupee; also turns -0 into 0 so it never prints as "-0". */
export function roundRs(n: number): number {
  return Math.round(n) || 0
}

/** "12,25,000" (no prefix). */
export function inr(n: number): string {
  return INR.format(roundRs(n))
}

/** "Rs. 12,25,000", or "− Rs. 2,00,000" for a negative amount. */
export function rs(n: number): string {
  const r = roundRs(n)
  return r < 0 ? `− Rs. ${INR.format(-r)}` : `Rs. ${INR.format(r)}`
}

/** Exam-style deduction: "(Rs. 20,000)". */
export function rsLess(n: number): string {
  return `(Rs. ${INR.format(Math.abs(roundRs(n)))})`
}

/** Compact label for chart axes and caps: 400000 → "4L", 1225000 → "12.25L", 88000 → "88k". */
export function compact(n: number): string {
  const r = roundRs(n)
  const sign = r < 0 ? '−' : ''
  const a = Math.abs(r)
  if (a >= 100000) return `${sign}${trim((a / 100000).toFixed(2))}L`
  if (a >= 1000) return `${sign}${trim((a / 1000).toFixed(1))}k`
  return `${sign}${a}`
}

/** Drops trailing zeros after a decimal point: "4.00" → "4", "12.50" → "12.5". */
function trim(s: string): string {
  return s.includes('.') ? s.replace(/\.?0+$/, '') : s
}

/** 15 → "15%", 7.5 → "7.5%". Takes a percentage, not a fraction. */
export function pct(ratePct: number): string {
  return `${trim(ratePct.toFixed(2))}%`
}

/** Digits only → number (commas, spaces and "Rs." are ignored). Empty → 0. */
export function parseDigits(s: string): number {
  const d = s.replace(/[^\d]/g, '').slice(0, 12)
  return d ? Number(d) : 0
}
