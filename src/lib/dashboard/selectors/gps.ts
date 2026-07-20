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

export interface GpsCompareMetricSeries {
  kpi: DashKpi
  /** team average per participating athlete, aligned to sessions; null = no data */
  means: (number | null)[]
  /** athletes with data per session, aligned to sessions */
  ns: number[]
}

export interface GpsCompareSeriesViewModel {
  /** selected sessions, chronological */
  sessions: DashSession[]
  metrics: GpsCompareMetricSeries[]
}

/**
 * Session Compare as a chronological trend: for each selected metric, the team
 * average per participating athlete at each session, in date order. Powers the
 * line chart + table; team scope is always an average, never a hidden total.
 */
export function gpsCompareSeries(
  dataset: DashboardDataset,
  sessionIds: string[],
  kpiKeys: string[],
  position: string | null,
): GpsCompareSeriesViewModel {
  const sessions = sessionIds
    .map((id) => dataset.sessionById.get(id))
    .filter((s): s is DashSession => s !== undefined)
    .sort((a, b) => (a.date === b.date ? a.startTime.localeCompare(b.startTime) : a.date.localeCompare(b.date)))
  const athleteIds = new Set(
    dataset.athletes.filter((a) => position === null || a.position === position).map((a) => a.id),
  )

  const metrics: GpsCompareMetricSeries[] = kpiKeys
    .map((key) => dataset.kpis.get(key))
    .filter((k): k is DashKpi => k !== undefined)
    .map((kpi) => {
      const means: (number | null)[] = []
      const ns: number[] = []
      for (const session of sessions) {
        const values = (dataset.observationsBySession.get(session.id) ?? [])
          .filter((o) => o.kpiKey === kpi.key && athleteIds.has(o.athleteId))
          .map((o) => o.value)
        ns.push(values.length)
        means.push(values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : null)
      }
      return { kpi, means, ns }
    })

  return { sessions, metrics }
}

// ---------------------------------------------------------------------------
// Trends & Recommendations (§5.2): transparent rules over the team-mean day
// series. Monotony threshold is a fixed published constant; ACWR bands come
// from coach-visible threshold settings.
// ---------------------------------------------------------------------------

export const MONOTONY_HIGH = 2.0

/**
 * A coach-readable alert in the "what happened → number → why → what to review"
 * shape. The primary card shows only the first four fields; the rule + any
 * athlete list live behind an info affordance so the alert stays scannable.
 */
export interface Recommendation {
  id: string
  tone: 'warning' | 'danger' | 'neutral' | 'good'
  /** what happened */
  headline: string
  /** the one primary number */
  value: string
  /** why it was flagged (the threshold or comparison) */
  why: string
  /** what to review — a coach prompt, never a prescription or prediction */
  review: string
  /** affected group / athlete count, when applicable */
  affected: string | null
  /** the rule verbatim + any athlete list (§6.9), shown behind an info action */
  detail: string
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
        const o = obs.find((x) => x.athleteId === athlete.id && x.kpiKey === 'workload')
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
      const windowNote = `Team 28-day window complete (${completeness.observed} observed + ${completeness.rest} rest days).`
      // primary team-load alert, structured as happened → number → why → review
      if (teamAcwr > thresholds.acwrHighBand) {
        recommendations.push({
          id: 'team-acwr',
          tone: 'danger',
          headline: 'Substantially elevated acute load',
          value: `Team average ACWR: ${teamAcwr.toFixed(2)}`,
          why: `Above the configured ${thresholds.acwrHighBand.toFixed(2)} display threshold`,
          review: 'Review recent exposure and the upcoming session plan',
          affected: 'Whole team',
          detail: `7-day team-mean load ${Math.round(acute).toLocaleString('en-US')} AU is ${Math.abs(pctVsChronic).toFixed(0)}% ${pctVsChronic >= 0 ? 'above' : 'below'} the 28-day weekly equivalent ${Math.round(chronicWeekly).toLocaleString('en-US')} AU. ${windowNote}`,
        })
      } else if (teamAcwr > thresholds.acwrElevatedBand) {
        recommendations.push({
          id: 'team-acwr',
          tone: 'warning',
          headline: 'Elevated acute load',
          value: `Team average ACWR: ${teamAcwr.toFixed(2)}`,
          why: `Above the configured ${thresholds.acwrElevatedBand.toFixed(2)} display threshold`,
          review: 'Review recent exposure and the upcoming session plan',
          affected: 'Whole team',
          detail: `7-day team-mean load ${Math.round(acute).toLocaleString('en-US')} AU is ${Math.abs(pctVsChronic).toFixed(0)}% ${pctVsChronic >= 0 ? 'above' : 'below'} the 28-day weekly equivalent ${Math.round(chronicWeekly).toLocaleString('en-US')} AU. ${windowNote}`,
        })
      } else if (teamAcwr < thresholds.acwrBelowBand) {
        recommendations.push({
          id: 'team-acwr',
          tone: 'neutral',
          headline: 'Below recent workload',
          value: `Team average ACWR: ${teamAcwr.toFixed(2)}`,
          why: `Below the configured ${thresholds.acwrBelowBand.toFixed(2)} display threshold`,
          review: 'Room to add load if the session plan calls for it',
          affected: 'Whole team',
          detail: `7-day team-mean load ${Math.round(acute).toLocaleString('en-US')} AU vs the 28-day weekly equivalent ${Math.round(chronicWeekly).toLocaleString('en-US')} AU. ${windowNote}`,
        })
      }
    }
  }

  // per-athlete rules reuse the tested readiness rows
  const rows = readinessTableView(dataset, date, position, thresholds)
  const completeNote =
    completeness.missing === 0
      ? '28-day team window complete'
      : `${completeness.missing} missing team day(s) in the 28-day window`
  const elevated = rows.filter((r) => r.band === 'elevated' || r.band === 'high')
  if (elevated.length > 0) {
    recommendations.push({
      id: 'elevated-athletes',
      tone: 'warning',
      headline: 'Athletes with elevated acute load',
      value: `${elevated.length} athlete${elevated.length === 1 ? '' : 's'}`,
      why: `Individual ACWR above the configured ${thresholds.acwrElevatedBand.toFixed(2)} threshold`,
      review: 'Review their next 1–2 sessions',
      affected: elevated.length <= 3 ? elevated.map((r) => r.name).join(', ') : `${elevated.length} athletes`,
      detail: `Per-athlete ACWR with a complete 28-day window: ${elevated
        .map((r) => `${r.name} (${r.acwr!.toFixed(2)})`)
        .join(', ')}. ${completeNote}.`,
    })
  }
  const monotonous = rows.filter((r) => r.monotony !== null && r.monotony >= MONOTONY_HIGH)
  if (monotonous.length > 0) {
    recommendations.push({
      id: 'high-monotony',
      tone: 'neutral',
      headline: 'High 7-day load monotony',
      value: `${monotonous.length} athlete${monotonous.length === 1 ? '' : 's'}`,
      why: `7-day monotony (mean ÷ stdev of daily load) ≥ ${MONOTONY_HIGH.toFixed(1)}`,
      review: 'Consider varying session intensity',
      affected: monotonous.length <= 3 ? monotonous.map((r) => r.name).join(', ') : `${monotonous.length} athletes`,
      detail: `Day-to-day load variation is low for: ${monotonous
        .map((r) => `${r.name} (${r.monotony!.toFixed(2)})`)
        .join(', ')}.`,
    })
  }
  const incomplete = rows.filter((r) => r.reason === 'incomplete data')
  if (incomplete.length > 0) {
    recommendations.push({
      id: 'incomplete-windows',
      tone: 'neutral',
      headline: 'Athletes without a computable ACWR',
      value: `${incomplete.length} athlete${incomplete.length === 1 ? '' : 's'}`,
      why: 'Missing device days in the 28-day window',
      review: 'Confirm device coverage for these athletes',
      affected: `${incomplete.length} athletes`,
      detail:
        'Missing device days poison the 28-day window; ACWR is omitted, never estimated (ADR-005).',
    })
  }

  if (recommendations.length === 0) {
    recommendations.push({
      id: 'no-alerts',
      tone: 'good',
      headline: 'No load rules triggered for this range',
      value: 'All clear',
      why: 'Team ACWR, per-athlete ACWR, and monotony are inside their published thresholds',
      review: 'No load action indicated',
      affected: null,
      detail: 'Shown when no other rule fires.',
    })
  }

  return { recommendations, completeness, guidance }
}
