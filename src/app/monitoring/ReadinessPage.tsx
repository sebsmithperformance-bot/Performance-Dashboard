import { useMemo, useState } from 'react'
import { LineChart } from '../../components/charts/LineChart.tsx'
import { Sparkline } from '../../components/charts/Sparkline.tsx'
import {
  FilterBar,
  LabeledControl,
  CONTROL_CLASS,
  PositionSelector,
  SeasonSelector,
} from '../../components/controls/controls.tsx'
import { SaveViewControl } from '../../components/controls/SaveViewControl.tsx'
import { Badge } from '../../components/ui/Badge.tsx'
import { ChartCard } from '../../components/ui/ChartCard.tsx'
import { DataTable, type Column } from '../../components/ui/DataTable.tsx'
import { ErrorState } from '../../components/ui/ErrorState.tsx'
import { Skeleton } from '../../components/ui/Skeleton.tsx'
import { useDashboardData } from '../../lib/dashboard/DashboardDataContext.tsx'
import { kpiColor } from '../../lib/dashboard/kpi-colors.ts'
import {
  athleteReadinessSeries,
  readinessTableView,
  type ReadinessRow,
} from '../../lib/dashboard/selectors/readiness.ts'
import {
  formatDayLabel,
  formatInt as fmt0,
  formatRatio as fmt2,
  formatShortDay as shortDay,
} from '../../lib/dashboard/format.ts'
import { TeamLoadCharts, type AcwrBand } from './TeamLoadCharts.tsx'
import { loadBands, type LoadBand } from '../../lib/dashboard/selectors/load-health.ts'
import { useSettings } from '../../lib/settings/SettingsContext.tsx'
import type { DashboardDataset } from '../../lib/dashboard/types.ts'

const RANGES = [14, 28, 60, 90]

const BAND_TONE: Record<LoadBand, 'good' | 'warning' | 'neutral' | 'danger'> = {
  below: 'neutral',
  within: 'good',
  elevated: 'warning',
  high: 'danger',
}

/** Monitoring → Readiness (§5.2): Team Trend and Individuals, same lens. */
export function ReadinessPage() {
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
  return <Readiness dataset={dataset} date={selectedDate} savedViews={savedViews} />
}

function Readiness({
  dataset,
  date,
  savedViews,
}: {
  dataset: DashboardDataset
  date: string
  savedViews: ReturnType<typeof useDashboardData>['savedViews']
}) {
  const { settings } = useSettings()
  const [mode, setMode] = useState<'team' | 'individuals'>('team')
  const [rangeDays, setRangeDays] = useState(28)
  const [position, setPosition] = useState<string | null>(null)
  const [athleteId, setAthleteId] = useState<string | null>(null)

  const thresholds = settings.thresholds
  const acwrBand = {
    from: thresholds.acwrBelowBand,
    to: thresholds.acwrElevatedBand,
    label: `within ${thresholds.acwrBelowBand.toFixed(2)}–${thresholds.acwrElevatedBand.toFixed(2)}`,
  }
  const bandDefs = loadBands(thresholds)

  return (
    <div className="flex flex-col gap-4">
      <FilterBar>
        <SeasonSelector seasonLabel={dataset.seasonLabel} />
        <div role="group" aria-label="Readiness view" className="flex gap-1">
          {(['team', 'individuals'] as const).map((m) => (
            <button
              key={m}
              type="button"
              aria-pressed={mode === m}
              onClick={() => setMode(m)}
              className={`rounded-full border px-3 py-1 text-label font-medium ${
                mode === m
                  ? 'border-accent bg-accent/15 text-primary'
                  : 'border-subtle text-secondary hover:border-strong hover:text-primary'
              }`}
            >
              {m === 'team' ? 'Team Trend' : 'Individuals'}
            </button>
          ))}
        </div>
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
          page="monitoring-readiness"
          store={savedViews}
          getCurrentConfig={() => ({ mode, rangeDays, position, athleteId })}
          onApply={(config) => {
            setMode((config['mode'] as 'team' | 'individuals') ?? 'team')
            setRangeDays((config['rangeDays'] as number) ?? 28)
            setPosition((config['position'] as string | null) ?? null)
            setAthleteId((config['athleteId'] as string | null) ?? null)
          }}
        />
      </FilterBar>

      {mode === 'team' ? (
        <TeamLoadCharts
          dataset={dataset}
          date={date}
          rangeDays={rangeDays}
          position={position}
          acwrBand={acwrBand}
        />
      ) : (
        <Individuals
          dataset={dataset}
          date={date}
          rangeDays={rangeDays}
          position={position}
          athleteId={athleteId}
          onSelectAthlete={setAthleteId}
          acwrBand={acwrBand}
        />
      )}

      <p className="text-label text-muted">
        Bands: {bandDefs.map((b) => `${b.label} = ${b.definition}`).join(' · ')}. ACWR appears only
        when the full 28-day window is complete (§6.7) — these are workload observations, not
        injury predictions (§6.8).
      </p>
    </div>
  )
}

function Individuals({
  dataset,
  date,
  rangeDays,
  position,
  athleteId,
  onSelectAthlete,
  acwrBand,
}: {
  dataset: DashboardDataset
  date: string
  rangeDays: number
  position: string | null
  athleteId: string | null
  onSelectAthlete: (id: string) => void
  acwrBand: AcwrBand
}) {
  const { settings } = useSettings()
  const rows = useMemo(
    () => readinessTableView(dataset, date, position, settings.thresholds),
    [dataset, date, position, settings.thresholds],
  )
  const selected = rows.find((r) => r.athleteId === athleteId) ?? rows[0] ?? null
  const series = useMemo(
    () =>
      selected ? athleteReadinessSeries(dataset, selected.athleteId, date, rangeDays) : null,
    [dataset, selected, date, rangeDays],
  )

  const columns = useMemo<Column<ReadinessRow>[]>(
    () => [
      {
        key: 'athlete',
        header: 'Athlete',
        sortValue: (r) => r.name,
        render: (r) => (
          <span className={`font-medium ${r.athleteId === selected?.athleteId ? 'text-accent' : ''}`}>
            {r.name}
          </span>
        ),
      },
      {
        key: 'position',
        header: 'Position',
        sortValue: (r) => r.position,
        render: (r) => <span className="text-secondary">{r.position}</span>,
      },
      {
        key: 'acute',
        header: '7d load',
        align: 'right',
        sortValue: (r) => r.acute7d,
        render: (r) => (
          <span className="tabular">{r.acute7d === null ? '—' : fmt0(r.acute7d)}</span>
        ),
      },
      {
        key: 'chronic',
        header: '28d weekly eq.',
        align: 'right',
        sortValue: (r) => r.chronicWeekly,
        render: (r) => (
          <span className="tabular">{r.chronicWeekly === null ? '—' : fmt0(r.chronicWeekly)}</span>
        ),
      },
      {
        key: 'acwr',
        header: 'ACWR',
        align: 'right',
        sortValue: (r) => r.acwr,
        render: (r) =>
          r.acwr === null ? (
            <span className="text-label text-muted">{r.reason}</span>
          ) : (
            <span className="inline-flex items-center gap-2">
              <span className="tabular">{fmt2(r.acwr)}</span>
              {r.band && <Badge tone={BAND_TONE[r.band]}>{r.band}</Badge>}
            </span>
          ),
      },
      {
        key: 'monotony',
        header: 'Monotony',
        align: 'right',
        sortValue: (r) => r.monotony,
        render: (r) => (
          <span className="tabular">{r.monotony === null ? '—' : fmt2(r.monotony)}</span>
        ),
      },
      {
        key: 'strain',
        header: 'Strain',
        align: 'right',
        sortValue: (r) => r.strain,
        render: (r) => <span className="tabular">{r.strain === null ? '—' : fmt0(r.strain)}</span>,
      },
      {
        key: 'spark',
        header: '14d loads',
        render: (r) => {
          const observed = r.spark.filter((v): v is number => v !== null)
          return observed.length >= 2 ? (
            <Sparkline
              values={observed}
              color={kpiColor('player_load')}
              width={90}
              height={24}
              ariaLabel={`${r.name} observed daily loads, last 14 days`}
            />
          ) : (
            <span className="text-label text-muted">not enough data</span>
          )
        },
      },
    ],
    [selected],
  )

  return (
    <div className="flex flex-col gap-4">
      {selected && series && (
        <div className="grid items-start gap-4 xl:grid-cols-2">
          <ChartCard
            title={`${selected.name} — daily load`}
            subtitle="observed load; confirmed rest = 0; gaps = missing device data"
            table={{
              columns: ['Date', 'Load (AU)'],
              rows: series.map((d) => [
                formatDayLabel(d.date),
                d.load === null ? '— (missing)' : fmt0(d.load),
              ]),
            }}
          >
            <LineChart
              xLabels={series.map((d) => d.date)}
              series={[
                {
                  key: 'load',
                  label: 'Daily load',
                  color: kpiColor('player_load'),
                  values: series.map((d) => d.load),
                },
              ]}
              zeroBased
              formatX={shortDay}
              formatY={fmt0}
              ariaLabel={`${selected.name} daily load, last ${rangeDays} days`}
            />
          </ChartCard>
          <ChartCard
            title={`${selected.name} — ACWR`}
            subtitle="7-day acute vs 28-day weekly equivalent"
            table={{
              columns: ['Date', 'ACWR'],
              rows: series.map((d) => [
                formatDayLabel(d.date),
                d.acwr === null ? '— (window incomplete)' : fmt2(d.acwr),
              ]),
            }}
          >
            <LineChart
              xLabels={series.map((d) => d.date)}
              series={[
                {
                  key: 'acwr',
                  label: 'ACWR',
                  color: 'var(--chart-series-5)',
                  values: series.map((d) => d.acwr),
                },
              ]}
              yBand={acwrBand}
              formatX={shortDay}
              formatY={fmt2}
              ariaLabel={`${selected.name} ACWR, last ${rangeDays} days`}
            />
          </ChartCard>
        </div>
      )}

      <p className="text-label text-muted">Click a row to chart that athlete.</p>
      <DataTable
        columns={columns}
        rows={rows}
        rowKey={(r) => r.athleteId}
        onRowClick={(r) => onSelectAthlete(r.athleteId)}
      />
    </div>
  )
}
