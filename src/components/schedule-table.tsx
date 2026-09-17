'use client'

import type { InstallmentDto, PositionDto } from '@/api/serializers'
import { formatDate, formatMoney, pluralise } from '@/lib/format'
import { Badge, Dot, Panel, PanelHeader } from './ui/surface'
import { cn } from './ui/cn'

type Status = InstallmentDto['status']

const STATUS_LABEL: Record<Status, string> = {
  PAID: 'Paid',
  PARTIALLY_PAID: 'Part paid',
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
 * Wide screens get a table; below `sm` the same rows are rendered as cards,
 * because eight numeric columns squeezed into a phone are unreadable.
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
    <Panel padded={false}>
      <div className="p-6 sm:p-8 sm:pb-6">
        <PanelHeader
          title="Repayment schedule"
          description={`${pluralise(schedule.length, 'instalment')} · ${paidCount} settled · position as of ${formatDate(position.asOf)}`}
        />
      </div>

      {/* Table: small screens and up */}
      <div className="hidden overflow-x-auto sm:block">
        <table className="w-full min-w-[54rem] border-collapse text-[0.875rem]">
          <thead>
            <tr className="border-y border-border bg-surface-muted/60">
              <Th className="w-14 pl-6 text-left sm:pl-8">#</Th>
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
                  'border-b border-border last:border-b-0 transition-colors hover:bg-surface-muted/50',
                  row.installmentNumber === nextDueNumber && 'bg-accent-soft/60',
                )}
              >
                <Td className="pl-6 text-left text-ink-subtle sm:pl-8">
                  {row.installmentNumber}
                </Td>
                <Td className="text-left">
                  <span className="text-ink">{formatDate(row.dueDate)}</span>
                  {row.daysPastDue > 0 ? (
                    <span className="ml-2 text-[0.75rem] text-danger">
                      +{pluralise(row.daysPastDue, 'day')}
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
      <ul className="divide-y divide-border border-t border-border sm:hidden">
        {schedule.map((row) => (
          <li
            key={row.id}
            className={cn(
              'space-y-3 px-6 py-5',
              row.installmentNumber === nextDueNumber && 'bg-accent-soft/60',
            )}
          >
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[0.9375rem] font-medium text-ink">{formatDate(row.dueDate)}</p>
                <p className="mt-0.5 text-[0.75rem] text-ink-subtle">
                  Instalment {row.installmentNumber} of {schedule.length}
                  {row.daysPastDue > 0 ? ` · +${pluralise(row.daysPastDue, 'day')}` : ''}
                </p>
              </div>
              <Badge tone={STATUS_TONE[row.status]}>
                <Dot tone={STATUS_TONE[row.status]} />
                {STATUS_LABEL[row.status]}
              </Badge>
            </div>

            <dl className="tabular grid grid-cols-2 gap-x-4 gap-y-2 text-[0.8125rem]">
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
    </Panel>
  )
}

function Th({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <th
      scope="col"
      className={cn('px-3 py-3.5 text-[0.6875rem] font-semibold tracking-[0.07em] uppercase text-ink-subtle', className)}
    >
      {children}
    </th>
  )
}

function Td({ children, className }: { children: React.ReactNode; className?: string }) {
  return <td className={cn('tabular px-3 py-4 whitespace-nowrap', className)}>{children}</td>
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
      <dd
        className={cn(
          strong ? 'font-medium text-ink' : 'text-ink-muted',
          danger && 'text-danger',
        )}
      >
        {value}
      </dd>
    </div>
  )
}
