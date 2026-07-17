import { Compass } from 'lucide-react'
import { Outlet, Link } from 'react-router'
import { Button } from '../components/ui/Button.tsx'
import { EmptyState } from '../components/ui/EmptyState.tsx'
import { orderByConfig } from '../lib/settings/defaults.ts'
import { useSettings } from '../lib/settings/SettingsContext.tsx'
import { GPS_SUB_TABS, type NavSection } from './nav.ts'
import { SubTabs } from './SubTabs.tsx'

/** Section wrapper: page title + horizontal sub-tab row + routed pane (§5).
 *  Sub-tab order honors the coach's layout config (§5.5). */
export function SectionPage({ section }: { section: NavSection }) {
  const { settings } = useSettings()
  const tabs = orderByConfig(
    section.subTabs,
    (t) => t.path,
    settings.layout.subTabOrder[section.base] ?? [],
  )
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-title font-bold">{section.label}</h1>
      <SubTabs tabs={tabs} ariaLabel={`${section.label} sub-sections`} />
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
