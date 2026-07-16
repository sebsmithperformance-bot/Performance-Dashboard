/**
 * Resolution context: everything the preview needs to resolve athletes,
 * sessions, KPI mappings, and conflicts — loaded once per import through the
 * same SqlExecutor abstraction the commit uses, so the identical loader runs
 * against PGlite locally and Aurora later.
 */
import type { SqlExecutor } from '../../../db/migration-core.ts'
import type { Unit } from '../units/index.ts'
import { normalizeKey } from './normalize.ts'
import type { KpiConfig, SessionType, Source } from './types.ts'

export interface ContextAthlete {
  id: string
  fullName: string
  positionName: string | null
  status: string
}

export interface ContextIdentity {
  athleteId: string
  externalId: string | null
  rawNameNormalized: string
}

export interface ContextSession {
  id: string
  date: string
  startTime: string | null
  label: string
  type: SessionType
  source: string
  sourceExternalId: string | null
}

export interface ExistingObservation {
  athleteId: string
  sessionId: string
  kpiKey: string
  value: number
}

export interface ResolutionContext {
  source: Source
  seasonId: string
  athletes: ContextAthlete[]
  /** identities for this source only */
  identities: ContextIdentity[]
  /** sessions in the active season (all sources — cross-source matching, §1) */
  sessions: ContextSession[]
  kpis: Map<string, KpiConfig>
  /** normalized raw_header → kpi_key for this source */
  mappings: Map<string, string>
}

export async function loadResolutionContext(
  db: SqlExecutor,
  source: Source,
): Promise<ResolutionContext> {
  const [season] = await db.query<{ id: string }>(
    `select id from seasons where status = 'active' order by start_date desc limit 1`,
  )
  if (!season) throw new Error('No active season configured')

  const athletes = (
    await db.query<{
      id: string
      first_name: string
      last_name: string
      position: string | null
      status: string
    }>(
      `select a.id, a.first_name, a.last_name, p.name as position, a.status
       from athletes a left join positions p on p.id = a.current_position_id
       where a.status = 'active'`,
    )
  ).map((r) => ({
    id: r.id,
    fullName: `${r.first_name} ${r.last_name}`,
    positionName: r.position,
    status: r.status,
  }))

  const identities = (
    await db.query<{ athlete_id: string; external_id: string | null; raw_name_normalized: string }>(
      `select athlete_id, external_id, raw_name_normalized
       from athlete_source_identity where source = $1`,
      [source],
    )
  ).map((r) => ({
    athleteId: r.athlete_id,
    externalId: r.external_id,
    rawNameNormalized: r.raw_name_normalized,
  }))

  const sessions = (
    await db.query<{
      id: string
      session_date: string
      start_time: string | null
      label: string
      type: SessionType
      source: string
      source_external_id: string | null
    }>(
      `select id, session_date::text as session_date, start_time::text as start_time,
              label, type, source, source_external_id
       from sessions where season_id = $1`,
      [season.id],
    )
  ).map((r) => ({
    id: r.id,
    date: r.session_date,
    startTime: r.start_time ? r.start_time.slice(0, 5) : null,
    label: r.label,
    type: r.type,
    source: r.source,
    sourceExternalId: r.source_external_id,
  }))

  const kpis = new Map<string, KpiConfig>()
  for (const r of await db.query<{
    key: string
    display_name: string
    canonical_unit: string
    valid_min: string | null
    valid_max: string | null
    aggregation_method: KpiConfig['aggregationMethod']
    primary_source: string
    category: string
    decimal_places: number
  }>(
    `select key, display_name, canonical_unit, valid_min::text, valid_max::text,
            aggregation_method, primary_source, category, decimal_places
     from kpi_registry where active`,
  )) {
    kpis.set(r.key, {
      key: r.key,
      displayName: r.display_name,
      canonicalUnit: r.canonical_unit as Unit,
      validMin: r.valid_min === null ? null : Number(r.valid_min),
      validMax: r.valid_max === null ? null : Number(r.valid_max),
      aggregationMethod: r.aggregation_method,
      primarySource: r.primary_source,
      category: r.category,
      decimalPlaces: r.decimal_places,
    })
  }

  const mappings = new Map<string, string>()
  for (const r of await db.query<{ raw_header_normalized: string; kpi_key: string }>(
    `select raw_header_normalized, kpi_key from kpi_source_mapping
     where source = $1 and active`,
    [source],
  )) {
    mappings.set(r.raw_header_normalized, r.kpi_key)
  }

  return { source, seasonId: season.id, athletes, identities, sessions, kpis, mappings }
}

/** Existing observations for conflict detection, bounded to the involved sessions. */
export async function loadExistingObservations(
  db: SqlExecutor,
  sessionIds: string[],
): Promise<ExistingObservation[]> {
  if (sessionIds.length === 0) return []
  const placeholders = sessionIds.map((_, i) => `$${i + 1}`).join(', ')
  return (
    await db.query<{ athlete_id: string; session_id: string; kpi_key: string; value: string }>(
      `select athlete_id, session_id, kpi_key, value_canonical::text as value
       from metric_observations where session_id in (${placeholders})`,
      sessionIds,
    )
  ).map((r) => ({
    athleteId: r.athlete_id,
    sessionId: r.session_id,
    kpiKey: r.kpi_key,
    value: Number(r.value),
  }))
}

export { normalizeKey }
