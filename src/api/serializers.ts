import type { Paise } from '@/lib/money'
import type { InstallmentView, Loan, LoanPosition, Payment, AllocationLine } from '@/domain/types'
import { basisPointsToPercent } from '@/lib/money'

/**
 * Wire format.
 *
 * Every monetary field is serialised the same way:
 *
 *     { "paise": 998482, "rupees": "9984.82" }
 *
 * `paise` is the canonical value — an exact integer that a client can do
 * arithmetic on. `rupees` is a *string*, deliberately, so that the display value
 * never passes through a JSON float on its way to a UI. Clients that want a
 * formatted amount format it from `paise` themselves.
 */
export interface MoneyDto {
  paise: number
  rupees: string
}

export function money(amount: Paise): MoneyDto {
  const negative = amount < 0
  const absolute = Math.abs(amount)
  const whole = Math.floor(absolute / 100)
  const fraction = String(absolute % 100).padStart(2, '0')
  return {
    paise: amount,
    rupees: `${negative ? '-' : ''}${whole}.${fraction}`,
  }
}

export interface LoanDto {
  id: string
  reference: string
  principal: MoneyDto
  annualInterestRate: number
  tenureMonths: number
  disbursementDate: string
  emi: MoneyDto
  totalInterest: MoneyDto
  totalPayable: MoneyDto
  createdAt: string
}

export function serializeLoan(loan: Loan): LoanDto {
  return {
    id: loan.id,
    reference: loan.reference,
    principal: money(loan.principal),
    annualInterestRate: basisPointsToPercent(loan.annualRateBps),
    tenureMonths: loan.tenureMonths,
    disbursementDate: loan.disbursementDate,
    emi: money(loan.emi),
    totalInterest: money(loan.totalInterest),
    totalPayable: money(loan.totalPayable),
    createdAt: loan.createdAt,
  }
}

export interface InstallmentDto {
  id: string
  installmentNumber: number
  dueDate: string
  principalComponent: MoneyDto
  interestComponent: MoneyDto
  totalDue: MoneyDto
  amountPaid: MoneyDto
  amountRemaining: MoneyDto
  status: InstallmentView['status']
  daysPastDue: number
}

export function serializeInstallment(installment: InstallmentView): InstallmentDto {
  return {
    id: installment.id,
    installmentNumber: installment.installmentNumber,
    dueDate: installment.dueDate,
    principalComponent: money(installment.principalComponent),
    interestComponent: money(installment.interestComponent),
    totalDue: money(installment.totalDue),
    amountPaid: money(installment.amountPaid),
    amountRemaining: money(installment.amountRemaining),
    status: installment.status,
    daysPastDue: installment.daysPastDue,
  }
}

export interface PositionDto {
  asOf: string
  status: LoanPosition['status']
  outstandingPrincipal: MoneyDto
  outstandingInterest: MoneyDto
  totalOutstanding: MoneyDto
  principalPaid: MoneyDto
  interestPaid: MoneyDto
  totalPaid: MoneyDto
  nextDueDate: string | null
  nextDueAmount: MoneyDto
  overdueAmount: MoneyDto
  overdueInstallmentCount: number
  daysPastDue: number
  excessCredit: MoneyDto
}

export function serializePosition(position: LoanPosition): PositionDto {
  return {
    asOf: position.asOf,
    status: position.status,
    outstandingPrincipal: money(position.outstandingPrincipal),
    outstandingInterest: money(position.outstandingInterest),
    totalOutstanding: money(position.totalOutstanding),
    principalPaid: money(position.principalPaid),
    interestPaid: money(position.interestPaid),
    totalPaid: money(position.totalPaid),
    nextDueDate: position.nextDueDate,
    nextDueAmount: money(position.nextDueAmount),
    overdueAmount: money(position.overdueAmount),
    overdueInstallmentCount: position.overdueInstallmentCount,
    daysPastDue: position.daysPastDue,
    excessCredit: money(position.excessCredit),
  }
}

export interface PaymentDto {
  id: string
  loanId: string
  idempotencyKey: string
  amount: MoneyDto
  paymentDate: string
  allocated: MoneyDto
  unallocated: MoneyDto
  recordedBy: string | null
  createdAt: string
}

export function serializePayment(payment: Payment): PaymentDto {
  return {
    id: payment.id,
    loanId: payment.loanId,
    idempotencyKey: payment.idempotencyKey,
    amount: money(payment.amount),
    paymentDate: payment.paymentDate,
    allocated: money(payment.allocated),
    unallocated: money(payment.unallocated),
    recordedBy: payment.recordedBy,
    createdAt: payment.createdAt,
  }
}

export interface AllocationDto {
  installmentId: string
  installmentNumber: number
  dueDate: string
  interest: MoneyDto
  principal: MoneyDto
  total: MoneyDto
  daysLate: number
}

export function serializeAllocation(line: AllocationLine): AllocationDto {
  return {
    installmentId: line.installmentId,
    installmentNumber: line.installmentNumber,
    dueDate: line.dueDate,
    interest: money(line.interest),
    principal: money(line.principal),
    total: money(line.total),
    daysLate: line.daysLate,
  }
}
