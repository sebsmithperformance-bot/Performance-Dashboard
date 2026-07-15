import { CalendarDays, LogOut, Menu, Upload, Users } from 'lucide-react'
import { useNavigate } from 'react-router'
import { useAuth } from '../lib/auth/AuthContext.tsx'
import { useDevData } from '../lib/data/dev-dataset.tsx'
import { Badge } from '../components/ui/Badge.tsx'
import { Button } from '../components/ui/Button.tsx'

const APP_ENV: string = import.meta.env.VITE_APP_ENV ?? 'local'

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${iso}T00:00:00Z`))
}

/**
 * Top bar (§5): athlete-count badge, session/date context + picker, Import
 * Data action, and an unmissable environment badge (Environments: "a
 * deployment must clearly display its environment").
 */
export function Topbar({ onOpenDrawer }: { onOpenDrawer: () => void }) {
  const { identity, signOut } = useAuth()
  const { status, athletes, seasonLabel, sessionDates, selectedDate, setSelectedDate } =
    useDevData()
  const navigate = useNavigate()

  return (
    <header className="sticky top-0 z-40 flex h-16 shrink-0 items-center gap-3 border-b border-subtle bg-base/95 px-4 backdrop-blur md:px-6">
      <button
        type="button"
        onClick={onOpenDrawer}
        aria-label="Open navigation"
        className="flex size-10 items-center justify-center rounded-control text-secondary hover:bg-surface-2 hover:text-primary md:hidden"
      >
        <Menu aria-hidden className="size-5" />
      </button>

      <Badge tone="neutral">
        <Users aria-hidden className="size-3.5" />
        <span className="tabular">{status === 'ready' ? athletes.length : '—'}</span> athletes
      </Badge>

      <div className="hidden items-center gap-2 sm:flex">
        <CalendarDays aria-hidden className="size-4 text-muted" strokeWidth={1.75} />
        {status === 'ready' && selectedDate ? (
          <label className="flex items-center gap-2">
            <span className="sr-only">Session date</span>
            <select
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="h-9 rounded-control border border-subtle bg-surface-2 px-2 text-body text-primary focus:border-accent"
            >
              {sessionDates.map((date) => (
                <option key={date} value={date}>
                  {formatDate(date)}
                </option>
              ))}
            </select>
          </label>
        ) : (
          <span className="text-label text-muted">
            {status === 'loading' ? 'Loading dates…' : 'No dataset'}
          </span>
        )}
        {seasonLabel && (
          <span className="hidden text-label text-muted lg:inline">{seasonLabel}</span>
        )}
      </div>

      <div className="ml-auto flex items-center gap-3">
        <Badge tone="warning">
          {APP_ENV.toUpperCase()} · {APP_ENV === 'production' ? 'REAL DATA' : 'SYNTHETIC'}
        </Badge>
        <Button
          variant="primary"
          onClick={() => navigate('/admin/import')}
          className="hidden sm:inline-flex"
        >
          <Upload aria-hidden className="size-4" />
          Import Data
        </Button>
        <span className="hidden text-body text-secondary lg:inline">{identity?.displayName}</span>
        <button
          type="button"
          onClick={signOut}
          aria-label="Sign out"
          title="Sign out"
          className="flex size-10 items-center justify-center rounded-control text-secondary hover:bg-surface-2 hover:text-primary"
        >
          <LogOut aria-hidden className="size-5" strokeWidth={1.75} />
        </button>
      </div>
    </header>
  )
}
