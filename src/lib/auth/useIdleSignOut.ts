/**
 * Application-level inactivity sign-out (spec §7.1): token expiry is not an
 * idle-timeout feature, so the app tracks activity itself. 15 minutes for v1;
 * becomes an app_settings value once settings exist.
 */
import { useEffect } from 'react'
import { useAuth } from './AuthContext.tsx'

export const IDLE_MINUTES = 15

export function useIdleSignOut(): void {
  const { status, signOut } = useAuth()

  useEffect(() => {
    if (status !== 'signed_in') return

    let timer: ReturnType<typeof setTimeout>
    const reset = () => {
      clearTimeout(timer)
      timer = setTimeout(signOut, IDLE_MINUTES * 60 * 1000)
    }
    const events = ['pointermove', 'pointerdown', 'keydown', 'scroll'] as const
    for (const event of events) window.addEventListener(event, reset, { passive: true })
    reset()

    return () => {
      clearTimeout(timer)
      for (const event of events) window.removeEventListener(event, reset)
    }
  }, [status, signOut])
}
