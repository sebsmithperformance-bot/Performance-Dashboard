import { useMemo } from 'react'
import { ChartCard } from '../../../components/ui/ChartCard.tsx'
import { LineChart } from '../../../components/charts/LineChart.tsx'
import { formatDayLabel } from '../../../lib/dashboard/format.ts'
import { lastSessionGpsView } from '../../../lib/dashboard/selectors/last-session.ts'
import { metricTrendView } from '../../../lib/dashboard/selectors/metric-trend.ts'
import { activePositionGroups, useSettings } from '../../../lib/settings/SettingsContext.tsx'
import type { DashboardDataset, Position } from '../../../lib/dashboard/types.ts'

const WORKLOAD = 'workload'

/** §4 Workload drill-down: team Workload trend, position averages, athlete
 *  distribution, recent sessions, and a per-athlete table. 1–10 scale only. */
export function WorkloadDetail({ dataset, date }: { dataset: DashboardDataset; date: string }) {
  const { settings } = useSettings()
  const groups = useMemo(
    () => activePositionGroups(settings).map((g) => ({ id: g.id, label: g.label })),
    [settings],
  )

  const last = lastSessionGpsView(dataset, date, [WORKLOAD])
  const session = last?.session ?? null

  // per-athlete workload for the latest workload session
  const athleteRows = useMemo(() => {
    if (!session) return []
    const obs = (dataset.observationsBySession.get(session.id) ?? []).filter(
      (o) => o.kpiKey === WORKLOAD,
    )
    return obs
      .map((o) => {
        const a = dataset.athleteById.get(o.athleteId)
        return { name: a?.fullName ?? o.athleteId, position: a?.position ?? '—', value: o.value }
      })
      .sort((a, b) => b.value - a.value)
  }, [dataset, session])

  const positionAverages = useMemo(() => {
    const byPos = new Map<string, number[]>()
    for (const r of athleteRows) {
      const arr = byPos.get(r.position) ?? []
      arr.push(r.value)
      byPos.set(r.position, arr)
    }
    return [...byPos.entries()].map(([position, vals]) => ({
      position,
      avg: vals.reduce((a, b) => a + b, 0) / vals.length,
      n: vals.length,
    }))
  }, [athleteRows])

  const trend = useMemo(
    () => metricTrendView(dataset, WORKLOAD, dataset.seasonStart, date, 'team', { groups }),
    [dataset, date, groups],
  )

  const metric = last?.metrics[0]

  return (
    <div className="flex flex-col gap-4">
      <dl className="grid grid-cols-2 gap-2">
        <div className="rounded-control bg-surface-2 px-3 py-2">
          <dt className="text-label text-muted">Team average</dt>
          <dd className="tabular text-subhead font-semibold">
            {metric?.value != null ? `${metric.value.toFixed(1)} / 10` : '—'}
          </dd>
        </div>
        <div className="rounded-control bg-surface-2 px-3 py-2">
          <dt className="text-label text-muted">Participating</dt>
          <dd className="tabular text-subhead font-semibold">{last?.participants ?? 0} athletes</dd>
        </div>
      </dl>
      {session && (
        <p className="text-label text-muted">
          {session.label} · {formatDayLabel(session.date)}
          {metric?.deltaPct != null &&
            ` · ${metric.deltaPct >= 0 ? '+' : ''}${metric.deltaPct.toFixed(1)}% vs prior session`}
        </p>
      )}

      {trend.dates.length >= 2 && trend.series[0] && (
        <ChartCard
          title="Team Workload trend"
          subtitle="Team average per session · 1–10 scale"
          table={{
            columns: ['Session date', 'Team Workload'],
            rows: trend.dates.map((d, i) => [
              formatDayLabel(d),
              trend.series[0]!.values[i] == null ? '—' : trend.series[0]!.values[i]!.toFixed(1),
            ]),
          }}
        >
          <LineChart
            xLabels={trend.dates}
            series={[
              {
                key: 'team',
                label: 'Team average',
                color: 'var(--chart-series-1)',
                values: trend.series[0].values,
              },
            ]}
            smooth
            height={200}
            formatX={(d) => formatDayLabel(d)}
            formatY={(v) => v.toFixed(1)}
            ariaLabel="Team average Workload across sessions on the 1 to 10 scale"
          />
        </ChartCard>
      )}

      {positionAverages.length > 0 && (
        <div>
          <h3 className="mb-2 section-label text-label text-secondary">Position averages</h3>
          <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {positionAverages.map((p) => (
              <div key={p.position} className="rounded-control bg-surface-2 px-3 py-2">
                <dt className="text-label text-muted">{p.position as Position}</dt>
                <dd className="tabular text-body font-semibold">
                  {p.avg.toFixed(1)} <span className="text-label text-muted">· {p.n}</span>
                </dd>
              </div>
            ))}
          </dl>
        </div>
      )}

      {athleteRows.length > 0 && (
        <ul className="flex max-h-64 flex-col divide-y divide-subtle overflow-y-auto rounded-control border border-subtle">
          {athleteRows.map((r) => (
            <li key={r.name} className="flex items-baseline gap-2 px-3 py-2">
              <span className="text-body font-medium">{r.name}</span>
              <span className="text-label text-muted">{r.position}</span>
              <span className="tabular ml-auto text-body font-semibold">{r.value.toFixed(1)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
