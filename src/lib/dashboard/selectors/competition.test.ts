import { describe, expect, it } from 'vitest'
import { dashboardFixture } from '../test-fixture.ts'
import { defaultCompetition } from '../../settings/defaults.ts'
import { competitionResult } from './competition.ts'
import type { CompetitionSettings } from '../../settings/types.ts'

/** Fixture lift sessions carry back_squat_top_load (A1 180/185/190, A2 165)
 *  and power_clean_top_load (A3 0 then 80). Only S&C KPIs are eligible. */
function settings(overrides: Partial<CompetitionSettings> = {}): CompetitionSettings {
  return { ...defaultCompetition(), ...overrides }
}

describe('competition scoring', () => {
  it('accumulates place points over the range, never a single best session', () => {
    const ds = dashboardFixture()
    const res = competitionResult(ds, settings(), { kind: 'all' })

    // A1 wins back squat on L1/L2/L3 (180/185/190 vs A2 165) → three firsts,
    // each worth 10 → 30 points minimum from back squat absolute alone
    const a1 = res.athletes.find((a) => a.name === 'Ada Fast')!
    expect(a1.firsts).toBeGreaterThanOrEqual(3)
    expect(a1.points).toBeGreaterThanOrEqual(30)
    // standings are the accumulation, so A1 leads
    expect(res.athletes[0]!.athleteId).toBe(a1.athleteId)
    expect(a1.rank).toBe(1)
  })

  it('never scores workload / load metrics even if asked', () => {
    const ds = dashboardFixture()
    const res = competitionResult(
      ds,
      settings({ eligibleKpis: { workload: { absolute: true, relative: false } } }),
      { kind: 'all' },
    )
    // workload is neutral (not rankable) → produces no KPI board, no points
    expect(res.kpis.length).toBe(0)
    expect(res.athletes.every((a) => a.points === 0 || a.scoredSessions === 0)).toBe(true)
  })

  it('respects a configurable place→points scale', () => {
    const ds = dashboardFixture()
    const base = defaultCompetition()
    const res = competitionResult(
      ds,
      {
        ...base,
        scoringProfiles: [
          { id: 'default', name: 'flat', effectiveFrom: '1970-01-01', placePoints: [100, 1] },
        ],
      },
      { kind: 'all' },
    )
    const a1 = res.athletes.find((a) => a.name === 'Ada Fast')!
    // A1 is 1st in three back-squat sessions → ≥ 300 with the 100-point scale
    expect(a1.points).toBeGreaterThanOrEqual(300)
  })

  it('produces team standings from accumulated member points', () => {
    const ds = dashboardFixture()
    const res = competitionResult(ds, settings(), { kind: 'all' })
    expect(res.teams.length).toBe(2)
    // total team points equal the sum of scored athletes' points
    const athleteTotal = res.athletes.reduce((s, a) => s + a.points, 0)
    const teamTotal = res.teams.reduce((s, t) => s + t.points, 0)
    expect(teamTotal).toBe(athleteTotal)
  })
})
