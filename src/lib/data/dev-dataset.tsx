/**
 * Local synthetic-data context (spec §7.3 local mode). Loads the generated
 * dataset from the dev-only endpoint and exposes exactly what the shell
 * renders: roster size, season label, and the session/date picker. This is a
 * placeholder seam — the real data layer arrives with the backend spike, and
 * pages must treat "absent" as a first-class state, never as zero (§6.7).
 */
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'

export interface DevAthlete {
  id: string
  firstName: string
  lastName: string
  position: string
}

export interface DevSession {
  id: string
  date: string // ISO YYYY-MM-DD
  startTime: string
  label: string
  type: string
}

interface DevDatasetFile {
  seasonYear: number
  seasonStart: string
  seasonEnd: string
  athletes: DevAthlete[]
  sessions: DevSession[]
}

export type DevDataStatus = 'loading' | 'ready' | 'absent'

interface DevDataValue {
  status: DevDataStatus
  seasonLabel: string | null
  athletes: DevAthlete[]
  sessions: DevSession[]
  sessionDates: string[]
  selectedDate: string | null
  setSelectedDate: (date: string) => void
  sessionsOnSelectedDate: DevSession[]
}

const DevDataContext = createContext<DevDataValue | null>(null)

export function DevDataProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<DevDataStatus>('loading')
  const [data, setData] = useState<DevDatasetFile | null>(null)
  const [selectedDate, setSelectedDate] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    fetch('/dev-data/canonical.json')
      .then(async (res) => {
        if (!res.ok) throw new Error(`status ${res.status}`)
        return (await res.json()) as DevDatasetFile
      })
      .then((file) => {
        if (cancelled) return
        setData(file)
        setStatus('ready')
      })
      .catch(() => {
        if (!cancelled) setStatus('absent')
      })
    return () => {
      cancelled = true
    }
  }, [])

  const sessionDates = useMemo(
    () => [...new Set((data?.sessions ?? []).map((s) => s.date))].sort(),
    [data],
  )

  // Default to the most recent session date once data arrives
  useEffect(() => {
    if (selectedDate === null && sessionDates.length > 0) {
      setSelectedDate(sessionDates[sessionDates.length - 1] as string)
    }
  }, [selectedDate, sessionDates])

  const value = useMemo<DevDataValue>(
    () => ({
      status,
      seasonLabel: data ? `${data.seasonYear} Season` : null,
      athletes: data?.athletes ?? [],
      sessions: data?.sessions ?? [],
      sessionDates,
      selectedDate,
      setSelectedDate,
      sessionsOnSelectedDate: (data?.sessions ?? []).filter((s) => s.date === selectedDate),
    }),
    [status, data, sessionDates, selectedDate],
  )

  return <DevDataContext.Provider value={value}>{children}</DevDataContext.Provider>
}

export function useDevData(): DevDataValue {
  const value = useContext(DevDataContext)
  if (!value) throw new Error('useDevData must be used inside DevDataProvider')
  return value
}
