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
import { Panel } from '../../../components/ui/Panel.tsx'
import { Skeleton } from '../../../components/ui/Skeleton.tsx'
import { useDashboardData } from '../../../lib/dashboard/DashboardDataContext.tsx'
import { gpsTrendsView } from '../../../lib/dashboard/selectors/gps.ts'
import { loadBands } from '../../../lib/dashboard/selectors/load-health.ts'
import { useSettings } from '../../../lib/settings/SettingsContext.tsx'
import { formatInt as fmt0 } from '../../../lib/dashboard/format.ts'
import type { DashboardDataset } from '../../../lib/dashboard/types.ts'
import { TeamLoadCharts } from '../TeamLoadCharts.tsx'

const RANGES = [7, 14, 28, 60, 90]
const TONE_ICON = { warning: TriangleAlert, neutral: Info, good: CircleCheck } as const

/** Monitoring → GPS → Trends & Recommendations (§5.2): long-range load view
 *  plus transparent rule-based team alerts. Observations, not predictions. */
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

  const guidanceTone =
    view.guidance.label === 'recovery emphasis'
      ? 'warning'
      : view.guidance.label === 'not computable'
        ? 'neutral'
        : 'good'

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

      <TeamLoadCharts
        dataset={dataset}
        date={date}
        rangeDays={rangeDays}
        position={position}
        acwrBand={acwrBand}
      />

      <Panel
        icon={Activity}
        title="Session guidance"
        keyValue={view.guidance.label}
      >
        <div className="flex flex-col gap-3">
          {view.guidance.teamAcwr !== null && view.guidance.targetBand ? (
            <>
              <p className="text-body">
                Team-mean ACWR is{' '}
                <span className="tabular font-semibold">{view.guidance.teamAcwr.toFixed(2)}</span> —{' '}
                <span className="font-semibold">{view.guidance.label}</span>. To land tomorrow's
                7-day acute load inside the {acwrBand.label} band, target a team-mean session load
                of{' '}
                <span className="tabular font-semibold">
                  {fmt0(view.guidance.targetBand.from)}–{fmt0(view.guidance.targetBand.to)} AU
                </span>{' '}
                (0 AU = full recovery day).
              </p>
              <p className="text-label text-muted">
                Calculation: target = band edge × 28-day weekly equivalent − last 6 days of
                team-mean load; both band edges shown, never a single prescription. This is a
                workload observation, not medical advice (§6.8).
              </p>
            </>
          ) : (
            <p className="text-body text-secondary">{view.guidance.reason}</p>
          )}
          <p className="flex flex-wrap items-center gap-2 text-label text-muted">
            <Badge tone={view.completeness.missing === 0 ? 'good' : 'warning'}>
              {view.completeness.missing === 0
                ? '28-day window complete'
                : `${view.completeness.missing} missing day${view.completeness.missing === 1 ? '' : 's'} in the 28-day window`}
            </Badge>
            <span className="tabular">
              {view.completeness.observed} observed · {view.completeness.rest} rest ·{' '}
              {view.completeness.missing} missing
            </span>
          </p>
        </div>
      </Panel>

      <section aria-label="Load alerts" className="flex flex-col gap-3">
        <h2 className="text-subhead font-semibold">Alerts & recommendations</h2>
        {view.recommendations.map((rec) => (
          <AlertCard key={rec.id} tone={rec.tone} icon={TONE_ICON[rec.tone]} headline={rec.headline}>
            <p className="tabular">{rec.detail}</p>
            <p className="mt-1">Rule: {rec.rule}</p>
          </AlertCard>
        ))}
      </section>

      <p className="text-label text-muted">
        Bands: {bandDefs.map((b) => `${b.label} = ${b.definition}`).join(' · ')}. Guidance tone:{' '}
        {guidanceTone === 'warning' ? 'attention suggested' : 'informational'} — thresholds are
        editable in KPI Settings → Thresholds.
      </p>
    </div>
  )
}
