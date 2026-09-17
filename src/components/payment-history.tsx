'use client'

import type { PaymentDto } from '@/api/serializers'
import { formatDate, formatMoney, pluralise } from '@/lib/format'
import { Badge } from './ui/surface'

/** Every payment received against this loan, most recent first. */
export function PaymentHistory({ payments }: { payments: PaymentDto[] }) {
  return (
    <section className="rounded-sharp animate-fade border border-border bg-surface">
      <header className="flex items-center justify-between gap-3 border-b border-border px-6 py-5 sm:px-8">
        <h2 className="text-[0.9375rem] font-semibold tracking-[-0.01em] text-ink">
          Payments received
        </h2>
        {payments.length > 0 ? (
          <span className="font-mono text-[0.625rem] tracking-[0.1em] text-ink-subtle">
            {String(payments.length).padStart(2, '0')}
          </span>
        ) : null}
      </header>

      {payments.length === 0 ? (
        <p className="px-6 py-8 text-center text-[0.75rem] text-ink-subtle sm:px-8">
          Nothing received against this loan yet.
        </p>
      ) : (
        <ul>
          {payments.map((payment) => (
            <li
              key={payment.id}
              className="flex items-start justify-between gap-4 border-b border-border px-6 py-4 last:border-b-0 sm:px-8"
            >
              <div className="min-w-0">
                <p className="tabular text-[0.875rem] font-medium text-ink">
                  {formatMoney(payment.amount)}
                </p>
                <p className="mt-1 truncate text-[0.6875rem] text-ink-subtle">
                  {formatDate(payment.paymentDate)}
                  {payment.recordedBy ? ` · ${payment.recordedBy}` : ''}
                </p>
              </div>
              {payment.unallocated.paise > 0 ? (
                <Badge tone="info">{formatMoney(payment.unallocated)} held</Badge>
              ) : (
                <Badge tone="neutral">Allocated</Badge>
              )}
            </li>
          ))}
        </ul>
      )}

      {payments.length > 0 ? (
        <p className="border-t border-border px-6 py-3 text-[0.6875rem] text-ink-subtle sm:px-8">
          {pluralise(payments.length, 'payment')} on record
        </p>
      ) : null}
    </section>
  )
}
