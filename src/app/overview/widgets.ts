/**
 * §4 Team Snapshot tile catalog: the fixed set of clickable summary tiles.
 * Data Management / Customize can hide/reorder these — never invent new ones
 * or change what they compute (structural customization only).
 */
export const OVERVIEW_PAGE_ID = 'overview-team'

export interface OverviewWidgetDef {
  id: string
  label: string
}

/** Seven clickable summary tiles; each opens a drill-down drawer (§4). */
export const OVERVIEW_WIDGETS: OverviewWidgetDef[] = [
  { id: 'availability', label: 'Availability' },
  { id: 'workload', label: 'Workload' },
  { id: 'load_health', label: 'Load Health' },
  { id: 'speed_flags', label: 'Speed Flags' },
  { id: 'last_session_gps', label: 'Last Session GPS' },
  { id: 'sc_change', label: 'S&C Change' },
  { id: 'data_completeness', label: 'Data Completeness' },
]
