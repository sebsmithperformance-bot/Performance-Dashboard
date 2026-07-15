import { BrowserRouter } from 'react-router'
import { AppRoutes } from './app/routes.tsx'
import { ErrorBoundary } from './components/ui/ErrorBoundary.tsx'
import { AuthProvider } from './lib/auth/AuthContext.tsx'
import { DevDataProvider } from './lib/data/dev-dataset.tsx'

function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <AuthProvider>
          <DevDataProvider>
            <AppRoutes />
          </DevDataProvider>
        </AuthProvider>
      </BrowserRouter>
    </ErrorBoundary>
  )
}

export default App
