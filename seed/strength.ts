/**
 * TeamBuildr strength simulation (spec §8.8): values are the top working load
 * for that lift session, never a tested 1RM. Progression is modest and
 * non-linear: preseason gains ~1–6% (younger training age gains more),
 * in-season maintenance with congestion dips. Scenario athletes plateau,
 * improve, or reduce per §8.13.
 */
import { IN_SEASON_WEEK_PLAN, RATES, SEASON_WEEKS } from './config.v1.ts'
import { hasScenario } from './scenario.ts'
import type { Rng } from './rng.ts'
import type { LiftObservation, SimAthlete, SimParticipation, SimSession } from './types.ts'

// 2.5 lb increments below 130 lb (light-lift micro plates), 5 lb above (§8.8)
const roundToPlate = (lb: number): number => {
  const step = lb < 130 ? 2.5 : 5
  return Math.max(45, Math.round(lb / step) * step)
}

function congested(weekIndex: number): boolean {
  const plan = IN_SEASON_WEEK_PLAN[weekIndex - SEASON_WEEKS.preseason]
  return plan?.archetype === 'two_game' || plan?.archetype === 'travel_two_game'
}

/** Multiplier on start e1RM for a given week (deterministic per athlete). */
function e1rmFactor(
  athlete: SimAthlete,
  weekIndex: number,
  scenarioAssignments: Record<string, string[]>,
  wobble: number,
): number {
  const plateau = hasScenario(scenarioAssignments, athlete.id, 'strength_plateau')
  const improver = hasScenario(scenarioAssignments, athlete.id, 'preseason_strength_improver')
  const reduced = hasScenario(scenarioAssignments, athlete.id, 'reduced_in_season_lifts')

  // Preseason gain: 1–6% depending on training age and attendance (§8.8)
  let gain =
    (0.01 + 0.05 * ((6 - athlete.traits.trainingAgeYr) / 5)) *
    (0.6 + 0.4 * athlete.traits.attendanceReliability)
  if (improver) gain = Math.min(0.06, gain * 1.5)
  if (plateau) gain = 0

  const preseasonProgress = Math.min(1, weekIndex / (SEASON_WEEKS.preseason - 1 || 1))
  let factor = 1 + gain * preseasonProgress

  if (weekIndex >= SEASON_WEEKS.preseason) {
    factor = 1 + gain // hold preseason gains
    factor *= 1 + wobble // small non-linear in-season fluctuation
    if (congested(weekIndex)) factor *= 0.975
    if (reduced && weekIndex >= 8) factor *= 0.92
  }
  return factor
}

export function generateStrength(
  rng: Rng,
  athletes: SimAthlete[],
  sessions: SimSession[],
  participation: SimParticipation[],
  scenarioAssignments: Record<string, string[]>,
): LiftObservation[] {
  const liftRng = rng.fork('strength')
  const athleteById = new Map(athletes.map((a) => [a.id, a]))
  const sessionById = new Map(sessions.map((s) => [s.id, s]))

  // Per athlete-week wobble stream, stable across exercises in the same week
  const wobbleCache = new Map<string, number>()
  const wobbleFor = (athleteId: string, weekIndex: number): number => {
    const key = `${athleteId}|${weekIndex}`
    if (!wobbleCache.has(key)) wobbleCache.set(key, liftRng.normal(0, 0.006))
    return wobbleCache.get(key)!
  }

  const rows: LiftObservation[] = []
  for (const part of participation) {
    const session = sessionById.get(part.sessionId)!
    if (session.kind !== 'lift' || part.level === 'absent') continue
    const athlete = athleteById.get(part.athleteId)!

    for (const programmed of session.exercises ?? []) {
      // §8.11: a small share of expected completed values simply absent
      if (liftRng.chance(RATES.teamBuildrValueMissing)) continue
      // modified participants often skip the explosive lift
      if (
        part.level === 'modified' &&
        programmed.exercise === 'Power Clean' &&
        liftRng.chance(0.6)
      ) {
        continue
      }

      const factor = e1rmFactor(
        athlete,
        session.weekIndex,
        scenarioAssignments,
        wobbleFor(athlete.id, session.weekIndex),
      )
      const e1rm = athlete.e1rmStart[programmed.exercise] * factor
      const modifiedScale = part.level === 'modified' ? 0.75 : 1
      const load = roundToPlate(
        e1rm * programmed.pctOf1rm * modifiedScale * (1 + liftRng.normal(0, 0.008)),
      )

      rows.push({
        athleteId: athlete.id,
        sessionId: session.id,
        exercise: programmed.exercise,
        topWorkingLoadLb: load,
        reps: programmed.reps,
      })
    }
  }
  return rows
}
