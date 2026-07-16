/**
 * Runtime-agnostic migration core: no filesystem, no node builtins, so the
 * same versioned SQL applies identically from the CLI (node), tests (PGlite
 * in-process), and the browser's local PGlite database (bundled ?raw SQL).
 */

/**
 * Minimal executor abstraction so identical database logic runs against
 * node-postgres (CLI, real databases) and PGlite (tests, local browser DB).
 */
export interface SqlExecutor {
  /** Run a possibly multi-statement SQL string. */
  exec(sql: string): Promise<void>
  /** Run one parameterized statement, returning rows. */
  query<R>(sql: string, params?: unknown[]): Promise<R[]>
}

export interface MigrationSource {
  filename: string
  sql: string
  /** hex sha256 of the SQL text — computed by the caller's runtime crypto */
  sha256: string
}

export interface MigrationResult {
  applied: string[]
  skipped: string[]
}

interface AppliedRow {
  filename: string
  sha256: string
}

const MIGRATIONS_TABLE_DDL = `
create table if not exists schema_migrations (
  filename    text primary key,
  sha256      text not null,
  applied_at  timestamptz not null default now()
)`

/**
 * Applies every unapplied migration in filename order, each inside its own
 * transaction. Applied migrations are immutable: a content-hash mismatch on a
 * previously applied file aborts instead of silently diverging schemas.
 */
export async function applyMigrationList(
  db: SqlExecutor,
  migrations: MigrationSource[],
): Promise<MigrationResult> {
  await db.exec(MIGRATIONS_TABLE_DDL)
  if (migrations.length === 0) {
    throw new Error('No migrations provided')
  }

  const appliedRows = await db.query<AppliedRow>('select filename, sha256 from schema_migrations')
  const appliedByName = new Map(appliedRows.map((r) => [r.filename, r.sha256]))

  const result: MigrationResult = { applied: [], skipped: [] }

  for (const { filename, sql, sha256 } of [...migrations].sort((a, b) =>
    a.filename.localeCompare(b.filename),
  )) {
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
