import { ChevronDown, PanelLeftClose, PanelLeftOpen, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { NavLink, useLocation } from 'react-router'
import { useSettings } from '../lib/settings/SettingsContext.tsx'
import { ADMIN_ITEMS, matchNavPage, type NavCategory, type NavPage } from './nav.ts'
import { visibleNavTree } from './nav-layout.ts'
import { AreaTabs } from './AreaTabs.tsx'
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

/** Leaf page link. Indented when it sits inside an expanded accordion
 *  category; flush when it is a flat top-level item (single-category area). */
function LeafItem({ page, indent = true }: { page: NavPage; indent?: boolean }) {
  return (
    <NavLink
      to={page.path}
      className={({ isActive }) =>
        `relative flex h-8 items-center rounded-control pr-3 text-body font-medium transition-colors duration-150 ${
          indent ? 'pl-8' : 'pl-3'
        } ${
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

  // the sidebar shows ONLY the active product area's nav (areas switch via the
  // top area tabs); on an admin route we fall back to the first area
  const match = matchNavPage(pathname)
  const activeArea = tree.find((a) => a.id === match?.area.id) ?? tree[0] ?? null

  // within the active area, the category containing the active page auto-opens;
  // only one open at a time
  const activeCategoryId = match?.category.id ?? null
  const [openId, setOpenId] = useState<string | null>(activeCategoryId ?? activeArea?.categories[0]?.id ?? null)
  useEffect(() => {
    if (activeCategoryId) setOpenId(activeCategoryId)
  }, [activeCategoryId])

  const multiCategory = (activeArea?.categories.length ?? 0) > 1

  if (collapsed) {
    return (
      <nav aria-label="Primary" className="flex flex-col gap-1 p-2">
        {(activeArea?.categories ?? []).map((c) => (
          <RailItem key={c.id} to={c.pages[0]!.path} icon={c.icon} label={c.label} />
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
      <nav aria-label="Primary" className="flex flex-col gap-1 px-2 pt-3 pb-2">
        {activeArea && (
          <span className="section-label px-3 pb-1 text-[0.6875rem] text-brand-neutral">
            {activeArea.label}
          </span>
        )}
        {multiCategory
          ? // multi-category area (Performance Dashboard): accordion per category
            activeArea!.categories.map((category) => (
              <CategoryGroup
                key={category.id}
                category={category}
                icon={category.icon}
                label={category.label}
                open={openId === category.id}
                onToggle={() => setOpenId(openId === category.id ? null : category.id)}
              />
            ))
          : // single-category area (Competition / Annual Plan): pages shown flat
            (activeArea?.categories[0]?.pages ?? []).map((page) => (
              <LeafItem key={page.id} page={page} indent={false} />
            ))}
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
            {/* product-area switch first, then the active area's nav */}
            <div className="border-b border-white/10">
              <AreaTabs variant="stacked" />
            </div>
            <SidebarBody collapsed={false} />
          </aside>
        </div>
      )}
    </>
  )
}
