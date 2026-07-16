/**
 * Pure pipeline tests (no database): adapters against the committed fixtures,
 * source detection, athlete/session resolution, and preview classification.
 */
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { ADAPTERS, detectSource } from '../../src/lib/import/adapters/index.ts'
import { parseCsv } from '../../src/lib/import/csv.ts'
import { normalizeKey } from '../../src/lib/import/normalize.ts'
import { resolveAthletes } from '../../src/lib/import/resolve-athletes.ts'
import { resolveSessions } from '../../src/lib/import/resolve-sessions.ts'
import { buildPreview } from '../../src/lib/import/validate.ts'
import type { Source } from '../../src/lib/import/types.ts'
import { fixturesDir, NO_DECISIONS, stubContext } from './helpers.ts'

async function fixture(name: string): Promise<string> {
  return readFile(path.join(fixturesDir, name), 'utf8')
}

function stageFixture(source: Source, text: string, filename: string, names: string[]) {
  const context = stubContext(source, names)
  const stage = ADAPTERS[source].stage({
    text,
    filename,
    mappings: context.mappings,
    ignoredHeaders: new Set(),
    kpis: context.kpis,
  })
  return { context, stage }
}

/** Unique athlete names appearing in a fixture (its Athlete column). */
function namesIn(text: string): string[] {
  const parsed = parseCsv(text)
  return [...new Set(parsed.rows.map((r) => r['Athlete'] ?? '').filter((n) => n !== ''))]
}

describe('source detection (§4.2: suggestion only)', () => {
  it('recognizes each fixture family', async () => {
    const pd = parseCsv(await fixture('playerdata_clean_game_week.csv'))
    const tb = parseCsv(await fixture('teambuildr_clean_preseason.csv'))
    const perch = parseCsv(await fixture('perch_clean_power.csv'))
    expect(detectSource(pd.headers)?.source).toBe('PlayerData')
    expect(detectSource(tb.headers)?.source).toBe('TeamBuildr')
    expect(detectSource(perch.headers)?.source).toBe('Perch')
    expect(detectSource(['Foo', 'Bar'])).toBeNull()
  })
})

describe('PlayerData adapter (provisional)', () => {
  it('stages observations for every mapped metric column', async () => {
    const text = await fixture('playerdata_clean_game_week.csv')
    const { stage } = stageFixture(
      'PlayerData',
      text,
      'playerdata_clean_game_week.csv',
      namesIn(text),
    )
    expect(stage.staged.length).toBeGreaterThan(500)
    expect(stage.unmappedHeaders).toEqual([])
    // raw source rows preserved on every staged record
    expect(stage.staged[0]!.raw['Athlete']).toBeTruthy()
  })

  it('skips section-duplicated athlete rows instead of double-staging (real hazard)', async () => {
    const text = await fixture('playerdata_sectioned_duplicates.csv')
    // single-session report style: the date rides on the filename
    const { stage } = stageFixture(
      'PlayerData',
      text,
      'Single-Session Report 21 Sep 26.csv',
      namesIn(text),
    )
    const dupSkips = stage.skipped.filter((s) => s.reason.includes('another report section'))
    expect(dupSkips.length).toBeGreaterThan(0)
    // every staged (athlete, kpi) pair is unique for the single session
    const keys = stage.staged.map((s) => `${normalizeKey(s.athlete.rawName)}|${s.kpiKey}`)
    expect(new Set(keys).size).toBe(keys.length)
  })

  it('hard-errors the real name-less export variant instead of guessing', async () => {
    const text = await fixture('playerdata_single_session_report.csv')
    const { stage } = stageFixture('PlayerData', text, 'Single-Session Report 16 Apr 26.csv', [])
    expect(stage.staged).toEqual([])
    expect(stage.skipped.every((s) => s.severity === 'error')).toBe(true)
    expect(stage.skipped[0]!.reason).toMatch(/no athlete identifier column/)
  })

  it('derives the session date from the filename when no Date column exists', () => {
    const csv = 'Athlete,Distance,Session Load\nQuinn Test,4100,430\n'
    const { stage } = stageFixture('PlayerData', csv, 'Single-Session Report 14 Aug 26.csv', [
      'Quinn Test',
    ])
    expect(stage.staged[0]!.session.date).toBe('2026-08-14')
    expect(stage.staged[0]!.warnings.join(' ')).toMatch(/derived from filename/)
  })

  it('treats blank cells as no-observation with a warning — never zero (§4.3)', () => {
    const csv = 'Athlete,Date,Session,Distance,Session Load\nQuinn Test,2026-09-01,Practice,,0\n'
    const { stage } = stageFixture('PlayerData', csv, 'x.csv', ['Quinn Test'])
    const kpis = stage.staged.map((s) => s.kpiKey)
    expect(kpis).toEqual(['player_load']) // Distance blank → nothing staged
    expect(stage.staged[0]!.valueCanonical).toBe(0) // explicit 0 is a real value
    expect(stage.staged[0]!.warnings.join(' ')).toMatch(/blank Distance/)
  })
})

describe('TeamBuildr adapter (provisional)', () => {
  it('routes exercises through mappings and reports unmapped exercises', () => {
    const csv =
      'Date,Athlete,Exercise,Top Working Weight (lb),Reps\n' +
      '2026-09-07,Quinn Test,Back Squat,165,3\n' +
      '2026-09-07,Quinn Test,Nordic Curl,45,5\n'
    const { stage } = stageFixture('TeamBuildr', csv, 'tb.csv', ['Quinn Test'])
    expect(stage.staged.map((s) => s.kpiKey)).toEqual(['back_squat_top_load'])
    expect(stage.unmappedHeaders).toEqual(['Nordic Curl'])
    expect(stage.skipped.some((s) => s.reason.includes('unmapped exercise'))).toBe(true)
  })

  it('flags missing completed values as warnings, not zeros', () => {
    const csv =
      'Date,Athlete,Exercise,Top Working Weight (lb),Reps\n2026-09-07,Quinn Test,Back Squat,,3\n'
    const { stage } = stageFixture('TeamBuildr', csv, 'tb.csv', ['Quinn Test'])
    expect(stage.staged).toEqual([])
    expect(stage.skipped[0]!.reason).toMatch(/no completed value/)
    expect(stage.skipped[0]!.severity).toBe('warning')
  })
})

describe('Perch adapter (provisional)', () => {
  it('handles the renamed power header + extra unmapped column fixture', async () => {
    const text = await fixture('perch_unmapped_header_and_blank.csv')
    const { stage } = stageFixture(
      'Perch',
      text,
      'perch_unmapped_header_and_blank.csv',
      namesIn(text),
    )
    expect(stage.unmappedHeaders).toContain('Bar Velocity (m/s)')
    expect(stage.staged[0]!.warnings.join(' ')).toMatch(/nonstandard power column/)
    expect(stage.skipped.some((s) => s.reason.includes('blank power reading'))).toBe(true)
  })
})

describe('athlete resolution ladder (§4.2 step 4)', () => {
  it('suggests fuzzy candidates for aliases but never matches them', async () => {
    const text = await fixture('teambuildr_duplicate_and_alias.csv')
    const rosterNames = namesIn(await fixture('teambuildr_clean_preseason.csv'))
    const { context, stage } = stageFixture('TeamBuildr', text, 'alias.csv', rosterNames)
    const items = resolveAthletes(stage.staged, context, NO_DECISIONS)

    // the fixture aliases the athletes present in that one lift session
    const suggested = items.filter((i) => i.resolution.status === 'suggested')
    expect(suggested.length).toBeGreaterThanOrEqual(1) // Laney/Cam/Kenny-style aliases
    for (const item of suggested) {
      expect(item.resolution.status).toBe('suggested')
      // and the top candidate shares the alias's last name
      const lastName = item.rawName.split(' ').pop()!
      const top = (item.resolution as { candidates: { name: string }[] }).candidates[0]!
      expect(top.name.endsWith(lastName)).toBe(true)
    }
    // preview must classify their rows as blocking errors until decided
    const sessions = resolveSessions(stage.staged, context, NO_DECISIONS)
    const preview = buildPreview(stage, context, items, sessions, [], 'skip_existing')
    expect(preview.canCommit).toBe(false)
    expect(preview.blockReasons.join(' ')).toMatch(/unresolved athlete/)
  })

  it('prefers identity mapping over exact name, and external id over both', () => {
    const context = stubContext('TeamBuildr', ['Avery Ashcombe'])
    context.identities.push(
      { athleteId: 'A1', externalId: null, rawNameNormalized: 'ave ashcombe' },
      { athleteId: 'A1', externalId: 'TB-77', rawNameNormalized: 'x' },
    )
    const staged = [
      { athlete: { rawName: 'Ave  Ashcombe' } },
      { athlete: { rawName: 'Avery Ashcombe' } },
      { athlete: { rawName: 'whoever', externalId: 'TB-77' } },
    ].map((s, i) => ({
      sourceRowNumber: i + 2,
      raw: {},
      athlete: s.athlete,
      session: { date: '2026-09-07', label: 'Lift Session', type: 'lift' as const },
      kpiKey: 'back_squat_top_load',
      rawHeader: 'Back Squat',
      rawValue: '100',
      valueCanonical: 100,
      canonicalUnit: 'lb' as const,
      warnings: [],
    }))
    const items = resolveAthletes(staged, context, NO_DECISIONS)
    const byName = new Map(items.map((i) => [i.rawName, i]))
    expect(byName.get('Ave  Ashcombe')!.resolution).toMatchObject({ via: 'identity' })
    expect(byName.get('Avery Ashcombe')!.resolution).toMatchObject({ via: 'exact_name' })
    expect(byName.get('whoever')!.resolution).toMatchObject({ via: 'external_id' })
  })
})

describe('session resolution (§4.2 step 3)', () => {
  it('keeps multiple sessions on the same date separate', () => {
    const csv =
      'Athlete,Date,Session,Distance\n' +
      'Quinn Test,2026-09-01,AM Practice,4000\n' +
      'Quinn Test,2026-09-01,PM Practice,2000\n'
    const { context, stage } = stageFixture('PlayerData', csv, 'x.csv', ['Quinn Test'])
    const sessions = resolveSessions(stage.staged, context, NO_DECISIONS)
    expect(sessions).toHaveLength(2)
    expect(new Set(sessions.map((s) => s.refKey)).size).toBe(2)
  })

  it('marks same-date/type collisions ambiguous instead of guessing', () => {
    const context = stubContext('Perch', ['Quinn Test'])
    context.sessions.push(
      {
        id: 'S1',
        date: '2026-09-07',
        startTime: '07:00',
        label: 'AM Lift',
        type: 'lift',
        source: 'TeamBuildr',
        sourceExternalId: null,
      },
      {
        id: 'S2',
        date: '2026-09-07',
        startTime: '16:00',
        label: 'PM Lift',
        type: 'lift',
        source: 'TeamBuildr',
        sourceExternalId: null,
      },
    )
    const staged = [
      {
        sourceRowNumber: 2,
        raw: {},
        athlete: { rawName: 'Quinn Test' },
        session: { date: '2026-09-07', label: 'Lift Session', type: 'lift' as const },
        kpiKey: 'back_squat_mean_power',
        rawHeader: 'Back Squat',
        rawValue: '500',
        valueCanonical: 500,
        canonicalUnit: 'W' as const,
        warnings: [],
      },
    ]
    const items = resolveSessions(staged, context, NO_DECISIONS)
    expect(items[0]!.resolution.status).toBe('ambiguous')
    const athletes = resolveAthletes(staged, context, NO_DECISIONS)
    const preview = buildPreview(
      { source: 'Perch', staged, skipped: [], unmappedHeaders: [], rowCount: 1 },
      context,
      athletes,
      items,
      [],
      'skip_existing',
    )
    expect(preview.canCommit).toBe(false)
    expect(preview.blockReasons.join(' ')).toMatch(/ambiguous session/)
  })
})

describe('validation classification', () => {
  it('errors values outside the configured KPI valid range', () => {
    const csv = 'Athlete,Date,Session,Workload\nQuinn Test,2026-09-01,Practice,15\n'
    const { context, stage } = stageFixture('PlayerData', csv, 'x.csv', ['Quinn Test'])
    const preview = buildPreview(
      stage,
      context,
      resolveAthletes(stage.staged, context, NO_DECISIONS),
      resolveSessions(stage.staged, context, NO_DECISIONS),
      [],
      'skip_existing',
    )
    const errorRow = preview.rows.find((r) => r.action === 'error')!
    expect(errorRow.notes.join(' ')).toMatch(/outside valid range/)
    expect(preview.canCommit).toBe(false)
  })

  it('collapses exact duplicate rows into one insert + one warned skip', async () => {
    const text = await fixture('teambuildr_duplicate_and_alias.csv')
    const rosterNames = namesIn(text) // include aliases so dup handling is isolated
    const { context, stage } = stageFixture('TeamBuildr', text, 'dup.csv', rosterNames)
    const preview = buildPreview(
      stage,
      context,
      resolveAthletes(stage.staged, context, NO_DECISIONS),
      resolveSessions(stage.staged, context, NO_DECISIONS),
      [],
      'skip_existing',
    )
    const dupSkips = preview.rows.filter(
      (r) => r.action === 'skip' && r.notes.join(' ').includes('duplicate rows in file'),
    )
    expect(dupSkips).toHaveLength(1)
  })
})
