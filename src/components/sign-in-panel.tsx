'use client'

import { useState, type FormEvent } from 'react'

import { useAuth } from '@/auth/auth-provider'
import { Brand } from './brand'
import { ThemeToggle } from './theme-toggle'
import { Button } from './ui/button'
import { Field } from './ui/field'

type Mode = 'sign-in' | 'sign-up'

/**
 * The screen an unauthenticated visitor sees.
 *
 * This is the "direct unauthenticated users to sign in" half of the auth
 * requirement. It is a gate in the interface only — the API is protected
 * independently, and reaching the dashboard without a valid token would still
 * yield nothing but 401s.
 */
export function SignInPanel() {
  const { signInWithEmail, signUpWithEmail, signInWithGoogle, missingConfig } = useAuth()

  const [mode, setMode] = useState<Mode>('sign-in')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState<'email' | 'google' | null>(null)

  const unconfigured = missingConfig.length > 0

  async function attempt(kind: 'email' | 'google', action: () => Promise<void>) {
    setError(null)
    setPending(kind)
    try {
      await action()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Sign-in failed.')
      setPending(null)
    }
    // On success the auth listener swaps this component out, so `pending` is
    // deliberately left set — it keeps the button disabled through the switch.
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault()
    void attempt('email', () =>
      mode === 'sign-in' ? signInWithEmail(email, password) : signUpWithEmail(email, password),
    )
  }

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-6">
        <Brand />
        <ThemeToggle />
      </header>

      <main className="flex flex-1 items-center justify-center px-6 pb-20">
        <div className="animate-rise w-full max-w-[26rem]">
          <div className="mb-9 space-y-3">
            <h1 className="text-[2.125rem] leading-[1.1] font-semibold tracking-[-0.035em] text-ink sm:text-[2.5rem]">
              Sign in to continue
            </h1>
            <p className="text-[0.9375rem] leading-relaxed text-ink-muted">
              Loan schedules and payments are only available to authenticated users.
            </p>
          </div>

          {unconfigured ? (
            <div className="rounded-2xl border border-warning/40 bg-warning-soft p-5 text-[0.875rem] leading-relaxed text-ink">
              <p className="font-semibold">Firebase is not configured yet.</p>
              <p className="mt-2 text-ink-muted">
                Add the following to <code className="font-mono text-[0.8125rem]">.env.local</code>{' '}
                and restart the dev server:
              </p>
              <ul className="mt-3 space-y-1 font-mono text-[0.75rem] text-ink-muted">
                {missingConfig.map((key) => (
                  <li key={key}>{key}</li>
                ))}
              </ul>
            </div>
          ) : (
            <>
              <form onSubmit={onSubmit} className="space-y-4">
                <Field
                  label="Email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  placeholder="you@example.com"
                  onChange={(event) => setEmail(event.target.value)}
                />
                <Field
                  label="Password"
                  type="password"
                  autoComplete={mode === 'sign-in' ? 'current-password' : 'new-password'}
                  required
                  minLength={6}
                  value={password}
                  placeholder="At least 6 characters"
                  onChange={(event) => setPassword(event.target.value)}
                />

                {error ? (
                  <p role="alert" className="text-[0.875rem] text-danger">
                    {error}
                  </p>
                ) : null}

                <Button
                  type="submit"
                  size="lg"
                  loading={pending === 'email'}
                  disabled={pending !== null}
                  className="w-full"
                >
                  {mode === 'sign-in' ? 'Sign in' : 'Create account'}
                </Button>
              </form>

              <div className="my-7 flex items-center gap-4">
                <span className="hairline flex-1" />
                <span className="eyebrow">or</span>
                <span className="hairline flex-1" />
              </div>

              <Button
                type="button"
                variant="secondary"
                size="lg"
                className="w-full"
                loading={pending === 'google'}
                disabled={pending !== null}
                onClick={() => void attempt('google', signInWithGoogle)}
              >
                <GoogleGlyph />
                Continue with Google
              </Button>

              <p className="mt-7 text-center text-[0.875rem] text-ink-muted">
                {mode === 'sign-in' ? 'Need an account?' : 'Already have an account?'}{' '}
                <button
                  type="button"
                  className="font-medium text-ink underline underline-offset-4 hover:opacity-70"
                  onClick={() => {
                    setMode(mode === 'sign-in' ? 'sign-up' : 'sign-in')
                    setError(null)
                  }}
                >
                  {mode === 'sign-in' ? 'Create one' : 'Sign in'}
                </button>
              </p>
            </>
          )}
        </div>
      </main>
    </div>
  )
}

function GoogleGlyph() {
  return (
    <svg viewBox="0 0 18 18" className="size-[18px]" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62Z"
      />
      <path
        fill="#34A853"
        d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.02-3.7H.96v2.33A9 9 0 0 0 9 18Z"
      />
      <path
        fill="#FBBC05"
        d="M3.98 10.72a5.4 5.4 0 0 1 0-3.44V4.95H.96a9 9 0 0 0 0 8.1l3.02-2.33Z"
      />
      <path
        fill="#EA4335"
        d="M9 3.58c1.32 0 2.5.46 3.44 1.35l2.58-2.58C13.46.9 11.42 0 9 0A9 9 0 0 0 .96 4.95l3.02 2.33C4.68 5.16 6.66 3.58 9 3.58Z"
      />
    </svg>
  )
}
