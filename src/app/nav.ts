/**
 * §5 information architecture as data — the single source for the sidebar,
 * sub-tab rows, and route tree. Order/visibility will later be overridable
 * via the server-persisted dashboard_layout config (§5.5); the structure
 * itself (what exists) stays here.
 */
import {
  Activity,
  Dumbbell,
  LayoutDashboard,
  LayoutList,
  Settings2,
  TrendingUp,
  Upload,
  type LucideIcon,
} from 'lucide-react'

export interface SubTab {
  label: string
  path: string
  /** exact-match NavLink (index routes) */
  end?: boolean
}

export interface NavSection {
  label: string
  icon: LucideIcon
  base: string
  subTabs: SubTab[]
}

export const PRIMARY_SECTIONS: NavSection[] = [
  {
    label: 'Overview',
    icon: LayoutDashboard,
    base: '/overview',
    subTabs: [
      { label: 'Team Dashboard', path: '/overview', end: true },
      { label: 'Athletes', path: '/overview/athletes' },
    ],
  },
  {
    label: 'Monitoring',
    icon: Activity,
    base: '/monitoring',
    subTabs: [
      { label: 'Availability', path: '/monitoring', end: true },
      { label: 'Readiness', path: '/monitoring/readiness' },
      { label: 'GPS', path: '/monitoring/gps' },
    ],
  },
  {
    label: 'Data Trends',
    icon: TrendingUp,
    base: '/trends',
    subTabs: [
      { label: 'Performance', path: '/trends', end: true },
      { label: 'GPS', path: '/trends/gps' },
    ],
  },
  {
    label: 'Performance',
    icon: Dumbbell,
    base: '/performance',
    subTabs: [
      { label: 'Overview', path: '/performance', end: true },
      { label: 'Leaderboards', path: '/performance/leaderboards' },
      { label: 'Athlete Profile', path: '/performance/athlete-profile' },
    ],
  },
]

export interface AdminItem {
  label: string
  icon: LucideIcon
  path: string
}

/** Admin section — kept visually separate from the four primary sections (§5.5). */
export const ADMIN_ITEMS: AdminItem[] = [
  { label: 'KPI Settings', icon: Settings2, path: '/admin/kpi-settings' },
  { label: 'Import Data', icon: Upload, path: '/admin/import' },
  { label: 'Data Management', icon: LayoutList, path: '/admin/data-management' },
]

/** Inner tab row for Monitoring → GPS (§5.2). */
export const GPS_SUB_TABS: SubTab[] = [
  { label: 'Session Overview', path: '/monitoring/gps', end: true },
  { label: 'Session Compare', path: '/monitoring/gps/compare' },
  { label: 'Trends & Recommendations', path: '/monitoring/gps/trends' },
]
