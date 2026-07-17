import { Dumbbell } from 'lucide-react'
import { useMemo, useState } from 'react'
import { DistributionBar } from '../../../components/charts/DistributionBar.tsx'
import {
  CONTROL_CLASS,
  DateRangeSelector,
  LabeledControl,
  MetricSelector,
} from '../../../components/controls/controls.tsx'
import { KPIValue } from '../../../components/ui/KPIValue.tsx'
import { Panel } from '../../../components/ui/Panel.tsx'
import { formatPercentDelta } from '../../../lib/dashboard/format.ts'
import { scChangeView, type ComparisonBasis } from '../../../lib/dashboard/selectors/sc-change.ts'
import { addDays } from '../../../lib/calculations/index.ts'
import type { DashboardDataset, Position } from '../../../lib/dashboard/types.ts'

const BASES: { value: ComparisonBasis; label: string }[] = [
  { value: 'prior_session', label: 'Prior session' },
  { value: 'prior_week', label: 'Prior week' },
  { value: 'rolling_average', label: 'Rolling average' },
  { value: 'custom_range', label: 'Custom range' },
]

const POSITIONS: (Position | 'all')[] = ['all', 'Goalkeeper', 'Defender', 'Midfielder', 'Forward']

/** §5.1 S&C % Change tile: coach-selected KPI over a chosen basis. */
export function ScChangeTile({ dataset, date }: { dataset: DashboardDataset; date: string }) {
  const scKpis = useMemo(
    () =>
      [...dataset.kpis.values()].filter((k) => k.category === 'Strength' || k.category === 'Power'),
    [dataset],
  )
  const [kpiKey, setKpiKey] = useState(scKpis[0]?.key ?? 'back_squat_top_load')
  const [basis, setBasis] = useState<ComparisonBasis>('prior_week')
  const [position, setPosition] = useState<Position | 'all'>('all')
  const [range, setRange] = useState({ from: dataset.seasonStart, to: addDays(date, -7) })
  const [revealed, setRevealed] = useState<string | null>(null)

  const view = useMemo(
    () =>
      scChangeView(
        dataset,
        kpiKey,
        basis,
        position === 'all' ? null : position,
        date,
        basis === 'custom_range' ? range : undefined,
      ),
    [dataset, kpiKey, basis, position, date, range],
  )
  const kpi = dataset.kpis.get(kpiKey)!
  const medianText = formatPercentDelta(view.medianDeltaPct)

  const segments = [
    {
      key: 'improved',
      label: 'Improved',
      count: view.counts.improved,
      color: 'var(--status-good)',
    },
    {
      key: 'unchanged',
      label: `Unchanged (±${view.unchangedBandPct}%)`,
      count: view.counts.unchanged,
      color: 'var(--status-neutral)',
    },
    {
      key: 'declined',
      label: 'Declined',
      count: view.counts.declined,
      color: 'var(--status-warning)',
    },
    {
      key: 'notComputable',
      label: 'No comparison',
      count: view.counts.notComputable,
      color: 'var(--border-strong)',
    },
  ]
  const revealedAthletes =
    revealed === null
      ? null
      : view.athletes.filter((a) =>
          revealed === 'notComputable' ? a.classification === null : a.classification === revealed,
        )

  return (
    <Panel icon={Dumbbell} title="S&C % Change" keyValue={medianText ?? 'no comparison'}>
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap gap-x-4 gap-y-2">
          <MetricSelector kpis={scKpis} value={kpiKey} onChange={setKpiKey} label="KPI" />
          <LabeledControl label="Basis">
            <select
              value={basis}
              onChange={(e) => setBasis(e.target.value as ComparisonBasis)}
              className={CONTROL_CLASS}
            >
              {BASES.map((b) => (
                <option key={b.value} value={b.value}>
                  {b.label}
                </option>
              ))}
            </select>
          </LabeledControl>
          <LabeledControl label="Group">
            <select
              value={position}
              onChange={(e) => setPosition(e.target.value as Position | 'all')}
              className={CONTROL_CLASS}
            >
              {POSITIONS.map((p) => (
                <option key={p} value={p}>
                  {p === 'all' ? 'Full team' : `${p}s`}
                </option>
              ))}
            </select>
          </LabeledControl>
          {basis === 'custom_range' && (
            <DateRangeSelector from={range.from} to={range.to} onChange={setRange} />
          )}
        </div>

        <div className="flex items-end gap-3">
          <span className="tabular text-kpi font-bold">{medianText ?? '—'}</span>
          <span className="pb-1 text-label text-muted">group median {view.basisLabel}</span>
        </div>

        <DistributionBar segments={segments} selectedKey={revealed} onSelect={setRevealed} />
        {revealedAthletes && (
          <ul className="flex max-h-48 flex-col divide-y divide-subtle overflow-y-auto rounded-control border border-subtle">
            {revealedAthletes.map((a) => (
              <li key={a.athleteId} className="flex items-baseline gap-2 px-3 py-2">
                <span className="text-body font-medium">{a.name}</span>
                <span className="tabular ml-auto text-label text-secondary">
                  {a.deltaPct !== null ? formatPercentDelta(a.deltaPct) : (a.reason ?? '—')}
                </span>
              </li>
            ))}
          </ul>
        )}

        <p className="flex flex-wrap items-baseline gap-x-3 text-label text-muted">
          <span>
            median baseline <KPIValue value={view.baselineMedian} kpi={kpi} size="small" />
          </span>
          <span>
            → current <KPIValue value={view.currentMedian} kpi={kpi} size="small" />
          </span>
          <span className="tabular">
            {view.withData}/{view.groupSize} athletes comparable
          </span>
        </p>
      </div>
    </Panel>
  )
}
