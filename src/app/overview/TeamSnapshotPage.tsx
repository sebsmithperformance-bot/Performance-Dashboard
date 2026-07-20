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
import { LoadHealthTile } from './tiles/LoadHealthTile.tsx'
import { ScChangeTile } from './tiles/ScChangeTile.tsx'
import { OVERVIEW_PAGE_ID, OVERVIEW_WIDGETS } from './widgets.ts'

type TileProps = { dataset: DashboardDataset; date: string }

/** Team Dashboard → Customize: which GPS metrics the Team Snapshot strip shows
 *  and how dense the cards are. One page-level control, secondary to normal
 *  viewing (coach-feedback). */
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
          <p className="text-body font-medium">Card size</p>
          <p className="text-label text-muted">Compact fits more per row; wide gives each card room.</p>
        </div>
        <div role="group" aria-label="Card size" className="flex gap-2">
          {(['compact', 'wide'] as const).map((s) => (
            <button
              key={s}
              type="button"
              aria-pressed={settings.display.kpiCardSize === s}
              onClick={() => updateDisplay({ kpiCardSize: s })}
              className={`h-9 flex-1 rounded-control border px-3 text-label font-medium capitalize ${
                settings.display.kpiCardSize === s
                  ? 'border-accent bg-accent/15 text-primary'
                  : 'border-subtle text-secondary hover:border-strong hover:text-primary'
              }`}
            >
              {s}
            </button>
          ))}
        </div>

        <div>
          <p className="text-body font-medium">Team Snapshot GPS metrics</p>
          <p className="text-label text-muted">
            Averages per participating athlete from the latest session.
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
          <Button
            variant="secondary"
            onClick={() => updateDisplay({ overviewGpsMetrics: [], kpiCardSize: 'compact' })}
          >
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
  load_health: LoadHealthTile,
  sc_change: ScChangeTile,
  athlete_flags: FlagsTile,
}

/** Overview → Team Dashboard (§5.1): the whiteboard tile grid, honoring the
 *  coach's show/hide + order layout config (§5.5). */
export function TeamSnapshotPage() {
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

  const size = settings.display.kpiCardSize
  const strip = overviewKpiStrip(
    dataset,
    selectedDate,
    settings.thresholds,
    settings.display.overviewGpsMetrics,
  )

  return (
    <div className="flex flex-col gap-6">
      <section aria-label="Team snapshot" className="flex flex-col gap-3">
        <SectionHeader title="Team Snapshot">
          {strip.sessionCaption && (
            <span className="mr-auto text-label text-muted">{strip.sessionCaption}</span>
          )}
          <button
            type="button"
            onClick={() => setCustomizeOpen(true)}
            className="inline-flex h-9 items-center gap-2 rounded-control border border-subtle px-3 text-label font-medium text-secondary hover:border-strong hover:text-primary"
          >
            <SlidersHorizontal aria-hidden className="size-4" />
            Customize
          </button>
        </SectionHeader>
        <KpiStrip size={size}>
          {strip.cards.map((k) => (
            <KpiCard
              key={k.id}
              label={k.label}
              value={k.value}
              unit={k.unit}
              sub={k.sub}
              note={k.note}
              accent={k.accent}
              size={size}
            />
          ))}
        </KpiStrip>
      </section>

      {/* Even two-column grid: each row's panels stretch to the same height, so
          there is no ragged blank space between them. */}
      <div className="grid gap-4 md:grid-cols-2">
        {visible.map((widget) => {
          const Tile = TILE_COMPONENTS[widget.id]
          return Tile ? (
            <div
              key={widget.id}
              className="flex min-w-0 [&>section]:h-full [&>section]:w-full"
            >
              <Tile dataset={dataset} date={selectedDate} />
            </div>
          ) : null
        })}
      </div>
      {customizeOpen && (
        <CustomizeDrawer dataset={dataset} onClose={() => setCustomizeOpen(false)} />
      )}
    </div>
  )
}
