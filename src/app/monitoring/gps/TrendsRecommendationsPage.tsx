import { Activity, CircleCheck, Info, TriangleAlert } from 'lucide-react'
import { useMemo, useState } from 'react'
import {
  CONTROL_CLASS,
  FilterBar,
  LabeledControl,
  PositionSelector,
  SeasonSelector,
} from '../../../components/controls/controls.tsx'
import { SaveViewControl } from '../../../components/controls/SaveViewControl.tsx'
import { AlertCard } from '../../../components/ui/AlertCard.tsx'
import { Badge } from '../../../components/ui/Badge.tsx'
import { ErrorState } from '../../../components/ui/ErrorState.tsx'
import { InfoHint } from '../../../components/ui/InfoHint.tsx'
import { KpiCard, KpiStrip } from '../../../components/ui/KpiCard.tsx'
import { Panel } from '../../../components/ui/Panel.tsx'
import { Skeleton } from '../../../components/ui/Skeleton.tsx'
import { useDashboardData } from '../../../lib/dashboard/DashboardDataContext.tsx'
import { gpsTrendsView } from '../../../lib/dashboard/selectors/gps.ts'
import { lastSessionGpsView } from '../../../lib/dashboard/selectors/last-session.ts'
import { loadBands } from '../../../lib/dashboard/selectors/load-health.ts'
import { readinessSummary } from '../../../lib/dashboard/selectors/readiness.ts'
import { useSettings } from '../../../lib/settings/SettingsContext.tsx'
import { formatInt as fmt0, formatMetricValue } from '../../../lib/dashboard/format.ts'
import type { DashboardDataset } from '../../../lib/dashboard/types.ts'
import { TeamLoadCharts } from '../TeamLoadCharts.tsx'

const RANGES = [7, 14, 28, 60, 90]
const TONE_ICON = {
  warning: TriangleAlert,
  danger: TriangleAlert,
  neutral: Info,
  good: CircleCheck,
} as const

/** Monitoring → GPS → Trends & Recommendations (§5.2): concise Session Guidance
 *  first, then coach-readable alerts, then the detailed trend charts.
 *  Observations, not predictions (§6.8). */
export function GpsTrendsPage() {
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
  return <Trends dataset={dataset} date={selectedDate} savedViews={savedViews} />
}

function Trends({
  dataset,
  date,
  savedViews,
}: {
  dataset: DashboardDataset
  date: string
  savedViews: ReturnType<typeof useDashboardData>['savedViews']
}) {
  const { settings } = useSettings()
  const [rangeDays, setRangeDays] = useState(28)
  const [position, setPosition] = useState<string | null>(null)

  const thresholds = settings.thresholds
  const view = useMemo(
    () => gpsTrendsView(dataset, date, position, thresholds),
    [dataset, date, position, thresholds],
  )
  const bandDefs = loadBands(thresholds)
  const acwrBand = {
    from: thresholds.acwrBelowBand,
    to: thresholds.acwrElevatedBand,
    label: `within ${thresholds.acwrBelowBand.toFixed(2)}–${thresholds.acwrElevatedBand.toFixed(2)}`,
  }

  const summary = readinessSummary(dataset, date, position, thresholds)
  const last = lastSessionGpsView(dataset, date, ['high_speed_distance'])
  const hsdKpi = dataset.kpis.get('high_speed_distance')
  const hsd = hsdKpi
    ? formatMetricValue(last?.metrics.find((m) => m.kpiKey === 'high_speed_distance')?.value ?? null, hsdKpi)
    : { text: '—', unit: null }
  const loadTrend =
    summary.avgAcute7d !== null && summary.avgChronicWeekly !== null && summary.avgChronicWeekly > 0
      ? ((summary.avgAcute7d - summary.avgChronicWeekly) / summary.avgChronicWeekly) * 100
      : null

  const g = view.guidance
  const windowComplete = view.completeness.missing === 0

  return (
    <div className="flex flex-col gap-4">
      <FilterBar>
        <SeasonSelector seasonLabel={dataset.seasonLabel} />
        <LabeledControl label="Range">
          <select
            value={rangeDays}
            onChange={(e) => setRangeDays(Number(e.target.value))}
            className={CONTROL_CLASS}
          >
            {RANGES.map((r) => (
              <option key={r} value={r}>
                {r} days
              </option>
            ))}
          </select>
        </LabeledControl>
        <PositionSelector value={position} onChange={setPosition} />
        <SaveViewControl
          page="monitoring-gps-trends"
          store={savedViews}
          getCurrentConfig={() => ({ rangeDays, position })}
          onApply={(config) => {
            setRangeDays((config['rangeDays'] as number) ?? 28)
            setPosition((config['position'] as string | null) ?? null)
          }}
        />
      </FilterBar>

      {/* Session Guidance — first in the content hierarchy (coach-feedback) */}
      <Panel icon={Activity} title="Session guidance" keyValue={g.label}>
        <div className="flex flex-col gap-2">
          {g.teamAcwr !== null && g.targetBand ? (
            <p className="text-body">
              Team-average ACWR is{' '}
              <span className="tabular font-semibold">{g.teamAcwr.toFixed(2)}</span> —{' '}
              <span className="font-semibold">{g.label}</span>. To keep tomorrow inside the{' '}
              {acwrBand.label} band, aim for a team-average session load of{' '}
              <span className="tabular font-semibold">
                {fmt0(g.targetBand.from)}–{fmt0(g.targetBand.to)} AU
              </span>{' '}
              (0 AU = full recovery).
              <InfoHint label="How this is calculated">
                Target = band edge × 28-day weekly equivalent − last 6 days of team-average load.
                Both band edges are shown, never a single prescription. A workload observation, not
                medical advice (§6.8).
              </InfoHint>
            </p>
          ) : (
            <p className="text-body text-secondary">{g.reason}</p>
          )}
          <p className="flex flex-wrap items-center gap-2 text-label text-muted">
            <Badge tone={windowComplete ? 'good' : 'warning'}>
              {windowComplete
                ? '28-day window complete'
                : `${view.completeness.missing} missing day${view.completeness.missing === 1 ? '' : 's'}`}
            </Badge>
            <span className="tabular">
              {view.completeness.observed} observed · {view.completeness.rest} rest ·{' '}
              {view.completeness.missing} missing
            </span>
          </p>
        </div>
      </Panel>

      {/* KPI summary strip */}
      <KpiStrip>
        <KpiCard
          label="Median ACWR"
          value={summary.medianAcwr !== null ? summary.medianAcwr.toFixed(2) : '—'}
          sub={`${summary.validCount} valid athletes`}
        />
        <KpiCard
          label="Monotony"
          value={summary.avgMonotony !== null ? summary.avgMonotony.toFixed(2) : '—'}
          sub="7-day, team avg"
        />
        <KpiCard
          label="28-day Weekly Load"
          value={summary.avgChronicWeekly !== null ? fmt0(summary.avgChronicWeekly) : '—'}
          unit="AU"
          sub="Team avg per athlete"
        />
        <KpiCard
          label="High-Speed Distance"
          value={hsd.text}
          unit={hsd.unit ?? undefined}
          sub={last ? `Team avg · ${last.participants} athletes` : undefined}
        />
        <KpiCard
          label="Recent Load Trend"
          value={loadTrend !== null ? `${loadTrend > 0 ? '+' : ''}${loadTrend.toFixed(0)}%` : '—'}
          sub="7-day vs 28-day"
          accent={loadTrend !== null && Math.abs(loadTrend) >= 20 ? 'warning' : undefined}
        />
      </KpiStrip>

      {/* Alerts — happened → number → why → review */}
      <section aria-label="Load alerts" className="flex flex-col gap-3">
        <h2 className="section-label text-subhead text-secondary">Alerts &amp; observations</h2>
        {view.recommendations.map((rec) => (
          <AlertCard key={rec.id} tone={rec.tone} icon={TONE_ICON[rec.tone]} headline={rec.headline}>
            <div className="flex flex-col gap-0.5">
              <p className="tabular text-body font-semibold text-primary">{rec.value}</p>
              <p>{rec.why}</p>
              <p className="text-secondary">
                <span className="font-medium">Review:</span> {rec.review}
              </p>
              <p className="mt-0.5 flex items-center gap-1 text-muted">
                {rec.affected && <span>{rec.affected}</span>}
                <InfoHint label="Alert detail">{rec.detail}</InfoHint>
              </p>
            </div>
          </AlertCard>
        ))}
      </section>

      {/* Detailed trend charts below the guidance/alerts */}
      <TeamLoadCharts
        dataset={dataset}
        date={date}
        rangeDays={rangeDays}
        position={position}
        acwrBand={acwrBand}
      />

      <p className="flex flex-wrap items-center gap-1 text-label text-muted">
        Bands come from KPI Settings → Thresholds.
        <InfoHint label="Band definitions">
          <span className="flex flex-col gap-0.5">
            {bandDefs.map((b) => (
              <span key={b.key} className="block">
                <span className="font-medium">{b.short}</span> — {b.definition}
              </span>
            ))}
          </span>
        </InfoHint>
      </p>
    </div>
  )
}
