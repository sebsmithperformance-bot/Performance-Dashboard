/**
 * Athlete Flags tile view model (§5.1) — speed flag first, structured so more
 * transparent rule-based flag types can be added without redesigning the tile.
 * A flag exists only when the session is speed-eligible, the athlete has ≥3
 * valid baseline observations, and the current value is below the threshold.
 * "Insufficient baseline" is reported separately, never as a flag (§3.1).
 */
import { SPEED_BASELINE_MIN_OBSERVATIONS, speedPercentOfBest } from '../../calculations/index.ts'
import type { DashSession, DashboardDataset, Position } from '../types.ts'

export const SPEED_FLAG_THRESHOLD_PCT = 90
/** minimum exposure for a session to count as speed-exposing (matches §8 QA rule) */
const MIN_EXPOSURE_MIN = 25

export interface SpeedFlag {
  athleteId: string
  name: string
  position: Position
  currentTopSpeed: number
  percentOfBest: number
  baselineBest: number
  baselineSize: number
  reason: string
}

export interface InsufficientBaselineAthlete {
  athleteId: string
  name: string
  position: Position
  baselineSize: number
}

export interface AthleteFlagsViewModel {
  session: DashSession | null
  thresholdPct: number
  minBaseline: number
  flags: SpeedFlag[]
  insufficientBaseline: InsufficientBaselineAthlete[]
  /** athletes evaluated (participated in the flag session with a top-speed reading) */
  evaluated: number
}

function isSpeedEligible(session: DashSession): boolean {
  return session.kind === 'field' && (session.type === 'game' || session.type === 'practice')
}

export function athleteFlagsView(dataset: DashboardDataset, date: string): AthleteFlagsViewModel {
  // most recent speed-eligible session at/before the date that has top-speed data
  const session =
    [...dataset.sessions]
      .reverse()
      .find(
        (s) =>
          s.date <= date &&
          isSpeedEligible(s) &&
          (dataset.observationsBySession.get(s.id) ?? []).some((o) => o.kpiKey === 'top_speed'),
      ) ?? null

  if (!session) {
    return {
      session: null,
      thresholdPct: SPEED_FLAG_THRESHOLD_PCT,
      minBaseline: SPEED_BASELINE_MIN_OBSERVATIONS,
      flags: [],
      insufficientBaseline: [],
      evaluated: 0,
    }
  }

  const flags: SpeedFlag[] = []
  const insufficient: InsufficientBaselineAthlete[] = []
  let evaluated = 0

  const sessionObs = dataset.observationsBySession.get(session.id) ?? []

  for (const athlete of dataset.athletes) {
    const current = sessionObs.find((o) => o.athleteId === athlete.id && o.kpiKey === 'top_speed')
    if (!current) continue
    evaluated += 1

    // baseline: prior speed-eligible sessions with adequate exposure
    const priors: number[] = []
    for (const obs of dataset.observationsByAthlete.get(athlete.id) ?? []) {
      if (obs.kpiKey !== 'top_speed' || obs.sessionId === session.id) continue
      const s = dataset.sessionById.get(obs.sessionId)!
      const before =
        s.date < session.date || (s.date === session.date && s.startTime < session.startTime)
      if (!before || !isSpeedEligible(s)) continue
      const part = dataset.participationByKey.get(`${athlete.id}|${obs.sessionId}`)
      if (!part || part.exposureMin < MIN_EXPOSURE_MIN) continue
      priors.push(obs.value)
    }

    const result = speedPercentOfBest(current.value, priors)
    if (!result.computable) {
      if (result.reason === 'insufficient_baseline') {
        insufficient.push({
          athleteId: athlete.id,
          name: athlete.fullName,
          position: athlete.position,
          baselineSize: priors.length,
        })
      }
      continue
    }
    if (result.value < SPEED_FLAG_THRESHOLD_PCT) {
      flags.push({
        athleteId: athlete.id,
        name: athlete.fullName,
        position: athlete.position,
        currentTopSpeed: current.value,
        percentOfBest: result.value,
        baselineBest: Math.max(...priors),
        baselineSize: priors.length,
        reason: `top speed below ${SPEED_FLAG_THRESHOLD_PCT}% of personal baseline`,
      })
    }
  }

  flags.sort((a, b) => a.percentOfBest - b.percentOfBest)
  return {
    session,
    thresholdPct: SPEED_FLAG_THRESHOLD_PCT,
    minBaseline: SPEED_BASELINE_MIN_OBSERVATIONS,
    flags,
    insufficientBaseline: insufficient,
    evaluated,
  }
}
