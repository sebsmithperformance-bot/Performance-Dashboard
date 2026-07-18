/**
 * Last Session GPS tile view model (§5.1): team aggregates for the most
 * recent valid field session at or before the selected date, with a
 * comparison against the previous session of the same type and an explicit
 * data-completeness count. For team scope every metric is the AVERAGE PER
 * PARTICIPATING ATHLETE (coach-feedback), never a hidden team total; missing
 * device data is never averaged in as zero.
 */
import { percentChange } from '../../calculations/index.ts'
import { DEFAULT_OVERVIEW_GPS_METRICS } from '../../settings/defaults.ts'
import type { DashSession, DashboardDataset } from '../types.ts'

export interface LastSessionMetric {
  kpiKey: string
  label: string
  /** average per participating athlete for this session; null = no data */
  value: number | null
  /** always average-per-athlete for GPS scope; stated for transparency */
  aggLabel: 'average per athlete'
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

/** mean of a KPI across athletes with an observation in this session */
function meanPerAthlete(
  dataset: DashboardDataset,
  session: DashSession,
  kpiKey: string,
): number | null {
  const values = (dataset.observationsBySession.get(session.id) ?? [])
    .filter((o) => o.kpiKey === kpiKey)
    .map((o) => o.value)
  if (values.length === 0) return null
  return values.reduce((a, b) => a + b, 0) / values.length
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
  metricKeys: string[] = DEFAULT_OVERVIEW_GPS_METRICS,
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

  // resolve the coach-chosen metric set; unknown keys are dropped, not shown blank
  const keys = (metricKeys.length > 0 ? metricKeys : DEFAULT_OVERVIEW_GPS_METRICS).filter((k) =>
    dataset.kpis.has(k),
  )

  const metrics: LastSessionMetric[] = keys.map((kpiKey) => {
    const kpi = dataset.kpis.get(kpiKey)!
    const value = meanPerAthlete(dataset, session, kpiKey)
    const prior = previous ? meanPerAthlete(dataset, previous, kpiKey) : null
    let deltaPct: number | null = null
    if (value !== null && prior !== null) {
      const change = percentChange(value, prior)
      deltaPct = change.computable ? change.value : null
    }
    return { kpiKey, label: kpi.displayName, value, aggLabel: 'average per athlete', deltaPct }
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
