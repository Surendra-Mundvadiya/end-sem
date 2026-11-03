import { Fragment, type ReactNode } from 'react'
import { figureRanges, type Range } from './parse'
import './rich.css'

function matchRanges(re: RegExp, text: string): Range[] {
  const out: Range[] = []
  for (const m of text.matchAll(re)) {
    const a = m.index ?? 0
    if (m[0].length) out.push({ a, b: a + m[0].length })
  }
  return out
}

interface Props {
  text: string
  /** Global regex of search matches to mark. */
  mark?: RegExp | null
  /** Emphasise amounts, rates and periods (a memory cue for figures). */
  figures?: boolean
}

/** Plain text with search matches marked and, optionally, the figures in it emphasised. */
export default function Rich({ text, mark, figures = false }: Props) {
  const marks = mark?.global ? matchRanges(mark, text) : []
  const nums = figures ? figureRanges(text) : []
  if (!marks.length && !nums.length) return <>{text}</>

  const cuts = new Set<number>([0, text.length])
  for (const r of marks) cuts.add(r.a).add(r.b)
  for (const r of nums) cuts.add(r.a).add(r.b)
  const pts = [...cuts].sort((x, y) => x - y)

  // Merge neighbouring pieces with the same flags so a figure stays one element where possible.
  const pieces: { a: number; b: number; m: boolean; n: boolean }[] = []
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i]
    const b = pts[i + 1]
    if (a === b) continue
    const m = marks.some((r) => r.a <= a && r.b >= b)
    const n = nums.some((r) => r.a <= a && r.b >= b)
    const prev = pieces[pieces.length - 1]
    if (prev && prev.m === m && prev.n === n && prev.b === a) prev.b = b
    else pieces.push({ a, b, m, n })
  }

  return (
    <>
      {pieces.map((p) => {
        let node: ReactNode = text.slice(p.a, p.b)
        if (p.n) node = <span className="ref-fig">{node}</span>
        if (p.m) node = <mark className="ref-mark">{node}</mark>
        return <Fragment key={p.a}>{node}</Fragment>
      })}
    </>
  )
}
