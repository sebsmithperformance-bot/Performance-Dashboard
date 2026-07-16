import { Navigate, Route, Routes } from 'react-router'
import type { ReactNode } from 'react'
import { useAuth } from '../lib/auth/AuthContext.tsx'
import { SignInScreen } from '../lib/auth/SignInScreen.tsx'
import { AppShell } from './AppShell.tsx'
import { ImportPage } from './import/ImportPage.tsx'
import { PRIMARY_SECTIONS } from './nav.ts'
import {
  AdminPage,
  GpsPage,
  NotFoundPage,
  OverviewTeamDashboard,
  PlaceholderPane,
  SectionPage,
} from './pages.tsx'

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
          <Route index element={<OverviewTeamDashboard />} />
          <Route
            path="athletes"
            element={
              <PlaceholderPane
                title="Athletes — single-day overview"
                description="Pick a date and see every athlete's key metrics for that day (§5.1)."
              />
            }
          />
        </Route>

        <Route path="/monitoring" element={<SectionPage section={monitoring!} />}>
          <Route
            index
            element={
              <PlaceholderPane
                title="Availability"
                description="Roster status — Full Go / Limited / Out — filterable by position (§5.2)."
              />
            }
          />
          <Route
            path="readiness"
            element={
              <PlaceholderPane
                title="Readiness"
                description="Team Trend (load trend + ACWR) and Individuals views (§5.2)."
              />
            }
          />
          <Route path="gps" element={<GpsPage />}>
            <Route
              index
              element={
                <PlaceholderPane
                  title="Session Overview"
                  description="All major GPS metrics for the selected session, broken down by athlete (§5.2)."
                />
              }
            />
            <Route
              path="compare"
              element={
                <PlaceholderPane
                  title="Session Compare"
                  description="Multi-session overlay comparison (§5.2)."
                />
              }
            />
            <Route
              path="trends"
              element={
                <PlaceholderPane
                  title="Trends & Recommendations"
                  description="7/14/28/60/90-day ranges, ACWR band, monotony/strain, data completeness, and transparent rule-based recommendations (§5.2)."
                />
              }
            />
          </Route>
        </Route>

        <Route path="/trends" element={<SectionPage section={trends!} />}>
          <Route
            index
            element={
              <PlaceholderPane
                title="Data Trends — Performance"
                description="Graph + table over S&C metrics, sortable by Group or Individual (§5.3)."
              />
            }
          />
          <Route
            path="gps"
            element={
              <PlaceholderPane
                title="Data Trends — GPS"
                description="The same graph + table component over GPS/load metrics (§5.3)."
              />
            }
          />
        </Route>

        <Route path="/performance" element={<SectionPage section={performance!} />}>
          <Route
            index
            element={
              <PlaceholderPane
                title="Performance Overview"
                description="Tiles for all key S&C KPIs (§5.4)."
              />
            }
          />
          <Route
            path="leaderboards"
            element={
              <PlaceholderPane
                title="Leaderboards"
                description="Every eligible S&C metric with value + change vs. a selectable basis — no points anywhere (§5.4)."
              />
            }
          />
          <Route
            path="athlete-profile"
            element={
              <PlaceholderPane
                title="Athlete Profile"
                description="Direction-aware percentile radar (≥5 comparison athletes) plus raw-value metric comparison (§5.4)."
              />
            }
          />
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
