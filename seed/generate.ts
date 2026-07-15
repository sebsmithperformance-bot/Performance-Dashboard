/**
 * Synthetic dataset CLI (spec §8.2):
 *   npm run seed:generate -- --season=2026 --seed=20260801
 *
 * Deterministic by seed; refuses to run when APP_ENV=production (§8.2, §14).
 * Writes the canonical dataset, source-style CSV exports, deliberate problem
 * fixtures, and the §8.12 quality report. Exits non-zero if any hard
 * invariant fails.
 */
import { mkdir, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { DEFAULT_SEED } from './config.v1.ts'
import { generateDataset } from './dataset.ts'
import {
  exportPlayerDataSectionedHazard,
  exportPlayerDataSessions,
  exportPlayerDataWeek,
} from './exporters/playerdata.ts'
import {
  exportPerchCleanPower,
  exportPerchSeason,
  exportPerchUnmappedAndBlank,
  exportCrossSourceSameSession,
} from './exporters/perch.ts'
import {
  exportTeamBuildrCleanPreseason,
  exportTeamBuildrCorrection,
  exportTeamBuildrDuplicateAndAlias,
  exportTeamBuildrSeason,
} from './exporters/teambuildr.ts'
import { evaluateQuality, formatQualityReport } from './quality.ts'

if ((process.env.APP_ENV ?? 'local') === 'production') {
  console.error('Refusing to generate synthetic data with APP_ENV=production (spec §8.2).')
  process.exit(1)
}

function arg(name: string, fallback: number): number {
  const raw = process.argv.find((a) => a.startsWith(`--${name}=`))?.split('=')[1]
  if (raw === undefined) return fallback
  const value = Number(raw)
  if (!Number.isInteger(value)) {
    console.error(`--${name} must be an integer, got "${raw}"`)
    process.exit(1)
  }
  return value
}

const seasonYear = arg('season', 2026)
const seed = arg('seed', DEFAULT_SEED)
const outDir =
  process.argv.find((a) => a.startsWith('--out='))?.split('=')[1] ??
  path.join('seed', 'output', `season-${seasonYear}-seed-${seed}`)

console.log(`Generating season ${seasonYear} with seed ${seed} → ${outDir}`)
const dataset = generateDataset({ seasonYear, seed })
const report = evaluateQuality(dataset)

await rm(outDir, { recursive: true, force: true })
await mkdir(path.join(outDir, 'playerdata'), { recursive: true })
await mkdir(path.join(outDir, 'sources'), { recursive: true })
await mkdir(path.join(outDir, 'fixtures'), { recursive: true })

await writeFile(path.join(outDir, 'canonical.json'), JSON.stringify(dataset, null, 1))
await writeFile(path.join(outDir, 'quality-report.json'), JSON.stringify(report, null, 2))
await writeFile(path.join(outDir, 'quality-report.txt'), formatQualityReport(report))

for (const file of exportPlayerDataSessions(dataset)) {
  await writeFile(path.join(outDir, 'playerdata', file.filename), file.content)
}
for (const file of [exportTeamBuildrSeason(dataset), exportPerchSeason(dataset)]) {
  await writeFile(path.join(outDir, 'sources', file.filename), file.content)
}

// §8.11 deliberate problem / scenario fixtures, all from simulated data
const cleanGameWeek = 5 // in-season two_game archetype
const deviceWeek = 9 // device_missing_cluster scenario week
const hazardSession = dataset.sessions.find(
  (s) => s.kind === 'field' && s.type === 'practice' && s.weekIndex === cleanGameWeek,
)!
const fixtures = [
  exportTeamBuildrCleanPreseason(dataset),
  exportTeamBuildrDuplicateAndAlias(dataset),
  exportTeamBuildrCorrection(dataset),
  exportPlayerDataWeek(dataset, cleanGameWeek, 'playerdata_clean_game_week.csv'),
  exportPlayerDataWeek(dataset, deviceWeek, 'playerdata_missing_device_rows.csv'),
  exportPlayerDataSectionedHazard(dataset, hazardSession),
  exportPerchCleanPower(dataset, cleanGameWeek),
  exportPerchUnmappedAndBlank(dataset, cleanGameWeek + 1),
  ...exportCrossSourceSameSession(dataset),
]
for (const file of fixtures) {
  await writeFile(path.join(outDir, 'fixtures', file.filename), file.content)
}

console.log(formatQualityReport(report))
console.log(
  `\nWrote canonical.json, ${exportPlayerDataSessions(dataset).length} PlayerData session files, ` +
    `2 season source files, ${fixtures.length} fixtures.`,
)

if (report.hardFailures.length > 0) {
  console.error(`\nHARD INVARIANT FAILURES (${report.hardFailures.length}):`)
  for (const f of report.hardFailures) console.error(`  - ${f}`)
  process.exit(1)
}
console.log('\nAll hard invariants passed.')
