/**
 * Coach-facing customization settings (§5.5, Step 5). One plain object,
 * persisted whole through the SettingsRepository seam: localStorage locally,
 * a settings table/AppSync mutation after the AWS spike. Formulas and
 * canonical units are deliberately NOT representable here — only display,
 * layout, threshold, and position-group configuration.
 */
import type { ComparisonBasis, DashKpi, KpiInterpretation, KpiVisibility } from '../dashboard/types.ts'

/**
 * A coach-defined KPI. It joins the registry through the settings seam and
 * stays empty (no observations) until source data is mapped or imported —
 * calculation formulas are never authored here (§6.3). Retiring hides it
 * without deleting the definition.
 */
export interface CustomKpiDef {
  key: string
  displayName: string
  category: DashKpi['category']
  /** approved storage unit — fixed once created */
  canonicalUnit: string
  unit: string
  decimalPlaces: number
  interpretation: KpiInterpretation
  visibility: KpiVisibility
  /** TeamBuildr | PlayerData | Perch | Derived */
  source: string
  /** how same-athlete values combine in team views, where supported */
  aggregation: 'sum' | 'mean' | 'max' | 'latest'
  validMin: number | null
  validMax: number | null
  retired: boolean
}

/**
 * A per-KPI display threshold band. Affects only transparent display
 * interpretation and flags — it never changes stored values and never creates
 * an injury prediction (§6.8). Open-ended bounds use null.
 */
export interface KpiThreshold {
  id: string
  label: string
  lower: number | null
  upper: number | null
  /** semantic display category (never colour alone in the UI) */
  state: 'good' | 'warning' | 'danger' | 'neutral'
  explanation: string
  active: boolean
}

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
  /**
   * ACWR display band edges, four transparent states:
   * below < acwrBelowBand ≤ within ≤ acwrElevatedBand < elevated ≤ acwrHighBand < substantially elevated
   */
  acwrBelowBand: number
  acwrElevatedBand: number
  /** above this = "substantially elevated acute load" (the red state) */
  acwrHighBand: number
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
  /** top-level product area ids in display order */
  areaOrder: string[]
  /** hidden area ids */
  hiddenAreas: string[]
  /** area id → category ids in display order */
  categoryOrder: Record<string, string[]>
  /** hidden category ids */
  hiddenCategories: string[]
  /** category id → page ids in display order */
  pageOrder: Record<string, string[]>
  /** hidden page ids (page id = route path) */
  hiddenPages: string[]
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
  /** GPS metric keys shown on the Last Session GPS tile, in order;
   *  empty = the canonical default set (Player Load is never included) */
  overviewGpsMetrics: string[]
  /** KPI card density — compact packs more per row, wide gives each card room */
  kpiCardSize: 'compact' | 'wide'
}

/** An intra-squad competition team (§10). */
export interface CompetitionTeam {
  id: string
  name: string
}

/** A dated place→points scale (§10). The profile effective on a session's date
 *  is the one with the latest effectiveFrom on or before it. */
export interface ScoringProfile {
  id: string
  name: string
  /** ISO date; applies to sessions on/after this date */
  effectiveFrom: string
  /** points by finishing place: placePoints[0] = 1st place; places past the
   *  end score 0 */
  placePoints: number[]
}

/** Whether a KPI generates competition points, and in which scoring modes. */
export interface CompetitionKpiEligibility {
  absolute: boolean
  /** relative-to-bodyweight — only where a body weight exists for the athlete */
  relative: boolean
}

/**
 * Competition configuration (§10) — a self-contained points game, isolated
 * from all performance monitoring. Points never appear outside the Competition
 * section, and only explicitly eligible KPIs score (never Workload, ACWR,
 * monotony, strain, availability, health, or completeness).
 */
export interface CompetitionSettings {
  teams: CompetitionTeam[]
  /** athleteId → teamId; unassigned athletes fall back to a deterministic
   *  round-robin over the configured teams so the prototype is never empty */
  athleteTeam: Record<string, string>
  /** athleteId → body weight in lb, for relative scoring */
  bodyWeightLb: Record<string, number>
  /** kpiKey → eligibility; a KPI absent here is not scored */
  eligibleKpis: Record<string, CompetitionKpiEligibility>
  scoringProfiles: ScoringProfile[]
  defaultProfileId: string
  /** display flags for a kiosk/TV context (§10 config surface) */
  tvRotation: boolean
  splitScreen: boolean
}

/**
 * Annual Plan link (§11) — a single configured Excel workbook link/path, the
 * leanest possible integration. No sheet parsing, editing, or sync; a future
 * workbook reader replaces the link card behind this same interface.
 */
export interface AnnualPlanSettings {
  fileName: string | null
  fileUrl: string | null
  lastUpdated: string | null
}

/**
 * A named custom date range, saved for one-click reuse (§6). Shared by every
 * page that has a custom date-range selector; ranges are scoped by a page/area
 * key so each product area keeps its own list and active range independent.
 */
export interface SavedRange {
  id: string
  label: string
  from: string
  to: string
}

export interface DashboardSettings {
  version: 1
  /** per-KPI display overrides, keyed by KPI key */
  kpi: Record<string, KpiOverride>
  thresholds: ThresholdSettings
  layout: DashboardLayoutConfig
  positions: PositionGroup[]
  display: DisplayPreferences
  /** coach-defined KPI definitions layered onto the registry */
  customKpis: CustomKpiDef[]
  /** per-KPI display threshold bands, keyed by KPI key */
  kpiThresholds: Record<string, KpiThreshold[]>
  /** standalone Competition configuration (§10) */
  competition: CompetitionSettings
  /** single configured Annual Plan workbook link (§11) */
  annualPlan: AnnualPlanSettings
  /** saved custom date ranges, keyed by scope (page/area) — §6 */
  savedRanges: Record<string, SavedRange[]>
  /** per-scope default saved-range id */
  defaultRanges: Record<string, string>
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
