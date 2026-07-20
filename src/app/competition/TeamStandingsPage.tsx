import { Trophy } from 'lucide-react'
import { EmptyState } from '../../components/ui/EmptyState.tsx'

/** Competition → Team Standings (§10). Real implementation lands in the
 *  standalone-competition commit; this placeholder keeps the route live. */
export function TeamStandingsPage() {
  return (
    <EmptyState
      icon={Trophy}
      title="Team Standings"
      message="Accumulated competition points by team — coming in this revision."
    />
  )
}
