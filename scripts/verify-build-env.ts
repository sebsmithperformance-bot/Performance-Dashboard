/**
 * Build-time environment guard (spec §7.3, §11.2) — runs before every
 * `npm run build`. Thin wrapper: all rules live in src/lib/env-guards/policy.ts
 * (a CODEOWNERS-protected path). Exits non-zero on any violation, failing the
 * build.
 */
import process from 'node:process'
import { verifyBuildEnv } from '../src/lib/env-guards/policy.ts'

const resourceIdentifiers: Record<string, string> = {}
for (const [key, value] of Object.entries(process.env)) {
  if (key.startsWith('VITE_AWS_') && value) resourceIdentifiers[key] = value
}

const result = verifyBuildEnv({
  appEnv: process.env.APP_ENV ?? process.env.VITE_APP_ENV ?? 'local',
  authMode: process.env.VITE_AUTH_MODE ?? 'mock',
  availabilityGate: process.env.AVAILABILITY_GATE ?? 'disabled',
  resourceIdentifiers,
})

if (!result.ok) {
  console.error('Build blocked by environment guard (spec §7.3):')
  for (const v of result.violations) console.error(`  ✗ ${v}`)
  process.exit(1)
}
console.log('Environment guard passed.')
