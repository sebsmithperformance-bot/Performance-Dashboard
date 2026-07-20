import { useMemo } from 'react'
import { KPIValue } from '../../../components/ui/KPIValue.tsx'
import { formatDayLabel, formatPercentDelta } from '../../../lib/dashboard/format.ts'
import { lastSessionGpsView } from '../../../lib/dashboard/selectors/last-session.ts'
import {
  DEFAULT_OVERVIEW_GPS_METRICS,
  OVERVIEW_GPS_SUPPORTED,
} from '../../../lib/settings/defaults.ts'
import { useSettings } from '../../../lib/settings/SettingsContext.tsx'
import type { DashboardDataset, Position } from '../../../lib/dashboard/types.ts'

/** §4 Last Session GPS drill-down: selected GPS metrics (team average per
 *  athlete), position breakdown, athlete table, completeness. Player Load is
 *  never the default metric. */
export function LastSessionGpsDetail({
  dataset,
  date,
}: {
  dataset: DashboardDataset
  date: string
}) {
  const { settings } = useSettings()
  const keys =
    settings.display.overviewGpsMetrics.length > 0
      ? settings.display.overviewGpsMetrics
      : DEFAULT_OVERVIEW_GPS_METRICS
  const last = lastSessionGpsView(dataset, date, keys)

  // primary metric for the athlete/position table = first selected supported metric
  const primaryKey = useMemo(
    () => keys.find((k) => OVERVIEW_GPS_SUPPORTED.includes(k) && dataset.kpis.has(k)) ?? keys[0],
    [keys, dataset],
  )
  const primaryKpi = primaryKey ? dataset.kpis.get(primaryKey) : undefined

  const athleteRows = useMemo(() => {
    if (!last || !primaryKey) return []
    const obs = (dataset.observationsBySession.get(last.session.id) ?? []).filter(
      (o) => o.kpiKey === primaryKey,
    )
    return obs
      .map((o) => {
        const a = dataset.athleteById.get(o.athleteId)
        return { name: a?.fullName ?? o.athleteId, position: a?.position ?? '—', value: o.value }
      })
      .sort((a, b) => b.value - a.value)
  }, [dataset, last, primaryKey])

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

  if (!last) {
    return <p className="text-body text-secondary">No GPS session on or before this date.</p>
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-label text-muted">
        {last.session.label} · {formatDayLabel(last.session.date)} · {last.participants}/
        {last.expectedParticipants} device data
        {last.missingDevice > 0 && ` · ${last.missingDevice} missing`}
      </p>

      <dl className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {last.metrics.map((m) => {
          const kpi = dataset.kpis.get(m.kpiKey)
          const delta = formatPercentDelta(m.deltaPct)
          return (
            <div key={m.kpiKey} className="rounded-control bg-surface-2 px-3 py-2">
              <dt className="text-label text-muted">{m.label}</dt>
              <dd className="tabular text-subhead font-semibold">
                {kpi ? <KPIValue value={m.value} kpi={kpi} size="small" /> : '—'}
              </dd>
              {delta && <dd className="text-label text-muted">{delta} vs prior</dd>}
            </div>
          )
        })}
      </dl>

      {positionAverages.length > 0 && primaryKpi && (
        <div>
          <h3 className="mb-2 section-label text-label text-secondary">
            {primaryKpi.displayName} by position
          </h3>
          <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {positionAverages.map((p) => (
              <div key={p.position} className="rounded-control bg-surface-2 px-3 py-2">
                <dt className="text-label text-muted">{p.position as Position}</dt>
                <dd className="tabular text-body font-semibold">
                  <KPIValue value={p.avg} kpi={primaryKpi} size="small" showUnit={false} />{' '}
                  <span className="text-label text-muted">· {p.n}</span>
                </dd>
              </div>
            ))}
          </dl>
        </div>
      )}

      {athleteRows.length > 0 && primaryKpi && (
        <ul className="flex max-h-64 flex-col divide-y divide-subtle overflow-y-auto rounded-control border border-subtle">
          {athleteRows.map((r) => (
            <li key={r.name} className="flex items-baseline gap-2 px-3 py-2">
              <span className="text-body font-medium">{r.name}</span>
              <span className="text-label text-muted">{r.position}</span>
              <span className="tabular ml-auto text-body font-semibold">
                <KPIValue value={r.value} kpi={primaryKpi} size="small" showUnit={false} />
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
