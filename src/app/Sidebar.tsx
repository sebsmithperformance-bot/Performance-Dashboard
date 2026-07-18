import { PanelLeftClose, PanelLeftOpen, X } from 'lucide-react'
import { NavLink, useLocation } from 'react-router'
import { orderByConfig } from '../lib/settings/defaults.ts'
import { useSettings } from '../lib/settings/SettingsContext.tsx'
import { ADMIN_ITEMS, PRIMARY_SECTIONS, type SubTab } from './nav.ts'
import type { LucideIcon } from 'lucide-react'

function NavItem({
  to,
  icon: Icon,
  label,
  collapsed,
}: {
  to: string
  icon: LucideIcon
  label: string
  collapsed: boolean
}) {
  return (
    <NavLink
      to={to}
      title={collapsed ? label : undefined}
      className={({ isActive }) =>
        `flex h-10 items-center gap-3 rounded-control px-3 text-body font-medium transition-colors duration-150 ${
          collapsed ? 'justify-center' : ''
        } ${
          isActive
            ? 'bg-brand-nav text-on-brand'
            : 'text-secondary hover:bg-surface-2 hover:text-primary'
        }`
      }
    >
      <Icon aria-hidden className="size-5 shrink-0" strokeWidth={1.75} />
      {!collapsed && <span className="truncate">{label}</span>}
    </NavLink>
  )
}

/** Second-level entry shown, indented, under the active primary section. */
function SubNavItem({ tab }: { tab: SubTab }) {
  return (
    <NavLink
      to={tab.path}
      end={tab.end}
      className={({ isActive }) =>
        `flex h-8 items-center rounded-control px-3 text-label font-medium transition-colors duration-150 ${
          isActive
            ? 'bg-surface-2 text-primary'
            : 'text-muted hover:bg-surface-2 hover:text-secondary'
        }`
      }
    >
      <span className="truncate">{tab.label}</span>
    </NavLink>
  )
}

function SidebarBody({ collapsed }: { collapsed: boolean }) {
  // §5.5 layout config: coach-chosen section order (Data Management)
  const { settings } = useSettings()
  const { pathname } = useLocation()
  const sections = orderByConfig(PRIMARY_SECTIONS, (s) => s.base, settings.layout.sectionOrder)
  return (
    <>
      {/* Penn Navy brand block (§12.2); approved logo asset pending (blocker #5) */}
      <div className="flex h-16 shrink-0 items-center bg-brand-nav px-4">
        <span className="text-subhead font-bold tracking-tight text-on-brand">
          {collapsed ? 'FH' : 'FH Performance'}
        </span>
      </div>
      <nav aria-label="Primary" className="flex flex-col gap-1 p-3">
        {sections.map((section) => {
          const active = pathname === section.base || pathname.startsWith(`${section.base}/`)
          const subTabs = orderByConfig(
            section.subTabs,
            (t) => t.path,
            settings.layout.subTabOrder[section.base] ?? [],
          )
          return (
            <div key={section.base}>
              <NavItem
                to={section.base}
                icon={section.icon}
                label={section.label}
                collapsed={collapsed}
              />
              {/* subcategories: visible only for the active section when expanded */}
              {!collapsed && active && subTabs.length > 0 && (
                <div className="mt-0.5 mb-1 ml-[1.35rem] flex flex-col gap-0.5 border-l border-subtle pl-2">
                  {subTabs.map((tab) => (
                    <SubNavItem key={tab.path} tab={tab} />
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </nav>
      <div className="mx-3 border-t border-subtle" />
      <nav aria-label="Administration" className="flex flex-col gap-1 p-3">
        {!collapsed && (
          <span className="px-3 pb-1 text-label font-medium tracking-wide text-muted uppercase">
            Admin
          </span>
        )}
        {ADMIN_ITEMS.map((item) => (
          <NavItem
            key={item.path}
            to={item.path}
            icon={item.icon}
            label={item.label}
            collapsed={collapsed}
          />
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
      {/* Desktop sidebar (≥768px): collapsible 240px ↔ 64px (§12.4) */}
      <aside
        className={`sticky top-0 hidden h-screen shrink-0 flex-col border-r border-subtle bg-surface transition-[width] duration-200 ease-out md:flex ${
          collapsed ? 'w-16' : 'w-60'
        }`}
      >
        <SidebarBody collapsed={collapsed} />
        <div className="mt-auto p-3">
          <button
            type="button"
            onClick={onToggleCollapsed}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            className={`flex h-10 items-center gap-3 rounded-control px-3 text-secondary hover:bg-surface-2 hover:text-primary ${
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

      {/* Mobile off-canvas drawer (<768px, §12.4) */}
      {drawerOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="absolute inset-0 bg-black/60" onClick={onCloseDrawer} aria-hidden />
          <aside className="absolute inset-y-0 left-0 flex w-60 flex-col border-r border-subtle bg-surface">
            <button
              type="button"
              onClick={onCloseDrawer}
              aria-label="Close navigation"
              className="absolute top-3 right-3 z-10 flex size-10 items-center justify-center rounded-control text-on-brand hover:bg-white/10"
            >
              <X aria-hidden className="size-5" />
            </button>
            <SidebarBody collapsed={false} />
          </aside>
        </div>
      )}
    </>
  )
}
