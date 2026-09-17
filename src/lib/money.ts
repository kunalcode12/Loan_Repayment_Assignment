/**
 * Money arithmetic.
 *
 * Every amount in this service is an integer number of **paise** (1/100 of a
 * rupee). No monetary value is ever held, added or persisted as a decimal /
 * floating point number: the database column type is `BIGINT` and the in-memory
 * representation is a JavaScript integer carrying the `Paise` brand.
 *
 * Why an integer `number` and not `bigint`: the largest loan this service
 * accepts is Rs 10,00,000, i.e. 100_000_000 paise. Even the sum of every
 * instalment of the largest, longest, most expensive loan stays below 10^10,
 * which is ~6 orders of magnitude inside `Number.MAX_SAFE_INTEGER` (~9.0×10^15).
 * Integer arithmetic in that range is exact. `assertPaise` guards the boundary
 * where values enter the domain (API input, database rows) so a non-integer can
 * never leak in.
 */

declare const PAISE_BRAND: unique symbol

export type Paise = number & { readonly [PAISE_BRAND]: 'Paise' }

/** Basis points. 1% = 100 bps, so 18% p.a. is stored as 1800. */
declare const BPS_BRAND: unique symbol

export type BasisPoints = number & { readonly [BPS_BRAND]: 'BasisPoints' }

export const ZERO = 0 as Paise

export class MoneyError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'MoneyError'
  }
}

/** Narrow an arbitrary number to `Paise`, rejecting anything non-integral. */
export function assertPaise(value: number, label = 'amount'): Paise {
  if (!Number.isInteger(value)) {
    throw new MoneyError(`${label} must be an integer number of paise, received ${value}`)
  }
  if (!Number.isSafeInteger(value)) {
    throw new MoneyError(`${label} is outside the exact integer range: ${value}`)
  }
  return value as Paise
}

export function assertBasisPoints(value: number, label = 'rate'): BasisPoints {
  if (!Number.isInteger(value) || value < 0) {
    throw new MoneyError(`${label} must be a non-negative integer number of basis points`)
  }
  return value as BasisPoints
}

/**
 * Convert a rupee amount supplied by a caller into paise.
 *
 * Rupee input arrives as a JSON number, so it is a float by definition. It is
 * multiplied and rounded exactly once, here, at the edge of the system; from
 * this point on the value is an integer.
 */
export function rupeesToPaise(rupees: number, label = 'amount'): Paise {
  if (!Number.isFinite(rupees)) {
    throw new MoneyError(`${label} must be a finite number`)
  }
  // `Math.round(x * 100)` alone misreads values such as 1.005 because of binary
  // float representation. Rounding the scaled value to 6 decimals first removes
  // the representation error before the half-up step.
  const scaled = Number((rupees * 100).toFixed(6))
  return assertPaise(Math.round(scaled), label)
}

/** Paise -> rupees, for presentation only. Never feed the result back in. */
export function paiseToRupees(amount: Paise): number {
  return amount / 100
}

/** Percent per annum (e.g. 18 or 18.5) -> integer basis points. */
export function percentToBasisPoints(percent: number, label = 'interest rate'): BasisPoints {
  if (!Number.isFinite(percent)) {
    throw new MoneyError(`${label} must be a finite number`)
  }
  const scaled = Number((percent * 100).toFixed(6))
  return assertBasisPoints(Math.round(scaled), label)
}

export function basisPointsToPercent(bps: BasisPoints): number {
  return bps / 100
}

/**
 * The periodic (monthly) interest rate as a plain float.
 *
 * This is a *rate*, not money, so a float is the correct representation. It is
 * used only inside `Math.pow` and a single multiply-then-round, and every value
 * it produces is rounded back to whole paise before being stored or summed.
 */
export function monthlyRateFromBps(bps: BasisPoints): number {
  return bps / 10_000 / 12
}

export function addPaise(...amounts: Paise[]): Paise {
  let total = 0
  for (const amount of amounts) total += amount
  return assertPaise(total, 'sum')
}

export function subtractPaise(a: Paise, b: Paise): Paise {
  return assertPaise(a - b, 'difference')
}

export function minPaise(a: Paise, b: Paise): Paise {
  return (a < b ? a : b) as Paise
}

export function maxPaise(a: Paise, b: Paise): Paise {
  return (a > b ? a : b) as Paise
}

/** Clamp negatives to zero. Used where a remainder must never go below zero. */
export function nonNegative(amount: number): Paise {
  return assertPaise(amount < 0 ? 0 : amount, 'amount')
}

/**
 * Multiply an amount by a rate and round half-up to the nearest paise.
 *
 * Half-up (rather than JavaScript's `Math.round`, which is half-up only for
 * positives) is stated explicitly because interest components are always
 * non-negative here, and lenders conventionally round interest half-up.
 */
export function multiplyByRate(amount: Paise, rate: number): Paise {
  if (!Number.isFinite(rate) || rate < 0) {
    throw new MoneyError(`rate must be a finite non-negative number, received ${rate}`)
  }
  return assertPaise(Math.round(amount * rate), 'interest')
}

/**
 * Parse a `BIGINT` column. `node-postgres` returns `BIGINT` as a string so that
 * precision is never silently lost; we validate the digits and then widen to a
 * number, which is exact for our range.
 */
export function paiseFromDb(value: string | number | bigint | null, label = 'amount'): Paise {
  if (value === null || value === undefined) {
    throw new MoneyError(`${label} was null in the database`)
  }
  if (typeof value === 'bigint') return assertPaise(Number(value), label)
  if (typeof value === 'number') return assertPaise(value, label)
  if (!/^-?\d+$/.test(value.trim())) {
    throw new MoneyError(`${label} is not an integer value: ${value}`)
  }
  return assertPaise(Number(value.trim()), label)
}

/** Serialise for `BIGINT` parameters. */
export function paiseToDb(amount: Paise): string {
  return String(amount)
}

const INR = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

/** Human-readable rupee string, e.g. `₹9,985.98`. */
export function formatPaise(amount: Paise): string {
  return INR.format(paiseToRupees(amount))
}
