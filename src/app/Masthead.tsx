import { LogOut, Menu } from 'lucide-react'
import { useAuth } from '../lib/auth/AuthContext.tsx'
import { Badge } from '../components/ui/Badge.tsx'
import { AreaTabs } from './AreaTabs.tsx'

const APP_ENV: string = import.meta.env.VITE_APP_ENV ?? 'local'

/**
 * Branded masthead (§ visual redesign A): Penn Navy anchor with a thin crimson
 * divider and a text-only wordmark — no Penn logo asset is licensed/present in
 * the repo, so we never recreate or approximate the mark. Restrained: it
 * establishes identity without taking over the page. Carries the global env
 * badge + sign-out and the mobile nav trigger; page-specific controls live in
 * the page-control bar below.
 */
export function Masthead({ onOpenDrawer }: { onOpenDrawer: () => void }) {
  const { signOut } = useAuth()
  return (
    <header className="sticky top-0 z-50 flex h-16 shrink-0 items-center gap-3 border-b-2 border-accent bg-brand-nav px-4 md:px-6">
      <button
        type="button"
        onClick={onOpenDrawer}
        aria-label="Open navigation"
        className="flex size-10 items-center justify-center rounded-control text-on-brand hover:bg-white/10 md:hidden"
      >
        <Menu aria-hidden className="size-5" />
      </button>

      <div className="flex min-w-0 shrink-0 items-baseline gap-2 md:gap-3">
        {/* short form below sm so the wordmark never truncates mid-word */}
        <span className="display text-lg font-bold tracking-wide text-on-brand uppercase sm:hidden">
          Penn FH
        </span>
        <span className="display hidden truncate text-lg font-bold tracking-wide text-on-brand uppercase lg:inline">
          Penn Field Hockey
        </span>
        <span className="display hidden truncate text-lg font-bold tracking-wide text-on-brand uppercase sm:inline lg:hidden">
          Penn FH
        </span>
      </div>

      {/* Top-level product-area tabs — the single top-level switch (desktop) */}
      <div className="ml-2 hidden min-w-0 self-stretch overflow-x-auto md:ml-4 md:flex lg:ml-6">
        <AreaTabs />
      </div>

      <div className="ml-auto flex items-center gap-3">
        <Badge tone="warning">
          {APP_ENV === 'production' ? 'PRODUCTION' : 'PROTOTYPE'}
          <span className="sr-only lg:not-sr-only">
            {' '}
            · {APP_ENV === 'production' ? 'REAL DATA' : 'SYNTHETIC DATA'}
          </span>
        </Badge>
        <button
          type="button"
          onClick={signOut}
          aria-label="Sign out"
          title="Sign out"
          className="flex size-10 items-center justify-center rounded-control text-on-brand hover:bg-white/10"
        >
          <LogOut aria-hidden className="size-5" strokeWidth={1.75} />
        </button>
      </div>
    </header>
  )
}
