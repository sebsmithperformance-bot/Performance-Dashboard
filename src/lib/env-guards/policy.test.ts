import { describe, expect, it } from 'vitest'
import { verifyBuildEnv, type BuildEnv } from './policy.ts'

const base: BuildEnv = {
  appEnv: 'local',
  authMode: 'mock',
  availabilityGate: 'disabled',
  resourceIdentifiers: {},
}

describe('verifyBuildEnv (§7.3 / §9.3)', () => {
  it('permits mock auth locally', () => {
    expect(verifyBuildEnv(base).ok).toBe(true)
  })

  it('fails a production build with mock auth', () => {
    const r = verifyBuildEnv({ ...base, appEnv: 'production' })
    expect(r.ok).toBe(false)
    expect(r.violations.join(' ')).toMatch(/AUTH_MODE/)
  })

  it('fails a production build when the availability gate is not enabled', () => {
    const r = verifyBuildEnv({
      ...base,
      appEnv: 'production',
      authMode: 'cognito',
      availabilityGate: 'disabled',
    })
    expect(r.ok).toBe(false)
    expect(r.violations.join(' ')).toMatch(/AVAILABILITY_GATE/)
  })

  it('fails a production build pointing at dev resource identifiers', () => {
    const r = verifyBuildEnv({
      appEnv: 'production',
      authMode: 'cognito',
      availabilityGate: 'enabled',
      resourceIdentifiers: {
        appsyncEndpoint: 'https://fh-dashboard-dev.appsync-api.us-east-1.amazonaws.com/graphql',
      },
    })
    expect(r.ok).toBe(false)
    expect(r.violations.join(' ')).toMatch(/dev resource/)
  })

  it('passes a coherent production configuration', () => {
    const r = verifyBuildEnv({
      appEnv: 'production',
      authMode: 'cognito',
      availabilityGate: 'enabled',
      resourceIdentifiers: {
        appsyncEndpoint: 'https://fh-dashboard-prod.appsync-api.us-east-1.amazonaws.com/graphql',
        cognitoPoolId: 'us-east-1_ProdPool1',
      },
    })
    expect(r.ok).toBe(true)
  })

  it('rejects mock auth in the dev AWS environment too — mock is local-only', () => {
    const r = verifyBuildEnv({ ...base, appEnv: 'dev' })
    expect(r.ok).toBe(false)
    expect(r.violations.join(' ')).toMatch(/only permitted locally/)
  })
})
