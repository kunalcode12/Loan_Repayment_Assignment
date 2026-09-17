'use client'

import { useState, type FormEvent } from 'react'

import type { LoanDto, PositionDto } from '@/api/serializers'
import { ApiError, recordPayment, type RecordPaymentResponse } from '@/lib/api-client'
import { formatDate, formatMoney, pluralise } from '@/lib/format'
import { Button } from './ui/button'
import { Field } from './ui/field'
import { Badge, Panel, PanelHeader } from './ui/surface'
import { cn } from './ui/cn'

/**
 * Record a payment.
 *
 * Two things worth noting:
 *
 * - The response to `POST /api/payments` carries the refreshed schedule and
 *   position, so `onRecorded` updates the whole page from that one response.
 *   Nothing is re-fetched and the page is never reloaded.
 * - Each submission carries a fresh `idempotencyKey`. "Send again" deliberately
 *   reuses the previous key, which is how the duplicate-submission guard can be
 *   seen working: the server replays the original payment and no balance moves.
 */
export function PaymentForm({
  loan,
  position,
  onRecorded,
}: {
  loan: LoanDto
  position: PositionDto
  onRecorded: (response: RecordPaymentResponse) => void
}) {
  const [amount, setAmount] = useState('')
  const [paymentDate, setPaymentDate] = useState(position.asOf)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<ApiError | Error | null>(null)
  const [result, setResult] = useState<RecordPaymentResponse | null>(null)
  const [lastKey, setLastKey] = useState<string | null>(null)

  const settled = position.status === 'CLOSED'

  async function submit(idempotencyKey: string) {
    const parsed = Number(amount)
    if (!Number.isFinite(parsed) || parsed <= 0) {
      setError(new Error('Enter an amount in rupees greater than zero.'))
      return
    }

    setSubmitting(true)
    setError(null)
    try {
      const response = await recordPayment({
        loanId: loan.id,
        amount: parsed,
        paymentDate,
        idempotencyKey,
      })
      setResult(response)
      setLastKey(idempotencyKey)
      onRecorded(response)
    } catch (caught) {
      setError(caught instanceof Error ? caught : new Error('Could not record the payment.'))
    } finally {
      setSubmitting(false)
    }
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault()
    void submit(crypto.randomUUID())
  }

  const suggestions = [
    position.nextDueAmount.paise > 0
      ? { label: 'Next instalment', paise: position.nextDueAmount.paise }
      : null,
    position.overdueAmount.paise > 0
      ? { label: 'Clear overdue', paise: position.overdueAmount.paise }
      : null,
    position.nextDueAmount.paise > 0
      ? { label: 'Two instalments', paise: loan.emi.paise * 2 }
      : null,
  ].filter((value): value is { label: string; paise: number } => value !== null)

  return (
    <Panel className="space-y-6">
      <PanelHeader
        title="Record a payment"
        description={
          settled
            ? 'This loan is fully settled. Anything received now would be held as an unallocated credit.'
            : 'Allocated oldest instalment first, interest before principal.'
        }
      />

      <form onSubmit={onSubmit} className="space-y-5">
        <Field
          label="Amount received"
          type="number"
          inputMode="decimal"
          step="0.01"
          min="0.01"
          required
          prefix="₹"
          placeholder="0.00"
          value={amount}
          onChange={(event) => setAmount(event.target.value)}
        />

        {suggestions.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {suggestions.map((suggestion) => (
              <button
                key={suggestion.label}
                type="button"
                onClick={() => setAmount((suggestion.paise / 100).toFixed(2))}
                className={cn(
                  'tabular rounded-lg border border-border px-3 py-1.5 text-[0.75rem] text-ink-muted',
                  'transition-colors hover:border-border-strong hover:text-ink',
                )}
              >
                {suggestion.label} · ₹{(suggestion.paise / 100).toFixed(2)}
              </button>
            ))}
          </div>
        ) : null}

        <Field
          label="Payment date"
          type="date"
          required
          value={paymentDate}
          hint="Payments dated after a due date are recorded as late; due dates never move."
          onChange={(event) => setPaymentDate(event.target.value)}
        />

        {error ? <ErrorNotice error={error} /> : null}

        <div className="flex flex-wrap gap-3">
          <Button type="submit" size="lg" loading={submitting}>
            Record payment
          </Button>
          {lastKey ? (
            <Button
              type="button"
              variant="secondary"
              size="lg"
              disabled={submitting}
              title="Re-sends the previous request with the same idempotency key"
              onClick={() => void submit(lastKey)}
            >
              Send again
            </Button>
          ) : null}
        </div>
      </form>

      {result ? <AllocationReceipt result={result} /> : null}
    </Panel>
  )
}

function ErrorNotice({ error }: { error: ApiError | Error }) {
  const issues = error instanceof ApiError ? error.issues : []

  return (
    <div role="alert" className="rounded-xl border border-danger/35 bg-danger-soft p-4">
      <p className="text-[0.875rem] font-medium text-danger">{error.message}</p>
      {issues.length > 0 ? (
        <ul className="mt-2 space-y-1 text-[0.8125rem] text-ink-muted">
          {issues.map((issue) => (
            <li key={`${issue.field}-${issue.message}`}>
              <span className="font-mono text-[0.75rem]">{issue.field}</span> — {issue.message}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}

/** What the payment actually did, instalment by instalment. */
function AllocationReceipt({ result }: { result: RecordPaymentResponse }) {
  return (
    <div className="animate-rise space-y-4 rounded-xl border border-border bg-surface-muted/60 p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-[0.875rem] font-medium text-ink">
          {formatMoney(result.payment.amount)} on {formatDate(result.payment.paymentDate)}
        </p>
        {result.duplicate ? (
          <Badge tone="warning">Duplicate — not applied again</Badge>
        ) : (
          <Badge tone="positive">Recorded</Badge>
        )}
      </div>

      {result.duplicate ? (
        <p className="text-[0.8125rem] leading-relaxed text-ink-muted">
          This idempotency key had already been used. The original payment and its allocation are
          shown below; no balance changed.
        </p>
      ) : null}

      {result.allocations.length > 0 ? (
        <ul className="space-y-2">
          {result.allocations.map((allocation) => (
            <li
              key={allocation.installmentId}
              className="tabular flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 text-[0.8125rem]"
            >
              <span className="text-ink-muted">
                Instalment {allocation.installmentNumber} · {formatDate(allocation.dueDate)}
                {allocation.daysLate > 0 ? (
                  <span className="text-danger">
                    {' '}
                    · {pluralise(allocation.daysLate, 'day')} late
                  </span>
                ) : null}
              </span>
              <span className="text-ink">
                {formatMoney(allocation.interest)} interest + {formatMoney(allocation.principal)}{' '}
                principal
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-[0.8125rem] text-ink-muted">
          No instalment could absorb this payment; it is held as an unallocated credit.
        </p>
      )}

      {result.payment.unallocated.paise > 0 ? (
        <p className="tabular text-[0.8125rem] text-ink-muted">
          {formatMoney(result.payment.unallocated)} could not be allocated and is held as credit.
        </p>
      ) : null}
    </div>
  )
}
