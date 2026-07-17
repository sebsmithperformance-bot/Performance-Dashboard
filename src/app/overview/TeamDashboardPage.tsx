import { ErrorState } from '../../components/ui/ErrorState.tsx'
import { Skeleton } from '../../components/ui/Skeleton.tsx'
import { useDashboardData } from '../../lib/dashboard/DashboardDataContext.tsx'
import { AvailabilityTile } from './tiles/AvailabilityTile.tsx'
import { FlagsTile } from './tiles/FlagsTile.tsx'
import { LastSessionTile } from './tiles/LastSessionTile.tsx'
import { LoadHealthTile } from './tiles/LoadHealthTile.tsx'
import { ScChangeTile } from './tiles/ScChangeTile.tsx'

/** Overview → Team Dashboard (§5.1): the whiteboard tile grid. */
export function TeamDashboardPage() {
  const { status, error, dataset, selectedDate } = useDashboardData()

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

  return (
    // Two independently-stacking columns: unequal tile heights pack tightly
    // instead of leaving row-aligned gaps (visual-review finding #2).
    <div className="grid items-start gap-4 md:grid-cols-2">
      <div className="flex min-w-0 flex-col gap-4">
        <AvailabilityTile dataset={dataset} date={selectedDate} />
        <LoadHealthTile dataset={dataset} date={selectedDate} />
      </div>
      <div className="flex min-w-0 flex-col gap-4">
        <LastSessionTile dataset={dataset} date={selectedDate} />
        <ScChangeTile dataset={dataset} date={selectedDate} />
      </div>
      <div className="md:col-span-2">
        <FlagsTile dataset={dataset} date={selectedDate} />
      </div>
    </div>
  )
}
