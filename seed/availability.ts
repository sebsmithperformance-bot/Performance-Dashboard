/**
 * Daily availability (spec §8.6): mostly full_go, short limited/out clusters,
 * a couple of longer restrictions, operational notes only — never diagnoses.
 */
import { addDays } from '../src/lib/calculations/series.ts'
import { hasScenario } from './scenario.ts'
import type { Rng } from './rng.ts'
import type { AvailabilityStatus, SimAthlete, SimAvailabilityDay } from './types.ts'

const LIMITED_NOTES = [
  'Modified field volume',
  'Non-contact work',
  'Lift only',
  'Individual conditioning',
] as const

interface Cluster {
  athleteId: string
  startOffset: number // day offset from season start
  days: { status: AvailabilityStatus; note: string }[]
}

function makeCluster(
  rng: Rng,
  athleteId: string,
  startOffset: number,
  lengthDays: number,
): Cluster {
  const days: Cluster['days'] = []
  const startsOut = rng.chance(0.4)
  const outDays = startsOut ? Math.max(1, Math.round(lengthDays * 0.4)) : 0
  for (let i = 0; i < lengthDays; i += 1) {
    if (i < outDays) {
      days.push({ status: 'out', note: 'Unavailable today' })
    } else {
      const lastTwo = lengthDays >= 5 && i >= lengthDays - 2
      days.push({
        status: 'limited',
        note: lastTwo ? 'Return-to-full progression' : rng.pick(LIMITED_NOTES),
      })
    }
  }
  return { athleteId, startOffset, days }
}

export function generateAvailability(
  rng: Rng,
  athletes: SimAthlete[],
  scenarioAssignments: Record<string, string[]>,
  seasonStart: string,
  totalDays: number,
): SimAvailabilityDay[] {
  const availRng = rng.fork('availability')

  // Weighted athlete pick: higher fatigue sensitivity → more likely to appear
  const weighted: string[] = []
  for (const a of athletes) {
    const weight = Math.max(1, Math.round(a.traits.fatigueSensitivity * 10))
    for (let i = 0; i < weight; i += 1) weighted.push(a.id)
  }

  const clusters: Cluster[] = []
  for (let i = 0; i < 12; i += 1) {
    clusters.push(
      makeCluster(
        availRng,
        availRng.pick(weighted),
        availRng.int(6, totalDays - 10),
        availRng.int(2, 7),
      ),
    )
  }
  for (let i = 0; i < 3; i += 1) {
    clusters.push(
      makeCluster(
        availRng,
        availRng.pick(weighted),
        availRng.int(10, totalDays - 25),
        availRng.int(8, 21),
      ),
    )
  }

  // Named §8.13 event: return_from_low_exposure — 5 days out + 2 limited mid-season
  const returner = athletes.find((a) =>
    hasScenario(scenarioAssignments, a.id, 'return_from_low_exposure'),
  )
  if (returner) {
    clusters.push({
      athleteId: returner.id,
      startOffset: 55,
      days: [
        ...Array.from({ length: 5 }, () => ({ status: 'out' as const, note: 'Unavailable today' })),
        { status: 'limited', note: 'Return-to-full progression' },
        { status: 'limited', note: 'Return-to-full progression' },
      ],
    })
  }

  // Materialize: full_go default, clusters override (later clusters win ties)
  const byKey = new Map<string, SimAvailabilityDay>()
  for (const athlete of athletes) {
    for (let d = 0; d < totalDays; d += 1) {
      const date = addDays(seasonStart, d)
      byKey.set(`${athlete.id}|${date}`, { athleteId: athlete.id, date, status: 'full_go' })
    }
  }
  for (const cluster of clusters) {
    cluster.days.forEach((day, i) => {
      const offset = cluster.startOffset + i
      if (offset >= totalDays) return
      const date = addDays(seasonStart, offset)
      byKey.set(`${cluster.athleteId}|${date}`, {
        athleteId: cluster.athleteId,
        date,
        status: day.status,
        note: day.note,
      })
    })
  }
  return [...byKey.values()].sort((a, b) =>
    a.date === b.date ? a.athleteId.localeCompare(b.athleteId) : a.date.localeCompare(b.date),
  )
}
