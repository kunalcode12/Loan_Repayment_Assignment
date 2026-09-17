import { addPaise, minPaise, nonNegative, subtractPaise, ZERO, type Paise } from '@/lib/money'
import { daysBetween, type IsoDate } from '@/lib/date'
import { AppError } from '@/lib/errors'
import type { AllocatableInstallment, AllocationLine, AllocationResult } from './types'

/**
 * Payment allocation.
 *
 * ## Allocation order (the documented decision)
 *
 * 1. **Oldest instalment first.** Instalments are settled strictly in due-date
 *    order, so arrears are always cleared before anything current or future.
 *    This is the order that matters to a borrower in default: their oldest
 *    unpaid bill is the one that closes first.
 * 2. **Interest before principal, within each instalment.** Interest for a
 *    period has already accrued and been earned by the lender; principal is the
 *    balance the borrower still holds. Settling interest first is the standard
 *    lending convention and it means a partial payment never looks like it has
 *    reduced the outstanding balance when it has not.
 * 3. **Cascade.** Whatever is left after an instalment is fully settled moves on
 *    to the next instalment, and so on.
 *
 * ## Underpayment
 *
 * Less than the instalment is simply allocated as far as it goes: interest
 * first, then whatever principal it can cover. The instalment stays partially
 * paid and its shortfall keeps counting towards the overdue figure. Nothing is
 * rejected — a short payment is still money received.
 *
 * ## Overpayment
 *
 * Extra money **settles the following instalments in advance**; it does not
 * reduce principal and re-amortise the loan. Two reasons: prepayment closure is
 * explicitly out of scope for this exercise, and re-amortising would silently
 * rewrite due dates and interest components the borrower has already been
 * quoted. Paying twice the instalment therefore closes the next instalment as
 * well, and the borrower's next due date moves forward a month.
 *
 * ## Excess beyond the whole schedule
 *
 * If every instalment is settled and money is still left, it is *not* forced
 * onto the loan and it is *not* discarded. It is returned as `unallocated`, the
 * payment row keeps it, and the loan reports it as `excessCredit` for an
 * operator to refund or transfer. Money received is never lost.
 *
 * ## Late payment
 *
 * Due dates are fixed at disbursement and lateness never moves them. A late
 * payment settles the arrears it is aimed at, and `daysLate` is recorded on each
 * allocation line as the gap between that instalment's due date and the date the
 * money arrived. So a payment eleven days after the due date clears the overdue
 * amount, leaves an auditable `daysLate` of 11, and — since penalty interest is
 * out of scope — costs the borrower nothing extra. Until it arrives the
 * instalment shows in `overdueAmount` with a rising `daysPastDue`.
 */
export function allocatePayment(params: {
  amount: Paise
  paymentDate: IsoDate
  installments: AllocatableInstallment[]
}): AllocationResult {
  const { amount, paymentDate, installments } = params

  if (amount <= 0) {
    throw AppError.validation('Payment amount must be greater than zero.', [
      { field: 'amount', message: 'Must be a positive amount.' },
    ])
  }

  // Due-date order, with the instalment number as a deterministic tie-break.
  const ordered = [...installments].sort(
    (a, b) => a.dueDate.localeCompare(b.dueDate) || a.installmentNumber - b.installmentNumber,
  )

  const lines: AllocationLine[] = []
  let remaining = amount

  for (const installment of ordered) {
    if (remaining <= 0) break

    const interestOutstanding = nonNegative(installment.interestComponent - installment.interestPaid)
    const principalOutstanding = nonNegative(installment.principalComponent - installment.principalPaid)

    if (interestOutstanding === 0 && principalOutstanding === 0) continue

    const interest = minPaise(remaining, interestOutstanding)
    remaining = subtractPaise(remaining, interest)

    const principal = minPaise(remaining, principalOutstanding)
    remaining = subtractPaise(remaining, principal)

    const total = addPaise(interest, principal)
    if (total === 0) continue

    lines.push({
      installmentId: installment.id,
      installmentNumber: installment.installmentNumber,
      dueDate: installment.dueDate,
      interest,
      principal,
      total,
      daysLate: Math.max(0, daysBetween(installment.dueDate, paymentDate)),
    })
  }

  const allocated = lines.length > 0 ? addPaise(...lines.map((line) => line.total)) : ZERO

  // Invariant: nothing is created or destroyed during allocation.
  if (allocated + remaining !== amount) {
    throw AppError.internal('Allocation did not conserve the payment amount.')
  }

  return { lines, allocated, unallocated: remaining }
}
