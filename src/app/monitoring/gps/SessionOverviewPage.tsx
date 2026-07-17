import { useMemo, useState } from 'react'
import {
  FilterBar,
  PositionSelector,
  SeasonSelector,
  SessionPicker,
} from '../../../components/controls/controls.tsx'
import { SaveViewControl } from '../../../components/controls/SaveViewControl.tsx'
import { Badge } from '../../../components/ui/Badge.tsx'
import { DataTable, type Column } from '../../../components/ui/DataTable.tsx'
import { ErrorState } from '../../../components/ui/ErrorState.tsx'
import { KPIValue } from '../../../components/ui/KPIValue.tsx'
import { Skeleton } from '../../../components/ui/Skeleton.tsx'
import { useDashboardData } from '../../../lib/dashboard/DashboardDataContext.tsx'
import { formatDayLabel } from '../../../lib/dashboard/format.ts'
import { gpsSessionOverview } from '../../../lib/dashboard/selectors/gps.ts'
import type { AthleteRow } from '../../../lib/dashboard/selectors/athletes-table.ts'
import type { DashboardDataset } from '../../../lib/dashboard/types.ts'

const QUALITY_TONE = {
  ok: 'good',
  'no device data': 'warning',
  'modified session': 'neutral',
  'did not participate': 'neutral',
} as const

/** Monitoring → GPS → Session Overview (§5.2): all major GPS metrics for one
 *  selected session, broken down by athlete, with a team summary strip. */
export function GpsSessionOverviewPage() {
  const { status, error, dataset, selectedDate, setSelectedDate, savedViews } = useDashboardData()

  if (status === 'loading') return <Skeleton className="h-96 w-full" />
  if (status === 'error' || !dataset || !selectedDate) {
    return (
      <ErrorState
        title="Dashboard data unavailable"
        message={error ?? 'No dataset loaded — run npm run seed:generate and reload.'}
      />
    )
  }
  return (
    <SessionOverview
      dataset={dataset}
      date={selectedDate}
      onDateChange={setSelectedDate}
      savedViews={savedViews}
    />
  )
}

function SessionOverview({
  dataset,
  date,
  onDateChange,
  savedViews,
}: {
  dataset: DashboardDataset
  date: string
  onDateChange: (date: string) => void
  savedViews: ReturnType<typeof useDashboardData>['savedViews']
}) {
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [position, setPosition] = useState<string | null>(null)

  const view = useMemo(
    () => gpsSessionOverview(dataset, date, sessionId, position),
    [dataset, date, sessionId, position],
  )

  // dates that actually have a field session (GPS surface)
  const dates = useMemo(
    () =>
      [...dataset.sessionsByDate.entries()]
        .filter(([, sessions]) => sessions.some((s) => s.kind === 'field'))
        .map(([d]) => d),
    [dataset],
  )

  const columns = useMemo<Column<AthleteRow>[]>(
    () => [
      {
        key: 'athlete',
        header: 'Athlete',
        sortValue: (r) => r.name,
        render: (r) => <span className="font-medium">{r.name}</span>,
      },
      {
        key: 'position',
        header: 'Position',
        sortValue: (r) => r.position,
        render: (r) => <span className="text-secondary">{r.position}</span>,
      },
      {
        key: 'min',
        header: 'Min',
        align: 'right',
        sortValue: (r) => r.exposureMin,
        render: (r) => (
          <span className="tabular">{r.exposureMin === null ? '—' : r.exposureMin}</span>
        ),
      },
      ...view.kpis.map(
        (kpi): Column<AthleteRow> => ({
          key: kpi.key,
          header: kpi.displayName,
          align: 'right',
          sortValue: (r) => r.values[kpi.key] ?? null,
          render: (r) => (
            <KPIValue value={r.values[kpi.key] ?? null} kpi={kpi} size="small" showUnit={false} />
          ),
        }),
      ),
      {
        key: 'quality',
        header: 'Data',
        sortValue: (r) => r.quality,
        render: (r) => <Badge tone={QUALITY_TONE[r.quality]}>{r.quality}</Badge>,
      },
    ],
    [view.kpis],
  )

  return (
    <div className="flex flex-col gap-4">
      <FilterBar>
        <SeasonSelector seasonLabel={dataset.seasonLabel} />
        <SessionPicker
          dates={dates}
          date={date}
          onDateChange={(d) => {
            onDateChange(d)
            setSessionId(null)
          }}
          sessionsOnDate={view.sessionsOnDate}
          sessionId={view.session?.id ?? null}
          onSessionChange={setSessionId}
        />
        <PositionSelector value={position} onChange={setPosition} />
        <SaveViewControl
          page="monitoring-gps"
          store={savedViews}
          getCurrentConfig={() => ({ position })}
          onApply={(config) => setPosition((config['position'] as string | null) ?? null)}
        />
      </FilterBar>

      {view.session === null ? (
        <ErrorState
          title="No field session on this date"
          message="Pick a date with a practice or game — lift-only days have no GPS surface."
        />
      ) : (
        <>
          <p className="text-label text-muted">
            {view.session.label} · {formatDayLabel(view.date)} · {view.session.type}
          </p>

          {/* team summary strip: mean + session-best per KPI (labeled, no scores) */}
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
            {view.teamStats.map((stat) => (
              <div key={stat.kpi.key} className="rounded-control bg-surface-2 px-3 py-2">
                <p className="truncate text-label text-muted" title={stat.kpi.displayName}>
                  {stat.kpi.displayName}
                </p>
                <p>
                  <KPIValue value={stat.mean} kpi={stat.kpi} size="small" />
                  <span className="ml-1 text-label text-muted">mean</span>
                </p>
                <p className="text-label text-secondary">
                  top <KPIValue value={stat.top} kpi={stat.kpi} size="small" showUnit={false} />
                  <span className="tabular ml-1 text-muted">n={stat.n}</span>
                </p>
              </div>
            ))}
          </div>

          <DataTable columns={columns} rows={view.rows} rowKey={(r) => r.athleteId} />
          <p className="text-label text-muted">
            “—” = no observation recorded (never zero, §6.7); “no device data” marks athletes who
            participated without a working unit.
          </p>
        </>
      )}
    </div>
  )
}
