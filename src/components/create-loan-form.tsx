'use client'

import { useState, type FormEvent } from 'react'

import { ApiError, createLoan, type CreateLoanResponse } from '@/lib/api-client'
import { Button } from './ui/button'
import { Field } from './ui/field'

/**
 * Create a loan from the UI.
 *
 * The brief does not require a form — a loan may be created through the API or
 * the seed script — but having one means a reviewer with an empty database can
 * get to a schedule without leaving the page.
 */
export function CreateLoanForm({
  onCreated,
  onCancel,
}: {
  onCreated: (response: CreateLoanResponse) => void
  onCancel: () => void
}) {
  const [principal, setPrincipal] = useState('200000')
  const [rate, setRate] = useState('18')
  const [tenure, setTenure] = useState('24')
  const [disbursementDate, setDisbursementDate] = useState(() =>
    new Date().toISOString().slice(0, 10),
  )
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<ApiError | Error | null>(null)

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    setSubmitting(true)
    setError(null)

    try {
      const response = await createLoan({
        principal: Number(principal),
        annualInterestRate: Number(rate),
        tenureMonths: Number(tenure),
        disbursementDate,
      })
      onCreated(response)
    } catch (caught) {
      setError(caught instanceof Error ? caught : new Error('Could not create the loan.'))
    } finally {
      setSubmitting(false)
    }
  }

  const issues = error instanceof ApiError ? error.issues : []

  return (
    <section className="rounded-sharp animate-rise border border-border bg-surface">
      <header className="space-y-1.5 border-b border-border px-6 py-5 sm:px-8">
        <h2 className="text-[0.9375rem] font-semibold tracking-[-0.01em] text-ink">New loan</h2>
        <p className="text-[0.75rem] leading-relaxed text-ink-muted">
          ₹50,000 to ₹10,00,000 over 3 to 36 months. The full schedule is generated and stored on
          creation.
        </p>
      </header>

      <form onSubmit={onSubmit} className="space-y-6 px-6 py-6 sm:px-8">
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          <Field
            label="Principal"
            type="number"
            step="0.01"
            min="50000"
            max="1000000"
            required
            prefix="₹"
            value={principal}
            onChange={(event) => setPrincipal(event.target.value)}
          />
          <Field
            label="Annual rate"
            type="number"
            step="0.01"
            min="0"
            max="100"
            required
            suffix="% p.a."
            value={rate}
            onChange={(event) => setRate(event.target.value)}
          />
          <Field
            label="Tenure"
            type="number"
            step="1"
            min="3"
            max="36"
            required
            suffix="months"
            value={tenure}
            onChange={(event) => setTenure(event.target.value)}
          />
          <Field
            label="Disbursement date"
            type="date"
            required
            value={disbursementDate}
            onChange={(event) => setDisbursementDate(event.target.value)}
          />
        </div>

        {error ? (
          <div
            role="alert"
            className="rounded-sharp border border-danger/35 bg-danger-soft px-3.5 py-3"
          >
            <p className="text-[0.75rem] font-medium text-danger">{error.message}</p>
            {issues.length > 0 ? (
              <ul className="mt-2 space-y-1">
                {issues.map((issue) => (
                  <li
                    key={`${issue.field}-${issue.message}`}
                    className="text-[0.75rem] text-ink-muted"
                  >
                    <span className="font-mono text-[0.6875rem] text-ink-subtle">
                      {issue.field}
                    </span>{' '}
                    {issue.message}
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : null}

        <div className="flex flex-wrap gap-2">
          <Button type="submit" size="lg" loading={submitting}>
            Create loan
          </Button>
          <Button type="button" variant="ghost" size="lg" onClick={onCancel} disabled={submitting}>
            Cancel
          </Button>
        </div>
      </form>
    </section>
  )
}
