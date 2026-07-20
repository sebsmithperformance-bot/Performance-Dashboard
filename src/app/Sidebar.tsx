import { PanelLeftClose, PanelLeftOpen, X } from 'lucide-react'
import { NavLink, useLocation } from 'react-router'
import { orderByConfig } from '../lib/settings/defaults.ts'
import { useSettings } from '../lib/settings/SettingsContext.tsx'
import { ADMIN_ITEMS, GPS_SUB_TABS, PRIMARY_SECTIONS, type NavSection, type SubTab } from './nav.ts'
import type { LucideIcon } from 'lucide-react'

/** Collapsed-rail icon item (icon only, section base as target). */
function RailItem({ to, icon: Icon, label }: { to: string; icon: LucideIcon; label: string }) {
  return (
    <NavLink
      to={to}
      title={label}
      className={({ isActive }) =>
        `flex h-10 items-center justify-center rounded-control transition-colors duration-150 ${
          isActive ? 'bg-[var(--navigation-active)] text-on-brand' : 'text-secondary hover:bg-white/5 hover:text-primary'
        }`
      }
    >
      <Icon aria-hidden className="size-5 shrink-0" strokeWidth={1.75} />
    </NavLink>
  )
}

/** Expanded leaf item within a section group (indented, subordinate). */
function LeafItem({ tab, nested = false }: { tab: SubTab; nested?: boolean }) {
  return (
    <NavLink
      to={tab.path}
      end={tab.end}
      className={({ isActive }) =>
        `relative flex h-8 items-center rounded-control pr-3 text-body font-medium transition-colors duration-150 ${
          nested ? 'pl-7 text-label' : 'pl-3'
        } ${
          isActive
            ? 'bg-[var(--navigation-active)] font-semibold text-on-brand before:absolute before:top-1 before:bottom-1 before:left-0 before:w-0.5 before:rounded-full before:bg-[var(--navigation-indicator)]'
            : 'text-secondary hover:bg-white/5 hover:text-primary'
        }`
      }
    >
      <span className="truncate">{tab.label}</span>
    </NavLink>
  )
}

/** One section group: uppercase label + its always-visible leaves. The GPS
 *  leaf expands to its third-level tabs when a GPS route is active. */
function SectionGroup({ section, pathname }: { section: NavSection; pathname: string }) {
  const { settings } = useSettings()
  const subTabs = orderByConfig(
    section.subTabs,
    (t) => t.path,
    settings.layout.subTabOrder[section.base] ?? [],
  )
  const gpsActive = pathname.startsWith('/monitoring/gps')
  return (
    <div className="mt-3 flex flex-col gap-0.5 border-t border-white/10 pt-3 first:mt-0 first:border-t-0 first:pt-0">
      {/* category headers read as structure, not as another clickable row */}
      <span className="section-label px-3 pb-1.5 text-[0.6875rem] text-brand-neutral">
        {section.label}
      </span>
      {subTabs.map((tab) => (
        <div key={tab.path}>
          <LeafItem tab={tab} />
          {tab.path === '/monitoring/gps' && gpsActive && (
            <div className="mt-0.5 flex flex-col gap-0.5">
              {GPS_SUB_TABS.map((g) => (
                <LeafItem key={g.path} tab={g} nested />
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

function SidebarBody({ collapsed }: { collapsed: boolean }) {
  const { settings } = useSettings()
  const { pathname } = useLocation()
  const sections = orderByConfig(PRIMARY_SECTIONS, (s) => s.base, settings.layout.sectionOrder)

  if (collapsed) {
    return (
      <nav aria-label="Primary" className="flex flex-col gap-1 p-2">
        {sections.map((s) => (
          <RailItem key={s.base} to={s.base} icon={s.icon} label={s.label} />
        ))}
        <div className="mx-1 my-1 border-t border-white/10" />
        {ADMIN_ITEMS.map((a) => (
          <RailItem key={a.path} to={a.path} icon={a.icon} label={a.label} />
        ))}
      </nav>
    )
  }

  return (
    <>
      <nav aria-label="Primary" className="flex flex-col px-2 pb-2">
        {sections.map((section) => (
          <SectionGroup key={section.base} section={section} pathname={pathname} />
        ))}
      </nav>
      <div className="mx-3 border-t border-white/10" />
      <nav aria-label="Administration" className="flex flex-col gap-0.5 px-2 pt-3 pb-2">
        <span className="section-label px-3 pb-1.5 text-[0.6875rem] text-brand-neutral">Admin</span>
        {ADMIN_ITEMS.map((item) => (
          <LeafItem key={item.path} tab={{ label: item.label, path: item.path }} />
        ))}
      </nav>
    </>
  )
}

export function Sidebar({
  collapsed,
  onToggleCollapsed,
  drawerOpen,
  onCloseDrawer,
}: {
  collapsed: boolean
  onToggleCollapsed: () => void
  drawerOpen: boolean
  onCloseDrawer: () => void
}) {
  return (
    <>
      {/* Desktop sidebar (≥768px): 240px ↔ 64px, pinned below the masthead */}
      <aside
        className={`sticky top-16 hidden h-[calc(100vh-4rem)] shrink-0 flex-col overflow-y-auto border-r border-subtle bg-[var(--navigation-background)] transition-[width] duration-200 ease-out md:flex ${
          collapsed ? 'w-16' : 'w-60'
        }`}
      >
        <SidebarBody collapsed={collapsed} />
        <div className="mt-auto p-2">
          <button
            type="button"
            onClick={onToggleCollapsed}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            className={`flex h-10 items-center gap-3 rounded-control px-3 text-secondary hover:bg-white/5 hover:text-primary ${
              collapsed ? 'w-full justify-center' : ''
            }`}
          >
            {collapsed ? (
              <PanelLeftOpen aria-hidden className="size-5" strokeWidth={1.75} />
            ) : (
              <>
                <PanelLeftClose aria-hidden className="size-5" strokeWidth={1.75} />
                <span className="text-body font-medium">Collapse</span>
              </>
            )}
          </button>
        </div>
      </aside>

      {/* Mobile off-canvas drawer (<768px) */}
      {drawerOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="absolute inset-0 bg-black/60" onClick={onCloseDrawer} aria-hidden />
          <aside className="absolute inset-y-0 left-0 flex w-64 flex-col overflow-y-auto border-r border-subtle bg-[var(--navigation-background)]">
            <div className="flex h-16 shrink-0 items-center justify-between border-b-2 border-accent bg-brand-nav px-4">
              <span className="display text-base font-bold tracking-wide text-on-brand uppercase">
                Penn Field Hockey
              </span>
              <button
                type="button"
                onClick={onCloseDrawer}
                aria-label="Close navigation"
                className="flex size-9 items-center justify-center rounded-control text-on-brand hover:bg-white/10"
              >
                <X aria-hidden className="size-5" />
              </button>
            </div>
            <SidebarBody collapsed={false} />
          </aside>
        </div>
      )}
    </>
  )
}
