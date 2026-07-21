/**
 * §5 workload terminology: current-load calculations (daily trend, acute 7d,
 * chronic 28d weekly equivalent, ACWR, monotony, strain) run on the 1–10
 * Workload metric — never Player Load — and never emit NaN/Infinity.
 */
import { describe, expect, it } from 'vitest'
import { dashboardFixture } from '../test-fixture.ts'
import { LOAD_KPI } from './daily-load.ts'
import { readinessTableView } from './readiness.ts'
import { loadHealthView } from './load-health.ts'

describe('workload calculations', () => {
  it('uses the 1–10 Workload metric as the load source, not Player Load', () => {
    expect(LOAD_KPI).toBe('workload')
  })

  it('acute/monotony/strain come from Workload values, not Player Load', () => {
    const ds = dashboardFixture()
    const rows = readinessTableView(ds, '2026-09-05', null)
    const a1 = rows.find((r) => r.athleteId === 'A1')!
    // A1's Workload window (6+7+2+6+3+7 = 31) drives acute7d; the Player Load
    // sum for the same days (2130) must NOT appear
    expect(a1.acute7d).toBe(31)
    expect(a1.acute7d).not.toBe(2130)
    expect(a1.monotony).not.toBeNull()
  })

  it('never produces NaN or Infinity in load values', () => {
    const ds = dashboardFixture()
    const rows = readinessTableView(ds, '2026-09-05', null)
    for (const r of rows) {
      for (const v of [r.acute7d, r.chronicWeekly, r.acwr, r.monotony, r.strain]) {
        if (v !== null) expect(Number.isFinite(v)).toBe(true)
      }
    }
    const lh = loadHealthView(ds, '2026-09-05', null)
    expect(lh.avgAcute7dLoad === null || Number.isFinite(lh.avgAcute7dLoad)).toBe(true)
    expect(lh.teamMedianAcwr === null || Number.isFinite(lh.teamMedianAcwr)).toBe(true)
    // labelled as the 1–10 Workload scale
    expect(lh.loadKpiLabel).toMatch(/Workload 1–10/)
  })
})
