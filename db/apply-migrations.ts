import { createHash } from 'node:crypto'
import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'

/**
 * Minimal executor abstraction so the identical migration logic runs against
 * node-postgres (CLI, real databases) and PGlite (integration tests).
 */
export interface SqlExecutor {
  /** Run a possibly multi-statement SQL string. */
  exec(sql: string): Promise<void>
  /** Run one parameterized statement, returning rows. */
  query<R>(sql: string, params?: unknown[]): Promise<R[]>
}

interface AppliedRow {
  filename: string
  sha256: string
}

export interface MigrationResult {
  applied: string[]
  skipped: string[]
}

const MIGRATIONS_TABLE_DDL = `
create table if not exists schema_migrations (
  filename    text primary key,
  sha256      text not null,
  applied_at  timestamptz not null default now()
)`

export async function listMigrationFiles(dir: string): Promise<string[]> {
  const entries = await readdir(dir)
  return entries.filter((f) => /^\d{4}_.+\.sql$/.test(f)).sort()
}

/**
 * Applies every unapplied migration in filename order, each inside its own
 * transaction. Applied migrations are immutable: a content-hash mismatch on a
 * previously applied file aborts instead of silently diverging schemas.
 */
export async function applyMigrations(db: SqlExecutor, dir: string): Promise<MigrationResult> {
  await db.exec(MIGRATIONS_TABLE_DDL)

  const files = await listMigrationFiles(dir)
  if (files.length === 0) {
    throw new Error(`No migration files found in ${dir}`)
  }

  const appliedRows = await db.query<AppliedRow>('select filename, sha256 from schema_migrations')
  const appliedByName = new Map(appliedRows.map((r) => [r.filename, r.sha256]))

  const result: MigrationResult = { applied: [], skipped: [] }

  for (const filename of files) {
    const sql = await readFile(path.join(dir, filename), 'utf8')
    const sha256 = createHash('sha256').update(sql).digest('hex')

    const existing = appliedByName.get(filename)
    if (existing !== undefined) {
      if (existing !== sha256) {
        throw new Error(
          `Migration ${filename} changed after being applied (sha256 mismatch). ` +
            'Applied migrations are immutable — add a new migration instead.',
        )
      }
      result.skipped.push(filename)
      continue
    }

    try {
      await db.exec('begin')
      await db.exec(sql)
      await db.query('insert into schema_migrations (filename, sha256) values ($1, $2)', [
        filename,
        sha256,
      ])
      await db.exec('commit')
    } catch (err) {
      await db.exec('rollback')
      throw new Error(
        `Migration ${filename} failed: ${err instanceof Error ? err.message : String(err)}`,
      )
    }
    result.applied.push(filename)
  }

  return result
}
