/**
 * Athlete resolution ladder (§4.2 step 4): stable external source ID →
 * existing source-identity mapping → normalized exact-name match → fuzzy
 * SUGGESTION requiring explicit confirmation → deliberate create-new action.
 * Nothing here ever auto-creates an athlete; fuzzy results are candidates,
 * not matches.
 */
import type { ResolutionContext } from './context.ts'
import { normalizeKey } from './normalize.ts'
import type { StagedObservation } from './types.ts'

export type AthleteDecision =
  { action: 'use'; athleteId: string } | { action: 'create' } | { action: 'skip' }

export interface AthleteCandidate {
  athleteId: string
  name: string
  score: number
}

export type AthleteResolutionStatus =
  | { status: 'matched'; athleteId: string; via: 'external_id' | 'identity' | 'exact_name' }
  | { status: 'suggested'; candidates: AthleteCandidate[] }
  | { status: 'unmatched' }

export interface AthleteResolutionItem {
  /** stable key for this file's athlete reference */
  refKey: string
  rawName: string
  externalId?: string
  resolution: AthleteResolutionStatus
  decision?: AthleteDecision
  rowCount: number
}

export function athleteRefKey(ref: { externalId?: string; rawName: string }): string {
  return ref.externalId !== undefined
    ? `ext:${ref.externalId}`
    : `name:${normalizeKey(ref.rawName)}`
}

function levenshtein(a: string, b: string): number {
  const prev = Array.from({ length: b.length + 1 }, (_, i) => i)
  for (let i = 1; i <= a.length; i += 1) {
    let diagonal = prev[0]!
    prev[0] = i
    for (let j = 1; j <= b.length; j += 1) {
      const insertOrDelete = Math.min(prev[j]!, prev[j - 1]!) + 1
      const substitute = diagonal + (a[i - 1] === b[j - 1] ? 0 : 1)
      diagonal = prev[j]!
      prev[j] = Math.min(insertOrDelete, substitute)
    }
  }
  return prev[b.length]!
}

/** 0–1 similarity for fuzzy suggestions: edit distance plus nickname heuristics. */
export function nameSimilarity(rawA: string, rawB: string): number {
  const a = normalizeKey(rawA)
  const b = normalizeKey(rawB)
  if (a === b) return 1

  const editScore = 1 - levenshtein(a, b) / Math.max(a.length, b.length)

  // Nickname heuristic: same last token, first names share a prefix or
  // containment of ≥3 chars ("Kenny Lockhart" ↔ "Kendall Lockhart")
  const [aFirst = '', ...aRest] = a.split(' ')
  const [bFirst = '', ...bRest] = b.split(' ')
  const sameLast = aRest.length > 0 && aRest.join(' ') === bRest.join(' ')
  const firstRelated =
    aFirst.length >= 3 &&
    bFirst.length >= 3 &&
    (aFirst.startsWith(bFirst.slice(0, 3)) ||
      bFirst.startsWith(aFirst.slice(0, 3)) ||
      aFirst.includes(bFirst) ||
      bFirst.includes(aFirst))
  const nicknameScore = sameLast && firstRelated ? 0.85 : 0

  return Math.max(editScore, nicknameScore)
}

const SUGGESTION_THRESHOLD = 0.55
const MAX_CANDIDATES = 3

export function resolveAthletes(
  staged: StagedObservation[],
  context: ResolutionContext,
  decisions: ReadonlyMap<string, AthleteDecision>,
): AthleteResolutionItem[] {
  const byRef = new Map<string, { rawName: string; externalId?: string; rowCount: number }>()
  for (const s of staged) {
    const key = athleteRefKey(s.athlete)
    const entry = byRef.get(key)
    if (entry) entry.rowCount += 1
    else
      byRef.set(key, {
        rawName: s.athlete.rawName,
        rowCount: 1,
        ...(s.athlete.externalId !== undefined ? { externalId: s.athlete.externalId } : {}),
      })
  }

  const items: AthleteResolutionItem[] = []
  for (const [refKey, ref] of byRef) {
    const norm = normalizeKey(ref.rawName)
    let resolution: AthleteResolutionStatus | null = null

    // 1 — stable external source ID
    if (ref.externalId !== undefined) {
      const identity = context.identities.find((i) => i.externalId === ref.externalId)
      if (identity)
        resolution = { status: 'matched', athleteId: identity.athleteId, via: 'external_id' }
    }
    // 2 — existing source-identity name mapping
    if (!resolution) {
      const identity = context.identities.find(
        (i) => i.externalId === null && i.rawNameNormalized === norm,
      )
      if (identity)
        resolution = { status: 'matched', athleteId: identity.athleteId, via: 'identity' }
    }
    // 3 — normalized exact-name match against the roster
    if (!resolution) {
      const exact = context.athletes.filter((a) => normalizeKey(a.fullName) === norm)
      if (exact.length === 1) {
        resolution = { status: 'matched', athleteId: exact[0]!.id, via: 'exact_name' }
      }
    }
    // 4 — fuzzy candidates (suggestion only, never a match)
    if (!resolution) {
      const candidates = context.athletes
        .map((a) => ({
          athleteId: a.id,
          name: a.fullName,
          score: nameSimilarity(ref.rawName, a.fullName),
        }))
        .filter((c) => c.score >= SUGGESTION_THRESHOLD)
        .sort((x, y) => y.score - x.score)
        .slice(0, MAX_CANDIDATES)
      resolution =
        candidates.length > 0 ? { status: 'suggested', candidates } : { status: 'unmatched' }
    }

    const decision = decisions.get(refKey)
    items.push({
      refKey,
      rawName: ref.rawName,
      resolution,
      rowCount: ref.rowCount,
      ...(ref.externalId !== undefined ? { externalId: ref.externalId } : {}),
      ...(decision !== undefined ? { decision } : {}),
    })
  }
  return items.sort((a, b) => a.rawName.localeCompare(b.rawName))
}

/** The athlete id rows will commit against, if determined pre-commit. */
export function effectiveAthleteId(item: AthleteResolutionItem): string | null {
  if (item.decision?.action === 'use') return item.decision.athleteId
  if (item.decision?.action === 'create' || item.decision?.action === 'skip') return null
  return item.resolution.status === 'matched' ? item.resolution.athleteId : null
}

export type AthleteRowState = 'ok' | 'create' | 'skip' | 'unresolved'

export function athleteRowState(item: AthleteResolutionItem): AthleteRowState {
  if (item.decision?.action === 'skip') return 'skip'
  if (item.decision?.action === 'create') return 'create'
  if (item.decision?.action === 'use') return 'ok'
  return item.resolution.status === 'matched' ? 'ok' : 'unresolved'
}
