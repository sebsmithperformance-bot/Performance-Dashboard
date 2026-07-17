/**
 * Athlete Flags tile view model (§5.1) — speed flag first, structured so more
 * transparent rule-based flag types can be added without redesigning the tile.
 * A flag exists only when the session is speed-eligible, the athlete has ≥3
 * valid baseline observations, and the current value is below the threshold.
 * "Insufficient baseline" is reported separately, never as a flag (§3.1).
 */
import { speedPercentOfBest } from '../../calculations/index.ts'
import { DEFAULT_THRESHOLDS } from '../../settings/defaults.ts'
import type { ThresholdSettings } from '../../settings/types.ts'
import type { DashSession, DashboardDataset, Position } from '../types.ts'

export interface SpeedFlag {
  athleteId: string
  name: string
  position: Position
  currentTopSpeed: number
  percentOfBest: number
  baselineBest: number
  baselineSize: number
  /** current-session exposure minutes — context only, not part of the rule; null = unknown */
  exposureMin: number | null
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

export function athleteFlagsView(
  dataset: DashboardDataset,
  date: string,
  thresholds: ThresholdSettings = DEFAULT_THRESHOLDS,
): AthleteFlagsViewModel {
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
      thresholdPct: thresholds.speedFlagThresholdPct,
      minBaseline: thresholds.speedMinBaselineSamples,
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
      if (!part || part.exposureMin < thresholds.speedMinExposureMin) continue
      priors.push(obs.value)
    }

    const result = speedPercentOfBest(current.value, priors, thresholds.speedMinBaselineSamples)
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
    if (result.value < thresholds.speedFlagThresholdPct) {
      const currentPart = dataset.participationByKey.get(`${athlete.id}|${session.id}`)
      flags.push({
        athleteId: athlete.id,
        name: athlete.fullName,
        position: athlete.position,
        currentTopSpeed: current.value,
        percentOfBest: result.value,
        baselineBest: Math.max(...priors),
        baselineSize: priors.length,
        exposureMin: currentPart && currentPart.exposureMin > 0 ? currentPart.exposureMin : null,
        reason: `top speed below ${thresholds.speedFlagThresholdPct}% of personal baseline`,
      })
    }
  }

  flags.sort((a, b) => a.percentOfBest - b.percentOfBest)
  return {
    session,
    thresholdPct: thresholds.speedFlagThresholdPct,
    minBaseline: thresholds.speedMinBaselineSamples,
    flags,
    insufficientBaseline: insufficient,
    evaluated,
  }
}
