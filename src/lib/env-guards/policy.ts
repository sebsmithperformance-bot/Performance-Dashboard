/**
 * Environment-safety policy (spec §7.3, §11.1) — pure and unit-tested.
 * A production build must be impossible with mock auth, a disabled
 * availability gate, or dev resource identifiers. The build-time verifier
 * (scripts/verify-build-env.ts) and any runtime assertion both call this;
 * nothing else reimplements the rules.
 */

export interface BuildEnv {
  /** APP_ENV: local | dev | production (defaults to local when unset) */
  appEnv: string
  /** AUTH_MODE: mock | cognito */
  authMode: string
  /** AVAILABILITY_GATE: enabled | disabled (production requires enabled) */
  availabilityGate: string
  /**
   * Backend resource identifiers baked into the frontend config (Cognito pool,
   * AppSync endpoint, etc.). Empty until the §2.1 spike provisions them.
   */
  resourceIdentifiers: Record<string, string>
}

export interface PolicyResult {
  ok: boolean
  violations: string[]
}

/** Substrings that mark a resource identifier as belonging to the dev environment. */
const DEV_MARKERS = ['-dev', 'dev-', '_dev', 'sandbox', 'localhost', '127.0.0.1']

export function verifyBuildEnv(env: BuildEnv): PolicyResult {
  const violations: string[] = []
  const appEnv = env.appEnv || 'local'

  if (appEnv === 'production') {
    if (env.authMode !== 'cognito') {
      violations.push(
        `AUTH_MODE must be "cognito" in production (got "${env.authMode || 'unset'}")`,
      )
    }
    if (env.availabilityGate !== 'enabled') {
      violations.push(
        `AVAILABILITY_GATE must be "enabled" in production (got "${env.availabilityGate || 'unset'}")`,
      )
    }
    for (const [key, value] of Object.entries(env.resourceIdentifiers)) {
      const lower = value.toLowerCase()
      if (DEV_MARKERS.some((marker) => lower.includes(marker))) {
        violations.push(`Production build points at a dev resource: ${key}="${value}"`)
      }
    }
  }

  if (appEnv !== 'local' && env.authMode === 'mock') {
    violations.push(`AUTH_MODE=mock is only permitted locally (APP_ENV="${appEnv}")`)
  }

  return { ok: violations.length === 0, violations }
}
