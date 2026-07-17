import { Compass, Hourglass } from 'lucide-react'
import { Outlet, Link } from 'react-router'
import { Badge } from '../components/ui/Badge.tsx'
import { Button } from '../components/ui/Button.tsx'
import { EmptyState } from '../components/ui/EmptyState.tsx'
import { GPS_SUB_TABS, type NavSection } from './nav.ts'
import { SubTabs } from './SubTabs.tsx'

/** Section wrapper: page title + horizontal sub-tab row + routed pane (§5). */
export function SectionPage({ section }: { section: NavSection }) {
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-title font-bold">{section.label}</h1>
      <SubTabs tabs={section.subTabs} ariaLabel={`${section.label} sub-sections`} />
      <Outlet />
    </div>
  )
}

/** Placeholder for panes scheduled in later Step-5 milestones. */
export function PlaceholderPane({ title, description }: { title: string; description: string }) {
  return (
    <EmptyState
      icon={Hourglass}
      title={title}
      message={description}
      action={<Badge tone="neutral">Scheduled in a later Step-5 milestone</Badge>}
    />
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

/** Admin pages: plain title + placeholder (no sub-tab row yet). */
export function AdminPage({ title, description }: { title: string; description: string }) {
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-title font-bold">{title}</h1>
      <PlaceholderPane title={title} description={description} />
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
