/**
 * Shared helpers for import-pipeline tests: an in-memory PGlite database with
 * migrations + reference data applied, and an in-memory ResolutionContext
 * stub for pure pipeline tests that don't need SQL. Lives outside src/ so the
 * browser-clean import modules never gain node dependencies.
 */
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { PGlite } from '@electric-sql/pglite'
import { applyMigrations } from '../../db/apply-migrations.ts'
import type { SqlExecutor } from '../../db/migration-core.ts'
import type { ResolutionContext } from '../../src/lib/import/context.ts'
import {
  referenceKpiConfigs,
  referenceMappings,
  seedReferenceData,
  type RosterSeedAthlete,
} from '../../src/lib/import/local/reference-data.ts'
import type { Source } from '../../src/lib/import/types.ts'

const migrationsDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '../../db/migrations')

export const fixturesDir = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  '../fixtures/imports',
)

export interface TestDb {
  db: SqlExecutor
  close: () => Promise<void>
}

export async function createTestDb(roster: RosterSeedAthlete[]): Promise<TestDb> {
  const pglite = new PGlite()
  const db: SqlExecutor = {
    exec: async (sql) => {
      await pglite.exec(sql)
    },
    query: async <R>(sql: string, params?: unknown[]) =>
      (await pglite.query(sql, params)).rows as R[],
  }
  await applyMigrations(db, migrationsDir)
  await seedReferenceData(db, {
    season: { name: 'Test Season 2026', startDate: '2026-08-10', endDate: '2026-12-06' },
    athletes: roster,
  })
  return { db, close: () => pglite.close() }
}

/** Pure in-memory context for adapter/resolution tests (no database). */
export function stubContext(source: Source, athleteNames: string[]): ResolutionContext {
  return {
    source,
    seasonId: 'season-1',
    athletes: athleteNames.map((fullName, i) => ({
      id: `A${i + 1}`,
      fullName,
      positionName: null,
      status: 'active',
    })),
    identities: [],
    sessions: [],
    kpis: referenceKpiConfigs(),
    mappings: referenceMappings(source),
  }
}

export const NO_DECISIONS = new Map<string, never>()
