/**
 * Perch source-export adapter — PROVISIONAL layout (spec §8.1): no real Perch
 * export has been provided yet. Perch remains a fully independent source:
 * these files never borrow TeamBuildr rows (§1, §8.9).
 */
import type { SimDataset } from '../types.ts'
import { toCsv, type CsvValue } from './csv.ts'
import type { NamedCsv } from './playerdata.ts'

export const PERCH_HEADERS = ['Date', 'Athlete', 'Exercise', 'Metric', 'Power (W)'] as const

function rows(ds: SimDataset): CsvValue[][] {
  const athleteById = new Map(ds.athletes.map((a) => [a.id, a]))
  const sessionById = new Map(ds.sessions.map((s) => [s.id, s]))
  return ds.perch.map((p) => {
    const athlete = athleteById.get(p.athleteId)!
    const session = sessionById.get(p.sessionId)!
    return [
      session.date,
      `${athlete.firstName} ${athlete.lastName}`,
      p.exercise,
      p.metric === 'peak_power' ? 'Peak Power' : 'Mean Concentric Power',
      p.powerW,
    ]
  })
}

export function exportPerchSeason(ds: SimDataset): NamedCsv {
  return { filename: 'perch_full_season.csv', content: toCsv(PERCH_HEADERS, rows(ds)) }
}

/** Clean one-week fixture (§8.11 recommended set). */
export function exportPerchCleanPower(ds: SimDataset, weekIndex: number): NamedCsv {
  const sessionById = new Map(ds.sessions.map((s) => [s.id, s]))
  const weekRows = rows(ds).filter(
    (_, i) => sessionById.get(ds.perch[i]!.sessionId)!.weekIndex === weekIndex,
  )
  return { filename: 'perch_clean_power.csv', content: toCsv(PERCH_HEADERS, weekRows) }
}

/**
 * Deliberate problems (§8.11): a renamed power header, an unmapped extra
 * column, and a few blank readings.
 */
export function exportPerchUnmappedAndBlank(ds: SimDataset, weekIndex: number): NamedCsv {
  const sessionById = new Map(ds.sessions.map((s) => [s.id, s]))
  const weekRows = rows(ds)
    .filter((_, i) => sessionById.get(ds.perch[i]!.sessionId)!.weekIndex === weekIndex)
    .map((r, i) => {
      const withVelocity: CsvValue[] = [...r, Math.round((0.4 + (i % 7) * 0.05) * 100) / 100]
      if (i % 9 === 4) withVelocity[4] = null // blank/invalid reading
      return withVelocity
    })
  return {
    filename: 'perch_unmapped_header_and_blank.csv',
    content: toCsv(
      ['Date', 'Athlete', 'Exercise', 'Metric', 'Mean Con Power (W)', 'Bar Velocity (m/s)'],
      weekRows,
    ),
  }
}

/** Same lift session exported from both sources (§8.11 cross-source fixture). */
export function exportCrossSourceSameSession(ds: SimDataset): NamedCsv[] {
  const target = ds.sessions.find(
    (s) =>
      s.kind === 'lift' && s.phase === 'in_season' && ds.perch.some((p) => p.sessionId === s.id),
  )!
  const athleteById = new Map(ds.athletes.map((a) => [a.id, a]))

  const tbRows: CsvValue[][] = ds.lifts
    .filter((l) => l.sessionId === target.id)
    .map((l) => {
      const a = athleteById.get(l.athleteId)!
      return [target.date, `${a.firstName} ${a.lastName}`, l.exercise, l.topWorkingLoadLb, l.reps]
    })
  const perchRows: CsvValue[][] = ds.perch
    .filter((p) => p.sessionId === target.id)
    .map((p) => {
      const a = athleteById.get(p.athleteId)!
      return [
        target.date,
        `${a.firstName} ${a.lastName}`,
        p.exercise,
        p.metric === 'peak_power' ? 'Peak Power' : 'Mean Concentric Power',
        p.powerW,
      ]
    })

  return [
    {
      filename: 'cross_source_same_session_teambuildr.csv',
      content: toCsv(['Date', 'Athlete', 'Exercise', 'Top Working Weight (lb)', 'Reps'], tbRows),
    },
    {
      filename: 'cross_source_same_session_perch.csv',
      content: toCsv(PERCH_HEADERS, perchRows),
    },
  ]
}
