import { Trophy } from 'lucide-react'
import { EmptyState } from '../../components/ui/EmptyState.tsx'

/** Competition → KPI Leaderboards (§10). Placeholder until the
 *  standalone-competition commit. */
export function KpiLeaderboardsPage() {
  return (
    <EmptyState
      icon={Trophy}
      title="KPI Leaderboards"
      message="Points per competition KPI — coming in this revision."
    />
  )
}
