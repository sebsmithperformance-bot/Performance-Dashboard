/**
 * Performance (S&C) view models (§5.4): overview tiles, leaderboards, and the
 * athlete-profile percentile radar. Leaderboards and tiles reuse the tested
 * scChangeView comparison logic; the radar uses direction-aware percentile
 * ranks and refuses to rank with fewer than five comparison athletes. No
 * combined score exists anywhere (§6.2).
 */
import { DEFAULT_THRESHOLDS } from '../../settings/defaults.ts'
import type { ThresholdSettings } from '../../settings/types.ts'
import type { ComparisonBasis, DashKpi, DashboardDataset } from '../types.ts'
import { scChangeView, type ScChangeAthlete } from './sc-change.ts'

export const MIN_COMPARISON_ATHLETES = 5

/** S&C KPI catalog in a stable display order (Strength first, then Power). */
export function scKpis(dataset: DashboardDataset): DashKpi[] {
  const all = [...dataset.kpis.values()]
  return [
    ...all.filter((k) => k.category === 'Strength'),
    ...all.filter((k) => k.category === 'Power'),
  ]
}

export interface PerformanceTile {
  kpi: DashKpi
  /** team median of each athlete's latest value at/before the date */
  median: number | null
  medianDeltaPct: number | null
  basisLabel: string
  withData: number
  groupSize: number
}

export function performanceOverview(
  dataset: DashboardDataset,
  endDate: string,
  basis: ComparisonBasis,
  position: string | null,
  thresholds: ThresholdSettings = DEFAULT_THRESHOLDS,
): PerformanceTile[] {
  return scKpis(dataset).map((kpi) => {
    const view = scChangeView(dataset, kpi.key, basis, position, endDate, undefined, thresholds)
    return {
      kpi,
      median: view.currentMedian,
      medianDeltaPct: view.medianDeltaPct,
      basisLabel: view.basisLabel,
      withData: view.athletes.filter((a) => a.current !== null).length,
      groupSize: view.groupSize,
    }
  })
}

export interface LeaderboardRow extends ScChangeAthlete {
  rank: number | null
}

export interface LeaderboardViewModel {
  kpi: DashKpi | null
  basisLabel: string
  rows: LeaderboardRow[]
  /** athletes with no observation of this KPI (listed, never zero-filled) */
  withoutData: number
}

export function leaderboardView(
  dataset: DashboardDataset,
  kpiKey: string,
  basis: ComparisonBasis,
  endDate: string,
  position: string | null,
  thresholds: ThresholdSettings = DEFAULT_THRESHOLDS,
): LeaderboardViewModel {
  const kpi = dataset.kpis.get(kpiKey) ?? null
  const view = scChangeView(dataset, kpiKey, basis, position, endDate, undefined, thresholds)

  const withData = view.athletes.filter(
    (a): a is ScChangeAthlete & { current: number } => a.current !== null,
  )
  // rank by current value, direction-aware; neutral KPIs list high-to-low
  // without implying better/worse (the page states this)
  const ascending = kpi?.interpretation === 'lower_is_better'
  const sorted = [...withData].sort((a, b) =>
    ascending ? a.current - b.current : b.current - a.current,
  )

  return {
    kpi,
    basisLabel: view.basisLabel,
    rows: sorted.map((row, i) => ({ ...row, rank: i + 1 })),
    withoutData: view.athletes.length - withData.length,
  }
}

export interface ProfileAxis {
  kpi: DashKpi
  /** athlete's latest value at/before the date */
  value: number | null
  /** direction-aware percentile among the comparison group; null = not computable */
  percentile: number | null
  /** comparison-group mean value; null when no comparison data */
  groupAvgValue: number | null
  /** direction-aware percentile of the group mean, same scale as `percentile` */
  groupAvgPercentile: number | null
  /** comparison athletes with a value (excluding the focal athlete) */
  comparisonN: number
  groupMedian: number | null
  groupBest: number | null
  /** why percentile is null */
  reason: string | null
}

export interface AthleteProfileViewModel {
  athleteId: string
  axes: ProfileAxis[]
  minComparison: number
  comparisonLabel: string
  /** true when no axis could be ranked (comparison group too small) */
  insufficientComparison: boolean
}

/** direction-aware percentile of `value` within `others` (0–100). */
function percentileOf(
  value: number,
  others: number[],
  interpretation: DashKpi['interpretation'],
): number | null {
  if (interpretation !== 'higher_is_better' && interpretation !== 'lower_is_better') return null
  const below = others.filter((v) =>
    interpretation === 'higher_is_better' ? v < value : v > value,
  ).length
  const equal = others.filter((v) => v === value).length
  return ((below + equal / 2) / others.length) * 100
}

function mean(values: number[]): number | null {
  return values.length === 0 ? null : values.reduce((a, b) => a + b, 0) / values.length
}

function latestValue(
  dataset: DashboardDataset,
  athleteId: string,
  kpiKey: string,
  endDate: string,
): number | null {
  let best: { date: string; startTime: string; value: number } | null = null
  for (const obs of dataset.observationsByAthlete.get(athleteId) ?? []) {
    if (obs.kpiKey !== kpiKey) continue
    const session = dataset.sessionById.get(obs.sessionId)
    if (!session || session.date > endDate) continue
    if (
      best === null ||
      session.date > best.date ||
      (session.date === best.date && session.startTime > best.startTime)
    ) {
      best = { date: session.date, startTime: session.startTime, value: obs.value }
    }
  }
  return best?.value ?? null
}

function median(values: number[]): number | null {
  if (values.length === 0) return null
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 1 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2
}

export function athleteProfileView(
  dataset: DashboardDataset,
  athleteId: string,
  endDate: string,
  comparisonPosition: string | null,
): AthleteProfileViewModel {
  const comparisonAthletes = dataset.athletes.filter(
    (a) =>
      a.id !== athleteId &&
      (comparisonPosition === null || a.position === comparisonPosition),
  )

  const axes: ProfileAxis[] = scKpis(dataset)
    .filter((kpi) => kpi.visibility.profile)
    .map((kpi) => {
      const value = latestValue(dataset, athleteId, kpi.key, endDate)
      const others = comparisonAthletes
        .map((a) => latestValue(dataset, a.id, kpi.key, endDate))
        .filter((v): v is number => v !== null)

      const groupAvgValue = mean(others)
      const rankable =
        others.length >= MIN_COMPARISON_ATHLETES &&
        (kpi.interpretation === 'higher_is_better' || kpi.interpretation === 'lower_is_better')

      let percentile: number | null = null
      let reason: string | null = null
      if (value === null) {
        reason = 'no observation for this athlete'
      } else if (others.length < MIN_COMPARISON_ATHLETES) {
        reason = `needs ≥ ${MIN_COMPARISON_ATHLETES} comparison athletes (have ${others.length})`
      } else if (rankable) {
        percentile = percentileOf(value, others, kpi.interpretation)
      } else {
        reason = 'neutral metric — no direction to rank'
      }

      // the group-average reference series shares the athlete's percentile scale
      const groupAvgPercentile =
        rankable && groupAvgValue !== null
          ? percentileOf(groupAvgValue, others, kpi.interpretation)
          : null

      return {
        kpi,
        value,
        percentile,
        groupAvgValue,
        groupAvgPercentile,
        comparisonN: others.length,
        groupMedian: median(others),
        groupBest:
          others.length === 0
            ? null
            : kpi.interpretation === 'lower_is_better'
              ? Math.min(...others)
              : Math.max(...others),
        reason,
      }
    })

  return {
    athleteId,
    axes,
    minComparison: MIN_COMPARISON_ATHLETES,
    comparisonLabel:
      comparisonPosition === null ? 'whole team' : `${comparisonPosition} group`,
    insufficientComparison: axes.every((a) => a.percentile === null),
  }
}
