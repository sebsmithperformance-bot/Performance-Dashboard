/**
 * Session resolution ladder (§4.2 step 3): stable source session ID →
 * explicit date/time/label/type match → single same-date/type candidate →
 * ambiguous (manual pick) → new session. Matching is cross-source: a Perch
 * file must land on the same lift session TeamBuildr created (§1). Multiple
 * sessions on one date never merge — the key includes time and label.
 */
import type { ContextSession, ResolutionContext } from './context.ts'
import { normalizeKey } from './normalize.ts'
import type { SessionRef, SessionType, StagedObservation } from './types.ts'

export type SessionDecision =
  | { action: 'use'; sessionId: string }
  | { action: 'create'; overrides?: { label?: string; type?: SessionType; startTime?: string } }
  | { action: 'skip' }

export type SessionResolutionStatus =
  | { status: 'matched'; sessionId: string; via: 'external_id' | 'exact' | 'date_type' }
  | { status: 'ambiguous'; candidates: ContextSession[] }
  | { status: 'new' }

export interface SessionResolutionItem {
  refKey: string
  ref: SessionRef
  resolution: SessionResolutionStatus
  decision?: SessionDecision
  rowCount: number
}

export function sessionRefKey(ref: SessionRef): string {
  if (ref.externalId !== undefined) return `ext:${ref.externalId}`
  return `key:${ref.date}|${ref.startTime ?? ''}|${normalizeKey(ref.label)}|${ref.type}`
}

export function resolveSessions(
  staged: StagedObservation[],
  context: ResolutionContext,
  decisions: ReadonlyMap<string, SessionDecision>,
): SessionResolutionItem[] {
  const byRef = new Map<string, { ref: SessionRef; rowCount: number }>()
  for (const s of staged) {
    const key = sessionRefKey(s.session)
    const entry = byRef.get(key)
    if (entry) entry.rowCount += 1
    else byRef.set(key, { ref: s.session, rowCount: 1 })
  }

  const items: SessionResolutionItem[] = []
  for (const [refKey, { ref, rowCount }] of byRef) {
    let resolution: SessionResolutionStatus | null = null

    // 1 — stable source session ID (scoped to this import's source)
    if (ref.externalId !== undefined) {
      const match = context.sessions.find(
        (s) => s.source === context.source && s.sourceExternalId === ref.externalId,
      )
      if (match) resolution = { status: 'matched', sessionId: match.id, via: 'external_id' }
    }

    // 2 — explicit date + label + type (+ time when both sides have one)
    if (!resolution) {
      const exact = context.sessions.filter(
        (s) =>
          s.date === ref.date &&
          s.type === ref.type &&
          normalizeKey(s.label) === normalizeKey(ref.label) &&
          (ref.startTime === undefined || s.startTime === null || s.startTime === ref.startTime),
      )
      if (exact.length === 1) {
        resolution = { status: 'matched', sessionId: exact[0]!.id, via: 'exact' }
      } else if (exact.length > 1) {
        resolution = { status: 'ambiguous', candidates: exact }
      }
    }

    // 3 — a single existing session of the same date + type is an unambiguous home
    if (!resolution) {
      const sameDateType = context.sessions.filter(
        (s) => s.date === ref.date && s.type === ref.type,
      )
      if (sameDateType.length === 1) {
        resolution = { status: 'matched', sessionId: sameDateType[0]!.id, via: 'date_type' }
      } else if (sameDateType.length > 1) {
        resolution = { status: 'ambiguous', candidates: sameDateType }
      }
    }

    if (!resolution) resolution = { status: 'new' }

    const decision = decisions.get(refKey)
    items.push({
      refKey,
      ref,
      resolution,
      rowCount,
      ...(decision !== undefined ? { decision } : {}),
    })
  }
  return items.sort((a, b) => a.ref.date.localeCompare(b.ref.date))
}

export function effectiveSessionId(item: SessionResolutionItem): string | null {
  if (item.decision?.action === 'use') return item.decision.sessionId
  if (item.decision?.action === 'create' || item.decision?.action === 'skip') return null
  return item.resolution.status === 'matched' ? item.resolution.sessionId : null
}

export type SessionRowState = 'ok' | 'create' | 'skip' | 'unresolved'

export function sessionRowState(item: SessionResolutionItem): SessionRowState {
  if (item.decision?.action === 'skip') return 'skip'
  if (item.decision?.action === 'create') return 'create'
  if (item.decision?.action === 'use') return 'ok'
  if (item.resolution.status === 'matched') return 'ok'
  // a brand-new session is committable without a decision; ambiguity is not
  return item.resolution.status === 'new' ? 'create' : 'unresolved'
}
