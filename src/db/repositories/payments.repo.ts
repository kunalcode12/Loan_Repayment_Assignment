import type { PoolClient } from 'pg'

import { addPaise, paiseFromDb, paiseToDb, ZERO, type Paise } from '@/lib/money'
import { isoDateFromDb, type IsoDate } from '@/lib/date'
import type { AllocationLine, Payment } from '@/domain/types'
import { query } from '../client'
import { PAYMENT_COLUMNS, toPayment, type PaymentRow } from '../mappers'

/** Postgres `unique_violation`. */
export const UNIQUE_VIOLATION = '23505'

export interface InsertPaymentInput {
  loanId: string
  idempotencyKey: string
  amount: Paise
  paymentDate: IsoDate
  allocated: Paise
  unallocated: Paise
  recordedBy: string | null
}

export async function insertPayment(
  client: PoolClient,
  input: InsertPaymentInput,
): Promise<Payment> {
  const { rows } = await client.query<PaymentRow>(
    `INSERT INTO payments (
       loan_id, idempotency_key, amount_paise, payment_date,
       allocated_paise, unallocated_paise, recorded_by
     ) VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING ${PAYMENT_COLUMNS}`,
    [
      input.loanId,
      input.idempotencyKey,
      paiseToDb(input.amount),
      input.paymentDate,
      paiseToDb(input.allocated),
      paiseToDb(input.unallocated),
      input.recordedBy,
    ],
  )

  const row = rows[0]
  if (!row) throw new Error('INSERT INTO payments returned no row')
  return toPayment(row)
}

export async function findPaymentByIdempotencyKey(key: string): Promise<Payment | null> {
  const rows = await query<PaymentRow>(
    `SELECT ${PAYMENT_COLUMNS} FROM payments WHERE idempotency_key = $1`,
    [key],
  )
  const row = rows[0]
  return row ? toPayment(row) : null
}

export async function insertAllocations(
  client: PoolClient,
  paymentId: string,
  lines: AllocationLine[],
): Promise<void> {
  if (lines.length === 0) return

  await client.query(
    `INSERT INTO payment_allocations (
       payment_id, installment_id, interest_paise, principal_paise, days_late
     )
     SELECT $1, * FROM unnest($2::uuid[], $3::bigint[], $4::bigint[], $5::int[])`,
    [
      paymentId,
      lines.map((line) => line.installmentId),
      lines.map((line) => paiseToDb(line.interest)),
      lines.map((line) => paiseToDb(line.principal)),
      lines.map((line) => line.daysLate),
    ],
  )
}

/**
 * The allocation lines a payment produced, joined back to their instalments.
 * Used to replay the original outcome when a duplicate submission is detected.
 */
export async function listAllocationsByPayment(paymentId: string): Promise<AllocationLine[]> {
  const rows = await query<{
    installment_id: string
    installment_number: number
    due_date: string
    interest_paise: string
    principal_paise: string
    days_late: number
  }>(
    `SELECT a.installment_id,
            i.installment_number,
            i.due_date,
            a.interest_paise,
            a.principal_paise,
            a.days_late
       FROM payment_allocations a
       JOIN installments i ON i.id = a.installment_id
      WHERE a.payment_id = $1
      ORDER BY i.installment_number`,
    [paymentId],
  )

  return rows.map((row) => {
    const interest = paiseFromDb(row.interest_paise, 'allocated interest')
    const principal = paiseFromDb(row.principal_paise, 'allocated principal')
    return {
      installmentId: row.installment_id,
      installmentNumber: Number(row.installment_number),
      dueDate: isoDateFromDb(row.due_date, 'due date'),
      interest,
      principal,
      total: addPaise(interest, principal),
      daysLate: Number(row.days_late),
    }
  })
}

export async function listPaymentsByLoan(loanId: string): Promise<Payment[]> {
  const rows = await query<PaymentRow>(
    `SELECT ${PAYMENT_COLUMNS} FROM payments WHERE loan_id = $1 ORDER BY payment_date DESC, created_at DESC`,
    [loanId],
  )
  return rows.map(toPayment)
}

/** Total received that no instalment could absorb — the loan's excess credit. */
export async function sumUnallocatedForLoan(loanId: string): Promise<Paise> {
  const rows = await query<{ total: string | null }>(
    'SELECT COALESCE(SUM(unallocated_paise), 0)::bigint AS total FROM payments WHERE loan_id = $1',
    [loanId],
  )
  const total = rows[0]?.total
  return total === null || total === undefined ? ZERO : paiseFromDb(total, 'excess credit')
}
