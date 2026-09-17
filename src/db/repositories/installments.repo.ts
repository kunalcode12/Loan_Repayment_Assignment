import type { PoolClient } from 'pg'

import { paiseToDb, type Paise } from '@/lib/money'
import type { AllocatableInstallment, ScheduledInstallment } from '@/domain/types'
import { query } from '../client'
import { INSTALLMENT_COLUMNS, toInstallment, type InstallmentRow } from '../mappers'

/**
 * Insert the whole schedule in one statement.
 *
 * `unnest` expands parallel arrays into rows, so a thirty-six month schedule is
 * a single round trip instead of thirty-six. Every value is still a bound
 * parameter, so this is not string interpolation.
 */
export async function insertInstallments(
  client: PoolClient,
  loanId: string,
  installments: ScheduledInstallment[],
): Promise<void> {
  if (installments.length === 0) return

  await client.query(
    `INSERT INTO installments (
       loan_id, installment_number, due_date,
       principal_component_paise, interest_component_paise
     )
     SELECT $1, * FROM unnest(
       $2::smallint[], $3::date[], $4::bigint[], $5::bigint[]
     )`,
    [
      loanId,
      installments.map((i) => i.installmentNumber),
      installments.map((i) => i.dueDate),
      installments.map((i) => paiseToDb(i.principalComponent)),
      installments.map((i) => paiseToDb(i.interestComponent)),
    ],
  )
}

export async function listInstallmentsByLoan(loanId: string): Promise<AllocatableInstallment[]> {
  const rows = await query<InstallmentRow>(
    `SELECT ${INSTALLMENT_COLUMNS} FROM installments WHERE loan_id = $1 ORDER BY installment_number`,
    [loanId],
  )
  return rows.map(toInstallment)
}

/**
 * Read the schedule inside the payment transaction. The loan row is already
 * locked by `lockLoanForUpdate`, which is what serialises concurrent payments;
 * this read simply sees the committed state as of that lock.
 */
export async function listInstallmentsForUpdate(
  client: PoolClient,
  loanId: string,
): Promise<AllocatableInstallment[]> {
  const { rows } = await client.query<InstallmentRow>(
    `SELECT ${INSTALLMENT_COLUMNS} FROM installments WHERE loan_id = $1 ORDER BY installment_number`,
    [loanId],
  )
  return rows.map(toInstallment)
}

/**
 * Credit an instalment.
 *
 * The `WHERE` clause repeats the schema's "never overpaid" invariant so that an
 * allocation which would breach it affects zero rows and is caught here, rather
 * than raising a constraint violation that is harder to attribute.
 */
export async function applyAllocation(
  client: PoolClient,
  params: { installmentId: string; interest: Paise; principal: Paise },
): Promise<void> {
  const { rowCount } = await client.query(
    `UPDATE installments
        SET interest_paid_paise  = interest_paid_paise  + $2::bigint,
            principal_paid_paise = principal_paid_paise + $3::bigint
      WHERE id = $1
        AND interest_paid_paise  + $2::bigint <= interest_component_paise
        AND principal_paid_paise + $3::bigint <= principal_component_paise`,
    [params.installmentId, paiseToDb(params.interest), paiseToDb(params.principal)],
  )

  if (rowCount !== 1) {
    throw new Error(
      `Allocation to instalment ${params.installmentId} would exceed the amount due; the payment was rolled back.`,
    )
  }
}
