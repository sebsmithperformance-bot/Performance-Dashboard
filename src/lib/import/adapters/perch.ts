/**
 * Perch source adapter — PROVISIONAL (§8.1): built against the generated
 * fixture layout (Date, Athlete, Exercise, Metric, Power (W)). Perch stays a
 * fully independent source (§1): observations may exist with or without a
 * matching TeamBuildr load. Tolerates a renamed power column (real-world
 * export drift) with a warning; unknown extra columns surface as unmapped.
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

const CORE = ['date', 'athlete', 'exercise', 'metric']

export const perchAdapter: SourceAdapter = {
  source: 'Perch',
  provisionalFormat: true,

  detect(headers) {
    const set = new Set(headers.map(normalizeKey))
    const core = CORE.filter((x) => set.has(x)).length / CORE.length
    const hasPower = headers.some((x) => /power/i.test(x)) ? 1 : 0
    return core * 0.75 + hasPower * 0.25
  },

  stage(input: AdapterInput): StageResult {
    const parsed = parseCsv(input.text)
    const staged: StagedObservation[] = []
    const skipped: SkippedRow[] = []
    const unmapped = new Set<string>()

    const h = new Map(parsed.headers.map((x) => [normalizeKey(x), x]))
    const powerHeader = parsed.headers.find((x) => /power.*\(w\)/i.test(x))
    const missing = CORE.filter((x) => !h.has(x))
    if (missing.length > 0 || !powerHeader) {
      const reason = !powerHeader
        ? 'no power value column found'
        : `missing required column(s): ${missing.join(', ')}`
      return {
        source: 'Perch',
        staged: [],
        skipped: parsed.rows.map((raw, i) => ({
          sourceRowNumber: parsed.rowNumbers[i]!,
          raw,
          reason,
          severity: 'error',
        })),
        unmappedHeaders: [],
        rowCount: parsed.rows.length,
      }
    }

    const nonstandardPower = normalizeKey(powerHeader) !== 'power (w)'
    // Extra columns beyond the known structure are user-mappable or ignorable
    const known = new Set([...CORE, normalizeKey(powerHeader)])
    for (const header of parsed.headers) {
      const norm = normalizeKey(header)
      if (known.has(norm)) continue
      if (!input.mappings.has(norm) && !input.ignoredHeaders.has(norm)) unmapped.add(header)
    }

    parsed.rows.forEach((raw, i) => {
      const rowNumber = parsed.rowNumbers[i]!
      const rawName = (raw[h.get('athlete')!] ?? '').trim()
      const rawDate = (raw[h.get('date')!] ?? '').trim()
      const exercise = (raw[h.get('exercise')!] ?? '').trim()
      const metric = (raw[h.get('metric')!] ?? '').trim()
      const rawValue = raw[powerHeader] ?? ''

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
              ? 'blank power reading (blank ≠ 0)'
              : `non-numeric power "${rawValue}"`,
          severity: 'warning',
        })
        return
      }

      const warnings: string[] = []
      if (nonstandardPower) {
        warnings.push(`nonstandard power column "${powerHeader}" — verify export settings`)
      }
      const expectPeak = kpi.key.includes('peak')
      const metricNorm = normalizeKey(metric)
      if (metricNorm !== '' && expectPeak !== metricNorm.includes('peak')) {
        warnings.push(`Metric column says "${metric}" but ${kpi.displayName} was mapped`)
      }

      staged.push({
        sourceRowNumber: rowNumber,
        raw,
        athlete: { rawName },
        session: { date, label: 'Lift Session', type: 'lift' },
        kpiKey,
        rawHeader: exercise,
        rawValue,
        valueCanonical: value, // source W = canonical W
        canonicalUnit: kpi.canonicalUnit,
        warnings,
      })
    })

    return {
      source: 'Perch',
      staged,
      skipped,
      unmappedHeaders: [...unmapped],
      rowCount: parsed.rows.length,
    }
  },
}
