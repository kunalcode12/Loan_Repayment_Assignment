'use client'

import type { LoanDto, PositionDto } from '@/api/serializers'
import { formatMoneyWhole } from '@/lib/format'
import { cn } from './ui/cn'

export interface LoanOption {
  loan: LoanDto
  position: PositionDto
}

function describe(position: PositionDto): string {
  if (position.status === 'CLOSED') return 'closed'
  if (position.overdueAmount.paise > 0) return `${formatMoneyWhole(position.overdueAmount)} overdue`
  return 'on track'
}

/**
 * Chooses which loan is on screen.
 *
 * A native `<select>`, not a bespoke dropdown: it is keyboard accessible and
 * usable on a phone for free, and the list can grow to hundreds of loans
 * without any of this code changing.
 *
 * The popup itself is drawn by the operating system, so it cannot be styled
 * with utility classes — `select` and `select option` get explicit background
 * and colour in `globals.css`, without which the dark theme renders near-white
 * text on the platform's default white popup.
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
  const isEmpty = options.length === 0

  return (
    <div className="flex min-w-0 flex-col gap-2">
      <label htmlFor="loan-picker" className="eyebrow">
        Loan
      </label>

      <div
        className={cn(
          'rounded-sharp relative flex items-center border bg-surface-inset',
          'transition-colors duration-150',
          'focus-within:border-ink',
          disabled || isEmpty ? 'border-border' : 'border-border-strong hover:border-border-loud',
        )}
      >
        <select
          id="loan-picker"
          value={selectedId ?? ''}
          disabled={disabled || isEmpty}
          onChange={(event) => onSelect(event.target.value)}
          className={cn(
            'h-11 w-full appearance-none bg-transparent pr-9 pl-3.5',
            'text-[0.8125rem] text-ink outline-none',
            'disabled:cursor-not-allowed disabled:text-ink-subtle',
            'sm:min-w-[20rem]',
          )}
        >
          {isEmpty ? <option value="">No loans yet</option> : null}
          {options.map(({ loan, position }) => (
            <option key={loan.id} value={loan.id}>
              {`${loan.reference}  ·  ${formatMoneyWhole(loan.principal)}  ·  ${describe(position)}`}
            </option>
          ))}
        </select>

        <svg
          viewBox="0 0 20 20"
          aria-hidden="true"
          className="pointer-events-none absolute right-3 size-3.5 text-ink-subtle"
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
