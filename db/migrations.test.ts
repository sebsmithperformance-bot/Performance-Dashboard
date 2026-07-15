/**
 * Migration integration tests (spec §9.2) against PGlite — a real PostgreSQL
 * running in-process, so constraints, triggers, generated columns and plpgsql
 * behave exactly as they will on Aurora PostgreSQL.
 */
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { PGlite } from '@electric-sql/pglite'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { applyMigrations, type SqlExecutor } from './apply-migrations.ts'

const migrationsDir = path.join(path.dirname(fileURLToPath(import.meta.url)), 'migrations')

let pglite: PGlite
let db: SqlExecutor

beforeAll(async () => {
  pglite = new PGlite()
  db = {
    exec: async (sql) => {
      await pglite.exec(sql)
    },
    query: async <R>(sql: string, params?: unknown[]) =>
      (await pglite.query(sql, params)).rows as R[],
  }
})

afterAll(async () => {
  await pglite.close()
})

/** Insert the minimal graph needed to write a metric observation; returns ids. */
async function insertObservationPrereqs() {
  const [season] = await db.query<{ id: string }>(
    `insert into seasons (name, start_date, end_date, status)
     values ('Test Season 2026', '2026-08-01', '2026-11-30', 'active') returning id`,
  )
  const [athlete] = await db.query<{ id: string }>(
    `insert into athletes (first_name, last_name) values ('Synthetic', 'Athlete') returning id`,
  )
  const [session] = await db.query<{ id: string }>(
    `insert into sessions (season_id, session_date, label, type, source)
     values ($1, '2026-09-01', 'AM Practice', 'practice', 'PlayerData') returning id`,
    [season!.id],
  )
  await db.query(
    `insert into kpi_registry
       (key, display_name, primary_source, category, canonical_unit, display_unit,
        interpretation, aggregation_method)
     values ('player_load', 'Player Load', 'PlayerData', 'Load', 'AU', 'AU',
             'neutral', 'source_value')`,
  )
  const [imp] = await db.query<{ id: string }>(
    `insert into imports (source, original_filename, s3_object_key, file_sha256, uploaded_by_sub)
     values ('PlayerData', 'test.csv', 'imports/test.csv', $1, 'test-user-sub') returning id`,
    ['a'.repeat(64)],
  )
  return { seasonId: season!.id, athleteId: athlete!.id, sessionId: session!.id, importId: imp!.id }
}

describe('0001 initial schema', () => {
  it('applies cleanly to an empty database and is idempotent on re-run', async () => {
    const first = await applyMigrations(db, migrationsDir)
    expect(first.applied).toContain('0001_initial_schema.sql')

    const second = await applyMigrations(db, migrationsDir)
    expect(second.applied).toEqual([])
    expect(second.skipped).toContain('0001_initial_schema.sql')
  })

  it('enforces one observation per (athlete, session, kpi) — the final duplicate barrier', async () => {
    const { athleteId, sessionId, importId } = await insertObservationPrereqs()

    await db.query(
      `insert into metric_observations (athlete_id, session_id, kpi_key, value_canonical, source_import_id)
       values ($1, $2, 'player_load', 653, $3)`,
      [athleteId, sessionId, importId],
    )

    await expect(
      db.query(
        `insert into metric_observations (athlete_id, session_id, kpi_key, value_canonical, source_import_id)
         values ($1, $2, 'player_load', 700, $3)`,
        [athleteId, sessionId, importId],
      ),
    ).rejects.toThrow(/duplicate key/)
  })

  it('rejects NaN and Infinity observation values at the database layer (§6.5)', async () => {
    const [athlete] = await db.query<{ id: string }>(
      `insert into athletes (first_name, last_name) values ('NaN', 'Case') returning id`,
    )
    const [session] = await db.query<{ id: string }>(`select id from sessions limit 1`)
    const [imp] = await db.query<{ id: string }>(`select id from imports limit 1`)

    for (const bad of ['NaN', 'Infinity', '-Infinity']) {
      await expect(
        db.query(
          `insert into metric_observations (athlete_id, session_id, kpi_key, value_canonical, source_import_id)
           values ($1, $2, 'player_load', $3::numeric, $4)`,
          [athlete!.id, session!.id, bad, imp!.id],
        ),
      ).rejects.toThrow()
    }
  })

  it('constrains availability_gate to a single row with id = 1', async () => {
    await db.query(
      `insert into availability_gate (id, passcode_hash, hash_algorithm)
       values (1, '$argon2id$test', 'argon2id')`,
    )
    await expect(
      db.query(
        `insert into availability_gate (id, passcode_hash, hash_algorithm)
         values (2, '$argon2id$other', 'argon2id')`,
      ),
    ).rejects.toThrow()
    await expect(
      db.query(
        `insert into availability_gate (id, passcode_hash, hash_algorithm)
         values (1, '$argon2id$other', 'argon2id')`,
      ),
    ).rejects.toThrow(/duplicate key/)
  })

  it('treats whitespace/case variants of a source raw name as the same identity', async () => {
    const [athlete] = await db.query<{ id: string }>(`select id from athletes limit 1`)

    await db.query(
      `insert into athlete_source_identity (athlete_id, source, raw_name)
       values ($1, 'TeamBuildr', 'Jane  Doe ')`,
      [athlete!.id],
    )
    await expect(
      db.query(
        `insert into athlete_source_identity (athlete_id, source, raw_name)
         values ($1, 'TeamBuildr', 'jane doe')`,
        [athlete!.id],
      ),
    ).rejects.toThrow(/duplicate key/)
  })

  it('rejects values outside CHECK-constrained enums', async () => {
    const [season] = await db.query<{ id: string }>(`select id from seasons limit 1`)
    await expect(
      db.query(
        `insert into sessions (season_id, session_date, label, type, source)
         values ($1, '2026-09-02', 'Match', 'match', 'PlayerData')`,
        [season!.id],
      ),
    ).rejects.toThrow(/check constraint/)
  })

  it('rejects one availability entry per athlete per day duplicates', async () => {
    const [athlete] = await db.query<{ id: string }>(`select id from athletes limit 1`)
    await db.query(
      `insert into availability_entries (athlete_id, effective_date, status, entry_channel)
       values ($1, '2026-09-01', 'full_go', 'staff_app')`,
      [athlete!.id],
    )
    await expect(
      db.query(
        `insert into availability_entries (athlete_id, effective_date, status, entry_channel)
         values ($1, '2026-09-01', 'limited', 'availability_portal')`,
        [athlete!.id],
      ),
    ).rejects.toThrow(/duplicate key/)
  })

  it('maintains updated_at via trigger', async () => {
    // Backdate the insert so the trigger's now() is strictly greater regardless
    // of clock resolution; compare inside Postgres to keep microsecond precision.
    const [before] = await db.query<{ id: string }>(
      `insert into positions (name, sort_order, created_at, updated_at)
       values ('Midfielder', 3, now() - interval '1 day', now() - interval '1 day')
       returning id`,
    )
    const [after] = await db.query<{ bumped: boolean }>(
      `update positions set sort_order = 4 where id = $1
       returning (updated_at > created_at) as bumped`,
      [before!.id],
    )
    expect(after!.bumped).toBe(true)
  })

  it('refuses a previously applied migration whose content changed', async () => {
    const [row] = await db.query<{ sha256: string }>(
      `select sha256 from schema_migrations where filename = $1`,
      ['0001_initial_schema.sql'],
    )
    await db.query(`update schema_migrations set sha256 = $1 where filename = $2`, [
      'f'.repeat(64),
      '0001_initial_schema.sql',
    ])
    await expect(applyMigrations(db, migrationsDir)).rejects.toThrow(/immutable/)

    await db.query(`update schema_migrations set sha256 = $1 where filename = $2`, [
      row!.sha256,
      '0001_initial_schema.sql',
    ])
    const rerun = await applyMigrations(db, migrationsDir)
    expect(rerun.applied).toEqual([])
  })
})
