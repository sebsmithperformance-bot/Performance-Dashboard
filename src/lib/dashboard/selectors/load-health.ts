/**
 * Load Health tile view model (§5.1): team ACWR distribution using the tested
 * §3.1 calculation layer. Bands are workload observations with transparent
 * definitions — never injury language (§6.8). Incomplete windows are shown,
 * never coerced (§6.7).
 */
import { CHRONIC_WINDOW_DAYS, acwr, windowEndingAt } from '../../calculations/index.ts'
import type { DashboardDataset, Position } from '../types.ts'
import { dailyLoadByDate } from './daily-load.ts'

export type LoadBand = 'below' | 'within' | 'elevated'

export interface LoadHealthAthlete {
  athleteId: string
  name: string
  position: Position
  acwr: number | null
  band: LoadBand | null
  /** why acwr is null: 'incomplete data' | 'insufficient history' */
  reason: string | null
}

export interface LoadHealthViewModel {
  date: string
  /** transparent band definitions rendered verbatim in the UI (§6.9) */
  bands: { key: LoadBand; label: string; definition: string }[]
  athletes: LoadHealthAthlete[]
  counts: {
    below: number
    within: number
    elevated: number
    incomplete: number
    insufficient: number
  }
  validCount: number
  loadKpiLabel: string
}

export const LOAD_BANDS: LoadHealthViewModel['bands'] = [
  { key: 'below', label: 'Below recent workload', definition: 'ACWR < 0.80' },
  { key: 'within', label: 'Within recent workload range', definition: 'ACWR 0.80 – 1.30' },
  { key: 'elevated', label: 'Elevated acute load', definition: 'ACWR > 1.30' },
]

function bandFor(value: number): LoadBand {
  if (value < 0.8) return 'below'
  if (value <= 1.3) return 'within'
  return 'elevated'
}

export function loadHealthView(
  dataset: DashboardDataset,
  date: string,
  position: Position | null,
): LoadHealthViewModel {
  const athletes = dataset.athletes.filter((a) => position === null || a.position === position)
  const rows: LoadHealthAthlete[] = []
  const counts = { below: 0, within: 0, elevated: 0, incomplete: 0, insufficient: 0 }

  for (const athlete of athletes) {
    const byDate = dailyLoadByDate(dataset, athlete.id, date)
    const result = acwr(windowEndingAt(byDate, date, CHRONIC_WINDOW_DAYS))
    if (result.computable) {
      const band = bandFor(result.value)
      counts[band] += 1
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
    bands: LOAD_BANDS,
    athletes: rows,
    counts,
    validCount: counts.below + counts.within + counts.elevated,
    loadKpiLabel: 'Player Load (7d acute vs 28d weekly equivalent)',
  }
}
