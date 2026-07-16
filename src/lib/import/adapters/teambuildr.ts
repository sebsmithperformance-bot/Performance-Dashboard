/**
 * TeamBuildr source adapter — PROVISIONAL (§8.1): built against the generated
 * fixture layout (Date, Athlete, Exercise, Top Working Weight (lb), Reps).
 * No real TeamBuildr export has been provided; only this file changes when
 * one arrives. KPI identity comes from the Exercise VALUE (not a column
 * header), routed through kpi_source_mapping like any other raw header.
 */
import { normalizeKey, parseDateFlexible, parseNumericCell } from '../normalize.ts'
import { parseCsv } from '../csv.ts'
import type {
  AdapterInput,
  SkippedRow,
  SourceAdapter,
  StagedObservation,
  StageResult,
} from '../types.ts'

const EXPECTED = ['date', 'athlete', 'exercise', 'top working weight (lb)', 'reps']

export const teamBuildrAdapter: SourceAdapter = {
  source: 'TeamBuildr',
  provisionalFormat: true,

  detect(headers) {
    const set = new Set(headers.map(normalizeKey))
    const hits = EXPECTED.filter((h) => set.has(h)).length
    return hits / EXPECTED.length
  },

  stage(input: AdapterInput): StageResult {
    const parsed = parseCsv(input.text)
    const staged: StagedObservation[] = []
    const skipped: SkippedRow[] = []
    const unmapped = new Set<string>()

    const h = new Map(parsed.headers.map((x) => [normalizeKey(x), x]))
    const missing = EXPECTED.filter((x) => x !== 'reps').filter((x) => !h.has(x))
    if (missing.length > 0) {
      return {
        source: 'TeamBuildr',
        staged: [],
        skipped: parsed.rows.map((raw, i) => ({
          sourceRowNumber: parsed.rowNumbers[i]!,
          raw,
          reason: `missing required column(s): ${missing.join(', ')}`,
          severity: 'error',
        })),
        unmappedHeaders: [],
        rowCount: parsed.rows.length,
      }
    }

    parsed.rows.forEach((raw, i) => {
      const rowNumber = parsed.rowNumbers[i]!
      const rawName = (raw[h.get('athlete')!] ?? '').trim()
      const rawDate = (raw[h.get('date')!] ?? '').trim()
      const exercise = (raw[h.get('exercise')!] ?? '').trim()
      const rawValue = raw[h.get('top working weight (lb)')!] ?? ''

      if (rawName === '' || exercise === '') {
        skipped.push({
          sourceRowNumber: rowNumber,
          raw,
          reason: rawName === '' ? 'blank athlete name' : 'blank exercise',
          severity: 'error',
        })
        return
      }
      const date = parseDateFlexible(rawDate)
      if (!date) {
        skipped.push({
          sourceRowNumber: rowNumber,
          raw,
          reason: `unparseable date "${rawDate}"`,
          severity: 'error',
        })
        return
      }

      const exerciseNorm = normalizeKey(exercise)
      if (input.ignoredHeaders.has(exerciseNorm)) return
      const kpiKey = input.mappings.get(exerciseNorm)
      if (!kpiKey) {
        unmapped.add(exercise)
        skipped.push({
          sourceRowNumber: rowNumber,
          raw,
          reason: `unmapped exercise "${exercise}"`,
          severity: 'warning',
        })
        return
      }
      const kpi = input.kpis.get(kpiKey)!

      const value = parseNumericCell(rawValue)
      if (value === null) {
        skipped.push({
          sourceRowNumber: rowNumber,
          raw,
          reason:
            rawValue.trim() === ''
              ? 'no completed value logged (blank ≠ 0)'
              : `non-numeric load "${rawValue}"`,
          severity: 'warning',
        })
        return
      }

      staged.push({
        sourceRowNumber: rowNumber,
        raw,
        athlete: { rawName },
        // One lift session per date in the provisional plan; resolution
        // matches any existing lift session on the date regardless of source.
        session: { date, label: 'Lift Session', type: 'lift' },
        kpiKey,
        rawHeader: exercise,
        rawValue,
        valueCanonical: value, // source lb = canonical lb
        canonicalUnit: kpi.canonicalUnit,
        warnings: [],
      })
    })

    return {
      source: 'TeamBuildr',
      staged,
      skipped,
      unmappedHeaders: [...unmapped],
      rowCount: parsed.rows.length,
    }
  },
}
