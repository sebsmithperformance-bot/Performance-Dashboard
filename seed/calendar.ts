/**
 * Season calendar (spec §8.4): 4 preseason + 13 in-season weeks with a
 * recognizable weekly rhythm and deliberately non-identical weeks. Named
 * events (overtime, weather-shortened, canceled session) are simulation
 * events placed here — never post-hoc row edits (§8.13).
 */
import { addDays } from '../src/lib/calculations/series.ts'
import { GAME_MINUTES, IN_SEASON_WEEK_PLAN, SEASON_WEEKS } from './config.v1.ts'
import type { Rng } from './rng.ts'
import type { LiftExercise, SimSession } from './types.ts'

type DayPlan = Omit<SimSession, 'id' | 'date' | 'weekIndex' | 'phase'> & { dayOfWeek: number }

const LIFTS: Record<'A' | 'B' | 'C', LiftExercise[]> = {
  A: ['Back Squat', 'Trap Bar Deadlift', 'Power Clean'],
  B: ['Bench Press', 'Power Clean'],
  C: ['Back Squat', 'Bench Press', 'Trap Bar Deadlift'],
}

function lift(
  block: 'A' | 'B' | 'C',
  dayOfWeek: number,
  pct: number,
  reps: number,
  eventTags: string[] = [],
): DayPlan {
  return {
    dayOfWeek,
    startTime: '16:00',
    label: `Lift ${block}`,
    type: 'lift',
    kind: 'lift',
    plannedIntensity: pct,
    plannedDurationMin: 60,
    eventTags,
    exercises: LIFTS[block].map((exercise) => ({
      exercise,
      // Power Clean stays moderate and fast (§8.8): cap its percentage
      pctOf1rm: exercise === 'Power Clean' ? Math.min(pct, 0.76) : pct,
      reps: exercise === 'Power Clean' ? Math.min(reps, 3) : reps,
    })),
  }
}

function field(
  label: string,
  dayOfWeek: number,
  type: 'practice' | 'game' | 'recovery',
  intensity: number,
  durationMin: number,
  startTime = '07:30',
  eventTags: string[] = [],
): DayPlan {
  return {
    dayOfWeek,
    startTime,
    label,
    type,
    kind: 'field',
    plannedIntensity: intensity,
    plannedDurationMin: durationMin,
    eventTags,
  }
}

/** Preseason week: 5–6 field sessions, 3 lifts, 0–1 scrimmage, recovery + rest. */
function preseasonWeek(week: number): DayPlan[] {
  // Progressive field-load ramp W1→W3; W4 demanding but reduced volume (§8.4)
  const intensityRamp = [0.92, 1.0, 1.08, 1.05][week] ?? 1
  const volumeRamp = [0.92, 1.0, 1.1, 0.85][week] ?? 1
  const liftPct = [0.7, 0.72, 0.77, 0.82][week] ?? 0.75
  const liftReps = [9, 8, 5, 4][week] ?? 6

  const days: DayPlan[] = [
    field('AM Practice', 0, 'practice', 0.88 * intensityRamp, Math.round(100 * volumeRamp)),
    lift('A', 0, liftPct, liftReps),
    field('AM Practice', 1, 'practice', 0.78 * intensityRamp, Math.round(90 * volumeRamp)),
    field('AM Practice', 2, 'practice', 0.9 * intensityRamp, Math.round(105 * volumeRamp)),
    lift('B', 2, liftPct, liftReps),
    field('Recovery Session', 3, 'recovery', 0.45, 60),
    field('AM Practice', 4, 'practice', 0.8 * intensityRamp, Math.round(95 * volumeRamp)),
    lift('C', 4, liftPct, liftReps),
  ]
  if (week >= 1) {
    days.push(field('Scrimmage', 5, 'practice', 0.97, week === 3 ? 65 : 75, '10:00'))
  } else {
    days.push(field('AM Practice', 5, 'practice', 0.75, 85, '09:00'))
  }
  return days // Sunday: full rest
}

function inSeasonWeek(archetype: string, events: string[]): DayPlan[] {
  const has = (e: string) => events.includes(e)
  const gameTags = has('overtime_game') ? ['overtime_game'] : []

  switch (archetype) {
    case 'one_game': {
      const tue = has('weather_shortened')
        ? field('Practice', 1, 'practice', 0.88, 40, '15:30', ['weather_shortened'])
        : field('Practice', 1, 'practice', 0.88, 90, '15:30')
      const days = [
        lift('A', 0, 0.82, 3),
        field('Practice', 0, 'practice', 0.72, 75, '15:30'),
        tue,
        field('Practice', 3, 'practice', 0.68, 70, '15:30'),
        field('Game', 4, 'game', 1.0, GAME_MINUTES, '18:00', gameTags),
        field('Recovery Session', 5, 'recovery', 0.42, 45, '10:00'),
      ]
      if (!has('session_canceled')) {
        days.splice(3, 0, field('Practice', 2, 'practice', 0.78, 80, '15:30'))
        days.splice(4, 0, lift('B', 2, 0.75, 4))
      } else {
        // canceled Wednesday practice: lift moves to Thursday, field day is lost
        days.splice(3, 0, lift('B', 3, 0.75, 4))
      }
      return days
    }
    case 'two_game':
    case 'travel_two_game': {
      const travel = archetype === 'travel_two_game'
      return [
        field('Recovery Session', 0, 'recovery', 0.4, 40, '15:30'),
        lift('A', 0, 0.8, 3),
        field('Practice', 1, 'practice', 0.82, 85, '15:30'),
        field('Practice', 2, 'practice', 0.75, travel ? 65 : 75, '15:30'),
        lift('B', 3, 0.72, 4),
        ...(travel ? [] : [field('Practice', 3, 'practice', 0.62, 60, '15:30')]),
        field('Game', 4, 'game', 1.0, GAME_MINUTES, '18:00', gameTags),
        field('Recovery Session', 5, 'recovery', 0.38, travel ? 35 : 40, '10:00'),
        field('Game', 6, 'game', 1.0, GAME_MINUTES, '13:00'),
      ]
    }
    case 'light_academic':
      return [
        lift('A', 0, 0.78, 4),
        field('Practice', 1, 'practice', 0.75, 75, '15:30'),
        field('Practice', 2, 'practice', 0.6, 60, '15:30'),
        lift('B', 3, 0.72, 4),
        field('Practice', 4, 'practice', 0.78, 80, '15:30'),
      ]
    case 'deload':
      return [
        lift('A', 0, 0.65, 5),
        field('Practice', 1, 'practice', 0.6, 60, '15:30'),
        field('Recovery Session', 2, 'recovery', 0.4, 40, '15:30'),
        field('Practice', 3, 'practice', 0.68, 70, '15:30'),
        field('Game', 4, 'game', 1.0, GAME_MINUTES, '18:00'),
        field('Recovery Session', 5, 'recovery', 0.38, 40, '10:00'),
      ]
    default:
      throw new Error(`Unknown week archetype: ${archetype}`)
  }
}

export function generateCalendar(rng: Rng, seasonStart: string): SimSession[] {
  const sessions: SimSession[] = []
  const jitter = rng.fork('calendar')
  const totalWeeks = SEASON_WEEKS.preseason + SEASON_WEEKS.inSeason

  for (let week = 0; week < totalWeeks; week += 1) {
    const preseason = week < SEASON_WEEKS.preseason
    const plan = preseason
      ? preseasonWeek(week)
      : inSeasonWeek(
          IN_SEASON_WEEK_PLAN[week - SEASON_WEEKS.preseason]?.archetype ?? 'one_game',
          IN_SEASON_WEEK_PLAN[week - SEASON_WEEKS.preseason]?.events ?? [],
        )

    const byDay = new Map<number, number>()
    for (const day of plan) {
      const seq = (byDay.get(day.dayOfWeek) ?? 0) + 1
      byDay.set(day.dayOfWeek, seq)
      const date = addDays(seasonStart, week * 7 + day.dayOfWeek)
      const { dayOfWeek: _dow, ...rest } = day
      sessions.push({
        ...rest,
        id: `S-${date}-${rest.kind === 'lift' ? 'L' : 'F'}${seq}`,
        date,
        weekIndex: week,
        phase: preseason ? 'preseason' : 'in_season',
        // small per-session wobble so no two weeks are numerically identical
        plannedIntensity:
          Math.round(rest.plannedIntensity * (1 + jitter.normal(0, 0.02)) * 100) / 100,
        label: rest.type === 'game' ? `${rest.label} W${week + 1}` : rest.label,
      })
    }
  }
  return sessions.sort((a, b) =>
    a.date === b.date ? a.startTime.localeCompare(b.startTime) : a.date.localeCompare(b.date),
  )
}
