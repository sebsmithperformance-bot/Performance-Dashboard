/**
 * Filesystem entry point for the migration core — used by the CLI and
 * node-side tests. Browser environments use applyMigrationList from
 * migration-core.ts with bundled SQL instead.
 */
import { createHash } from 'node:crypto'
import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import {
  applyMigrationList,
  type MigrationResult,
  type MigrationSource,
  type SqlExecutor,
} from './migration-core.ts'

export type { MigrationResult, MigrationSource, SqlExecutor }
export { applyMigrationList }

export async function listMigrationFiles(dir: string): Promise<string[]> {
  const entries = await readdir(dir)
  return entries.filter((f) => /^\d{4}_.+\.sql$/.test(f)).sort()
}

export async function applyMigrations(db: SqlExecutor, dir: string): Promise<MigrationResult> {
  const files = await listMigrationFiles(dir)
  if (files.length === 0) {
    throw new Error(`No migration files found in ${dir}`)
  }
  const migrations: MigrationSource[] = []
  for (const filename of files) {
    const sql = await readFile(path.join(dir, filename), 'utf8')
    migrations.push({ filename, sql, sha256: createHash('sha256').update(sql).digest('hex') })
  }
  return applyMigrationList(db, migrations)
}
