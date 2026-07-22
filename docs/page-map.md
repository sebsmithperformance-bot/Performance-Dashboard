# Page Map

Every route in the current dashboard, what renders it, and where its data comes
from. Routes are declared in [`src/app/routes.tsx`](../src/app/routes.tsx); the
navigation tree (what appears in the sidebar) is data in
[`src/app/nav.ts`](../src/app/nav.ts). The two are intentionally separate: a
route can exist without a nav entry (e.g. legacy redirects), and nav order /
visibility is overlaid by the coach's layout config (see
[current-architecture.md](./current-architecture.md)).

## Shell

`main.tsx` → `App` → `AppRoutes`. Authenticated routes render inside `AppShell`
(`src/app/AppShell.tsx`): a full-width **Masthead**, a left **Sidebar** (accordion
nav, scoped to the active product area), a **Topbar**, and the routed page in
`<Outlet>`. `RequireAuth` gates everything except `/signin`; the index route
redirects to the first visible page via `firstVisiblePath(settings.layout)`.

At a glance: **3 product areas** (16 pages total) + **4 admin/Settings pages**, plus
legacy redirects. All routes below are unchanged from `main` as of the 2026-07-22
handoff.

## Product areas & pages

Three top-level product areas. The path column is the live route; the file is the
component that renders it.

### Performance Dashboard

| Page | Route | Component |
| --- | --- | --- |
| Team Snapshot | `/overview/team-snapshot` | `app/overview/TeamSnapshotPage.tsx` |
| Athletes | `/overview/athletes` | `app/overview/AthletesPage.tsx` |
| Availability | `/monitoring/availability` | `app/monitoring/AvailabilityPage.tsx` |
| Readiness | `/monitoring/readiness` | `app/monitoring/ReadinessPage.tsx` |
| GPS Session Overview | `/monitoring/gps/session-overview` | `app/monitoring/gps/SessionOverviewPage.tsx` |
| GPS Session Compare | `/monitoring/gps/session-compare` | `app/monitoring/gps/SessionComparePage.tsx` |
| GPS Trends & Recommendations | `/monitoring/gps/trends` | `app/monitoring/gps/TrendsRecommendationsPage.tsx` |
| Data Trends — Performance | `/data-trends/performance` | `app/trends/TrendExplorer.tsx` (S&C catalog) |
| Data Trends — GPS | `/data-trends/gps` | `app/trends/TrendExplorer.tsx` (GPS/Load catalog) |
| Performance Overview | `/performance/overview` | `app/performance/PerformanceOverviewPage.tsx` |
| Leaderboards | `/performance/leaderboards` | `app/performance/LeaderboardsPage.tsx` |
| Athlete Profile | `/performance/athlete-profile` | `app/performance/AthleteProfilePage.tsx` |

Both Data Trends tabs are the **same** `TrendExplorer` component; only the KPI
catalog filter differs (Strength/Power vs GPS/Load).

Team Snapshot is a grid of clickable tiles; each tile's detail view lives in
`app/overview/tiles/` (`WorkloadDetail`, `AvailabilityDetail`, `FlagsDetail`,
`LoadHealthDetail`, `ScChangeDetail`, `LastSessionGpsDetail`,
`DataCompletenessDetail`).

### Competition

Self-contained points game, isolated from performance monitoring. Rendered inside
`CompetitionLayout` (`app/competition/CompetitionContext.tsx`), which owns the
shared range/scoring state.

| Page | Route | Component |
| --- | --- | --- |
| Team Standings | `/competition/team-standings` | `app/competition/TeamStandingsPage.tsx` |
| Individual Leaderboard | `/competition/individual-leaderboard` | `app/competition/IndividualLeaderboardPage.tsx` |
| KPI Leaderboards | `/competition/kpi-leaderboards` | `app/competition/KpiLeaderboardsPage.tsx` |

### Annual Plan

| Page | Route | Component |
| --- | --- | --- |
| Annual Plan | `/annual-plan` | `app/annual-plan/AnnualPlanPage.tsx` |

## Admin (Settings)

Kept visually separate from the product areas (`ADMIN_ITEMS` in `nav.ts`).

| Page | Route | Component |
| --- | --- | --- |
| Import Data | `/admin/import` | `app/import/ImportPage.tsx` |
| Metric Settings | `/admin/metric-settings` | `app/admin/MetricSettingsPage.tsx` |
| Layout & Navigation | `/admin/layout-navigation` | `app/admin/LayoutNavigationPage.tsx` |
| Competition Settings | `/admin/competition-settings` | `app/admin/CompetitionSettingsPage.tsx` |

## Legacy redirects

Kept so old links/bookmarks resolve. In `routes.tsx`:

- `/trends` → `/data-trends/performance`, `/trends/gps` → `/data-trends/gps`
- `/monitoring/gps` → `/monitoring/gps/session-overview`
- `/monitoring/gps/compare` → `/monitoring/gps/session-compare`
- `/admin/kpi-settings` → `/admin/metric-settings`
- `/admin/data-management` → `/admin/layout-navigation`
- `*` → `NotFoundPage`
</content>
</invoke>
