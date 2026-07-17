/**
 * S&C % Change tile view model (§5.1): per-athlete percent change on a
 * selected strength/power KPI over a chosen comparison basis. Zero baselines
 * are never divided (§3.1 via the calc layer); classification follows KPI
 * interpretation with a stated ±2% "unchanged" band.
 */
import { addDays, percentChange } from '../../calculations/index.ts'
import type { DashObservation, DashboardDataset, Position } from '../types.ts'

export type ComparisonBasis = 'prior_session' | 'prior_week' | 'rolling_average' | 'custom_range'

export const UNCHANGED_BAND_PCT = 2
const ROLLING_N = 4

export interface ScChangeAthlete {
  athleteId: string
  name: string
  position: Position
  current: number | null
  baseline: number | null
  deltaPct: number | null
  classification: 'improved' | 'unchanged' | 'declined' | null
  reason: string | null // why delta is null
}

export interface ScChangeViewModel {
  kpiKey: string
  basis: ComparisonBasis
  basisLabel: string
  medianDeltaPct: number | null
  /** group medians of the underlying values, for "baseline → current" display */
  currentMedian: number | null
  baselineMedian: number | null
  counts: { improved: number; unchanged: number; declined: number; notComputable: number }
  athletes: ScChangeAthlete[]
  withData: number
  groupSize: number
  unchangedBandPct: number
}

function median(values: number[]): number | null {
  if (values.length === 0) return null
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 1 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2
}

const BASIS_LABEL: Record<ComparisonBasis, string> = {
  prior_session: 'vs prior session',
  prior_week: 'vs prior week',
  rolling_average: `vs rolling avg (last ${ROLLING_N})`,
  custom_range: 'vs custom range',
}

/** athlete's dated observations of one KPI, ascending by session date/time */
function datedObservations(
  dataset: DashboardDataset,
  athleteId: string,
  kpiKey: string,
): { date: string; startTime: string; value: number }[] {
  return (dataset.observationsByAthlete.get(athleteId) ?? [])
    .filter((o: DashObservation) => o.kpiKey === kpiKey)
    .map((o) => {
      const session = dataset.sessionById.get(o.sessionId)!
      return { date: session.date, startTime: session.startTime, value: o.value }
    })
    .sort((a, b) =>
      a.date === b.date ? a.startTime.localeCompare(b.startTime) : a.date.localeCompare(b.date),
    )
}

export function scChangeView(
  dataset: DashboardDataset,
  kpiKey: string,
  basis: ComparisonBasis,
  position: Position | null,
  endDate: string,
  customRange?: { from: string; to: string },
): ScChangeViewModel {
  const athletes = dataset.athletes.filter((a) => position === null || a.position === position)
  const interpretation = dataset.kpis.get(kpiKey)?.interpretation ?? 'neutral'
  const rows: ScChangeAthlete[] = []
  const counts = { improved: 0, unchanged: 0, declined: 0, notComputable: 0 }

  for (const athlete of athletes) {
    const series = datedObservations(dataset, athlete.id, kpiKey).filter((s) => s.date <= endDate)
    const current = series[series.length - 1] ?? null
    const history = series.slice(0, -1)

    let baseline: number | null = null
    let reason: string | null = null
    if (!current) {
      reason = 'no observations'
    } else {
      switch (basis) {
        case 'prior_session':
          baseline = history[history.length - 1]?.value ?? null
          if (baseline === null) reason = 'no prior session'
          break
        case 'prior_week': {
          const cutoff = current.date
          const weekAgo = history.filter((h) => h.date <= addDays(cutoff, -7))
          baseline = weekAgo[weekAgo.length - 1]?.value ?? null
          if (baseline === null) reason = 'no observation a week prior'
          break
        }
        case 'rolling_average': {
          const window = history.slice(-ROLLING_N)
          baseline =
            window.length > 0 ? window.reduce((a, b) => a + b.value, 0) / window.length : null
          if (baseline === null) reason = 'no prior observations'
          break
        }
        case 'custom_range': {
          const inRange = customRange
            ? series.filter((s) => s.date >= customRange.from && s.date <= customRange.to)
            : []
          baseline =
            inRange.length > 0 ? inRange.reduce((a, b) => a + b.value, 0) / inRange.length : null
          if (baseline === null) reason = 'no observations in range'
          break
        }
      }
    }

    let deltaPct: number | null = null
    let classification: ScChangeAthlete['classification'] = null
    if (current && baseline !== null) {
      const change = percentChange(current.value, baseline)
      if (change.computable) {
        deltaPct = change.value
        if (Math.abs(deltaPct) <= UNCHANGED_BAND_PCT) classification = 'unchanged'
        else {
          const higherIsBetter = interpretation === 'higher_is_better'
          const lowerIsBetter = interpretation === 'lower_is_better'
          if (higherIsBetter) classification = deltaPct > 0 ? 'improved' : 'declined'
          else if (lowerIsBetter) classification = deltaPct < 0 ? 'improved' : 'declined'
          else classification = 'unchanged' // target-range/neutral KPIs don't rank direction
        }
      } else {
        reason = 'baseline is zero — change not calculated'
      }
    }

    if (classification) counts[classification] += 1
    else counts.notComputable += 1

    rows.push({
      athleteId: athlete.id,
      name: athlete.fullName,
      position: athlete.position,
      current: current?.value ?? null,
      baseline,
      deltaPct,
      classification,
      reason,
    })
  }

  return {
    kpiKey,
    basis,
    basisLabel: BASIS_LABEL[basis],
    medianDeltaPct: median(rows.map((r) => r.deltaPct).filter((v): v is number => v !== null)),
    currentMedian: median(rows.map((r) => r.current).filter((v): v is number => v !== null)),
    baselineMedian: median(rows.map((r) => r.baseline).filter((v): v is number => v !== null)),
    counts,
    athletes: rows,
    withData: rows.filter((r) => r.deltaPct !== null).length,
    groupSize: athletes.length,
    unchangedBandPct: UNCHANGED_BAND_PCT,
  }
}
