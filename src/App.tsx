import { BrowserRouter } from 'react-router'
import { AppRoutes } from './app/routes.tsx'
import { ErrorBoundary } from './components/ui/ErrorBoundary.tsx'
import { AuthProvider } from './lib/auth/AuthContext.tsx'
import { DashboardDataProviderBoundary } from './lib/dashboard/DashboardDataContext.tsx'
import { createLocalDashboardProvider } from './lib/dashboard/local-provider.ts'
import { createLocalSettingsRepository } from './lib/settings/local-settings.ts'
import { SettingsProvider } from './lib/settings/SettingsContext.tsx'

/**
 * The two replaceable seams: dashboard data (local synthetic provider today,
 * AWS provider after the §2.1 spike) and coach settings (localStorage today,
 * server-persisted later) — pages depend only on the context contracts.
 */
const dashboardProvider = createLocalDashboardProvider()
const settingsRepository = createLocalSettingsRepository()

function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <AuthProvider>
          <SettingsProvider repository={settingsRepository}>
            <DashboardDataProviderBoundary provider={dashboardProvider}>
              <AppRoutes />
            </DashboardDataProviderBoundary>
          </SettingsProvider>
        </AuthProvider>
      </BrowserRouter>
    </ErrorBoundary>
  )
}

export default App
