import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

vi.mock('@/auth/verify-token', async () => {
  const { AppError } = await import('@/lib/errors')
  return {
    verifyIdToken: async (token: string) => {
      if (token !== 'test-firebase-id-token') {
        throw AppError.unauthenticated(
          'The supplied authentication token is invalid or has expired.',
        )
      }
      return { uid: 'integration-test-uid', email: 'reviewer@vitto.test' }
    },
  }
})

import { GET as getLoanRoute } from '@/app/api/loans/[loanId]/route'
import { GET as listLoansRoute, POST as createLoanRoute } from '@/app/api/loans/route'
import { POST as recordPaymentRoute } from '@/app/api/payments/route'
import { closePool, query } from '@/db/client'
import { runMigrations } from '@/db/migrate'
import { buildRequest, expectData, readEnvelope } from '../helpers/route-client'

interface MoneyDto {
  paise: number
  rupees: string
}
interface InstallmentDto {
  installmentNumber: number
  dueDate: string
  principalComponent: MoneyDto
  interestComponent: MoneyDto
  totalDue: MoneyDto
  amountPaid: MoneyDto
  amountRemaining: MoneyDto
  status: string
}
interface LoanDetail {
  loan: { id: string; reference: string; emi: MoneyDto }
  schedule: InstallmentDto[]
  position: {
    outstandingPrincipal: MoneyDto
    overdueAmount: MoneyDto
    overdueInstallmentCount: number
    nextDueDate: string | null
    nextDueAmount: MoneyDto
    totalPaid: MoneyDto
    daysPastDue: number
  }
  payments: { id: string; amount: MoneyDto }[]
}
interface PaymentResult extends LoanDetail {
  duplicate: boolean
  payment: { id: string; amount: MoneyDto; allocated: MoneyDto; unallocated: MoneyDto }
  allocations: { installmentNumber: number; interest: MoneyDto; principal: MoneyDto; daysLate: number }[]
}

const REFERENCE_LOAN = {
  principal: 200_000,
  annualInterestRate: 18,
  tenureMonths: 24,
  disbursementDate: '2025-01-15',
}

// Fixed so the overdue assertions do not depend on the day the suite is run:
// instalments 1 (15 Feb) and 2 (15 Mar) have fallen due by this date.
const AS_OF = '2025-04-01'

const hasDatabase = Boolean(process.env.DATABASE_URL)

if (!hasDatabase) {
  console.warn(
    '\n[integration] DATABASE_URL is not set — skipping. Copy .env.example to .env.local first.\n',
  )
}

const createdLoanIds: string[] = []

async function createReferenceLoan(): Promise<LoanDetail> {
  const response = await createLoanRoute(
    buildRequest('/api/loans', { method: 'POST', body: REFERENCE_LOAN }),
    {},
  )
  const envelope = await readEnvelope<LoanDetail>(response)
  expect(envelope.status).toBe(201)
  const data = expectData(envelope)
  createdLoanIds.push(data.loan.id)
  return data
}

async function fetchLoan(loanId: string, asOf = AS_OF): Promise<LoanDetail> {
  const response = await getLoanRoute(buildRequest(`/api/loans/${loanId}?asOf=${asOf}`), {
    params: Promise.resolve({ loanId }),
  })
  return expectData(await readEnvelope<LoanDetail>(response))
}

describe.skipIf(!hasDatabase)('route handlers (integration)', () => {
  beforeAll(async () => {
    // The schema is created by the same code path as `npm run db:setup`.
    await runMigrations()
  })

  afterAll(async () => {
    if (createdLoanIds.length > 0) {
      // Instalments, payments and allocations go with the loan via ON DELETE CASCADE.
      await query('DELETE FROM loans WHERE id = ANY($1::uuid[])', [createdLoanIds])
    }
    await closePool()
  })

  it('creates a loan, allocates a payment against it and reports the new position', async () => {
    const created = await createReferenceLoan()

    expect(created.schedule).toHaveLength(24)
    expect(created.loan.emi.rupees).toBe('9984.82')
    expect(created.schedule[0]?.interestComponent.paise).toBe(300_000)
    expect(created.schedule[0]?.dueDate).toBe('2025-02-15')

    const before = await fetchLoan(created.loan.id)
    expect(before.position.overdueInstallmentCount).toBe(2)
    expect(before.position.overdueAmount.paise).toBe(before.loan.emi.paise * 2)
    expect(before.position.outstandingPrincipal.paise).toBe(200_000_00)
    expect(before.position.nextDueDate).toBe('2025-02-15')

    // An underpayment against the first instalment: Rs 5,000 of Rs 9,984.82.
    const response = await recordPaymentRoute(
      buildRequest(`/api/payments?asOf=${AS_OF}`, {
        method: 'POST',
        body: {
          loanId: created.loan.id,
          amount: 5_000,
          paymentDate: '2025-02-15',
          idempotencyKey: `success-${created.loan.id}`,
        },
      }),
      {},
    )
    const envelope = await readEnvelope<PaymentResult>(response)
    expect(envelope.status).toBe(201)
    const result = expectData(envelope)

    // Interest before principal, oldest instalment first.
    expect(result.duplicate).toBe(false)
    expect(result.allocations).toHaveLength(1)
    expect(result.allocations[0]?.installmentNumber).toBe(1)
    expect(result.allocations[0]?.interest.paise).toBe(300_000)
    expect(result.allocations[0]?.principal.paise).toBe(200_000)
    expect(result.payment.unallocated.paise).toBe(0)

    // The response carries the refreshed loan, and a fresh read agrees with it.
    const persisted = await fetchLoan(created.loan.id)
    expect(persisted.schedule[0]?.amountPaid.paise).toBe(500_000)
    expect(persisted.schedule[0]?.status).toBe('OVERDUE')
    expect(persisted.schedule[0]?.amountRemaining.paise).toBe(persisted.loan.emi.paise - 500_000)
    expect(persisted.position.totalPaid.paise).toBe(500_000)
    expect(persisted.position.outstandingPrincipal.paise).toBe(200_000_00 - 200_000)
    expect(persisted.position.overdueAmount.paise).toBe(result.position.overdueAmount.paise)
    expect(persisted.payments).toHaveLength(1)

    // The loan also shows up in the list endpoint.
    const list = expectData(
      await readEnvelope<{ loans: { loan: { id: string } }[] }>(
        await listLoansRoute(buildRequest('/api/loans'), {}),
      ),
    )
    expect(list.loans.some((entry) => entry.loan.id === created.loan.id)).toBe(true)
  })

  it('does not apply the same payment twice', async () => {
    const created = await createReferenceLoan()
    const body = {
      loanId: created.loan.id,
      amount: 9_984.82,
      paymentDate: '2025-02-15',
      idempotencyKey: `duplicate-${created.loan.id}`,
    }

    const first = await readEnvelope<PaymentResult>(
      await recordPaymentRoute(
        buildRequest(`/api/payments?asOf=${AS_OF}`, { method: 'POST', body }),
        {},
      ),
    )
    expect(first.status).toBe(201)
    expect(expectData(first).duplicate).toBe(false)

    // The identical request again - a double-clicked button, or a retry.
    const second = await readEnvelope<PaymentResult>(
      await recordPaymentRoute(
        buildRequest(`/api/payments?asOf=${AS_OF}`, { method: 'POST', body }),
        {},
      ),
    )
    expect(second.status).toBe(200)
    const replay = expectData(second)

    expect(replay.duplicate).toBe(true)
    // The original payment is returned, not a new one.
    expect(replay.payment.id).toBe(expectData(first).payment.id)

    // Nothing moved: one payment on record, one instalment settled, and the
    // balances are exactly where the first request left them.
    const persisted = await fetchLoan(created.loan.id)
    expect(persisted.payments).toHaveLength(1)
    expect(persisted.position.totalPaid.paise).toBe(created.loan.emi.paise)
    expect(persisted.schedule[0]?.status).toBe('PAID')
    expect(persisted.schedule[1]?.amountPaid.paise).toBe(0)

    // A different amount under the same key is a client bug, not a retry.
    const conflicting = await readEnvelope(
      await recordPaymentRoute(
        buildRequest('/api/payments', { method: 'POST', body: { ...body, amount: 1_000 } }),
        {},
      ),
    )
    expect(conflicting.status).toBe(409)
    expect(conflicting.body.error?.code).toBe('CONFLICT')
  })

  it('rejects invalid input and unknown loan identifiers', async () => {
    // Zero-month tenure.
    const zeroTenure = await readEnvelope(
      await createLoanRoute(
        buildRequest('/api/loans', {
          method: 'POST',
          body: { ...REFERENCE_LOAN, tenureMonths: 0 },
        }),
        {},
      ),
    )
    expect(zeroTenure.status).toBe(400)
    expect(zeroTenure.body.error?.code).toBe('VALIDATION_ERROR')
    expect(zeroTenure.body.error?.issues?.some((issue) => issue.field === 'tenureMonths')).toBe(true)

    // A non-numeric principal is rejected rather than coerced.
    const nonNumeric = await readEnvelope(
      await createLoanRoute(
        buildRequest('/api/loans', {
          method: 'POST',
          body: { ...REFERENCE_LOAN, principal: '200000' },
        }),
        {},
      ),
    )
    expect(nonNumeric.status).toBe(400)
    expect(nonNumeric.body.error?.issues?.some((issue) => issue.field === 'principal')).toBe(true)

    // A negative payment amount.
    const negative = await readEnvelope(
      await recordPaymentRoute(
        buildRequest('/api/payments', {
          method: 'POST',
          body: {
            loanId: '00000000-0000-4000-8000-000000000000',
            amount: -500,
            paymentDate: '2025-02-15',
            idempotencyKey: 'negative-amount-key',
          },
        }),
        {},
      ),
    )
    expect(negative.status).toBe(400)
    expect(negative.body.error?.issues?.some((issue) => issue.field === 'amount')).toBe(true)

    // A well-formed id that does not exist is a 404...
    const missingId = '00000000-0000-4000-8000-000000000000'
    const notFound = await readEnvelope(
      await getLoanRoute(buildRequest(`/api/loans/${missingId}`), {
        params: Promise.resolve({ loanId: missingId }),
      }),
    )
    expect(notFound.status).toBe(404)
    expect(notFound.body.error?.code).toBe('NOT_FOUND')

    // ...while a malformed one is a bad request, not a database error.
    const malformed = await readEnvelope(
      await getLoanRoute(buildRequest('/api/loans/not-a-loan'), {
        params: Promise.resolve({ loanId: 'not-a-loan' }),
      }),
    )
    expect(malformed.status).toBe(400)
    expect(malformed.body.error?.code).toBe('VALIDATION_ERROR')

    // A payment against a loan that does not exist.
    const unknownLoan = await readEnvelope(
      await recordPaymentRoute(
        buildRequest('/api/payments', {
          method: 'POST',
          body: {
            loanId: missingId,
            amount: 1_000,
            paymentDate: '2025-02-15',
            idempotencyKey: `unknown-loan-${Date.now()}`,
          },
        }),
        {},
      ),
    )
    expect(unknownLoan.status).toBe(404)
  })

  it('rejects unauthenticated requests on every endpoint', async () => {
    const missingId = '00000000-0000-4000-8000-000000000000'
    const loansBefore = await countLoans()

    const withoutToken = await Promise.all([
      readEnvelope(
        await createLoanRoute(
          buildRequest('/api/loans', { method: 'POST', body: REFERENCE_LOAN, token: null }),
          {},
        ),
      ),
      readEnvelope(
        await getLoanRoute(buildRequest(`/api/loans/${missingId}`, { token: null }), {
          params: Promise.resolve({ loanId: missingId }),
        }),
      ),
      readEnvelope(
        await recordPaymentRoute(
          buildRequest('/api/payments', {
            method: 'POST',
            token: null,
            body: {
              loanId: missingId,
              amount: 1_000,
              paymentDate: '2025-02-15',
              idempotencyKey: 'unauthenticated-key',
            },
          }),
          {},
        ),
      ),
    ])

    for (const envelope of withoutToken) {
      expect(envelope.status).toBe(401)
      expect(envelope.body.error?.code).toBe('UNAUTHENTICATED')
      // The handler body never ran, so nothing was created.
      expect(envelope.body.data).toBeUndefined()
    }

    // A present but unverifiable token is refused too.
    const badToken = await readEnvelope(
      await createLoanRoute(
        buildRequest('/api/loans', {
          method: 'POST',
          body: REFERENCE_LOAN,
          token: 'forged-token',
        }),
        {},
      ),
    )
    expect(badToken.status).toBe(401)

    // Two of those four rejected requests were loan creations. Neither of them
    // reached the database.
    expect(await countLoans()).toBe(loansBefore)
  })
})

async function countLoans(): Promise<number> {
  const rows = await query<{ count: string }>('SELECT count(*)::text AS count FROM loans')
  return Number(rows[0]?.count ?? 0)
}
