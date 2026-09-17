import { describe, expect, it } from 'vitest'

import { allocatePayment } from '@/domain/allocation'
import { generateSchedule } from '@/domain/schedule'
import { addDays, parseIsoDate } from '@/lib/date'
import { percentToBasisPoints, rupeesToPaise } from '@/lib/money'
import { allocatableFrom, applyLines } from '../helpers/schedule'

const schedule = generateSchedule({
  principal: rupeesToPaise(200_000),
  annualRateBps: percentToBasisPoints(18),
  tenureMonths: 24,
  disbursementDate: parseIsoDate('2025-01-15'),
})

const installments = allocatableFrom(schedule)
const firstDueDate = schedule.installments[0]!.dueDate

describe('payment allocation', () => {
  it('applies an underpayment to interest first, leaving the instalment part paid', () => {
    // The brief's case: the instalment is ~Rs 9,986 and Rs 5,000 arrives.
    const result = allocatePayment({
      amount: rupeesToPaise(5_000),
      paymentDate: firstDueDate,
      installments,
    })

    expect(result.lines).toHaveLength(1)
    const line = result.lines[0]!
    expect(line.installmentNumber).toBe(1)

    // Interest for month one is Rs 3,000, so it is settled in full and the
    // remaining Rs 2,000 goes against principal.
    expect(line.interest).toBe(rupeesToPaise(3_000))
    expect(line.principal).toBe(rupeesToPaise(2_000))

    expect(result.allocated).toBe(rupeesToPaise(5_000))
    expect(result.unallocated).toBe(0)

    // The instalment is not settled: the shortfall keeps counting against it.
    const afterFirst = applyLines(installments, result.lines)
    const stillOwed =
      afterFirst[0]!.principalComponent +
      afterFirst[0]!.interestComponent -
      afterFirst[0]!.principalPaid -
      afterFirst[0]!.interestPaid
    expect(stillOwed).toBe(schedule.emi - rupeesToPaise(5_000))

    // A payment split across more than one transaction settles the rest: the
    // second instalment picks up exactly where the first left off, and nothing
    // spills onto instalment 2.
    const remainder = allocatePayment({
      amount: stillOwed as never,
      paymentDate: firstDueDate,
      installments: afterFirst,
    })

    expect(remainder.lines).toHaveLength(1)
    expect(remainder.lines[0]!.installmentNumber).toBe(1)
    expect(remainder.unallocated).toBe(0)

    const settled = applyLines(afterFirst, remainder.lines)[0]!
    expect(settled.interestPaid).toBe(settled.interestComponent)
    expect(settled.principalPaid).toBe(settled.principalComponent)
  })

  it('cascades an overpayment onto the following instalments rather than reducing principal', () => {
    const result = allocatePayment({
      amount: (schedule.emi * 2) as never,
      paymentDate: firstDueDate,
      installments,
    })

    // Twice the instalment settles instalments 1 and 2 in full. The schedule is
    // not re-amortised, so instalment 3 keeps its original components and the
    // borrower's next due date simply moves forward a month.
    expect(result.lines.map((line) => line.installmentNumber)).toEqual([1, 2])
    expect(result.lines[0]!.total).toBe(schedule.emi)
    expect(result.lines[1]!.total).toBe(schedule.emi)
    expect(result.unallocated).toBe(0)

    const after = applyLines(installments, result.lines)
    expect(after[2]!.principalComponent).toBe(schedule.installments[2]!.principalComponent)
    expect(after[2]!.interestComponent).toBe(schedule.installments[2]!.interestComponent)
    expect(after[2]!.principalPaid).toBe(0)
  })

  it('records how late a payment was without moving any due date', () => {
    // The brief's case: payment arrives eleven days after the due date.
    const elevenDaysLate = addDays(firstDueDate, 11)

    const result = allocatePayment({
      amount: schedule.emi,
      paymentDate: elevenDaysLate,
      installments,
    })

    expect(result.lines[0]!.daysLate).toBe(11)
    expect(result.lines[0]!.total).toBe(schedule.emi)

    // Lateness is recorded, not charged: the instalment settles for exactly
    // what it was worth, and every due date is untouched.
    const after = applyLines(installments, result.lines)
    expect(after.map((i) => i.dueDate)).toEqual(schedule.installments.map((i) => i.dueDate))

    // A payment that arrives early or on time carries no lateness.
    const onTime = allocatePayment({
      amount: schedule.emi,
      paymentDate: firstDueDate,
      installments,
    })
    expect(onTime.lines[0]!.daysLate).toBe(0)
  })

  it('holds money that no instalment can absorb instead of discarding it', () => {
    // Settle every instalment, then send one more rupee.
    const settled = installments.map((installment) => ({
      ...installment,
      principalPaid: installment.principalComponent,
      interestPaid: installment.interestComponent,
    }))

    const result = allocatePayment({
      amount: rupeesToPaise(1),
      paymentDate: firstDueDate,
      installments: settled,
    })

    expect(result.lines).toHaveLength(0)
    expect(result.allocated).toBe(0)
    expect(result.unallocated).toBe(rupeesToPaise(1))

    // A payment larger than the whole remaining schedule splits the same way:
    // everything that can be allocated is, and the surplus is retained.
    const total = schedule.totalPayable
    const overshoot = allocatePayment({
      amount: (total + rupeesToPaise(500)) as never,
      paymentDate: firstDueDate,
      installments,
    })
    expect(overshoot.allocated).toBe(total)
    expect(overshoot.unallocated).toBe(rupeesToPaise(500))
    expect(overshoot.allocated + overshoot.unallocated).toBe(total + rupeesToPaise(500))
  })
})
