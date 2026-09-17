'use client'

import { useAuth } from '@/auth/auth-provider'
import { Dashboard } from '@/components/dashboard'
import { SignInPanel } from '@/components/sign-in-panel'
import { Spinner } from '@/components/ui/spinner'

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
      <div className="grid min-h-dvh place-items-center">
        <Spinner className="size-6 text-ink-subtle" />
      </div>
    )
  }

  return status === 'signed-in' ? <Dashboard /> : <SignInPanel />
}
