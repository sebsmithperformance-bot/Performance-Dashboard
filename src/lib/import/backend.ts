/**
 * Import backend operations over a SqlExecutor: preview orchestration,
 * duplicate-file lookup, and import history. The UI depends on this module
 * plus commit.ts only — the local PGlite backend and the future AppSync
 * backend both satisfy the same call surface.
 */
import type { SqlExecutor } from '../../../db/migration-core.ts'
import { ADAPTERS } from './adapters/index.ts'
import {
  loadExistingObservations,
  loadResolutionContext,
  type ResolutionContext,
} from './context.ts'
import { normalizeKey } from './normalize.ts'
import {
  resolveAthletes,
  type AthleteDecision,
  type AthleteResolutionItem,
} from './resolve-athletes.ts'
import {
  effectiveSessionId,
  resolveSessions,
  type SessionDecision,
  type SessionResolutionItem,
} from './resolve-sessions.ts'
import { buildPreview, type ConflictPolicy, type PreviewModel } from './validate.ts'
import type { Source, StageResult } from './types.ts'

export interface PreviewRequest {
  source: Source
  text: string
  filename: string
  /** User-supplied session date when neither file nor filename carries one. */
  fallbackDate?: string
  athleteDecisions: ReadonlyMap<string, AthleteDecision>
  sessionDecisions: ReadonlyMap<string, SessionDecision>
  /** normalized header/exercise → kpi_key added by the user this import */
  extraMappings: ReadonlyMap<string, string>
  ignoredHeaders: ReadonlySet<string>
  conflictPolicy: ConflictPolicy
}

export interface PreviewBundle {
  context: ResolutionContext
  stage: StageResult
  athleteItems: AthleteResolutionItem[]
  sessionItems: SessionResolutionItem[]
  preview: PreviewModel
}

export async function runPreview(db: SqlExecutor, request: PreviewRequest): Promise<PreviewBundle> {
  const context = await loadResolutionContext(db, request.source)

  const mappings = new Map(context.mappings)
  for (const [k, v] of request.extraMappings) mappings.set(normalizeKey(k), v)
  const ignored = new Set([...request.ignoredHeaders].map(normalizeKey))

  const stage = ADAPTERS[request.source].stage({
    text: request.text,
    filename: request.filename,
    mappings,
    ignoredHeaders: ignored,
    kpis: context.kpis,
    ...(request.fallbackDate !== undefined ? { fallbackDate: request.fallbackDate } : {}),
  })

  const athleteItems = resolveAthletes(stage.staged, context, request.athleteDecisions)
  const sessionItems = resolveSessions(stage.staged, context, request.sessionDecisions)

  const resolvedSessionIds = sessionItems
    .map((s) => effectiveSessionId(s))
    .filter((id): id is string => id !== null)
  const existing = await loadExistingObservations(db, resolvedSessionIds)

  const preview = buildPreview(
    stage,
    context,
    athleteItems,
    sessionItems,
    existing,
    request.conflictPolicy,
  )
  return { context, stage, athleteItems, sessionItems, preview }
}

export interface ImportSummary {
  id: string
  source: Source
  filename: string
  fileSha256: string
  uploadedBy: string
  uploadedAt: string
  committedAt: string | null
  rowCount: number
  inserted: number
  updated: number
  skipped: number
  warnings: number
  errors: number
  status: string
}

export async function findCommittedImportByHash(
  db: SqlExecutor,
  fileSha256: string,
): Promise<ImportSummary | null> {
  const rows = await listImportsWhere(db, `where file_sha256 = $1 and status = 'committed'`, [
    fileSha256,
  ])
  return rows[0] ?? null
}

export async function listImports(db: SqlExecutor): Promise<ImportSummary[]> {
  return listImportsWhere(db, '', [])
}

async function listImportsWhere(
  db: SqlExecutor,
  where: string,
  params: unknown[],
): Promise<ImportSummary[]> {
  const rows = await db.query<{
    id: string
    source: Source
    original_filename: string
    file_sha256: string
    uploaded_by_sub: string
    uploaded_at: string
    committed_at: string | null
    row_count: number
    inserted_count: number
    updated_count: number
    skipped_count: number
    warning_count: number
    error_count: number
    status: string
  }>(
    `select id, source, original_filename, file_sha256, uploaded_by_sub,
            uploaded_at::text as uploaded_at, committed_at::text as committed_at,
            row_count, inserted_count, updated_count, skipped_count,
            warning_count, error_count, status
     from imports ${where} order by uploaded_at desc`,
    params,
  )
  return rows.map((r) => ({
    id: r.id,
    source: r.source,
    filename: r.original_filename,
    fileSha256: r.file_sha256,
    uploadedBy: r.uploaded_by_sub,
    uploadedAt: r.uploaded_at,
    committedAt: r.committed_at,
    rowCount: r.row_count,
    inserted: r.inserted_count,
    updated: r.updated_count,
    skipped: r.skipped_count,
    warnings: r.warning_count,
    errors: r.error_count,
    status: r.status,
  }))
}

export interface ImportRowDetail {
  sourceRowNumber: number
  action: string
  raw: Record<string, string>
  normalized: unknown
  before: Record<string, number> | null
  after: Record<string, number> | null
  warnings: string[]
}

export async function getImportRows(db: SqlExecutor, importId: string): Promise<ImportRowDetail[]> {
  const rows = await db.query<{
    source_row_number: number
    action: string
    raw_data: unknown
    normalized_data: unknown
    before_data: unknown
    after_data: unknown
    warnings: unknown
  }>(
    `select source_row_number, action, raw_data, normalized_data, before_data, after_data, warnings
     from import_rows where import_id = $1 order by source_row_number`,
    [importId],
  )
  const asObj = <T>(v: unknown): T => (typeof v === 'string' ? (JSON.parse(v) as T) : (v as T))
  return rows.map((r) => ({
    sourceRowNumber: r.source_row_number,
    action: r.action,
    raw: asObj<Record<string, string>>(r.raw_data),
    normalized: asObj<unknown>(r.normalized_data),
    before: r.before_data === null ? null : asObj<Record<string, number>>(r.before_data),
    after: r.after_data === null ? null : asObj<Record<string, number>>(r.after_data),
    warnings: asObj<string[]>(r.warnings) ?? [],
  }))
}
