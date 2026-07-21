/**
 * Information architecture as data — the single source for the sidebar, the
 * Layout & Navigation admin page, and route defaults. Three top-level product
 * areas (Performance Dashboard, Competition, Annual Plan), each containing
 * categories, each containing pages. The sidebar is the ONLY navigation system
 * (no horizontal sub-tabs). Order/visibility overrides live in the layout
 * config; the structure itself (what exists) stays here.
 */
import {
  Activity,
  CalendarRange,
  Dumbbell,
  Gauge,
  LayoutDashboard,
  LayoutList,
  Settings2,
  Trophy,
  TrendingUp,
  Upload,
  type LucideIcon,
} from 'lucide-react'

export interface NavPage {
  /** stable id = route path */
  id: string
  label: string
  path: string
}

export interface NavCategory {
  id: string
  label: string
  icon: LucideIcon
  pages: NavPage[]
}

export interface NavArea {
  id: string
  label: string
  icon: LucideIcon
  categories: NavCategory[]
}

export const NAV_AREAS: NavArea[] = [
  {
    id: 'performance-dashboard',
    label: 'Performance Dashboard',
    icon: Gauge,
    categories: [
      {
        id: 'overview',
        label: 'Overview',
        icon: LayoutDashboard,
        pages: [
          { id: '/overview/team-snapshot', label: 'Team Snapshot', path: '/overview/team-snapshot' },
          { id: '/overview/athletes', label: 'Athletes', path: '/overview/athletes' },
        ],
      },
      {
        id: 'monitoring',
        label: 'Monitoring',
        icon: Activity,
        pages: [
          { id: '/monitoring/availability', label: 'Availability', path: '/monitoring/availability' },
          { id: '/monitoring/readiness', label: 'Readiness', path: '/monitoring/readiness' },
          {
            id: '/monitoring/gps/session-overview',
            label: 'GPS Session Overview',
            path: '/monitoring/gps/session-overview',
          },
          {
            id: '/monitoring/gps/session-compare',
            label: 'GPS Session Compare',
            path: '/monitoring/gps/session-compare',
          },
          {
            id: '/monitoring/gps/trends',
            label: 'GPS Trends & Recommendations',
            path: '/monitoring/gps/trends',
          },
        ],
      },
      {
        id: 'data-trends',
        label: 'Data Trends',
        icon: TrendingUp,
        pages: [
          { id: '/data-trends/performance', label: 'Performance', path: '/data-trends/performance' },
          { id: '/data-trends/gps', label: 'GPS', path: '/data-trends/gps' },
        ],
      },
      {
        id: 'performance',
        label: 'Performance',
        icon: Dumbbell,
        pages: [
          { id: '/performance/overview', label: 'Overview', path: '/performance/overview' },
          { id: '/performance/leaderboards', label: 'Leaderboards', path: '/performance/leaderboards' },
          {
            id: '/performance/athlete-profile',
            label: 'Athlete Profile',
            path: '/performance/athlete-profile',
          },
        ],
      },
    ],
  },
  {
    id: 'competition',
    label: 'Competition',
    icon: Trophy,
    categories: [
      {
        id: 'competition',
        label: 'Competition',
        icon: Trophy,
        pages: [
          {
            id: '/competition/team-standings',
            label: 'Team Standings',
            path: '/competition/team-standings',
          },
          {
            id: '/competition/individual-leaderboard',
            label: 'Individual Leaderboard',
            path: '/competition/individual-leaderboard',
          },
          {
            id: '/competition/kpi-leaderboards',
            label: 'KPI Leaderboards',
            path: '/competition/kpi-leaderboards',
          },
        ],
      },
    ],
  },
  {
    id: 'annual-plan',
    label: 'Annual Plan',
    icon: CalendarRange,
    categories: [
      {
        id: 'annual-plan',
        label: 'Annual Plan',
        icon: CalendarRange,
        pages: [{ id: '/annual-plan', label: 'Annual Plan', path: '/annual-plan' }],
      },
    ],
  },
]

/** Flat list of every page across all areas (for active-route lookups). */
export function allNavPages(): { area: NavArea; category: NavCategory; page: NavPage }[] {
  return NAV_AREAS.flatMap((area) =>
    area.categories.flatMap((category) =>
      category.pages.map((page) => ({ area, category, page })),
    ),
  )
}

/** The page whose path best matches the pathname (longest prefix wins). */
export function matchNavPage(pathname: string) {
  return allNavPages()
    .filter(({ page }) => pathname === page.path || pathname.startsWith(`${page.path}/`))
    .sort((a, b) => b.page.path.length - a.page.path.length)[0]
}

export interface AdminItem {
  label: string
  icon: LucideIcon
  path: string
}

/** Admin section — kept visually separate from the primary areas. */
export const ADMIN_ITEMS: AdminItem[] = [
  { label: 'Import Data', icon: Upload, path: '/admin/import' },
  { label: 'Metric Settings', icon: Settings2, path: '/admin/metric-settings' },
  { label: 'Layout & Navigation', icon: LayoutList, path: '/admin/layout-navigation' },
  { label: 'Competition Settings', icon: Trophy, path: '/admin/competition-settings' },
]
