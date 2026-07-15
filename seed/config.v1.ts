/**
 * Versioned generator configuration (spec §8.2). Changing behavior means a new
 * config version or an explicit calibration edit here — never scattered magic
 * numbers. Ranges marked "provisional" mirror §8.7–8.9 and get re-calibrated
 * from de-identified aggregates when real exports arrive (§8.14).
 */
import type { LiftExercise, Position, RosterRole, SessionType } from './types.ts'

export const GENERATOR_VERSION = '1.0.0'
export const DEFAULT_SEED = 20260801

export interface PositionPlan {
  position: Position
  count: number
  roles: RosterRole[]
}

/** §8.3 — exactly 25 athletes. */
export const ROSTER_PLAN: PositionPlan[] = [
  {
    position: 'Goalkeeper',
    count: 3,
    roles: ['starter', 'rotation', 'developmental'],
  },
  {
    position: 'Defender',
    count: 7,
    roles: ['starter', 'starter', 'starter', 'starter', 'rotation', 'rotation', 'developmental'],
  },
  {
    position: 'Midfielder',
    count: 8,
    roles: [
      'starter',
      'starter',
      'starter',
      'starter',
      'rotation',
      'rotation',
      'rotation',
      'developmental',
    ],
  },
  {
    position: 'Forward',
    count: 7,
    roles: ['starter', 'starter', 'starter', 'rotation', 'rotation', 'rotation', 'developmental'],
  },
]

/** Entirely fictional name pools (§8, never derived from real athletes). */
export const FIRST_NAMES = [
  'Avery',
  'Blair',
  'Campbell',
  'Delaney',
  'Emerson',
  'Finley',
  'Greer',
  'Harlow',
  'Indigo',
  'Juniper',
  'Kendall',
  'Lennox',
  'Marlowe',
  'Noa',
  'Oakley',
  'Palmer',
  'Quinn',
  'Rowan',
  'Sutton',
  'Tatum',
  'Umber',
  'Vale',
  'Winslow',
  'Xiomara',
  'Yardley',
  'Zephyr',
  'Arden',
  'Briar',
  'Collins',
  'Darby',
] as const

export const LAST_NAMES = [
  'Ashcombe',
  'Birchwood',
  'Calloway',
  'Dunmore',
  'Ellsworth',
  'Fairbanks',
  'Granthem',
  'Holloway',
  'Ingleside',
  'Jessup',
  'Kirkbride',
  'Lockhart',
  'Merriweather',
  'Northgate',
  'Oakhurst',
  'Pemberly',
  'Quillfeather',
  'Ravenscroft',
  'Silverton',
  'Thornbury',
  'Underhill',
  'Vandermeer',
  'Wexford',
  'Yarrowe',
  'Zellwood',
  'Abernathy',
  'Bellamy',
  'Crowhurst',
  'Danforth',
  'Everhart',
] as const

/** §8.3 fictional roster ranges (outfield / goalkeeper). */
export const TRAIT_RANGES = {
  heightIn: { outfield: [61, 72], goalkeeper: [64, 73] },
  bodyMassLb: { outfield: [120, 185], goalkeeper: [135, 195] },
  yearsOnTeam: [1, 4],
  trainingAgeYr: [1, 6],
  topSpeedCapacityMph: { outfield: [15.0, 20.0], goalkeeper: [12.0, 16.5] },
} as const

/** §8.4 — 4 preseason + 13 in-season weeks; Monday season start. */
export const SEASON_WEEKS = { preseason: 4, inSeason: 13 } as const

/**
 * In-season week archetypes in order (weeks 5–17). Named events feed the
 * §8.13 visual scenarios and are simulation events, not post-hoc row edits.
 */
export const IN_SEASON_WEEK_PLAN: {
  archetype: 'one_game' | 'two_game' | 'travel_two_game' | 'light_academic' | 'deload'
  events?: ('overtime_game' | 'weather_shortened' | 'session_canceled')[]
}[] = [
  { archetype: 'one_game' },
  { archetype: 'two_game' },
  { archetype: 'one_game', events: ['overtime_game'] },
  { archetype: 'travel_two_game' },
  { archetype: 'light_academic' },
  { archetype: 'two_game' },
  { archetype: 'one_game', events: ['weather_shortened'] },
  { archetype: 'two_game' },
  { archetype: 'one_game', events: ['session_canceled'] },
  { archetype: 'two_game' },
  { archetype: 'one_game' },
  { archetype: 'deload' },
  { archetype: 'two_game' },
]

/** §8.7 provisional plausible session ranges (typical, hard bound) — outfield. */
export const GPS_BOUNDS_OUTFIELD: Record<
  'recovery' | 'normal' | 'high' | 'game',
  {
    distance: [number, number]
    hsd: [number, number]
    load: [number, number]
    top: [number, number]
    sprints: [number, number]
    acc: [number, number]
    dec: [number, number]
  }
> = {
  recovery: {
    distance: [800, 2800],
    hsd: [0, 180],
    load: [50, 220],
    top: [10, 16],
    sprints: [0, 5],
    acc: [3, 25],
    dec: [3, 25],
  },
  normal: {
    distance: [2500, 5500],
    hsd: [100, 550],
    load: [180, 480],
    top: [13, 18.5],
    sprints: [2, 14],
    acc: [15, 50],
    dec: [15, 55],
  },
  high: {
    distance: [4000, 7500],
    hsd: [250, 900],
    load: [350, 700],
    top: [14, 19.5],
    sprints: [8, 24],
    acc: [30, 75],
    dec: [30, 80],
  },
  game: {
    distance: [2000, 7500],
    hsd: [100, 1000],
    load: [180, 700],
    top: [13, 20],
    sprints: [2, 25],
    acc: [10, 75],
    dec: [10, 80],
  },
}

export const GPS_HARD_BOUND_OUTFIELD = {
  distance: 9000,
  hsd: 1300,
  load: 850,
  top: 21,
  sprints: 35,
  acc: 90,
  dec: 95,
} as const

export const GPS_HARD_BOUND_GK = {
  distance: 2500,
  hsd: 150,
  load: 350,
  top: 17,
  sprints: 8,
  acc: 50,
  dec: 50,
} as const

/** §8.8 latent estimated 1RM ranges (typical, hard fictional bound), lb. */
export const E1RM_RANGES: Record<
  LiftExercise,
  { typical: [number, number]; hard: [number, number] }
> = {
  'Back Squat': { typical: [145, 245], hard: [95, 300] },
  'Bench Press': { typical: [75, 135], hard: [45, 175] },
  'Trap Bar Deadlift': { typical: [185, 335], hard: [125, 405] },
  'Power Clean': { typical: [75, 145], hard: [45, 185] },
}

/** §8.9 Perch power ranges (typical, hard fictional bound), watts. */
export const PERCH_RANGES: Record<
  LiftExercise,
  { typical: [number, number]; hard: [number, number] }
> = {
  'Back Squat': { typical: [300, 850], hard: [150, 1100] },
  'Bench Press': { typical: [140, 420], hard: [75, 600] },
  'Trap Bar Deadlift': { typical: [450, 1200], hard: [250, 1600] },
  'Power Clean': { typical: [650, 1650], hard: [350, 2100] },
}

/** §8.11 missingness / data-quality target rates. */
export const RATES = {
  gpsDeviceMissing: 0.03, // 2–4% of expected GPS exposures
  perchMissing: 0.11, // 8–15% of eligible lift sessions
  teamBuildrValueMissing: 0.035, // 2–5% of expected lift values
  practiceAbsenceBase: 0.02, // scaled by (1 − attendanceReliability)
} as const

/** Game length: field hockey 4×15min quarters. */
export const GAME_MINUTES = 60

export const SESSION_TYPES_WITH_GPS: SessionType[] = ['practice', 'game', 'recovery']

/**
 * §8.13 named scenario→athlete assignment rules, resolved deterministically
 * after roster generation. Selector semantics live in scenario.ts.
 */
export const SCENARIO_RULES = [
  { scenario: 'speed_flag_legit', selector: 'forward_starter_0' },
  { scenario: 'insufficient_speed_baseline', selector: 'developmental_lowest_minutes' },
  { scenario: 'return_from_low_exposure', selector: 'midfielder_rotation_0' },
  { scenario: 'preseason_strength_improver', selector: 'defender_youngest' },
  { scenario: 'strength_plateau', selector: 'defender_oldest' },
  { scenario: 'reduced_in_season_lifts', selector: 'forward_rotation_0' },
  { scenario: 'device_missing_cluster', selector: 'midfielder_starter_1' },
] as const
