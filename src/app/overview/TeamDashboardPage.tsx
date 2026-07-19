import { type ComponentType, useState } from 'react'
import { Button } from '../../components/ui/Button.tsx'
import { Drawer } from '../../components/ui/Drawer.tsx'
import { EmptyState } from '../../components/ui/EmptyState.tsx'
import { ErrorState } from '../../components/ui/ErrorState.tsx'
import { KpiCard, KpiStrip, SectionHeader } from '../../components/ui/KpiCard.tsx'
import { Skeleton } from '../../components/ui/Skeleton.tsx'
import { LayoutDashboard, RotateCcw, SlidersHorizontal } from 'lucide-react'
import { useDashboardData } from '../../lib/dashboard/DashboardDataContext.tsx'
import { overviewKpiStrip } from '../../lib/dashboard/selectors/overview-kpis.ts'
import {
  DEFAULT_OVERVIEW_GPS_METRICS,
  OVERVIEW_GPS_SUPPORTED,
  orderByConfig,
} from '../../lib/settings/defaults.ts'
import { useSettings } from '../../lib/settings/SettingsContext.tsx'
import type { DashboardDataset } from '../../lib/dashboard/types.ts'
import { AvailabilityTile } from './tiles/AvailabilityTile.tsx'
import { FlagsTile } from './tiles/FlagsTile.tsx'
import { LastSessionTile } from './tiles/LastSessionTile.tsx'
import { LoadHealthTile } from './tiles/LoadHealthTile.tsx'
import { ScChangeTile } from './tiles/ScChangeTile.tsx'
import { OVERVIEW_PAGE_ID, OVERVIEW_WIDGETS } from './widgets.ts'

type TileProps = { dataset: DashboardDataset; date: string }

/** Team Dashboard → Customize: which GPS metrics the Last Session tile shows.
 *  One page-level control, secondary to normal viewing (coach-feedback). */
function CustomizeDrawer({ dataset, onClose }: { dataset: DashboardDataset; onClose: () => void }) {
  const { settings, updateDisplay } = useSettings()
  const selected =
    settings.display.overviewGpsMetrics.length > 0
      ? settings.display.overviewGpsMetrics
      : DEFAULT_OVERVIEW_GPS_METRICS
  const supported = OVERVIEW_GPS_SUPPORTED.filter((k) => dataset.kpis.has(k))

  const toggle = (key: string, on: boolean) => {
    const next = OVERVIEW_GPS_SUPPORTED.filter((k) =>
      k === key ? on : selected.includes(k),
    )
    if (next.length === 0) return // keep at least one metric visible
    updateDisplay({ overviewGpsMetrics: next })
  }

  return (
    <Drawer title="Customize Team Dashboard" onClose={onClose}>
      <div className="flex flex-col gap-4">
        <div>
          <p className="text-body font-medium">Last Session GPS metrics</p>
          <p className="text-label text-muted">
            Choose which GPS metrics appear on the tile. Values are averages per participating
            athlete.
          </p>
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
        <div>
          <Button variant="secondary" onClick={() => updateDisplay({ overviewGpsMetrics: [] })}>
            <RotateCcw aria-hidden className="size-4" />
            Reset to default
          </Button>
        </div>
        <p className="text-label text-muted">
          Widget show/hide and ordering for the whole dashboard live in Admin → Data Management.
        </p>
      </div>
    </Drawer>
  )
}

const TILE_COMPONENTS: Record<string, ComponentType<TileProps>> = {
  availability: AvailabilityTile,
  last_session_gps: LastSessionTile,
  load_health: LoadHealthTile,
  sc_change: ScChangeTile,
  athlete_flags: FlagsTile,
}

/** Overview → Team Dashboard (§5.1): the whiteboard tile grid, honoring the
 *  coach's show/hide + order layout config (§5.5). */
export function TeamDashboardPage() {
  const { status, error, dataset, selectedDate } = useDashboardData()
  const { settings } = useSettings()
  const [customizeOpen, setCustomizeOpen] = useState(false)

  if (status === 'loading') {
    return (
      <div className="grid gap-4 md:grid-cols-2">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-64 w-full" />
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
  ).filter((w) => !hidden.has(w.id))

  if (visible.length === 0) {
    return (
      <EmptyState
        icon={LayoutDashboard}
        title="All widgets hidden"
        message="Every Team Dashboard widget is hidden — re-enable them in Admin → Data Management."
      />
    )
  }

  // Consecutive half-width tiles pack into two independently-stacking columns
  // (no row-aligned gaps, visual-review #2); full-width tiles break the flow.
  const segments: { fullWidth: boolean; ids: string[] }[] = []
  for (const widget of visible) {
    const last = segments[segments.length - 1]
    if (widget.fullWidth || !last || last.fullWidth) {
      segments.push({ fullWidth: widget.fullWidth ?? false, ids: [widget.id] })
    } else {
      last.ids.push(widget.id)
    }
  }

  const renderTile = (id: string) => {
    const Tile = TILE_COMPONENTS[id]
    return Tile ? <Tile key={id} dataset={dataset} date={selectedDate} /> : null
  }

  const kpis = overviewKpiStrip(dataset, selectedDate, settings.thresholds)

  return (
    <div className="flex flex-col gap-6">
      <section aria-label="Team snapshot" className="flex flex-col gap-3">
        <SectionHeader title="Team Snapshot">
          <button
            type="button"
            onClick={() => setCustomizeOpen(true)}
            className="inline-flex h-9 items-center gap-2 rounded-control border border-subtle px-3 text-label font-medium text-secondary hover:border-strong hover:text-primary"
          >
            <SlidersHorizontal aria-hidden className="size-4" />
            Customize
          </button>
        </SectionHeader>
        <KpiStrip>
          {kpis.map((k) => (
            <KpiCard
              key={k.id}
              label={k.label}
              value={k.value}
              unit={k.unit}
              sub={k.sub}
              note={k.note}
              accent={k.accent}
            />
          ))}
        </KpiStrip>
      </section>

      <div className="flex flex-col gap-4">
      {segments.map((segment, i) =>
        segment.fullWidth ? (
          segment.ids.map(renderTile)
        ) : (
          <div key={i} className="grid items-start gap-4 md:grid-cols-2">
            <div className="flex min-w-0 flex-col gap-4">
              {segment.ids.filter((_, j) => j % 2 === 0).map(renderTile)}
            </div>
            <div className="flex min-w-0 flex-col gap-4">
              {segment.ids.filter((_, j) => j % 2 === 1).map(renderTile)}
            </div>
          </div>
        ),
      )}
      </div>
      {customizeOpen && (
        <CustomizeDrawer dataset={dataset} onClose={() => setCustomizeOpen(false)} />
      )}
    </div>
  )
}
