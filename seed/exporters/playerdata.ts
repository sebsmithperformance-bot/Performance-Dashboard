/**
 * PlayerData source-export adapter (spec §8.1 layer 2). Header set matches
 * the real export documented in docs/import-sources/playerdata.md, with one
 * provisional addition: an `Athlete` column, since the real name-bearing
 * export variant is still an open question for the coach. Dates live in the
 * filename, exactly like the real "Single-Session Report 16 Apr 26.csv".
 */
import type { GpsObservation, SimAthlete, SimDataset, SimSession } from '../types.ts'
import { playerDataDate, toCsv, type CsvValue } from './csv.ts'

export const PLAYERDATA_HEADERS = [
  'Athlete',
  'Group',
  'Distance',
  'Session Load',
  'Workload',
  'Sprint Distance',
  'High Intensity Running',
  'No. of High Intensity Events',
  'Yards per Minute',
  'No. of Sprints',
  'Top Speed',
  'Accelerations',
  'Decelerations',
] as const

const GROUP_NAME: Record<SimAthlete['position'], string> = {
  Goalkeeper: 'Goalkeepers',
  Defender: 'Defenders',
  Midfielder: 'Midfielders',
  Forward: 'Forwards',
}

function rowFor(athlete: SimAthlete, g: GpsObservation, group?: string): CsvValue[] {
  return [
    `${athlete.firstName} ${athlete.lastName}`,
    group ?? GROUP_NAME[athlete.position],
    g.distanceYd,
    g.playerLoadAu,
    g.workload,
    g.sprintDistanceYd,
    g.highSpeedDistanceYd,
    g.highIntensityEvents,
    g.yardsPerMinute,
    g.sprints,
    g.topSpeedMph,
    g.accelerations,
    g.decelerations,
  ]
}

export interface NamedCsv {
  filename: string
  content: string
}

/** One file per field session, named like the real single-session reports. */
export function exportPlayerDataSessions(ds: SimDataset): NamedCsv[] {
  const athleteById = new Map(ds.athletes.map((a) => [a.id, a]))
  const files: NamedCsv[] = []
  const fieldSessions = ds.sessions.filter((s) => s.kind === 'field')
  const byDateSeq = new Map<string, number>()

  for (const session of fieldSessions) {
    const rows = ds.gps
      .filter((g) => g.sessionId === session.id)
      .map((g) => rowFor(athleteById.get(g.athleteId)!, g))
    if (rows.length === 0) continue
    const seq = (byDateSeq.get(session.date) ?? 0) + 1
    byDateSeq.set(session.date, seq)
    const suffix = seq > 1 ? ` (${seq})` : ''
    files.push({
      filename: `Single-Session Report ${playerDataDate(session.date)}${suffix}.csv`,
      content: toCsv(PLAYERDATA_HEADERS, rows),
    })
  }
  return files
}

/**
 * Duplicate-hazard fixture reproducing the real sectioned report: position
 * section first, then the team-wide "Penn FH" section repeating the same
 * athletes, then a `None` section (§8.11 deliberate problem fixture).
 */
export function exportPlayerDataSectionedHazard(ds: SimDataset, session: SimSession): NamedCsv {
  const athleteById = new Map(ds.athletes.map((a) => [a.id, a]))
  const gps = ds.gps.filter((g) => g.sessionId === session.id)
  const forwards = gps.filter((g) => athleteById.get(g.athleteId)!.position === 'Forward')
  const rows: CsvValue[][] = [
    ...forwards.map((g) => rowFor(athleteById.get(g.athleteId)!, g)),
    ...gps.map((g) => rowFor(athleteById.get(g.athleteId)!, g, 'Penn FH')),
    ...gps.slice(0, 2).map((g) => rowFor(athleteById.get(g.athleteId)!, g, 'None')),
  ]
  return {
    filename: 'playerdata_sectioned_duplicates.csv',
    content: toCsv(PLAYERDATA_HEADERS, rows),
  }
}

/**
 * Multi-session variant with explicit Date/Session columns (provisional): the
 * clean-game-week and missing-device fixtures need session identity inside
 * the file because they span several sessions.
 */
export function exportPlayerDataWeek(
  ds: SimDataset,
  weekIndex: number,
  filename: string,
): NamedCsv {
  const athleteById = new Map(ds.athletes.map((a) => [a.id, a]))
  const sessions = ds.sessions.filter((s) => s.kind === 'field' && s.weekIndex === weekIndex)
  const rows: CsvValue[][] = []
  for (const session of sessions) {
    for (const g of ds.gps.filter((x) => x.sessionId === session.id)) {
      rows.push([session.date, session.label, ...rowFor(athleteById.get(g.athleteId)!, g)])
    }
  }
  return { filename, content: toCsv(['Date', 'Session', ...PLAYERDATA_HEADERS], rows) }
}
