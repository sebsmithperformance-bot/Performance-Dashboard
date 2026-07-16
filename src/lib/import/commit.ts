/**
 * Transactional import commit (§4.2 step 9, ADR-003). One database
 * transaction covers the imports record, row-level audit, approved identity
 * mappings, approved new athletes/sessions, and metric observations — any
 * failure rolls back everything. Validation state is re-checked inside the
 * transaction; database unique constraints remain the final duplicate guard.
 *
 * Local note (ADR-003): with no S3 yet, s3_object_key stores a
 * `local://` placeholder and the imports row is created at commit time; the
 * uploaded/previewed statuses activate with the AWS upload flow.
 */
import type { SqlExecutor } from '../../../db/migration-core.ts'
import { normalizeKey } from './normalize.ts'
import type { AthleteResolutionItem } from './resolve-athletes.ts'
import { athleteRowState, effectiveAthleteId } from './resolve-athletes.ts'
import type { SessionResolutionItem } from './resolve-sessions.ts'
import { effectiveSessionId, sessionRowState } from './resolve-sessions.ts'
import type { ConflictPolicy, PreviewRow } from './validate.ts'
import type { Source } from './types.ts'

export interface CommitPlanInput {
  source: Source
  filename: string
  fileSha256: string
  uploadedBySub: string
  seasonId: string
  conflictPolicy: ConflictPolicy
  /** Coach explicitly chose to reprocess a previously committed identical file. */
  reprocessConfirmed: boolean
  athleteItems: AthleteResolutionItem[]
  sessionItems: SessionResolutionItem[]
  rows: PreviewRow[]
  fileRowCount: number
  /** header/exercise → kpi_key mappings added during this import, persisted for future imports (§4.2 step 5) */
  newMappings: { rawHeader: string; kpiKey: string }[]
}

export type CommitResult =
  | {
      ok: true
      importId: string
      counts: { inserted: number; updated: number; skipped: number; warnings: number }
    }
  | { ok: false; reason: string }

function splitName(rawName: string): { first: string; last: string } {
  const parts = rawName.trim().split(/\s+/)
  if (parts.length === 1) return { first: parts[0]!, last: '(unknown)' }
  return { first: parts.slice(0, -1).join(' '), last: parts[parts.length - 1]! }
}

export async function commitImport(db: SqlExecutor, plan: CommitPlanInput): Promise<CommitResult> {
  // Pre-checks that don't need the transaction
  const errorRows = plan.rows.filter((r) => r.action === 'error')
  if (errorRows.length > 0) {
    return { ok: false, reason: `refusing to commit: ${errorRows.length} error row(s) present` }
  }
  const unresolvedAthlete = plan.athleteItems.some((a) => athleteRowState(a) === 'unresolved')
  const unresolvedSession = plan.sessionItems.some((s) => sessionRowState(s) === 'unresolved')
  if (unresolvedAthlete || unresolvedSession) {
    return { ok: false, reason: 'refusing to commit: unresolved athletes or sessions remain' }
  }

  await db.exec('begin')
  try {
    // Re-validation inside the transaction (§4.2 step 9): duplicate-file guard
    const [duplicate] = await db.query<{ id: string; original_filename: string }>(
      `select id, original_filename from imports
       where file_sha256 = $1 and status = 'committed' limit 1`,
      [plan.fileSha256],
    )
    if (duplicate && !plan.reprocessConfirmed) {
      await db.exec('rollback')
      return {
        ok: false,
        reason: `identical file already committed as "${duplicate.original_filename}" — choose Reprocess to import it again`,
      }
    }

    // ---- imports record ----
    // Counts are per SOURCE ROW (matching the import_rows audit), not per
    // observation: a PlayerData row carrying 11 KPIs is one inserted row.
    const rowActionRank = { insert: 3, update: 2, skip: 1 } as const
    const actionBySourceRow = new Map<number, 'insert' | 'update' | 'skip'>()
    for (const row of plan.rows) {
      const action = row.action === 'error' ? 'skip' : row.action // errors never reach commit
      const current = actionBySourceRow.get(row.sourceRowNumber)
      if (!current || rowActionRank[action] > rowActionRank[current]) {
        actionBySourceRow.set(row.sourceRowNumber, action)
      }
    }
    const rowActions = [...actionBySourceRow.values()]
    const inserted = rowActions.filter((a) => a === 'insert').length
    const updated = rowActions.filter((a) => a === 'update').length
    const skipped = rowActions.filter((a) => a === 'skip').length
    const warnings = plan.rows.filter((r) => r.hasWarning).length

    const [importRow] = await db.query<{ id: string }>(
      `insert into imports
         (source, original_filename, s3_object_key, file_sha256, uploaded_by_sub,
          committed_at, row_count, inserted_count, updated_count, skipped_count,
          warning_count, error_count, status)
       values ($1, $2, $3, $4, $5, now(), $6, $7, $8, $9, $10, 0, 'committed')
       returning id`,
      [
        plan.source,
        plan.filename,
        `local://imports/${plan.fileSha256}/${plan.filename}`,
        plan.fileSha256,
        plan.uploadedBySub,
        plan.fileRowCount,
        inserted,
        updated,
        skipped,
        warnings,
      ],
    )
    const importId = importRow!.id

    // ---- persist user-approved header mappings for future imports ----
    for (const m of plan.newMappings) {
      await db.query(
        `insert into kpi_source_mapping (kpi_key, source, raw_header)
         select $1, $2, $3
         where not exists (
           select 1 from kpi_source_mapping
           where source = $2 and raw_header_normalized = $4
         )`,
        [m.kpiKey, plan.source, m.rawHeader, normalizeKey(m.rawHeader)],
      )
    }

    // ---- approved athlete creations + identity mappings ----
    const athleteIdByRef = new Map<string, string>()
    for (const item of plan.athleteItems) {
      const known = effectiveAthleteId(item)
      if (known) {
        athleteIdByRef.set(item.refKey, known)
        continue
      }
      if (item.decision?.action === 'create') {
        const { first, last } = splitName(item.rawName)
        const [created] = await db.query<{ id: string }>(
          `insert into athletes (first_name, last_name, status) values ($1, $2, 'active')
           returning id`,
          [first, last],
        )
        athleteIdByRef.set(item.refKey, created!.id)
      }
    }
    // Remember source identities for every athlete used in this import (§13)
    for (const item of plan.athleteItems) {
      const athleteId = athleteIdByRef.get(item.refKey)
      if (!athleteId) continue // skipped athletes
      await db.query(
        `insert into athlete_source_identity (athlete_id, source, external_id, raw_name)
         select $1, $2, $3, $4
         where not exists (
           select 1 from athlete_source_identity
           where source = $2
             and ((external_id is not null and external_id = $3)
               or (external_id is null and raw_name_normalized = $5))
         )`,
        [athleteId, plan.source, item.externalId ?? null, item.rawName, normalizeKey(item.rawName)],
      )
    }

    // ---- approved session creations ----
    const sessionIdByRef = new Map<string, string>()
    for (const item of plan.sessionItems) {
      const known = effectiveSessionId(item)
      if (known) {
        sessionIdByRef.set(item.refKey, known)
        continue
      }
      const creatable =
        item.decision?.action === 'create' ||
        (item.decision === undefined && item.resolution.status === 'new')
      if (!creatable) continue // skipped sessions
      const overrides = item.decision?.action === 'create' ? (item.decision.overrides ?? {}) : {}
      const [created] = await db.query<{ id: string }>(
        `insert into sessions (season_id, session_date, start_time, label, type, source, source_external_id)
         values ($1, $2, $3, $4, $5, $6, $7) returning id`,
        [
          plan.seasonId,
          item.ref.date,
          overrides.startTime ?? item.ref.startTime ?? null,
          overrides.label ?? item.ref.label,
          overrides.type ?? item.ref.type,
          plan.source,
          item.ref.externalId ?? null,
        ],
      )
      sessionIdByRef.set(item.refKey, created!.id)
    }

    // ---- observations + row-level audit ----
    interface RowAudit {
      action: 'insert' | 'update' | 'skip'
      raw: Record<string, string>
      normalized: Record<string, unknown>[]
      before: Record<string, number> | null
      after: Record<string, number> | null
      warnings: string[]
    }
    const auditBySourceRow = new Map<number, RowAudit>()
    const auditFor = (row: PreviewRow): RowAudit => {
      let audit = auditBySourceRow.get(row.sourceRowNumber)
      if (!audit) {
        audit = {
          action: 'skip',
          raw: row.raw,
          normalized: [],
          before: null,
          after: null,
          warnings: [],
        }
        auditBySourceRow.set(row.sourceRowNumber, audit)
      }
      return audit
    }

    for (const row of plan.rows) {
      const audit = auditFor(row)
      audit.warnings.push(...row.notes)
      if (row.kpiKey !== null) {
        audit.normalized.push({
          kpi: row.kpiKey,
          value: row.valueCanonical,
          unit: row.unit,
          action: row.action,
        })
      }
      if (!row.commit) continue

      const athleteId = athleteIdByRef.get(row.commit.athleteRefKey)
      const sessionId = sessionIdByRef.get(row.commit.sessionRefKey)
      if (!athleteId || !sessionId) {
        throw new Error(
          `commit integrity: row ${row.sourceRowNumber} references an athlete/session that was not created or resolved`,
        )
      }

      if (row.action === 'insert') {
        await db.query(
          `insert into metric_observations
             (athlete_id, session_id, kpi_key, value_canonical, source_import_id)
           values ($1, $2, $3, $4, $5)`,
          [athleteId, sessionId, row.commit.kpiKey, row.commit.valueCanonical, importId],
        )
        audit.action = 'insert'
        audit.after = { ...(audit.after ?? {}), [row.commit.kpiKey]: row.commit.valueCanonical }
      } else if (row.action === 'update') {
        const [before] = await db.query<{ value: string }>(
          `select value_canonical::text as value from metric_observations
           where athlete_id = $1 and session_id = $2 and kpi_key = $3`,
          [athleteId, sessionId, row.commit.kpiKey],
        )
        if (!before) {
          throw new Error(
            `commit integrity: expected existing observation for update at row ${row.sourceRowNumber}`,
          )
        }
        await db.query(
          `update metric_observations
           set value_canonical = $4, source_import_id = $5
           where athlete_id = $1 and session_id = $2 and kpi_key = $3`,
          [athleteId, sessionId, row.commit.kpiKey, row.commit.valueCanonical, importId],
        )
        if (audit.action !== 'insert') audit.action = 'update'
        audit.before = { ...(audit.before ?? {}), [row.commit.kpiKey]: Number(before.value) }
        audit.after = { ...(audit.after ?? {}), [row.commit.kpiKey]: row.commit.valueCanonical }
      }
    }

    for (const [sourceRowNumber, audit] of [...auditBySourceRow.entries()].sort(
      (a, b) => a[0] - b[0],
    )) {
      await db.query(
        `insert into import_rows
           (import_id, source_row_number, raw_data, normalized_data, action,
            before_data, after_data, warnings)
         values ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          importId,
          sourceRowNumber,
          JSON.stringify(audit.raw),
          JSON.stringify(audit.normalized),
          audit.action,
          audit.before ? JSON.stringify(audit.before) : null,
          audit.after ? JSON.stringify(audit.after) : null,
          JSON.stringify(audit.warnings),
        ],
      )
    }

    await db.exec('commit')
    return { ok: true, importId, counts: { inserted, updated, skipped, warnings } }
  } catch (err) {
    await db.exec('rollback')
    return {
      ok: false,
      reason: `commit failed and was rolled back: ${err instanceof Error ? err.message : String(err)}`,
    }
  }
}
