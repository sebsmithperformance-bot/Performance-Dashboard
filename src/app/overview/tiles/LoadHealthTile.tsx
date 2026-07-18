import { HeartPulse } from 'lucide-react'
import { useMemo, useState } from 'react'
import { DistributionBar } from '../../../components/charts/DistributionBar.tsx'
import { InfoHint } from '../../../components/ui/InfoHint.tsx'
import { Panel } from '../../../components/ui/Panel.tsx'
import { formatInt } from '../../../lib/dashboard/format.ts'
import { loadHealthView } from '../../../lib/dashboard/selectors/load-health.ts'
import { useSettings } from '../../../lib/settings/SettingsContext.tsx'
import type { DashboardDataset } from '../../../lib/dashboard/types.ts'

const SEGMENT_COLORS: Record<string, string> = {
  below: 'var(--chart-series-2)',
  within: 'var(--status-good)',
  elevated: 'var(--status-warning)',
  high: 'var(--status-danger)',
  incomplete: 'var(--status-neutral)',
  insufficient: 'var(--border-strong)',
}

/**
 * §5.1 Load Health tile: ACWR condensed to four transparent states plus the
 * team-level numbers coaches scan first (median ACWR, average 7-day acute
 * load, valid/incomplete counts). Workload observation language only — no
 * injury prediction (§6.8); incomplete windows are first-class (§6.7). Band
 * definitions live behind an info affordance to keep the card scannable.
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
      label: b.short,
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

  const stats: { label: string; value: string }[] = [
    { label: 'Team median ACWR', value: view.teamMedianAcwr?.toFixed(2) ?? '—' },
    {
      label: 'Avg 7-day acute load',
      value: view.avgAcute7dLoad !== null ? `${formatInt(view.avgAcute7dLoad)} AU` : '—',
    },
    { label: 'Valid athletes', value: String(view.validCount) },
    {
      label: 'Without a valid ACWR',
      value: String(view.counts.incomplete + view.counts.insufficient),
    },
  ]

  return (
    <Panel
      icon={HeartPulse}
      title="Load Health"
      keyValue={`median ACWR ${view.teamMedianAcwr?.toFixed(2) ?? '—'}`}
    >
      <div className="flex flex-col gap-3">
        <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {stats.map((s) => (
            <div key={s.label} className="rounded-control bg-surface-2 px-3 py-2">
              <dt className="text-label text-muted">{s.label}</dt>
              <dd className="tabular text-subhead font-semibold">{s.value}</dd>
            </div>
          ))}
        </dl>

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

        <p className="flex items-center gap-1 text-label text-muted">
          Four workload states from the configured ACWR bands — observations, not injury
          predictions.
          <InfoHint label="ACWR band definitions">
            <span className="mb-1 block font-medium text-secondary">
              {view.loadKpiLabel}. Bands (editable in KPI Settings → Thresholds):
            </span>
            <span className="flex flex-col gap-0.5">
              {view.bands.map((b) => (
                <span key={b.key} className="block">
                  <span className="font-medium">{b.short}</span> — {b.definition}
                </span>
              ))}
            </span>
          </InfoHint>
        </p>
      </div>
    </Panel>
  )
}
