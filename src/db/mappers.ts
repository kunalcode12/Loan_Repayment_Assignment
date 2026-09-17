import { assertBasisPoints, paiseFromDb } from '@/lib/money'
import { isoDateFromDb } from '@/lib/date'
import type { AllocatableInstallment, Loan, Payment } from '@/domain/types'

/**
 * Row shapes as `pg` returns them, and the mappers that turn them into domain
 * objects.
 *
 * `BIGINT` columns arrive as strings and `DATE` columns as `YYYY-MM-DD`
 * strings (see the type parsers in `client.ts`). The mappers are the single
 * place where those strings are validated and narrowed to `Paise` / `IsoDate`,
 * so nothing downstream has to guess at a column's runtime type.
 */

export interface LoanRow {
  id: string
  reference: string
  principal_paise: string
  annual_interest_rate_bps: number
  tenure_months: number
  disbursement_date: string
  emi_paise: string
  total_interest_paise: string
  total_payable_paise: string
  created_at: Date
}

export interface InstallmentRow {
  id: string
  loan_id: string
  installment_number: number
  due_date: string
  principal_component_paise: string
  interest_component_paise: string
  principal_paid_paise: string
  interest_paid_paise: string
}

export interface PaymentRow {
  id: string
  loan_id: string
  idempotency_key: string
  amount_paise: string
  payment_date: string
  allocated_paise: string
  unallocated_paise: string
  recorded_by: string | null
  created_at: Date
}

export function toLoan(row: LoanRow): Loan {
  return {
    id: row.id,
    reference: row.reference,
    principal: paiseFromDb(row.principal_paise, 'principal'),
    annualRateBps: assertBasisPoints(Number(row.annual_interest_rate_bps), 'annual interest rate'),
    tenureMonths: Number(row.tenure_months),
    disbursementDate: isoDateFromDb(row.disbursement_date, 'disbursement date'),
    emi: paiseFromDb(row.emi_paise, 'emi'),
    totalInterest: paiseFromDb(row.total_interest_paise, 'total interest'),
    totalPayable: paiseFromDb(row.total_payable_paise, 'total payable'),
    createdAt: new Date(row.created_at).toISOString(),
  }
}

export function toInstallment(row: InstallmentRow): AllocatableInstallment {
  return {
    id: row.id,
    installmentNumber: Number(row.installment_number),
    dueDate: isoDateFromDb(row.due_date, 'due date'),
    principalComponent: paiseFromDb(row.principal_component_paise, 'principal component'),
    interestComponent: paiseFromDb(row.interest_component_paise, 'interest component'),
    principalPaid: paiseFromDb(row.principal_paid_paise, 'principal paid'),
    interestPaid: paiseFromDb(row.interest_paid_paise, 'interest paid'),
  }
}

export function toPayment(row: PaymentRow): Payment {
  return {
    id: row.id,
    loanId: row.loan_id,
    idempotencyKey: row.idempotency_key,
    amount: paiseFromDb(row.amount_paise, 'payment amount'),
    paymentDate: isoDateFromDb(row.payment_date, 'payment date'),
    allocated: paiseFromDb(row.allocated_paise, 'allocated amount'),
    unallocated: paiseFromDb(row.unallocated_paise, 'unallocated amount'),
    recordedBy: row.recorded_by,
    createdAt: new Date(row.created_at).toISOString(),
  }
}

export const LOAN_COLUMNS = `
  id, reference, principal_paise, annual_interest_rate_bps, tenure_months,
  disbursement_date, emi_paise, total_interest_paise, total_payable_paise, created_at
`

export const INSTALLMENT_COLUMNS = `
  id, loan_id, installment_number, due_date, principal_component_paise,
  interest_component_paise, principal_paid_paise, interest_paid_paise
`

export const PAYMENT_COLUMNS = `
  id, loan_id, idempotency_key, amount_paise, payment_date,
  allocated_paise, unallocated_paise, recorded_by, created_at
`
