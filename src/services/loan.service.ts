import { withTransaction } from '@/db/client'
import { insertInstallments, listInstallmentsByLoan } from '@/db/repositories/installments.repo'
import { findLoanById, insertLoan, listLoans } from '@/db/repositories/loans.repo'
import { listPaymentsByLoan, sumUnallocatedForLoan } from '@/db/repositories/payments.repo'
import { buildPosition } from '@/domain/position'
import { generateSchedule } from '@/domain/schedule'
import type { InstallmentView, Loan, LoanPosition, Payment } from '@/domain/types'
import { today, type IsoDate } from '@/lib/date'
import { AppError } from '@/lib/errors'
import type { BasisPoints, Paise } from '@/lib/money'

export interface CreateLoanInput {
  principal: Paise
  annualRateBps: BasisPoints
  tenureMonths: number
  disbursementDate: IsoDate
}

export interface LoanDetail {
  loan: Loan
  installments: InstallmentView[]
  position: LoanPosition
  payments: Payment[]
}

export async function createLoan(input: CreateLoanInput): Promise<LoanDetail> {
  const schedule = generateSchedule({
    principal: input.principal,
    annualRateBps: input.annualRateBps,
    tenureMonths: input.tenureMonths,
    disbursementDate: input.disbursementDate,
  })

  const loan = await withTransaction(async (client) => {
    const created = await insertLoan(client, {
      principal: input.principal,
      annualRateBps: input.annualRateBps,
      tenureMonths: input.tenureMonths,
      disbursementDate: input.disbursementDate,
      emi: schedule.emi,
      totalInterest: schedule.totalInterest,
      totalPayable: schedule.totalPayable,
    })
    await insertInstallments(client, created.id, schedule.installments)
    return created
  })

  return getLoanDetail(loan.id)
}

/**
 * The loan, its schedule, its position and its payment history.
 *
 * `asOf` decides what counts as overdue and defaults to today in IST. It is a
 * parameter rather than a hard-coded `now()` so the behaviour is testable and so
 * an operator can ask what the position looked like on a given date.
 */
export async function getLoanDetail(loanId: string, asOf: IsoDate = today()): Promise<LoanDetail> {
  const loan = await findLoanById(loanId)
  if (!loan) {
    throw AppError.notFound(`No loan exists with id "${loanId}".`)
  }

  const [installments, excessCredit, payments] = await Promise.all([
    listInstallmentsByLoan(loanId),
    sumUnallocatedForLoan(loanId),
    listPaymentsByLoan(loanId),
  ])

  const { installments: views, position } = buildPosition({ installments, excessCredit, asOf })

  return { loan, installments: views, position, payments }
}

export interface LoanSummary {
  loan: Loan
  position: LoanPosition
}

/** Lightweight list for the loan picker in the UI. */
export async function listLoanSummaries(asOf: IsoDate = today()): Promise<LoanSummary[]> {
  const loans = await listLoans()

  return Promise.all(
    loans.map(async (loan) => {
      const [installments, excessCredit] = await Promise.all([
        listInstallmentsByLoan(loan.id),
        sumUnallocatedForLoan(loan.id),
      ])
      const { position } = buildPosition({ installments, excessCredit, asOf })
      return { loan, position }
    }),
  )
}
