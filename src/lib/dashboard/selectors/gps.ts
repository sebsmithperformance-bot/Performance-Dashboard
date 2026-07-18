/**
 * Monitoring → GPS view models (§5.2): Session Overview (per-athlete
 * breakdown + team summary), Session Compare (multi-session overlay), and
 * Trends & Recommendations (transparent rule-based workload observations —
 * never injury language, §6.8).
 */
import { ACUTE_WINDOW_DAYS, CHRONIC_WINDOW_DAYS } from '../../calculations/index.ts'
import { DEFAULT_THRESHOLDS } from '../../settings/defaults.ts'
import type { ThresholdSettings } from '../../settings/types.ts'
import type { DashKpi, DashSession, DashboardDataset } from '../types.ts'
import { athletesTableView, type AthleteRow } from './athletes-table.ts'
import { dateWindow, readinessTableView } from './readiness.ts'

/** GPS/Load KPIs visible in Monitoring, in the standing display order. */
export function monitoringGpsKpis(dataset: DashboardDataset): DashKpi[] {
  const order = [
    'total_distance',
    'player_load',
    'workload',
    'high_speed_distance',
    'top_speed',
    'sprints',
    'sprint_distance',
    'accelerations',
    'decelerations',
    'yards_per_minute',
    'high_intensity_events',
  ]
  return order
    .map((k) => dataset.kpis.get(k))
    .filter(
      (k): k is DashKpi =>
        k !== undefined && (k.category === 'GPS' || k.category === 'Load') && k.visibility.monitoring,
    )
}

export interface GpsTeamStat {
  kpi: DashKpi
  /** mean across athletes with an observation in this session */
  mean: number | null
  /** best value in session (max) — labeled, not a score */
  top: number | null
  n: number
}

export interface GpsSessionOverviewViewModel {
  date: string
  sessionsOnDate: DashSession[]
  session: DashSession | null
  kpis: DashKpi[]
  teamStats: GpsTeamStat[]
  rows: AthleteRow[]
}

export function gpsSessionOverview(
  dataset: DashboardDataset,
  date: string,
  sessionId: string | null,
  position: string | null,
): GpsSessionOverviewViewModel {
  // field sessions only — lift sessions have no GPS surface
  const fieldSessions = (dataset.sessionsByDate.get(date) ?? []).filter((s) => s.kind === 'field')
  const session =
    (sessionId ? fieldSessions.find((s) => s.id === sessionId) : undefined) ??
    fieldSessions[0] ??
    null

  const base = athletesTableView(dataset, date, session?.id ?? null, position)
  const kpis = monitoringGpsKpis(dataset)

  const teamStats: GpsTeamStat[] = kpis.map((kpi) => {
    const values = base.rows
      .map((r) => r.values[kpi.key])
      .filter((v): v is number => v !== undefined)
    return {
      kpi,
      mean: values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : null,
      top: values.length > 0 ? Math.max(...values) : null,
      n: values.length,
    }
  })

  return {
    date,
    sessionsOnDate: fieldSessions,
    session,
    kpis,
    teamStats,
    rows: base.rows,
  }
}

export interface CompareRow {
  athleteId: string
  name: string
  position: string
  /** aligned to the selected sessions; null = no observation */
  values: (number | null)[]
}

export interface GpsCompareViewModel {
  sessions: DashSession[]
  kpi: DashKpi | null
  rows: CompareRow[]
  /** per-session team mean among athletes with data (aligned to sessions) */
  teamMeans: (number | null)[]
  teamNs: number[]
}

export function gpsSessionCompare(
  dataset: DashboardDataset,
  sessionIds: string[],
  kpiKey: string,
  position: string | null,
): GpsCompareViewModel {
  const sessions = sessionIds
    .map((id) => dataset.sessionById.get(id))
    .filter((s): s is DashSession => s !== undefined)
  const kpi = dataset.kpis.get(kpiKey) ?? null
  const athletes = dataset.athletes.filter((a) => position === null || a.position === position)

  const rows: CompareRow[] = athletes.map((athlete) => ({
    athleteId: athlete.id,
    name: athlete.fullName,
    position: athlete.position,
    values: sessions.map((session) => {
      const obs = (dataset.observationsBySession.get(session.id) ?? []).find(
        (o) => o.athleteId === athlete.id && o.kpiKey === kpiKey,
      )
      return obs?.value ?? null
    }),
  }))

  const teamMeans = sessions.map((_, i) => {
    const values = rows.map((r) => r.values[i]).filter((v): v is number => v != null)
    return values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : null
  })
  const teamNs = sessions.map(
    (_, i) => rows.filter((r) => r.values[i] !== null && r.values[i] !== undefined).length,
  )

  return {
    sessions,
    kpi,
    // athletes with no data in any selected session drop out of the overlay
    rows: rows.filter((r) => r.values.some((v) => v !== null)),
    teamMeans,
    teamNs,
  }
}

// ---------------------------------------------------------------------------
// Trends & Recommendations (§5.2): transparent rules over the team-mean day
// series. Monotony threshold is a fixed published constant; ACWR bands come
// from coach-visible threshold settings.
// ---------------------------------------------------------------------------

export const MONOTONY_HIGH = 2.0

export interface Recommendation {
  id: string
  tone: 'warning' | 'neutral' | 'good'
  headline: string
  /** the specific numbers behind the statement */
  detail: string
  /** the rule, stated verbatim (§6.9) */
  rule: string
}

export interface GpsTrendsViewModel {
  recommendations: Recommendation[]
  /** completeness of the team-mean 28-day window */
  completeness: { expected: number; observed: number; rest: number; missing: number }
  guidance: {
    label: 'recovery emphasis' | 'normal range' | 'room to push' | 'not computable'
    teamAcwr: number | null
    targetBand: { from: number; to: number } | null
    reason: string | null
  }
}

/** team-mean day series value: rest day → 0, observed → mean, missing → null */
function teamDaySeries(
  dataset: DashboardDataset,
  endDate: string,
  days: number,
  position: string | null,
): { date: string; value: number | null; kind: 'rest' | 'observed' | 'missing' }[] {
  const athletes = dataset.athletes.filter((a) => position === null || a.position === position)
  return dateWindow(endDate, days).map((date) => {
    const fieldSessions = (dataset.sessionsByDate.get(date) ?? []).filter((s) => s.kind === 'field')
    if (fieldSessions.length === 0) return { date, value: 0, kind: 'rest' as const }
    const values: number[] = []
    for (const session of fieldSessions) {
      const obs = dataset.observationsBySession.get(session.id) ?? []
      for (const athlete of athletes) {
        const o = obs.find((x) => x.athleteId === athlete.id && x.kpiKey === 'player_load')
        if (o) values.push(o.value)
      }
    }
    return values.length > 0
      ? { date, value: values.reduce((a, b) => a + b, 0) / values.length, kind: 'observed' as const }
      : { date, value: null, kind: 'missing' as const }
  })
}

export function gpsTrendsView(
  dataset: DashboardDataset,
  date: string,
  position: string | null,
  thresholds: ThresholdSettings = DEFAULT_THRESHOLDS,
): GpsTrendsViewModel {
  const series28 = teamDaySeries(dataset, date, CHRONIC_WINDOW_DAYS, position)
  const completeness = {
    expected: CHRONIC_WINDOW_DAYS,
    observed: series28.filter((d) => d.kind === 'observed').length,
    rest: series28.filter((d) => d.kind === 'rest').length,
    missing: series28.filter((d) => d.kind === 'missing').length,
  }

  const recommendations: Recommendation[] = []
  let guidance: GpsTrendsViewModel['guidance'] = {
    label: 'not computable',
    teamAcwr: null,
    targetBand: null,
    reason: null,
  }

  if (completeness.missing > 0) {
    guidance.reason = `${completeness.missing} of the last ${CHRONIC_WINDOW_DAYS} days lack device data — team ACWR and the target band are omitted rather than estimated (§6.7).`
  } else {
    const values = series28.map((d) => d.value ?? 0)
    const chronicWeekly = values.reduce((a, b) => a + b, 0) / 4
    const acute = values.slice(-ACUTE_WINDOW_DAYS).reduce((a, b) => a + b, 0)
    const acute6 = values.slice(-(ACUTE_WINDOW_DAYS - 1)).reduce((a, b) => a + b, 0)

    if (chronicWeekly <= 0) {
      guidance.reason = 'no chronic load history yet — team ACWR not computable.'
    } else {
      const teamAcwr = acute / chronicWeekly
      const lo = Math.max(0, thresholds.acwrBelowBand * chronicWeekly - acute6)
      const hi = Math.max(0, thresholds.acwrElevatedBand * chronicWeekly - acute6)
      const label =
        teamAcwr > thresholds.acwrElevatedBand
          ? 'recovery emphasis'
          : teamAcwr < thresholds.acwrBelowBand
            ? 'room to push'
            : 'normal range'
      guidance = { label, teamAcwr, targetBand: { from: lo, to: hi }, reason: null }

      const pctVsChronic = ((acute - chronicWeekly) / chronicWeekly) * 100
      if (Math.abs(pctVsChronic) >= 20) {
        const above = pctVsChronic > 0
        recommendations.push({
          id: 'acute-vs-chronic',
          tone: above ? 'warning' : 'neutral',
          headline: `Team acute load is ${Math.abs(pctVsChronic).toFixed(0)}% ${above ? 'above' : 'below'} the 28-day weekly equivalent`,
          detail: `7-day team-mean load ${Math.round(acute).toLocaleString('en-US')} AU vs weekly equivalent ${Math.round(chronicWeekly).toLocaleString('en-US')} AU; window complete (${completeness.observed} observed + ${completeness.rest} rest days).`,
          rule: 'raised when |acute − chronic weekly equivalent| ≥ 20% of the chronic weekly equivalent',
        })
      }
    }
  }

  // per-athlete rules reuse the tested readiness rows
  const rows = readinessTableView(dataset, date, position, thresholds)
  const elevated = rows.filter((r) => r.band === 'elevated' || r.band === 'high')
  if (elevated.length > 0) {
    recommendations.push({
      id: 'elevated-athletes',
      tone: 'warning',
      headline: `${elevated.length} athlete${elevated.length === 1 ? '' : 's'} with elevated acute load`,
      detail: elevated
        .map((r) => `${r.name} (ACWR ${r.acwr!.toFixed(2)})`)
        .join(', '),
      rule: `raised per athlete when ACWR > ${thresholds.acwrElevatedBand.toFixed(2)} with a complete 28-day window — consider reviewing their next 1–2 sessions`,
    })
  }
  const monotonous = rows.filter((r) => r.monotony !== null && r.monotony >= MONOTONY_HIGH)
  if (monotonous.length > 0) {
    recommendations.push({
      id: 'high-monotony',
      tone: 'neutral',
      headline: `${monotonous.length} athlete${monotonous.length === 1 ? '' : 's'} with high 7-day load monotony`,
      detail: monotonous.map((r) => `${r.name} (${r.monotony!.toFixed(2)})`).join(', '),
      rule: `raised when 7-day monotony (mean ÷ stdev of daily load) ≥ ${MONOTONY_HIGH.toFixed(1)} — day-to-day variation is low; consider varying session intensity`,
    })
  }
  const incomplete = rows.filter((r) => r.reason === 'incomplete data')
  if (incomplete.length > 0) {
    recommendations.push({
      id: 'incomplete-windows',
      tone: 'neutral',
      headline: `${incomplete.length} athlete${incomplete.length === 1 ? '' : 's'} without a computable ACWR`,
      detail: 'Missing device days poison the 28-day window; values are omitted, never estimated.',
      rule: 'any missing expected day makes the window incomplete (ADR-005)',
    })
  }

  if (recommendations.length === 0) {
    recommendations.push({
      id: 'no-alerts',
      tone: 'good',
      headline: 'No load rules triggered for this range',
      detail: 'Acute vs chronic balance, per-athlete ACWR, and monotony are all inside their published thresholds.',
      rule: 'shown when no other rule fires',
    })
  }

  return { recommendations, completeness, guidance }
}
