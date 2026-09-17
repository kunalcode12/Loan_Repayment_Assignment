'use client'

import type { PaymentDto } from '@/api/serializers'
import { formatDate, formatMoney } from '@/lib/format'
import { Badge, Panel, PanelHeader } from './ui/surface'

/** Every payment received against this loan, most recent first. */
export function PaymentHistory({ payments }: { payments: PaymentDto[] }) {
  return (
    <Panel padded={false}>
      <div className="p-6 sm:p-8 sm:pb-5">
        <PanelHeader
          title="Payments received"
          description={
            payments.length === 0
              ? 'Nothing has been received against this loan yet.'
              : undefined
          }
        />
      </div>

      {payments.length > 0 ? (
        <ul className="divide-y divide-border border-t border-border">
          {payments.map((payment) => (
            <li key={payment.id} className="flex items-start justify-between gap-4 px-6 py-4 sm:px-8">
              <div className="min-w-0">
                <p className="tabular text-[0.9375rem] font-medium text-ink">
                  {formatMoney(payment.amount)}
                </p>
                <p className="mt-1 text-[0.75rem] text-ink-subtle">
                  {formatDate(payment.paymentDate)}
                  {payment.recordedBy ? ` · ${payment.recordedBy}` : ''}
                </p>
              </div>
              {payment.unallocated.paise > 0 ? (
                <Badge tone="info">{formatMoney(payment.unallocated)} unallocated</Badge>
              ) : (
                <Badge tone="positive">Allocated</Badge>
              )}
            </li>
          ))}
        </ul>
      ) : null}
    </Panel>
  )
}
