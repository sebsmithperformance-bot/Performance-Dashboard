/**
 * Shared team load-trend charts (daily mean load + ACWR with its four display
 * zones) — used by Monitoring → Readiness and Monitoring → GPS → Trends &
 * Recommendations so both pages show the SAME thing (coach-feedback). Stacked
 * full width rather than split side by side: the ACWR chart is the bigger one
 * and both share an x-axis, and every ACWR point is clickable for that day's
 * detail.
 */
import { useMemo, useState } from 'react'
import { LineChart, type YBand } from '../../components/charts/LineChart.tsx'
import { ChartCard } from '../../components/ui/ChartCard.tsx'
import {
  formatDayLabel,
  formatInt as fmt0,
  formatRatio as fmt2,
  formatShortDay as shortDay,
} from '../../lib/dashboard/format.ts'
import { kpiColor } from '../../lib/dashboard/kpi-colors.ts'
import { bandFor, loadBands, type LoadBand } from '../../lib/dashboard/selectors/load-health.ts'
import { teamReadinessView } from '../../lib/dashboard/selectors/readiness.ts'
import { DEFAULT_THRESHOLDS } from '../../lib/settings/defaults.ts'
import type { ThresholdSettings } from '../../lib/settings/types.ts'
import type { DashboardDataset } from '../../lib/dashboard/types.ts'

const fmt1 = (v: number) => v.toFixed(1)

export interface AcwrBand {
  from: number
  to: number
  label: string
}

/** The four transparent ACWR display states, as chart zones. */
const BAND_COLOR: Record<LoadBand, string> = {
  below: 'var(--status-neutral)', // grey — below recent workload
  within: 'var(--status-good)', // green
  elevated: 'var(--status-warning)', // yellow
  high: 'var(--status-danger)', // red
}

export function TeamLoadCharts({
  dataset,
  date,
  rangeDays,
  position,
  acwrBand,
  thresholds = DEFAULT_THRESHOLDS,
}: {
  dataset: DashboardDataset
  date: string
  rangeDays: number
  position: string | null
  acwrBand: AcwrBand
  thresholds?: ThresholdSettings
}) {
  const view = useMemo(
    () => teamReadinessView(dataset, date, rangeDays, position),
    [dataset, date, rangeDays, position],
  )
  const [selected, setSelected] = useState<number | null>(null)
  const dates = view.days.map((d) => d.date)
  const bandDefs = loadBands(thresholds)

  // grey / green / yellow / red zones straight from the configured thresholds
  const zones: YBand[] = [
    {
      from: 0,
      to: thresholds.acwrBelowBand,
      label: 'below',
      color: BAND_COLOR.below,
    },
    {
      from: thresholds.acwrBelowBand,
      to: thresholds.acwrElevatedBand,
      label: acwrBand.label,
      color: BAND_COLOR.within,
    },
    {
      from: thresholds.acwrElevatedBand,
      to: thresholds.acwrHighBand,
      label: 'elevated',
      color: BAND_COLOR.elevated,
    },
    {
      from: thresholds.acwrHighBand,
      to: Math.max(thresholds.acwrHighBand + 0.4, ...view.days.map((d) => d.medianAcwr ?? 0)),
      label: 'substantially elevated',
      color: BAND_COLOR.high,
    },
  ]

  const pointColors = view.days.map((d) =>
    d.medianAcwr === null ? null : BAND_COLOR[bandFor(d.medianAcwr, thresholds)],
  )
  const picked = selected !== null ? view.days[selected] : undefined
  const pickedBand =
    picked && picked.medianAcwr !== null ? bandFor(picked.medianAcwr, thresholds) : null

  return (
    <div className="flex flex-col gap-4">
      <ChartCard
        title="Team ACWR"
        subtitle="median ACWR · click a point for that day"
        table={{
          columns: ['Date', 'Median ACWR', 'State', 'Valid windows'],
          rows: view.days.map((d) => [
            formatDayLabel(d.date),
            d.medianAcwr === null ? '— (window incomplete)' : fmt2(d.medianAcwr),
            d.medianAcwr === null
              ? 'no valid window'
              : (bandDefs.find((b) => b.key === bandFor(d.medianAcwr!, thresholds))?.short ?? ''),
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
              color: 'var(--chart-series-3)',
              values: view.days.map((d) => d.medianAcwr),
            },
          ]}
          height={320}
          yBands={zones}
          pointColors={pointColors}
          onPointClick={(i) => setSelected((cur) => (cur === i ? null : i))}
          selectedIndex={selected}
          smooth
          formatX={shortDay}
          formatY={fmt2}
          ariaLabel={`Team median ACWR over the last ${rangeDays} days`}
        />

        {/* four labelled states — colour is never the only signal */}
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1">
          {bandDefs.map((b) => (
            <span key={b.key} className="inline-flex items-center gap-1.5 text-label text-secondary">
              <span
                aria-hidden
                className="inline-block size-2.5 rounded-full"
                style={{ backgroundColor: BAND_COLOR[b.key] }}
              />
              {b.short} <span className="text-muted">{b.definition}</span>
            </span>
          ))}
          <span className="inline-flex items-center gap-1.5 text-label text-muted">
            <span
              aria-hidden
              className="inline-block size-2.5 rounded-full border border-strong"
            />
            no valid window — gap
          </span>
        </div>

        {picked && (
          <p className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-control bg-surface-2 px-3 py-2 text-label">
            <span className="font-medium text-primary">{formatDayLabel(picked.date)}</span>
            <span className="tabular text-secondary">
              median ACWR {picked.medianAcwr === null ? '—' : fmt2(picked.medianAcwr)}
            </span>
            <span className="text-secondary">
              {pickedBand
                ? (bandDefs.find((b) => b.key === pickedBand)?.short ?? '')
                : 'no valid window'}
            </span>
            <span className="tabular text-muted">
              {picked.validAcwrCount}/{view.groupSize} valid · mean load{' '}
              {picked.meanLoad === null ? '—' : `${fmt0(picked.meanLoad)} AU`}
            </span>
            <button
              type="button"
              onClick={() => setSelected(null)}
              className="ml-auto text-secondary underline decoration-dotted hover:text-primary"
            >
              clear
            </button>
          </p>
        )}
      </ChartCard>

      <ChartCard
        title="Daily Workload — team mean"
        subtitle={view.loadKpiLabel}
        table={{
          columns: ['Date', 'Mean Workload (1–10)', 'Athletes with data'],
          rows: view.days.map((d) => [
            formatDayLabel(d.date),
            d.meanLoad === null ? '—' : fmt1(d.meanLoad),
            d.observedCount,
          ]),
        }}
      >
        <LineChart
          xLabels={dates}
          series={[
            {
              key: 'meanLoad',
              label: 'Mean Workload',
              color: kpiColor('workload'),
              values: view.days.map((d) => d.meanLoad),
            },
          ]}
          height={220}
          zeroBased
          smooth
          selectedIndex={selected}
          onPointClick={(i) => setSelected((cur) => (cur === i ? null : i))}
          formatX={shortDay}
          formatY={fmt1}
          ariaLabel={`Team mean daily Workload over the last ${rangeDays} days`}
        />
      </ChartCard>
    </div>
  )
}
