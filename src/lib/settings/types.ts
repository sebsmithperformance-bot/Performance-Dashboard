/**
 * Coach-facing customization settings (§5.5, Step 5). One plain object,
 * persisted whole through the SettingsRepository seam: localStorage locally,
 * a settings table/AppSync mutation after the AWS spike. Formulas and
 * canonical units are deliberately NOT representable here — only display,
 * layout, threshold, and position-group configuration.
 */
import type { ComparisonBasis, DashKpi, KpiInterpretation, KpiVisibility } from '../dashboard/types.ts'

/**
 * Operational thresholds shown transparently in the UI (§6.9). These tune the
 * *published bands and gates*, never the calculation formulas themselves.
 */
export interface ThresholdSettings {
  /** speed flag: percent-of-personal-best below which a flag raises (§5.1) */
  speedFlagThresholdPct: number
  /** minimum prior valid top-speed observations before a baseline exists */
  speedMinBaselineSamples: number
  /** minimum session exposure minutes for a session to count toward the speed baseline */
  speedMinExposureMin: number
  /** ACWR display band edges (below < acwrBelowBand ≤ within ≤ acwrElevatedBand < elevated) */
  acwrBelowBand: number
  acwrElevatedBand: number
  /** ± percent band treated as "unchanged" in percent-change classification */
  percentChangeUnchangedBandPct: number
}

/** Per-KPI display overrides layered over the registry defaults. */
export interface KpiOverride {
  displayName?: string
  /** validated against canConvert(canonicalUnit, displayUnit) before applying */
  displayUnit?: string
  decimalPlaces?: number
  interpretation?: KpiInterpretation
  category?: DashKpi['category']
  visibility?: Partial<KpiVisibility>
}

/** A position group. Built-ins carry the canonical Position name as id;
 *  retiring hides a group from filters without touching historical data. */
export interface PositionGroup {
  id: string
  label: string
  builtin: boolean
  retired: boolean
}

/**
 * Structural layout customization only (§5.5) — never a page builder. Empty
 * arrays/records mean "canonical order, nothing hidden"; the apply helpers
 * treat the config as a deviation from the canonical structure, so new
 * sections/widgets added in code appear automatically.
 */
export interface DashboardLayoutConfig {
  /** primary section base paths in display order */
  sectionOrder: string[]
  /** section base path → sub-tab paths in display order */
  subTabOrder: Record<string, string[]>
  /** hidden optional widget ids */
  hiddenWidgets: string[]
  /** page id → widget ids in display order */
  widgetOrder: Record<string, string[]>
}

export interface DisplayPreferences {
  defaultComparisonBasis: ComparisonBasis
  /** default S&C metric for the Overview % Change tile; null = first eligible */
  defaultScChangeKpi: string | null
  /** metric columns hidden by default on the Overview Athletes table */
  athletesDefaultHiddenKpis: string[]
}

export interface DashboardSettings {
  version: 1
  /** per-KPI display overrides, keyed by KPI key */
  kpi: Record<string, KpiOverride>
  thresholds: ThresholdSettings
  layout: DashboardLayoutConfig
  positions: PositionGroup[]
  display: DisplayPreferences
}

/**
 * Persistence seam. Local implementation = localStorage; the AWS
 * implementation persists the same object server-side so layout/threshold
 * choices follow the coach across devices (§5.5).
 */
export interface SettingsRepository {
  load(): DashboardSettings
  save(settings: DashboardSettings): void
}
