import type { MoneyDto } from '@/api/serializers'

/**
 * Presentation helpers for the UI.
 *
 * These read the exact integer `paise` from the API and format it for display.
 * Nothing here is used for arithmetic — the server does all of that.
 */

const RUPEES = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

const RUPEES_WHOLE = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
})

export function formatMoney(money: MoneyDto): string {
  return RUPEES.format(money.paise / 100)
}

/** Drops the paise, for headline figures where two decimals only add noise. */
export function formatMoneyWhole(money: MoneyDto): string {
  return RUPEES_WHOLE.format(money.paise / 100)
}

export function formatDate(isoDate: string): string {
  const [year, month, day] = isoDate.split('-').map(Number)
  if (!year || !month || !day) return isoDate
  return new Intl.DateTimeFormat('en-IN', {
    timeZone: 'UTC',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(Date.UTC(year, month - 1, day)))
}

/** `28 Feb` — used where the year is obvious from context. */
export function formatDateShort(isoDate: string): string {
  const [year, month, day] = isoDate.split('-').map(Number)
  if (!year || !month || !day) return isoDate
  return new Intl.DateTimeFormat('en-IN', {
    timeZone: 'UTC',
    day: '2-digit',
    month: 'short',
  }).format(new Date(Date.UTC(year, month - 1, day)))
}

export function formatPercent(value: number): string {
  return `${Number.isInteger(value) ? value : value.toFixed(2)}%`
}

export function pluralise(count: number, singular: string, plural = `${singular}s`): string {
  return `${count} ${count === 1 ? singular : plural}`
}

/** `today`, `in 12 days`, `14 days ago` — relative to the position's `asOf`. */
export function describeDueDistance(dueDate: string, asOf: string): string {
  const days = wholeDaysBetween(asOf, dueDate)
  if (days === 0) return 'due today'
  if (days === 1) return 'due tomorrow'
  if (days > 0) return `in ${days} days`
  if (days === -1) return '1 day ago'
  return `${Math.abs(days)} days ago`
}

export function wholeDaysBetween(from: string, to: string): number {
  const start = Date.parse(`${from}T00:00:00Z`)
  const end = Date.parse(`${to}T00:00:00Z`)
  if (Number.isNaN(start) || Number.isNaN(end)) return 0
  return Math.round((end - start) / 86_400_000)
}
