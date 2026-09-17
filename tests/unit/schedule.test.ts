import { describe, expect, it } from 'vitest'

import { generateSchedule } from '@/domain/schedule'
import { parseIsoDate } from '@/lib/date'
import { percentToBasisPoints, rupeesToPaise } from '@/lib/money'
import { AppError } from '@/lib/errors'

const REFERENCE = {
  principal: rupeesToPaise(200_000),
  annualRateBps: percentToBasisPoints(18),
  tenureMonths: 24,
  disbursementDate: parseIsoDate('2025-01-15'),
}

describe('schedule generation', () => {
  it('matches the reference EMI from the brief', () => {
    const schedule = generateSchedule(REFERENCE)

    // The brief quotes ~Rs 9,986 for Rs 2,00,000 at 18% p.a. over 24 months and
    // allows one to two rupees of rounding variance. The formula's exact value
    // is Rs 9,984.82, which is 1.18 rupees inside that tolerance.
    expect(Math.abs(schedule.emi - rupeesToPaise(9_986))).toBeLessThanOrEqual(rupeesToPaise(2))
    expect(schedule.emi).toBe(998_482)

    // First instalment: one month of interest on the full principal.
    // 2,00,000 x 1.5% = 3,000 exactly.
    expect(schedule.installments[0]?.interestComponent).toBe(rupeesToPaise(3_000))
    expect(schedule.installments[0]?.principalComponent).toBe(998_482 - 300_000)
  })

  it('repays the principal to the exact paise, with the remainder in the final instalment', () => {
    const schedule = generateSchedule(REFERENCE)

    expect(schedule.installments).toHaveLength(24)

    const principalSum = schedule.installments.reduce((total, i) => total + i.principalComponent, 0)
    const interestSum = schedule.installments.reduce((total, i) => total + i.interestComponent, 0)

    expect(principalSum).toBe(REFERENCE.principal)
    expect(schedule.totalInterest).toBe(interestSum)
    expect(schedule.totalPayable).toBe(principalSum + interestSum)

    // The balance is fully extinguished, and the last instalment carries the
    // accumulated rounding difference rather than any earlier one.
    const final = schedule.installments.at(-1)
    expect(final?.closingBalance).toBe(0)
    expect(final?.totalDue).not.toBe(schedule.emi)
    expect(Math.abs((final?.totalDue ?? 0) - schedule.emi)).toBeLessThan(rupeesToPaise(1))

    // Every instalment before the last is exactly the EMI.
    for (const installment of schedule.installments.slice(0, -1)) {
      expect(installment.totalDue).toBe(schedule.emi)
    }
  })

  it('places due dates one month apart, clamping to the end of short months', () => {
    const schedule = generateSchedule({
      ...REFERENCE,
      tenureMonths: 12,
      // The 31st does not exist in most months; the due day clamps rather than
      // spilling into the following month.
      disbursementDate: parseIsoDate('2025-01-31'),
    })

    expect(schedule.installments.map((i) => i.dueDate).slice(0, 5)).toEqual([
      '2025-02-28',
      '2025-03-31',
      '2025-04-30',
      '2025-05-31',
      '2025-06-30',
    ])

    // A leap year gives February an extra day.
    const leapYear = generateSchedule({
      ...REFERENCE,
      tenureMonths: 3,
      disbursementDate: parseIsoDate('2027-11-30'),
    })
    expect(leapYear.installments[2]?.dueDate).toBe('2028-02-29')
  })

  it('handles an interest-free loan and rejects impossible terms', () => {
    const interestFree = generateSchedule({
      principal: rupeesToPaise(120_000),
      annualRateBps: percentToBasisPoints(0),
      tenureMonths: 12,
      disbursementDate: parseIsoDate('2025-01-15'),
    })

    expect(interestFree.emi).toBe(rupeesToPaise(10_000))
    expect(interestFree.totalInterest).toBe(0)
    expect(interestFree.totalPayable).toBe(rupeesToPaise(120_000))

    // Zero-month tenure, and a principal outside the supported lending range.
    expect(() => generateSchedule({ ...REFERENCE, tenureMonths: 0 })).toThrow(AppError)
    expect(() => generateSchedule({ ...REFERENCE, tenureMonths: 48 })).toThrow(/tenure/i)
    expect(() =>
      generateSchedule({ ...REFERENCE, principal: rupeesToPaise(1_000) }),
    ).toThrow(/principal/i)
  })
})
