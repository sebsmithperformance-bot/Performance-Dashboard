/**
 * Selector tests for the Step-5 coach-facing pages: readiness, GPS
 * (overview/compare/trends), metric trends, performance (tiles/leaderboards/
 * profile percentiles), and the settings override layer.
 */
import { describe, expect, it } from 'vitest'
import { DEFAULT_THRESHOLDS } from '../../settings/defaults.ts'
import { applyKpiOverride } from '../../settings/SettingsContext.tsx'
import { buildDataset } from '../dataset.ts'
import { sessionTypeSummary } from '../format.ts'
import { dashboardFixture } from '../test-fixture.ts'
import type { DashKpi } from '../types.ts'
import { gpsSessionCompare, gpsSessionOverview, gpsTrendsView } from './gps.ts'
import { lastSessionGpsView } from './last-session.ts'
import { bandFor, loadHealthView } from './load-health.ts'
import { metricTrendView } from './metric-trend.ts'
import {
  athleteProfileView,
  leaderboardView,
  performanceOverview,
} from './performance.ts'
import { athleteReadinessSeries, readinessTableView, teamReadinessView } from './readiness.ts'

const ds = dashboardFixture()
const GROUPS = [
  { id: 'Goalkeeper', label: 'Goalkeepers' },
  { id: 'Defender', label: 'Defenders' },
  { id: 'Midfielder', label: 'Midfielders' },
  { id: 'Forward', label: 'Forwards' },
]

describe('readiness selectors', () => {
  it('computes acute load per athlete with ADR-005 day semantics', () => {
    const rows = readinessTableView(ds, '2026-09-05', null)
    const a1 = rows.find((r) => r.athleteId === 'A1')!
    // A1 observed every participated day: 420+500+120+400+210+480
    expect(a1.acute7d).toBe(2130)
    expect(a1.monotony).not.toBeNull()
    // A2's device-missing day (S2) poisons her 7-day window
    const a2 = rows.find((r) => r.athleteId === 'A2')!
    expect(a2.acute7d).toBeNull()
    // early season: nobody has a complete 28-day window
    expect(rows.every((r) => r.acwr === null)).toBe(true)
    expect(a1.reason).toBe('incomplete data')
  })

  it('team trend: mean load among observed athletes only, never zero-filled', () => {
    const view = teamReadinessView(ds, '2026-09-05', 7, null)
    const last = view.days[view.days.length - 1]!
    expect(last.date).toBe('2026-09-05')
    expect(last.meanLoad).toBeCloseTo((480 + 450) / 2, 5)
    expect(last.observedCount).toBe(2)
    expect(last.validAcwrCount).toBe(0)
  })

  it('athlete series: rest = 0, missing = null gap', () => {
    const a2 = athleteReadinessSeries(ds, 'A2', '2026-09-05', 7)
    const missingDay = a2.find((d) => d.date === '2026-09-02')!
    expect(missingDay.load).toBeNull() // participated, no device data
    const a1 = athleteReadinessSeries(ds, 'A1', '2026-09-05', 7)
    const restDay = a1.find((d) => d.date === '2026-08-30')!
    expect(restDay.load).toBe(0) // confirmed no-session day
  })
})

describe('gpsSessionOverview', () => {
  it('lists only field sessions and aggregates team stats over athletes with data', () => {
    const view = gpsSessionOverview(ds, '2026-09-04', null, null)
    expect(view.sessionsOnDate.map((s) => s.id)).toEqual(['S4', 'S5']) // lift excluded
    expect(view.session?.id).toBe('S4')
    const load = view.teamStats.find((s) => s.kpi.key === 'player_load')!
    expect(load.mean).toBeCloseTo(395, 5)
    expect(load.top).toBe(400)
    expect(load.n).toBe(2)
  })
})

describe('gpsSessionCompare', () => {
  it('aligns athlete values across sessions and drops all-empty athletes', () => {
    const view = gpsSessionCompare(ds, ['S1', 'S7'], 'total_distance', null)
    expect(view.sessions.map((s) => s.id)).toEqual(['S1', 'S7'])
    const a1 = view.rows.find((r) => r.athleteId === 'A1')!
    expect(a1.values).toEqual([4400, 3500])
    expect(view.rows.some((r) => r.athleteId === 'A3')).toBe(false) // GK: no data
    expect(view.teamMeans[0]).toBeCloseTo(4250, 5)
    expect(view.teamNs).toEqual([2, 2])
  })
})

describe('gpsTrendsView', () => {
  it('produces transparent guidance with a target band when the window is complete', () => {
    const view = gpsTrendsView(ds, '2026-09-05', null)
    expect(view.completeness.missing).toBe(0)
    expect(view.guidance.teamAcwr).not.toBeNull()
    // one intense week over an empty preseason → elevated, recovery emphasis
    expect(view.guidance.label).toBe('recovery emphasis')
    expect(view.guidance.targetBand).not.toBeNull()
    const acute = view.recommendations.find((r) => r.id === 'acute-vs-chronic')!
    expect(acute.rule).toMatch(/≥ 20%/)
    // all three athletes lack a complete personal window → stated, not hidden
    const incomplete = view.recommendations.find((r) => r.id === 'incomplete-windows')!
    expect(incomplete.headline).toMatch(/3 athletes/)
  })
})

describe('metricTrendView', () => {
  it('group mode: one series per group with members, gaps where no data', () => {
    const view = metricTrendView(ds, 'back_squat_top_load', '2026-08-18', '2026-09-05', 'group', {
      position: null,
      groups: GROUPS,
    })
    expect(view.dates).toEqual(['2026-08-20', '2026-08-27', '2026-09-04'])
    const forwards = view.series.find((s) => s.key === 'Forward')!
    expect(forwards.values).toEqual([180, 185, 190])
    const mids = view.series.find((s) => s.key === 'Midfielder')!
    expect(mids.values).toEqual([null, null, 165])
    // goalkeepers have no back-squat data → no series rather than zeros
    expect(view.series.some((s) => s.key === 'Goalkeeper')).toBe(false)
  })

  it('individual mode: athlete plus team-mean context series', () => {
    const view = metricTrendView(
      ds,
      'back_squat_top_load',
      '2026-08-18',
      '2026-09-05',
      'individual',
      { athleteId: 'A1', groups: GROUPS },
    )
    expect(view.series[0]!.label).toBe('Ada Fast')
    expect(view.series[1]!.label).toBe('Team mean')
    expect(view.series[1]!.values[2]).toBeCloseTo((190 + 165) / 2, 5)
  })
})

describe('performance selectors', () => {
  it('overview tiles carry team medians and comparison counts', () => {
    const tiles = performanceOverview(ds, '2026-09-05', 'prior_session', null)
    const squat = tiles.find((t) => t.kpi.key === 'back_squat_top_load')!
    expect(squat.median).toBeCloseTo(177.5, 5)
    expect(squat.withData).toBe(2)
    expect(squat.groupSize).toBe(3)
  })

  it('leaderboard ranks by latest value and lists non-participants separately', () => {
    const view = leaderboardView(ds, 'back_squat_top_load', 'prior_session', '2026-09-05', null)
    expect(view.rows.map((r) => [r.rank, r.name])).toEqual([
      [1, 'Ada Fast'],
      [2, 'Bea Steady'],
    ])
    expect(view.rows[0]!.deltaPct).toBeCloseTo((5 / 185) * 100, 5)
    expect(view.withoutData).toBe(1)
  })

  it('profile refuses percentiles below five comparison athletes', () => {
    const view = athleteProfileView(ds, 'A1', '2026-09-05', null)
    const squat = view.axes.find((a) => a.kpi.key === 'back_squat_top_load')!
    expect(squat.value).toBe(190)
    expect(squat.percentile).toBeNull()
    expect(squat.reason).toMatch(/needs ≥ 5 comparison athletes/)
  })

  it('computes direction-aware percentiles with enough athletes', () => {
    const athletes = ['A', 'B', 'C', 'D', 'E', 'F', 'G'].map((id, i) => ({
      id,
      firstName: id,
      lastName: `Test${id}`,
      fullName: `${id} Test${id}`,
      position: 'Forward' as const,
      jerseyNumber: i + 1,
      yearsOnTeam: 1,
    }))
    const values: Record<string, number> = { A: 100, B: 110, C: 120, D: 130, E: 140, F: 150, G: 145 }
    const mini = buildDataset({
      seasonLabel: 'Mini',
      seasonStart: '2026-09-01',
      seasonEnd: '2026-09-02',
      athletes,
      sessions: [
        {
          id: 'L1',
          date: '2026-09-01',
          startTime: '16:00',
          label: 'Lift',
          type: 'lift',
          kind: 'lift',
        },
      ],
      availability: [],
      participation: athletes.map((a) => ({
        athleteId: a.id,
        sessionId: 'L1',
        level: 'full' as const,
        exposureMin: 60,
      })),
      observations: athletes.map((a) => ({
        athleteId: a.id,
        sessionId: 'L1',
        kpiKey: 'back_squat_top_load',
        value: values[a.id]!,
      })),
      kpis: [
        {
          key: 'back_squat_top_load',
          displayName: 'Back Squat',
          category: 'Strength',
          canonicalUnit: 'lb',
          unit: 'lb',
          decimalPlaces: 0,
          interpretation: 'higher_is_better',
          visibility: { overview: true, monitoring: true, trends: true, leaderboards: true, profile: true },
        },
      ],
    })
    const view = athleteProfileView(mini, 'G', '2026-09-02', null)
    const axis = view.axes[0]!
    expect(axis.comparisonN).toBe(6)
    // 5 of 6 comparison values below 145 → P83
    expect(axis.percentile).toBeCloseTo((5 / 6) * 100, 5)
    expect(axis.groupBest).toBe(150)
  })
})

describe('settings overrides', () => {
  const kpi: DashKpi = {
    key: 'total_distance',
    displayName: 'Total Distance',
    category: 'GPS',
    canonicalUnit: 'yd',
    unit: 'yd',
    decimalPlaces: 0,
    interpretation: 'neutral',
    visibility: { overview: true, monitoring: true, trends: true, leaderboards: false, profile: true },
  }

  it('applies display overrides and validates unit convertibility', () => {
    const effective = applyKpiOverride(kpi, {
      displayName: 'Distance',
      displayUnit: 'm',
      decimalPlaces: 1,
      visibility: { overview: false },
    })
    expect(effective.displayName).toBe('Distance')
    expect(effective.unit).toBe('m')
    expect(effective.canonicalUnit).toBe('yd') // canonical never moves (§6.3)
    expect(effective.visibility.overview).toBe(false)
    expect(effective.visibility.monitoring).toBe(true)

    const invalid = applyKpiOverride(kpi, { displayUnit: 'kg' })
    expect(invalid.unit).toBe('yd') // incompatible unit override ignored
  })

  it('thresholds default to the shipped values', () => {
    expect(DEFAULT_THRESHOLDS.speedFlagThresholdPct).toBe(90)
    expect(DEFAULT_THRESHOLDS.acwrElevatedBand).toBeCloseTo(1.3, 10)
    expect(DEFAULT_THRESHOLDS.acwrHighBand).toBeCloseTo(1.5, 10)
  })
})

describe('coach-feedback: overview presentation', () => {
  it('Last Session GPS leads with Player Load and labels values as averages', () => {
    const v = lastSessionGpsView(ds, '2026-09-05')!
    // default metric set leads with Player Load (coach-feedback default)
    expect(v.metrics[0]?.kpiKey).toBe('player_load')
    // team scope is always average per participating athlete, never a total
    expect(v.metrics.every((m) => m.aggLabel === 'average per athlete')).toBe(true)
    // S7 player_load = mean(480, 450) = 465
    expect(v.metrics[0]?.value).toBe(465)
  })

  it('honours the coach-selected GPS metric set and drops unknown keys', () => {
    const v = lastSessionGpsView(ds, '2026-09-05', ['top_speed', 'total_distance', 'not_a_metric'])!
    expect(v.metrics.map((m) => m.kpiKey)).toEqual(['top_speed', 'total_distance'])
  })

  it('Load Health exposes four labelled states plus team ACWR and 7-day load', () => {
    const v = loadHealthView(ds, '2026-09-05', null)
    expect(v.bands.map((b) => b.key)).toEqual(['below', 'within', 'elevated', 'high'])
    // each state carries a text label, never colour alone (§12.5)
    expect(v.bands.every((b) => b.short.length > 0)).toBe(true)
    // team-level numbers are present as numbers or explicit null (never NaN)
    expect(v.avgAcute7dLoad === null || Number.isFinite(v.avgAcute7dLoad)).toBe(true)
    expect(v.teamMedianAcwr === null || Number.isFinite(v.teamMedianAcwr)).toBe(true)
  })

  it('bandFor separates elevated (yellow) from substantially elevated (red)', () => {
    expect(bandFor(1.4, DEFAULT_THRESHOLDS)).toBe('elevated')
    expect(bandFor(1.7, DEFAULT_THRESHOLDS)).toBe('high')
  })

  it('session-type summary distinguishes same-day sessions', () => {
    expect(sessionTypeSummary([])).toBe('')
    // 2026-09-04 has AM Practice + PM Practice + Lift in the fixture
    expect(sessionTypeSummary(ds.sessionsByDate.get('2026-09-04') ?? [])).toBe('2 × Practice + Lift')
    expect(sessionTypeSummary(ds.sessionsByDate.get('2026-09-05') ?? [])).toBe('Game')
  })
})
