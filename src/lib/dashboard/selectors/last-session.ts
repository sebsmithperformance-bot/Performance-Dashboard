/**
 * Last Session GPS tile view model (§5.1): team aggregates for the most
 * recent valid field session at or before the selected date, with a
 * comparison against the previous session of the same type and an explicit
 * data-completeness count. Missing device data is never averaged in as zero.
 */
import { percentChange } from '../../calculations/index.ts'
import type { DashSession, DashboardDataset } from '../types.ts'

export type LastSessionMetricKey =
  'total_distance' | 'player_load' | 'top_speed' | 'high_speed_distance'

export interface LastSessionMetric {
  kpiKey: LastSessionMetricKey
  label: string
  /** team aggregate for this session (sum or mean, stated in aggLabel) */
  value: number | null
  aggLabel: 'team total' | 'team average'
  /** % vs the previous comparable session; null when not computable */
  deltaPct: number | null
}

export interface LastSessionViewModel {
  session: DashSession
  participants: number
  expectedParticipants: number
  /** participated but produced no device data */
  missingDevice: number
  metrics: LastSessionMetric[]
  comparedTo: DashSession | null
}

const METRIC_DEFS: { kpiKey: LastSessionMetricKey; label: string; agg: 'sum' | 'mean' }[] = [
  { kpiKey: 'total_distance', label: 'Total Distance', agg: 'sum' },
  { kpiKey: 'player_load', label: 'Avg Player Load', agg: 'mean' },
  { kpiKey: 'top_speed', label: 'Avg Top Speed', agg: 'mean' },
  { kpiKey: 'high_speed_distance', label: 'High-Speed Distance', agg: 'sum' },
]

function aggregate(
  dataset: DashboardDataset,
  session: DashSession,
  kpiKey: string,
  agg: 'sum' | 'mean',
): number | null {
  const values = (dataset.observationsBySession.get(session.id) ?? [])
    .filter((o) => o.kpiKey === kpiKey)
    .map((o) => o.value)
  if (values.length === 0) return null
  const total = values.reduce((a, b) => a + b, 0)
  return agg === 'sum' ? total : total / values.length
}

function participationStats(dataset: DashboardDataset, session: DashSession) {
  let expected = 0
  let participated = 0
  let missingDevice = 0
  const sessionObs = dataset.observationsBySession.get(session.id) ?? []
  for (const athlete of dataset.athletes) {
    const part = dataset.participationByKey.get(`${athlete.id}|${session.id}`)
    if (!part || part.exposureMin <= 0) continue
    expected += 1
    const hasObs = sessionObs.some((o) => o.athleteId === athlete.id)
    if (hasObs) participated += 1
    else missingDevice += 1
  }
  return { expected, participated, missingDevice }
}

export function lastSessionGpsView(
  dataset: DashboardDataset,
  endDate: string,
): LastSessionViewModel | null {
  const fieldSessions = dataset.sessions.filter((s) => s.kind === 'field' && s.date <= endDate)
  // most recent field session that actually has GPS data
  const session = [...fieldSessions]
    .reverse()
    .find((s) => (dataset.observationsBySession.get(s.id) ?? []).length > 0)
  if (!session) return null

  const previous = [...fieldSessions]
    .reverse()
    .find(
      (s) =>
        s.type === session.type &&
        (s.date < session.date || (s.date === session.date && s.startTime < session.startTime)) &&
        (dataset.observationsBySession.get(s.id) ?? []).length > 0,
    )

  const { expected, participated, missingDevice } = participationStats(dataset, session)

  const metrics: LastSessionMetric[] = METRIC_DEFS.map((def) => {
    const value = aggregate(dataset, session, def.kpiKey, def.agg)
    const prior = previous ? aggregate(dataset, previous, def.kpiKey, def.agg) : null
    let deltaPct: number | null = null
    if (value !== null && prior !== null) {
      const change = percentChange(value, prior)
      deltaPct = change.computable ? change.value : null
    }
    return {
      kpiKey: def.kpiKey,
      label: def.label,
      value,
      aggLabel: def.agg === 'sum' ? 'team total' : 'team average',
      deltaPct,
    }
  })

  return {
    session,
    participants: participated,
    expectedParticipants: expected,
    missingDevice,
    metrics,
    comparedTo: previous ?? null,
  }
}
