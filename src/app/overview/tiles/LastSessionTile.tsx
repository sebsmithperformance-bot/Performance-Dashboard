import { Satellite } from 'lucide-react'
import { useMemo, useState } from 'react'
import { CONTROL_CLASS } from '../../../components/controls/controls.tsx'
import { CompletenessBadge } from '../../../components/ui/CompletenessBadge.tsx'
import { EmptyState } from '../../../components/ui/EmptyState.tsx'
import { KPIValue } from '../../../components/ui/KPIValue.tsx'
import { Panel } from '../../../components/ui/Panel.tsx'
import { TrendIndicator } from '../../../components/ui/TrendIndicator.tsx'
import { formatDayLabel, formatMetricValue } from '../../../lib/dashboard/format.ts'
import {
  lastSessionGpsView,
  type LastSessionMetricKey,
} from '../../../lib/dashboard/selectors/last-session.ts'
import type { DashboardDataset } from '../../../lib/dashboard/types.ts'

/** §5.1 Last Session GPS tile with a switchable primary metric. */
export function LastSessionTile({ dataset, date }: { dataset: DashboardDataset; date: string }) {
  const [primaryKey, setPrimaryKey] = useState<LastSessionMetricKey>('total_distance')
  const view = useMemo(() => lastSessionGpsView(dataset, date), [dataset, date])

  if (!view) {
    return (
      <Panel icon={Satellite} title="Last Session GPS" keyValue="no data">
        <EmptyState
          icon={Satellite}
          title="No field session with GPS data yet"
          message="This tile fills in after the first session import."
        />
      </Panel>
    )
  }

  const primary = view.metrics.find((m) => m.kpiKey === primaryKey) ?? view.metrics[0]!
  const primaryKpi = dataset.kpis.get(primary.kpiKey)!
  const compact = formatMetricValue(primary.value, primaryKpi)

  return (
    <Panel
      icon={Satellite}
      title="Last Session GPS"
      keyValue={`${compact.text}${compact.unit ? ` ${compact.unit}` : ''}`}
    >
      <div className="flex flex-col gap-3">
        <p className="text-label text-secondary">
          {view.session.label} · {formatDayLabel(view.session.date)} · {view.session.type}
        </p>

        <div className="flex flex-wrap items-end gap-3">
          <KPIValue value={primary.value} kpi={primaryKpi} size="big" />
          <div className="flex flex-col gap-1 pb-1">
            <TrendIndicator
              deltaPct={primary.deltaPct}
              interpretation={primaryKpi.interpretation}
              label={
                view.comparedTo
                  ? `vs ${formatDayLabel(view.comparedTo.date)} ${view.comparedTo.type}`
                  : undefined
              }
            />
            <span className="text-label text-muted">{primary.aggLabel}</span>
          </div>
          <label className="ml-auto flex items-center gap-2 text-label text-secondary">
            <span className="sr-only">Primary metric</span>
            <select
              value={primary.kpiKey}
              onChange={(e) => setPrimaryKey(e.target.value as LastSessionMetricKey)}
              className={CONTROL_CLASS}
            >
              {view.metrics.map((m) => (
                <option key={m.kpiKey} value={m.kpiKey}>
                  {m.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        <dl className="grid grid-cols-3 gap-2">
          {view.metrics
            .filter((m) => m.kpiKey !== primary.kpiKey)
            .map((m) => (
              <div key={m.kpiKey} className="rounded-control bg-surface-2 px-3 py-2">
                <dt className="text-label text-muted">{m.label}</dt>
                <dd>
                  <KPIValue value={m.value} kpi={dataset.kpis.get(m.kpiKey)!} size="small" />
                </dd>
              </div>
            ))}
        </dl>

        <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-label text-muted">
          <span className="tabular">
            {view.participants}/{view.expectedParticipants} athletes with data
          </span>
          <CompletenessBadge missingCount={view.missingDevice} missingLabel="without device data" />
        </p>
      </div>
    </Panel>
  )
}
