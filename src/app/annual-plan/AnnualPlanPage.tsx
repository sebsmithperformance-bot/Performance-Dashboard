import { CalendarRange } from 'lucide-react'
import { EmptyState } from '../../components/ui/EmptyState.tsx'

/** Annual Plan (§11). Real link-card implementation lands in the annual-plan
 *  commit; this placeholder keeps the top-level route live. */
export function AnnualPlanPage() {
  return (
    <EmptyState
      icon={CalendarRange}
      title="Annual Plan"
      message="Link the current Excel workbook to open it from the dashboard — coming in this revision."
    />
  )
}
