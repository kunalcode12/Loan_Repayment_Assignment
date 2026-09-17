'use client'

import { useEffect, useState } from 'react'

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
import { PanelSkeleton, SummarySkeleton, TableSkeleton } from './ui/skeleton'

/**
 * The single page.
 *
 * Data flow worth noting: recording a payment does **not** refetch the loan.
 * `POST /api/payments` already returns the refreshed schedule, position and
 * payment list, so `handleRecorded` drops that straight into state and the
 * table and every metric update in the same tick. No page refresh, no second
 * request.
 */
export function Dashboard() {
  const [loans, setLoans] = useState<LoanOption[] | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [detail, setDetail] = useState<LoanDetailResponse | null>(null)
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [reloadToken, setReloadToken] = useState(0)

  useEffect(() => {
    let cancelled = false

    listLoans()
      .then((response) => {
        if (cancelled) return
        setLoans(response.loans)
        setSelectedId((current) => current ?? response.loans[0]?.loan.id ?? null)
      })
      .catch((caught: unknown) => {
        if (cancelled) return
        setLoans([])
        setError(describe(caught))
      })

    return () => {
      cancelled = true
    }
  }, [reloadToken])

  useEffect(() => {
    if (!selectedId) return

    let cancelled = false

    getLoan(selectedId)
      .then((response) => {
        if (!cancelled) setDetail(response)
      })
      .catch((caught: unknown) => {
        if (!cancelled) setError(describe(caught))
      })

    return () => {
      cancelled = true
    }
  }, [selectedId])

  // `detail` is only shown when it belongs to the selected loan, so switching
  // loans shows the skeleton rather than the previous loan's schedule.
  const activeDetail = detail && detail.loan.id === selectedId ? detail : null
  const loadingDetail = selectedId !== null && activeDetail === null && error === null

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

  const isEmpty = loans !== null && loans.length === 0

  return (
    <div className="flex min-h-dvh flex-col">
      <AppHeader />

      {/* Title and controls */}
      <div className="border-b border-border">
        <div className="mx-auto flex w-full max-w-[88rem] flex-wrap items-end justify-between gap-6 px-6 py-8 lg:px-8 lg:py-10">
          <div className="space-y-2.5">
            <p className="eyebrow">Loan servicing</p>
            <h1 className="text-[2rem] leading-[1.05] font-semibold tracking-[-0.04em] text-ink sm:text-[2.5rem]">
              Loan repayments
            </h1>
            <p className="max-w-xl text-[0.875rem] leading-relaxed text-ink-muted">
              Schedules, the current position of each loan, and payment allocation.
            </p>
          </div>

          <div className="flex flex-wrap items-end gap-2">
            <LoanPicker
              options={loans ?? []}
              selectedId={selectedId}
              onSelect={setSelectedId}
              disabled={loans === null}
            />
            <Button
              variant={isEmpty ? 'primary' : 'secondary'}
              size="lg"
              onClick={() => setCreating((open) => !open)}
            >
              {creating ? 'Close' : 'New loan'}
            </Button>
          </div>
        </div>
      </div>

      <main className="mx-auto w-full max-w-[88rem] flex-1 space-y-5 px-6 py-8 lg:px-8">
        {creating ? (
          <CreateLoanForm onCreated={handleCreated} onCancel={() => setCreating(false)} />
        ) : null}

        {error ? (
          <section className="rounded-sharp animate-rise border border-danger/35 bg-danger-soft px-6 py-5 sm:px-8">
            <p className="text-[0.875rem] font-medium text-danger">{error}</p>
            <Button
              variant="secondary"
              size="sm"
              className="mt-4"
              onClick={() => {
                setError(null)
                setDetail(null)
                setReloadToken((token) => token + 1)
              }}
            >
              Try again
            </Button>
          </section>
        ) : null}

        {loans === null ? (
          <LoadingLayout />
        ) : isEmpty && !creating ? (
          <EmptyState onCreate={() => setCreating(true)} />
        ) : loadingDetail ? (
          <LoadingLayout />
        ) : activeDetail ? (
          <div className="space-y-5">
            <PositionSummary loan={activeDetail.loan} position={activeDetail.position} />

            <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_23rem]">
              <ScheduleTable schedule={activeDetail.schedule} position={activeDetail.position} />

              <aside className="space-y-5">
                <PaymentForm
                  key={activeDetail.loan.id}
                  loan={activeDetail.loan}
                  position={activeDetail.position}
                  onRecorded={handleRecorded}
                />
                <PaymentHistory payments={activeDetail.payments} />
              </aside>
            </div>
          </div>
        ) : null}
      </main>

      <footer className="border-t border-border">
        <div className="mx-auto flex w-full max-w-[88rem] flex-wrap justify-between gap-3 px-6 py-6 lg:px-8">
          <p className="font-mono text-[0.625rem] tracking-[0.1em] text-ink-subtle">
            INTEGER PAISE · OLDEST INSTALMENT FIRST · INTEREST BEFORE PRINCIPAL
          </p>
          <p className="font-mono text-[0.625rem] tracking-[0.1em] text-ink-subtle">
            SERVER-VERIFIED FIREBASE ID TOKENS
          </p>
        </div>
      </footer>
    </div>
  )
}

/** Mirrors the real layout so nothing shifts when the data lands. */
function LoadingLayout() {
  return (
    <div className="space-y-5">
      <SummarySkeleton />
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_23rem]">
        <TableSkeleton />
        <aside className="space-y-5">
          <PanelSkeleton lines={3} />
          <PanelSkeleton lines={2} />
        </aside>
      </div>
    </div>
  )
}

const STEPS = [
  {
    index: '01',
    title: 'Create a loan',
    body: 'Principal, annual rate, tenure and disbursement date. The full amortisation schedule is generated and stored in one transaction.',
  },
  {
    index: '02',
    title: 'Record a payment',
    body: 'Any amount, any date. It settles the oldest instalment first, interest before principal, and cascades forward if it is more than one instalment.',
  },
  {
    index: '03',
    title: 'Read the position',
    body: 'Outstanding principal, the next due date and amount, and anything overdue — recalculated and on screen without a page refresh.',
  },
]

function EmptyState({ onCreate }: { onCreate: () => void }) {
  return (
    <section className="rounded-sharp animate-rise border border-border bg-surface">
      <div className="relative overflow-hidden border-b border-border px-6 py-12 text-center sm:px-8">
        <div className="grid-bg grid-fade pointer-events-none absolute inset-0" />
        <div className="relative">
          <p className="eyebrow">Nothing to service yet</p>
          <h2 className="mt-4 text-[1.75rem] leading-tight font-semibold tracking-[-0.03em] text-ink">
            Create your first loan
          </h2>
          <p className="mx-auto mt-3 max-w-md text-[0.875rem] leading-relaxed text-ink-muted">
            Or run <code className="font-mono text-[0.8125rem] text-ink">npm run db:seed</code> to
            load three demo loans covering on-time, underpaid and overdue cases.
          </p>
          <Button size="lg" className="mt-7" onClick={onCreate}>
            Create a loan
          </Button>
        </div>
      </div>

      <ol className="grid sm:grid-cols-3">
        {STEPS.map((step, index) => (
          <li
            key={step.index}
            className={`space-y-2.5 px-6 py-7 sm:px-8 ${
              index > 0 ? 'border-t border-border sm:border-t-0 sm:border-l' : ''
            }`}
          >
            <span className="font-mono text-[0.6875rem] tracking-[0.12em] text-ink-subtle">
              {step.index}
            </span>
            <p className="text-[0.875rem] font-medium text-ink">{step.title}</p>
            <p className="text-[0.75rem] leading-relaxed text-ink-muted">{step.body}</p>
          </li>
        ))}
      </ol>
    </section>
  )
}

function describe(error: unknown): string {
  if (error instanceof ApiError) return error.message
  if (error instanceof Error) return error.message
  return 'Something went wrong.'
}
