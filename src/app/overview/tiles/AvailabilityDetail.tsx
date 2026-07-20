import { useMemo, useState } from 'react'
import { DistributionBar } from '../../../components/charts/DistributionBar.tsx'
import { PositionSelector } from '../../../components/controls/controls.tsx'
import { availabilityView } from '../../../lib/dashboard/selectors/availability.ts'
import { formatDayLabel } from '../../../lib/dashboard/format.ts'
import type { AvailabilityStatus, DashboardDataset } from '../../../lib/dashboard/types.ts'

const STATUS_META: { key: AvailabilityStatus; label: string; color: string }[] = [
  { key: 'full_go', label: 'Full Go', color: 'var(--status-good)' },
  { key: 'limited', label: 'Limited', color: 'var(--status-warning)' },
  { key: 'out', label: 'Out', color: 'var(--status-danger)' },
]

/** §4 Availability drill-down: roster + position breakdown, status filters,
 *  athlete list, effective date. */
export function AvailabilityDetail({ dataset, date }: { dataset: DashboardDataset; date: string }) {
  const [position, setPosition] = useState<string | null>(null)
  const [revealed, setRevealed] = useState<string | null>('full_go')
  const view = useMemo(() => availabilityView(dataset, date, position), [dataset, date, position])

  const revealedAthletes = revealed !== null ? view.byStatus[revealed as AvailabilityStatus] : null

  return (
    <div className="flex flex-col gap-3">
      <dl className="grid grid-cols-3 gap-2">
        {STATUS_META.map((s) => (
          <div key={s.key} className="rounded-control bg-surface-2 px-3 py-2">
            <dt className="text-label text-muted">{s.label}</dt>
            <dd className="tabular text-subhead font-semibold">{view.counts[s.key]}</dd>
          </div>
        ))}
      </dl>
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
        <ul className="flex max-h-72 flex-col divide-y divide-subtle overflow-y-auto rounded-control border border-subtle">
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
        {view.totalActive} active · effective {formatDayLabel(view.effectiveDate)}
        {view.noEntry > 0 && ` · ${view.noEntry} without an entry`}
      </p>
    </div>
  )
}
