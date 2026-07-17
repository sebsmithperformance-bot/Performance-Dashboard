/**
 * Dashboard data context: loads the dataset once through the injected
 * provider and carries the global season/date/session selection (the topbar
 * context every page shares). Pages read view models via selectors; they
 * never touch the provider internals.
 */
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { DashboardDataProvider, DashboardDataset, SavedViewsStore } from './types.ts'

export type DashboardDataStatus = 'loading' | 'ready' | 'error'

interface DashboardDataValue {
  status: DashboardDataStatus
  error: string | null
  dataset: DashboardDataset | null
  savedViews: SavedViewsStore
  /** Global date context (defaults to the latest session date). */
  selectedDate: string | null
  setSelectedDate: (date: string) => void
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
      dataset,
      savedViews: provider.savedViews,
      selectedDate,
      setSelectedDate,
    }),
    [status, error, dataset, provider, selectedDate],
  )

  return <DashboardDataContext.Provider value={value}>{children}</DashboardDataContext.Provider>
}

export function useDashboardData(): DashboardDataValue {
  const value = useContext(DashboardDataContext)
  if (!value) throw new Error('useDashboardData must be used inside DashboardDataProviderBoundary')
  return value
}
