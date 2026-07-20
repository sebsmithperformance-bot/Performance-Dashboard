/**
 * localStorage SettingsRepository — the lean local persistence behind the
 * seam (user-approved: no database work for frontend preferences). Corrupt or
 * missing storage falls back to defaults; every save writes the whole object.
 */
import { defaultSettings } from './defaults.ts'
import type { DashboardSettings, SettingsRepository } from './types.ts'

const STORAGE_KEY = 'fh.dashboard-settings.v1'

export function createLocalSettingsRepository(): SettingsRepository {
  return {
    load(): DashboardSettings {
      const base = defaultSettings()
      try {
        const raw = localStorage.getItem(STORAGE_KEY)
        if (!raw) return base
        const stored = JSON.parse(raw) as Partial<DashboardSettings>
        if (stored.version !== 1) return base
        // top-level merge: unknown future keys dropped, missing keys defaulted
        return {
          version: 1,
          kpi: stored.kpi ?? base.kpi,
          thresholds: { ...base.thresholds, ...stored.thresholds },
          layout: { ...base.layout, ...stored.layout },
          positions: stored.positions ?? base.positions,
          display: { ...base.display, ...stored.display },
          customKpis: stored.customKpis ?? base.customKpis,
          kpiThresholds: stored.kpiThresholds ?? base.kpiThresholds,
          competition: { ...base.competition, ...stored.competition },
          annualPlan: { ...base.annualPlan, ...stored.annualPlan },
        }
      } catch {
        return base
      }
    },
    save(settings: DashboardSettings): void {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
    },
  }
}

/** In-memory repository for tests — no cross-test localStorage leakage. */
export function createMemorySettingsRepository(initial?: DashboardSettings): SettingsRepository {
  let stored = initial ?? defaultSettings()
  return {
    load: () => stored,
    save: (settings) => {
      stored = settings
    },
  }
}
