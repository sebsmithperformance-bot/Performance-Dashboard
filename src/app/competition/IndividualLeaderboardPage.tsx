import { Trophy } from 'lucide-react'
import { EmptyState } from '../../components/ui/EmptyState.tsx'

/** Competition → Individual Leaderboard (§10). Placeholder until the
 *  standalone-competition commit. */
export function IndividualLeaderboardPage() {
  return (
    <EmptyState
      icon={Trophy}
      title="Individual Leaderboard"
      message="Accumulated competition points by athlete — coming in this revision."
    />
  )
}
