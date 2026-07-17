import { HeartPulse } from 'lucide-react'
import { useMemo, useState } from 'react'
import { DistributionBar } from '../../../components/charts/DistributionBar.tsx'
import { Panel } from '../../../components/ui/Panel.tsx'
import { loadHealthView } from '../../../lib/dashboard/selectors/load-health.ts'
import { useSettings } from '../../../lib/settings/SettingsContext.tsx'
import type { DashboardDataset } from '../../../lib/dashboard/types.ts'

const SEGMENT_COLORS: Record<string, string> = {
  below: 'var(--chart-series-2)',
  within: 'var(--status-good)',
  elevated: 'var(--status-warning)',
  incomplete: 'var(--status-neutral)',
  insufficient: 'var(--border-strong)',
}

/**
 * §5.1 Load Health tile: ACWR condensed to one clear status. Workload
 * observation language only — no injury prediction (§6.8); incomplete windows
 * are first-class, never hidden (§6.7).
 */
export function LoadHealthTile({ dataset, date }: { dataset: DashboardDataset; date: string }) {
  const [revealed, setRevealed] = useState<string | null>(null)
  const { settings } = useSettings()
  const view = useMemo(
    () => loadHealthView(dataset, date, null, settings.thresholds),
    [dataset, date, settings.thresholds],
  )

  const segments = [
    ...view.bands.map((b) => ({
      key: b.key,
      label: b.label,
      count: view.counts[b.key],
      color: SEGMENT_COLORS[b.key]!,
    })),
    {
      key: 'incomplete',
      label: 'Incomplete data',
      count: view.counts.incomplete,
      color: SEGMENT_COLORS['incomplete']!,
    },
    {
      key: 'insufficient',
      label: 'Insufficient history',
      count: view.counts.insufficient,
      color: SEGMENT_COLORS['insufficient']!,
    },
  ]

  const revealedAthletes =
    revealed === null
      ? null
      : view.athletes.filter((a) =>
          revealed === 'incomplete'
            ? a.reason === 'incomplete data'
            : revealed === 'insufficient'
              ? a.reason === 'insufficient history'
              : a.band === revealed,
        )

  return (
    <Panel
      icon={HeartPulse}
      title="Load Health"
      keyValue={`${view.counts.elevated} elevated · ${view.counts.incomplete} incomplete`}
    >
      <div className="flex flex-col gap-3">
        <DistributionBar segments={segments} selectedKey={revealed} onSelect={setRevealed} />
        {revealedAthletes && (
          <ul className="flex max-h-48 flex-col divide-y divide-subtle overflow-y-auto rounded-control border border-subtle">
            {revealedAthletes.length === 0 && (
              <li className="px-3 py-2 text-label text-secondary">no athletes here</li>
            )}
            {revealedAthletes.map((a) => (
              <li key={a.athleteId} className="flex items-baseline gap-2 px-3 py-2">
                <span className="text-body font-medium">{a.name}</span>
                <span className="text-label text-muted">{a.position}</span>
                <span className="tabular ml-auto text-label text-secondary">
                  {a.acwr !== null ? `ACWR ${a.acwr.toFixed(2)}` : a.reason}
                </span>
              </li>
            ))}
          </ul>
        )}
        <div className="text-label text-muted">
          <p className="tabular">
            {view.validCount} athletes with a valid calculation ·{' '}
            {view.counts.incomplete + view.counts.insufficient} without
          </p>
          <p className="mt-1">
            {view.loadKpiLabel}. Bands:{' '}
            {view.bands.map((b) => `${b.label} = ${b.definition}`).join(' · ')}. These are workload
            observations, not injury predictions.
          </p>
        </div>
      </div>
    </Panel>
  )
}
