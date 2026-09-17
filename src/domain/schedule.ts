import {
  addPaise,
  assertPaise,
  minPaise,
  monthlyRateFromBps,
  multiplyByRate,
  nonNegative,
  subtractPaise,
  type BasisPoints,
  type Paise,
} from '@/lib/money'
import { addMonths } from '@/lib/date'
import { AppError } from '@/lib/errors'
import { LOAN_LIMITS, type GeneratedSchedule, type ScheduleInput, type ScheduledInstallment } from './types'

/**
 * Equal monthly instalment.
 *
 *     EMI = P x r x (1 + r)^n / ((1 + r)^n - 1)
 *
 * `r` is the monthly rate (annual percent / 12 / 100) and `n` the tenure in
 * months. The power term is genuine real arithmetic, so it is evaluated as a
 * float and then rounded, exactly once, to whole paise. Every figure derived
 * from the EMI afterwards is integer arithmetic.
 *
 * Reference check from the brief: Rs 2,00,000 at 18% p.a. over 24 months gives
 * 9,98,482 paise (Rs 9,984.82), which is the exact value of the formula and sits
 * inside the brief's stated tolerance of one to two rupees around Rs 9,986.
 */
export function calculateEmi(principal: Paise, annualRateBps: BasisPoints, tenureMonths: number): Paise {
  if (!Number.isInteger(tenureMonths) || tenureMonths <= 0) {
    throw AppError.validation('Tenure must be a whole number of months greater than zero.')
  }

  const monthlyRate = monthlyRateFromBps(annualRateBps)

  // An interest-free loan is a straight division; the formula above is 0/0 there.
  if (monthlyRate === 0) {
    return assertPaise(Math.round(principal / tenureMonths), 'emi')
  }

  const growth = Math.pow(1 + monthlyRate, tenureMonths)
  const emi = (principal * monthlyRate * growth) / (growth - 1)

  if (!Number.isFinite(emi)) {
    throw AppError.validation('The supplied principal, rate and tenure do not produce a finite instalment.')
  }

  return assertPaise(Math.round(emi), 'emi')
}

/**
 * Build the full amortisation schedule.
 *
 * For each month the interest component is charged on the balance still
 * outstanding at the start of that month, and whatever is left of the EMI
 * reduces principal. Rounding each month to whole paise leaves a small residue;
 * the **final instalment absorbs it** — it repays the entire remaining balance,
 * so the principal components always sum to exactly the principal disbursed.
 * This is the convention the brief calls for.
 */
export function generateSchedule(input: ScheduleInput): GeneratedSchedule {
  validateScheduleInput(input)

  const { principal, annualRateBps, tenureMonths, disbursementDate } = input
  const monthlyRate = monthlyRateFromBps(annualRateBps)
  const emi = calculateEmi(principal, annualRateBps, tenureMonths)

  const installments: ScheduledInstallment[] = []
  let balance = principal

  for (let installmentNumber = 1; installmentNumber <= tenureMonths; installmentNumber += 1) {
    const openingBalance = balance
    const interestComponent = multiplyByRate(openingBalance, monthlyRate)
    const isFinal = installmentNumber === tenureMonths

    // The last instalment clears the balance outright; earlier ones pay down by
    // `EMI - interest`, capped at the balance so it can never go negative.
    const principalComponent = isFinal
      ? openingBalance
      : minPaise(nonNegative(emi - interestComponent), openingBalance)

    const totalDue = addPaise(principalComponent, interestComponent)
    balance = subtractPaise(openingBalance, principalComponent)

    installments.push({
      installmentNumber,
      dueDate: addMonths(disbursementDate, installmentNumber),
      openingBalance,
      principalComponent,
      interestComponent,
      totalDue,
      closingBalance: balance,
    })
  }

  const totalPrincipal = addPaise(...installments.map((i) => i.principalComponent))
  const totalInterest = addPaise(...installments.map((i) => i.interestComponent))

  // Invariant: the schedule must repay the principal exactly, to the paise.
  if (totalPrincipal !== principal) {
    throw AppError.internal(
      `Schedule generation is inconsistent: principal components sum to ${totalPrincipal} but the principal is ${principal}.`,
    )
  }

  return {
    emi,
    installments,
    totalPrincipal,
    totalInterest,
    totalPayable: addPaise(totalPrincipal, totalInterest),
  }
}

function validateScheduleInput(input: ScheduleInput): void {
  const { principal, annualRateBps, tenureMonths } = input

  if (principal < LOAN_LIMITS.minPrincipalPaise || principal > LOAN_LIMITS.maxPrincipalPaise) {
    throw AppError.validation(
      `Principal must be between Rs ${LOAN_LIMITS.minPrincipalPaise / 100} and Rs ${LOAN_LIMITS.maxPrincipalPaise / 100}.`,
      [{ field: 'principal', message: 'Outside the supported lending range.' }],
    )
  }

  if (
    !Number.isInteger(tenureMonths) ||
    tenureMonths < LOAN_LIMITS.minTenureMonths ||
    tenureMonths > LOAN_LIMITS.maxTenureMonths
  ) {
    throw AppError.validation(
      `Tenure must be a whole number of months between ${LOAN_LIMITS.minTenureMonths} and ${LOAN_LIMITS.maxTenureMonths}.`,
      [{ field: 'tenureMonths', message: 'Outside the supported tenure range.' }],
    )
  }

  if (annualRateBps < 0 || annualRateBps > LOAN_LIMITS.maxAnnualRateBps) {
    throw AppError.validation('Annual interest rate must be between 0% and 100%.', [
      { field: 'annualInterestRate', message: 'Outside the supported rate range.' },
    ])
  }
}
