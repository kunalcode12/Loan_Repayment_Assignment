'use client'

import type { LoanDto, PositionDto } from '@/api/serializers'
import { formatMoneyWhole } from '@/lib/format'
import { cn } from './ui/cn'

export interface LoanOption {
  loan: LoanDto
  position: PositionDto
}

/**
 * Chooses which loan is on screen.
 *
 * A native `<select>` rather than a bespoke dropdown: it is keyboard accessible
 * and usable on a phone for free, and the list can grow to hundreds of loans
 * without any of this code changing.
 */
export function LoanPicker({
  options,
  selectedId,
  onSelect,
  disabled,
}: {
  options: LoanOption[]
  selectedId: string | null
  onSelect: (loanId: string) => void
  disabled?: boolean
}) {
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor="loan-picker" className="eyebrow">
        Loan
      </label>
      <div
        className={cn(
          'relative flex items-center rounded-xl border border-border-strong bg-surface',
          'focus-within:border-ink focus-within:ring-[3px] focus-within:ring-ink/8',
        )}
      >
        <select
          id="loan-picker"
          value={selectedId ?? ''}
          disabled={disabled || options.length === 0}
          onChange={(event) => onSelect(event.target.value)}
          className={cn(
            'h-12 w-full appearance-none bg-transparent pl-4 pr-10 text-[0.9375rem] text-ink',
            'outline-none disabled:opacity-50 sm:min-w-[22rem]',
          )}
        >
          {options.length === 0 ? <option value="">No loans yet</option> : null}
          {options.map(({ loan, position }) => (
            <option key={loan.id} value={loan.id}>
              {loan.reference} · {formatMoneyWhole(loan.principal)} ·{' '}
              {position.overdueAmount.paise > 0
                ? `${formatMoneyWhole(position.overdueAmount)} overdue`
                : position.status === 'CLOSED'
                  ? 'closed'
                  : 'on track'}
            </option>
          ))}
        </select>
        <svg
          viewBox="0 0 20 20"
          aria-hidden="true"
          className="pointer-events-none absolute right-3.5 size-4 text-ink-subtle"
        >
          <path
            d="m5.5 8 4.5 4.5L14.5 8"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
        </svg>
      </div>
    </div>
  )
}
