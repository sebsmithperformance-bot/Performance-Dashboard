import { useMemo, useState } from 'react'
import { HBarChart } from '../../../components/charts/HBarChart.tsx'
import {
  FilterBar,
  MetricSelector,
  PositionSelector,
  SeasonSelector,
} from '../../../components/controls/controls.tsx'
import { SaveViewControl } from '../../../components/controls/SaveViewControl.tsx'
import { ChartCard } from '../../../components/ui/ChartCard.tsx'
import { ErrorState } from '../../../components/ui/ErrorState.tsx'
import { KPIValue } from '../../../components/ui/KPIValue.tsx'
import { Skeleton } from '../../../components/ui/Skeleton.tsx'
import { useDashboardData } from '../../../lib/dashboard/DashboardDataContext.tsx'
import { formatDayLabel, formatMetricValue } from '../../../lib/dashboard/format.ts'
import { gpsSessionCompare, monitoringGpsKpis } from '../../../lib/dashboard/selectors/gps.ts'
import type { DashboardDataset } from '../../../lib/dashboard/types.ts'

/** distinct series colors for up to four overlaid sessions */
const SESSION_COLORS = [
  'var(--chart-series-1)',
  'var(--chart-series-2)',
  'var(--chart-series-4)',
  'var(--chart-series-5)',
]
const MAX_SESSIONS = 4

/** Monitoring → GPS → Session Compare (§5.2): overlay two or more sessions. */
export function GpsSessionComparePage() {
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
  return <SessionCompare dataset={dataset} date={selectedDate} savedViews={savedViews} />
}

function SessionCompare({
  dataset,
  date,
  savedViews,
}: {
  dataset: DashboardDataset
  date: string
  savedViews: ReturnType<typeof useDashboardData>['savedViews']
}) {
  const kpis = useMemo(() => monitoringGpsKpis(dataset), [dataset])

  // candidate sessions: field sessions up to the selected date, most recent first
  const candidates = useMemo(
    () =>
      [...dataset.sessions]
        .filter(
          (s) =>
            s.kind === 'field' &&
            s.date <= date &&
            (dataset.observationsBySession.get(s.id)?.length ?? 0) > 0,
        )
        .reverse()
        .slice(0, 12),
    [dataset, date],
  )

  const [kpiKey, setKpiKey] = useState(kpis[0]?.key ?? 'total_distance')
  const [position, setPosition] = useState<string | null>(null)
  const [selectedIds, setSelectedIds] = useState<string[]>(() =>
    candidates.slice(0, 2).map((s) => s.id),
  )

  const view = useMemo(
    () => gpsSessionCompare(dataset, selectedIds, kpiKey, position),
    [dataset, selectedIds, kpiKey, position],
  )
  const kpi = view.kpi

  const toggleSession = (id: string) => {
    setSelectedIds((current) =>
      current.includes(id)
        ? current.filter((x) => x !== id)
        : current.length >= MAX_SESSIONS
          ? current
          : // keep chronological order for the overlay legend
            candidates
              .filter((s) => [...current, id].includes(s.id))
              .map((s) => s.id)
              .reverse(),
    )
  }

  const series = view.sessions.map((s, i) => ({
    key: s.id,
    label: `${formatDayLabel(s.date)} · ${s.label}`,
    color: SESSION_COLORS[i % SESSION_COLORS.length]!,
  }))
  const fmt = (v: number) => formatMetricValue(v, kpi ?? { decimalPlaces: 0, unit: '' }).text

  return (
    <div className="flex flex-col gap-4">
      <FilterBar>
        <SeasonSelector seasonLabel={dataset.seasonLabel} />
        <MetricSelector kpis={kpis} value={kpiKey} onChange={setKpiKey} />
        <PositionSelector value={position} onChange={setPosition} />
        <SaveViewControl
          page="monitoring-gps-compare"
          store={savedViews}
          getCurrentConfig={() => ({ kpiKey, position, selectedIds })}
          onApply={(config) => {
            setKpiKey((config['kpiKey'] as string) ?? kpis[0]?.key ?? 'total_distance')
            setPosition((config['position'] as string | null) ?? null)
            const ids = (config['selectedIds'] as string[] | undefined) ?? []
            setSelectedIds(ids.filter((id) => dataset.sessionById.has(id)))
          }}
        />
      </FilterBar>

      <div className="rounded-card border border-subtle bg-surface p-3">
        <p className="mb-2 text-label font-medium text-secondary">
          Sessions to overlay ({selectedIds.length}/{MAX_SESSIONS})
        </p>
        <div className="flex flex-wrap gap-1">
          {candidates.map((s) => {
            const active = selectedIds.includes(s.id)
            return (
              <button
                key={s.id}
                type="button"
                aria-pressed={active}
                onClick={() => toggleSession(s.id)}
                className={`rounded-full border px-3 py-1 text-label font-medium ${
                  active
                    ? 'border-accent bg-accent/15 text-primary'
                    : 'border-subtle text-secondary hover:border-strong hover:text-primary'
                }`}
              >
                {formatDayLabel(s.date)} · {s.type}
              </button>
            )
          })}
        </div>
      </div>

      {view.sessions.length < 2 ? (
        <ErrorState
          title="Pick at least two sessions"
          message="Session Compare overlays two or more sessions — select them above."
        />
      ) : kpi === null ? (
        <ErrorState title="Unknown metric" message="Pick a metric from the list." />
      ) : (
        <ChartCard
          title={`${kpi.displayName} — session overlay`}
          subtitle={`per athlete · team mean: ${view.teamMeans
            .map((m, i) => `${formatDayLabel(view.sessions[i]!.date)} ${m === null ? '—' : fmt(m)}`)
            .join(' · ')}`}
          table={{
            columns: ['Athlete', ...series.map((s) => s.label)],
            rows: view.rows.map((r) => [
              r.name,
              ...r.values.map((v) => (v === null ? '—' : fmt(v))),
            ]),
          }}
        >
          <HBarChart
            series={series}
            rows={view.rows.map((r) => ({
              key: r.athleteId,
              label: r.name,
              sublabel: r.position,
              values: r.values,
            }))}
            formatValue={fmt}
            ariaLabel={`${kpi.displayName} compared across ${view.sessions.length} sessions`}
          />
          <p className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-label text-muted">
            {view.sessions.map((s, i) => (
              <span key={s.id} className="tabular">
                {formatDayLabel(s.date)}: n={view.teamNs[i]} ·{' '}
                <KPIValue
                  value={view.teamMeans[i]}
                  kpi={kpi}
                  size="small"
                />{' '}
                mean
              </span>
            ))}
          </p>
        </ChartCard>
      )}
    </div>
  )
}
