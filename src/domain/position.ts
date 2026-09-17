import { addPaise, nonNegative, subtractPaise, ZERO, type Paise } from '@/lib/money'
import { daysBetween, isBefore, type IsoDate } from '@/lib/date'
import type { AllocatableInstallment, InstallmentView, LoanPosition } from './types'

/**
 * Derive the current state of each instalment.
 *
 * `asOf` is the date the position is being asked about (normally today in IST).
 * An instalment is overdue once its due date has *passed*: due today is not yet
 * overdue.
 */
export function buildInstallmentViews(
  installments: AllocatableInstallment[],
  asOf: IsoDate,
): InstallmentView[] {
  return [...installments]
    .sort((a, b) => a.installmentNumber - b.installmentNumber)
    .map((installment) => {
      const totalDue = addPaise(installment.principalComponent, installment.interestComponent)
      const amountPaid = addPaise(installment.principalPaid, installment.interestPaid)
      const amountRemaining = nonNegative(totalDue - amountPaid)
      const isPastDue = isBefore(installment.dueDate, asOf)

      const status: InstallmentView['status'] =
        amountRemaining === 0
          ? 'PAID'
          : isPastDue
            ? 'OVERDUE'
            : amountPaid > 0
              ? 'PARTIALLY_PAID'
              : 'DUE'

      return {
        id: installment.id,
        installmentNumber: installment.installmentNumber,
        dueDate: installment.dueDate,
        principalComponent: installment.principalComponent,
        interestComponent: installment.interestComponent,
        totalDue,
        principalPaid: installment.principalPaid,
        interestPaid: installment.interestPaid,
        amountPaid,
        amountRemaining,
        status,
        daysPastDue: amountRemaining > 0 && isPastDue ? daysBetween(installment.dueDate, asOf) : 0,
      }
    })
}

/**
 * Roll the instalment views up into the loan's position.
 *
 * `outstandingPrincipal` is the principal the borrower still owes across the
 * whole schedule, not just the arrears; `overdueAmount` is only what should
 * already have been paid by `asOf` and has not been.
 */
export function computePosition(params: {
  installments: InstallmentView[]
  excessCredit: Paise
  asOf: IsoDate
}): LoanPosition {
  const { installments, excessCredit, asOf } = params

  const sum = (values: Paise[]): Paise => (values.length > 0 ? addPaise(...values) : ZERO)

  const outstandingPrincipal = sum(
    installments.map((i) => nonNegative(i.principalComponent - i.principalPaid)),
  )
  const outstandingInterest = sum(
    installments.map((i) => nonNegative(i.interestComponent - i.interestPaid)),
  )
  const principalPaid = sum(installments.map((i) => i.principalPaid))
  const interestPaid = sum(installments.map((i) => i.interestPaid))

  const unsettled = installments.filter((i) => i.amountRemaining > 0)
  const overdue = unsettled.filter((i) => isBefore(i.dueDate, asOf))
  const next = unsettled[0]
  const oldestOverdue = overdue[0]

  return {
    asOf,
    status: unsettled.length === 0 ? 'CLOSED' : 'ACTIVE',
    outstandingPrincipal,
    outstandingInterest,
    totalOutstanding: addPaise(outstandingPrincipal, outstandingInterest),
    principalPaid,
    interestPaid,
    totalPaid: addPaise(principalPaid, interestPaid),
    nextDueDate: next ? next.dueDate : null,
    nextDueAmount: next ? next.amountRemaining : ZERO,
    overdueAmount: sum(overdue.map((i) => i.amountRemaining)),
    overdueInstallmentCount: overdue.length,
    daysPastDue: oldestOverdue ? daysBetween(oldestOverdue.dueDate, asOf) : 0,
    excessCredit,
  }
}

/** Convenience wrapper used by the loan service and by the tests. */
export function buildPosition(params: {
  installments: AllocatableInstallment[]
  excessCredit: Paise
  asOf: IsoDate
}): { installments: InstallmentView[]; position: LoanPosition } {
  const views = buildInstallmentViews(params.installments, params.asOf)
  return {
    installments: views,
    position: computePosition({
      installments: views,
      excessCredit: params.excessCredit,
      asOf: params.asOf,
    }),
  }
}

/** Exported for the invariant assertion in the payment service. */
export function remainingOn(installment: AllocatableInstallment): Paise {
  return subtractPaise(
    addPaise(installment.principalComponent, installment.interestComponent),
    addPaise(installment.principalPaid, installment.interestPaid),
  )
}
