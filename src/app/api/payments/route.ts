import { readJsonBody, withAuth } from '@/api/handler'
import { success } from '@/api/responses'
import {
  serializeAllocation,
  serializeInstallment,
  serializeLoan,
  serializePayment,
  serializePosition,
} from '@/api/serializers'
import { parseAsOf, parseRecordPaymentRequest } from '@/api/validation'
import { recordPayment } from '@/services/payment.service'

/**
 * `POST /api/payments`
 *
 * Records a payment against a loan and allocates it across the schedule.
 *
 * The response carries the refreshed loan — schedule and position — alongside
 * the allocation breakdown, so a client updates its whole view from this one
 * response and never has to re-fetch (this is what lets the UI reflect a payment
 * without a page refresh).
 *
 * A replayed `idempotencyKey` returns `200` with `duplicate: true` and the
 * original allocation; a genuinely new payment returns `201`.
 */

export const dynamic = 'force-dynamic'

export const POST = withAuth<unknown>(async ({ request, requestId, user }) => {
  const body = await readJsonBody(request)
  const asOf = parseAsOf(new URL(request.url).searchParams.get('asOf'))
  const input = parseRecordPaymentRequest(body, user.email ?? user.uid)

  const result = await recordPayment({ ...input, asOf })

  return success(
    {
      duplicate: result.duplicate,
      payment: serializePayment(result.payment),
      allocations: result.allocations.map(serializeAllocation),
      loan: serializeLoan(result.loan.loan),
      schedule: result.loan.installments.map(serializeInstallment),
      position: serializePosition(result.loan.position),
      payments: result.loan.payments.map(serializePayment),
    },
    { status: result.duplicate ? 200 : 201, requestId },
  )
})
