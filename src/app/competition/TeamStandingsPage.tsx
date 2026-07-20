import { Trophy } from 'lucide-react'
import { EmptyState } from '../../components/ui/EmptyState.tsx'
import { DataTable, type Column } from '../../components/ui/DataTable.tsx'
import { useCompetition } from './CompetitionContext.tsx'
import { Podium, type PodiumEntry } from './Podium.tsx'
import type { TeamStanding } from '../../lib/dashboard/selectors/competition.ts'

/** Competition → Team Standings (§10): podium + 4th + full standings table. */
export function TeamStandingsPage() {
  const { result } = useCompetition()
  const teams = result.teams.filter((t) => t.participants > 0)

  if (teams.length === 0) {
    return (
      <EmptyState
        icon={Trophy}
        title="No team points yet"
        message="No eligible results scored in this range. Assign teams in Competition Settings."
      />
    )
  }

  const podium: PodiumEntry[] = teams.map((t) => ({
    id: t.teamId,
    name: t.name,
    detail: `${t.participants} athletes`,
    points: t.points,
    rank: t.rank,
  }))

  const columns: Column<TeamStanding>[] = [
    { key: 'rank', header: '#', align: 'right', sortValue: (t) => t.rank, render: (t) => <span className="tabular">{t.rank}</span> },
    { key: 'team', header: 'Team', sortValue: (t) => t.name, render: (t) => <span className="font-medium">{t.name}</span> },
    { key: 'points', header: 'Points', align: 'right', sortValue: (t) => t.points, render: (t) => <span className="tabular font-semibold">{t.points}</span> },
    { key: 'avg', header: 'Avg / athlete', align: 'right', sortValue: (t) => t.avgPerParticipant, render: (t) => <span className="tabular">{t.avgPerParticipant.toFixed(1)}</span> },
    { key: 'participants', header: 'Athletes', align: 'right', sortValue: (t) => t.participants, render: (t) => <span className="tabular">{t.participants}</span> },
    { key: 'firsts', header: '1st', align: 'right', sortValue: (t) => t.firsts, render: (t) => <span className="tabular">{t.firsts}</span> },
    { key: 'podiums', header: 'Podiums', align: 'right', sortValue: (t) => t.podiums, render: (t) => <span className="tabular">{t.podiums}</span> },
    { key: 'events', header: 'Scored events', align: 'right', sortValue: (t) => t.scoredEvents, render: (t) => <span className="tabular">{t.scoredEvents}</span> },
  ]

  return (
    <div className="flex flex-col gap-5">
      <Podium entries={podium} />
      <DataTable columns={columns} rows={teams} rowKey={(t) => t.teamId} />
    </div>
  )
}
