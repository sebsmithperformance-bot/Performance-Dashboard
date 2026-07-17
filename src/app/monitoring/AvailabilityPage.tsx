import { UsersRound } from 'lucide-react'
import { useMemo, useState } from 'react'
import { DistributionBar } from '../../components/charts/DistributionBar.tsx'
import { FilterBar, PositionSelector, SeasonSelector } from '../../components/controls/controls.tsx'
import { Badge } from '../../components/ui/Badge.tsx'
import { Button } from '../../components/ui/Button.tsx'
import { DataTable, type Column } from '../../components/ui/DataTable.tsx'
import { Drawer } from '../../components/ui/Drawer.tsx'
import { ErrorState } from '../../components/ui/ErrorState.tsx'
import { Skeleton } from '../../components/ui/Skeleton.tsx'
import { AvailabilityBadge } from '../../components/ui/StatusBadge.tsx'
import { useDashboardData } from '../../lib/dashboard/DashboardDataContext.tsx'
import { formatDayLabel } from '../../lib/dashboard/format.ts'
import { availabilityView } from '../../lib/dashboard/selectors/availability.ts'
import type {
  AvailabilityStatus,
  DashAthlete,
  DashboardDataset,
} from '../../lib/dashboard/types.ts'

const STATUS_META: { key: AvailabilityStatus; label: string; color: string }[] = [
  { key: 'full_go', label: 'Full Go', color: 'var(--status-good)' },
  { key: 'limited', label: 'Limited', color: 'var(--status-warning)' },
  { key: 'out', label: 'Out', color: 'var(--status-danger)' },
]

interface RosterRow {
  athlete: DashAthlete
  status: AvailabilityStatus | null
  note: string | null
}

/** Monitoring → Availability (§5.2): roster status, filterable by position,
 *  with coach editing through the AvailabilityRepository seam. */
export function MonitoringAvailabilityPage() {
  const { status, error, dataset, selectedDate, setAvailability } = useDashboardData()

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
    <AvailabilityRoster
      dataset={dataset}
      date={selectedDate}
      onSave={(athleteId, statusValue, note) =>
        setAvailability({
          athleteId,
          date: selectedDate,
          status: statusValue,
          ...(note.trim() === '' ? {} : { note: note.trim() }),
        })
      }
    />
  )
}

function AvailabilityRoster({
  dataset,
  date,
  onSave,
}: {
  dataset: DashboardDataset
  date: string
  onSave: (athleteId: string, status: AvailabilityStatus, note: string) => void
}) {
  const [position, setPosition] = useState<string | null>(null)
  const [editing, setEditing] = useState<RosterRow | null>(null)

  const view = useMemo(() => availabilityView(dataset, date, position), [dataset, date, position])
  const rows = useMemo<RosterRow[]>(
    () =>
      dataset.athletes
        .filter((a) => position === null || a.position === position)
        .map((athlete) => {
          const entry = dataset.availabilityByKey.get(`${athlete.id}|${date}`)
          return { athlete, status: entry?.status ?? null, note: entry?.note ?? null }
        }),
    [dataset, date, position],
  )

  const columns = useMemo<Column<RosterRow>[]>(
    () => [
      {
        key: 'athlete',
        header: 'Athlete',
        sortValue: (r) => r.athlete.fullName,
        render: (r) => <span className="font-medium">{r.athlete.fullName}</span>,
      },
      {
        key: 'position',
        header: 'Position',
        sortValue: (r) => r.athlete.position,
        render: (r) => <span className="text-secondary">{r.athlete.position}</span>,
      },
      {
        key: 'status',
        header: 'Status',
        sortValue: (r) => r.status ?? 'zz', // no-entry sorts last
        render: (r) => <AvailabilityBadge status={r.status} />,
      },
      {
        key: 'note',
        header: 'Note',
        render: (r) =>
          r.note ? (
            <span className="text-secondary">{r.note}</span>
          ) : (
            <span className="text-muted">—</span>
          ),
      },
      {
        key: 'edit',
        header: '',
        render: () => <span className="text-label text-accent underline decoration-dotted">edit</span>,
      },
    ],
    [],
  )

  return (
    <div className="flex flex-col gap-4">
      <FilterBar>
        <SeasonSelector seasonLabel={dataset.seasonLabel} />
        <PositionSelector value={position} onChange={setPosition} />
        <span className="ml-auto text-label text-muted">
          effective {formatDayLabel(date)} — pick another date in the top bar
        </span>
      </FilterBar>

      <section className="rounded-card border border-subtle bg-surface p-5">
        <div className="mb-3 flex items-center gap-2">
          <UsersRound aria-hidden className="size-5 text-secondary" strokeWidth={1.75} />
          <h2 className="text-subhead font-semibold">
            {view.counts.full_go}/{view.totalActive} Full Go
          </h2>
          {view.noEntry > 0 && <Badge tone="neutral">{view.noEntry} without an entry</Badge>}
        </div>
        <DistributionBar
          segments={STATUS_META.map((s) => ({
            key: s.key,
            label: s.label,
            count: view.counts[s.key],
            color: s.color,
          }))}
        />
      </section>

      <DataTable columns={columns} rows={rows} rowKey={(r) => r.athlete.id} onRowClick={setEditing} />

      {editing && (
        <AvailabilityEditor
          row={editing}
          date={date}
          onClose={() => setEditing(null)}
          onSave={(statusValue, note) => {
            onSave(editing.athlete.id, statusValue, note)
            setEditing(null)
          }}
        />
      )}
    </div>
  )
}

function AvailabilityEditor({
  row,
  date,
  onClose,
  onSave,
}: {
  row: RosterRow
  date: string
  onClose: () => void
  onSave: (status: AvailabilityStatus, note: string) => void
}) {
  const [statusValue, setStatusValue] = useState<AvailabilityStatus>(row.status ?? 'full_go')
  const [note, setNote] = useState(row.note ?? '')

  return (
    <Drawer title={`${row.athlete.fullName} — ${formatDayLabel(date)}`} onClose={onClose}>
      <div className="flex flex-col gap-4">
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1 text-label font-medium text-secondary">Status</legend>
          {STATUS_META.map((s) => (
            <label
              key={s.key}
              className="flex cursor-pointer items-center gap-2 rounded-control border border-subtle px-3 py-2 hover:bg-surface-2"
            >
              <input
                type="radio"
                name="availability-status"
                value={s.key}
                checked={statusValue === s.key}
                onChange={() => setStatusValue(s.key)}
                className="accent-(--accent)"
              />
              <AvailabilityBadge status={s.key} />
            </label>
          ))}
        </fieldset>

        <label className="flex flex-col gap-1 text-label text-secondary">
          Operational note (optional)
          <input
            type="text"
            value={note}
            maxLength={80}
            onChange={(e) => setNote(e.target.value)}
            placeholder="e.g. Lift only"
            className="h-9 rounded-control border border-subtle bg-surface-2 px-2 text-body text-primary focus:border-accent"
          />
        </label>
        <p className="text-label text-muted">
          Short operational notes only — do not enter diagnoses, treatment details, or other
          medical information (§7.2).
        </p>

        <div className="flex gap-2">
          <Button onClick={() => onSave(statusValue, note)}>Save status</Button>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
        </div>
        <p className="text-label text-muted">
          Saved locally in this build; on the production backend this becomes an audited
          availability update.
        </p>
      </div>
    </Drawer>
  )
}
