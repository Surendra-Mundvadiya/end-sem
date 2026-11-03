import { UNITS, unitVars, type UnitId } from '../../data'

interface Props {
  unit: UnitId | null
  onChange: (unit: UnitId | null) => void
  /** Number of cases per unit for the current search. */
  counts: Partial<Record<UnitId, number>>
  total: number
  label?: string
}

/** "All" + one chip per unit, each in its unit colour, with live counts. */
export default function UnitFilter({ unit, onChange, counts, total, label = 'Filter by unit' }: Props) {
  return (
    <div className="cs-chips" role="group" aria-label={label}>
      <button type="button" className="chip cs-chip" aria-pressed={unit === null} onClick={() => onChange(null)}>
        All units <span className="cs-chip__n">{total}</span>
      </button>
      {UNITS.map((u) => {
        const n = counts[u.id] ?? 0
        return (
          <button
            key={u.id}
            type="button"
            className={`chip cs-chip${n === 0 ? ' is-empty' : ''}`}
            style={unitVars(u.id)}
            aria-pressed={unit === u.id}
            title={u.name}
            onClick={() => onChange(unit === u.id ? null : u.id)}
          >
            <span className="cs-chip__dot" aria-hidden="true" />
            {u.short}
            <span className="cs-chip__n">{n}</span>
          </button>
        )
      })}
    </div>
  )
}
