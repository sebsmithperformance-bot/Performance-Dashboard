/**
 * Central KPI → chart-series registry (§12.2): the same KPI keeps the same
 * color everywhere in the application. Tokens only — never hex values.
 */
const SERIES_TOKENS = [
  'var(--chart-series-1)',
  'var(--chart-series-2)',
  'var(--chart-series-3)',
  'var(--chart-series-4)',
  'var(--chart-series-5)',
  'var(--chart-series-6)',
] as const

const KPI_SERIES: Record<string, number> = {
  // Load / GPS core
  player_load: 1,
  total_distance: 2,
  high_speed_distance: 4,
  top_speed: 5,
  workload: 3,
  sprints: 6,
  sprint_distance: 6,
  accelerations: 4,
  decelerations: 3,
  high_intensity_events: 5,
  yards_per_minute: 2,
  // Strength
  back_squat_top_load: 1,
  bench_press_top_load: 2,
  trap_bar_deadlift_top_load: 4,
  power_clean_top_load: 5,
  // Power
  back_squat_mean_power: 1,
  bench_press_mean_power: 2,
  trap_bar_deadlift_mean_power: 4,
  power_clean_peak_power: 5,
}

export function kpiColor(kpiKey: string): string {
  const series = KPI_SERIES[kpiKey] ?? 3
  return SERIES_TOKENS[series - 1] ?? SERIES_TOKENS[2]
}
