import { ChevronDown, PanelLeftClose, PanelLeftOpen, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { NavLink, useLocation } from 'react-router'
import { useSettings } from '../lib/settings/SettingsContext.tsx'
import { ADMIN_ITEMS, matchNavPage, type NavArea, type NavCategory, type NavPage } from './nav.ts'
import { visibleNavTree } from './nav-layout.ts'
import type { LucideIcon } from 'lucide-react'

/** Collapsed-rail icon item (icon only). */
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

/** Leaf page link within an expanded category (indented, subordinate). */
function LeafItem({ page }: { page: NavPage }) {
  return (
    <NavLink
      to={page.path}
      className={({ isActive }) =>
        `relative flex h-8 items-center rounded-control pr-3 pl-8 text-body font-medium transition-colors duration-150 ${
          isActive
            ? 'bg-[var(--navigation-active)] font-semibold text-on-brand before:absolute before:top-1 before:bottom-1 before:left-0 before:w-0.5 before:rounded-full before:bg-[var(--navigation-indicator)]'
            : 'text-secondary hover:bg-white/5 hover:text-primary'
        }`
      }
    >
      <span className="truncate">{page.label}</span>
    </NavLink>
  )
}

/** A standalone area with a single page (e.g. Annual Plan) — one clickable
 *  top-level row that highlights when active. */
function AreaLeaf({ area }: { area: NavArea }) {
  const { icon: Icon } = area
  const page = area.categories[0]!.pages[0]!
  return (
    <NavLink
      to={page.path}
      className={({ isActive }) =>
        `relative flex h-9 items-center gap-2.5 rounded-control px-3 text-body font-semibold transition-colors duration-150 ${
          isActive
            ? 'bg-[var(--navigation-active)] text-on-brand before:absolute before:top-1 before:bottom-1 before:left-0 before:w-0.5 before:rounded-full before:bg-[var(--navigation-indicator)]'
            : 'text-secondary hover:bg-white/5 hover:text-primary'
        }`
      }
    >
      <Icon aria-hidden className="size-4 shrink-0" strokeWidth={1.75} />
      <span className="section-label truncate text-[0.6875rem]">{area.label}</span>
    </NavLink>
  )
}

/** An accordion category: a clickable header that expands to its page leaves.
 *  Only the open category shows its pages; the active category auto-opens. */
function CategoryGroup({
  category,
  icon,
  label,
  open,
  onToggle,
}: {
  category: NavCategory
  icon: LucideIcon
  label: string
  open: boolean
  onToggle: () => void
}) {
  const Icon = icon
  return (
    <div className="flex flex-col">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="flex h-9 items-center gap-2.5 rounded-control px-3 text-secondary transition-colors duration-150 hover:bg-white/5 hover:text-primary"
      >
        <Icon aria-hidden className="size-4 shrink-0" strokeWidth={1.75} />
        <span className="section-label truncate text-[0.6875rem]">{label}</span>
        <ChevronDown
          aria-hidden
          className={`ml-auto size-4 shrink-0 transition-transform duration-200 ${open ? '' : '-rotate-90'}`}
        />
      </button>
      {open && (
        <div className="mt-0.5 mb-1 flex flex-col gap-0.5">
          {category.pages.map((page) => (
            <LeafItem key={page.id} page={page} />
          ))}
        </div>
      )}
    </div>
  )
}

function SidebarBody({ collapsed }: { collapsed: boolean }) {
  const { settings } = useSettings()
  const { pathname } = useLocation()
  const tree = visibleNavTree(settings.layout)

  // the category containing the active page auto-opens; only one open at a time
  const activeCategoryId = matchNavPage(pathname)?.category.id ?? null
  const [openId, setOpenId] = useState<string | null>(activeCategoryId)
  useEffect(() => {
    if (activeCategoryId) setOpenId(activeCategoryId)
  }, [activeCategoryId])

  if (collapsed) {
    return (
      <nav aria-label="Primary" className="flex flex-col gap-1 p-2">
        {tree.map((area) => {
          const to = area.categories[0]?.pages[0]?.path ?? '/'
          return <RailItem key={area.id} to={to} icon={area.icon} label={area.label} />
        })}
        <div className="mx-1 my-1 border-t border-white/10" />
        {ADMIN_ITEMS.map((a) => (
          <RailItem key={a.path} to={a.path} icon={a.icon} label={a.label} />
        ))}
      </nav>
    )
  }

  return (
    <>
      <nav aria-label="Primary" className="flex flex-col gap-1 px-2 pt-2 pb-2">
        {tree.map((area) => {
          const singlePage =
            area.categories.length === 1 && area.categories[0]!.pages.length === 1
          // standalone area (e.g. Annual Plan): one top-level clickable row
          if (singlePage) {
            return (
              <div
                key={area.id}
                className="mt-2 border-t border-white/10 pt-2 first:mt-0 first:border-t-0 first:pt-0"
              >
                <AreaLeaf area={area} />
              </div>
            )
          }
          // single-category area (e.g. Competition): the area IS one accordion
          if (area.categories.length === 1) {
            const category = area.categories[0]!
            return (
              <div
                key={area.id}
                className="mt-2 border-t border-white/10 pt-2 first:mt-0 first:border-t-0 first:pt-0"
              >
                <CategoryGroup
                  category={category}
                  icon={area.icon}
                  label={area.label}
                  open={openId === category.id}
                  onToggle={() => setOpenId(openId === category.id ? null : category.id)}
                />
              </div>
            )
          }
          // multi-category area (Performance Dashboard): super-header + accordions
          return (
            <div
              key={area.id}
              className="mt-2 flex flex-col gap-0.5 border-t border-white/10 pt-2 first:mt-0 first:border-t-0 first:pt-0"
            >
              <span className="flex items-center gap-2 px-3 pb-1 text-[0.6875rem] font-semibold tracking-wide text-brand-neutral uppercase">
                <area.icon aria-hidden className="size-3.5 shrink-0" strokeWidth={2} />
                {area.label}
              </span>
              {area.categories.map((category) => (
                <CategoryGroup
                  key={category.id}
                  category={category}
                  icon={category.icon}
                  label={category.label}
                  open={openId === category.id}
                  onToggle={() => setOpenId(openId === category.id ? null : category.id)}
                />
              ))}
            </div>
          )
        })}
      </nav>
      <div className="mx-3 border-t border-white/10" />
      <nav aria-label="Administration" className="flex flex-col gap-0.5 px-2 pt-3 pb-2">
        <span className="section-label px-3 pb-1.5 text-[0.6875rem] text-brand-neutral">Admin</span>
        {ADMIN_ITEMS.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) =>
              `relative flex h-8 items-center gap-2.5 rounded-control px-3 text-body font-medium transition-colors duration-150 ${
                isActive
                  ? 'bg-[var(--navigation-active)] font-semibold text-on-brand before:absolute before:top-1 before:bottom-1 before:left-0 before:w-0.5 before:rounded-full before:bg-[var(--navigation-indicator)]'
                  : 'text-secondary hover:bg-white/5 hover:text-primary'
              }`
            }
          >
            <item.icon aria-hidden className="size-4 shrink-0" strokeWidth={1.75} />
            <span className="truncate">{item.label}</span>
          </NavLink>
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
