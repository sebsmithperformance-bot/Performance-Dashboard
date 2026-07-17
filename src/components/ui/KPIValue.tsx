import { formatMetricValue } from '../../lib/dashboard/format.ts'

const SIZE_CLASS = {
  big: 'text-kpi font-bold',
  medium: 'text-widget font-semibold',
  small: 'text-body font-medium',
} as const

/**
 * The only way a metric value reaches the DOM: registry decimals, unit text,
 * missing ≠ zero, NaN/∞ impossible (format core), tabular numerals (§12.3).
 */
export function KPIValue({
  value,
  kpi,
  size = 'medium',
  showUnit = true,
}: {
  value: number | null | undefined
  kpi: { decimalPlaces: number; unit: string }
  size?: keyof typeof SIZE_CLASS
  showUnit?: boolean
}) {
  const formatted = formatMetricValue(value, kpi)
  return (
    <span
      className={`tabular ${SIZE_CLASS[size]} ${formatted.missing ? 'text-muted' : ''}`}
      aria-label={formatted.aria}
    >
      {formatted.text}
      {showUnit && formatted.unit && (
        <span className="ml-1 align-baseline text-label font-normal text-muted">
          {formatted.unit}
        </span>
      )}
    </span>
  )
}
