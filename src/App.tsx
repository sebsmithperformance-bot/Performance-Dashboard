import { BrowserRouter } from 'react-router'
import { AppRoutes } from './app/routes.tsx'
import { ErrorBoundary } from './components/ui/ErrorBoundary.tsx'
import { AuthProvider } from './lib/auth/AuthContext.tsx'
import { DashboardDataProviderBoundary } from './lib/dashboard/DashboardDataContext.tsx'
import { createLocalDashboardProvider } from './lib/dashboard/local-provider.ts'

/**
 * The dashboard data seam: local synthetic provider today, AWS provider after
 * the §2.1 spike — pages depend only on the boundary's contract.
 */
const dashboardProvider = createLocalDashboardProvider()

function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <AuthProvider>
          <DashboardDataProviderBoundary provider={dashboardProvider}>
            <AppRoutes />
          </DashboardDataProviderBoundary>
        </AuthProvider>
      </BrowserRouter>
    </ErrorBoundary>
  )
}

export default App
