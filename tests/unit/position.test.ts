import { describe, expect, it } from 'vitest'

import { allocatePayment } from '@/domain/allocation'
import { buildPosition } from '@/domain/position'
import { generateSchedule } from '@/domain/schedule'
import { addDays, parseIsoDate } from '@/lib/date'
import { percentToBasisPoints, rupeesToPaise, ZERO } from '@/lib/money'
import { allocatableFrom, applyLines } from '../helpers/schedule'

const schedule = generateSchedule({
  principal: rupeesToPaise(200_000),
  annualRateBps: percentToBasisPoints(18),
  tenureMonths: 24,
  disbursementDate: parseIsoDate('2025-01-15'),
})

describe('loan position', () => {
  it('reports arrears while they stand, and clears them once a late payment lands', () => {
    const installments = allocatableFrom(schedule)
    const [first, second] = schedule.installments
    const firstDue = first!.dueDate // 2025-02-15
    const secondDue = second!.dueDate // 2025-03-15

    // Eleven days after the first instalment fell due, nothing has been paid.
    const asOf = addDays(firstDue, 11)
    const before = buildPosition({ installments, excessCredit: ZERO, asOf })

    expect(before.position.status).toBe('ACTIVE')
    expect(before.position.overdueInstallmentCount).toBe(1)
    expect(before.position.overdueAmount).toBe(schedule.emi)
    expect(before.position.daysPastDue).toBe(11)
    expect(before.position.nextDueDate).toBe(firstDue)
    expect(before.position.nextDueAmount).toBe(schedule.emi)
    expect(before.position.outstandingPrincipal).toBe(rupeesToPaise(200_000))
    expect(before.installments[0]?.status).toBe('OVERDUE')

    // The payment arrives on that eleventh day.
    const allocation = allocatePayment({
      amount: schedule.emi,
      paymentDate: asOf,
      installments,
    })
    const after = buildPosition({
      installments: applyLines(installments, allocation.lines),
      excessCredit: ZERO,
      asOf,
    })

    // Arrears are gone, the next due date has rolled forward, and outstanding
    // principal has fallen by exactly the principal component of instalment one.
    expect(after.position.overdueAmount).toBe(0)
    expect(after.position.overdueInstallmentCount).toBe(0)
    expect(after.position.daysPastDue).toBe(0)
    expect(after.position.nextDueDate).toBe(secondDue)
    expect(after.position.outstandingPrincipal).toBe(
      rupeesToPaise(200_000) - first!.principalComponent,
    )
    expect(after.position.totalPaid).toBe(schedule.emi)
    expect(after.installments[0]?.status).toBe('PAID')

    // An instalment that is due but not yet past its date is not overdue.
    const onDueDate = buildPosition({ installments, excessCredit: ZERO, asOf: firstDue })
    expect(onDueDate.position.overdueAmount).toBe(0)
    expect(onDueDate.installments[0]?.status).toBe('DUE')
  })

  it('closes the loan once every instalment is settled', () => {
    const settled = allocatableFrom(schedule).map((installment) => ({
      ...installment,
      principalPaid: installment.principalComponent,
      interestPaid: installment.interestComponent,
    }))

    const { position } = buildPosition({
      installments: settled,
      excessCredit: rupeesToPaise(250),
      asOf: parseIsoDate('2027-06-01'),
    })

    expect(position.status).toBe('CLOSED')
    expect(position.outstandingPrincipal).toBe(0)
    expect(position.totalOutstanding).toBe(0)
    expect(position.nextDueDate).toBeNull()
    expect(position.totalPaid).toBe(schedule.totalPayable)
    expect(position.excessCredit).toBe(rupeesToPaise(250))
  })
})
