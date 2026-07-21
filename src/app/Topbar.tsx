import { CalendarDays, Upload, Users } from 'lucide-react'
import { useMemo } from 'react'
import { useLocation, useNavigate } from 'react-router'
import { useDashboardData } from '../lib/dashboard/DashboardDataContext.tsx'
import { formatDayLabel as formatDate, sessionTypeSummary } from '../lib/dashboard/format.ts'
import { Badge } from '../components/ui/Badge.tsx'
import { Button } from '../components/ui/Button.tsx'
import { ADMIN_ITEMS, matchNavPage } from './nav.ts'

/** Current page title from the route — the product area, or an admin page. */
function usePageTitle(): string {
  const { pathname } = useLocation()
  const match = matchNavPage(pathname)
  if (match) return match.area.label
  const admin = ADMIN_ITEMS.find((a) => pathname.startsWith(a.path))
  return admin?.label ?? 'Performance Dashboard'
}

/**
 * Page-control bar (§ visual redesign B): current page title on the left; the
 * few global controls that matter — athlete count, session/date, Import Data —
 * on the right. Branded chrome (env badge, sign-out, mobile nav) lives in the
 * masthead above; secondary/page actions live in page-level Customize drawers.
 */
export function Topbar() {
  const { status, dataset, selectedDate, setSelectedDate } = useDashboardData()
  const navigate = useNavigate()
  const title = usePageTitle()
  const athletes = dataset?.athletes ?? []
  const sessionDates = useMemo(() => [...(dataset?.sessionsByDate.keys() ?? [])], [dataset])

  return (
    <header className="sticky top-16 z-40 flex h-14 shrink-0 items-center gap-3 border-b border-subtle bg-base/95 px-5 backdrop-blur md:px-6">
      {/* the title keeps its space; the controls compress instead */}
      <h1 className="display shrink-0 text-xl font-bold tracking-wide text-primary uppercase">
        {title}
      </h1>

      <div className="ml-auto flex min-w-0 items-center gap-2 sm:gap-3">
        <Badge tone="neutral">
          <Users aria-hidden className="size-3.5" />
          <span className="tabular">{status === 'ready' ? athletes.length : '—'}</span>
          <span className="hidden sm:inline">athletes</span>
        </Badge>

        <div className="hidden items-center gap-2 sm:flex">
          <CalendarDays aria-hidden className="size-4 text-muted" strokeWidth={1.75} />
          {status === 'ready' && selectedDate ? (
            <label className="flex items-center gap-2">
              <span className="sr-only">Session date</span>
              <select
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="h-9 max-w-[12rem] min-w-0 truncate rounded-control border border-subtle bg-input px-2 text-body text-primary focus:border-accent lg:max-w-none"
              >
                {sessionDates.map((date) => {
                  const summary = sessionTypeSummary(dataset?.sessionsByDate.get(date) ?? [])
                  return (
                    <option key={date} value={date}>
                      {formatDate(date)}
                      {summary ? ` · ${summary}` : ''}
                    </option>
                  )
                })}
              </select>
            </label>
          ) : (
            <span className="text-label text-muted">
              {status === 'loading' ? 'Loading…' : 'No dataset'}
            </span>
          )}
        </div>

        <Button
          variant="primary"
          onClick={() => navigate('/admin/import')}
          aria-label="Import Data"
          title="Import Data"
          className="lg:px-4 max-lg:w-9 max-lg:px-0"
        >
          <Upload aria-hidden className="size-4" />
          <span className="hidden lg:inline">Import Data</span>
        </Button>
      </div>
    </header>
  )
}
