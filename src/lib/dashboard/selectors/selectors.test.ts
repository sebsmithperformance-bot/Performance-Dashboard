import { describe, expect, it } from 'vitest'
import { generateDataset } from '../../../../seed/dataset.ts'
import { formatMetricValue, formatPercentDelta } from '../format.ts'
import { datasetFromCanonical } from '../local-provider.ts'
import { dashboardFixture } from '../test-fixture.ts'
import { athleteFlagsView } from './speed-flags.ts'
import { athletesTableView } from './athletes-table.ts'
import { availabilityView } from './availability.ts'
import { lastSessionGpsView } from './last-session.ts'
import { loadHealthView } from './load-health.ts'
import { scChangeView } from './sc-change.ts'

const ds = dashboardFixture()

describe('availabilityView', () => {
  it('counts statuses and exposes reveal lists with notes', () => {
    const v = availabilityView(ds, '2026-09-05', null)
    expect(v.counts).toEqual({ full_go: 1, limited: 1, out: 1 })
    expect(v.byStatus.limited[0]).toMatchObject({ name: 'Bea Steady', note: 'Lift only' })
    expect(v.totalActive).toBe(3)
    expect(v.noEntry).toBe(0)
  })
  it('filters by position and reports missing entries distinctly', () => {
    const v = availabilityView(ds, '2026-09-01', 'Forward')
    expect(v.totalActive).toBe(1)
    expect(v.noEntry).toBe(1)
  })
})

describe('lastSessionGpsView', () => {
  it('picks the latest field session with data and compares to the prior same-type session', () => {
    const v = lastSessionGpsView(ds, '2026-09-05')!
    expect(v.session.id).toBe('S7')
    expect(v.comparedTo?.id).toBe('S2')
    const distance = v.metrics.find((m) => m.kpiKey === 'total_distance')!
    // team scope is the AVERAGE PER PARTICIPATING ATHLETE, never a hidden total:
    // S7 = mean(3500, 3300) = 3400; prior S2 = mean(3600) = 3600 (A2 device-missing)
    expect(distance.value).toBe(3400)
    expect(distance.aggLabel).toBe('average per athlete')
    expect(distance.deltaPct).toBeCloseTo(((3400 - 3600) / 3600) * 100, 5)
  })
  it('reports device-missing participants without zero-filling', () => {
    const v = lastSessionGpsView(ds, '2026-09-02')!
    expect(v.session.id).toBe('S2')
    expect(v.expectedParticipants).toBe(2)
    expect(v.participants).toBe(1)
    expect(v.missingDevice).toBe(1)
  })
})

describe('loadHealthView', () => {
  it('reports early-season windows as incomplete/insufficient, never fabricating ACWR', () => {
    const v = loadHealthView(ds, '2026-09-05', null)
    expect(v.validCount).toBe(0)
    expect(v.counts.incomplete + v.counts.insufficient).toBe(3)
    expect(v.athletes.find((a) => a.athleteId === 'A2')?.reason).toBe('incomplete data')
    // four transparent states: below / within / elevated / substantially elevated
    expect(v.bands).toHaveLength(4)
    expect(v.bands.map((b) => b.key)).toEqual(['below', 'within', 'elevated', 'high'])
  })
})

describe('scChangeView', () => {
  it('classifies per KPI interpretation with prior-session basis', () => {
    const v = scChangeView(ds, 'back_squat_top_load', 'prior_session', null, '2026-09-05')
    const a1 = v.athletes.find((a) => a.athleteId === 'A1')!
    expect(a1.deltaPct).toBeCloseTo((5 / 185) * 100, 5)
    expect(a1.classification).toBe('improved')
    expect(v.counts.notComputable).toBe(2)
    expect(v.medianDeltaPct).toBeCloseTo(a1.deltaPct!, 5)
    expect(v.currentMedian).toBeCloseTo(177.5, 5) // median of 190, 165
  })
  it('refuses zero baselines with a stated reason', () => {
    const v = scChangeView(ds, 'power_clean_top_load', 'prior_session', null, '2026-09-05')
    const a3 = v.athletes.find((a) => a.athleteId === 'A3')!
    expect(a3.deltaPct).toBeNull()
    expect(a3.reason).toMatch(/baseline is zero/)
  })
  it('supports rolling-average and custom-range bases', () => {
    const rolling = scChangeView(ds, 'back_squat_top_load', 'rolling_average', null, '2026-09-05')
    expect(rolling.athletes.find((a) => a.athleteId === 'A1')!.baseline).toBeCloseTo(182.5, 5)
    const custom = scChangeView(ds, 'back_squat_top_load', 'custom_range', null, '2026-09-05', {
      from: '2026-08-18',
      to: '2026-08-28',
    })
    expect(custom.athletes.find((a) => a.athleteId === 'A1')!.baseline).toBeCloseTo(182.5, 5)
  })
})

describe('athleteFlagsView', () => {
  it('flags only sufficient-baseline athletes below threshold; insufficient listed separately', () => {
    const v = athleteFlagsView(ds, '2026-09-05')
    expect(v.session?.id).toBe('S7')
    expect(v.flags).toHaveLength(1)
    expect(v.flags[0]).toMatchObject({
      name: 'Ada Fast',
      baselineSize: 3,
      baselineBest: 18.0,
      exposureMin: 58, // current-session context shown with every flag
    })
    expect(v.flags[0]!.percentOfBest).toBeCloseTo((15.5 / 18) * 100, 4)
    expect(v.insufficientBaseline).toHaveLength(1)
    expect(v.insufficientBaseline[0]).toMatchObject({ name: 'Bea Steady', baselineSize: 1 })
    expect(v.evaluated).toBe(2)
  })
})

describe('athletesTableView', () => {
  it('keeps same-date sessions separate and selectable', () => {
    const v = athletesTableView(ds, '2026-09-04', null, null)
    expect(v.sessionsOnDate.map((s) => s.id)).toEqual(['S4', 'S5', 'L3'])
    expect(v.session?.id).toBe('S4')
    const pm = athletesTableView(ds, '2026-09-04', 'S5', null)
    expect(pm.session?.id).toBe('S5')
    expect(pm.rows.find((r) => r.athleteId === 'A2')!.quality).toBe('did not participate')
  })
  it('switches KPI catalog with session kind (lift day shows S&C columns)', () => {
    const v = athletesTableView(ds, '2026-09-04', 'L3', null)
    expect(v.availableKpis.map((k) => k.key)).toContain('back_squat_top_load')
    expect(v.rows.find((r) => r.athleteId === 'A1')!.values['back_squat_top_load']).toBe(190)
  })
  it('marks device-missing participants explicitly — never zero', () => {
    const v = athletesTableView(ds, '2026-09-02', null, null)
    const a2 = v.rows.find((r) => r.athleteId === 'A2')!
    expect(a2.quality).toBe('no device data')
    expect(a2.values['player_load']).toBeUndefined()
  })
})

describe('formatting core', () => {
  const kpi = { decimalPlaces: 1, unit: 'mph' }
  it('distinguishes missing from zero and never renders NaN/Infinity', () => {
    expect(formatMetricValue(0, kpi)).toMatchObject({ text: '0.0', missing: false })
    expect(formatMetricValue(null, kpi)).toMatchObject({
      text: '—',
      missing: true,
      aria: 'no data',
    })
    expect(formatMetricValue(Number.NaN, kpi).text).toBe('—')
    expect(formatMetricValue(Number.POSITIVE_INFINITY, kpi).text).toBe('—')
    expect(formatMetricValue(17.25, kpi)).toMatchObject({ text: '17.3', unit: 'mph' })
  })
  it('formats signed percent deltas', () => {
    expect(formatPercentDelta(4.26)).toBe('+4.3%')
    expect(formatPercentDelta(-3.14)).toBe('−3.1%')
    expect(formatPercentDelta(null)).toBeNull()
    expect(formatPercentDelta(Number.NaN)).toBeNull()
  })
})

describe('local provider over the generated season (smoke)', () => {
  const canonical = JSON.parse(
    JSON.stringify(generateDataset({ seasonYear: 2026, seed: 20260801 })),
  )
  const full = datasetFromCanonical(canonical)

  it('maps the full synthetic season without losing the roster', () => {
    expect(full.athletes).toHaveLength(25)
    expect(full.sessions.length).toBeGreaterThan(100)
    expect(full.observations.length).toBeGreaterThan(20000)
  })

  it('produces valid mature-season ACWR bands that sum to the roster', () => {
    const v = loadHealthView(full, '2026-10-15', null)
    expect(v.validCount).toBeGreaterThan(0)
    const total =
      v.counts.below +
      v.counts.within +
      v.counts.elevated +
      v.counts.high +
      v.counts.incomplete +
      v.counts.insufficient
    expect(total).toBe(25)
    for (const a of v.athletes) {
      if (a.acwr !== null) expect(Number.isFinite(a.acwr)).toBe(true)
    }
  })

  it('yields finite tile values end-to-end', () => {
    const last = lastSessionGpsView(full, '2026-11-15')!
    for (const m of last.metrics) {
      if (m.value !== null) expect(Number.isFinite(m.value)).toBe(true)
    }
    const flags = athleteFlagsView(full, '2026-11-15')
    expect(flags.session).not.toBeNull()
    for (const f of flags.flags) expect(Number.isFinite(f.percentOfBest)).toBe(true)
  })
})
