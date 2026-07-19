/**
 * Monitoring → Readiness view models (§5.2): load trend + ACWR, team-wide and
 * per athlete, reusing the tested §3.1 calculation layer. Day semantics are
 * ADR-005 throughout: observed values plot, confirmed rest plots as 0, and
 * missing days are gaps (never zero); ACWR appears only when its 28-day
 * window is complete.
 */
import {
  ACUTE_WINDOW_DAYS,
  CHRONIC_WINDOW_DAYS,
  acute7d,
  acwr,
  addDays,
  chronic28dWeeklyEquivalent,
  monotony7d,
  strain7d,
  windowEndingAt,
  type DayLoad,
} from '../../calculations/index.ts'
import { DEFAULT_THRESHOLDS } from '../../settings/defaults.ts'
import type { ThresholdSettings } from '../../settings/types.ts'
import type { DashboardDataset, Position } from '../types.ts'
import { dailyLoadByDate } from './daily-load.ts'
import { bandFor, type LoadBand } from './load-health.ts'

export interface ReadinessDayPoint {
  date: string
  /** mean observed daily load among athletes with data; null = no one observed */
  meanLoad: number | null
  observedCount: number
  /** median ACWR among athletes with a computable window; null = none */
  medianAcwr: number | null
  validAcwrCount: number
}

export interface TeamReadinessViewModel {
  days: ReadinessDayPoint[]
  groupSize: number
  loadKpiLabel: string
}

export interface AthleteReadinessDay {
  date: string
  /** observed load, 0 for confirmed rest, null for missing (gap) */
  load: number | null
  acwr: number | null
}

export interface ReadinessRow {
  athleteId: string
  name: string
  position: Position
  acute7d: number | null
  chronicWeekly: number | null
  acwr: number | null
  band: LoadBand | null
  monotony: number | null
  strain: number | null
  /** trailing 14-day load values for the sparkline (rest = 0, missing = null) */
  spark: (number | null)[]
  /** why acwr is null */
  reason: string | null
}

function median(values: number[]): number | null {
  if (values.length === 0) return null
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 1 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2
}

function chartLoad(day: DayLoad | undefined): number | null {
  if (!day || day.kind === 'missing') return null
  return day.kind === 'rest' ? 0 : day.load
}

/** Dates from `days-1` days before endDate through endDate (ascending). */
export function dateWindow(endDate: string, days: number): string[] {
  const dates: string[] = []
  for (let i = days - 1; i >= 0; i -= 1) dates.push(addDays(endDate, -i))
  return dates
}

export function teamReadinessView(
  dataset: DashboardDataset,
  endDate: string,
  days: number,
  position: string | null,
): TeamReadinessViewModel {
  const athletes = dataset.athletes.filter((a) => position === null || a.position === position)
  const dates = dateWindow(endDate, days)
  const byAthlete = athletes.map((a) => dailyLoadByDate(dataset, a.id, endDate))

  const points: ReadinessDayPoint[] = dates.map((date) => {
    const loads: number[] = []
    const acwrs: number[] = []
    for (const dayMap of byAthlete) {
      const day = dayMap.get(date)
      if (day?.kind === 'observed') loads.push(day.load)
      const result = acwr(windowEndingAt(dayMap, date, CHRONIC_WINDOW_DAYS))
      if (result.computable) acwrs.push(result.value)
    }
    return {
      date,
      meanLoad: loads.length > 0 ? loads.reduce((a, b) => a + b, 0) / loads.length : null,
      observedCount: loads.length,
      medianAcwr: median(acwrs),
      validAcwrCount: acwrs.length,
    }
  })

  return {
    days: points,
    groupSize: athletes.length,
    loadKpiLabel: 'Player Load — mean across athletes with device data',
  }
}

export function athleteReadinessSeries(
  dataset: DashboardDataset,
  athleteId: string,
  endDate: string,
  days: number,
): AthleteReadinessDay[] {
  const dayMap = dailyLoadByDate(dataset, athleteId, endDate)
  return dateWindow(endDate, days).map((date) => {
    const result = acwr(windowEndingAt(dayMap, date, CHRONIC_WINDOW_DAYS))
    return {
      date,
      load: chartLoad(dayMap.get(date)),
      acwr: result.computable ? result.value : null,
    }
  })
}

export interface ReadinessSummary {
  avgAcute7d: number | null
  avgChronicWeekly: number | null
  medianAcwr: number | null
  avgMonotony: number | null
  avgStrain: number | null
  validCount: number
  incompleteCount: number
  groupSize: number
}

/** Team-level readiness aggregates for the KPI strip — averages per athlete
 *  (median where the metric is a median), computed from the tested rows. */
export function readinessSummary(
  dataset: DashboardDataset,
  date: string,
  position: string | null,
  thresholds: ThresholdSettings = DEFAULT_THRESHOLDS,
): ReadinessSummary {
  const rows = readinessTableView(dataset, date, position, thresholds)
  const mean = (vals: (number | null)[]): number | null => {
    const nums = vals.filter((v): v is number => v !== null)
    return nums.length === 0 ? null : nums.reduce((a, b) => a + b, 0) / nums.length
  }
  return {
    avgAcute7d: mean(rows.map((r) => r.acute7d)),
    avgChronicWeekly: mean(rows.map((r) => r.chronicWeekly)),
    medianAcwr: median(rows.map((r) => r.acwr).filter((v): v is number => v !== null)),
    avgMonotony: mean(rows.map((r) => r.monotony)),
    avgStrain: mean(rows.map((r) => r.strain)),
    validCount: rows.filter((r) => r.acwr !== null).length,
    incompleteCount: rows.filter((r) => r.reason === 'incomplete data').length,
    groupSize: rows.length,
  }
}

export function readinessTableView(
  dataset: DashboardDataset,
  date: string,
  position: string | null,
  thresholds: ThresholdSettings = DEFAULT_THRESHOLDS,
): ReadinessRow[] {
  const athletes = dataset.athletes.filter((a) => position === null || a.position === position)
  return athletes.map((athlete) => {
    const dayMap = dailyLoadByDate(dataset, athlete.id, date)
    const window28 = windowEndingAt(dayMap, date, CHRONIC_WINDOW_DAYS)
    const window7 = window28.slice(-ACUTE_WINDOW_DAYS)

    const acuteResult = acute7d(window7)
    const chronicResult = chronic28dWeeklyEquivalent(window28)
    const acwrResult = acwr(window28)
    const monotonyResult = monotony7d(window7)
    const strainResult = strain7d(window7)

    let reason: string | null = null
    if (!acwrResult.computable) {
      reason = acwrResult.reason === 'zero_chronic' ? 'insufficient history' : 'incomplete data'
    }

    const sparkDates = dateWindow(date, 14)
    return {
      athleteId: athlete.id,
      name: athlete.fullName,
      position: athlete.position,
      acute7d: acuteResult.computable ? acuteResult.value : null,
      chronicWeekly: chronicResult.computable ? chronicResult.value : null,
      acwr: acwrResult.computable ? acwrResult.value : null,
      band: acwrResult.computable ? bandFor(acwrResult.value, thresholds) : null,
      monotony: monotonyResult.computable ? monotonyResult.value : null,
      strain: strainResult.computable ? strainResult.value : null,
      spark: sparkDates.map((d) => chartLoad(dayMap.get(d))),
      reason,
    }
  })
}
