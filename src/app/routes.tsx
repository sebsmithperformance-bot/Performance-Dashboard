import { Navigate, Route, Routes } from 'react-router'
import type { ReactNode } from 'react'
import { useAuth } from '../lib/auth/AuthContext.tsx'
import { SignInScreen } from '../lib/auth/SignInScreen.tsx'
import { AppShell } from './AppShell.tsx'
import { CompetitionSettingsPage } from './admin/CompetitionSettingsPage.tsx'
import { DataManagementPage } from './admin/DataManagementPage.tsx'
import { KpiSettingsPage } from './admin/KpiSettingsPage.tsx'
import { AnnualPlanPage } from './annual-plan/AnnualPlanPage.tsx'
import { CompetitionLayout } from './competition/CompetitionContext.tsx'
import { IndividualLeaderboardPage } from './competition/IndividualLeaderboardPage.tsx'
import { KpiLeaderboardsPage } from './competition/KpiLeaderboardsPage.tsx'
import { TeamStandingsPage } from './competition/TeamStandingsPage.tsx'
import { ImportPage } from './import/ImportPage.tsx'
import { MonitoringAvailabilityPage } from './monitoring/AvailabilityPage.tsx'
import { ReadinessPage } from './monitoring/ReadinessPage.tsx'
import { GpsSessionComparePage } from './monitoring/gps/SessionComparePage.tsx'
import { GpsSessionOverviewPage } from './monitoring/gps/SessionOverviewPage.tsx'
import { GpsTrendsPage } from './monitoring/gps/TrendsRecommendationsPage.tsx'
import { AthleteProfilePage } from './performance/AthleteProfilePage.tsx'
import { LeaderboardsPage } from './performance/LeaderboardsPage.tsx'
import { PerformanceOverviewPage } from './performance/PerformanceOverviewPage.tsx'
import { TrendExplorer } from './trends/TrendExplorer.tsx'
import { AthletesPage } from './overview/AthletesPage.tsx'
import { TeamSnapshotPage } from './overview/TeamSnapshotPage.tsx'
import { NotFoundPage, SectionPage } from './pages.tsx'

function RequireAuth({ children }: { children: ReactNode }) {
  const { status } = useAuth()
  return status === 'signed_in' ? children : <Navigate to="/signin" replace />
}

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/signin" element={<SignInScreen />} />

      <Route
        element={
          <RequireAuth>
            <AppShell />
          </RequireAuth>
        }
      >
        <Route index element={<Navigate to="/overview/team-snapshot" replace />} />

        <Route path="/overview" element={<SectionPage />}>
          <Route index element={<Navigate to="/overview/team-snapshot" replace />} />
          <Route path="team-snapshot" element={<TeamSnapshotPage />} />
          <Route path="athletes" element={<AthletesPage />} />
        </Route>

        <Route path="/monitoring" element={<SectionPage />}>
          <Route index element={<Navigate to="/monitoring/availability" replace />} />
          <Route path="availability" element={<MonitoringAvailabilityPage />} />
          <Route path="readiness" element={<ReadinessPage />} />
          <Route path="gps/session-overview" element={<GpsSessionOverviewPage />} />
          <Route path="gps/session-compare" element={<GpsSessionComparePage />} />
          <Route path="gps/trends" element={<GpsTrendsPage />} />
          {/* legacy GPS paths → new flat leaves */}
          <Route path="gps" element={<Navigate to="/monitoring/gps/session-overview" replace />} />
          <Route
            path="gps/compare"
            element={<Navigate to="/monitoring/gps/session-compare" replace />}
          />
        </Route>

        {/* §5.3: both tabs are the SAME explorer — only the KPI catalog differs */}
        <Route path="/data-trends" element={<SectionPage />}>
          <Route index element={<Navigate to="/data-trends/performance" replace />} />
          <Route
            path="performance"
            element={
              <TrendExplorer
                pageId="trends-performance"
                catalog={(k) => k.category === 'Strength' || k.category === 'Power'}
                catalogLabel="S&C"
              />
            }
          />
          <Route
            path="gps"
            element={
              <TrendExplorer
                pageId="trends-gps"
                catalog={(k) => k.category === 'GPS' || k.category === 'Load'}
                catalogLabel="GPS/load"
              />
            }
          />
        </Route>

        <Route path="/performance" element={<SectionPage />}>
          <Route index element={<Navigate to="/performance/overview" replace />} />
          <Route path="overview" element={<PerformanceOverviewPage />} />
          <Route path="leaderboards" element={<LeaderboardsPage />} />
          <Route path="athlete-profile" element={<AthleteProfilePage />} />
        </Route>

        <Route path="/competition" element={<CompetitionLayout />}>
          <Route index element={<Navigate to="/competition/team-standings" replace />} />
          <Route path="team-standings" element={<TeamStandingsPage />} />
          <Route path="individual-leaderboard" element={<IndividualLeaderboardPage />} />
          <Route path="kpi-leaderboards" element={<KpiLeaderboardsPage />} />
        </Route>

        <Route path="/annual-plan" element={<AnnualPlanPage />} />

        <Route path="/admin/import" element={<ImportPage />} />
        <Route path="/admin/kpi-settings" element={<KpiSettingsPage />} />
        <Route path="/admin/data-management" element={<DataManagementPage />} />
        <Route path="/admin/competition-settings" element={<CompetitionSettingsPage />} />

        {/* legacy redirects */}
        <Route path="/trends" element={<Navigate to="/data-trends/performance" replace />} />
        <Route path="/trends/gps" element={<Navigate to="/data-trends/gps" replace />} />

        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  )
}
