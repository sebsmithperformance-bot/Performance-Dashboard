/**
 * TeamBuildr source-export adapter — PROVISIONAL layout (spec §8.1): no real
 * TeamBuildr export has been provided yet, so this column set is a fixture
 * shape, not a claim about production files. Only this adapter changes when
 * the real export arrives.
 */
import type { SimDataset } from '../types.ts'
import { toCsv, type CsvValue } from './csv.ts'
import type { NamedCsv } from './playerdata.ts'

export const TEAMBUILDR_HEADERS = [
  'Date',
  'Athlete',
  'Exercise',
  'Top Working Weight (lb)',
  'Reps',
] as const

/** Nickname aliases the identity-resolution flow must handle (§8.8, §8.11). */
const ALIASES: Record<string, string> = {
  Kendall: 'Kenny',
  Elizabeth: 'Liz',
  Campbell: 'Cam',
  Delaney: 'Laney',
}

function fullSeasonRows(ds: SimDataset, useAliases: boolean): CsvValue[][] {
  const athleteById = new Map(ds.athletes.map((a) => [a.id, a]))
  const sessionById = new Map(ds.sessions.map((s) => [s.id, s]))
  const aliasAthletes = new Set(
    ds.athletes
      .filter((a) => ALIASES[a.firstName])
      .slice(0, 2)
      .map((a) => a.id),
  )

  return ds.lifts.map((l) => {
    const athlete = athleteById.get(l.athleteId)!
    const session = sessionById.get(l.sessionId)!
    const first =
      useAliases && aliasAthletes.has(athlete.id)
        ? (ALIASES[athlete.firstName] ?? athlete.firstName)
        : athlete.firstName
    return [session.date, `${first} ${athlete.lastName}`, l.exercise, l.topWorkingLoadLb, l.reps]
  })
}

export function exportTeamBuildrSeason(ds: SimDataset): NamedCsv {
  return {
    filename: 'teambuildr_full_season.csv',
    content: toCsv(TEAMBUILDR_HEADERS, fullSeasonRows(ds, false)),
  }
}

/** Clean preseason fixture (§8.11 recommended set). */
export function exportTeamBuildrCleanPreseason(ds: SimDataset): NamedCsv {
  const phaseBySession = new Map(ds.sessions.map((s) => [s.id, s.phase]))
  const rows = fullSeasonRows(ds, false).filter(
    (_, i) => phaseBySession.get(ds.lifts[i]!.sessionId) === 'preseason',
  )
  return { filename: 'teambuildr_clean_preseason.csv', content: toCsv(TEAMBUILDR_HEADERS, rows) }
}

/** One in-season lift session with a deliberate exact-duplicate row + aliases. */
export function exportTeamBuildrDuplicateAndAlias(ds: SimDataset): NamedCsv {
  const target = ds.sessions.find((s) => s.kind === 'lift' && s.phase === 'in_season')!
  const indices = ds.lifts
    .map((l, i) => ({ l, i }))
    .filter(({ l }) => l.sessionId === target.id)
    .map(({ i }) => i)
  const all = fullSeasonRows(ds, true)
  const rows = indices.map((i) => all[i]!)
  if (rows.length > 0) rows.push([...rows[0]!]) // exact duplicate (§8.11: 1–3 cases)
  return {
    filename: 'teambuildr_duplicate_and_alias.csv',
    content: toCsv(TEAMBUILDR_HEADERS, rows),
  }
}

/** A later corrected value for an already-exported session (§8.8). */
export function exportTeamBuildrCorrection(ds: SimDataset): NamedCsv {
  const all = fullSeasonRows(ds, false)
  const rows = all.slice(0, 3).map((r) => [...r])
  if (rows[1]) rows[1][3] = (rows[1][3] as number) + 10 // the corrected load
  return { filename: 'teambuildr_corrections.csv', content: toCsv(TEAMBUILDR_HEADERS, rows) }
}
