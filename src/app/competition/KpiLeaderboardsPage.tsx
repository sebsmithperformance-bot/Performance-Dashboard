import { useState } from 'react'
import { Trophy } from 'lucide-react'
import { Badge } from '../../components/ui/Badge.tsx'
import { Drawer } from '../../components/ui/Drawer.tsx'
import { EmptyState } from '../../components/ui/EmptyState.tsx'
import { useCompetition } from './CompetitionContext.tsx'
import type { KpiLeaderboard } from '../../lib/dashboard/selectors/competition.ts'

/** Competition → KPI Leaderboards (§10): one card per Competition KPI; click
 *  opens the complete leaderboard for that KPI. */
export function KpiLeaderboardsPage() {
  const { result } = useCompetition()
  const [open, setOpen] = useState<KpiLeaderboard | null>(null)
  const boards = result.kpis.filter((k) => k.rows.length > 0)

  if (boards.length === 0) {
    return (
      <EmptyState
        icon={Trophy}
        title="No KPI points yet"
        message="No eligible KPI scored in this range."
      />
    )
  }

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {boards.map((board) => (
          <button
            key={board.kpiKey}
            type="button"
            onClick={() => setOpen(board)}
            className="flex cursor-pointer flex-col gap-2 rounded-card border border-subtle bg-surface p-4 text-left transition-colors hover:border-strong hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
          >
            <div className="flex items-center gap-2">
              <span className="section-label text-body font-semibold">{board.kpiName}</span>
              <Badge tone="neutral">{board.modeLabel}</Badge>
            </div>
            <ol className="flex flex-col gap-1">
              {board.rows.slice(0, 3).map((r) => (
                <li key={r.athleteId} className="flex items-baseline gap-2 text-body">
                  <span className="tabular w-4 text-muted">{r.rank}</span>
                  <span className="font-medium">{r.name}</span>
                  <span className="tabular ml-auto font-semibold">{r.points}</span>
                </li>
              ))}
            </ol>
            <span className="mt-auto text-label font-medium text-muted">View full leaderboard</span>
          </button>
        ))}
      </div>

      {open && (
        <Drawer title={`${open.kpiName} · ${open.modeLabel}`} onClose={() => setOpen(null)}>
          <ul className="flex flex-col divide-y divide-subtle rounded-control border border-subtle">
            {open.rows.map((r) => (
              <li key={r.athleteId} className="flex items-baseline gap-2 px-3 py-2">
                <span className="tabular w-6 text-muted">{r.rank}</span>
                <span className="text-body font-medium">{r.name}</span>
                <span className="text-label text-muted">{r.teamName ?? r.position}</span>
                <span className="tabular ml-auto text-body font-semibold">{r.points} pts</span>
                {r.latestValue !== null && (
                  <span className="tabular text-label text-muted">
                    latest {r.latestValue.toFixed(1)}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </Drawer>
      )}
    </>
  )
}
