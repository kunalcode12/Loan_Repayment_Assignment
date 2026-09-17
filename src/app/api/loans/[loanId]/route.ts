import { withAuth } from '@/api/handler'
import { success } from '@/api/responses'
import {
  serializeInstallment,
  serializeLoan,
  serializePayment,
  serializePosition,
} from '@/api/serializers'
import { parseAsOf, parseLoanId } from '@/api/validation'
import { getLoanDetail } from '@/services/loan.service'

/**
 * `GET /api/loans/:loanId`
 *
 * Returns the loan, its full schedule (per instalment: due date, principal
 * component, interest component, total due and amount paid) and its current
 * position (outstanding principal, next due date and amount, overdue amount).
 *
 * `?asOf=YYYY-MM-DD` asks for the position as it stood on a given date; it
 * defaults to today in IST.
 */

export const dynamic = 'force-dynamic'

// `params` is a Promise in Next.js 16 — synchronous access was removed.
type Context = { params: Promise<{ loanId: string }> }

export const GET = withAuth<Context>(async ({ request, context, requestId }) => {
  const { loanId } = await context.params
  const asOf = parseAsOf(new URL(request.url).searchParams.get('asOf'))
  const detail = await getLoanDetail(parseLoanId(loanId), asOf)

  return success(
    {
      loan: serializeLoan(detail.loan),
      schedule: detail.installments.map(serializeInstallment),
      position: serializePosition(detail.position),
      payments: detail.payments.map(serializePayment),
    },
    { requestId },
  )
})
