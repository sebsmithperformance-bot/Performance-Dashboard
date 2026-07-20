/**
 * Data Trends shared explorer (§5.3): graph + table together, one KPI over a
 * date range, Group or Individual lens. Both sub-tabs render THIS component —
 * they differ only in the KPI catalog they pass (per §5.3, never two
 * implementations).
 */
import { useMemo, useState } from 'react'
import { LineChart } from '../../components/charts/LineChart.tsx'
import {
  AthleteSelector,
  CONTROL_CLASS,
  DateRangeSelector,
  FilterBar,
  LabeledControl,
  MetricSelector,
  PositionSelector,
  SeasonSelector,
} from '../../components/controls/controls.tsx'
import { SaveViewControl } from '../../components/controls/SaveViewControl.tsx'
import { ChartCard } from '../../components/ui/ChartCard.tsx'
import { DataTable, type Column } from '../../components/ui/DataTable.tsx'
import { ErrorState } from '../../components/ui/ErrorState.tsx'
import { Skeleton } from '../../components/ui/Skeleton.tsx'
import { useDashboardData } from '../../lib/dashboard/DashboardDataContext.tsx'
import { formatDayLabel, formatMetricValue } from '../../lib/dashboard/format.ts'
import { kpiColor } from '../../lib/dashboard/kpi-colors.ts'
import {
  metricTrendView,
  type TrendMode,
  type TrendSeries,
} from '../../lib/dashboard/selectors/metric-trend.ts'
import { activePositionGroups, useSettings } from '../../lib/settings/SettingsContext.tsx'
import type { DashKpi, DashboardDataset } from '../../lib/dashboard/types.ts'

const GROUP_COLORS = [
  'var(--chart-series-2)',
  'var(--chart-series-4)',
  'var(--chart-series-5)',
  'var(--chart-series-1)',
  'var(--chart-series-6)',
  'var(--chart-series-3)',
]
const shortDay = (iso: string) => iso.slice(5).replace('-', '/')

export function TrendExplorer({
  pageId,
  catalog,
  catalogLabel,
}: {
  /** saved-view namespace, e.g. 'trends-performance' */
  pageId: string
  /** which KPIs this tab offers */
  catalog: (kpi: DashKpi) => boolean
  catalogLabel: string
}) {
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
  return (
    <Explorer
      pageId={pageId}
      catalog={catalog}
      catalogLabel={catalogLabel}
      dataset={dataset}
      endDate={selectedDate}
      savedViews={savedViews}
    />
  )
}

function Explorer({
  pageId,
  catalog,
  catalogLabel,
  dataset,
  endDate,
  savedViews,
}: {
  pageId: string
  catalog: (kpi: DashKpi) => boolean
  catalogLabel: string
  dataset: DashboardDataset
  endDate: string
  savedViews: ReturnType<typeof useDashboardData>['savedViews']
}) {
  const { settings } = useSettings()
  const kpis = useMemo(
    () => [...dataset.kpis.values()].filter((k) => k.visibility.trends).filter(catalog),
    [dataset, catalog],
  )
  const groups = activePositionGroups(settings)

  const [kpiKey, setKpiKey] = useState(kpis[0]?.key ?? '')
  // one smooth Team Average line is the coach default
  const [mode, setMode] = useState<TrendMode>('team')
  const [position, setPosition] = useState<string | null>(null)
  const [athleteId, setAthleteId] = useState<string | null>(dataset.athletes[0]?.id ?? null)
  const [range, setRange] = useState({ from: dataset.seasonStart, to: endDate })

  // switching sub-tab swaps the catalog (S&C ↔ GPS); a metric from the other
  // catalog would render empty, so fall back to the first of this one
  const effectiveKpiKey = kpis.some((k) => k.key === kpiKey) ? kpiKey : (kpis[0]?.key ?? '')

  const view = useMemo(
    () =>
      metricTrendView(dataset, effectiveKpiKey, range.from, range.to, mode, {
        position,
        athleteId,
        groups,
      }),
    [dataset, effectiveKpiKey, range, mode, position, athleteId, groups],
  )

  const chartSeries = view.series.map((s, i) => ({
    key: s.key,
    label: s.label,
    color:
      mode === 'team'
        ? kpiColor(effectiveKpiKey)
        : mode === 'individual' && i === 0
          ? kpiColor(effectiveKpiKey)
          : GROUP_COLORS[i % GROUP_COLORS.length]!,
    values: s.values,
  }))

  const kpi = view.kpi
  const fmt = (v: number) => formatMetricValue(v, kpi ?? { decimalPlaces: 0, unit: '' }).text

  // summary table: per-series latest value, range change, observation count
  const summaryColumns = useMemo<Column<TrendSeries>[]>(() => {
    const fmtCell = (v: number) => formatMetricValue(v, kpi ?? { decimalPlaces: 0, unit: '' }).text
    const change = (s: TrendSeries): number | null => {
      const observed = s.values.filter((v): v is number => v !== null)
      if (observed.length < 2) return null
      const first = observed[0]!
      if (first === 0) return null
      return ((observed[observed.length - 1]! - first) / Math.abs(first)) * 100
    }
    return [
      {
        key: 'series',
        header: mode === 'group' ? 'Group' : 'Series',
        sortValue: (s) => s.label,
        render: (s) => <span className="font-medium">{s.label}</span>,
      },
      {
        key: 'athletes',
        header: 'Athletes',
        align: 'right',
        sortValue: (s) => s.memberCount,
        render: (s) => <span className="tabular">{s.memberCount}</span>,
      },
      {
        key: 'points',
        header: 'Days with data',
        align: 'right',
        sortValue: (s) => s.values.filter((v) => v !== null).length,
        render: (s) => (
          <span className="tabular">{s.values.filter((v) => v !== null).length}</span>
        ),
      },
      {
        key: 'latest',
        header: 'Latest',
        align: 'right',
        sortValue: (s) => s.values.filter((v): v is number => v !== null).at(-1) ?? null,
        render: (s) => {
          const latest = s.values.filter((v): v is number => v !== null).at(-1)
          return <span className="tabular">{latest === undefined ? '—' : fmtCell(latest)}</span>
        },
      },
      {
        key: 'change',
        header: 'First → last',
        align: 'right',
        sortValue: change,
        render: (s) => {
          const c = change(s)
          return (
            <span className="tabular">
              {c === null ? '—' : `${c > 0 ? '+' : ''}${c.toFixed(1)}%`}
            </span>
          )
        },
      },
    ]
  }, [mode, kpi])

  return (
    <div className="flex flex-col gap-4">
      <FilterBar>
        <SeasonSelector seasonLabel={dataset.seasonLabel} />
        <MetricSelector kpis={kpis} value={effectiveKpiKey} onChange={setKpiKey} />
        <LabeledControl label="Lens">
          <select
            value={mode}
            onChange={(e) => setMode(e.target.value as TrendMode)}
            className={CONTROL_CLASS}
          >
            <option value="team">Team average</option>
            <option value="group">Group</option>
            <option value="individual">Individual</option>
          </select>
        </LabeledControl>
        {mode === 'team' || mode === 'group' ? (
          <PositionSelector value={position} onChange={setPosition} />
        ) : (
          <AthleteSelector
            athletes={dataset.athletes}
            value={athleteId}
            onChange={setAthleteId}
          />
        )}
        <DateRangeSelector from={range.from} to={range.to} onChange={setRange} />
        <SaveViewControl
          page={pageId}
          store={savedViews}
          getCurrentConfig={() => ({ kpiKey: effectiveKpiKey, mode, position, athleteId, range })}
          onApply={(config) => {
            const key = config['kpiKey'] as string | undefined
            if (key && kpis.some((k) => k.key === key)) setKpiKey(key)
            setMode((config['mode'] as TrendMode) ?? 'group')
            setPosition((config['position'] as string | null) ?? null)
            setAthleteId((config['athleteId'] as string | null) ?? null)
            const r = config['range'] as { from: string; to: string } | undefined
            if (r) setRange(r)
          }}
        />
      </FilterBar>

      {kpi === null ? (
        <ErrorState title="No metric selected" message={`Pick a ${catalogLabel} metric above.`} />
      ) : (
        <>
          <ChartCard
            title={`${kpi.displayName} — trend`}
            subtitle={`${
              mode === 'team'
                ? 'average per athlete'
                : mode === 'group'
                  ? 'group means'
                  : 'athlete vs team mean'
            } · daily mean when a date has multiple sessions · gaps = no observation`}
            table={{
              columns: ['Date', ...chartSeries.map((s) => s.label)],
              rows: view.dates.map((date, i) => [
                formatDayLabel(date),
                ...chartSeries.map((s) => (s.values[i] === null ? '—' : fmt(s.values[i]!))),
              ]),
            }}
          >
            <LineChart
              xLabels={view.dates}
              series={chartSeries}
              height={280}
              smooth
              formatX={shortDay}
              formatY={fmt}
              ariaLabel={`${kpi.displayName} trend from ${range.from} to ${range.to}`}
            />
          </ChartCard>

          <DataTable columns={summaryColumns} rows={view.series} rowKey={(s) => s.key} />
        </>
      )}
    </div>
  )
}
