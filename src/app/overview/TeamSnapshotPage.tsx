import { type ComponentType, useState } from 'react'
import {
  Database,
  Dumbbell,
  Flag,
  Gauge,
  HeartPulse,
  LayoutDashboard,
  RotateCcw,
  Satellite,
  SlidersHorizontal,
  UsersRound,
  type LucideIcon,
} from 'lucide-react'
import { Button } from '../../components/ui/Button.tsx'
import { Drawer } from '../../components/ui/Drawer.tsx'
import { EmptyState } from '../../components/ui/EmptyState.tsx'
import { ErrorState } from '../../components/ui/ErrorState.tsx'
import { SectionHeader } from '../../components/ui/KpiCard.tsx'
import { Skeleton } from '../../components/ui/Skeleton.tsx'
import { useDashboardData } from '../../lib/dashboard/DashboardDataContext.tsx'
import {
  DEFAULT_OVERVIEW_GPS_METRICS,
  OVERVIEW_GPS_SUPPORTED,
  orderByConfig,
} from '../../lib/settings/defaults.ts'
import { useSettings } from '../../lib/settings/SettingsContext.tsx'
import type { DashboardDataset } from '../../lib/dashboard/types.ts'
import { SnapshotTile } from './SnapshotTile.tsx'
import { snapshotSummaries } from './snapshot.ts'
import { AvailabilityDetail } from './tiles/AvailabilityDetail.tsx'
import { DataCompletenessDetail } from './tiles/DataCompletenessDetail.tsx'
import { FlagsDetail } from './tiles/FlagsDetail.tsx'
import { LastSessionGpsDetail } from './tiles/LastSessionGpsDetail.tsx'
import { LoadHealthDetail } from './tiles/LoadHealthDetail.tsx'
import { ScChangeDetail } from './tiles/ScChangeDetail.tsx'
import { WorkloadDetail } from './tiles/WorkloadDetail.tsx'
import { OVERVIEW_PAGE_ID, OVERVIEW_WIDGETS } from './widgets.ts'

type DetailProps = { dataset: DashboardDataset; date: string }

/** Each tile: its icon, drawer title, and drill-down detail component (§4). */
const TILE_META: Record<string, { icon: LucideIcon; title: string; Detail: ComponentType<DetailProps> }> = {
  availability: { icon: UsersRound, title: 'Availability', Detail: AvailabilityDetail },
  workload: { icon: Gauge, title: 'Workload', Detail: WorkloadDetail },
  load_health: { icon: HeartPulse, title: 'Load Health', Detail: LoadHealthDetail },
  speed_flags: { icon: Flag, title: 'Speed Flags', Detail: FlagsDetail },
  last_session_gps: { icon: Satellite, title: 'Last Session GPS', Detail: LastSessionGpsDetail },
  sc_change: { icon: Dumbbell, title: 'S&C Change', Detail: ScChangeDetail },
  data_completeness: { icon: Database, title: 'Data Completeness', Detail: DataCompletenessDetail },
}

/** Team Snapshot → Customize: which GPS metrics feed the Last Session GPS tile
 *  and its drawer. One page-level control, hidden during normal viewing (§13). */
function CustomizeDrawer({ dataset, onClose }: { dataset: DashboardDataset; onClose: () => void }) {
  const { settings, updateDisplay } = useSettings()
  const selected =
    settings.display.overviewGpsMetrics.length > 0
      ? settings.display.overviewGpsMetrics
      : DEFAULT_OVERVIEW_GPS_METRICS
  const supported = OVERVIEW_GPS_SUPPORTED.filter((k) => dataset.kpis.has(k))

  const toggle = (key: string, on: boolean) => {
    const next = OVERVIEW_GPS_SUPPORTED.filter((k) => (k === key ? on : selected.includes(k)))
    if (next.length === 0) return // keep at least one metric visible
    updateDisplay({ overviewGpsMetrics: next })
  }

  return (
    <Drawer title="Customize Team Snapshot" onClose={onClose}>
      <div className="flex flex-col gap-4">
        <div>
          <p className="text-body font-medium">Last Session GPS metrics</p>
          <p className="text-label text-muted">Averages per participating athlete.</p>
        </div>
        <fieldset className="flex flex-col gap-1">
          {supported.map((key) => {
            const kpi = dataset.kpis.get(key)!
            const on = selected.includes(key)
            return (
              <label
                key={key}
                className="flex items-center gap-2 rounded-control px-2 py-1 text-body hover:bg-surface-2"
              >
                <input
                  type="checkbox"
                  checked={on}
                  onChange={(e) => toggle(key, e.target.checked)}
                  className="accent-(--accent)"
                />
                {kpi.displayName}
              </label>
            )
          })}
        </fieldset>
        <Button
          variant="secondary"
          onClick={() => updateDisplay({ overviewGpsMetrics: [] })}
        >
          <RotateCcw aria-hidden className="size-4" />
          Reset to default
        </Button>
        <p className="text-label text-muted">
          Tile show/hide and ordering live in Admin → Data Management.
        </p>
      </div>
    </Drawer>
  )
}

/** Overview → Team Snapshot (§4): a clean grid of clickable summary tiles.
 *  Every tile opens a drill-down drawer; the page carries no tables or charts
 *  itself. Show/hide + order honor the layout config. */
export function TeamSnapshotPage() {
  const { status, error, dataset, selectedDate } = useDashboardData()
  const { settings } = useSettings()
  const [customizeOpen, setCustomizeOpen] = useState(false)
  const [openTile, setOpenTile] = useState<string | null>(null)

  if (status === 'loading') {
    return (
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }, (_, i) => (
          <Skeleton key={i} className="h-32 w-full" />
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

  const hidden = new Set(settings.layout.hiddenWidgets)
  const visible = orderByConfig(
    OVERVIEW_WIDGETS,
    (w) => w.id,
    settings.layout.widgetOrder[OVERVIEW_PAGE_ID] ?? [],
  ).filter((w) => !hidden.has(w.id) && TILE_META[w.id])

  if (visible.length === 0) {
    return (
      <EmptyState
        icon={LayoutDashboard}
        title="All tiles hidden"
        message="Every Team Snapshot tile is hidden — re-enable them in Admin → Data Management."
      />
    )
  }

  const summaries = snapshotSummaries(dataset, selectedDate, settings)
  const active = openTile ? TILE_META[openTile] : null
  const ActiveDetail = active?.Detail

  return (
    <div className="flex flex-col gap-3">
      <SectionHeader title="Team Snapshot">
        <button
          type="button"
          onClick={() => setCustomizeOpen(true)}
          className="ml-auto inline-flex h-9 items-center gap-2 rounded-control border border-subtle px-3 text-label font-medium text-secondary hover:border-strong hover:text-primary"
        >
          <SlidersHorizontal aria-hidden className="size-4" />
          Customize
        </button>
      </SectionHeader>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {visible.map((widget) => {
          const meta = TILE_META[widget.id]!
          const summary = summaries[widget.id]
          if (!summary) return null
          return (
            <SnapshotTile
              key={widget.id}
              icon={meta.icon}
              summary={summary}
              onOpen={() => setOpenTile(widget.id)}
            />
          )
        })}
      </div>

      {active && ActiveDetail && (
        <Drawer title={active.title} onClose={() => setOpenTile(null)}>
          <ActiveDetail dataset={dataset} date={selectedDate} />
        </Drawer>
      )}

      {customizeOpen && (
        <CustomizeDrawer dataset={dataset} onClose={() => setCustomizeOpen(false)} />
      )}
    </div>
  )
}
