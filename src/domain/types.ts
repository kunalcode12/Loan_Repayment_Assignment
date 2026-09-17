import type { BasisPoints, Paise } from '@/lib/money'
import type { IsoDate } from '@/lib/date'

/** Business limits from the brief: Rs 50,000 - Rs 10,00,000 over 3 - 36 months. */
export const LOAN_LIMITS = {
  minPrincipalPaise: 50_00_000 as Paise, // Rs 50,000
  maxPrincipalPaise: 10_00_00_000 as Paise, // Rs 10,00,000
  minTenureMonths: 3,
  maxTenureMonths: 36,
  maxAnnualRateBps: 100_00 as BasisPoints, // 100% p.a.
} as const

export type LoanStatus = 'ACTIVE' | 'CLOSED'

/** A persisted loan, with money already narrowed to `Paise`. */
export interface Loan {
  id: string
  reference: string
  principal: Paise
  annualRateBps: BasisPoints
  tenureMonths: number
  disbursementDate: IsoDate
  emi: Paise
  totalInterest: Paise
  totalPayable: Paise
  createdAt: string
}

/** A persisted payment. */
export interface Payment {
  id: string
  loanId: string
  idempotencyKey: string
  amount: Paise
  paymentDate: IsoDate
  allocated: Paise
  unallocated: Paise
  recordedBy: string | null
  createdAt: string
}

export interface ScheduleInput {
  principal: Paise
  annualRateBps: BasisPoints
  tenureMonths: number
  disbursementDate: IsoDate
}

/** One row of a freshly generated amortisation schedule. */
export interface ScheduledInstallment {
  installmentNumber: number
  dueDate: IsoDate
  openingBalance: Paise
  principalComponent: Paise
  interestComponent: Paise
  totalDue: Paise
  closingBalance: Paise
}

export interface GeneratedSchedule {
  emi: Paise
  installments: ScheduledInstallment[]
  totalPrincipal: Paise
  totalInterest: Paise
  totalPayable: Paise
}

/** An instalment as it currently stands, used as input to allocation. */
export interface AllocatableInstallment {
  id: string
  installmentNumber: number
  dueDate: IsoDate
  interestComponent: Paise
  principalComponent: Paise
  interestPaid: Paise
  principalPaid: Paise
}

/** How much of one payment landed on one instalment. */
export interface AllocationLine {
  installmentId: string
  installmentNumber: number
  dueDate: IsoDate
  interest: Paise
  principal: Paise
  total: Paise
  /** Positive when the payment arrived after the due date, else 0. */
  daysLate: number
}

export interface AllocationResult {
  lines: AllocationLine[]
  /** Total placed against instalments. */
  allocated: Paise
  /**
   * Amount that could not be placed because every instalment is settled.
   * Retained as a credit on the loan rather than silently dropped.
   */
  unallocated: Paise
}

/** The current state of an instalment, as returned by the API. */
export interface InstallmentView {
  id: string
  installmentNumber: number
  dueDate: IsoDate
  principalComponent: Paise
  interestComponent: Paise
  totalDue: Paise
  principalPaid: Paise
  interestPaid: Paise
  amountPaid: Paise
  amountRemaining: Paise
  status: 'PAID' | 'PARTIALLY_PAID' | 'OVERDUE' | 'DUE'
  daysPastDue: number
}

export interface LoanPosition {
  asOf: IsoDate
  status: LoanStatus
  outstandingPrincipal: Paise
  outstandingInterest: Paise
  totalOutstanding: Paise
  principalPaid: Paise
  interestPaid: Paise
  totalPaid: Paise
  nextDueDate: IsoDate | null
  nextDueAmount: Paise
  overdueAmount: Paise
  overdueInstallmentCount: number
  /** Days past due of the *oldest* unsettled overdue instalment. */
  daysPastDue: number
  /** Money received that no instalment could absorb. */
  excessCredit: Paise
}
