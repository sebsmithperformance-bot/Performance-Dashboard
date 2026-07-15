/**
 * Roster generation (spec §8.3): exactly 25 athletes with stable latent traits
 * drawn from truncated distributions. Height/mass/speed/strength/power are
 * moderately related — one shared "athletic base" plus trait-specific noise,
 * never identical rankings across traits.
 */
import { E1RM_RANGES, FIRST_NAMES, LAST_NAMES, ROSTER_PLAN, TRAIT_RANGES } from './config.v1.ts'
import type { Rng } from './rng.ts'
import type { LatentTraits, LiftExercise, Position, RosterRole, SimAthlete } from './types.ts'

const clamp01 = (v: number): number => Math.min(1, Math.max(0, v))
const lerp = (lo: number, hi: number, t: number): number => lo + (hi - lo) * t

function roundTo(v: number, step: number): number {
  return Math.round(v / step) * step
}

function makeTraits(rng: Rng, position: Position): LatentTraits {
  const gk = position === 'Goalkeeper'
  const athleticBase = rng.truncNormal(0.5, 0.18, 0.05, 0.95)

  const [hLo, hHi] = gk ? TRAIT_RANGES.heightIn.goalkeeper : TRAIT_RANGES.heightIn.outfield
  const heightPct = rng.truncNormal(0.5, 0.22, 0.02, 0.98)
  const heightIn = Math.round(lerp(hLo, hHi, heightPct) * 2) / 2

  const [mLo, mHi] = gk ? TRAIT_RANGES.bodyMassLb.goalkeeper : TRAIT_RANGES.bodyMassLb.outfield
  const massPct = clamp01(0.55 * heightPct + 0.45 * rng.truncNormal(0.5, 0.22, 0, 1))
  const bodyMassLb = Math.round(lerp(mLo, mHi, massPct))

  const strengthPotential = clamp01(
    0.45 * athleticBase + 0.3 * massPct + 0.25 * rng.truncNormal(0.5, 0.25, 0, 1),
  )
  const lowerBodyPower = clamp01(
    0.5 * strengthPotential + 0.25 * athleticBase + 0.25 * rng.truncNormal(0.5, 0.25, 0, 1),
  )

  const [sLo, sHi] = gk
    ? TRAIT_RANGES.topSpeedCapacityMph.goalkeeper
    : TRAIT_RANGES.topSpeedCapacityMph.outfield
  const speedPct = clamp01(
    0.4 * lowerBodyPower + 0.3 * athleticBase + 0.3 * rng.truncNormal(0.5, 0.22, 0, 1),
  )
  const topSpeedCapacityMph = Math.round(lerp(sLo, sHi, speedPct) * 10) / 10

  const midBonus = position === 'Midfielder' ? 0.12 : 0
  const workCapacity = clamp01(
    0.45 * athleticBase + 0.45 * rng.truncNormal(0.5, 0.22, 0, 1) + midBonus,
  )

  return {
    bodyMassLb,
    heightIn,
    trainingAgeYr: 0, // set with yearsOnTeam below
    strengthPotential,
    lowerBodyPower,
    topSpeedCapacityMph,
    workCapacity,
    accelerationFactor: clamp01(0.5 * lowerBodyPower + 0.5 * rng.truncNormal(0.5, 0.22, 0, 1)),
    fatigueSensitivity: rng.truncNormal(0.5, 0.15, 0.15, 0.85),
    sessionVariability: rng.truncNormal(0.07, 0.02, 0.03, 0.13),
    attendanceReliability: rng.truncNormal(0.96, 0.03, 0.86, 0.995),
  }
}

function makeE1rm(rng: Rng, traits: LatentTraits): Record<LiftExercise, number> {
  const noise = () => rng.truncNormal(0.5, 0.2, 0, 1)
  const massPct = clamp01((traits.bodyMassLb - 120) / 75)
  const blend: Record<LiftExercise, number> = {
    'Back Squat': clamp01(0.7 * traits.strengthPotential + 0.3 * noise()),
    'Bench Press': clamp01(0.55 * traits.strengthPotential + 0.15 * massPct + 0.3 * noise()),
    'Trap Bar Deadlift': clamp01(0.6 * traits.strengthPotential + 0.15 * massPct + 0.25 * noise()),
    // Power-clean ability tracks the power trait more than bench does (§8.8)
    'Power Clean': clamp01(
      0.55 * traits.lowerBodyPower + 0.2 * traits.strengthPotential + 0.25 * noise(),
    ),
  }
  const out = {} as Record<LiftExercise, number>
  for (const exercise of Object.keys(E1RM_RANGES) as LiftExercise[]) {
    const { typical, hard } = E1RM_RANGES[exercise]
    const raw = lerp(typical[0], typical[1], blend[exercise])
    out[exercise] = Math.min(hard[1], Math.max(hard[0], roundTo(raw, 5)))
  }
  return out
}

export function generateRoster(rng: Rng): SimAthlete[] {
  const nameRng = rng.fork('names')
  const firstNames = nameRng.shuffle(FIRST_NAMES)
  const lastNames = nameRng.shuffle(LAST_NAMES)
  const jerseys = nameRng.shuffle(Array.from({ length: 39 }, (_, i) => i + 1))

  const athletes: SimAthlete[] = []
  let index = 0
  for (const plan of ROSTER_PLAN) {
    for (let i = 0; i < plan.count; i += 1) {
      const athleteRng = rng.fork(`athlete-${index}`)
      const traits = makeTraits(athleteRng, plan.position)
      const yearsOnTeam = athleteRng.int(TRAIT_RANGES.yearsOnTeam[0], TRAIT_RANGES.yearsOnTeam[1])
      traits.trainingAgeYr = Math.min(
        TRAIT_RANGES.trainingAgeYr[1],
        Math.max(TRAIT_RANGES.trainingAgeYr[0], yearsOnTeam + athleteRng.int(0, 2)),
      )
      const role: RosterRole = plan.roles[i] ?? 'developmental'
      athletes.push({
        id: `ATH-${String(index + 1).padStart(2, '0')}`,
        firstName: firstNames[index] as string,
        lastName: lastNames[index] as string,
        position: plan.position,
        role,
        jerseyNumber: jerseys[index] as number,
        yearsOnTeam,
        traits,
        e1rmStart: makeE1rm(athleteRng, traits),
      })
      index += 1
    }
  }
  return athletes
}
