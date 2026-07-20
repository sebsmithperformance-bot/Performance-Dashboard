/**
 * §2 information architecture as data — the single source for the sidebar and
 * route tree. The sidebar is the ONLY primary and secondary navigation system
 * (no horizontal sub-tabs). Order/visibility is overridable via the
 * server-persisted dashboard_layout config; the structure itself (what exists)
 * stays here.
 */
import {
  Activity,
  CalendarRange,
  Dumbbell,
  LayoutDashboard,
  LayoutList,
  Settings2,
  Trophy,
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
  /** empty = a standalone section rendered as a single clickable row */
  subTabs: SubTab[]
}

export const PRIMARY_SECTIONS: NavSection[] = [
  {
    label: 'Overview',
    icon: LayoutDashboard,
    base: '/overview',
    subTabs: [
      { label: 'Team Snapshot', path: '/overview/team-snapshot' },
      { label: 'Athletes', path: '/overview/athletes' },
    ],
  },
  {
    label: 'Monitoring',
    icon: Activity,
    base: '/monitoring',
    subTabs: [
      { label: 'Availability', path: '/monitoring/availability' },
      { label: 'Readiness', path: '/monitoring/readiness' },
      { label: 'GPS Session Overview', path: '/monitoring/gps/session-overview' },
      { label: 'GPS Session Compare', path: '/monitoring/gps/session-compare' },
      { label: 'GPS Trends & Recommendations', path: '/monitoring/gps/trends' },
    ],
  },
  {
    label: 'Data Trends',
    icon: TrendingUp,
    base: '/data-trends',
    subTabs: [
      { label: 'Performance', path: '/data-trends/performance' },
      { label: 'GPS', path: '/data-trends/gps' },
    ],
  },
  {
    label: 'Performance',
    icon: Dumbbell,
    base: '/performance',
    subTabs: [
      { label: 'Overview', path: '/performance/overview' },
      { label: 'Leaderboards', path: '/performance/leaderboards' },
      { label: 'Athlete Profile', path: '/performance/athlete-profile' },
    ],
  },
  {
    label: 'Competition',
    icon: Trophy,
    base: '/competition',
    subTabs: [
      { label: 'Team Standings', path: '/competition/team-standings' },
      { label: 'Individual Leaderboard', path: '/competition/individual-leaderboard' },
      { label: 'KPI Leaderboards', path: '/competition/kpi-leaderboards' },
    ],
  },
  {
    label: 'Annual Plan',
    icon: CalendarRange,
    base: '/annual-plan',
    subTabs: [],
  },
]

export interface AdminItem {
  label: string
  icon: LucideIcon
  path: string
}

/** Admin section — kept visually separate from the primary sections (§2). */
export const ADMIN_ITEMS: AdminItem[] = [
  { label: 'Import Data', icon: Upload, path: '/admin/import' },
  { label: 'KPI Settings', icon: Settings2, path: '/admin/kpi-settings' },
  { label: 'Data Management', icon: LayoutList, path: '/admin/data-management' },
  { label: 'Competition Settings', icon: Trophy, path: '/admin/competition-settings' },
]
