'use client'

import type { ReactNode } from 'react'

import type { InstallmentDto, PositionDto } from '@/api/serializers'
import { formatDate, formatMoney, pluralise } from '@/lib/format'
import { Badge, Dot } from './ui/surface'
import { cn } from './ui/cn'

type Status = InstallmentDto['status']

const STATUS_LABEL: Record<Status, string> = {
  PAID: 'Paid',
  PARTIALLY_PAID: 'Part',
  OVERDUE: 'Overdue',
  DUE: 'Due',
}

const STATUS_TONE: Record<Status, 'positive' | 'warning' | 'danger' | 'neutral'> = {
  PAID: 'positive',
  PARTIALLY_PAID: 'warning',
  OVERDUE: 'danger',
  DUE: 'neutral',
}

/**
 * The repayment schedule.
 *
 * Every column the brief asks for is present per instalment: due date,
 * principal component, interest component, total due and amount paid — plus the
 * remaining balance, because that is the number an operator actually reads when
 * deciding what to collect.
 *
 * Wide screens get a table with a sticky header, so the column meanings stay
 * visible through a thirty-six row schedule. Below `sm` the same rows are
 * rendered as cards, because eight numeric columns on a phone are unreadable.
 */
export function ScheduleTable({
  schedule,
  position,
}: {
  schedule: InstallmentDto[]
  position: PositionDto
}) {
  const nextDueNumber = schedule.find((row) => row.amountRemaining.paise > 0)?.installmentNumber
  const paidCount = schedule.filter((row) => row.status === 'PAID').length

  return (
    <section className="rounded-sharp animate-fade flex min-w-0 flex-col border border-border bg-surface">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-6 py-5 sm:px-8">
        <div className="space-y-1.5">
          <h2 className="text-[0.9375rem] font-semibold tracking-[-0.01em] text-ink">
            Repayment schedule
          </h2>
          <p className="text-[0.75rem] text-ink-muted">
            {pluralise(schedule.length, 'instalment')} · {paidCount} settled · as of{' '}
            {formatDate(position.asOf)}
          </p>
        </div>
        <span className="font-mono text-[0.625rem] tracking-[0.1em] text-ink-subtle">
          {paidCount}/{schedule.length}
        </span>
      </header>

      {/* Table: small screens and up */}
      <div className="hidden max-h-[38rem] overflow-auto sm:block">
        <table className="w-full min-w-[52rem] border-collapse text-[0.8125rem]">
          <thead className="sticky top-0 z-10">
            <tr className="bg-surface-muted">
              <Th className="w-12 pl-6 text-left sm:pl-8">#</Th>
              <Th className="text-left">Due date</Th>
              <Th className="text-right">Principal</Th>
              <Th className="text-right">Interest</Th>
              <Th className="text-right">Total due</Th>
              <Th className="text-right">Paid</Th>
              <Th className="text-right">Remaining</Th>
              <Th className="pr-6 text-right sm:pr-8">Status</Th>
            </tr>
          </thead>
          <tbody>
            {schedule.map((row) => (
              <tr
                key={row.id}
                className={cn(
                  'border-t border-border transition-colors duration-100 hover:bg-surface-muted/70',
                  row.installmentNumber === nextDueNumber && 'bg-accent-soft',
                )}
              >
                <Td className="pl-6 text-left font-mono text-[0.75rem] text-ink-subtle sm:pl-8">
                  {String(row.installmentNumber).padStart(2, '0')}
                </Td>
                <Td className="text-left">
                  <span className="text-ink">{formatDate(row.dueDate)}</span>
                  {row.daysPastDue > 0 ? (
                    <span className="ml-2 font-mono text-[0.6875rem] text-danger">
                      +{row.daysPastDue}d
                    </span>
                  ) : null}
                </Td>
                <Td className="text-right text-ink-muted">{formatMoney(row.principalComponent)}</Td>
                <Td className="text-right text-ink-muted">{formatMoney(row.interestComponent)}</Td>
                <Td className="text-right font-medium text-ink">{formatMoney(row.totalDue)}</Td>
                <Td className="text-right text-ink-muted">{formatMoney(row.amountPaid)}</Td>
                <Td
                  className={cn(
                    'text-right font-medium',
                    row.amountRemaining.paise === 0
                      ? 'text-ink-subtle'
                      : row.status === 'OVERDUE'
                        ? 'text-danger'
                        : 'text-ink',
                  )}
                >
                  {formatMoney(row.amountRemaining)}
                </Td>
                <Td className="pr-6 text-right sm:pr-8">
                  <Badge tone={STATUS_TONE[row.status]}>
                    <Dot tone={STATUS_TONE[row.status]} />
                    {STATUS_LABEL[row.status]}
                  </Badge>
                </Td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Cards: phones */}
      <ul className="sm:hidden">
        {schedule.map((row) => (
          <li
            key={row.id}
            className={cn(
              'space-y-3 border-b border-border px-6 py-5 last:border-b-0',
              row.installmentNumber === nextDueNumber && 'bg-accent-soft',
            )}
          >
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[0.875rem] font-medium text-ink">{formatDate(row.dueDate)}</p>
                <p className="mt-1 font-mono text-[0.6875rem] text-ink-subtle">
                  {String(row.installmentNumber).padStart(2, '0')} / {schedule.length}
                  {row.daysPastDue > 0 ? ` · +${row.daysPastDue}d` : ''}
                </p>
              </div>
              <Badge tone={STATUS_TONE[row.status]}>
                <Dot tone={STATUS_TONE[row.status]} />
                {STATUS_LABEL[row.status]}
              </Badge>
            </div>

            <dl className="tabular grid grid-cols-2 gap-x-4 gap-y-1.5 text-[0.75rem]">
              <Cell label="Principal" value={formatMoney(row.principalComponent)} />
              <Cell label="Interest" value={formatMoney(row.interestComponent)} />
              <Cell label="Total due" value={formatMoney(row.totalDue)} strong />
              <Cell label="Paid" value={formatMoney(row.amountPaid)} />
              <Cell
                label="Remaining"
                value={formatMoney(row.amountRemaining)}
                strong
                danger={row.status === 'OVERDUE'}
              />
            </dl>
          </li>
        ))}
      </ul>
    </section>
  )
}

function Th({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <th
      scope="col"
      className={cn(
        'border-b border-border px-3 py-3',
        'text-[0.625rem] font-medium tracking-[0.1em] uppercase text-ink-subtle',
        className,
      )}
    >
      {children}
    </th>
  )
}

function Td({ children, className }: { children: ReactNode; className?: string }) {
  return <td className={cn('tabular px-3 py-3 whitespace-nowrap', className)}>{children}</td>
}

function Cell({
  label,
  value,
  strong,
  danger,
}: {
  label: string
  value: string
  strong?: boolean
  danger?: boolean
}) {
  return (
    <div className="flex justify-between gap-2">
      <dt className="text-ink-subtle">{label}</dt>
      <dd className={cn(strong ? 'font-medium text-ink' : 'text-ink-muted', danger && 'text-danger')}>
        {value}
      </dd>
    </div>
  )
}
