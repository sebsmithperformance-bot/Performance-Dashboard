import { Trophy } from 'lucide-react'
import { EmptyState } from '../../components/ui/EmptyState.tsx'
import { DataTable, type Column } from '../../components/ui/DataTable.tsx'
import { useCompetition } from './CompetitionContext.tsx'
import { Podium, type PodiumEntry } from './Podium.tsx'
import type { AthleteStanding } from '../../lib/dashboard/selectors/competition.ts'

/** Competition → Individual Leaderboard (§10): podium + 4th + full leaderboard. */
export function IndividualLeaderboardPage() {
  const { result } = useCompetition()
  const athletes = result.athletes

  if (athletes.length === 0) {
    return (
      <EmptyState
        icon={Trophy}
        title="No athlete points yet"
        message="No eligible results scored in this range."
      />
    )
  }

  const podium: PodiumEntry[] = athletes.map((a) => ({
    id: a.athleteId,
    name: a.name,
    detail: a.teamName ? `${a.teamName} · ${a.position}` : a.position,
    points: a.points,
    rank: a.rank,
  }))

  const columns: Column<AthleteStanding>[] = [
    { key: 'rank', header: '#', align: 'right', sortValue: (a) => a.rank, render: (a) => <span className="tabular">{a.rank}</span> },
    { key: 'athlete', header: 'Athlete', sortValue: (a) => a.name, render: (a) => <span className="font-medium">{a.name}</span> },
    { key: 'team', header: 'Team', sortValue: (a) => a.teamName ?? '', render: (a) => <span className="text-secondary">{a.teamName ?? '—'}</span> },
    { key: 'position', header: 'Position', sortValue: (a) => a.position, render: (a) => <span className="text-secondary">{a.position}</span> },
    { key: 'points', header: 'Points', align: 'right', sortValue: (a) => a.points, render: (a) => <span className="tabular font-semibold">{a.points}</span> },
    { key: 'firsts', header: '1st', align: 'right', sortValue: (a) => a.firsts, render: (a) => <span className="tabular">{a.firsts}</span> },
    { key: 'podiums', header: 'Podiums', align: 'right', sortValue: (a) => a.podiums, render: (a) => <span className="tabular">{a.podiums}</span> },
    { key: 'sessions', header: 'Scored sessions', align: 'right', sortValue: (a) => a.scoredSessions, render: (a) => <span className="tabular">{a.scoredSessions}</span> },
  ]

  return (
    <div className="flex flex-col gap-5">
      <Podium entries={podium} />
      <DataTable columns={columns} rows={athletes} rowKey={(a) => a.athleteId} />
    </div>
  )
}
