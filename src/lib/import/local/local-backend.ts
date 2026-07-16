/**
 * Local import backend: PGlite persisted in IndexedDB, migrated with the same
 * versioned SQL as every other environment, bootstrapped with reference data
 * derived from the synthetic dataset. This module is the LOCAL stand-in
 * behind the import backend seam — production never runs SQL in the browser
 * (§2.2); the AWS implementation replaces this file's role after the §2.1
 * spike. Loaded lazily so PGlite's WASM never enters the initial bundle.
 */
import migration0001 from '../../../../db/migrations/0001_initial_schema.sql?raw'
import { applyMigrationList, type SqlExecutor } from '../../../../db/migration-core.ts'
import { sha256Hex } from '../hash.ts'
import { seedReferenceData, type RosterSeedAthlete } from './reference-data.ts'

const DB_NAME = 'idb://fh-local-dev'

interface DevCanonical {
  seasonYear: number
  seasonStart: string
  seasonEnd: string
  athletes: {
    firstName: string
    lastName: string
    position: RosterSeedAthlete['position']
    jerseyNumber: number
  }[]
}

let instance: Promise<SqlExecutor> | null = null

async function create(): Promise<SqlExecutor> {
  const { PGlite } = await import('@electric-sql/pglite')
  const pglite = new PGlite(DB_NAME)
  const db: SqlExecutor = {
    exec: async (sql) => {
      await pglite.exec(sql)
    },
    query: async <R>(sql: string, params?: unknown[]) =>
      (await pglite.query(sql, params)).rows as R[],
  }

  await applyMigrationList(db, [
    {
      filename: '0001_initial_schema.sql',
      sql: migration0001,
      sha256: await sha256Hex(migration0001),
    },
  ])

  const response = await fetch('/dev-data/canonical.json')
  if (!response.ok) {
    throw new Error('No synthetic dataset available — run: npm run seed:generate')
  }
  const canonical = (await response.json()) as DevCanonical
  await seedReferenceData(db, {
    season: {
      name: `${canonical.seasonYear} Season`,
      startDate: canonical.seasonStart,
      endDate: canonical.seasonEnd,
    },
    athletes: canonical.athletes.map((a) => ({
      firstName: a.firstName,
      lastName: a.lastName,
      position: a.position,
      jerseyNumber: a.jerseyNumber,
    })),
  })

  return db
}

/** Lazily creates (or reopens) the persistent local database. */
export function getLocalDb(): Promise<SqlExecutor> {
  instance ??= create().catch((err: unknown) => {
    instance = null // allow retry after transient failures
    throw err
  })
  return instance
}

/** Destroys the local database entirely (local dev utility — synthetic data only). */
export async function resetLocalDb(): Promise<void> {
  instance = null
  await new Promise<void>((resolve, reject) => {
    const request = indexedDB.deleteDatabase(`/pglite/${DB_NAME.replace('idb://', '')}`)
    request.onsuccess = () => resolve()
    request.onerror = () => reject(request.error as Error)
    request.onblocked = () => resolve() // tabs holding it open — best effort
  })
}
