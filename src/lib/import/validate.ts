/**
 * Validation and row classification (§4.2 step 7). Every staged observation
 * and every adapter-skipped row becomes exactly one preview row classified
 * insert | update | skip | error, with warnings carried alongside (warnings
 * are annotations, not an action — import_rows.action is CHECK-constrained).
 * Errors block the entire commit; warnings require acknowledgement.
 */
import type { ExistingObservation, ResolutionContext } from './context.ts'
import {
  athleteRefKey,
  athleteRowState,
  effectiveAthleteId,
  type AthleteResolutionItem,
} from './resolve-athletes.ts'
import {
  effectiveSessionId,
  sessionRefKey,
  sessionRowState,
  type SessionResolutionItem,
} from './resolve-sessions.ts'
import type { StagedObservation, StageResult } from './types.ts'

export type RowAction = 'insert' | 'update' | 'skip' | 'error'
export type ConflictPolicy = 'skip_existing' | 'replace_existing'

export interface PreviewRow {
  sourceRowNumber: number
  athleteLabel: string
  athleteState: 'ok' | 'create' | 'skip' | 'unresolved' | 'n/a'
  sessionLabel: string
  sessionState: 'ok' | 'create' | 'skip' | 'unresolved' | 'n/a'
  kpiKey: string | null
  kpiName: string | null
  rawValue: string
  valueCanonical: number | null
  unit: string | null
  action: RowAction
  /** human-readable warnings and (for errors) the blocking reason */
  notes: string[]
  hasWarning: boolean
  raw: Record<string, string>
  /** present on insert/update rows — everything commit needs */
  commit?: {
    athleteRefKey: string
    sessionRefKey: string
    kpiKey: string
    valueCanonical: number
    existingValue?: number
  }
}

export interface PreviewSummary {
  fileRows: number
  observations: { insert: number; update: number; skip: number; error: number }
  rows: { insert: number; update: number; skip: number; error: number }
  warnings: number
  unresolvedAthletes: number
  unresolvedSessions: number
  unmappedHeaders: number
}

export interface PreviewModel {
  rows: PreviewRow[]
  summary: PreviewSummary
  canCommit: boolean
  blockReasons: string[]
}

function aggregate(values: number[], method: string): number {
  switch (method) {
    case 'max':
    case 'best_set':
      return Math.max(...values)
    case 'mean':
      return values.reduce((a, b) => a + b, 0) / values.length
    case 'sum':
      return values.reduce((a, b) => a + b, 0)
    case 'last':
      return values[values.length - 1]!
    default:
      throw new Error(`No aggregation defined for method "${method}"`)
  }
}

export function buildPreview(
  stage: StageResult,
  context: ResolutionContext,
  athleteItems: AthleteResolutionItem[],
  sessionItems: SessionResolutionItem[],
  existing: ExistingObservation[],
  conflictPolicy: ConflictPolicy,
): PreviewModel {
  const athleteByRef = new Map(athleteItems.map((a) => [a.refKey, a]))
  const sessionByRef = new Map(sessionItems.map((s) => [s.refKey, s]))
  const existingByKey = new Map(
    existing.map((e) => [`${e.athleteId}|${e.sessionId}|${e.kpiKey}`, e.value]),
  )

  const rows: PreviewRow[] = []

  // ---- duplicate collapse / aggregation per (athlete, session, kpi) ----
  const groups = new Map<string, StagedObservation[]>()
  for (const s of stage.staged) {
    const key = `${athleteRefKey(s.athlete)}|${sessionRefKey(s.session)}|${s.kpiKey}`
    groups.set(key, [...(groups.get(key) ?? []), s])
  }

  for (const group of groups.values()) {
    const first = group[0]!
    const kpi = context.kpis.get(first.kpiKey)!
    const aRef = athleteRefKey(first.athlete)
    const sRef = sessionRefKey(first.session)
    const athleteItem = athleteByRef.get(aRef)!
    const sessionItem = sessionByRef.get(sRef)!
    const aState = athleteRowState(athleteItem)
    const sState = sessionRowState(sessionItem)

    const resolvedAthleteId = effectiveAthleteId(athleteItem)
    const athleteLabel = resolvedAthleteId
      ? (context.athletes.find((x) => x.id === resolvedAthleteId)?.fullName ??
        first.athlete.rawName)
      : first.athlete.rawName
    const sessionLabel = `${first.session.date} · ${first.session.label}`

    // duplicate handling within the group
    let carrier = first
    let carrierValue = first.valueCanonical
    const groupNotes: string[] = []
    if (group.length > 1) {
      const distinct = [...new Set(group.map((g) => g.valueCanonical))]
      if (distinct.length === 1) {
        groupNotes.push(`duplicate rows in file (${group.length}×) — kept one`)
      } else if (kpi.aggregationMethod === 'source_value') {
        // conflicting duplicates for a source-value KPI: every row errors
        for (const g of group) {
          rows.push({
            sourceRowNumber: g.sourceRowNumber,
            athleteLabel,
            athleteState: aState,
            sessionLabel,
            sessionState: sState,
            kpiKey: kpi.key,
            kpiName: kpi.displayName,
            rawValue: g.rawValue,
            valueCanonical: g.valueCanonical,
            unit: kpi.canonicalUnit,
            action: 'error',
            notes: [
              `conflicting duplicate values for ${kpi.displayName} (${distinct.join(' vs ')}) — source_value KPIs cannot be aggregated`,
            ],
            hasWarning: false,
            raw: g.raw,
          })
        }
        continue
      } else {
        carrierValue = aggregate(
          group.map((g) => g.valueCanonical),
          kpi.aggregationMethod,
        )
        groupNotes.push(
          `${group.length} set-level rows aggregated by configured method "${kpi.aggregationMethod}" → ${carrierValue}`,
        )
      }
      // non-carrier rows become skips pointing at the carrier
      for (const g of group.slice(1)) {
        rows.push({
          sourceRowNumber: g.sourceRowNumber,
          athleteLabel,
          athleteState: aState,
          sessionLabel,
          sessionState: sState,
          kpiKey: kpi.key,
          kpiName: kpi.displayName,
          rawValue: g.rawValue,
          valueCanonical: g.valueCanonical,
          unit: kpi.canonicalUnit,
          action: 'skip',
          notes: [
            `merged into row ${carrier.sourceRowNumber} (${groupNotes[groupNotes.length - 1]})`,
          ],
          hasWarning: true,
          raw: g.raw,
        })
      }
    }

    const notes = [...carrier.warnings, ...groupNotes]
    let action: RowAction
    let existingValue: number | undefined

    if (aState === 'skip' || sState === 'skip') {
      action = 'skip'
      notes.push(aState === 'skip' ? 'athlete marked skip for this import' : 'session marked skip')
    } else if (aState === 'unresolved') {
      action = 'error'
      notes.push('athlete unresolved — pick a match, create, or skip')
    } else if (sState === 'unresolved') {
      action = 'error'
      notes.push('session ambiguous — pick the correct session')
    } else if (!Number.isFinite(carrierValue)) {
      action = 'error'
      notes.push('non-finite value after normalization')
    } else if (
      (kpi.validMin !== null && carrierValue < kpi.validMin) ||
      (kpi.validMax !== null && carrierValue > kpi.validMax)
    ) {
      action = 'error'
      notes.push(
        `value ${carrierValue} outside valid range [${kpi.validMin ?? '−∞'}, ${kpi.validMax ?? '∞'}] for ${kpi.displayName}`,
      )
    } else {
      const athleteId = effectiveAthleteId(athleteItem)
      const sessionId = effectiveSessionId(sessionItem)
      const prior =
        athleteId && sessionId
          ? existingByKey.get(`${athleteId}|${sessionId}|${kpi.key}`)
          : undefined
      if (prior !== undefined) {
        existingValue = prior
        if (conflictPolicy === 'replace_existing') {
          action = 'update'
          notes.push(`replaces existing value ${prior}`)
        } else {
          action = 'skip'
          notes.push(`observation already exists (${prior}) — policy: skip existing`)
        }
      } else {
        action = 'insert'
      }
    }

    rows.push({
      sourceRowNumber: carrier.sourceRowNumber,
      athleteLabel,
      athleteState: aState,
      sessionLabel,
      sessionState: sState,
      kpiKey: kpi.key,
      kpiName: kpi.displayName,
      rawValue: carrier.rawValue,
      valueCanonical: carrierValue,
      unit: kpi.canonicalUnit,
      action,
      notes,
      hasWarning: notes.length > 0 && action !== 'error',
      raw: carrier.raw,
      ...(action === 'insert' || action === 'update'
        ? {
            commit: {
              athleteRefKey: aRef,
              sessionRefKey: sRef,
              kpiKey: kpi.key,
              valueCanonical: carrierValue,
              ...(existingValue !== undefined ? { existingValue } : {}),
            },
          }
        : {}),
    })
  }

  // ---- adapter-skipped rows ----
  for (const s of stage.skipped) {
    rows.push({
      sourceRowNumber: s.sourceRowNumber,
      athleteLabel: '—',
      athleteState: 'n/a',
      sessionLabel: '—',
      sessionState: 'n/a',
      kpiKey: null,
      kpiName: null,
      rawValue: '',
      valueCanonical: null,
      unit: null,
      action: s.severity === 'error' ? 'error' : 'skip',
      notes: [s.reason],
      hasWarning: s.severity === 'warning',
      raw: s.raw,
    })
  }

  rows.sort((a, b) => a.sourceRowNumber - b.sourceRowNumber)

  // ---- summary + commit gate ----
  const obs = { insert: 0, update: 0, skip: 0, error: 0 }
  for (const r of rows) obs[r.action] += 1

  const rowActions = new Map<number, RowAction>()
  const rank: Record<RowAction, number> = { error: 4, insert: 3, update: 2, skip: 1 }
  for (const r of rows) {
    const prev = rowActions.get(r.sourceRowNumber)
    if (!prev || rank[r.action] > rank[prev]) rowActions.set(r.sourceRowNumber, r.action)
  }
  const rowCounts = { insert: 0, update: 0, skip: 0, error: 0 }
  for (const action of rowActions.values()) rowCounts[action] += 1

  const unresolvedAthletes = athleteItems.filter((a) => athleteRowState(a) === 'unresolved').length
  const unresolvedSessions = sessionItems.filter((s) => sessionRowState(s) === 'unresolved').length

  const blockReasons: string[] = []
  if (obs.error > 0) blockReasons.push(`${obs.error} error row(s) — errors block the entire commit`)
  if (stage.unmappedHeaders.length > 0) {
    blockReasons.push(
      `unmapped source headers: ${stage.unmappedHeaders.join(', ')} — map to a KPI or mark Ignore`,
    )
  }
  if (unresolvedAthletes > 0) blockReasons.push(`${unresolvedAthletes} unresolved athlete(s)`)
  if (unresolvedSessions > 0) blockReasons.push(`${unresolvedSessions} ambiguous session(s)`)
  if (obs.insert + obs.update === 0) blockReasons.push('nothing to import (no insert/update rows)')

  return {
    rows,
    summary: {
      fileRows: stage.rowCount,
      observations: obs,
      rows: rowCounts,
      warnings: rows.filter((r) => r.hasWarning).length,
      unresolvedAthletes,
      unresolvedSessions,
      unmappedHeaders: stage.unmappedHeaders.length,
    },
    canCommit: blockReasons.length === 0,
    blockReasons,
  }
}
