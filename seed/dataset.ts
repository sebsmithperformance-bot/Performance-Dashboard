/**
 * Canonical simulation orchestrator (spec §8.1 layer 1): roster → calendar →
 * availability → participation → observations, in that order, so exposure
 * always precedes and explains load.
 */
import { addDays } from '../src/lib/calculations/series.ts'
import { generateAvailability } from './availability.ts'
import { generateCalendar } from './calendar.ts'
import { DEFAULT_SEED, GENERATOR_VERSION, RATES, SEASON_WEEKS } from './config.v1.ts'
import { generateGps } from './gps.ts'
import { generateParticipation } from './participation.ts'
import { generatePerch } from './perch.ts'
import { createRng } from './rng.ts'
import { generateRoster } from './roster.ts'
import { assignScenarios } from './scenario.ts'
import { generateStrength } from './strength.ts'
import type { SimDataset } from './types.ts'

export interface GeneratorOptions {
  seasonYear: number
  seed?: number
}

/** Season starts the second Monday of August (Aug 10 for 2026). */
export function seasonStartFor(year: number): string {
  const aug1 = new Date(Date.UTC(year, 7, 1))
  const dow = aug1.getUTCDay() // 0=Sun..6=Sat
  const firstMondayOffset = (8 - dow) % 7
  return addDays(`${year}-08-01`, firstMondayOffset + 7)
}

export function generateDataset(options: GeneratorOptions): SimDataset {
  const seed = options.seed ?? DEFAULT_SEED
  const rng = createRng(seed)

  const totalDays = (SEASON_WEEKS.preseason + SEASON_WEEKS.inSeason) * 7
  const seasonStart = seasonStartFor(options.seasonYear)
  const seasonEnd = addDays(seasonStart, totalDays - 1)

  const athletes = generateRoster(rng)
  const scenarioAssignments = assignScenarios(athletes)
  const sessions = generateCalendar(rng, seasonStart)
  const availability = generateAvailability(
    rng,
    athletes,
    scenarioAssignments,
    seasonStart,
    totalDays,
  )
  const participation = generateParticipation(rng, athletes, sessions, availability)
  const gps = generateGps(
    rng,
    athletes,
    sessions,
    participation,
    scenarioAssignments,
    RATES.gpsDeviceMissing,
  )
  const lifts = generateStrength(rng, athletes, sessions, participation, scenarioAssignments)
  const perch = generatePerch(rng, athletes, sessions, participation)

  return {
    generatorVersion: GENERATOR_VERSION,
    seed,
    seasonYear: options.seasonYear,
    seasonStart,
    seasonEnd,
    athletes,
    sessions,
    availability,
    participation,
    gps,
    lifts,
    perch,
    scenarioAssignments,
  }
}
