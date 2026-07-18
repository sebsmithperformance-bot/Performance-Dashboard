/**
 * Shared team load-trend chart pair (daily mean load + median ACWR with the
 * band overlay) — used by Monitoring → Readiness (Team Trend) and
 * Monitoring → GPS → Trends & Recommendations. One implementation only.
 */
import { useMemo } from 'react'
import { LineChart } from '../../components/charts/LineChart.tsx'
import { ChartCard } from '../../components/ui/ChartCard.tsx'
import {
  formatDayLabel,
  formatInt as fmt0,
  formatRatio as fmt2,
  formatShortDay as shortDay,
} from '../../lib/dashboard/format.ts'
import { kpiColor } from '../../lib/dashboard/kpi-colors.ts'
import { teamReadinessView } from '../../lib/dashboard/selectors/readiness.ts'
import type { DashboardDataset } from '../../lib/dashboard/types.ts'

export interface AcwrBand {
  from: number
  to: number
  label: string
}

export function TeamLoadCharts({
  dataset,
  date,
  rangeDays,
  position,
  acwrBand,
}: {
  dataset: DashboardDataset
  date: string
  rangeDays: number
  position: string | null
  acwrBand: AcwrBand
}) {
  const view = useMemo(
    () => teamReadinessView(dataset, date, rangeDays, position),
    [dataset, date, rangeDays, position],
  )
  const dates = view.days.map((d) => d.date)
  const latest = view.days[view.days.length - 1]

  return (
    <div className="grid items-start gap-4 xl:grid-cols-2">
      <ChartCard
        title="Daily load — team mean"
        subtitle={view.loadKpiLabel}
        table={{
          columns: ['Date', 'Mean load (AU)', 'Athletes with data'],
          rows: view.days.map((d) => [
            formatDayLabel(d.date),
            d.meanLoad === null ? '—' : fmt0(d.meanLoad),
            d.observedCount,
          ]),
        }}
      >
        <LineChart
          xLabels={dates}
          series={[
            {
              key: 'meanLoad',
              label: 'Mean load',
              color: kpiColor('player_load'),
              values: view.days.map((d) => d.meanLoad),
            },
          ]}
          zeroBased
          smooth
          formatX={shortDay}
          formatY={fmt0}
          ariaLabel={`Team mean daily load over the last ${rangeDays} days`}
        />
      </ChartCard>

      <ChartCard
        title="ACWR — team median"
        subtitle="median across athletes with a complete 28-day window"
        table={{
          columns: ['Date', 'Median ACWR', 'Valid windows'],
          rows: view.days.map((d) => [
            formatDayLabel(d.date),
            d.medianAcwr === null ? '—' : fmt2(d.medianAcwr),
            `${d.validAcwrCount}/${view.groupSize}`,
          ]),
        }}
      >
        <LineChart
          xLabels={dates}
          series={[
            {
              key: 'medianAcwr',
              label: 'Median ACWR',
              color: 'var(--chart-series-5)',
              values: view.days.map((d) => d.medianAcwr),
            },
          ]}
          yBand={acwrBand}
          smooth
          formatX={shortDay}
          formatY={fmt2}
          ariaLabel={`Team median ACWR over the last ${rangeDays} days`}
        />
        {latest && (
          <p className="mt-2 text-label text-muted">
            latest: {latest.validAcwrCount}/{view.groupSize} athletes with a valid window
          </p>
        )}
      </ChartCard>
    </div>
  )
}
