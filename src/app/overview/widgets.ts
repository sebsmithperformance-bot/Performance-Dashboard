/**
 * Overview Team Dashboard widget catalog (§5.5): the fixed set of widget
 * types. Data Management can hide/reorder these — it can never invent new
 * ones or change what they compute (structural customization only).
 */
export const OVERVIEW_PAGE_ID = 'overview-team'

export interface OverviewWidgetDef {
  id: string
  label: string
  /** spans both columns of the tile grid */
  fullWidth?: boolean
}

/**
 * Four half-width panels → an even two-column grid with no ragged gap. The
 * last-session GPS numbers live in the Team Snapshot strip instead, so the
 * strip and the panels never show the same metric twice.
 */
export const OVERVIEW_WIDGETS: OverviewWidgetDef[] = [
  { id: 'availability', label: 'Availability' },
  { id: 'load_health', label: 'Load Health' },
  { id: 'sc_change', label: 'S&C % Change' },
  { id: 'athlete_flags', label: 'Athlete Flags' },
]
