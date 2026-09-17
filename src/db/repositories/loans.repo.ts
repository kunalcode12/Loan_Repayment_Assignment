import type { PoolClient } from 'pg'

import { paiseToDb, type BasisPoints, type Paise } from '@/lib/money'
import type { IsoDate } from '@/lib/date'
import type { Loan } from '@/domain/types'
import { query } from '../client'
import { LOAN_COLUMNS, toLoan, type LoanRow } from '../mappers'

export interface InsertLoanInput {
  principal: Paise
  annualRateBps: BasisPoints
  tenureMonths: number
  disbursementDate: IsoDate
  emi: Paise
  totalInterest: Paise
  totalPayable: Paise
}

export async function insertLoan(client: PoolClient, input: InsertLoanInput): Promise<Loan> {
  const { rows } = await client.query<LoanRow>(
    `INSERT INTO loans (
       principal_paise, annual_interest_rate_bps, tenure_months, disbursement_date,
       emi_paise, total_interest_paise, total_payable_paise
     ) VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING ${LOAN_COLUMNS}`,
    [
      paiseToDb(input.principal),
      input.annualRateBps,
      input.tenureMonths,
      input.disbursementDate,
      paiseToDb(input.emi),
      paiseToDb(input.totalInterest),
      paiseToDb(input.totalPayable),
    ],
  )

  const row = rows[0]
  if (!row) throw new Error('INSERT INTO loans returned no row')
  return toLoan(row)
}

export async function findLoanById(loanId: string): Promise<Loan | null> {
  const rows = await query<LoanRow>(`SELECT ${LOAN_COLUMNS} FROM loans WHERE id = $1`, [loanId])
  const row = rows[0]
  return row ? toLoan(row) : null
}

/**
 * Read the loan and hold a row lock for the rest of the transaction.
 *
 * Two payments arriving at the same moment would otherwise each read the same
 * instalment balances and each allocate against them, double-crediting the
 * borrower. Locking the loan row makes payment recording serial per loan while
 * leaving different loans fully concurrent.
 */
export async function lockLoanForUpdate(client: PoolClient, loanId: string): Promise<Loan | null> {
  const { rows } = await client.query<LoanRow>(
    `SELECT ${LOAN_COLUMNS} FROM loans WHERE id = $1 FOR UPDATE`,
    [loanId],
  )
  const row = rows[0]
  return row ? toLoan(row) : null
}

export async function listLoans(limit = 50): Promise<Loan[]> {
  const rows = await query<LoanRow>(
    `SELECT ${LOAN_COLUMNS} FROM loans ORDER BY created_at DESC LIMIT $1`,
    [limit],
  )
  return rows.map(toLoan)
}

export async function touchLoan(client: PoolClient, loanId: string): Promise<void> {
  await client.query('UPDATE loans SET updated_at = now() WHERE id = $1', [loanId])
}
