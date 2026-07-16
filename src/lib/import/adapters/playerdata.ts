/**
 * PlayerData source adapter — PROVISIONAL (§8.1). Metric headers match the
 * real export documented in docs/import-sources/playerdata.md; the `Athlete`
 * and optional `Date`/`Session` columns are provisional additions because the
 * real name-bearing export variant is still an open question for the coach.
 * A file without an Athlete column (like the real exports on hand) is a
 * structural error, not a guess.
 */
import {
  inferSessionType,
  normalizeKey,
  parseDateFlexible,
  parseNumericCell,
} from '../normalize.ts'
import { parseCsv } from '../csv.ts'
import type {
  AdapterInput,
  SkippedRow,
  SourceAdapter,
  StagedObservation,
  StageResult,
} from '../types.ts'

/** Real metric header set (docs/import-sources/playerdata.md). */
const METRIC_HEADERS = [
  'Distance',
  'Session Load',
  'Workload',
  'Sprint Distance',
  'High Intensity Running',
  'No. of High Intensity Events',
  'Yards per Minute',
  'No. of Sprints',
  'Top Speed',
  'Accelerations',
  'Decelerations',
] as const

const STRUCTURAL = new Set(['athlete', 'group', 'date', 'session'])

/** "Single-Session Report 14 Aug 26.csv" → 2026-08-14 */
function dateFromFilename(filename: string): string | null {
  const m = /(\d{1,2} [A-Za-z]{3} \d{2})(?:\s*\(\d+\))?\.csv$/i.exec(filename)
  return m ? parseDateFlexible(m[1]!) : null
}

export const playerDataAdapter: SourceAdapter = {
  source: 'PlayerData',
  provisionalFormat: true,

  detect(headers) {
    const set = new Set(headers.map(normalizeKey))
    const hits = METRIC_HEADERS.filter((h) => set.has(normalizeKey(h))).length
    return hits / METRIC_HEADERS.length
  },

  stage(input: AdapterInput): StageResult {
    const parsed = parseCsv(input.text)
    const staged: StagedObservation[] = []
    const skipped: SkippedRow[] = []
    const unmapped = new Set<string>()

    const headerByNorm = new Map(parsed.headers.map((h) => [normalizeKey(h), h]))
    const hasAthlete = headerByNorm.has('athlete')
    const hasDate = headerByNorm.has('date')
    const filenameDate = dateFromFilename(input.filename) ?? input.fallbackDate ?? null

    if (!hasAthlete) {
      return {
        source: 'PlayerData',
        staged: [],
        skipped: parsed.rows.map((raw, i) => ({
          sourceRowNumber: parsed.rowNumbers[i]!,
          raw,
          reason:
            'This export variant has no athlete identifier column — request the name-bearing PlayerData export (docs/import-sources/playerdata.md)',
          severity: 'error',
        })),
        unmappedHeaders: [],
        rowCount: parsed.rows.length,
      }
    }

    // Metric columns = every non-structural header; route through mappings
    const metricHeaders = parsed.headers.filter((h) => !STRUCTURAL.has(normalizeKey(h)))
    for (const header of metricHeaders) {
      const norm = normalizeKey(header)
      if (!input.mappings.has(norm) && !input.ignoredHeaders.has(norm)) unmapped.add(header)
    }

    // Section duplication (real hazard): identical athlete rows repeated under
    // team-wide/None groups are skipped, not re-staged.
    const seenRowIdentity = new Set<string>()

    parsed.rows.forEach((raw, i) => {
      const rowNumber = parsed.rowNumbers[i]!
      const rawName = (raw[headerByNorm.get('athlete')!] ?? '').trim()
      if (rawName === '') {
        skipped.push({
          sourceRowNumber: rowNumber,
          raw,
          reason: 'blank athlete name',
          severity: 'error',
        })
        return
      }

      let date: string | null = filenameDate
      if (hasDate) {
        const rawDate = raw[headerByNorm.get('date')!] ?? ''
        date = parseDateFlexible(rawDate)
        if (!date) {
          skipped.push({
            sourceRowNumber: rowNumber,
            raw,
            reason: `unparseable date "${rawDate}"`,
            severity: 'error',
          })
          return
        }
      }
      if (!date) {
        skipped.push({
          sourceRowNumber: rowNumber,
          raw,
          reason: 'no session date: file has no Date column and the filename carries no date',
          severity: 'error',
        })
        return
      }

      const sessionHeader = headerByNorm.get('session')
      const label =
        sessionHeader && (raw[sessionHeader] ?? '').trim() !== ''
          ? (raw[sessionHeader] ?? '').trim()
          : `Session ${date}`
      const rowWarnings: string[] = []
      if (!sessionHeader) {
        rowWarnings.push('session label derived from filename date — verify session assignment')
      }

      // Cross-section duplicate: identical metric content for the same athlete+date+label
      const metricSignature = metricHeaders
        .filter((h) => normalizeKey(h) !== 'group')
        .map((h) => raw[h] ?? '')
        .join('|')
      const identity = `${normalizeKey(rawName)}|${date}|${normalizeKey(label)}|${metricSignature}`
      if (seenRowIdentity.has(identity)) {
        skipped.push({
          sourceRowNumber: rowNumber,
          raw,
          reason: 'duplicate of an earlier row (athlete repeated in another report section)',
          severity: 'warning',
        })
        return
      }
      seenRowIdentity.add(identity)

      let producedAny = false
      for (const header of metricHeaders) {
        const norm = normalizeKey(header)
        const kpiKey = input.mappings.get(norm)
        if (!kpiKey) continue // unmapped or ignored — surfaced above
        const kpi = input.kpis.get(kpiKey)
        if (!kpi) continue
        const rawValue = raw[header] ?? ''
        const value = parseNumericCell(rawValue)
        if (value === null) {
          if (rawValue.trim() !== '') {
            rowWarnings.push(`non-numeric ${header}: "${rawValue}"`)
          } else {
            rowWarnings.push(`blank ${header} — no observation staged (blank ≠ 0)`)
          }
          continue
        }
        producedAny = true
        staged.push({
          sourceRowNumber: rowNumber,
          raw,
          athlete: { rawName },
          session: { date, label, type: inferSessionType(label) },
          kpiKey,
          rawHeader: header,
          rawValue,
          // PlayerData source units are already the canonical units (yd, mph, AU)
          valueCanonical: value,
          canonicalUnit: kpi.canonicalUnit,
          warnings: [...rowWarnings],
        })
        rowWarnings.length = 0 // attach row-level warnings once
      }
      if (!producedAny) {
        skipped.push({
          sourceRowNumber: rowNumber,
          raw,
          reason: 'row produced no observations (all cells blank/unmapped)',
          severity: 'warning',
        })
      }
    })

    return {
      source: 'PlayerData',
      staged,
      skipped,
      unmappedHeaders: [...unmapped],
      rowCount: parsed.rows.length,
    }
  },
}
