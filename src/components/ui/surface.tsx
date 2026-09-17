import type { ReactNode } from 'react'

import { cn } from './cn'

/** The one card shell every panel on the page is built from. */
export function Panel({
  children,
  className,
  padded = true,
}: {
  children: ReactNode
  className?: string
  padded?: boolean
}) {
  return (
    <section
      className={cn(
        'rounded-2xl border border-border bg-surface shadow-soft',
        padded && 'p-6 sm:p-8',
        className,
      )}
    >
      {children}
    </section>
  )
}

export function PanelHeader({
  title,
  description,
  action,
}: {
  title: string
  description?: ReactNode
  action?: ReactNode
}) {
  return (
    <header className="flex flex-wrap items-start justify-between gap-4">
      <div className="space-y-1.5">
        <h2 className="text-lg font-semibold tracking-[-0.02em] text-ink">{title}</h2>
        {description ? (
          <p className="max-w-prose text-[0.875rem] leading-relaxed text-ink-muted">{description}</p>
        ) : null}
      </div>
      {action}
    </header>
  )
}

type Tone = 'neutral' | 'positive' | 'warning' | 'danger' | 'info'

const TONES: Record<Tone, string> = {
  neutral: 'bg-accent-soft text-ink-muted',
  positive: 'bg-positive-soft text-positive',
  warning: 'bg-warning-soft text-warning',
  danger: 'bg-danger-soft text-danger',
  info: 'bg-info-soft text-info',
}

export function Badge({
  tone = 'neutral',
  children,
  className,
}: {
  tone?: Tone
  children: ReactNode
  className?: string
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1',
        'text-[0.6875rem] font-semibold tracking-[0.04em] uppercase whitespace-nowrap',
        TONES[tone],
        className,
      )}
    >
      {children}
    </span>
  )
}

export function Dot({ tone = 'neutral' }: { tone?: Tone }) {
  const colour: Record<Tone, string> = {
    neutral: 'bg-ink-subtle',
    positive: 'bg-positive',
    warning: 'bg-warning',
    danger: 'bg-danger',
    info: 'bg-info',
  }
  return <span className={cn('size-1.5 shrink-0 rounded-full', colour[tone])} />
}
