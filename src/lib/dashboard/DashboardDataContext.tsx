/**
 * Dashboard data context: loads the dataset once through the injected
 * provider and carries the global season/date/session selection (the topbar
 * context every page shares). Pages read view models via selectors; they
 * never touch the provider internals.
 */
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { applyKpiOverride, customKpiToDashKpi, useSettings } from '../settings/SettingsContext.tsx'

/** §5: KPIs kept out of every coach-facing surface (still stored/imported). */
const COACH_HIDDEN_KPIS = new Set(['player_load'])
import type {
  DashAvailabilityDay,
  DashboardDataProvider,
  DashboardDataset,
  SavedViewsStore,
} from './types.ts'

export type DashboardDataStatus = 'loading' | 'ready' | 'error'

interface DashboardDataValue {
  status: DashboardDataStatus
  error: string | null
  dataset: DashboardDataset | null
  savedViews: SavedViewsStore
  /** Global date context (defaults to the latest session date). */
  selectedDate: string | null
  setSelectedDate: (date: string) => void
  /** Coach availability edit (§5.2) — persists through the provider seam. */
  setAvailability: (entry: DashAvailabilityDay) => void
}

const DashboardDataContext = createContext<DashboardDataValue | null>(null)

export function DashboardDataProviderBoundary({
  provider,
  children,
}: {
  provider: DashboardDataProvider
  children: ReactNode
}) {
  const [status, setStatus] = useState<DashboardDataStatus>('loading')
  const [error, setError] = useState<string | null>(null)
  const [dataset, setDataset] = useState<DashboardDataset | null>(null)
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const { settings } = useSettings()
  const [availabilityOverrides, setAvailabilityOverrides] = useState<DashAvailabilityDay[]>(() =>
    provider.availability.loadOverrides(),
  )

  // Coach KPI display overrides (§5.5) and availability edits (§5.2) applied
  // once here: every selector and page downstream sees the effective dataset;
  // observations stay canonical.
  const effectiveDataset = useMemo<DashboardDataset | null>(() => {
    if (!dataset) return null
    // §5: Player Load is not front-facing — the 1–10 Workload metric replaces it
    // everywhere in the coach UI. Observations stay canonical (imports, raw
    // records, and back-compat fixtures keep player_load); it is only removed
    // from the display registry so no coach surface lists or defaults to it.
    const kpis = new Map(
      [...dataset.kpis]
        .filter(([key]) => !COACH_HIDDEN_KPIS.has(key))
        .map(([key, kpi]) => [key, applyKpiOverride(kpi, settings.kpi[key])]),
    )
    // coach-defined KPIs join the registry (empty until data is mapped); display
    // overrides still layer on top, and existing keys are never clobbered.
    for (const def of settings.customKpis) {
      if (def.retired || kpis.has(def.key)) continue
      kpis.set(def.key, applyKpiOverride(customKpiToDashKpi(def), settings.kpi[def.key]))
    }
    let availability = dataset.availability
    let availabilityByKey = dataset.availabilityByKey
    if (availabilityOverrides.length > 0) {
      availabilityByKey = new Map(dataset.availabilityByKey)
      for (const entry of availabilityOverrides) {
        availabilityByKey.set(`${entry.athleteId}|${entry.date}`, entry)
      }
      availability = [...availabilityByKey.values()]
    }
    return { ...dataset, kpis, availability, availabilityByKey }
  }, [dataset, settings.kpi, settings.customKpis, availabilityOverrides])

  useEffect(() => {
    let cancelled = false
    provider
      .load()
      .then((d) => {
        if (cancelled) return
        setDataset(d)
        setStatus('ready')
        const lastSession = d.sessions[d.sessions.length - 1]
        if (lastSession) setSelectedDate((current) => current ?? lastSession.date)
      })
      .catch((err: unknown) => {
        if (cancelled) return
        setError(err instanceof Error ? err.message : String(err))
        setStatus('error')
      })
    return () => {
      cancelled = true
    }
  }, [provider])

  const value = useMemo<DashboardDataValue>(
    () => ({
      status,
      error,
      dataset: effectiveDataset,
      savedViews: provider.savedViews,
      selectedDate,
      setSelectedDate,
      setAvailability: (entry: DashAvailabilityDay) => {
        provider.availability.saveOverride(entry)
        setAvailabilityOverrides((current) => [
          ...current.filter((e) => !(e.athleteId === entry.athleteId && e.date === entry.date)),
          entry,
        ])
      },
    }),
    [status, error, effectiveDataset, provider, selectedDate],
  )

  return <DashboardDataContext.Provider value={value}>{children}</DashboardDataContext.Provider>
}

export function useDashboardData(): DashboardDataValue {
  const value = useContext(DashboardDataContext)
  if (!value) throw new Error('useDashboardData must be used inside DashboardDataProviderBoundary')
  return value
}
