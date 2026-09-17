'use client'

import { useState, type FormEvent } from 'react'

import { useAuth } from '@/auth/auth-provider'
import { Brand } from './brand'
import { ThemeToggle } from './theme-toggle'
import { Button } from './ui/button'
import { cn } from './ui/cn'
import { Field } from './ui/field'

type Mode = 'sign-in' | 'sign-up'

const CAPABILITIES = [
  {
    index: '01',
    title: 'Schedules to the paisa',
    body: 'Equal monthly instalments, amortised month by month, with the final instalment carrying the rounding residue so principal repays exactly.',
  },
  {
    index: '02',
    title: 'Deterministic allocation',
    body: 'Every payment settles the oldest instalment first and interest before principal. Underpayments, overpayments and late payments all have one defined outcome.',
  },
  {
    index: '03',
    title: 'Payments captured once',
    body: 'Idempotency keys are enforced by a database constraint, so a retried or double-clicked payment can never be applied twice.',
  },
]

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
    // deliberately left set — it keeps the buttons disabled through the switch.
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault()
    void attempt('email', () =>
      mode === 'sign-in' ? signInWithEmail(email, password) : signUpWithEmail(email, password),
    )
  }

  return (
    <div className="grid min-h-dvh lg:grid-cols-[1.05fr_minmax(30rem,0.95fr)]">
      {/* Context pane — the product, for anyone who arrives cold. */}
      <aside className="relative hidden overflow-hidden border-r border-border bg-surface-inset lg:flex lg:flex-col">
        <div className="grid-bg grid-fade pointer-events-none absolute inset-0" />

        <div className="relative flex flex-1 flex-col justify-between p-12 xl:p-16">
          <Brand />

          <div className="max-w-xl py-16">
            <p className="eyebrow mb-6">Loan servicing · Repayments</p>
            <h1 className="text-[2.75rem] leading-[1.02] font-semibold tracking-[-0.04em] text-ink xl:text-[3.25rem]">
              Repayment infrastructure for MSME lending.
            </h1>
            <p className="mt-6 max-w-lg text-[0.9375rem] leading-relaxed text-ink-muted">
              Generate a repayment schedule, record payments against it, and report the position of
              a loan at any moment — correct under underpayment, overpayment, late arrival and
              duplicate submission.
            </p>

            <ul className="mt-12 space-y-7">
              {CAPABILITIES.map((capability) => (
                <li key={capability.index} className="flex gap-5">
                  <span className="mt-0.5 font-mono text-[0.6875rem] tracking-[0.1em] text-ink-subtle">
                    {capability.index}
                  </span>
                  <div className="space-y-1.5 border-l border-border pl-5">
                    <p className="text-[0.875rem] font-medium text-ink">{capability.title}</p>
                    <p className="max-w-md text-[0.8125rem] leading-relaxed text-ink-muted">
                      {capability.body}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </div>

          <p className="font-mono text-[0.6875rem] tracking-[0.08em] text-ink-subtle">
            AMOUNTS HELD AS INTEGER PAISE · NO FLOATING POINT MONEY
          </p>
        </div>
      </aside>

      {/* Authentication pane. */}
      <main className="flex flex-col">
        <div className="flex items-center justify-between border-b border-border px-6 py-5 lg:justify-end lg:border-b-0 lg:px-10">
          <span className="lg:hidden">
            <Brand />
          </span>
          <ThemeToggle />
        </div>

        <div className="flex flex-1 items-center justify-center px-6 pb-16 lg:px-10">
          <div className="animate-rise w-full max-w-[24rem]">
            <div className="mb-8">
              <h2 className="text-[1.75rem] leading-tight font-semibold tracking-[-0.03em] text-ink">
                {mode === 'sign-in' ? 'Sign in' : 'Create an account'}
              </h2>
              <p className="mt-2 text-[0.8125rem] leading-relaxed text-ink-muted">
                {mode === 'sign-in'
                  ? 'Schedules and payments are available to authenticated users only.'
                  : 'Any account can view and service every loan; loans are not owned by individual users.'}
              </p>
            </div>

            {unconfigured ? (
              <div className="rounded-sharp border border-warning/40 bg-warning-soft p-5">
                <p className="text-[0.8125rem] font-semibold text-ink">Firebase is not configured</p>
                <p className="mt-2 text-[0.8125rem] leading-relaxed text-ink-muted">
                  Add these to <code className="font-mono text-[0.75rem]">.env.local</code> and
                  restart the dev server:
                </p>
                <ul className="mt-3 space-y-1">
                  {missingConfig.map((key) => (
                    <li key={key} className="font-mono text-[0.6875rem] text-ink-muted">
                      {key}
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <>
                {/* Mode switch */}
                <div
                  role="group"
                  aria-label="Authentication mode"
                  className="rounded-sharp mb-7 grid grid-cols-2 border border-border p-1"
                >
                  {(['sign-in', 'sign-up'] as const).map((value) => (
                    <button
                      key={value}
                      type="button"
                      aria-pressed={mode === value}
                      onClick={() => {
                        setMode(value)
                        setError(null)
                      }}
                      className={cn(
                        'rounded-sharp h-8 text-[0.75rem] font-medium transition-colors duration-150',
                        mode === value
                          ? 'bg-accent text-accent-ink'
                          : 'text-ink-muted hover:text-ink',
                      )}
                    >
                      {value === 'sign-in' ? 'Sign in' : 'Register'}
                    </button>
                  ))}
                </div>

                <form onSubmit={onSubmit} className="space-y-5">
                  <Field
                    label="Email"
                    type="email"
                    autoComplete="email"
                    required
                    value={email}
                    placeholder="you@company.com"
                    onChange={(event) => setEmail(event.target.value)}
                  />
                  <Field
                    label="Password"
                    type="password"
                    autoComplete={mode === 'sign-in' ? 'current-password' : 'new-password'}
                    required
                    minLength={6}
                    value={password}
                    placeholder="••••••••"
                    hint={mode === 'sign-up' ? 'At least six characters.' : undefined}
                    onChange={(event) => setPassword(event.target.value)}
                  />

                  {error ? (
                    <div
                      role="alert"
                      className="rounded-sharp border border-danger/35 bg-danger-soft px-3.5 py-3"
                    >
                      <p className="text-[0.75rem] leading-relaxed text-danger">{error}</p>
                    </div>
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

                <div className="my-6 flex items-center gap-4">
                  <span className="h-px flex-1 bg-border" />
                  <span className="eyebrow">or</span>
                  <span className="h-px flex-1 bg-border" />
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

                <p className="mt-8 text-center text-[0.75rem] leading-relaxed text-ink-subtle">
                  Every request is verified server-side with the Firebase Admin SDK.
                </p>
              </>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}

function GoogleGlyph() {
  return (
    <svg viewBox="0 0 18 18" className="size-4" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62Z"
      />
      <path
        fill="#34A853"
        d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.02-3.7H.96v2.33A9 9 0 0 0 9 18Z"
      />
      <path fill="#FBBC05" d="M3.98 10.72a5.4 5.4 0 0 1 0-3.44V4.95H.96a9 9 0 0 0 0 8.1l3.02-2.33Z" />
      <path
        fill="#EA4335"
        d="M9 3.58c1.32 0 2.5.46 3.44 1.35l2.58-2.58C13.46.9 11.42 0 9 0A9 9 0 0 0 .96 4.95l3.02 2.33C4.68 5.16 6.66 3.58 9 3.58Z"
      />
    </svg>
  )
}
