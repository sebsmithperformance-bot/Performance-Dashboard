import { NavLink, useLocation } from 'react-router'
import { useSettings } from '../lib/settings/SettingsContext.tsx'
import { matchNavPage } from './nav.ts'
import { firstVisiblePathForArea, visibleNavTree } from './nav-layout.ts'

/**
 * Top-level product-area tabs (Performance Dashboard · Competition · Annual
 * Plan). These are the ONLY top-level switch — the sidebar then shows just the
 * active area's categories/pages, so neither is cluttered. Rendered in the navy
 * masthead on desktop; the mobile drawer reuses this in a stacked variant.
 */
export function AreaTabs({ variant = 'bar' }: { variant?: 'bar' | 'stacked' }) {
  const { settings } = useSettings()
  const { pathname } = useLocation()
  const areas = visibleNavTree(settings.layout)
  const activeAreaId = matchNavPage(pathname)?.area.id ?? null

  if (variant === 'stacked') {
    return (
      <nav aria-label="Product areas" className="flex flex-col gap-1 p-2">
        {areas.map((area) => {
          const active = area.id === activeAreaId
          return (
            <NavLink
              key={area.id}
              to={firstVisiblePathForArea(settings.layout, area.id)}
              aria-current={active ? 'page' : undefined}
              className={`flex items-center gap-2.5 rounded-control px-3 py-2 text-body font-semibold transition-colors ${
                active
                  ? 'bg-[var(--navigation-active)] text-on-brand'
                  : 'text-secondary hover:bg-white/5 hover:text-primary'
              }`}
            >
              <area.icon aria-hidden className="size-4 shrink-0" strokeWidth={1.75} />
              {area.label}
            </NavLink>
          )
        })}
      </nav>
    )
  }

  return (
    <nav aria-label="Product areas" className="flex h-full items-stretch gap-1">
      {areas.map((area) => {
        const active = area.id === activeAreaId
        return (
          <NavLink
            key={area.id}
            to={firstVisiblePathForArea(settings.layout, area.id)}
            aria-current={active ? 'page' : undefined}
            className={`relative flex items-center gap-2 whitespace-nowrap border-b-2 px-3 text-body font-semibold tracking-wide transition-colors ${
              active
                ? 'border-accent text-on-brand'
                : 'border-transparent text-brand-neutral hover:text-on-brand'
            }`}
          >
            <area.icon aria-hidden className="size-4 shrink-0" strokeWidth={1.75} />
            {area.label}
          </NavLink>
        )
      })}
    </nav>
  )
}
