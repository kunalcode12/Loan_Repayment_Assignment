import { withTransaction } from '@/db/client'
import { applyAllocation, listInstallmentsForUpdate } from '@/db/repositories/installments.repo'
import { lockLoanForUpdate, touchLoan } from '@/db/repositories/loans.repo'
import {
  findPaymentByIdempotencyKey,
  insertAllocations,
  insertPayment,
  listAllocationsByPayment,
  UNIQUE_VIOLATION,
} from '@/db/repositories/payments.repo'
import { allocatePayment } from '@/domain/allocation'
import type { AllocationLine, Payment } from '@/domain/types'
import { today, type IsoDate } from '@/lib/date'
import { AppError } from '@/lib/errors'
import type { Paise } from '@/lib/money'
import { getLoanDetail, type LoanDetail } from './loan.service'

export interface RecordPaymentInput {
  loanId: string
  amount: Paise
  paymentDate: IsoDate
  /** Client-supplied key that makes a retry of the same request a no-op. */
  idempotencyKey: string
  recordedBy: string | null
  asOf?: IsoDate
}

export interface RecordPaymentResult {
  /** True when this request replayed an already-recorded payment. */
  duplicate: boolean
  payment: Payment
  allocations: AllocationLine[]
  loan: LoanDetail
}


export async function recordPayment(input: RecordPaymentInput): Promise<RecordPaymentResult> {
  const asOf = input.asOf ?? today()

  const existing = await findPaymentByIdempotencyKey(input.idempotencyKey)
  if (existing) {
    return replay(existing, input, asOf)
  }

  let payment: Payment
  let allocations: AllocationLine[]

  try {
    const outcome = await withTransaction(async (client) => {
      // Locking the loan row serialises payments for this loan, so two
      // concurrent payments cannot both allocate against the same balances.
      const loan = await lockLoanForUpdate(client, input.loanId)
      if (!loan) {
        throw AppError.notFound(`No loan exists with id "${input.loanId}".`)
      }

      const installments = await listInstallmentsForUpdate(client, loan.id)
      const allocation = allocatePayment({
        amount: input.amount,
        paymentDate: input.paymentDate,
        installments,
      })

      const inserted = await insertPayment(client, {
        loanId: loan.id,
        idempotencyKey: input.idempotencyKey,
        amount: input.amount,
        paymentDate: input.paymentDate,
        allocated: allocation.allocated,
        unallocated: allocation.unallocated,
        recordedBy: input.recordedBy,
      })

      for (const line of allocation.lines) {
        await applyAllocation(client, {
          installmentId: line.installmentId,
          interest: line.interest,
          principal: line.principal,
        })
      }

      await insertAllocations(client, inserted.id, allocation.lines)
      await touchLoan(client, loan.id)

      return { payment: inserted, allocations: allocation.lines }
    })

    payment = outcome.payment
    allocations = outcome.allocations
  } catch (error) {
    if (isIdempotencyKeyViolation(error)) {
      const winner = await findPaymentByIdempotencyKey(input.idempotencyKey)
      if (winner) return replay(winner, input, asOf)
    }
    throw error
  }

  return {
    duplicate: false,
    payment,
    allocations,
    loan: await getLoanDetail(input.loanId, asOf),
  }
}

async function replay(
  existing: Payment,
  input: RecordPaymentInput,
  asOf: IsoDate,
): Promise<RecordPaymentResult> {
  const sameRequest =
    existing.loanId === input.loanId &&
    existing.amount === input.amount &&
    existing.paymentDate === input.paymentDate

  if (!sameRequest) {
    throw AppError.conflict(
      `Idempotency key "${input.idempotencyKey}" has already been used for a different payment. ` +
        'Use a fresh key for a genuinely new payment.',
    )
  }

  return {
    duplicate: true,
    payment: existing,
    allocations: await listAllocationsByPayment(existing.id),
    loan: await getLoanDetail(existing.loanId, asOf),
  }
}

function isIdempotencyKeyViolation(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) return false
  const candidate = error as { code?: unknown; constraint?: unknown }
  return (
    candidate.code === UNIQUE_VIOLATION && candidate.constraint === 'payments_idempotency_key_unique'
  )
}
