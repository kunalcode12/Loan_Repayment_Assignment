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

  return (
    <header className="sticky top-0 z-20 border-b border-border bg-canvas/85 backdrop-blur-xl">
      <div className="mx-auto flex h-18 w-full max-w-[84rem] items-center justify-between gap-4 px-6">
        <Brand />

        <div className="flex items-center gap-2 sm:gap-3">
          <span
            className="hidden max-w-[16rem] truncate text-[0.8125rem] text-ink-muted sm:block"
            title={identity}
          >
            {identity}
          </span>
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
