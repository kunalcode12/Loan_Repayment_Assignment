import type { ReactNode } from 'react'

import { cn } from './cn'

/**
 * The one card shell every panel on the page is built from.
 *
 * Separation comes from a hairline border rather than a shadow: on a true-black
 * canvas a drop shadow is invisible, and a line reads as structure rather than
 * as floating chrome.
 */
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
        'rounded-sharp border border-border bg-surface',
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
      <div className="space-y-2">
        <h2 className="text-[0.9375rem] font-semibold tracking-[-0.01em] text-ink">{title}</h2>
        {description ? (
          <p className="max-w-prose text-[0.8125rem] leading-relaxed text-ink-muted">
            {description}
          </p>
        ) : null}
      </div>
      {action}
    </header>
  )
}

type Tone = 'neutral' | 'positive' | 'warning' | 'danger' | 'info'

const TONES: Record<Tone, string> = {
  neutral: 'border-border-strong text-ink-muted',
  positive: 'border-positive/35 text-positive bg-positive-soft',
  warning: 'border-warning/35 text-warning bg-warning-soft',
  danger: 'border-danger/35 text-danger bg-danger-soft',
  info: 'border-info/35 text-info bg-info-soft',
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
        'rounded-sharp inline-flex items-center gap-1.5 border px-2 py-[3px]',
        'text-[0.625rem] font-medium tracking-[0.08em] whitespace-nowrap uppercase',
        TONES[tone],
        className,
      )}
    >
      {children}
    </span>
  )
}

const DOT_TONES: Record<Tone, string> = {
  neutral: 'bg-ink-subtle',
  positive: 'bg-positive',
  warning: 'bg-warning',
  danger: 'bg-danger',
  info: 'bg-info',
}

export function Dot({ tone = 'neutral' }: { tone?: Tone }) {
  return <span className={cn('size-1 shrink-0', DOT_TONES[tone])} />
}
