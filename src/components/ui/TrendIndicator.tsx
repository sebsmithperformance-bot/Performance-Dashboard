import { ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react'
import { formatPercentDelta } from '../../lib/dashboard/format.ts'
import type { KpiInterpretation } from '../../lib/dashboard/types.ts'

/**
 * Signed change with direction-aware coloring. Neutral/target-range KPIs are
 * never forced into good/bad framing (§6.6); meaning is carried by the signed
 * text, not color alone (§12.2).
 */
export function TrendIndicator({
  deltaPct,
  interpretation = 'neutral',
  label,
}: {
  deltaPct: number | null
  interpretation?: KpiInterpretation
  /** context suffix, e.g. "vs prior game" */
  label?: string
}) {
  const text = formatPercentDelta(deltaPct)
  if (text === null) {
    return <span className="text-label text-muted">no comparison</span>
  }
  const direction = deltaPct! > 0 ? 'up' : deltaPct! < 0 ? 'down' : 'flat'
  const judged = interpretation === 'higher_is_better' || interpretation === 'lower_is_better'
  const good =
    (interpretation === 'higher_is_better' && direction === 'up') ||
    (interpretation === 'lower_is_better' && direction === 'down')
  const colorClass =
    !judged || direction === 'flat' ? 'text-secondary' : good ? 'text-good' : 'text-warning'
  const Icon = direction === 'up' ? ArrowUpRight : direction === 'down' ? ArrowDownRight : Minus

  return (
    <span className={`inline-flex items-center gap-1 text-label font-medium ${colorClass}`}>
      <Icon aria-hidden className="size-3.5" />
      <span className="tabular">{text}</span>
      {label && <span className="font-normal text-muted">{label}</span>}
    </span>
  )
}
