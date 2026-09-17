import { cn } from './ui/cn'

/** Wordmark and glyph. Used on the sign-in screen and in the app header. */
export function Brand({ className }: { className?: string }) {
  return (
    <div className={cn('flex items-center gap-3', className)}>
      <span className="grid size-9 place-items-center rounded-xl bg-accent text-accent-ink">
        <svg viewBox="0 0 24 24" fill="none" className="size-[18px]" aria-hidden="true">
          <path
            d="M4 17.5 9 11l4 4 7-8.5"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </span>
      <span className="flex flex-col leading-none">
        <span className="text-[0.9375rem] font-semibold tracking-[-0.02em] text-ink">
          Repayments
        </span>
        <span className="mt-1 text-[0.6875rem] tracking-[0.06em] uppercase text-ink-subtle">
          MSME Lending
        </span>
      </span>
    </div>
  )
}
