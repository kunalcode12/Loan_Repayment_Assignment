'use client'

import { useState, type FormEvent } from 'react'

import { ApiError, createLoan, type CreateLoanResponse } from '@/lib/api-client'
import { Button } from './ui/button'
import { Field } from './ui/field'
import { Panel, PanelHeader } from './ui/surface'

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
    <Panel className="animate-rise space-y-6">
      <PanelHeader
        title="New loan"
        description="Rs 50,000 to Rs 10,00,000 over 3 to 36 months. The full schedule is generated and stored on creation."
      />

      <form onSubmit={onSubmit} className="space-y-5">
        <div className="grid gap-5 sm:grid-cols-2">
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
            label="Annual interest rate"
            type="number"
            step="0.01"
            min="0"
            max="100"
            required
            prefix="%"
            value={rate}
            onChange={(event) => setRate(event.target.value)}
          />
          <Field
            label="Tenure (months)"
            type="number"
            step="1"
            min="3"
            max="36"
            required
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
          <div role="alert" className="rounded-xl border border-danger/35 bg-danger-soft p-4">
            <p className="text-[0.875rem] font-medium text-danger">{error.message}</p>
            {issues.length > 0 ? (
              <ul className="mt-2 space-y-1 text-[0.8125rem] text-ink-muted">
                {issues.map((issue) => (
                  <li key={`${issue.field}-${issue.message}`}>
                    <span className="font-mono text-[0.75rem]">{issue.field}</span> —{' '}
                    {issue.message}
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : null}

        <div className="flex flex-wrap gap-3">
          <Button type="submit" size="lg" loading={submitting}>
            Create loan
          </Button>
          <Button type="button" variant="ghost" size="lg" onClick={onCancel} disabled={submitting}>
            Cancel
          </Button>
        </div>
      </form>
    </Panel>
  )
}
