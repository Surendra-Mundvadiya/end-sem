import { Fragment, type ReactNode } from 'react'
import type { CaseMeta } from './caseText'

/** Plain text with query matches wrapped in <mark>. `re` must have one capture group (see queryRegex). */
export function Highlight({ text, re }: { text: string; re?: RegExp | null }): ReactNode {
  if (!re) return text
  const bits = text.split(re)
  if (bits.length === 1) return text
  return bits.map((b, i) =>
    i % 2 ? (
      <mark key={i} className="cs-mark">
        {b}
      </mark>
    ) : (
      <Fragment key={i}>{b}</Fragment>
    ),
  )
}

/** Party names, with a quieter "v." and "and" between paired decisions. */
export function CaseName({ meta, re }: { meta: CaseMeta; re?: RegExp | null }) {
  return (
    <>
      {meta.parts.map((p, i) => (
        <Fragment key={i}>
          {i > 0 && <span className="cs-name__and"> and </span>}
          {p.name.split(/\s+v\.\s+/).map((party, k) => (
            <Fragment key={k}>
              {k > 0 && <span className="cs-name__v"> v. </span>}
              <Highlight text={party} re={re} />
            </Fragment>
          ))}
        </Fragment>
      ))}
    </>
  )
}

/** The citation line; paired decisions are separated by a dot. Renders nothing when no citation was found. */
export function CaseCite({ meta, re, className = 'cs-cite' }: { meta: CaseMeta; re?: RegExp | null; className?: string }) {
  const cites = meta.parts.filter((p) => p.cite)
  if (!cites.length) return null
  return (
    <p className={className}>
      {cites.map((p, i) => (
        <Fragment key={i}>
          {i > 0 && (
            <span className="cs-cite__sep" aria-hidden="true">
              {' · '}
            </span>
          )}
          {i > 0 && <span className="sr-only">, and </span>}
          <Highlight text={p.cite} re={re} />
        </Fragment>
      ))}
    </p>
  )
}
