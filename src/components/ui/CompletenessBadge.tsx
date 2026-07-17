import { CircleAlert, CircleCheck } from 'lucide-react'

/**
 * Data-completeness indicator (§6.7): calculations and summaries always state
 * whether their underlying data is complete. Icon + text, never color alone.
 */
export function CompletenessBadge({
  missingCount,
  missingLabel,
}: {
  missingCount: number
  /** what is missing, e.g. "athletes without device data" */
  missingLabel: string
}) {
  if (missingCount === 0) {
    return (
      <span className="inline-flex items-center gap-1 text-label text-secondary">
        <CircleCheck aria-hidden className="size-3.5 text-good" />
        data complete
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 text-label text-warning">
      <CircleAlert aria-hidden className="size-3.5" />
      <span className="tabular">{missingCount}</span> {missingLabel}
    </span>
  )
}
