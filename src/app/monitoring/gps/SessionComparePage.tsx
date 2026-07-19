import { useMemo, useState } from 'react'
import { LineChart, type LineChartSeries } from '../../../components/charts/LineChart.tsx'
import {
  FilterBar,
  PositionSelector,
  SeasonSelector,
} from '../../../components/controls/controls.tsx'
import { SaveViewControl } from '../../../components/controls/SaveViewControl.tsx'
import { Badge } from '../../../components/ui/Badge.tsx'
import { ChartCard } from '../../../components/ui/ChartCard.tsx'
import { ErrorState } from '../../../components/ui/ErrorState.tsx'
import { Skeleton } from '../../../components/ui/Skeleton.tsx'
import { useDashboardData } from '../../../lib/dashboard/DashboardDataContext.tsx'
import { formatDayLabel, formatMetricValue, sessionTypeLabel } from '../../../lib/dashboard/format.ts'
import { gpsCompareSeries, monitoringGpsKpis } from '../../../lib/dashboard/selectors/gps.ts'
import type { DashboardDataset } from '../../../lib/dashboard/types.ts'

const METRIC_COLORS = [
  'var(--chart-series-1)',
  'var(--chart-series-2)',
  'var(--chart-series-4)',
  'var(--chart-series-5)',
]
const MAX_METRICS = 4

/** Monitoring → GPS → Session Compare (§5.2): a chronological team-average
 *  trend across the sessions the coach selects, one or more metrics at once. */
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

  // candidate field sessions up to the selected date that carry data, newest first
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
        .slice(0, 24),
    [dataset, date],
  )

  const [selectedIds, setSelectedIds] = useState<string[]>(() =>
    candidates.slice(0, 6).map((s) => s.id),
  )
  const [metricKeys, setMetricKeys] = useState<string[]>(() => [kpis[0]?.key ?? 'player_load'])
  const [position, setPosition] = useState<string | null>(null)

  const view = useMemo(
    () => gpsCompareSeries(dataset, selectedIds, metricKeys, position),
    [dataset, selectedIds, metricKeys, position],
  )

  const toggleSession = (id: string) =>
    setSelectedIds((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]))
  const toggleMetric = (key: string) =>
    setMetricKeys((cur) =>
      cur.includes(key)
        ? cur.length > 1
          ? cur.filter((k) => k !== key)
          : cur // keep at least one metric
        : cur.length >= MAX_METRICS
          ? cur
          : [...cur, key],
    )

  const multi = view.metrics.length > 1
  const fmtAbs = (kpiKey: string, v: number | null) => {
    const kpi = dataset.kpis.get(kpiKey)
    if (!kpi || v === null) return '—'
    const f = formatMetricValue(v, kpi)
    return f.unit ? `${f.text} ${f.unit}` : f.text
  }

  // indexed to each metric's first data point when comparing multiple metrics
  // (differently-scaled units share one axis); absolute units for a single metric
  const chartSeries: LineChartSeries[] = view.metrics.map((m, i) => {
    const baseline = m.means.find((v): v is number => v !== null) ?? null
    return {
      key: m.kpi.key,
      label: m.kpi.displayName,
      color: METRIC_COLORS[i % METRIC_COLORS.length]!,
      values: m.means.map((v) =>
        multi ? (v === null || baseline === null || baseline === 0 ? null : (v / baseline) * 100) : v,
      ),
    }
  })

  const xLabels = view.sessions.map((s) => formatDayLabel(s.date))
  const tooltipHeaders = view.sessions.map(
    (s) => `${formatDayLabel(s.date)} · ${sessionTypeLabel(s.type)}`,
  )
  const singleKpi = view.metrics[0]?.kpi

  return (
    <div className="flex flex-col gap-4">
      <FilterBar>
        <SeasonSelector seasonLabel={dataset.seasonLabel} />
        <PositionSelector value={position} onChange={setPosition} />
        <SaveViewControl
          page="monitoring-gps-compare"
          store={savedViews}
          getCurrentConfig={() => ({ metricKeys, position, selectedIds })}
          onApply={(config) => {
            const mk = (config['metricKeys'] as string[] | undefined)?.filter((k) =>
              dataset.kpis.has(k),
            )
            setMetricKeys(mk && mk.length > 0 ? mk.slice(0, MAX_METRICS) : [kpis[0]?.key ?? 'player_load'])
            setPosition((config['position'] as string | null) ?? null)
            const ids = (config['selectedIds'] as string[] | undefined) ?? []
            setSelectedIds(ids.filter((id) => dataset.sessionById.has(id)))
          }}
        />
      </FilterBar>

      <div className="grid items-start gap-4 lg:grid-cols-[260px_1fr]">
        {/* left vertical session selector */}
        <section
          aria-label="Sessions"
          className="flex flex-col rounded-card border border-subtle bg-surface"
        >
          <div className="flex items-center justify-between gap-2 border-b border-subtle px-3 py-2">
            <span className="section-label text-label text-secondary">
              Sessions ({selectedIds.length})
            </span>
            <span className="flex gap-2 text-label">
              <button
                type="button"
                onClick={() => setSelectedIds(candidates.map((s) => s.id))}
                className="text-accent hover:underline"
              >
                All
              </button>
              <button
                type="button"
                onClick={() => setSelectedIds([])}
                className="text-secondary hover:underline"
              >
                Clear
              </button>
            </span>
          </div>
          <ul className="flex max-h-64 flex-col divide-y divide-subtle overflow-y-auto lg:max-h-[32rem]">
            {candidates.map((s) => {
              const active = selectedIds.includes(s.id)
              return (
                <li key={s.id}>
                  <label className="flex cursor-pointer items-center gap-2 px-3 py-2 hover:bg-surface-2">
                    <input
                      type="checkbox"
                      checked={active}
                      onChange={() => toggleSession(s.id)}
                      className="accent-(--accent)"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-body">{formatDayLabel(s.date)}</span>
                      <span className="block truncate text-label text-muted">{s.label}</span>
                    </span>
                    <Badge tone="neutral">{sessionTypeLabel(s.type)}</Badge>
                  </label>
                </li>
              )
            })}
          </ul>
        </section>

        {/* metrics + chart */}
        <div className="flex min-w-0 flex-col gap-3">
          <div className="flex flex-wrap items-center gap-1">
            <span className="section-label mr-1 text-label text-secondary">
              Metrics ({metricKeys.length}/{MAX_METRICS})
            </span>
            {kpis.map((kpi) => {
              const active = metricKeys.includes(kpi.key)
              const disabled = !active && metricKeys.length >= MAX_METRICS
              return (
                <button
                  key={kpi.key}
                  type="button"
                  aria-pressed={active}
                  disabled={disabled}
                  onClick={() => toggleMetric(kpi.key)}
                  className={`rounded-full border px-3 py-1 text-label font-medium ${
                    active
                      ? 'border-accent bg-accent/15 text-primary'
                      : disabled
                        ? 'border-subtle text-muted opacity-50'
                        : 'border-subtle text-secondary hover:border-strong hover:text-primary'
                  }`}
                >
                  {kpi.displayName}
                </button>
              )
            })}
          </div>

          {view.sessions.length < 2 ? (
            <ErrorState
              title="Pick at least two sessions"
              message="Select sessions on the left to see the trend across them."
            />
          ) : (
            <ChartCard
              title="Session comparison"
              subtitle={
                multi
                  ? 'team average per athlete, indexed to each metric’s first session (= 100%)'
                  : `team average per athlete · ${singleKpi?.displayName}`
              }
              table={{
                columns: ['Session', ...view.metrics.map((m) => m.kpi.displayName), 'Athletes (n)'],
                rows: view.sessions.map((s, i) => [
                  `${formatDayLabel(s.date)} · ${sessionTypeLabel(s.type)}`,
                  ...view.metrics.map((m) => fmtAbs(m.kpi.key, m.means[i] ?? null)),
                  String(Math.max(...view.metrics.map((m) => m.ns[i] ?? 0))),
                ]),
              }}
            >
              <LineChart
                xLabels={xLabels}
                series={chartSeries}
                smooth
                zeroBased={!multi}
                tooltipHeaders={tooltipHeaders}
                tooltipValueFor={(si, xi) => {
                  const m = view.metrics[si]
                  if (!m) return null
                  const n = m.ns[xi] ?? 0
                  return `${fmtAbs(m.kpi.key, m.means[xi] ?? null)} · n=${n}`
                }}
                formatX={(label) => label}
                formatY={(v) =>
                  multi ? `${Math.round(v)}%` : formatMetricValue(v, singleKpi!).text
                }
                ariaLabel={`Team-average ${view.metrics.map((m) => m.kpi.displayName).join(', ')} across ${view.sessions.length} sessions`}
              />
              <p className="mt-2 text-label text-muted">
                Values are averages per participating athlete. Missing sessions leave gaps — they are
                never drawn through (§6.7).
                {multi && ' Metrics are indexed so differently-scaled units share one axis.'}
              </p>
            </ChartCard>
          )}
        </div>
      </div>
    </div>
  )
}
