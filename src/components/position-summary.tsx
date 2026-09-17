'use client'

import type { LoanDto, PositionDto } from '@/api/serializers'
import {
  describeDueDistance,
  formatDate,
  formatMoney,
  formatMoneyWhole,
  formatPercent,
  pluralise,
} from '@/lib/format'
import { Badge, Dot, Panel } from './ui/surface'
import { cn } from './ui/cn'

/**
 * The loan's current position.
 *
 * The three figures the brief asks to be visible — outstanding principal, the
 * next due date and amount, and any overdue amount — are the three tiles below
 * the headline, in that order. Overdue is styled as an alert only when there
 * actually is one, so a healthy loan reads as calm.
 */
export function PositionSummary({ loan, position }: { loan: LoanDto; position: PositionDto }) {
  const isOverdue = position.overdueAmount.paise > 0
  const isClosed = position.status === 'CLOSED'

  return (
    <Panel className="overflow-hidden" padded={false}>
      <div className="flex flex-col gap-8 p-6 sm:p-8">
        <div className="flex flex-wrap items-start justify-between gap-5">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="font-mono text-[0.8125rem] tracking-[0.04em] text-ink-muted">
                {loan.reference}
              </span>
              {isClosed ? (
                <Badge tone="positive">
                  <Dot tone="positive" />
                  Closed
                </Badge>
              ) : isOverdue ? (
                <Badge tone="danger">
                  <Dot tone="danger" />
                  {pluralise(position.overdueInstallmentCount, 'instalment')} overdue
                </Badge>
              ) : (
                <Badge tone="positive">
                  <Dot tone="positive" />
                  On track
                </Badge>
              )}
            </div>

            <p className="eyebrow">Total outstanding</p>
            <p className="tabular text-[2.75rem] leading-[0.95] font-semibold tracking-[-0.04em] text-ink sm:text-[3.5rem]">
              {formatMoneyWhole(position.totalOutstanding)}
            </p>
            <p className="tabular text-[0.875rem] text-ink-muted">
              {formatMoney(position.totalPaid)} repaid of {formatMoney(loan.totalPayable)}
            </p>
          </div>

          <dl className="grid shrink-0 grid-cols-2 gap-x-10 gap-y-4 text-[0.875rem] sm:grid-cols-1 sm:gap-y-3.5">
            <Fact label="Principal" value={formatMoneyWhole(loan.principal)} />
            <Fact label="Rate" value={`${formatPercent(loan.annualInterestRate)} p.a.`} />
            <Fact label="Tenure" value={pluralise(loan.tenureMonths, 'month')} />
            <Fact label="Instalment" value={formatMoney(loan.emi)} />
            <Fact label="Disbursed" value={formatDate(loan.disbursementDate)} />
          </dl>
        </div>

        <ProgressBar position={position} totalPayable={loan.totalPayable.paise} />
      </div>

      <div className="grid grid-cols-1 border-t border-border sm:grid-cols-3">
        <Metric
          label="Outstanding principal"
          value={formatMoney(position.outstandingPrincipal)}
          caption={`plus ${formatMoney(position.outstandingInterest)} interest still to accrue`}
        />
        <Metric
          label="Next instalment"
          value={position.nextDueAmount.paise > 0 ? formatMoney(position.nextDueAmount) : '—'}
          caption={
            position.nextDueDate
              ? `${formatDate(position.nextDueDate)} · ${describeDueDistance(position.nextDueDate, position.asOf)}`
              : 'Schedule fully settled'
          }
          className="border-t border-border sm:border-t-0 sm:border-l"
        />
        <Metric
          label="Overdue"
          value={formatMoney(position.overdueAmount)}
          caption={
            isOverdue
              ? `${pluralise(position.overdueInstallmentCount, 'instalment')} · oldest ${pluralise(position.daysPastDue, 'day')} past due`
              : 'Nothing past due'
          }
          tone={isOverdue ? 'danger' : 'default'}
          className="border-t border-border sm:border-t-0 sm:border-l"
        />
      </div>

      {position.excessCredit.paise > 0 ? (
        <p className="border-t border-border bg-info-soft px-6 py-4 text-[0.8125rem] text-ink sm:px-8">
          <span className="font-semibold">{formatMoney(position.excessCredit)}</span> was received
          beyond the full value of this schedule and is held as an unallocated credit.
        </p>
      ) : null}
    </Panel>
  )
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline gap-3 sm:justify-between">
      <dt className="text-ink-subtle">{label}</dt>
      <dd className="tabular font-medium text-ink">{value}</dd>
    </div>
  )
}

function Metric({
  label,
  value,
  caption,
  tone = 'default',
  className,
}: {
  label: string
  value: string
  caption: string
  tone?: 'default' | 'danger'
  className?: string
}) {
  return (
    <div className={cn('px-6 py-6 sm:px-8', className)}>
      <p className="eyebrow">{label}</p>
      <p
        className={cn(
          'tabular mt-3 text-[1.625rem] leading-none font-semibold tracking-[-0.03em]',
          tone === 'danger' ? 'text-danger' : 'text-ink',
        )}
      >
        {value}
      </p>
      <p className="mt-2.5 text-[0.8125rem] leading-relaxed text-ink-muted">{caption}</p>
    </div>
  )
}

function ProgressBar({ position, totalPayable }: { position: PositionDto; totalPayable: number }) {
  const paid = position.totalPaid.paise
  const overdue = position.overdueAmount.paise
  const paidPercent = totalPayable > 0 ? Math.min(100, (paid / totalPayable) * 100) : 0
  const overduePercent = totalPayable > 0 ? Math.min(100 - paidPercent, (overdue / totalPayable) * 100) : 0

  return (
    <div className="space-y-2.5">
      <div
        className="flex h-2 w-full overflow-hidden rounded-full bg-surface-muted"
        role="img"
        aria-label={`${paidPercent.toFixed(0)}% of the total payable has been repaid`}
      >
        <span
          className="h-full bg-ink transition-[width] duration-500"
          style={{ width: `${paidPercent}%` }}
        />
        <span
          className="h-full bg-danger transition-[width] duration-500"
          style={{ width: `${overduePercent}%` }}
        />
      </div>
      <div className="tabular flex justify-between text-[0.75rem] text-ink-subtle">
        <span>{paidPercent.toFixed(0)}% repaid</span>
        <span>Position as of {formatDate(position.asOf)}</span>
      </div>
    </div>
  )
}
