/**
 * Availability tile view model (§5.1): status counts and reveal-in-place
 * athlete lists for one effective date. Operational notes only — the dataset
 * never contains medical detail (§8.6).
 */
import type { AvailabilityStatus, DashboardDataset, Position } from '../types.ts'

export interface AvailabilityAthlete {
  athleteId: string
  name: string
  position: Position
  note: string | null
}

export interface AvailabilityViewModel {
  effectiveDate: string
  totalActive: number
  counts: Record<AvailabilityStatus, number>
  /** athletes for the reveal-in-place lists, keyed by status */
  byStatus: Record<AvailabilityStatus, AvailabilityAthlete[]>
  /** athletes with no entry for the date (distinct from any status) */
  noEntry: number
}

export function availabilityView(
  dataset: DashboardDataset,
  date: string,
  position: string | null,
): AvailabilityViewModel {
  const athletes = dataset.athletes.filter((a) => position === null || a.position === position)

  const counts: Record<AvailabilityStatus, number> = { full_go: 0, limited: 0, out: 0 }
  const byStatus: Record<AvailabilityStatus, AvailabilityAthlete[]> = {
    full_go: [],
    limited: [],
    out: [],
  }
  let noEntry = 0

  for (const athlete of athletes) {
    const entry = dataset.availabilityByKey.get(`${athlete.id}|${date}`)
    if (!entry) {
      noEntry += 1
      continue
    }
    counts[entry.status] += 1
    byStatus[entry.status].push({
      athleteId: athlete.id,
      name: athlete.fullName,
      position: athlete.position,
      note: entry.note ?? null,
    })
  }

  return { effectiveDate: date, totalActive: athletes.length, counts, byStatus, noEntry }
}
