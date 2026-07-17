import { UsersRound } from 'lucide-react'
import { useMemo, useState } from 'react'
import { DistributionBar } from '../../../components/charts/DistributionBar.tsx'
import { PositionSelector } from '../../../components/controls/controls.tsx'
import { Panel } from '../../../components/ui/Panel.tsx'
import { availabilityView } from '../../../lib/dashboard/selectors/availability.ts'
import { formatDayLabel } from '../../../lib/dashboard/format.ts'
import type { AvailabilityStatus, DashboardDataset } from '../../../lib/dashboard/types.ts'

const STATUS_META: { key: AvailabilityStatus; label: string; color: string }[] = [
  { key: 'full_go', label: 'Full Go', color: 'var(--status-good)' },
  { key: 'limited', label: 'Limited', color: 'var(--status-warning)' },
  { key: 'out', label: 'Out', color: 'var(--status-danger)' },
]

/** §5.1 Availability tile: team-wide status with reveal-in-place lists. */
export function AvailabilityTile({ dataset, date }: { dataset: DashboardDataset; date: string }) {
  const [position, setPosition] = useState<string | null>(null)
  const [revealed, setRevealed] = useState<string | null>(null)
  const view = useMemo(() => availabilityView(dataset, date, position), [dataset, date, position])

  const revealedAthletes = revealed !== null ? view.byStatus[revealed as AvailabilityStatus] : null

  return (
    <Panel
      icon={UsersRound}
      title="Availability"
      keyValue={`${view.counts.full_go}/${view.totalActive} Full Go`}
    >
      <div className="flex flex-col gap-3">
        <PositionSelector value={position} onChange={setPosition} />
        <DistributionBar
          segments={STATUS_META.map((s) => ({
            key: s.key,
            label: s.label,
            count: view.counts[s.key],
            color: s.color,
          }))}
          selectedKey={revealed}
          onSelect={setRevealed}
        />
        {revealedAthletes && (
          <ul className="flex flex-col divide-y divide-subtle rounded-control border border-subtle">
            {revealedAthletes.length === 0 && (
              <li className="px-3 py-2 text-label text-secondary">no athletes in this status</li>
            )}
            {revealedAthletes.map((a) => (
              <li key={a.athleteId} className="flex items-baseline gap-2 px-3 py-2">
                <span className="text-body font-medium">{a.name}</span>
                <span className="text-label text-muted">{a.position}</span>
                {a.note && <span className="ml-auto text-label text-secondary">{a.note}</span>}
              </li>
            ))}
          </ul>
        )}
        <p className="text-label text-muted">
          {view.totalActive} active athletes · effective {formatDayLabel(view.effectiveDate)}
          {view.noEntry > 0 && ` · ${view.noEntry} without an entry`}
        </p>
      </div>
    </Panel>
  )
}
