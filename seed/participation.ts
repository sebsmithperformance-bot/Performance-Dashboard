/**
 * Participation and playing time (spec §8.5), generated before any GPS value:
 * exposure minutes come from availability, roster role, session type, and
 * attendance reliability. GPS later scales from exposure — never the reverse.
 */
import { RATES } from './config.v1.ts'
import type { Rng } from './rng.ts'
import type {
  AvailabilityStatus,
  ParticipationLevel,
  SimAthlete,
  SimAvailabilityDay,
  SimParticipation,
  SimSession,
} from './types.ts'

function gameMinutes(rng: Rng, athlete: SimAthlete, overtime: boolean): number {
  const ot = overtime ? 10 : 0
  if (athlete.position === 'Goalkeeper') {
    // one GK plays most games, second occasionally, third rarely (§8.5)
    if (athlete.role === 'starter') return rng.chance(0.92) ? 60 + ot : 0
    if (athlete.role === 'rotation') return rng.chance(0.18) ? (rng.chance(0.5) ? 60 + ot : 30) : 0
    return rng.chance(0.05) ? 30 : 0
  }
  switch (athlete.role) {
    case 'starter':
      return Math.round(rng.truncNormal(48, 7, 22, 60)) + ot
    case 'rotation':
      return Math.round(rng.truncNormal(26, 9, 4, 45)) + (overtime && rng.chance(0.6) ? 8 : 0)
    default:
      return rng.chance(0.45) ? Math.round(rng.truncNormal(9, 5, 2, 18)) : 0
  }
}

export function generateParticipation(
  rng: Rng,
  athletes: SimAthlete[],
  sessions: SimSession[],
  availability: SimAvailabilityDay[],
): SimParticipation[] {
  const partRng = rng.fork('participation')
  const availByKey = new Map<string, AvailabilityStatus>()
  for (const day of availability) availByKey.set(`${day.athleteId}|${day.date}`, day.status)

  const rows: SimParticipation[] = []
  for (const session of sessions) {
    const overtime = session.eventTags.includes('overtime_game')
    for (const athlete of athletes) {
      const status = availByKey.get(`${athlete.id}|${session.date}`) ?? 'full_go'
      let level: ParticipationLevel
      let exposureMin = 0

      if (status === 'out') {
        level = session.kind === 'lift' && partRng.chance(0.15) ? 'modified' : 'absent'
        if (level === 'modified') exposureMin = Math.round(session.plannedDurationMin * 0.5)
      } else if (status === 'limited') {
        if (session.kind === 'lift') {
          level = partRng.chance(0.6) ? 'full' : 'modified'
          exposureMin = Math.round(
            session.plannedDurationMin *
              (level === 'full' ? 1 : partRng.truncNormal(0.6, 0.1, 0.4, 0.8)),
          )
        } else if (session.type === 'game') {
          level = 'absent' // limited athletes don't play (§8.6 mostly-coherent)
        } else {
          level = partRng.chance(0.72) ? 'modified' : 'absent'
          if (level === 'modified') {
            exposureMin = Math.round(
              session.plannedDurationMin * partRng.truncNormal(0.55, 0.12, 0.3, 0.75),
            )
          }
        }
      } else {
        // full_go: occasional unexcused/academic absence, scaled by reliability
        const missChance =
          RATES.practiceAbsenceBase +
          (1 - athlete.traits.attendanceReliability) * (session.type === 'game' ? 0.3 : 2.2)
        if (partRng.chance(missChance)) {
          level = 'absent'
        } else if (session.type === 'game') {
          const minutes = gameMinutes(partRng, athlete, overtime)
          level = minutes === 0 ? 'absent' : 'full'
          exposureMin = minutes
        } else {
          level = 'full'
          exposureMin = Math.round(
            session.plannedDurationMin * partRng.truncNormal(0.96, 0.03, 0.85, 1),
          )
        }
      }

      rows.push({ athleteId: athlete.id, sessionId: session.id, level, exposureMin })
    }
  }
  return rows
}
