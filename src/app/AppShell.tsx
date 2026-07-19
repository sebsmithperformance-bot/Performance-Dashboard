import { useEffect, useState } from 'react'
import { Outlet, useLocation } from 'react-router'
import { useIdleSignOut } from '../lib/auth/useIdleSignOut.ts'
import { Masthead } from './Masthead.tsx'
import { Sidebar } from './Sidebar.tsx'
import { Topbar } from './Topbar.tsx'

const SIDEBAR_KEY = 'fh.sidebar-collapsed'

/**
 * Two-level shell (§ visual redesign B): a branded masthead spanning the full
 * width, then a sidebar + (page-control bar → sub-tabs → content) column.
 */
export function AppShell() {
  useIdleSignOut()
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem(SIDEBAR_KEY) === '1')
  const [drawerOpen, setDrawerOpen] = useState(false)
  const location = useLocation()

  useEffect(() => setDrawerOpen(false), [location.pathname])

  const toggleCollapsed = () => {
    setCollapsed((c) => {
      localStorage.setItem(SIDEBAR_KEY, c ? '0' : '1')
      return !c
    })
  }

  return (
    <div className="flex min-h-screen flex-col">
      <Masthead onOpenDrawer={() => setDrawerOpen(true)} />
      <div className="flex min-h-0 flex-1">
        <Sidebar
          collapsed={collapsed}
          onToggleCollapsed={toggleCollapsed}
          drawerOpen={drawerOpen}
          onCloseDrawer={() => setDrawerOpen(false)}
        />
        <div className="flex min-w-0 flex-1 flex-col">
          <Topbar />
          <main className="min-w-0 flex-1 p-5 md:p-6">
            <Outlet />
          </main>
        </div>
      </div>
    </div>
  )
}
