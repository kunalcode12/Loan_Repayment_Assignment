'use client'

import { useCallback, useEffect, useState } from 'react'

import {
  ApiError,
  getLoan,
  listLoans,
  type CreateLoanResponse,
  type LoanDetailResponse,
  type RecordPaymentResponse,
} from '@/lib/api-client'
import { AppHeader } from './app-header'
import { CreateLoanForm } from './create-loan-form'
import { LoanPicker, type LoanOption } from './loan-picker'
import { PaymentForm } from './payment-form'
import { PaymentHistory } from './payment-history'
import { PositionSummary } from './position-summary'
import { ScheduleTable } from './schedule-table'
import { Button } from './ui/button'
import { Panel } from './ui/surface'
import { Spinner } from './ui/spinner'

/**
 * The single page.
 *
 * Data flow worth noting: recording a payment does **not** refetch the loan.
 * `POST /api/payments` already returns the refreshed schedule, position and
 * payment list, so `handleRecorded` drops that straight into state and the table
 * and every metric update in the same tick. No page refresh, no second request.
 */
export function Dashboard() {
  const [loans, setLoans] = useState<LoanOption[] | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [detail, setDetail] = useState<LoanDetailResponse | null>(null)
  const [loadingDetail, setLoadingDetail] = useState(false)
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadLoans = useCallback(async () => {
    try {
      const response = await listLoans()
      setLoans(response.loans)
      setSelectedId((current) => current ?? response.loans[0]?.loan.id ?? null)
    } catch (caught) {
      setLoans([])
      setError(describe(caught))
    }
  }, [])

  useEffect(() => {
    void loadLoans()
  }, [loadLoans])

  useEffect(() => {
    if (!selectedId) {
      setDetail(null)
      return
    }

    let cancelled = false
    setLoadingDetail(true)
    setError(null)

    getLoan(selectedId)
      .then((response) => {
        if (!cancelled) setDetail(response)
      })
      .catch((caught: unknown) => {
        if (!cancelled) setError(describe(caught))
      })
      .finally(() => {
        if (!cancelled) setLoadingDetail(false)
      })

    return () => {
      cancelled = true
    }
  }, [selectedId])

  function handleRecorded(response: RecordPaymentResponse) {
    setDetail({
      loan: response.loan,
      schedule: response.schedule,
      position: response.position,
      payments: response.payments,
    })
    // Keep the picker's summary line honest without a second round trip.
    setLoans((current) =>
      current
        ? current.map((option) =>
            option.loan.id === response.loan.id
              ? { loan: response.loan, position: response.position }
              : option,
          )
        : current,
    )
  }

  function handleCreated(response: CreateLoanResponse) {
    setCreating(false)
    setLoans((current) => [{ loan: response.loan, position: response.position }, ...(current ?? [])])
    setSelectedId(response.loan.id)
  }

  return (
    <div className="flex min-h-dvh flex-col">
      <AppHeader />

      <main className="mx-auto w-full max-w-[84rem] flex-1 px-6 py-10 sm:py-14">
        <div className="mb-10 flex flex-wrap items-end justify-between gap-6">
          <div className="space-y-3">
            <h1 className="text-[2.25rem] leading-[1.05] font-semibold tracking-[-0.04em] text-ink sm:text-[3rem]">
              Loan repayments
            </h1>
            <p className="max-w-xl text-[0.9375rem] leading-relaxed text-ink-muted">
              Schedules, the current position of each loan, and payment allocation.
            </p>
          </div>

          <div className="flex flex-wrap items-end gap-3">
            <LoanPicker
              options={loans ?? []}
              selectedId={selectedId}
              onSelect={setSelectedId}
              disabled={loans === null}
            />
            <Button variant="secondary" size="lg" onClick={() => setCreating((open) => !open)}>
              {creating ? 'Close' : 'New loan'}
            </Button>
          </div>
        </div>

        <div className="space-y-6">
          {creating ? (
            <CreateLoanForm onCreated={handleCreated} onCancel={() => setCreating(false)} />
          ) : null}

          {error ? (
            <Panel className="border-danger/35 bg-danger-soft">
              <p className="text-[0.9375rem] font-medium text-danger">{error}</p>
              <Button
                variant="secondary"
                size="sm"
                className="mt-4"
                onClick={() => {
                  setError(null)
                  void loadLoans()
                }}
              >
                Try again
              </Button>
            </Panel>
          ) : null}

          {loans === null ? (
            <LoadingState label="Loading loans" />
          ) : loans.length === 0 && !creating ? (
            <EmptyState onCreate={() => setCreating(true)} />
          ) : detail === null ? (
            loadingDetail ? (
              <LoadingState label="Loading schedule" />
            ) : null
          ) : (
            <div className="animate-rise space-y-6">
              <PositionSummary loan={detail.loan} position={detail.position} />

              <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_23rem]">
                <ScheduleTable schedule={detail.schedule} position={detail.position} />

                <aside className="space-y-6">
                  <PaymentForm
                    loan={detail.loan}
                    position={detail.position}
                    onRecorded={handleRecorded}
                  />
                  <PaymentHistory payments={detail.payments} />
                </aside>
              </div>
            </div>
          )}
        </div>
      </main>

      <footer className="border-t border-border px-6 py-8">
        <p className="mx-auto max-w-[84rem] text-[0.75rem] text-ink-subtle">
          Amounts are held as integer paise. Payments settle the oldest instalment first, interest
          before principal.
        </p>
      </footer>
    </div>
  )
}

function LoadingState({ label }: { label: string }) {
  return (
    <Panel className="flex items-center justify-center gap-3 py-20">
      <Spinner className="size-5 text-ink-subtle" />
      <span className="text-[0.9375rem] text-ink-muted">{label}…</span>
    </Panel>
  )
}

function EmptyState({ onCreate }: { onCreate: () => void }) {
  return (
    <Panel className="py-20 text-center">
      <h2 className="text-[1.375rem] font-semibold tracking-[-0.02em] text-ink">No loans yet</h2>
      <p className="mx-auto mt-3 max-w-md text-[0.9375rem] leading-relaxed text-ink-muted">
        Create one here, or run <code className="font-mono text-[0.8125rem]">npm run db:seed</code>{' '}
        to load three demo loans that cover on-time, underpaid and overdue cases.
      </p>
      <Button size="lg" className="mt-7" onClick={onCreate}>
        Create a loan
      </Button>
    </Panel>
  )
}

function describe(error: unknown): string {
  if (error instanceof ApiError) return error.message
  if (error instanceof Error) return error.message
  return 'Something went wrong.'
}
