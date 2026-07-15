/**
 * Canonical simulation types (spec §8.1 layer 1). Latent traits exist only so
 * one athlete's data behaves like one coherent person — they are never
 * exported to the UI or the source-style CSVs (§8.3).
 */

export type Position = 'Goalkeeper' | 'Defender' | 'Midfielder' | 'Forward'
export type RosterRole = 'starter' | 'rotation' | 'developmental'

export interface LatentTraits {
  bodyMassLb: number
  heightIn: number
  trainingAgeYr: number
  /** 0–1 percentile-ish scales, correlated per §8.3 */
  strengthPotential: number
  lowerBodyPower: number
  topSpeedCapacityMph: number
  workCapacity: number
  accelerationFactor: number
  fatigueSensitivity: number
  sessionVariability: number
  attendanceReliability: number
}

export interface SimAthlete {
  id: string // stable synthetic id, e.g. ATH-07
  firstName: string
  lastName: string
  position: Position
  role: RosterRole
  jerseyNumber: number
  yearsOnTeam: number
  traits: LatentTraits
  /** Latent estimated 1RM per exercise at season start (lb). */
  e1rmStart: Record<LiftExercise, number>
}

export type SessionType = 'practice' | 'lift' | 'game' | 'recovery' | 'testing' | 'other'

export type LiftExercise = 'Back Squat' | 'Bench Press' | 'Trap Bar Deadlift' | 'Power Clean'

export interface SimSession {
  id: string // e.g. S-2026-08-10-AM1
  date: string // ISO YYYY-MM-DD
  startTime: string // HH:MM
  label: string
  type: SessionType
  /** 'field' sessions produce GPS; 'lift' sessions produce TeamBuildr/Perch. */
  kind: 'field' | 'lift'
  weekIndex: number // 0-based across the 17-week season
  phase: 'preseason' | 'in_season'
  plannedIntensity: number // 0.3–1.05
  plannedDurationMin: number
  /** Named simulation events feeding §8.13 scenarios. */
  eventTags: string[]
  /** Lift sessions: exercises programmed that day. */
  exercises?: { exercise: LiftExercise; pctOf1rm: number; reps: number }[]
}

export type ParticipationLevel = 'full' | 'modified' | 'absent'

export interface SimParticipation {
  athleteId: string
  sessionId: string
  level: ParticipationLevel
  exposureMin: number // 0 when absent
}

export type AvailabilityStatus = 'full_go' | 'limited' | 'out'

export interface SimAvailabilityDay {
  athleteId: string
  date: string
  status: AvailabilityStatus
  note?: string
}

export interface GpsObservation {
  athleteId: string
  sessionId: string
  distanceYd: number
  highSpeedDistanceYd: number
  sprintDistanceYd: number
  highIntensityEvents: number
  yardsPerMinute: number
  sprints: number
  topSpeedMph: number
  accelerations: number
  decelerations: number
  playerLoadAu: number
  workload: number // 1.0–10.0, one decimal (real PlayerData exports are decimal)
}

export interface LiftObservation {
  athleteId: string
  sessionId: string
  exercise: LiftExercise
  topWorkingLoadLb: number
  reps: number
}

export interface PerchObservation {
  athleteId: string
  sessionId: string
  exercise: LiftExercise
  /** mean concentric power for BS/BP/TBD; peak power for Power Clean (W). */
  powerW: number
  metric: 'mean_concentric_power' | 'peak_power'
}

export interface SimDataset {
  generatorVersion: string
  seed: number
  seasonYear: number
  seasonStart: string
  seasonEnd: string
  athletes: SimAthlete[]
  sessions: SimSession[]
  availability: SimAvailabilityDay[]
  participation: SimParticipation[]
  gps: GpsObservation[]
  lifts: LiftObservation[]
  perch: PerchObservation[]
  /** athleteId → named §8.13 scenario(s) assigned to them. */
  scenarioAssignments: Record<string, string[]>
}
