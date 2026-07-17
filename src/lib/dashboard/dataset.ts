/**
 * Dataset assembly: raw collections in → indexed DashboardDataset out.
 * Pure and provider-agnostic — the local provider feeds it synthetic data;
 * the AWS provider will feed it query results.
 */
import type {
  DashAthlete,
  DashAvailabilityDay,
  DashKpi,
  DashObservation,
  DashParticipation,
  DashSession,
  DashboardDataset,
  Position,
} from './types.ts'

export interface DatasetInput {
  seasonLabel: string
  seasonStart: string
  seasonEnd: string
  athletes: DashAthlete[]
  sessions: DashSession[]
  availability: DashAvailabilityDay[]
  participation: DashParticipation[]
  observations: DashObservation[]
  kpis: DashKpi[]
}

const POSITION_ORDER: Position[] = ['Goalkeeper', 'Defender', 'Midfielder', 'Forward']

export function buildDataset(input: DatasetInput): DashboardDataset {
  const sessions = [...input.sessions].sort((a, b) =>
    a.date === b.date ? a.startTime.localeCompare(b.startTime) : a.date.localeCompare(b.date),
  )

  const sessionsByDate = new Map<string, DashSession[]>()
  for (const s of sessions) {
    sessionsByDate.set(s.date, [...(sessionsByDate.get(s.date) ?? []), s])
  }

  const observationsBySession = new Map<string, DashObservation[]>()
  const observationsByAthlete = new Map<string, DashObservation[]>()
  for (const o of input.observations) {
    observationsBySession.set(o.sessionId, [...(observationsBySession.get(o.sessionId) ?? []), o])
    observationsByAthlete.set(o.athleteId, [...(observationsByAthlete.get(o.athleteId) ?? []), o])
  }

  return {
    seasonLabel: input.seasonLabel,
    seasonStart: input.seasonStart,
    seasonEnd: input.seasonEnd,
    athletes: [...input.athletes].sort((a, b) => a.lastName.localeCompare(b.lastName)),
    positions: POSITION_ORDER,
    sessions,
    availability: input.availability,
    participation: input.participation,
    observations: input.observations,
    kpis: new Map(input.kpis.map((k) => [k.key, k])),
    athleteById: new Map(input.athletes.map((a) => [a.id, a])),
    sessionById: new Map(sessions.map((s) => [s.id, s])),
    sessionsByDate,
    observationsBySession,
    observationsByAthlete,
    participationByKey: new Map(
      input.participation.map((p) => [`${p.athleteId}|${p.sessionId}`, p]),
    ),
    availabilityByKey: new Map(input.availability.map((a) => [`${a.athleteId}|${a.date}`, a])),
  }
}
