/**
 * Load Health tile view model (§5.1): team ACWR distribution using the tested
 * §3.1 calculation layer. Bands are workload observations with transparent
 * definitions — never injury language (§6.8). Incomplete windows are shown,
 * never coerced (§6.7).
 */
import {
  ACUTE_WINDOW_DAYS,
  CHRONIC_WINDOW_DAYS,
  acute7d,
  acwr,
  windowEndingAt,
} from '../../calculations/index.ts'
import { DEFAULT_THRESHOLDS } from '../../settings/defaults.ts'
import type { ThresholdSettings } from '../../settings/types.ts'
import type { DashboardDataset, Position } from '../types.ts'
import { dailyLoadByDate } from './daily-load.ts'

/** Four transparent workload states (never injury language, §6.8). */
export type LoadBand = 'below' | 'within' | 'elevated' | 'high'

export interface LoadHealthAthlete {
  athleteId: string
  name: string
  position: Position
  acwr: number | null
  band: LoadBand | null
  /** why acwr is null: 'incomplete data' | 'insufficient history' */
  reason: string | null
}

export interface LoadHealthCounts {
  below: number
  within: number
  elevated: number
  high: number
  incomplete: number
  insufficient: number
}

export interface LoadHealthViewModel {
  date: string
  /** transparent band definitions rendered verbatim in the UI (§6.9) */
  bands: { key: LoadBand; label: string; short: string; definition: string }[]
  athletes: LoadHealthAthlete[]
  counts: LoadHealthCounts
  validCount: number
  /** median ACWR across athletes with a computable window; null = none */
  teamMedianAcwr: number | null
  /** mean 7-day acute load across athletes with a computable acute window */
  avgAcute7dLoad: number | null
  loadKpiLabel: string
}

function median(values: number[]): number | null {
  if (values.length === 0) return null
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 1 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2
}

/** Band definitions rendered verbatim — always derived from the live thresholds. */
export function loadBands(
  thresholds: ThresholdSettings = DEFAULT_THRESHOLDS,
): LoadHealthViewModel['bands'] {
  const lo = thresholds.acwrBelowBand.toFixed(2)
  const mid = thresholds.acwrElevatedBand.toFixed(2)
  const hi = thresholds.acwrHighBand.toFixed(2)
  return [
    {
      key: 'below',
      label: 'Below recent workload',
      short: 'Undertraining',
      definition: `ACWR < ${lo}`,
    },
    {
      key: 'within',
      label: 'Within recent workload range',
      short: 'Within range',
      definition: `ACWR ${lo} – ${mid}`,
    },
    {
      key: 'elevated',
      label: 'Elevated acute load',
      short: 'Elevated',
      definition: `ACWR ${mid} – ${hi}`,
    },
    {
      key: 'high',
      label: 'Substantially elevated acute load',
      short: 'Substantially elevated',
      definition: `ACWR > ${hi}`,
    },
  ]
}

export function bandFor(value: number, thresholds: ThresholdSettings = DEFAULT_THRESHOLDS): LoadBand {
  if (value < thresholds.acwrBelowBand) return 'below'
  if (value <= thresholds.acwrElevatedBand) return 'within'
  if (value <= thresholds.acwrHighBand) return 'elevated'
  return 'high'
}

export function loadHealthView(
  dataset: DashboardDataset,
  date: string,
  position: string | null,
  thresholds: ThresholdSettings = DEFAULT_THRESHOLDS,
): LoadHealthViewModel {
  const athletes = dataset.athletes.filter((a) => position === null || a.position === position)
  const rows: LoadHealthAthlete[] = []
  const counts: LoadHealthCounts = {
    below: 0,
    within: 0,
    elevated: 0,
    high: 0,
    incomplete: 0,
    insufficient: 0,
  }
  const validAcwrs: number[] = []
  const acuteLoads: number[] = []

  for (const athlete of athletes) {
    const byDate = dailyLoadByDate(dataset, athlete.id, date)
    const window28 = windowEndingAt(byDate, date, CHRONIC_WINDOW_DAYS)
    const result = acwr(window28)
    const acute = acute7d(window28.slice(-ACUTE_WINDOW_DAYS))
    if (acute.computable) acuteLoads.push(acute.value)
    if (result.computable) {
      const band = bandFor(result.value, thresholds)
      counts[band] += 1
      validAcwrs.push(result.value)
      rows.push({
        athleteId: athlete.id,
        name: athlete.fullName,
        position: athlete.position,
        acwr: result.value,
        band,
        reason: null,
      })
    } else {
      const insufficient = result.reason === 'zero_chronic'
      if (insufficient) counts.insufficient += 1
      else counts.incomplete += 1
      rows.push({
        athleteId: athlete.id,
        name: athlete.fullName,
        position: athlete.position,
        acwr: null,
        band: null,
        reason: insufficient ? 'insufficient history' : 'incomplete data',
      })
    }
  }

  return {
    date,
    bands: loadBands(thresholds),
    athletes: rows,
    counts,
    validCount: counts.below + counts.within + counts.elevated + counts.high,
    teamMedianAcwr: median(validAcwrs),
    avgAcute7dLoad:
      acuteLoads.length > 0 ? acuteLoads.reduce((a, b) => a + b, 0) / acuteLoads.length : null,
    loadKpiLabel: 'Workload 1–10 (7-day acute vs 28-day weekly equivalent)',
  }
}
