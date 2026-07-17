import type { ComponentType } from 'react'
import { EmptyState } from '../../components/ui/EmptyState.tsx'
import { ErrorState } from '../../components/ui/ErrorState.tsx'
import { Skeleton } from '../../components/ui/Skeleton.tsx'
import { LayoutDashboard } from 'lucide-react'
import { useDashboardData } from '../../lib/dashboard/DashboardDataContext.tsx'
import { orderByConfig } from '../../lib/settings/defaults.ts'
import { useSettings } from '../../lib/settings/SettingsContext.tsx'
import type { DashboardDataset } from '../../lib/dashboard/types.ts'
import { AvailabilityTile } from './tiles/AvailabilityTile.tsx'
import { FlagsTile } from './tiles/FlagsTile.tsx'
import { LastSessionTile } from './tiles/LastSessionTile.tsx'
import { LoadHealthTile } from './tiles/LoadHealthTile.tsx'
import { ScChangeTile } from './tiles/ScChangeTile.tsx'
import { OVERVIEW_PAGE_ID, OVERVIEW_WIDGETS } from './widgets.ts'

type TileProps = { dataset: DashboardDataset; date: string }

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

  return (
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
  )
}
