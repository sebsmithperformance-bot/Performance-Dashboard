/**
 * Perch VBT simulation (spec §8.9): session-level power observations that are
 * independent of TeamBuildr — either source may exist without the other.
 * Power tracks strength/power traits and body mass with realistic noise,
 * dips slightly in congested weeks, and improves modestly through preseason
 * technique adaptation.
 */
import { IN_SEASON_WEEK_PLAN, PERCH_RANGES, RATES, SEASON_WEEKS } from './config.v1.ts'
import type { Rng } from './rng.ts'
import type { PerchObservation, SimAthlete, SimParticipation, SimSession } from './types.ts'

const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v))
const lerp = (lo: number, hi: number, t: number): number => lo + (hi - lo) * t

function congested(weekIndex: number): boolean {
  const plan = IN_SEASON_WEEK_PLAN[weekIndex - SEASON_WEEKS.preseason]
  return plan?.archetype === 'two_game' || plan?.archetype === 'travel_two_game'
}

export function generatePerch(
  rng: Rng,
  athletes: SimAthlete[],
  sessions: SimSession[],
  participation: SimParticipation[],
): PerchObservation[] {
  const perchRng = rng.fork('perch')
  const athleteById = new Map(athletes.map((a) => [a.id, a]))
  const sessionById = new Map(sessions.map((s) => [s.id, s]))

  const rows: PerchObservation[] = []
  for (const part of participation) {
    const session = sessionById.get(part.sessionId)!
    if (session.kind !== 'lift' || part.level === 'absent') continue
    const athlete = athleteById.get(part.athleteId)!

    for (const programmed of session.exercises ?? []) {
      // §8.9/§8.11: 8–15% of eligible lift sessions have no Perch reading —
      // rolled independently of TeamBuildr so Perch-only records also occur
      if (perchRng.chance(RATES.perchMissing)) continue

      const { typical, hard } = PERCH_RANGES[programmed.exercise]
      const massPct = clamp((athlete.traits.bodyMassLb - 120) / 75, 0, 1)
      const blend = clamp(
        0.5 * athlete.traits.lowerBodyPower +
          0.25 * athlete.traits.strengthPotential +
          0.15 * massPct +
          0.1 * perchRng.next(),
        0,
        1,
      )
      let power = lerp(typical[0], typical[1], blend)

      // heavier bar ≠ more power: moderate loads move faster (§8.9)
      power *= 1 + clamp((0.76 - programmed.pctOf1rm) * 0.5, -0.05, 0.05)
      // preseason technique adaptation: small ramp across weeks 0–3
      if (session.phase === 'preseason') power *= 0.97 + 0.015 * session.weekIndex
      if (congested(session.weekIndex)) power *= 0.97
      power *= 1 + perchRng.normal(0, 0.04)

      rows.push({
        athleteId: athlete.id,
        sessionId: session.id,
        exercise: programmed.exercise,
        powerW: Math.round(clamp(power, hard[0], hard[1])),
        metric: programmed.exercise === 'Power Clean' ? 'peak_power' : 'mean_concentric_power',
      })
    }
  }
  return rows
}
