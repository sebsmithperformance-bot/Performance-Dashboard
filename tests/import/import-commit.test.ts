/**
 * End-to-end import commit tests on PGlite (§9.2, ADR-003): atomicity,
 * before/after audit, duplicate-file detection, cross-source session sharing,
 * unique-constraint final guard, and import-history accuracy.
 */
import { describe, expect, it } from 'vitest'
import type { SqlExecutor } from '../../db/migration-core.ts'
import {
  findCommittedImportByHash,
  getImportRows,
  listImports,
  runPreview,
  type PreviewBundle,
} from '../../src/lib/import/backend.ts'
import { commitImport, type CommitPlanInput } from '../../src/lib/import/commit.ts'
import { sha256Hex } from '../../src/lib/import/hash.ts'
import type { Source } from '../../src/lib/import/types.ts'
import { createTestDb } from './helpers.ts'

const ROSTER = [
  { firstName: 'Avery', lastName: 'Ashcombe', position: 'Forward' as const },
  { firstName: 'Blair', lastName: 'Birchwood', position: 'Midfielder' as const },
  { firstName: 'Kendall', lastName: 'Lockhart', position: 'Defender' as const },
]

const TB_CLEAN =
  'Date,Athlete,Exercise,Top Working Weight (lb),Reps\n' +
  '2026-09-07,Avery Ashcombe,Back Squat,185,3\n' +
  '2026-09-07,Avery Ashcombe,Power Clean,105,3\n' +
  '2026-09-07,Blair Birchwood,Back Squat,165,3\n'

const PERCH_SAME_DAY =
  'Date,Athlete,Exercise,Metric,Power (W)\n' +
  '2026-09-07,Avery Ashcombe,Back Squat,Mean Concentric Power,610\n' +
  '2026-09-07,Kendall Lockhart,Back Squat,Mean Concentric Power,540\n'

const PD_CLEAN =
  'Athlete,Date,Session,Distance,Session Load,Workload\n' +
  'Avery Ashcombe,2026-09-08,AM Practice,4100,430,3.9\n' +
  'Blair Birchwood,2026-09-08,AM Practice,5200,555,4.6\n'

async function preview(
  db: SqlExecutor,
  source: Source,
  text: string,
  filename: string,
  overrides: Partial<Parameters<typeof runPreview>[1]> = {},
): Promise<PreviewBundle> {
  return runPreview(db, {
    source,
    text,
    filename,
    athleteDecisions: new Map(),
    sessionDecisions: new Map(),
    extraMappings: new Map(),
    ignoredHeaders: new Set(),
    conflictPolicy: 'skip_existing',
    ...overrides,
  })
}

async function planFrom(
  bundle: PreviewBundle,
  text: string,
  filename: string,
  extras: Partial<CommitPlanInput> = {},
): Promise<CommitPlanInput> {
  return {
    source: bundle.stage.source,
    filename,
    fileSha256: await sha256Hex(text),
    uploadedBySub: 'test-staff-sub',
    seasonId: bundle.context.seasonId,
    conflictPolicy: 'skip_existing',
    reprocessConfirmed: false,
    athleteItems: bundle.athleteItems,
    sessionItems: bundle.sessionItems,
    rows: bundle.preview.rows,
    fileRowCount: bundle.preview.summary.fileRows,
    newMappings: [],
    ...extras,
  }
}

const count = async (db: SqlExecutor, table: string): Promise<number> =>
  (await db.query<{ n: number }>(`select count(*)::int as n from ${table}`))[0]!.n

describe('transactional import commit', () => {
  it('commits all three clean sources; TB and Perch share the same lift session; history matches DB', async () => {
    const { db, close } = await createTestDb(ROSTER)
    try {
      // --- TeamBuildr ---
      const tb = await preview(db, 'TeamBuildr', TB_CLEAN, 'tb_clean.csv')
      expect(tb.preview.canCommit).toBe(true)
      const tbResult = await commitImport(db, await planFrom(tb, TB_CLEAN, 'tb_clean.csv'))
      expect(tbResult).toMatchObject({ ok: true, counts: { inserted: 3 } })

      // --- Perch (same date → must land on the SAME lift session, §1) ---
      const perch = await preview(db, 'Perch', PERCH_SAME_DAY, 'perch_same_day.csv')
      expect(perch.preview.canCommit).toBe(true)
      // matches the session TeamBuildr created (same date/label/type — 'exact' rung)
      expect(perch.sessionItems[0]!.resolution).toMatchObject({ status: 'matched' })
      const perchResult = await commitImport(
        db,
        await planFrom(perch, PERCH_SAME_DAY, 'perch_same_day.csv'),
      )
      expect(perchResult.ok).toBe(true)
      expect(await count(db, 'sessions')).toBe(1) // no split session

      // TB-without-Perch (Power Clean, Blair BS) and Perch-without-TB (Kendall) coexist (§9.2)
      const [sharedSession] = await db.query<{ id: string }>('select id from sessions')
      const obs = await db.query<{ athlete: string; kpi_key: string }>(
        `select a.first_name as athlete, o.kpi_key from metric_observations o
         join athletes a on a.id = o.athlete_id where o.session_id = $1`,
        [sharedSession!.id],
      )
      expect(obs.some((o) => o.athlete === 'Avery' && o.kpi_key === 'power_clean_top_load')).toBe(
        true,
      )
      expect(
        obs.some((o) => o.athlete === 'Kendall' && o.kpi_key === 'back_squat_mean_power'),
      ).toBe(true)
      expect(obs.some((o) => o.athlete === 'Kendall' && o.kpi_key === 'back_squat_top_load')).toBe(
        false,
      )

      // --- PlayerData ---
      const pd = await preview(db, 'PlayerData', PD_CLEAN, 'pd_clean.csv')
      expect(pd.preview.canCommit).toBe(true)
      const pdResult = await commitImport(db, await planFrom(pd, PD_CLEAN, 'pd_clean.csv'))
      expect(pdResult.ok).toBe(true)

      // identities remembered for future imports (§13)
      expect(await count(db, 'athlete_source_identity')).toBeGreaterThanOrEqual(5)

      // --- Import History mirrors the database exactly ---
      const history = await listImports(db)
      expect(history).toHaveLength(3)
      const totalInserted = history.reduce((a, h) => a + h.inserted, 0)
      // TB 3 rows + Perch 2 rows + PD 2 rows (each PD row carries 3 KPIs but is ONE row)
      expect(totalInserted).toBe(7)
      expect(await count(db, 'metric_observations')).toBe(3 + 2 + 6)
      const tbRows = await getImportRows(db, history.find((h) => h.source === 'TeamBuildr')!.id)
      expect(tbRows).toHaveLength(3)
      expect(tbRows.every((r) => r.action === 'insert')).toBe(true)
    } finally {
      await close()
    }
  })

  it('detects an identical committed file and requires explicit reprocess', async () => {
    const { db, close } = await createTestDb(ROSTER)
    try {
      const first = await preview(db, 'TeamBuildr', TB_CLEAN, 'tb.csv')
      await commitImport(db, await planFrom(first, TB_CLEAN, 'tb.csv'))

      const hash = await sha256Hex(TB_CLEAN)
      expect(await findCommittedImportByHash(db, hash)).not.toBeNull()

      // same file again: existing observations → skip-existing previews to zero writes
      const again = await preview(db, 'TeamBuildr', TB_CLEAN, 'tb.csv')
      expect(again.preview.canCommit).toBe(false)
      expect(again.preview.blockReasons.join(' ')).toMatch(/nothing to import/)

      // replace policy makes rows updates, but the hash guard still blocks without confirm
      const replace = await preview(db, 'TeamBuildr', TB_CLEAN, 'tb.csv', {
        conflictPolicy: 'replace_existing',
      })
      expect(replace.preview.canCommit).toBe(true)
      const blocked = await commitImport(
        db,
        await planFrom(replace, TB_CLEAN, 'tb.csv', { conflictPolicy: 'replace_existing' }),
      )
      expect(blocked).toMatchObject({ ok: false })
      if (!blocked.ok) expect(blocked.reason).toMatch(/identical file already committed/)

      const confirmed = await commitImport(
        db,
        await planFrom(replace, TB_CLEAN, 'tb.csv', {
          conflictPolicy: 'replace_existing',
          reprocessConfirmed: true,
        }),
      )
      expect(confirmed.ok).toBe(true)
    } finally {
      await close()
    }
  })

  it('records before/after values for replacements (corrected value scenario)', async () => {
    const { db, close } = await createTestDb(ROSTER)
    try {
      const first = await preview(db, 'TeamBuildr', TB_CLEAN, 'tb.csv')
      await commitImport(db, await planFrom(first, TB_CLEAN, 'tb.csv'))

      const corrected = TB_CLEAN.replace('185', '195')
      const second = await preview(db, 'TeamBuildr', corrected, 'tb_corrections.csv', {
        conflictPolicy: 'replace_existing',
      })
      const updates = second.preview.rows.filter((r) => r.action === 'update')
      expect(updates.length).toBe(3)
      const result = await commitImport(
        db,
        await planFrom(second, corrected, 'tb_corrections.csv', {
          conflictPolicy: 'replace_existing',
        }),
      )
      expect(result.ok).toBe(true)

      const history = await listImports(db)
      const rows = await getImportRows(db, history[0]!.id)
      const changed = rows.find((r) => r.before?.['back_squat_top_load'] === 185)!
      expect(changed.action).toBe('update')
      expect(changed.after?.['back_squat_top_load']).toBe(195)

      const [value] = await db.query<{ v: string }>(
        `select value_canonical::text as v from metric_observations o
         join athletes a on a.id = o.athlete_id
         where a.first_name = 'Avery' and o.kpi_key = 'back_squat_top_load'`,
      )
      expect(Number(value!.v)).toBe(195)
    } finally {
      await close()
    }
  })

  it('rolls back everything when a write fails mid-commit (forced failure)', async () => {
    const { db, close } = await createTestDb(ROSTER)
    try {
      const bundle = await preview(db, 'TeamBuildr', TB_CLEAN, 'tb.csv')
      const failing: SqlExecutor = {
        exec: db.exec,
        query: async (sql, params) => {
          if (sql.includes('insert into import_rows')) {
            throw new Error('simulated storage failure')
          }
          return db.query(sql, params)
        },
      }
      const result = await commitImport(failing, await planFrom(bundle, TB_CLEAN, 'tb.csv'))
      expect(result).toMatchObject({ ok: false })
      if (!result.ok) expect(result.reason).toMatch(/rolled back.*simulated storage failure/)

      // no partial state of any kind
      expect(await count(db, 'imports')).toBe(0)
      expect(await count(db, 'import_rows')).toBe(0)
      expect(await count(db, 'metric_observations')).toBe(0)
      expect(await count(db, 'sessions')).toBe(0)
      expect(await count(db, 'athlete_source_identity')).toBe(0)
    } finally {
      await close()
    }
  })

  it('refuses to commit while error rows or unresolved athletes exist', async () => {
    const { db, close } = await createTestDb(ROSTER)
    try {
      const alias =
        'Date,Athlete,Exercise,Top Working Weight (lb),Reps\n' +
        '2026-09-07,Kenny Lockhart,Back Squat,150,3\n'
      const bundle = await preview(db, 'TeamBuildr', alias, 'alias.csv')
      expect(bundle.athleteItems[0]!.resolution.status).toBe('suggested')
      expect(bundle.preview.canCommit).toBe(false)

      const refused = await commitImport(db, await planFrom(bundle, alias, 'alias.csv'))
      expect(refused).toMatchObject({ ok: false })
      expect(await count(db, 'imports')).toBe(0)

      // explicit confirmation resolves it — and persists the identity
      const decided = await preview(db, 'TeamBuildr', alias, 'alias.csv', {
        athleteDecisions: new Map([
          [
            bundle.athleteItems[0]!.refKey,
            {
              action: 'use' as const,
              athleteId:
                bundle.athleteItems[0]!.resolution.status === 'suggested'
                  ? bundle.athleteItems[0]!.resolution.candidates[0]!.athleteId
                  : '',
            },
          ],
        ]),
      })
      expect(decided.preview.canCommit).toBe(true)
      const committed = await commitImport(db, await planFrom(decided, alias, 'alias.csv'))
      expect(committed.ok).toBe(true)
      const [identity] = await db.query<{ raw_name: string }>(
        `select raw_name from athlete_source_identity where raw_name = 'Kenny Lockhart'`,
      )
      expect(identity).toBeTruthy()

      // future imports match via the remembered identity — no decision needed
      const third = await preview(db, 'TeamBuildr', alias, 'alias2.csv')
      expect(third.athleteItems[0]!.resolution).toMatchObject({
        status: 'matched',
        via: 'identity',
      })
    } finally {
      await close()
    }
  })

  it('create-athlete is a deliberate action and the unique constraint stays the final guard', async () => {
    const { db, close } = await createTestDb(ROSTER)
    try {
      const newcomer =
        'Date,Athlete,Exercise,Top Working Weight (lb),Reps\n' +
        '2026-09-07,Rowan Newland,Back Squat,140,3\n'
      const bundle = await preview(db, 'TeamBuildr', newcomer, 'new.csv')
      expect(bundle.preview.canCommit).toBe(false) // unmatched blocks by default

      const decided = await preview(db, 'TeamBuildr', newcomer, 'new.csv', {
        athleteDecisions: new Map([
          [bundle.athleteItems[0]!.refKey, { action: 'create' as const }],
        ]),
      })
      expect(decided.preview.canCommit).toBe(true)
      const result = await commitImport(db, await planFrom(decided, newcomer, 'new.csv'))
      expect(result.ok).toBe(true)
      const [created] = await db.query<{ first_name: string; last_name: string }>(
        `select first_name, last_name from athletes where last_name = 'Newland'`,
      )
      expect(created).toMatchObject({ first_name: 'Rowan' })

      // final guard: force a duplicate insert through a hand-built plan
      // (reprocessConfirmed skips the hash guard so the DB constraint is what fires)
      const dupPlan = await planFrom(decided, newcomer, 'new2.csv', { reprocessConfirmed: true })
      const doubled = { ...dupPlan, rows: [...dupPlan.rows, ...dupPlan.rows] }
      const guard = await commitImport(db, doubled)
      expect(guard).toMatchObject({ ok: false })
      if (!guard.ok) expect(guard.reason).toMatch(/duplicate key|rolled back/)
      // the failed attempt left nothing behind
      expect((await listImports(db)).length).toBe(1)
    } finally {
      await close()
    }
  })
})
