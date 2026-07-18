/**
 * Default settings — the single source for every coach-tunable threshold's
 * shipped value. Selector modules take a ThresholdSettings argument that
 * defaults to DEFAULT_THRESHOLDS, so calculations behave identically with or
 * without the settings context.
 */
import type { DashboardSettings, PositionGroup, ThresholdSettings } from './types.ts'

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
 * Canonical GPS metrics on the Overview Last Session GPS tile — Player Load
 * leads (coach-feedback default). Coaches add/remove via the Team Dashboard
 * Customize drawer; an empty override falls back to this list.
 */
export const DEFAULT_OVERVIEW_GPS_METRICS = [
  'player_load',
  'total_distance',
  'high_speed_distance',
  'top_speed',
]

/** GPS/Load metrics the coach may surface on the Team Dashboard, canonical
 *  order. The Customize drawer offers exactly these; selection is stored in
 *  DisplayPreferences.overviewGpsMetrics. */
export const OVERVIEW_GPS_SUPPORTED = [
  'player_load',
  'total_distance',
  'high_speed_distance',
  'top_speed',
  'sprints',
  'accelerations',
  'decelerations',
  'workload',
]

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
    layout: { sectionOrder: [], subTabOrder: {}, hiddenWidgets: [], widgetOrder: {} },
    positions: DEFAULT_POSITIONS.map((p) => ({ ...p })),
    display: {
      defaultComparisonBasis: 'prior_week',
      defaultScChangeKpi: null,
      // least-used metric columns start hidden (visual-review #5)
      athletesDefaultHiddenKpis: ['yards_per_minute', 'sprint_distance', 'high_intensity_events'],
      // empty = DEFAULT_OVERVIEW_GPS_METRICS
      overviewGpsMetrics: [],
    },
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
