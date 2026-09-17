import { readJsonBody, withAuth } from '@/api/handler'
import { success } from '@/api/responses'
import {
  serializeInstallment,
  serializeLoan,
  serializePosition,
} from '@/api/serializers'
import { parseAsOf, parseCreateLoanRequest } from '@/api/validation'
import { createLoan, listLoanSummaries } from '@/services/loan.service'

/**
 * `/api/loans`
 *
 * - `POST` creates a loan and persists its full repayment schedule.
 * - `GET`  lists loans with their headline position, for the loan picker.
 *
 * Both require a verified Firebase ID token; `withAuth` runs the check before
 * the handler body.
 */

// Reads and writes per-request state, so it must never be prerendered or cached.
export const dynamic = 'force-dynamic'

export const POST = withAuth<unknown>(async ({ request, requestId }) => {
  const body = await readJsonBody(request)
  const input = parseCreateLoanRequest(body)
  const detail = await createLoan(input)

  return success(
    {
      loan: serializeLoan(detail.loan),
      schedule: detail.installments.map(serializeInstallment),
      position: serializePosition(detail.position),
    },
    { status: 201, requestId },
  )
})

export const GET = withAuth<unknown>(async ({ request, requestId }) => {
  const asOf = parseAsOf(new URL(request.url).searchParams.get('asOf'))
  const summaries = await listLoanSummaries(asOf)

  return success(
    {
      loans: summaries.map((summary) => ({
        loan: serializeLoan(summary.loan),
        position: serializePosition(summary.position),
      })),
    },
    { requestId },
  )
})
