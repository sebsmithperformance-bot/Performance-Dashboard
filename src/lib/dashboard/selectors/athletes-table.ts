/**
 * Overview → Athletes view model (§5.1): every athlete's key metrics for one
 * selected session (same-date sessions stay separate). Data-quality state is
 * explicit — missing device data is never rendered as zero (§6.7).
 */
import type {
  AvailabilityStatus,
  DashKpi,
  DashSession,
  DashboardDataset,
  ParticipationLevel,
  Position,
} from '../types.ts'

export type RowQuality = 'ok' | 'no device data' | 'modified session' | 'did not participate'

export interface AthleteRow {
  athleteId: string
  name: string
  position: Position
  availability: AvailabilityStatus | null
  availabilityNote: string | null
  participation: ParticipationLevel | null
  exposureMin: number | null
  quality: RowQuality
  /** kpiKey → value; absent key = no observation (missing ≠ 0) */
  values: Record<string, number>
}

export interface AthletesTableViewModel {
  date: string
  sessionsOnDate: DashSession[]
  session: DashSession | null
  /** KPIs that actually occur in this session's observations, display order */
  availableKpis: DashKpi[]
  rows: AthleteRow[]
}

const GPS_ORDER = [
  'total_distance',
  'player_load',
  'workload',
  'high_speed_distance',
  'top_speed',
  'sprints',
  'accelerations',
  'decelerations',
  'yards_per_minute',
  'sprint_distance',
  'high_intensity_events',
]

export function athletesTableView(
  dataset: DashboardDataset,
  date: string,
  sessionId: string | null,
  position: Position | null,
): AthletesTableViewModel {
  const sessionsOnDate = dataset.sessionsByDate.get(date) ?? []
  const session =
    (sessionId ? sessionsOnDate.find((s) => s.id === sessionId) : undefined) ??
    sessionsOnDate[0] ??
    null

  const athletes = dataset.athletes.filter((a) => position === null || a.position === position)
  const sessionObs = session ? (dataset.observationsBySession.get(session.id) ?? []) : []

  // KPI columns = those present in this session, ordered sensibly
  const presentKeys = [...new Set(sessionObs.map((o) => o.kpiKey))]
  const ordered = [
    ...GPS_ORDER.filter((k) => presentKeys.includes(k)),
    ...presentKeys.filter((k) => !GPS_ORDER.includes(k)).sort(),
  ]
  const availableKpis = ordered
    .map((k) => dataset.kpis.get(k))
    .filter((k): k is DashKpi => k !== undefined)

  const rows: AthleteRow[] = athletes.map((athlete) => {
    const availability = dataset.availabilityByKey.get(`${athlete.id}|${date}`) ?? null
    const part = session
      ? (dataset.participationByKey.get(`${athlete.id}|${session.id}`) ?? null)
      : null
    const values: Record<string, number> = {}
    for (const o of sessionObs) {
      if (o.athleteId === athlete.id) values[o.kpiKey] = o.value
    }
    const participated = part !== null && part.exposureMin > 0
    let quality: RowQuality
    if (!participated) quality = 'did not participate'
    else if (Object.keys(values).length === 0) quality = 'no device data'
    else if (part.level === 'modified') quality = 'modified session'
    else quality = 'ok'

    return {
      athleteId: athlete.id,
      name: athlete.fullName,
      position: athlete.position,
      availability: availability?.status ?? null,
      availabilityNote: availability?.note ?? null,
      participation: part?.level ?? null,
      exposureMin: participated ? part.exposureMin : null,
      quality,
      values,
    }
  })

  return { date, sessionsOnDate, session, availableKpis, rows }
}
