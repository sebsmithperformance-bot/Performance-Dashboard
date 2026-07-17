/**
 * Per-athlete daily load series with the ADR-005 three-state day semantics:
 * no team field session → confirmed rest; participated with an observation →
 * observed; participated but no device data → missing (poisons windows).
 * Shared by Load Health, Readiness, and Trends — one implementation only.
 */
import type { DayLoad } from '../../calculations/index.ts'
import { addDays } from '../../calculations/index.ts'
import type { DashboardDataset } from '../types.ts'

export const LOAD_KPI = 'player_load'

/** date-keyed DayLoad map for one athlete, from season start to endDate. */
export function dailyLoadByDate(
  dataset: DashboardDataset,
  athleteId: string,
  endDate: string,
): Map<string, DayLoad> {
  const byDate = new Map<string, DayLoad>()

  for (let date = dataset.seasonStart; date <= endDate; date = addDays(date, 1)) {
    const fieldSessions = (dataset.sessionsByDate.get(date) ?? []).filter((s) => s.kind === 'field')
    if (fieldSessions.length === 0) {
      byDate.set(date, { kind: 'rest' })
      continue
    }
    let total = 0
    let observedAny = false
    let missingAny = false
    for (const session of fieldSessions) {
      const part = dataset.participationByKey.get(`${athleteId}|${session.id}`)
      if (!part || part.exposureMin <= 0) continue // did not participate → contributes rest
      const obs = (dataset.observationsBySession.get(session.id) ?? []).find(
        (o) => o.athleteId === athleteId && o.kpiKey === LOAD_KPI,
      )
      if (obs) {
        total += obs.value
        observedAny = true
      } else {
        missingAny = true // participated, device produced nothing
      }
    }
    if (missingAny) byDate.set(date, { kind: 'missing' })
    else if (observedAny) byDate.set(date, { kind: 'observed', load: total })
    else byDate.set(date, { kind: 'rest' })
  }
  return byDate
}
