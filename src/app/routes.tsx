import { Navigate, Route, Routes } from 'react-router'
import type { ReactNode } from 'react'
import { useAuth } from '../lib/auth/AuthContext.tsx'
import { SignInScreen } from '../lib/auth/SignInScreen.tsx'
import { AppShell } from './AppShell.tsx'
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
import { PRIMARY_SECTIONS } from './nav.ts'
import { AthletesPage } from './overview/AthletesPage.tsx'
import { TeamDashboardPage } from './overview/TeamDashboardPage.tsx'
import { AdminPage, GpsPage, NotFoundPage, SectionPage } from './pages.tsx'

function RequireAuth({ children }: { children: ReactNode }) {
  const { status } = useAuth()
  return status === 'signed_in' ? children : <Navigate to="/signin" replace />
}

const [overview, monitoring, trends, performance] = PRIMARY_SECTIONS

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
        <Route index element={<Navigate to="/overview" replace />} />

        <Route path="/overview" element={<SectionPage section={overview!} />}>
          <Route index element={<TeamDashboardPage />} />
          <Route path="athletes" element={<AthletesPage />} />
        </Route>

        <Route path="/monitoring" element={<SectionPage section={monitoring!} />}>
          <Route index element={<MonitoringAvailabilityPage />} />
          <Route path="readiness" element={<ReadinessPage />} />
          <Route path="gps" element={<GpsPage />}>
            <Route index element={<GpsSessionOverviewPage />} />
            <Route path="compare" element={<GpsSessionComparePage />} />
            <Route path="trends" element={<GpsTrendsPage />} />
          </Route>
        </Route>

        {/* §5.3: both tabs are the SAME explorer — only the KPI catalog differs */}
        <Route path="/trends" element={<SectionPage section={trends!} />}>
          <Route
            index
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

        <Route path="/performance" element={<SectionPage section={performance!} />}>
          <Route index element={<PerformanceOverviewPage />} />
          <Route path="leaderboards" element={<LeaderboardsPage />} />
          <Route path="athlete-profile" element={<AthleteProfilePage />} />
        </Route>

        <Route
          path="/admin/kpi-settings"
          element={
            <AdminPage
              title="KPI Settings"
              description="Manage the KPI registry: display units, interpretation, aggregation, valid ranges, visibility, source mappings, and positions (§5.5)."
            />
          }
        />
        <Route path="/admin/import" element={<ImportPage />} />
        <Route
          path="/admin/data-management"
          element={
            <AdminPage
              title="Data Management"
              description="Structural layout control: reorder sections/sub-tabs, show/hide optional widgets — persisted server-side (§5.5)."
            />
          }
        />

        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  )
}
