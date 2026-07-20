import { Trophy } from 'lucide-react'
import { EmptyState } from '../../components/ui/EmptyState.tsx'

/** Admin → Competition Settings (§10). Placeholder until the
 *  standalone-competition commit. */
export function CompetitionSettingsPage() {
  return (
    <EmptyState
      icon={Trophy}
      title="Competition Settings"
      message="Teams, KPI eligibility, scoring profiles, and page visibility — coming in this revision."
    />
  )
}
