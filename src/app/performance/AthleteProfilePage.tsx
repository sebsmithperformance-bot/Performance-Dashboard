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

/** Performance → Athlete Profile (§5.4): direction-aware percentile radar with
 *  a team/position-average reference overlay, plus raw-value metric comparison.
 *  Never a combined score. */
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
  // reference-series label follows the chosen comparison group (Team / Position average)
  const avgLabel =
    comparison === 'team'
      ? 'Team average'
      : `${positionGroups.find((g) => g.id === comparison)?.label ?? comparison} average`

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
        key: 'groupavg',
        header: avgLabel,
        align: 'right',
        sortValue: (a) => a.groupAvgValue,
        render: (a) => (
          <KPIValue value={a.groupAvgValue} kpi={a.kpi} size="small" showUnit={false} />
        ),
      },
      {
        key: 'best',
        header: 'Group best',
        align: 'right',
        sortValue: (a) => a.groupBest,
        render: (a) => <KPIValue value={a.groupBest} kpi={a.kpi} size="small" showUnit={false} />,
      },
    ],
    [avgLabel],
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
            title={`${athlete.fullName} vs ${avgLabel}`}
            subtitle={`direction-aware percentile of latest values vs ${view.comparisonLabel} · needs at least ${view.minComparison} comparison athletes per spoke`}
            table={{
              columns: [
                'Metric',
                `${athlete.fullName} (P)`,
                `${avgLabel} (P)`,
                'Athlete raw',
                `${avgLabel} raw`,
                'Comparison n',
              ],
              rows: view.axes.map((a) => [
                a.kpi.displayName,
                a.percentile === null ? `n/a (${a.reason})` : `P${Math.round(a.percentile)}`,
                a.groupAvgPercentile === null ? 'n/a' : `P${Math.round(a.groupAvgPercentile)}`,
                a.value === null ? 'no data' : formatMetricValue(a.value, a.kpi).text,
                a.groupAvgValue === null ? 'no data' : formatMetricValue(a.groupAvgValue, a.kpi).text,
                a.comparisonN,
              ]),
            }}
          >
            {view.insufficientComparison ? (
              <p className="py-10 text-center text-body text-secondary">
                Not enough comparison athletes to rank {athlete.fullName} against{' '}
                {view.comparisonLabel} (needs at least {view.minComparison} with data per metric).
                Pick a broader comparison group.
              </p>
            ) : (
              <RadarChart
                axes={view.axes.map((a) => ({
                  key: a.kpi.key,
                  label: a.kpi.displayName.replace(/ - | — /, ' '),
                }))}
                series={[
                  {
                    key: 'athlete',
                    label: athlete.fullName,
                    color: 'var(--chart-series-1)',
                    values: view.axes.map((a) => a.percentile),
                  },
                  {
                    key: 'group-avg',
                    label: avgLabel,
                    color: 'var(--chart-series-5)',
                    values: view.axes.map((a) => a.groupAvgPercentile),
                  },
                ]}
                ariaLabel={`${athlete.fullName} versus ${avgLabel} percentile radar across ${view.axes.length} strength and conditioning metrics`}
              />
            )}
            <p className="mt-2 text-label text-muted">
              Both series share the 0-100 percentile scale. Spokes with no valid percentile are
              excluded from a series shape - the radar never averages into a single score (6.2). Raw
              values sit beside every percentile in the table.
            </p>
          </ChartCard>

          <div className="flex flex-col gap-3">
            <h2 className="text-subhead font-semibold">
              Metric comparison
              <span className="ml-2 text-label font-normal text-muted">
                {athlete.fullName} · {athlete.position}
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
