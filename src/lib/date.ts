/**
 * Calendar-date helpers.
 *
 * A due date is a calendar date, not an instant, so the canonical
 * representation everywhere in this service is the string `YYYY-MM-DD`. That is
 * also exactly what Postgres `DATE` round-trips. All arithmetic is done through
 * UTC so that the server's local timezone can never shift a due date by a day.
 */

declare const ISO_DATE_BRAND: unique symbol

export type IsoDate = string & { readonly [ISO_DATE_BRAND]: 'IsoDate' }

const ISO_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/

export class DateError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'DateError'
  }
}

/** Validate a `YYYY-MM-DD` string, rejecting impossible dates like 2025-02-30. */
export function parseIsoDate(value: string, label = 'date'): IsoDate {
  const match = ISO_DATE_PATTERN.exec(value)
  if (!match) {
    throw new DateError(`${label} must be formatted as YYYY-MM-DD, received "${value}"`)
  }
  const [, year, month, day] = match as unknown as [string, string, string, string]
  const y = Number(year)
  const m = Number(month)
  const d = Number(day)
  if (m < 1 || m > 12 || d < 1 || d > daysInMonth(y, m)) {
    throw new DateError(`${label} is not a real calendar date: "${value}"`)
  }
  return value as IsoDate
}

export function isIsoDate(value: unknown): value is IsoDate {
  if (typeof value !== 'string') return false
  try {
    parseIsoDate(value)
    return true
  } catch {
    return false
  }
}

function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate()
}

function toUtc(date: IsoDate): Date {
  return new Date(`${date}T00:00:00.000Z`)
}

function fromUtc(date: Date): IsoDate {
  return date.toISOString().slice(0, 10) as IsoDate
}

/**
 * Add whole months, clamping to the last day of the target month.
 *
 * A loan disbursed on the 31st has instalments due on the 30th in
 * thirty-day months and on the 28th/29th in February. This is the convention
 * lenders use for monthly instalments, and it keeps the due day stable rather
 * than drifting forward into the following month.
 */
export function addMonths(date: IsoDate, months: number): IsoDate {
  if (!Number.isInteger(months)) {
    throw new DateError(`months must be a whole number, received ${months}`)
  }
  const base = toUtc(date)
  const year = base.getUTCFullYear()
  const month = base.getUTCMonth()
  const day = base.getUTCDate()

  const targetMonthIndex = month + months
  const targetYear = year + Math.floor(targetMonthIndex / 12)
  const normalisedMonth = ((targetMonthIndex % 12) + 12) % 12
  const clampedDay = Math.min(day, daysInMonth(targetYear, normalisedMonth + 1))

  return fromUtc(new Date(Date.UTC(targetYear, normalisedMonth, clampedDay)))
}

export function addDays(date: IsoDate, days: number): IsoDate {
  const base = toUtc(date)
  base.setUTCDate(base.getUTCDate() + days)
  return fromUtc(base)
}

const MS_PER_DAY = 24 * 60 * 60 * 1000

/** Whole days from `from` to `to`. Negative when `to` is earlier. */
export function daysBetween(from: IsoDate, to: IsoDate): number {
  return Math.round((toUtc(to).getTime() - toUtc(from).getTime()) / MS_PER_DAY)
}

/** -1 / 0 / 1. Lexicographic comparison is correct for zero-padded ISO dates. */
export function compareIsoDates(a: IsoDate, b: IsoDate): number {
  return a < b ? -1 : a > b ? 1 : 0
}

export function isBefore(a: IsoDate, b: IsoDate): boolean {
  return a < b
}

export function isAfter(a: IsoDate, b: IsoDate): boolean {
  return a > b
}

/** Today in the given IANA zone. Defaults to IST, the business timezone here. */
export function today(timeZone = 'Asia/Kolkata'): IsoDate {
  // `en-CA` formats as YYYY-MM-DD, which is exactly the shape we want.
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date()) as IsoDate
}

/** Normalise whatever the `pg` driver hands back for a `DATE` column. */
export function isoDateFromDb(value: string | Date, label = 'date'): IsoDate {
  if (value instanceof Date) return fromUtc(value)
  return parseIsoDate(value.slice(0, 10), label)
}

/** Presentation only, e.g. `15 Oct 2025`. */
export function formatIsoDate(date: IsoDate): string {
  return new Intl.DateTimeFormat('en-IN', {
    timeZone: 'UTC',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(toUtc(date))
}
