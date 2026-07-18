import { Compass } from 'lucide-react'
import { Outlet, Link } from 'react-router'
import { Button } from '../components/ui/Button.tsx'
import { EmptyState } from '../components/ui/EmptyState.tsx'
import { GPS_SUB_TABS, type NavSection } from './nav.ts'
import { SubTabs } from './SubTabs.tsx'

/** Section wrapper: page title + routed pane (§5). Secondary navigation lives
 *  in the sidebar (subcategories under the active section) — not duplicated as
 *  a content-area tab row. Deeper levels (e.g. Monitoring → GPS) keep their own
 *  inner tab row where a third level exists. */
export function SectionPage({ section }: { section: NavSection }) {
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-title font-bold">{section.label}</h1>
      <Outlet />
    </div>
  )
}

/** Monitoring → GPS: its own inner sub-tab row (§5.2). */
export function GpsPage() {
  return (
    <div className="flex flex-col gap-4">
      <SubTabs tabs={GPS_SUB_TABS} ariaLabel="GPS views" />
      <Outlet />
    </div>
  )
}

export function NotFoundPage() {
  return (
    <EmptyState
      icon={Compass}
      title="Page not found"
      message="This route doesn't exist. The four coach-facing sections live in the sidebar."
      action={
        <Link to="/overview">
          <Button variant="secondary">Go to Overview</Button>
        </Link>
      }
    />
  )
}
