/**
 * Dashboard domain + view-model types (Step 5). This is the shared data-access
 * seam: coach-facing components consume these shapes only, and must never know
 * whether they came from the local synthetic dataset or the future AWS
 * backend. No vendor names, no source-file concepts, no latent generator
 * traits (§8.3 — traits never reach the UI).
 */

export type Position = 'Goalkeeper' | 'Defender' | 'Midfielder' | 'Forward'
export type SessionType = 'practice' | 'lift' | 'game' | 'recovery' | 'testing' | 'other'
export type AvailabilityStatus = 'full_go' | 'limited' | 'out'
export type ParticipationLevel = 'full' | 'modified' | 'absent'

export interface DashAthlete {
  id: string
  firstName: string
  lastName: string
  fullName: string
  position: Position
  jerseyNumber: number | null
  yearsOnTeam: number | null
}

export interface DashSession {
  id: string
  date: string // ISO
  startTime: string
  label: string
  type: SessionType
  /** field sessions carry GPS; lift sessions carry S&C observations */
  kind: 'field' | 'lift'
}

export interface DashAvailabilityDay {
  athleteId: string
  date: string
  status: AvailabilityStatus
  note?: string
}

export interface DashParticipation {
  athleteId: string
  sessionId: string
  level: ParticipationLevel
  exposureMin: number
}

/** One observation: athlete × session × KPI, canonical units. */
export interface DashObservation {
  athleteId: string
  sessionId: string
  kpiKey: string
  value: number
}

export type KpiInterpretation = 'higher_is_better' | 'lower_is_better' | 'target_range' | 'neutral'

export interface DashKpi {
  key: string
  displayName: string
  category: 'Strength' | 'Power' | 'GPS' | 'Load'
  unit: string
  decimalPlaces: number
  interpretation: KpiInterpretation
  inLeaderboards: boolean
  inMonitoring: boolean
  inProfile: boolean
}

export interface DashboardDataset {
  seasonLabel: string
  seasonStart: string
  seasonEnd: string
  athletes: DashAthlete[]
  positions: Position[]
  sessions: DashSession[] // sorted by date, startTime
  availability: DashAvailabilityDay[]
  participation: DashParticipation[]
  observations: DashObservation[]
  kpis: Map<string, DashKpi>
  // ---- prebuilt indexes (built once in the provider) ----
  athleteById: Map<string, DashAthlete>
  sessionById: Map<string, DashSession>
  sessionsByDate: Map<string, DashSession[]>
  observationsBySession: Map<string, DashObservation[]>
  observationsByAthlete: Map<string, DashObservation[]>
  participationByKey: Map<string, DashParticipation> // athleteId|sessionId
  availabilityByKey: Map<string, DashAvailabilityDay> // athleteId|date
}

/** Saved analysis views (§6.4). Local store = localStorage; AWS store = saved_views. */
export interface SavedView {
  name: string
  page: string
  config: Record<string, unknown>
}

export interface SavedViewsStore {
  list(page: string): SavedView[]
  save(view: SavedView): void
  remove(page: string, name: string): void
}

export interface DashboardDataProvider {
  load(): Promise<DashboardDataset>
  savedViews: SavedViewsStore
}
