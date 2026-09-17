import { z } from 'zod'

import { isIsoDate, parseIsoDate, type IsoDate } from '@/lib/date'
import { AppError } from '@/lib/errors'
import { percentToBasisPoints, rupeesToPaise } from '@/lib/money'
import { LOAN_LIMITS } from '@/domain/types'
import type { CreateLoanInput } from '@/services/loan.service'
import type { RecordPaymentInput } from '@/services/payment.service'
import { zodIssues } from './handler'

/**
 * Request validation.
 *
 * Numbers are validated with `z.number()` and never coerced, so `"5000"`,
 * `"abc"`, `null` and `NaN` are all rejected with a 400 rather than quietly
 * becoming a number. Dates are validated as real calendar dates, so
 * `2025-02-30` fails here rather than in Postgres.
 *
 * Amounts arrive in **rupees** because that is what a caller naturally sends;
 * this module is the boundary where they become integer paise, and it is the
 * only place that conversion happens.
 */

const rupeeAmount = z
  .number()
  .refine(Number.isFinite, 'Must be a finite number.')
  .refine((value) => value > 0, 'Must be greater than zero.')
  // Rupees carry at most two decimal places; a third would be a fraction of a
  // paisa and there is no honest way to round it on the caller's behalf.
  .refine(
    (value) => Math.abs(value * 100 - Math.round(value * 100)) < 1e-6,
    'Must not be finer than one paisa (two decimal places).',
  )

const isoDateString = z
  .string()
  .refine(isIsoDate, 'Must be a real calendar date formatted as YYYY-MM-DD.')

export const createLoanSchema = z.object({
  principal: rupeeAmount,
  annualInterestRate: z
    .number()
    .refine(Number.isFinite, 'Must be a finite number.')
    .refine((value) => value >= 0, 'Must not be negative.')
    .refine((value) => value <= 100, 'Must not exceed 100% per annum.'),
  tenureMonths: z
    .number()
    .int('Must be a whole number of months.')
    .refine(
      (value) => value >= LOAN_LIMITS.minTenureMonths,
      `Must be at least ${LOAN_LIMITS.minTenureMonths} months.`,
    )
    .refine(
      (value) => value <= LOAN_LIMITS.maxTenureMonths,
      `Must not exceed ${LOAN_LIMITS.maxTenureMonths} months.`,
    ),
  disbursementDate: isoDateString,
})

export const recordPaymentSchema = z.object({
  loanId: z.uuid('Must be a valid loan identifier.'),
  amount: rupeeAmount,
  paymentDate: isoDateString,
  idempotencyKey: z
    .string()
    .min(8, 'Must be at least 8 characters.')
    .max(200, 'Must not exceed 200 characters.'),
})

/** Run a schema and convert a failure into the shared 400 envelope. */
function parse<T>(schema: z.ZodType<T>, body: unknown, what: string): T {
  const result = schema.safeParse(body)
  if (!result.success) {
    throw AppError.validation(`The ${what} request is invalid.`, zodIssues(result.error))
  }
  return result.data
}

export function parseCreateLoanRequest(body: unknown): CreateLoanInput {
  const input = parse(createLoanSchema, body, 'create loan')

  return {
    principal: rupeesToPaise(input.principal, 'principal'),
    annualRateBps: percentToBasisPoints(input.annualInterestRate, 'annualInterestRate'),
    tenureMonths: input.tenureMonths,
    disbursementDate: parseIsoDate(input.disbursementDate, 'disbursementDate'),
  }
}

export function parseRecordPaymentRequest(
  body: unknown,
  recordedBy: string | null,
): RecordPaymentInput {
  const input = parse(recordPaymentSchema, body, 'record payment')

  return {
    loanId: input.loanId,
    amount: rupeesToPaise(input.amount, 'amount'),
    paymentDate: parseIsoDate(input.paymentDate, 'paymentDate'),
    idempotencyKey: input.idempotencyKey,
    recordedBy,
  }
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * Validate a loan id from the URL before it reaches Postgres.
 *
 * Without this, a path such as `/api/loans/not-a-loan` would raise
 * `invalid input syntax for type uuid` and surface as a 500. A malformed id is
 * a bad request (400); a well-formed id that does not exist is a 404, and the
 * service layer raises that.
 */
export function parseLoanId(value: string | undefined): string {
  if (!value || !UUID_PATTERN.test(value)) {
    throw AppError.validation('The loan identifier in the URL is not a valid loan id.', [
      { field: 'loanId', message: 'Must be a UUID.' },
    ])
  }
  return value
}

/** Optional `?asOf=YYYY-MM-DD` used to ask for the position on a given date. */
export function parseAsOf(value: string | null): IsoDate | undefined {
  if (value === null || value.trim() === '') return undefined
  return parseIsoDate(value.trim(), 'asOf')
}
