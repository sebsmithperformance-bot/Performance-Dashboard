/**
 * Default settings — the single source for every coach-tunable threshold's
 * shipped value. Selector modules take a ThresholdSettings argument that
 * defaults to DEFAULT_THRESHOLDS, so calculations behave identically with or
 * without the settings context.
 */
import type {
  CompetitionSettings,
  DashboardSettings,
  PositionGroup,
  ThresholdSettings,
} from './types.ts'

export const DEFAULT_THRESHOLDS: ThresholdSettings = {
  speedFlagThresholdPct: 90, // §5.1 whiteboard rule
  speedMinBaselineSamples: 3, // §3.1
  speedMinExposureMin: 25, // §8 QA speed-exposure rule
  acwrBelowBand: 0.8,
  acwrElevatedBand: 1.3,
  acwrHighBand: 1.5,
  percentChangeUnchangedBandPct: 2,
}

/**
 * Canonical GPS metrics on the Team Snapshot → Last Session GPS tile. Player
 * Load is not front-facing (§5), so it never leads or appears here. Coaches
 * add/remove via the Customize drawer; an empty override falls back to this.
 */
export const DEFAULT_OVERVIEW_GPS_METRICS = [
  'total_distance',
  'high_speed_distance',
  'top_speed',
]

/** GPS/Load metrics the coach may surface on the Last Session GPS tile,
 *  canonical order. The Customize drawer offers exactly these; selection is
 *  stored in DisplayPreferences.overviewGpsMetrics. Player Load is excluded. */
export const OVERVIEW_GPS_SUPPORTED = [
  'total_distance',
  'high_speed_distance',
  'top_speed',
  'sprints',
  'accelerations',
  'decelerations',
  'workload',
]

/** S&C KPIs that generate competition points out of the box (§10). Load, GPS,
 *  workload and health metrics are deliberately excluded — they never score. */
const DEFAULT_COMPETITION_ABSOLUTE = [
  'back_squat_top_load',
  'bench_press_top_load',
  'trap_bar_deadlift_top_load',
  'power_clean_top_load',
  'back_squat_mean_power',
  'power_clean_peak_power',
]
const DEFAULT_COMPETITION_RELATIVE = [
  'back_squat_top_load',
  'bench_press_top_load',
  'trap_bar_deadlift_top_load',
  'power_clean_top_load',
]

export function defaultCompetition(): CompetitionSettings {
  const eligibleKpis: CompetitionSettings['eligibleKpis'] = {}
  for (const key of DEFAULT_COMPETITION_ABSOLUTE) {
    eligibleKpis[key] = { absolute: true, relative: DEFAULT_COMPETITION_RELATIVE.includes(key) }
  }
  return {
    // two on-brand demo teams so Team Standings is populated in the prototype;
    // athletes auto-assign round-robin until the coach sets explicit teams
    teams: [
      { id: 'crimson', name: 'Crimson' },
      { id: 'navy', name: 'Navy' },
    ],
    athleteTeam: {},
    bodyWeightLb: {},
    eligibleKpis,
    scoringProfiles: [
      {
        id: 'default',
        name: 'Standard place points',
        effectiveFrom: '1970-01-01',
        placePoints: [10, 7, 5, 3, 2, 1],
      },
    ],
    defaultProfileId: 'default',
    savedRanges: [],
    tvRotation: false,
    splitScreen: false,
  }
}

export const DEFAULT_POSITIONS: PositionGroup[] = [
  { id: 'Goalkeeper', label: 'Goalkeepers', builtin: true, retired: false },
  { id: 'Defender', label: 'Defenders', builtin: true, retired: false },
  { id: 'Midfielder', label: 'Midfielders', builtin: true, retired: false },
  { id: 'Forward', label: 'Forwards', builtin: true, retired: false },
]

export function defaultSettings(): DashboardSettings {
  return {
    version: 1,
    kpi: {},
    thresholds: { ...DEFAULT_THRESHOLDS },
    // empty = canonical structure, nothing hidden (see DashboardLayoutConfig)
    layout: {
      areaOrder: [],
      hiddenAreas: [],
      categoryOrder: {},
      hiddenCategories: [],
      pageOrder: {},
      hiddenPages: [],
      hiddenWidgets: [],
      widgetOrder: {},
    },
    positions: DEFAULT_POSITIONS.map((p) => ({ ...p })),
    display: {
      defaultComparisonBasis: 'prior_week',
      defaultScChangeKpi: null,
      // least-used metric columns start hidden (visual-review #5)
      athletesDefaultHiddenKpis: ['yards_per_minute', 'sprint_distance', 'high_intensity_events'],
      // empty = DEFAULT_OVERVIEW_GPS_METRICS
      overviewGpsMetrics: [],
      kpiCardSize: 'compact',
    },
    customKpis: [],
    kpiThresholds: {},
    competition: defaultCompetition(),
    annualPlan: { fileName: null, fileUrl: null, lastUpdated: null },
  }
}

/**
 * Order `items` by an id order from the layout config. Ids missing from the
 * config keep canonical order at the end; stale config ids are ignored — the
 * config is a deviation, not the source of what exists.
 */
export function orderByConfig<T>(items: T[], idOf: (item: T) => string, order: string[]): T[] {
  if (order.length === 0) return items
  const rank = new Map(order.map((id, i) => [id, i]))
  return [...items].sort((a, b) => {
    const ra = rank.get(idOf(a)) ?? order.length + items.indexOf(a)
    const rb = rank.get(idOf(b)) ?? order.length + items.indexOf(b)
    return ra - rb
  })
}
