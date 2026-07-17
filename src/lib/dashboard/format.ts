/**
 * Metric formatting core (§6.5, Step-5 rules). Every rendered metric value in
 * the app flows through here: registry decimals, unit text, missing ≠ zero,
 * and a hard guard so NaN/Infinity/undefined can never reach the DOM.
 */
import type { DashKpi } from './types.ts'

export const MISSING_TEXT = '—'

export interface FormattedMetric {
  /** display text, e.g. "5,907" or "—" */
  text: string
  /** unit label when applicable and value present, e.g. "yd" */
  unit: string | null
  /** true when the value was absent (never conflated with zero) */
  missing: boolean
  /** accessible description, e.g. "5,907 yards" / "no data" */
  aria: string
}

/** Unit → human label (display units mirror canonical for v1, ADR-006). */
const UNIT_LABEL: Record<string, string> = {
  yd: 'yd',
  mph: 'mph',
  lb: 'lb',
  AU: 'AU',
  W: 'W',
  count: '',
  min: 'min',
  yd_per_min: 'yd/min',
  scale_1_10: '/ 10',
}

export function unitLabel(unit: string): string {
  return UNIT_LABEL[unit] ?? unit
}

export function formatMetricValue(
  value: number | null | undefined,
  kpi: Pick<DashKpi, 'decimalPlaces' | 'unit'>,
): FormattedMetric {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    // NaN/Infinity are treated as missing and never rendered (§6.5)
    return { text: MISSING_TEXT, unit: null, missing: true, aria: 'no data' }
  }
  const text = value.toLocaleString('en-US', {
    minimumFractionDigits: kpi.decimalPlaces,
    maximumFractionDigits: kpi.decimalPlaces,
  })
  const unit = unitLabel(kpi.unit) || null
  return { text, unit, missing: false, aria: unit ? `${text} ${unit}` : text }
}

/** Signed delta text, e.g. "+4.2%" / "−3.1%"; null when not computable. */
export function formatPercentDelta(value: number | null): string | null {
  if (value === null || !Number.isFinite(value)) return null
  const rounded = Math.round(value * 10) / 10
  const sign = rounded > 0 ? '+' : rounded < 0 ? '−' : '±'
  return `${sign}${Math.abs(rounded).toLocaleString('en-US', { maximumFractionDigits: 1 })}%`
}

export function formatDayLabel(iso: string): string {
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${iso}T00:00:00Z`))
}
