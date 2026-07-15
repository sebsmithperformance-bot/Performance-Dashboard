import { ShieldAlert } from 'lucide-react'
import { Navigate } from 'react-router'
import { AUTH_MODE, useAuth } from './AuthContext.tsx'

/**
 * Staff sign-in (spec §7.1). Mock mode is a one-click synthetic identity with
 * an unmissable local-only banner; Cognito mode states plainly that it is not
 * wired until the §2.1 spike — no input ever "just works" (§7.3).
 */
export function SignInScreen() {
  const { status, signInMock } = useAuth()
  if (status === 'signed_in') return <Navigate to="/overview" replace />

  return (
    <main className="flex min-h-screen items-center justify-center bg-base p-6">
      <div className="w-full max-w-sm overflow-hidden rounded-card border border-subtle bg-surface">
        <div className="bg-brand-nav px-6 py-5">
          <h1 className="text-widget font-bold text-on-brand">FH Performance Dashboard</h1>
          <p className="mt-1 text-label text-on-brand/80">Performance staff access</p>
        </div>

        <div className="flex flex-col gap-4 p-6">
          {AUTH_MODE === 'mock' ? (
            <>
              <div className="flex items-start gap-2 rounded-control border border-warning/40 bg-warning/15 p-3 text-label text-warning">
                <ShieldAlert aria-hidden className="mt-0.5 size-4 shrink-0" />
                <span>
                  Mock authentication — local development only. Production requires individual
                  Cognito accounts with MFA.
                </span>
              </div>
              <button
                type="button"
                onClick={signInMock}
                className="h-9 rounded-control bg-accent text-body font-medium text-accent-contrast hover:bg-accent-hover active:bg-accent-active"
              >
                Continue as Dev Staff
              </button>
            </>
          ) : (
            <p className="text-body text-secondary">
              Cognito sign-in is not wired yet — it lands with the backend verification spike
              (ADR-001). There is no fallback path.
            </p>
          )}
        </div>
      </div>
    </main>
  )
}
