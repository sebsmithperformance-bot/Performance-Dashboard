import { Dumbbell } from 'lucide-react'
import { useMemo, useState } from 'react'
import {
  CONTROL_CLASS,
  FilterBar,
  LabeledControl,
  PositionSelector,
  SeasonSelector,
} from '../../components/controls/controls.tsx'
import { ErrorState } from '../../components/ui/ErrorState.tsx'
import { KPIValue } from '../../components/ui/KPIValue.tsx'
import { Panel } from '../../components/ui/Panel.tsx'
import { Skeleton } from '../../components/ui/Skeleton.tsx'
import { TrendIndicator } from '../../components/ui/TrendIndicator.tsx'
import { useDashboardData } from '../../lib/dashboard/DashboardDataContext.tsx'
import { formatMetricValue, formatPercentDelta } from '../../lib/dashboard/format.ts'
import { performanceOverview } from '../../lib/dashboard/selectors/performance.ts'
import { useSettings } from '../../lib/settings/SettingsContext.tsx'
import type { ComparisonBasis, DashboardDataset } from '../../lib/dashboard/types.ts'

const BASES: { value: ComparisonBasis; label: string }[] = [
  { value: 'prior_session', label: 'Prior session' },
  { value: 'prior_week', label: 'Prior week' },
  { value: 'rolling_average', label: 'Rolling average' },
]

/** Performance → Overview (§5.4): tiles for all key S&C KPIs. */
export function PerformanceOverviewPage() {
  const { status, error, dataset, selectedDate } = useDashboardData()

  if (status === 'loading') {
    return (
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 8 }, (_, i) => (
          <Skeleton key={i} className="h-40 w-full" />
        ))}
      </div>
    )
  }
  if (status === 'error' || !dataset || !selectedDate) {
    return (
      <ErrorState
        title="Dashboard data unavailable"
        message={error ?? 'No dataset loaded — run npm run seed:generate and reload.'}
      />
    )
  }
  return <Overview dataset={dataset} date={selectedDate} />
}

function Overview({ dataset, date }: { dataset: DashboardDataset; date: string }) {
  const { settings } = useSettings()
  const [basis, setBasis] = useState<ComparisonBasis>(
    settings.display.defaultComparisonBasis === 'custom_range'
      ? 'prior_week'
      : settings.display.defaultComparisonBasis,
  )
  const [position, setPosition] = useState<string | null>(null)

  const tiles = useMemo(
    () => performanceOverview(dataset, date, basis, position, settings.thresholds),
    [dataset, date, basis, position, settings.thresholds],
  )

  return (
    <div className="flex flex-col gap-4">
      <FilterBar>
        <SeasonSelector seasonLabel={dataset.seasonLabel} />
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
      </FilterBar>

      <div className="grid items-start gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {tiles.map((tile) => {
          const compact = formatMetricValue(tile.median, tile.kpi)
          return (
            <Panel
              key={tile.kpi.key}
              icon={Dumbbell}
              title={tile.kpi.displayName}
              keyValue={`${compact.text}${compact.unit ? ` ${compact.unit}` : ''}`}
            >
              <div className="flex flex-col gap-2">
                <KPIValue value={tile.median} kpi={tile.kpi} size="big" />
                <TrendIndicator
                  deltaPct={tile.medianDeltaPct}
                  interpretation={tile.kpi.interpretation}
                  label={`median ${tile.basisLabel}`}
                />
                <p className="tabular text-label text-muted">
                  {tile.withData}/{tile.groupSize} athletes with data · median of latest values
                  {tile.medianDeltaPct !== null &&
                    ` · median change ${formatPercentDelta(tile.medianDeltaPct)}`}
                </p>
              </div>
            </Panel>
          )
        })}
      </div>
      <p className="text-label text-muted">
        Values are team medians of each athlete's most recent observation — never a combined
        score (§6.2). See Leaderboards for per-athlete detail.
      </p>
    </div>
  )
}
