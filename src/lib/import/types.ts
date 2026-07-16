/**
 * Shared ingestion contract (§4, ADR-003). Everything downstream of an
 * adapter — resolution, validation, preview, commit — sees only these types.
 * Vendor-specific column names never leave the adapters, so a future API
 * connector is just another `SourceAdapter` whose `stage()` reads a response
 * body instead of CSV text.
 */
import type { Unit } from '../units/index.ts'

export type Source = 'TeamBuildr' | 'PlayerData' | 'Perch'

export type SessionType = 'practice' | 'lift' | 'game' | 'recovery' | 'testing' | 'other'

export interface AthleteRef {
  externalId?: string
  rawName: string
}

export interface SessionRef {
  externalId?: string
  date: string // ISO YYYY-MM-DD
  startTime?: string // HH:MM
  label: string
  type: SessionType
}

/** One normalized candidate observation produced by an adapter. */
export interface StagedObservation {
  sourceRowNumber: number
  raw: Record<string, string>
  athlete: AthleteRef
  session: SessionRef
  kpiKey: string
  /** The source header or exercise name that produced this observation. */
  rawHeader: string
  rawValue: string
  valueCanonical: number
  canonicalUnit: Unit
  warnings: string[]
}

/** A source row (or cell group) that produced no observation. */
export interface SkippedRow {
  sourceRowNumber: number
  raw: Record<string, string>
  reason: string
  severity: 'warning' | 'error'
}

export interface StageResult {
  source: Source
  staged: StagedObservation[]
  skipped: SkippedRow[]
  /** Normalized headers/exercise names with no KPI mapping and not ignored. */
  unmappedHeaders: string[]
  rowCount: number
}

export interface KpiConfig {
  key: string
  displayName: string
  canonicalUnit: Unit
  validMin: number | null
  validMax: number | null
  aggregationMethod: 'max' | 'mean' | 'sum' | 'last' | 'best_set' | 'source_value'
  primarySource: string
  category: string
  decimalPlaces: number
}

export interface AdapterInput {
  text: string
  filename: string
  /** User-supplied session date for files that carry no date column and whose filename has none. */
  fallbackDate?: string
  /** normalized raw_header/exercise → kpi_key (registry rows + this import's additions) */
  mappings: ReadonlyMap<string, string>
  /** normalized headers/exercises explicitly ignored */
  ignoredHeaders: ReadonlySet<string>
  kpis: ReadonlyMap<string, KpiConfig>
}

export interface SourceAdapter {
  source: Source
  /**
   * PROVISIONAL format marker (§8.1): true until a representative real export
   * for this source has been supplied and the adapter re-verified against it.
   */
  provisionalFormat: boolean
  /** Confidence 0–1 that a header set belongs to this source (suggestion only, §4.2). */
  detect(headers: string[]): number
  stage(input: AdapterInput): StageResult
}
