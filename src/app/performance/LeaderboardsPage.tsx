import { useMemo, useState } from 'react'
import {
  CONTROL_CLASS,
  FilterBar,
  LabeledControl,
  MetricSelector,
  PositionSelector,
  SeasonSelector,
} from '../../components/controls/controls.tsx'
import { SaveViewControl } from '../../components/controls/SaveViewControl.tsx'
import { DataTable, type Column } from '../../components/ui/DataTable.tsx'
import { ErrorState } from '../../components/ui/ErrorState.tsx'
import { KPIValue } from '../../components/ui/KPIValue.tsx'
import { Skeleton } from '../../components/ui/Skeleton.tsx'
import { TrendIndicator } from '../../components/ui/TrendIndicator.tsx'
import { useDashboardData } from '../../lib/dashboard/DashboardDataContext.tsx'
import { leaderboardView, type LeaderboardRow } from '../../lib/dashboard/selectors/performance.ts'
import { useSettings } from '../../lib/settings/SettingsContext.tsx'
import type { ComparisonBasis, DashboardDataset } from '../../lib/dashboard/types.ts'

const BASES: { value: ComparisonBasis; label: string }[] = [
  { value: 'prior_week', label: 'Prior week' },
  { value: 'prior_session', label: 'Prior session' },
  { value: 'rolling_average', label: 'Rolling average' },
]

/** Performance → Leaderboards (§5.4): every eligible S&C metric, value +
 *  change vs a selectable basis. No points anywhere. */
export function LeaderboardsPage() {
  const { status, error, dataset, selectedDate, savedViews } = useDashboardData()

  if (status === 'loading') return <Skeleton className="h-96 w-full" />
  if (status === 'error' || !dataset || !selectedDate) {
    return (
      <ErrorState
        title="Dashboard data unavailable"
        message={error ?? 'No dataset loaded — run npm run seed:generate and reload.'}
      />
    )
  }
  return <Leaderboards dataset={dataset} date={selectedDate} savedViews={savedViews} />
}

function Leaderboards({
  dataset,
  date,
  savedViews,
}: {
  dataset: DashboardDataset
  date: string
  savedViews: ReturnType<typeof useDashboardData>['savedViews']
}) {
  const { settings } = useSettings()
  const kpis = useMemo(
    () =>
      [...dataset.kpis.values()].filter(
        (k) => k.visibility.leaderboards && (k.category === 'Strength' || k.category === 'Power'),
      ),
    [dataset],
  )
  const [kpiKey, setKpiKey] = useState(kpis[0]?.key ?? '')
  const [basis, setBasis] = useState<ComparisonBasis>(
    settings.display.defaultComparisonBasis === 'custom_range'
      ? 'prior_week'
      : settings.display.defaultComparisonBasis,
  )
  const [position, setPosition] = useState<string | null>(null)

  const view = useMemo(
    () => leaderboardView(dataset, kpiKey, basis, date, position, settings.thresholds),
    [dataset, kpiKey, basis, date, position, settings.thresholds],
  )
  const kpi = view.kpi

  const columns = useMemo<Column<LeaderboardRow>[]>(() => {
    if (!kpi) return []
    return [
      {
        key: 'rank',
        header: '#',
        align: 'right',
        sortValue: (r) => r.rank,
        render: (r) => <span className="tabular text-secondary">{r.rank}</span>,
      },
      {
        key: 'athlete',
        header: 'Athlete',
        sortValue: (r) => r.name,
        render: (r) => <span className="font-medium">{r.name}</span>,
      },
      {
        key: 'position',
        header: 'Position',
        sortValue: (r) => r.position,
        render: (r) => <span className="text-secondary">{r.position}</span>,
      },
      {
        key: 'value',
        header: kpi.displayName,
        align: 'right',
        sortValue: (r) => r.current,
        render: (r) => <KPIValue value={r.current} kpi={kpi} size="small" />,
      },
      {
        key: 'change',
        header: `Change ${view.basisLabel}`,
        align: 'right',
        sortValue: (r) => r.deltaPct,
        render: (r) =>
          r.deltaPct === null ? (
            <span className="text-label text-muted">{r.reason ?? 'no comparison'}</span>
          ) : (
            <TrendIndicator deltaPct={r.deltaPct} interpretation={kpi.interpretation} />
          ),
      },
      {
        key: 'baseline',
        header: 'Baseline',
        align: 'right',
        sortValue: (r) => r.baseline,
        render: (r) => <KPIValue value={r.baseline} kpi={kpi} size="small" showUnit={false} />,
      },
    ]
  }, [kpi, view.basisLabel])

  return (
    <div className="flex flex-col gap-4">
      <FilterBar>
        <SeasonSelector seasonLabel={dataset.seasonLabel} />
        <MetricSelector kpis={kpis} value={kpiKey} onChange={setKpiKey} />
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
        <PositionSelector value={position} onChange={setPosition} />
        <SaveViewControl
          page="performance-leaderboards"
          store={savedViews}
          getCurrentConfig={() => ({ kpiKey, basis, position })}
          onApply={(config) => {
            const key = config['kpiKey'] as string | undefined
            if (key && kpis.some((k) => k.key === key)) setKpiKey(key)
            setBasis((config['basis'] as ComparisonBasis) ?? 'prior_week')
            setPosition((config['position'] as string | null) ?? null)
          }}
        />
      </FilterBar>

      {kpi === null ? (
        <ErrorState title="No metric selected" message="Pick an S&C metric above." />
      ) : (
        <>
          <DataTable columns={columns} rows={view.rows} rowKey={(r) => r.athleteId} />
          <p className="text-label text-muted">
            Ranked by most recent value
            {kpi.interpretation === 'lower_is_better' ? ' (lower is better)' : ''} · raw metric
            only, no points or composite score (§6.2)
            {view.withoutData > 0 &&
              ` · ${view.withoutData} athlete${view.withoutData === 1 ? '' : 's'} without an observation not listed`}
            .
          </p>
        </>
      )}
    </div>
  )
}
