/**
 * Competition scoring (§10) — a self-contained points game, isolated from all
 * performance monitoring. For each scored session × eligible KPI × scoring
 * mode we rank the valid athletes (direction-aware), convert each finishing
 * place to configurable points via the dated scoring profile, and accumulate
 * points over the selected range. Overall standings are the accumulation —
 * never a single best session. Only explicitly eligible KPIs score; Workload,
 * ACWR, monotony, strain, availability, health and completeness never do.
 */
import type { CompetitionSettings } from '../../settings/types.ts'
import type { DashKpi, DashSession, DashboardDataset } from '../types.ts'

export type CompetitionRange =
  | { kind: 'all' }
  | { kind: 'session'; sessionId: string }
  | { kind: 'custom'; from: string; to: string }
  | { kind: 'saved'; rangeId: string }

export type ScoringMode = 'absolute' | 'relative'

export interface AthleteStanding {
  athleteId: string
  name: string
  position: string
  teamId: string | null
  teamName: string | null
  points: number
  firsts: number
  podiums: number
  scoredSessions: number
  rank: number
}

export interface TeamStanding {
  teamId: string
  name: string
  points: number
  participants: number
  firsts: number
  podiums: number
  scoredEvents: number
  avgPerParticipant: number
  rank: number
}

export interface KpiLeaderRow {
  athleteId: string
  name: string
  position: string
  teamName: string | null
  points: number
  /** latest raw value that scored for this KPI (absolute or per-lb) */
  latestValue: number | null
  rank: number
}

export interface KpiLeaderboard {
  kpiKey: string
  kpiName: string
  modeLabel: string
  rows: KpiLeaderRow[]
}

export interface CompetitionResult {
  rangeLabel: string
  scoredEvents: number
  scoredSessions: number
  athletes: AthleteStanding[]
  teams: TeamStanding[]
  kpis: KpiLeaderboard[]
}

/** Scoring profile effective on `date` = latest effectiveFrom on or before it. */
function placePointsForDate(settings: CompetitionSettings, date: string): number[] {
  const applicable = settings.scoringProfiles
    .filter((p) => p.effectiveFrom <= date)
    .sort((a, b) => a.effectiveFrom.localeCompare(b.effectiveFrom))
  const chosen =
    applicable[applicable.length - 1] ??
    settings.scoringProfiles.find((p) => p.id === settings.defaultProfileId) ??
    settings.scoringProfiles[0]
  return chosen?.placePoints ?? []
}

function pointsForPlace(placePoints: number[], place: number): number {
  return place >= 1 && place <= placePoints.length ? placePoints[place - 1]! : 0
}

/** Direction-aware standard-competition ranking (ties share the better place,
 *  the next place is skipped). Returns place per input index. */
function rankPlaces(values: number[], higherIsBetter: boolean): number[] {
  const order = values
    .map((v, i) => ({ v, i }))
    .sort((a, b) => (higherIsBetter ? b.v - a.v : a.v - b.v))
  const places = new Array<number>(values.length)
  let place = 0
  for (let k = 0; k < order.length; k += 1) {
    const prev = order[k - 1]
    if (k === 0 || order[k]!.v !== prev!.v) place = k + 1 // tie keeps the same place
    places[order[k]!.i] = place
  }
  return places
}

/** athlete → team, honoring explicit assignment then a deterministic
 *  round-robin over configured teams (so the prototype is never empty). */
function teamAssignment(
  dataset: DashboardDataset,
  settings: CompetitionSettings,
): Map<string, string> {
  const map = new Map<string, string>()
  if (settings.teams.length === 0) return map
  dataset.athletes.forEach((a, i) => {
    const explicit = settings.athleteTeam[a.id]
    const teamId =
      explicit && settings.teams.some((t) => t.id === explicit)
        ? explicit
        : settings.teams[i % settings.teams.length]!.id
    map.set(a.id, teamId)
  })
  return map
}

function resolveRange(
  dataset: DashboardDataset,
  settings: CompetitionSettings,
  range: CompetitionRange,
): { sessions: DashSession[]; label: string } {
  const scored = dataset.sessions.filter((s) => s.kind === 'lift' || s.kind === 'field')
  if (range.kind === 'session') {
    const s = dataset.sessionById.get(range.sessionId)
    return { sessions: s ? [s] : [], label: s ? s.label : 'Session' }
  }
  if (range.kind === 'custom') {
    return {
      sessions: scored.filter((s) => s.date >= range.from && s.date <= range.to),
      label: `${range.from} → ${range.to}`,
    }
  }
  if (range.kind === 'saved') {
    const saved = settings.savedRanges.find((r) => r.id === range.rangeId)
    if (!saved) return { sessions: scored, label: 'All time' }
    return {
      sessions: scored.filter((s) => s.date >= saved.from && s.date <= saved.to),
      label: saved.label,
    }
  }
  return { sessions: scored, label: 'All time' }
}

const MODE_LABEL: Record<ScoringMode, string> = {
  absolute: 'Absolute',
  relative: 'Per body weight',
}

export function competitionResult(
  dataset: DashboardDataset,
  settings: CompetitionSettings,
  range: CompetitionRange,
): CompetitionResult {
  const teamMap = teamAssignment(dataset, settings)
  const teamName = (id: string | null) =>
    id ? (settings.teams.find((t) => t.id === id)?.name ?? null) : null
  const { sessions, label } = resolveRange(dataset, settings, range)

  // eligible, rankable KPIs (higher/lower interpretation only)
  const eligible: { kpi: DashKpi; modes: ScoringMode[] }[] = []
  for (const kpi of dataset.kpis.values()) {
    const e = settings.eligibleKpis[kpi.key]
    if (!e) continue
    if (kpi.interpretation !== 'higher_is_better' && kpi.interpretation !== 'lower_is_better')
      continue
    const modes: ScoringMode[] = []
    if (e.absolute) modes.push('absolute')
    if (e.relative) modes.push('relative')
    if (modes.length > 0) eligible.push({ kpi, modes })
  }

  // accumulators
  const athletePoints = new Map<string, number>()
  const athleteFirsts = new Map<string, number>()
  const athletePodiums = new Map<string, number>()
  const athleteSessions = new Map<string, Set<string>>()
  const kpiRows = new Map<string, Map<string, { points: number; latestValue: number }>>()
  let scoredEvents = 0
  const scoredSessionIds = new Set<string>()

  const bump = (m: Map<string, number>, id: string, by: number) => m.set(id, (m.get(id) ?? 0) + by)

  for (const session of sessions) {
    const placePoints = placePointsForDate(settings, session.date)
    const sessionObs = dataset.observationsBySession.get(session.id) ?? []
    for (const { kpi, modes } of eligible) {
      const raw = sessionObs.filter((o) => o.kpiKey === kpi.key)
      if (raw.length === 0) continue
      for (const mode of modes) {
        const entries = raw
          .map((o) => {
            if (mode === 'relative') {
              const bw = settings.bodyWeightLb[o.athleteId]
              if (!bw || bw <= 0) return null
              return { athleteId: o.athleteId, value: o.value / bw }
            }
            return { athleteId: o.athleteId, value: o.value }
          })
          .filter((e): e is { athleteId: string; value: number } => e !== null)
        if (entries.length === 0) continue

        const places = rankPlaces(
          entries.map((e) => e.value),
          kpi.interpretation === 'higher_is_better',
        )
        scoredEvents += 1
        scoredSessionIds.add(session.id)
        entries.forEach((e, idx) => {
          const place = places[idx]!
          const pts = pointsForPlace(placePoints, place)
          bump(athletePoints, e.athleteId, pts)
          if (place === 1) bump(athleteFirsts, e.athleteId, 1)
          if (place <= 3) bump(athletePodiums, e.athleteId, 1)
          const set = athleteSessions.get(e.athleteId) ?? new Set()
          set.add(session.id)
          athleteSessions.set(e.athleteId, set)

          let byAthlete = kpiRows.get(kpi.key)
          if (!byAthlete) {
            byAthlete = new Map()
            kpiRows.set(kpi.key, byAthlete)
          }
          const cur = byAthlete.get(e.athleteId) ?? { points: 0, latestValue: e.value }
          cur.points += pts
          cur.latestValue = e.value // sessions iterate in date order → latest wins
          byAthlete.set(e.athleteId, cur)
        })
      }
    }
  }

  // athlete standings
  const athletes: AthleteStanding[] = dataset.athletes
    .map((a) => ({
      athleteId: a.id,
      name: a.fullName,
      position: a.position,
      teamId: teamMap.get(a.id) ?? null,
      teamName: teamName(teamMap.get(a.id) ?? null),
      points: athletePoints.get(a.id) ?? 0,
      firsts: athleteFirsts.get(a.id) ?? 0,
      podiums: athletePodiums.get(a.id) ?? 0,
      scoredSessions: athleteSessions.get(a.id)?.size ?? 0,
      rank: 0,
    }))
    .filter((a) => a.scoredSessions > 0)
    .sort((a, b) => b.points - a.points || b.firsts - a.firsts || b.podiums - a.podiums)
  athletes.forEach((a, i) => {
    a.rank = i > 0 && athletes[i - 1]!.points === a.points ? athletes[i - 1]!.rank : i + 1
  })

  // team standings
  const teams: TeamStanding[] = settings.teams
    .map((t) => {
      const members = athletes.filter((a) => a.teamId === t.id)
      const points = members.reduce((s, a) => s + a.points, 0)
      return {
        teamId: t.id,
        name: t.name,
        points,
        participants: members.length,
        firsts: members.reduce((s, a) => s + a.firsts, 0),
        podiums: members.reduce((s, a) => s + a.podiums, 0),
        scoredEvents: members.reduce((s, a) => s + a.scoredSessions, 0),
        avgPerParticipant: members.length > 0 ? points / members.length : 0,
        rank: 0,
      }
    })
    .sort((a, b) => b.points - a.points || b.avgPerParticipant - a.avgPerParticipant)
  teams.forEach((t, i) => {
    t.rank = i > 0 && teams[i - 1]!.points === t.points ? teams[i - 1]!.rank : i + 1
  })

  // per-KPI leaderboards
  const kpis: KpiLeaderboard[] = eligible.map(({ kpi, modes }) => {
    const byAthlete = kpiRows.get(kpi.key) ?? new Map()
    const rows: KpiLeaderRow[] = [...byAthlete.entries()]
      .map(([athleteId, v]) => {
        const a = dataset.athleteById.get(athleteId)
        return {
          athleteId,
          name: a?.fullName ?? athleteId,
          position: a?.position ?? '—',
          teamName: teamName(teamMap.get(athleteId) ?? null),
          points: v.points,
          latestValue: v.latestValue,
          rank: 0,
        }
      })
      .sort((a, b) => b.points - a.points)
    rows.forEach((r, i) => {
      r.rank = i > 0 && rows[i - 1]!.points === r.points ? rows[i - 1]!.rank : i + 1
    })
    return {
      kpiKey: kpi.key,
      kpiName: kpi.displayName,
      modeLabel: modes.map((m) => MODE_LABEL[m]).join(' + '),
      rows,
    }
  })

  return {
    rangeLabel: label,
    scoredEvents,
    scoredSessions: scoredSessionIds.size,
    athletes,
    teams,
    kpis,
  }
}
