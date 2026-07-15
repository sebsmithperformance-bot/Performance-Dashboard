/**
 * GPS/PlayerData simulation (spec §8.7). All metrics derive from shared
 * session/athlete factors so they move together: distance from exposure ×
 * pace, high-speed distance as a subset of distance, sprints from high-speed
 * work, top speed bounded by stable capacity, Player Load from distance +
 * change-of-direction volume. Player-Load and Workload scales are calibrated
 * to the real export examined in docs/import-sources/playerdata.md
 * (SL ≈ 0.106 × yards; Workload ≈ SL/140, decimal). Spec "typical" bands are
 * treated as soft targets; hard bounds are enforced absolutely.
 */
import { GPS_HARD_BOUND_GK, GPS_HARD_BOUND_OUTFIELD } from './config.v1.ts'
import { hasScenario } from './scenario.ts'
import type { Rng } from './rng.ts'
import type { GpsObservation, SimAthlete, SimParticipation, SimSession } from './types.ts'

type Band = 'recovery' | 'normal' | 'high' | 'game'

const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v))
const lerp = (lo: number, hi: number, t: number): number => lo + (hi - lo) * t

function bandOf(session: SimSession): Band {
  if (session.type === 'recovery') return 'recovery'
  if (session.type === 'game') return 'game'
  return session.plannedIntensity >= 0.86 ? 'high' : 'normal'
}

/** yards-per-minute envelope by band (outfield); GK handled separately. */
const YPM: Record<Band, [number, number]> = {
  recovery: [18, 40],
  normal: [32, 62],
  high: [42, 70],
  game: [45, 75],
}
const YPM_GK: Record<'practice' | 'game', [number, number]> = {
  practice: [6, 22],
  game: [3, 16],
}

const POSITION_PACE: Record<SimAthlete['position'], number> = {
  Midfielder: 1.08,
  Forward: 1.02,
  Defender: 0.97,
  Goalkeeper: 1,
}

/** share of distance run at high speed, by band, before trait scaling. */
const HSD_SHARE: Record<Band, [number, number]> = {
  recovery: [0, 0.035],
  normal: [0.02, 0.1],
  high: [0.05, 0.13],
  game: [0.04, 0.14],
}

const SPRINT_FACTOR: Record<SimAthlete['position'], number> = {
  Forward: 1.35,
  Midfielder: 0.95,
  Defender: 0.8,
  Goalkeeper: 0.4,
}

export function generateGps(
  rng: Rng,
  athletes: SimAthlete[],
  sessions: SimSession[],
  participation: SimParticipation[],
  scenarioAssignments: Record<string, string[]>,
  deviceMissingRate: number,
): GpsObservation[] {
  const gpsRng = rng.fork('gps')
  const athleteById = new Map(athletes.map((a) => [a.id, a]))
  const sessionById = new Map(sessions.map((s) => [s.id, s]))

  const rows: GpsObservation[] = []
  for (const part of participation) {
    const session = sessionById.get(part.sessionId)!
    if (session.kind !== 'field' || part.exposureMin <= 0) continue // zero minutes ⇒ no GPS row
    const athlete = athleteById.get(part.athleteId)!
    const gk = athlete.position === 'Goalkeeper'
    const bound = gk ? GPS_HARD_BOUND_GK : GPS_HARD_BOUND_OUTFIELD

    // Deliberate device-failure cluster (§8.13): scenario athlete loses week 9
    if (
      hasScenario(scenarioAssignments, athlete.id, 'device_missing_cluster') &&
      session.weekIndex === 9
    ) {
      continue
    }
    if (gpsRng.chance(deviceMissingRate)) continue // §8.11: 2–4% device missing

    const band = bandOf(session)
    const noise = () => gpsRng.normal(0, athlete.traits.sessionVariability)

    // --- distance ---
    const [ypmLo, ypmHi] = gk ? YPM_GK[band === 'game' ? 'game' : 'practice'] : YPM[band]
    const paceBlend = clamp(
      0.45 * athlete.traits.workCapacity + 0.35 * session.plannedIntensity + 0.2 * gpsRng.next(),
      0,
      1,
    )
    const ypm = lerp(ypmLo, ypmHi, paceBlend) * POSITION_PACE[athlete.position] * (1 + noise())
    const distanceYd = Math.round(clamp(ypm * part.exposureMin, 0, bound.distance))

    // --- high-speed distance (always a subset of distance) ---
    const [shLo, shHi] = HSD_SHARE[band]
    const speedPct = clamp(
      (athlete.traits.topSpeedCapacityMph - (gk ? 12 : 15)) / (gk ? 4.5 : 5),
      0,
      1,
    )
    const posShare =
      athlete.position === 'Forward'
        ? 1.25
        : athlete.position === 'Midfielder'
          ? 1.05
          : gk
            ? 0.25
            : 0.95
    const share = lerp(shLo, shHi, clamp(0.5 * speedPct + 0.5 * gpsRng.next(), 0, 1)) * posShare
    const highSpeedDistanceYd = Math.round(
      clamp(distanceYd * share * (1 + noise()), 0, Math.min(bound.hsd, distanceYd)),
    )

    // --- sprints & sprint distance & high-intensity events ---
    const sprints = Math.round(
      clamp(
        (highSpeedDistanceYd / 42) * SPRINT_FACTOR[athlete.position] + gpsRng.normal(0, 1.2),
        0,
        bound.sprints,
      ),
    )
    const sprintDistanceYd =
      sprints === 0
        ? 0
        : Math.round(clamp(sprints * gpsRng.truncNormal(8, 3, 4, 20), 0, highSpeedDistanceYd))
    const highIntensityEvents = Math.round(
      clamp(highSpeedDistanceYd / gpsRng.truncNormal(6.8, 0.8, 5, 9), 0, 60),
    )

    // --- top speed: bounded by stable capacity; PBs are rare (§8.7) ---
    const exposureFactorMean: Record<Band, number> = {
      recovery: 0.72,
      normal: 0.88,
      high: 0.92,
      game: 0.93,
    }
    let factor = gpsRng.truncNormal(exposureFactorMean[band], 0.02, 0.55, 0.99)
    if ((band === 'high' || band === 'game') && gpsRng.chance(0.015)) {
      factor = gpsRng.truncNormal(1.0, 0.003, 0.995, 1.005) // true PB effort
    }
    // §8.13 speed-flag scenario: weeks 13–14 dip in speed-exposing sessions
    if (
      hasScenario(scenarioAssignments, athlete.id, 'speed_flag_legit') &&
      (band === 'high' || band === 'game') &&
      session.weekIndex >= 12 &&
      session.weekIndex <= 13
    ) {
      factor = Math.min(factor, gpsRng.truncNormal(0.84, 0.015, 0.8, 0.87))
    }
    if (part.exposureMin < 25) factor *= gpsRng.truncNormal(0.94, 0.03, 0.85, 1)
    const topSpeedMph =
      Math.round(clamp(athlete.traits.topSpeedCapacityMph * factor, 4, bound.top) * 10) / 10

    // --- accelerations / decelerations (rise together, §8.7) ---
    const accBase =
      (part.exposureMin / 90) *
      lerp(
        gk ? 12 : 20,
        gk ? 34 : 62,
        clamp(
          session.plannedIntensity * athlete.traits.accelerationFactor + 0.25 * gpsRng.next(),
          0,
          1,
        ),
      )
    const accelerations = Math.round(clamp(accBase * (1 + noise()), 0, bound.acc))
    const decelerations = Math.round(
      clamp(accelerations * gpsRng.truncNormal(1.08, 0.08, 0.85, 1.35), 0, bound.dec),
    )

    // --- Player Load (AU) & Workload, calibrated to the real export scale ---
    const playerLoadAu = Math.round(
      clamp(
        (0.095 * distanceYd + 0.75 * (accelerations + decelerations) + 0.1 * highSpeedDistanceYd) *
          (1 + noise() * 0.6),
        0,
        bound.load,
      ),
    )
    const workload =
      Math.round(clamp(0.6 + playerLoadAu / 140 + gpsRng.normal(0, 0.45), 1, 10) * 10) / 10

    rows.push({
      athleteId: athlete.id,
      sessionId: session.id,
      distanceYd,
      highSpeedDistanceYd,
      sprintDistanceYd,
      highIntensityEvents,
      yardsPerMinute: Math.round(distanceYd / part.exposureMin),
      sprints,
      topSpeedMph,
      accelerations,
      decelerations,
      playerLoadAu,
      workload,
    })
  }
  return rows
}
