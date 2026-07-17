/**
 * LocalDashboardDataProvider: transforms the generated synthetic season into
 * the dashboard dataset. This is the local stand-in behind the data seam —
 * the future AwsDashboardDataProvider returns the same shapes from AppSync.
 * Latent generator traits are deliberately not mapped (§8.3).
 *
 * Saved views persist to localStorage here; the AWS provider persists to the
 * saved_views table (§6.4 server-side persistence is a production concern).
 */
import { referenceKpiConfigs } from '../import/local/reference-data.ts'
import { buildDataset } from './dataset.ts'
import type {
  DashKpi,
  DashboardDataProvider,
  DashboardDataset,
  Position,
  SavedView,
  SavedViewsStore,
  SessionType,
} from './types.ts'

/** Shape of the generated canonical.json we consume (subset). */
interface CanonicalFile {
  seasonYear: number
  seasonStart: string
  seasonEnd: string
  athletes: {
    id: string
    firstName: string
    lastName: string
    position: Position
    jerseyNumber: number
    yearsOnTeam: number
  }[]
  sessions: {
    id: string
    date: string
    startTime: string
    label: string
    type: SessionType
    kind: 'field' | 'lift'
  }[]
  availability: {
    athleteId: string
    date: string
    status: 'full_go' | 'limited' | 'out'
    note?: string
  }[]
  participation: {
    athleteId: string
    sessionId: string
    level: 'full' | 'modified' | 'absent'
    exposureMin: number
  }[]
  gps: ({ athleteId: string; sessionId: string } & Record<string, unknown>)[]
  lifts: { athleteId: string; sessionId: string; exercise: string; topWorkingLoadLb: number }[]
  perch: { athleteId: string; sessionId: string; exercise: string; powerW: number }[]
}

/** canonical GPS field → KPI key (mirrors the registry; local mapping only) */
const GPS_FIELD_TO_KPI: Record<string, string> = {
  distanceYd: 'total_distance',
  playerLoadAu: 'player_load',
  workload: 'workload',
  sprintDistanceYd: 'sprint_distance',
  highSpeedDistanceYd: 'high_speed_distance',
  highIntensityEvents: 'high_intensity_events',
  yardsPerMinute: 'yards_per_minute',
  sprints: 'sprints',
  topSpeedMph: 'top_speed',
  accelerations: 'accelerations',
  decelerations: 'decelerations',
}

const LIFT_EXERCISE_TO_KPI: Record<string, string> = {
  'Back Squat': 'back_squat_top_load',
  'Bench Press': 'bench_press_top_load',
  'Trap Bar Deadlift': 'trap_bar_deadlift_top_load',
  'Power Clean': 'power_clean_top_load',
}

const PERCH_EXERCISE_TO_KPI: Record<string, string> = {
  'Back Squat': 'back_squat_mean_power',
  'Bench Press': 'bench_press_mean_power',
  'Trap Bar Deadlift': 'trap_bar_deadlift_mean_power',
  'Power Clean': 'power_clean_peak_power',
}

export function datasetFromCanonical(file: CanonicalFile): DashboardDataset {
  const observations: { athleteId: string; sessionId: string; kpiKey: string; value: number }[] = []

  for (const g of file.gps) {
    for (const [field, kpiKey] of Object.entries(GPS_FIELD_TO_KPI)) {
      const value = g[field]
      if (typeof value === 'number' && Number.isFinite(value)) {
        observations.push({ athleteId: g.athleteId, sessionId: g.sessionId, kpiKey, value })
      }
    }
  }
  for (const l of file.lifts) {
    const kpiKey = LIFT_EXERCISE_TO_KPI[l.exercise]
    if (kpiKey) {
      observations.push({
        athleteId: l.athleteId,
        sessionId: l.sessionId,
        kpiKey,
        value: l.topWorkingLoadLb,
      })
    }
  }
  for (const p of file.perch) {
    const kpiKey = PERCH_EXERCISE_TO_KPI[p.exercise]
    if (kpiKey) {
      observations.push({
        athleteId: p.athleteId,
        sessionId: p.sessionId,
        kpiKey,
        value: p.powerW,
      })
    }
  }

  const kpis: DashKpi[] = [...referenceKpiConfigs().values()].map((k) => ({
    key: k.key,
    displayName: k.displayName,
    category: k.category as DashKpi['category'],
    unit: k.canonicalUnit,
    decimalPlaces: k.decimalPlaces,
    interpretation:
      k.key === 'top_speed' || k.category === 'Strength' || k.category === 'Power'
        ? 'higher_is_better'
        : 'neutral',
    inLeaderboards: k.category === 'Strength' || k.category === 'Power',
    inMonitoring: k.category === 'GPS' || k.category === 'Load',
    inProfile: k.category !== 'Load',
  }))

  return buildDataset({
    seasonLabel: `${file.seasonYear} Season`,
    seasonStart: file.seasonStart,
    seasonEnd: file.seasonEnd,
    athletes: file.athletes.map((a) => ({
      id: a.id,
      firstName: a.firstName,
      lastName: a.lastName,
      fullName: `${a.firstName} ${a.lastName}`,
      position: a.position,
      jerseyNumber: a.jerseyNumber ?? null,
      yearsOnTeam: a.yearsOnTeam ?? null,
    })),
    sessions: file.sessions,
    availability: file.availability,
    participation: file.participation,
    observations,
    kpis,
  })
}

class LocalSavedViews implements SavedViewsStore {
  private key(page: string): string {
    return `fh.saved-views.${page}`
  }
  list(page: string): SavedView[] {
    try {
      return JSON.parse(localStorage.getItem(this.key(page)) ?? '[]') as SavedView[]
    } catch {
      return []
    }
  }
  save(view: SavedView): void {
    const views = this.list(view.page).filter((v) => v.name !== view.name)
    localStorage.setItem(this.key(view.page), JSON.stringify([...views, view]))
  }
  remove(page: string, name: string): void {
    localStorage.setItem(
      this.key(page),
      JSON.stringify(this.list(page).filter((v) => v.name !== name)),
    )
  }
}

export function createLocalDashboardProvider(): DashboardDataProvider {
  return {
    async load(): Promise<DashboardDataset> {
      const response = await fetch('/dev-data/canonical.json')
      if (!response.ok) {
        throw new Error('No synthetic dataset available — run: npm run seed:generate')
      }
      return datasetFromCanonical((await response.json()) as CanonicalFile)
    },
    savedViews: new LocalSavedViews(),
  }
}
