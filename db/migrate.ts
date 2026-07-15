/**
 * Migration CLI: `npm run db:migrate`
 *
 * Requires DATABASE_URL. Refuses APP_ENV=production unless --production is
 * passed explicitly — production migrations are a controlled deploy step
 * (spec §11.2), never a side effect.
 *
 * Note: this connects with node-postgres for local/dev clusters. The
 * production/dev Aurora path via the RDS Data API gets its own executor once
 * the §2.1 spike lands (ADR-001).
 */
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import pg from 'pg'
import { applyMigrations, type SqlExecutor } from './apply-migrations.ts'

const appEnv = process.env.APP_ENV ?? 'local'
if (appEnv === 'production' && !process.argv.includes('--production')) {
  console.error(
    'Refusing to run migrations with APP_ENV=production. ' +
      'Production migrations are an explicit deploy step: pass --production if this is one.',
  )
  process.exit(1)
}

const databaseUrl = process.env.DATABASE_URL
if (!databaseUrl) {
  console.error('DATABASE_URL is required (no default — never bake credentials into code).')
  process.exit(1)
}

const migrationsDir = path.join(path.dirname(fileURLToPath(import.meta.url)), 'migrations')

const client = new pg.Client({ connectionString: databaseUrl })
await client.connect()

const executor: SqlExecutor = {
  exec: async (sql) => {
    await client.query(sql)
  },
  query: async <R>(sql: string, params?: unknown[]) =>
    (await client.query(sql, params as unknown[] | undefined)).rows as R[],
}

try {
  const result = await applyMigrations(executor, migrationsDir)
  for (const f of result.skipped) console.log(`= already applied: ${f}`)
  for (const f of result.applied) console.log(`+ applied: ${f}`)
  if (result.applied.length === 0) console.log('Schema is up to date.')
} finally {
  await client.end()
}
