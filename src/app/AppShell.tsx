import { useEffect, useState } from 'react'
import { Outlet, useLocation } from 'react-router'
import { useIdleSignOut } from '../lib/auth/useIdleSignOut.ts'
import { Sidebar } from './Sidebar.tsx'
import { Topbar } from './Topbar.tsx'

const SIDEBAR_KEY = 'fh.sidebar-collapsed'

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
    <div className="flex min-h-screen">
      <Sidebar
        collapsed={collapsed}
        onToggleCollapsed={toggleCollapsed}
        drawerOpen={drawerOpen}
        onCloseDrawer={() => setDrawerOpen(false)}
      />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar onOpenDrawer={() => setDrawerOpen(true)} />
        <main className="min-w-0 flex-1 p-4 md:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
