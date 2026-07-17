import { useMemo, useState } from 'react'
import { RadarChart } from '../../components/charts/RadarChart.tsx'
import {
  AthleteSelector,
  CONTROL_CLASS,
  FilterBar,
  LabeledControl,
  SeasonSelector,
} from '../../components/controls/controls.tsx'
import { Badge } from '../../components/ui/Badge.tsx'
import { ChartCard } from '../../components/ui/ChartCard.tsx'
import { DataTable, type Column } from '../../components/ui/DataTable.tsx'
import { ErrorState } from '../../components/ui/ErrorState.tsx'
import { KPIValue } from '../../components/ui/KPIValue.tsx'
import { Skeleton } from '../../components/ui/Skeleton.tsx'
import { useDashboardData } from '../../lib/dashboard/DashboardDataContext.tsx'
import { formatMetricValue } from '../../lib/dashboard/format.ts'
import {
  athleteProfileView,
  type ProfileAxis,
} from '../../lib/dashboard/selectors/performance.ts'
import { activePositionGroups, useSettings } from '../../lib/settings/SettingsContext.tsx'
import type { DashboardDataset } from '../../lib/dashboard/types.ts'

/** Performance → Athlete Profile (§5.4): direction-aware percentile radar
 *  plus raw-value metric comparison. Never a combined score. */
export function AthleteProfilePage() {
  const { status, error, dataset, selectedDate } = useDashboardData()

  if (status === 'loading') return <Skeleton className="h-96 w-full" />
  if (status === 'error' || !dataset || !selectedDate) {
    return (
      <ErrorState
        title="Dashboard data unavailable"
        message={error ?? 'No dataset loaded — run npm run seed:generate and reload.'}
      />
    )
  }
  return <Profile dataset={dataset} date={selectedDate} />
}

function Profile({ dataset, date }: { dataset: DashboardDataset; date: string }) {
  const { settings } = useSettings()
  const [athleteId, setAthleteId] = useState<string | null>(dataset.athletes[0]?.id ?? null)
  const [comparison, setComparison] = useState<string>('team')

  const athlete = athleteId ? dataset.athleteById.get(athleteId) : undefined
  const view = useMemo(
    () =>
      athlete
        ? athleteProfileView(dataset, athlete.id, date, comparison === 'team' ? null : comparison)
        : null,
    [dataset, athlete, date, comparison],
  )
  const positionGroups = activePositionGroups(settings)

  const columns = useMemo<Column<ProfileAxis>[]>(
    () => [
      {
        key: 'metric',
        header: 'Metric',
        sortValue: (a) => a.kpi.displayName,
        render: (a) => <span className="font-medium">{a.kpi.displayName}</span>,
      },
      {
        key: 'value',
        header: 'Latest value',
        align: 'right',
        sortValue: (a) => a.value,
        render: (a) => <KPIValue value={a.value} kpi={a.kpi} size="small" />,
      },
      {
        key: 'percentile',
        header: 'Percentile',
        align: 'right',
        sortValue: (a) => a.percentile,
        render: (a) =>
          a.percentile === null ? (
            <span className="text-label text-muted">{a.reason}</span>
          ) : (
            <span className="inline-flex items-center gap-2">
              <span className="tabular font-medium">P{Math.round(a.percentile)}</span>
              <Badge tone="neutral">n={a.comparisonN}</Badge>
            </span>
          ),
      },
      {
        key: 'median',
        header: 'Group median',
        align: 'right',
        sortValue: (a) => a.groupMedian,
        render: (a) => <KPIValue value={a.groupMedian} kpi={a.kpi} size="small" showUnit={false} />,
      },
      {
        key: 'best',
        header: 'Group best',
        align: 'right',
        sortValue: (a) => a.groupBest,
        render: (a) => <KPIValue value={a.groupBest} kpi={a.kpi} size="small" showUnit={false} />,
      },
    ],
    [],
  )

  return (
    <div className="flex flex-col gap-4">
      <FilterBar>
        <SeasonSelector seasonLabel={dataset.seasonLabel} />
        <AthleteSelector athletes={dataset.athletes} value={athleteId} onChange={setAthleteId} />
        <LabeledControl label="Compare against">
          <select
            value={comparison}
            onChange={(e) => setComparison(e.target.value)}
            className={CONTROL_CLASS}
          >
            <option value="team">Whole team</option>
            {positionGroups.map((g) => (
              <option key={g.id} value={g.id}>
                {g.label}
              </option>
            ))}
          </select>
        </LabeledControl>
      </FilterBar>

      {!athlete || !view ? (
        <ErrorState title="Pick an athlete" message="Choose an athlete to see their profile." />
      ) : (
        <div className="grid items-start gap-4 xl:grid-cols-2">
          <ChartCard
            title={`${athlete.fullName} — percentile radar`}
            subtitle={`direction-aware percentile of latest values vs ${view.comparisonLabel} · needs ≥ ${view.minComparison} comparison athletes per spoke`}
            table={{
              columns: ['Metric', 'Percentile', 'Raw value', 'Comparison n'],
              rows: view.axes.map((a) => [
                a.kpi.displayName,
                a.percentile === null ? `— (${a.reason})` : `P${Math.round(a.percentile)}`,
                a.value === null ? '—' : formatMetricValue(a.value, a.kpi).text,
                a.comparisonN,
              ]),
            }}
          >
            <RadarChart
              axes={view.axes.map((a) => ({
                key: a.kpi.key,
                label: a.kpi.displayName.replace(/ — /, ' '),
                value: a.percentile,
              }))}
              ariaLabel={`${athlete.fullName} percentile radar across ${view.axes.length} S&C metrics`}
            />
            <p className="mt-2 text-label text-muted">
              Spokes marked “n/a” have no valid percentile and are excluded from the shape — the
              radar never averages into a single score (§6.2).
            </p>
          </ChartCard>

          <div className="flex flex-col gap-3">
            <h2 className="text-subhead font-semibold">
              Metric comparison — {athlete.fullName}
              <span className="ml-2 text-label font-normal text-muted">
                {athlete.position}
                {athlete.jerseyNumber !== null && ` · #${athlete.jerseyNumber}`}
              </span>
            </h2>
            <DataTable columns={columns} rows={view.axes} rowKey={(a) => a.kpi.key} />
            <p className="text-label text-muted">
              Raw value and sample size appear beside every percentile; latest observation at or
              before the selected date.
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
