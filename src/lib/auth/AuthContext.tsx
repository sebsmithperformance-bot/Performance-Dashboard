/**
 * Staff auth context (spec §7.1/§7.3, ADR-004). Only the mock provider exists
 * today: it is legal solely when VITE_AUTH_MODE=mock, which the build guard
 * restricts to local builds. The Cognito provider lands with the §2.1 spike —
 * this context is the seam it plugs into. The mock session carries no tokens
 * and grants nothing outside the local dev server.
 */
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'

export interface StaffIdentity {
  sub: string
  displayName: string
}

export const AUTH_MODE: string = import.meta.env.VITE_AUTH_MODE ?? 'mock'

interface AuthValue {
  status: 'signed_in' | 'signed_out'
  identity: StaffIdentity | null
  authMode: string
  signInMock: () => void
  signOut: () => void
}

const STORAGE_KEY = 'fh.mock-session'
const AuthContext = createContext<AuthValue | null>(null)

function readStoredMockIdentity(): StaffIdentity | null {
  if (AUTH_MODE !== 'mock') return null
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as StaffIdentity) : null
  } catch {
    return null
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [identity, setIdentity] = useState<StaffIdentity | null>(readStoredMockIdentity)

  const signInMock = useCallback(() => {
    if (AUTH_MODE !== 'mock') {
      throw new Error('Mock sign-in is only available when VITE_AUTH_MODE=mock (§7.3)')
    }
    const id: StaffIdentity = { sub: 'mock-staff-1', displayName: 'Dev Staff' }
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(id))
    setIdentity(id)
  }, [])

  const signOut = useCallback(() => {
    sessionStorage.removeItem(STORAGE_KEY)
    setIdentity(null)
  }, [])

  const value = useMemo<AuthValue>(
    () => ({
      status: identity ? 'signed_in' : 'signed_out',
      identity,
      authMode: AUTH_MODE,
      signInMock,
      signOut,
    }),
    [identity, signInMock, signOut],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthValue {
  const value = useContext(AuthContext)
  if (!value) throw new Error('useAuth must be used inside AuthProvider')
  return value
}
