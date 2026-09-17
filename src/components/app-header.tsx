'use client'

import { useState } from 'react'

import { useAuth } from '@/auth/auth-provider'
import { Brand } from './brand'
import { ThemeToggle } from './theme-toggle'
import { Button } from './ui/button'

/** Brand, the signed-in identity, the theme switch and the sign-out action. */
export function AppHeader() {
  const { user, signOut } = useAuth()
  const [signingOut, setSigningOut] = useState(false)

  const identity = user?.email ?? user?.displayName ?? 'Signed in'
  const initial = identity.charAt(0).toUpperCase()

  return (
    <header className="sticky top-0 z-20 border-b border-border bg-canvas/80 backdrop-blur-xl">
      <div className="mx-auto flex h-16 w-full max-w-[88rem] items-center justify-between gap-4 px-6 lg:px-8">
        <Brand />

        <div className="flex items-center gap-2 sm:gap-3">
          <div className="hidden items-center gap-2.5 border-r border-border pr-3 sm:flex">
            <span
              aria-hidden="true"
              className="rounded-sharp grid size-6 place-items-center border border-border-strong text-[0.625rem] font-medium text-ink-muted"
            >
              {initial}
            </span>
            <span className="max-w-[14rem] truncate text-[0.75rem] text-ink-muted" title={identity}>
              {identity}
            </span>
          </div>

          <ThemeToggle />

          <Button
            variant="secondary"
            size="sm"
            loading={signingOut}
            onClick={() => {
              setSigningOut(true)
              void signOut().finally(() => setSigningOut(false))
            }}
          >
            Sign out
          </Button>
        </div>
      </div>
    </header>
  )
}
