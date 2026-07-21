/**
 * Settings context: loads once from the injected SettingsRepository, persists
 * every change back through it, and exposes scoped updaters so pages never
 * hand-roll merge logic. Sits ABOVE the dashboard data boundary — the
 * boundary applies KPI overrides to the dataset it publishes.
 */
import { createContext, useContext, useMemo, useState, type ReactNode } from 'react'
import { canConvert, type Unit } from '../units/index.ts'
import type { DashKpi } from '../dashboard/types.ts'
import { defaultSettings } from './defaults.ts'
import type {
  AnnualPlanSettings,
  CompetitionSettings,
  CustomKpiDef,
  DashboardLayoutConfig,
  DashboardSettings,
  DisplayPreferences,
  KpiOverride,
  KpiThreshold,
  PositionGroup,
  SavedRange,
  SettingsRepository,
  ThresholdSettings,
} from './types.ts'

interface SettingsValue {
  settings: DashboardSettings
  updateKpi: (key: string, override: KpiOverride | null) => void
  updateThresholds: (patch: Partial<ThresholdSettings>) => void
  updateLayout: (patch: Partial<DashboardLayoutConfig>) => void
  updateDisplay: (patch: Partial<DisplayPreferences>) => void
  setPositions: (positions: PositionGroup[]) => void
  setCustomKpis: (defs: CustomKpiDef[]) => void
  setKpiThresholds: (kpiKey: string, thresholds: KpiThreshold[]) => void
  updateCompetition: (patch: Partial<CompetitionSettings>) => void
  setAnnualPlan: (plan: AnnualPlanSettings) => void
  setSavedRanges: (scope: string, ranges: SavedRange[]) => void
  setDefaultRange: (scope: string, id: string | null) => void
  resetLayout: () => void
  resetThresholds: () => void
}

const SettingsContext = createContext<SettingsValue | null>(null)

export function SettingsProvider({
  repository,
  children,
}: {
  repository: SettingsRepository
  children: ReactNode
}) {
  const [settings, setSettings] = useState<DashboardSettings>(() => repository.load())

  const value = useMemo<SettingsValue>(() => {
    const commit = (next: DashboardSettings) => {
      repository.save(next)
      setSettings(next)
    }
    return {
      settings,
      updateKpi: (key, override) => {
        const kpi = { ...settings.kpi }
        if (override === null || Object.keys(override).length === 0) delete kpi[key]
        else kpi[key] = override
        commit({ ...settings, kpi })
      },
      updateThresholds: (patch) =>
        commit({ ...settings, thresholds: { ...settings.thresholds, ...patch } }),
      updateLayout: (patch) => commit({ ...settings, layout: { ...settings.layout, ...patch } }),
      updateDisplay: (patch) => commit({ ...settings, display: { ...settings.display, ...patch } }),
      setPositions: (positions) => commit({ ...settings, positions }),
      setCustomKpis: (customKpis) => commit({ ...settings, customKpis }),
      setKpiThresholds: (kpiKey, thresholds) => {
        const next = { ...settings.kpiThresholds }
        if (thresholds.length === 0) delete next[kpiKey]
        else next[kpiKey] = thresholds
        commit({ ...settings, kpiThresholds: next })
      },
      updateCompetition: (patch) =>
        commit({ ...settings, competition: { ...settings.competition, ...patch } }),
      setAnnualPlan: (annualPlan) => commit({ ...settings, annualPlan }),
      setSavedRanges: (scope, ranges) => {
        const next = { ...settings.savedRanges }
        if (ranges.length === 0) delete next[scope]
        else next[scope] = ranges
        commit({ ...settings, savedRanges: next })
      },
      setDefaultRange: (scope, id) => {
        const next = { ...settings.defaultRanges }
        if (id === null) delete next[scope]
        else next[scope] = id
        commit({ ...settings, defaultRanges: next })
      },
      resetLayout: () => commit({ ...settings, layout: defaultSettings().layout }),
      resetThresholds: () => commit({ ...settings, thresholds: defaultSettings().thresholds }),
    }
  }, [repository, settings])

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>
}

export function useSettings(): SettingsValue {
  const value = useContext(SettingsContext)
  if (!value) throw new Error('useSettings must be used inside SettingsProvider')
  return value
}

/** Active position groups in display order (retired ones excluded). */
export function activePositionGroups(settings: DashboardSettings): PositionGroup[] {
  return settings.positions.filter((p) => !p.retired)
}

/** Display label for a canonical position id (rename-aware). */
export function positionLabel(settings: DashboardSettings, positionId: string): string {
  const group = settings.positions.find((p) => p.id === positionId)
  if (!group) return positionId
  // built-ins keep the singular canonical name for per-athlete rows unless renamed
  if (group.builtin && group.label === `${positionId}s`) return positionId
  return group.label
}

/** Map a coach-defined KPI to a registry entry (empty until data is mapped). */
export function customKpiToDashKpi(def: CustomKpiDef): DashKpi {
  return {
    key: def.key,
    displayName: def.displayName,
    category: def.category,
    canonicalUnit: def.canonicalUnit,
    unit: def.unit,
    decimalPlaces: def.decimalPlaces,
    interpretation: def.interpretation,
    visibility: def.visibility,
    source: def.source,
  }
}

/**
 * Generate a safe, unique internal key from a display name. Non-alphanumerics
 * collapse to underscores; collisions with existing keys get a numeric suffix.
 */
export function makeKpiKey(displayName: string, existingKeys: Iterable<string>): string {
  const taken = new Set(existingKeys)
  const base =
    displayName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '') || 'kpi'
  if (!taken.has(base)) return base
  let n = 2
  while (taken.has(`${base}_${n}`)) n += 1
  return `${base}_${n}`
}

/**
 * Apply per-KPI overrides to a registry entry. Display units apply only when
 * the unit registry can convert from the canonical unit (§6.3 — canonical
 * storage is untouched); invalid overrides are ignored, never half-applied.
 */
export function applyKpiOverride(kpi: DashKpi, override: KpiOverride | undefined): DashKpi {
  if (!override) return kpi
  const unit =
    override.displayUnit &&
    canConvert(kpi.canonicalUnit as Unit, override.displayUnit as Unit)
      ? override.displayUnit
      : kpi.unit
  return {
    ...kpi,
    displayName: override.displayName?.trim() ? override.displayName.trim() : kpi.displayName,
    unit,
    decimalPlaces: override.decimalPlaces ?? kpi.decimalPlaces,
    interpretation: override.interpretation ?? kpi.interpretation,
    category: override.category ?? kpi.category,
    visibility: { ...kpi.visibility, ...override.visibility },
  }
}
