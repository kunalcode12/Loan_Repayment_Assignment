import { cn } from './cn'

/**
 * Loading placeholders.
 *
 * These mirror the real layout rather than showing a generic spinner, so the
 * page does not jump when data arrives — the skeleton occupies the same space
 * the content will.
 */
export function Skeleton({ className }: { className?: string }) {
  return <span className={cn('skeleton rounded-sharp block', className)} aria-hidden="true" />
}

export function SummarySkeleton() {
  return (
    <section
      className="rounded-sharp animate-fade border border-border bg-surface"
      aria-label="Loading loan position"
      aria-busy="true"
    >
      <div className="flex flex-wrap items-start justify-between gap-8 p-6 sm:p-8">
        <div className="space-y-4">
          <Skeleton className="h-3 w-28" />
          <Skeleton className="h-12 w-64" />
          <Skeleton className="h-3 w-48" />
        </div>
        <div className="hidden w-56 space-y-3 sm:block">
          {[0, 1, 2, 3, 4].map((row) => (
            <Skeleton key={row} className="h-3 w-full" />
          ))}
        </div>
      </div>
      <div className="border-t border-border px-6 py-4 sm:px-8">
        <Skeleton className="h-1.5 w-full" />
      </div>
      <div className="grid grid-cols-1 border-t border-border sm:grid-cols-3">
        {[0, 1, 2].map((cell) => (
          <div
            key={cell}
            className={cn('space-y-3 px-6 py-6 sm:px-8', cell > 0 && 'border-t border-border sm:border-t-0 sm:border-l')}
          >
            <Skeleton className="h-2.5 w-24" />
            <Skeleton className="h-7 w-32" />
            <Skeleton className="h-2.5 w-40" />
          </div>
        ))}
      </div>
    </section>
  )
}

export function TableSkeleton({ rows = 8 }: { rows?: number }) {
  return (
    <section
      className="rounded-sharp animate-fade border border-border bg-surface"
      aria-label="Loading repayment schedule"
      aria-busy="true"
    >
      <div className="space-y-3 p-6 sm:p-8">
        <Skeleton className="h-4 w-48" />
        <Skeleton className="h-3 w-72" />
      </div>
      <div className="border-t border-border">
        {Array.from({ length: rows }, (_, row) => (
          <div
            key={row}
            className="flex items-center gap-4 border-b border-border px-6 py-4 last:border-b-0 sm:px-8"
            style={{ opacity: 1 - row * 0.085 }}
          >
            <Skeleton className="h-3 w-6" />
            <Skeleton className="h-3 w-24" />
            <Skeleton className="ml-auto h-3 w-20" />
            <Skeleton className="hidden h-3 w-20 sm:block" />
            <Skeleton className="hidden h-3 w-24 sm:block" />
            <Skeleton className="h-5 w-16" />
          </div>
        ))}
      </div>
    </section>
  )
}

export function PanelSkeleton({ lines = 3 }: { lines?: number }) {
  return (
    <section
      className="rounded-sharp animate-fade space-y-5 border border-border bg-surface p-6 sm:p-8"
      aria-busy="true"
    >
      <Skeleton className="h-4 w-40" />
      {Array.from({ length: lines }, (_, line) => (
        <Skeleton key={line} className="h-10 w-full" />
      ))}
    </section>
  )
}
