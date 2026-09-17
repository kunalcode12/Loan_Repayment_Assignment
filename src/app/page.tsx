'use client'

import { useAuth } from '@/auth/auth-provider'
import { Brand } from '@/components/brand'
import { Dashboard } from '@/components/dashboard'
import { SignInPanel } from '@/components/sign-in-panel'

/**
 * The single page of the application.
 *
 * It renders one of three things: a brief loading state while Firebase restores
 * the session, the sign-in screen, or the dashboard. Note that this gate is a
 * convenience for the user, not the security boundary — the API verifies every
 * request's token server-side regardless of what the browser renders.
 */
export default function Page() {
  const { status } = useAuth()

  if (status === 'loading') {
    return (
      <div className="grid min-h-dvh place-items-center" aria-busy="true">
        <div className="animate-fade flex flex-col items-center gap-5">
          <Brand />
          <span className="h-px w-24 overflow-hidden bg-border">
            <span className="skeleton block h-full w-full" />
          </span>
          <span className="sr-only">Restoring your session</span>
        </div>
      </div>
    )
  }

  return status === 'signed-in' ? <Dashboard /> : <SignInPanel />
}
