/**
 * Data Trends view model (§5.3): one KPI over a date range, as aligned chart
 * series — split by position group or focused on one athlete with team
 * context. Shared by both Data Trends sub-tabs; only the KPI catalog differs.
 * Multiple observations on one date (AM/PM sessions) average into a daily
 * value, stated in the subtitle; dates with no observation stay gaps (§6.7).
 */
import type { DashKpi, DashboardDataset } from '../types.ts'

export interface TrendSeries {
  key: string
  label: string
  /** aligned to dates; null = no observation that day */
  values: (number | null)[]
  /** athletes contributing at least one point */
  memberCount: number
}

export interface MetricTrendViewModel {
  kpi: DashKpi | null
  /** distinct session dates in range with ≥1 observation of the KPI */
  dates: string[]
  series: TrendSeries[]
}

export type TrendMode = 'group' | 'individual'

/** athleteId → (date → mean value) for one KPI in [from, to] */
function dailyValuesByAthlete(
  dataset: DashboardDataset,
  kpiKey: string,
  from: string,
  to: string,
): Map<string, Map<string, number>> {
  const sums = new Map<string, Map<string, { total: number; n: number }>>()
  for (const obs of dataset.observations) {
    if (obs.kpiKey !== kpiKey) continue
    const session = dataset.sessionById.get(obs.sessionId)
    if (!session || session.date < from || session.date > to) continue
    let byDate = sums.get(obs.athleteId)
    if (!byDate) {
      byDate = new Map()
      sums.set(obs.athleteId, byDate)
    }
    const entry = byDate.get(session.date) ?? { total: 0, n: 0 }
    entry.total += obs.value
    entry.n += 1
    byDate.set(session.date, entry)
  }
  const result = new Map<string, Map<string, number>>()
  for (const [athleteId, byDate] of sums) {
    result.set(
      athleteId,
      new Map([...byDate].map(([date, { total, n }]) => [date, total / n])),
    )
  }
  return result
}

export function metricTrendView(
  dataset: DashboardDataset,
  kpiKey: string,
  from: string,
  to: string,
  mode: TrendMode,
  options: {
    /** group mode: null = one series per group; id = that group only */
    position?: string | null
    /** individual mode: the focused athlete */
    athleteId?: string | null
    /** active groups in display order (settings-aware labels) */
    groups: { id: string; label: string }[]
  },
): MetricTrendViewModel {
  const kpi = dataset.kpis.get(kpiKey) ?? null
  const byAthlete = dailyValuesByAthlete(dataset, kpiKey, from, to)
  const dates = [...new Set([...byAthlete.values()].flatMap((m) => [...m.keys()]))].sort()

  const meanSeries = (athleteIds: string[], key: string, label: string): TrendSeries => {
    const members = athleteIds.filter((id) => byAthlete.has(id))
    return {
      key,
      label,
      memberCount: members.length,
      values: dates.map((date) => {
        const values = members
          .map((id) => byAthlete.get(id)!.get(date))
          .filter((v): v is number => v !== undefined)
        return values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : null
      }),
    }
  }

  let series: TrendSeries[] = []
  if (mode === 'group') {
    const groups =
      options.position != null
        ? options.groups.filter((g) => g.id === options.position)
        : options.groups
    series = groups
      .map((group) =>
        meanSeries(
          dataset.athletes.filter((a) => a.position === group.id).map((a) => a.id),
          group.id,
          group.label,
        ),
      )
      .filter((s) => s.memberCount > 0)
  } else if (options.athleteId) {
    const athlete = dataset.athleteById.get(options.athleteId)
    if (athlete) {
      const own = byAthlete.get(athlete.id)
      series = [
        {
          key: athlete.id,
          label: athlete.fullName,
          memberCount: own ? 1 : 0,
          values: dates.map((date) => own?.get(date) ?? null),
        },
        meanSeries(
          dataset.athletes.map((a) => a.id),
          'team',
          'Team mean',
        ),
      ]
    }
  }

  return { kpi, dates, series }
}
