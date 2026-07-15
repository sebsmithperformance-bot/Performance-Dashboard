import { CalendarDays, Compass, FileQuestion, Hourglass } from 'lucide-react'
import { Outlet, Link } from 'react-router'
import { Badge } from '../components/ui/Badge.tsx'
import { Button } from '../components/ui/Button.tsx'
import { EmptyState } from '../components/ui/EmptyState.tsx'
import { Panel } from '../components/ui/Panel.tsx'
import { Skeleton } from '../components/ui/Skeleton.tsx'
import { useDevData } from '../lib/data/dev-dataset.tsx'
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

/**
 * Placeholder pane for coach-facing modules that are gated on the §2.1
 * backend spike (Build Order step 5) — states what will live here and why
 * it is empty, per the §12.5 empty-state rule.
 */
export function PlaceholderPane({ title, description }: { title: string; description: string }) {
  return (
    <EmptyState
      icon={Hourglass}
      title={title}
      message={description}
      action={<Badge tone="warning">Gated on backend spike — ADR-001</Badge>}
    />
  )
}

const SESSION_TYPE_TONE: Record<string, 'good' | 'warning' | 'danger' | 'neutral' | 'brand'> = {
  game: 'danger',
  practice: 'brand',
  lift: 'neutral',
  recovery: 'good',
}

/**
 * Overview → Team Dashboard. The real §5.1 tile grid (Availability, Last
 * Session GPS, Load Health, S&C % Change, Athlete Flags) is gated on the
 * spike; this pane proves the shell's session/date context works against the
 * local synthetic dataset.
 */
export function OverviewTeamDashboard() {
  const { status, selectedDate, sessionsOnSelectedDate, athletes } = useDevData()

  if (status === 'loading') {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    )
  }

  if (status === 'absent') {
    return (
      <EmptyState
        icon={FileQuestion}
        title="No synthetic dataset found"
        message="Local development runs on generated data only. Generate the demo season, then reload."
        action={<code className="text-label text-secondary">npm run seed:generate</code>}
      />
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <Panel
        icon={CalendarDays}
        title={`Selected day — ${selectedDate ?? ''}`}
        keyValue={`${sessionsOnSelectedDate.length} sessions`}
      >
        {sessionsOnSelectedDate.length === 0 ? (
          <p className="text-body text-secondary">
            Confirmed rest day — no sessions scheduled. (Distinct from missing data, §6.7.)
          </p>
        ) : (
          <ul className="flex flex-col divide-y divide-subtle">
            {sessionsOnSelectedDate.map((s) => (
              <li key={s.id} className="flex min-h-10 items-center gap-3 py-2">
                <span className="tabular w-12 shrink-0 text-label text-muted">{s.startTime}</span>
                <span className="text-body font-medium">{s.label}</span>
                <span className="ml-auto">
                  <Badge tone={SESSION_TYPE_TONE[s.type] ?? 'neutral'}>{s.type}</Badge>
                </span>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-3 text-label text-muted">
          {athletes.length} athletes on the active roster · synthetic data, local mode
        </p>
      </Panel>

      <PlaceholderPane
        title="Team Dashboard tiles"
        description="Availability, Last Session GPS, Load Health, S&C % Change, and Athlete Flags tiles land here once the backend path is proven (§5.1)."
      />
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
