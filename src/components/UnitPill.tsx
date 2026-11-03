import { getUnit, unitVars, type UnitId } from '../data'

/** Small coloured "Unit III" label. */
export default function UnitPill({ unitId, withName = false }: { unitId: UnitId; withName?: boolean }) {
  const u = getUnit(unitId)
  return (
    <span className="unit-pill" style={unitVars(unitId)}>
      {u.short}
      {withName && <span style={{ textTransform: 'none', letterSpacing: 0, fontWeight: 600 }}>· {u.name}</span>}
    </span>
  )
}
