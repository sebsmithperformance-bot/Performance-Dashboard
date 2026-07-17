import { Columns3 } from 'lucide-react'
import { useMemo, useState } from 'react'
import {
  FilterBar,
  PositionSelector,
  SeasonSelector,
  SessionPicker,
} from '../../components/controls/controls.tsx'
import { SaveViewControl } from '../../components/controls/SaveViewControl.tsx'
import { Badge } from '../../components/ui/Badge.tsx'
import { DataTable, type Column } from '../../components/ui/DataTable.tsx'
import { Drawer } from '../../components/ui/Drawer.tsx'
import { ErrorState } from '../../components/ui/ErrorState.tsx'
import { KPIValue } from '../../components/ui/KPIValue.tsx'
import { AvailabilityBadge } from '../../components/ui/StatusBadge.tsx'
import { Skeleton } from '../../components/ui/Skeleton.tsx'
import { useDashboardData } from '../../lib/dashboard/DashboardDataContext.tsx'
import { formatDayLabel } from '../../lib/dashboard/format.ts'
import { athletesTableView, type AthleteRow } from '../../lib/dashboard/selectors/athletes-table.ts'
import type { DashboardDataset, Position } from '../../lib/dashboard/types.ts'

const QUALITY_TONE = {
  ok: 'good',
  'no device data': 'warning',
  'modified session': 'neutral',
  'did not participate': 'neutral',
} as const

/** Overview → Athletes (§5.1): one selected session, every athlete's key metrics. */
export function AthletesPage() {
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
    <AthletesTable
      dataset={dataset}
      date={selectedDate}
      onDateChange={setSelectedDate}
      savedViews={savedViews}
    />
  )
}

function AthletesTable({
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
  const [position, setPosition] = useState<Position | null>(null)
  const [hiddenKpis, setHiddenKpis] = useState<Set<string>>(new Set())
  const [columnsOpen, setColumnsOpen] = useState(false)
  const [drawerAthlete, setDrawerAthlete] = useState<AthleteRow | null>(null)

  const view = useMemo(
    () => athletesTableView(dataset, date, sessionId, position),
    [dataset, date, sessionId, position],
  )
  const visibleKpis = view.availableKpis.filter((k) => !hiddenKpis.has(k.key))

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
        key: 'availability',
        header: 'Availability',
        sortValue: (r) => r.availability,
        render: (r) => <AvailabilityBadge status={r.availability} />,
      },
      {
        key: 'duration',
        header: 'Min',
        align: 'right',
        sortValue: (r) => r.exposureMin,
        render: (r) => (
          <span className="tabular">{r.exposureMin === null ? '—' : r.exposureMin}</span>
        ),
      },
      ...visibleKpis.map((kpi): Column<AthleteRow> => ({
        key: kpi.key,
        header: kpi.displayName,
        align: 'right',
        sortValue: (r) => r.values[kpi.key] ?? null,
        render: (r) => (
          <KPIValue value={r.values[kpi.key] ?? null} kpi={kpi} size="small" showUnit={false} />
        ),
      })),
      {
        key: 'quality',
        header: 'Data',
        sortValue: (r) => r.quality,
        render: (r) => <Badge tone={QUALITY_TONE[r.quality]}>{r.quality}</Badge>,
      },
    ],
    [visibleKpis],
  )

  const dates = useMemo(() => [...dataset.sessionsByDate.keys()], [dataset])

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
        <div className="relative">
          <button
            type="button"
            onClick={() => setColumnsOpen((v) => !v)}
            aria-expanded={columnsOpen}
            className="inline-flex h-9 items-center gap-2 rounded-control border border-subtle px-3 text-label font-medium text-secondary hover:border-strong hover:text-primary"
          >
            <Columns3 aria-hidden className="size-4" />
            Metrics ({visibleKpis.length}/{view.availableKpis.length})
          </button>
          {columnsOpen && (
            <div className="absolute z-30 mt-1 flex w-64 flex-col gap-1 rounded-card border border-subtle bg-surface p-2 shadow-(--shadow-float)">
              {view.availableKpis.map((kpi) => (
                <label
                  key={kpi.key}
                  className="flex items-center gap-2 rounded-control px-2 py-1 text-body hover:bg-surface-2"
                >
                  <input
                    type="checkbox"
                    checked={!hiddenKpis.has(kpi.key)}
                    onChange={(e) => {
                      setHiddenKpis((prev) => {
                        const next = new Set(prev)
                        if (e.target.checked) next.delete(kpi.key)
                        else next.add(kpi.key)
                        return next
                      })
                    }}
                    className="accent-(--accent)"
                  />
                  {kpi.displayName}
                </label>
              ))}
            </div>
          )}
        </div>
        <SaveViewControl
          page="overview-athletes"
          store={savedViews}
          getCurrentConfig={() => ({ position, hiddenKpis: [...hiddenKpis] })}
          onApply={(config) => {
            setPosition((config['position'] as Position | null) ?? null)
            setHiddenKpis(new Set((config['hiddenKpis'] as string[] | undefined) ?? []))
          }}
        />
      </FilterBar>

      {view.session === null ? (
        <ErrorState
          title="No sessions on this date"
          message="Pick another date — rest days have no session to display."
        />
      ) : (
        <>
          <p className="text-label text-muted">
            {view.session.label} · {formatDayLabel(view.date)} · {view.session.type} ·{' '}
            {view.rows.filter((r) => r.quality === 'ok' || r.quality === 'modified session').length}{' '}
            athletes with data
          </p>

          {/* Desktop/tablet table */}
          <div className="hidden md:block">
            <DataTable
              columns={columns}
              rows={view.rows}
              rowKey={(r) => r.athleteId}
              onRowClick={setDrawerAthlete}
            />
          </div>

          {/* Narrow-mobile card alternative (§12.4 single column) */}
          <ul className="flex flex-col gap-2 md:hidden">
            {view.rows.map((r) => (
              <li key={r.athleteId}>
                <button
                  type="button"
                  onClick={() => setDrawerAthlete(r)}
                  className="w-full rounded-card border border-subtle bg-surface p-3 text-left"
                >
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{r.name}</span>
                    <span className="text-label text-muted">{r.position}</span>
                    <span className="ml-auto">
                      <AvailabilityBadge status={r.availability} />
                    </span>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-label text-secondary">
                    {visibleKpis.slice(0, 3).map((kpi) => (
                      <span key={kpi.key} className="inline-flex items-baseline gap-1">
                        {kpi.displayName}
                        <KPIValue value={r.values[kpi.key] ?? null} kpi={kpi} size="small" />
                      </span>
                    ))}
                  </div>
                </button>
              </li>
            ))}
          </ul>
        </>
      )}

      {drawerAthlete && view.session && (
        <Drawer title={drawerAthlete.name} onClose={() => setDrawerAthlete(null)}>
          <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center gap-2">
              <AvailabilityBadge status={drawerAthlete.availability} />
              <Badge tone={QUALITY_TONE[drawerAthlete.quality]}>{drawerAthlete.quality}</Badge>
              {drawerAthlete.availabilityNote && (
                <span className="text-label text-secondary">{drawerAthlete.availabilityNote}</span>
              )}
            </div>
            <p className="text-label text-muted">
              {view.session.label} · {formatDayLabel(view.date)} ·{' '}
              {drawerAthlete.exposureMin === null
                ? 'did not participate'
                : `${drawerAthlete.exposureMin} min exposure`}
            </p>
            <dl className="flex flex-col divide-y divide-subtle rounded-control border border-subtle">
              {view.availableKpis.map((kpi) => (
                <div key={kpi.key} className="flex items-baseline justify-between px-3 py-2">
                  <dt className="text-body text-secondary">{kpi.displayName}</dt>
                  <dd>
                    <KPIValue
                      value={drawerAthlete.values[kpi.key] ?? null}
                      kpi={kpi}
                      size="small"
                    />
                  </dd>
                </div>
              ))}
            </dl>
            <p className="text-label text-muted">
              “—” means no observation was recorded — distinct from a true zero (§6.7).
            </p>
          </div>
        </Drawer>
      )}
    </div>
  )
}
