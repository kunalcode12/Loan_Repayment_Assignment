import { cn } from './ui/cn'

/** Wordmark and glyph. Used on the sign-in screen and in the app header. */
export function Brand({ className }: { className?: string }) {
  return (
    <div className={cn('flex items-center gap-3', className)}>
      <span className="rounded-sharp grid size-8 place-items-center bg-accent text-accent-ink">
        <svg viewBox="0 0 24 24" fill="none" className="size-4" aria-hidden="true">
          <path
            d="M4 18 9.5 11.5 13.5 15 20 6.5"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="square"
            strokeLinejoin="miter"
          />
        </svg>
      </span>
      <span className="flex flex-col leading-none">
        <span className="text-[0.875rem] font-semibold tracking-[-0.01em] text-ink">
          Repayments
        </span>
        <span className="mt-[5px] font-mono text-[0.625rem] tracking-[0.14em] text-ink-subtle">
          MSME LENDING
        </span>
      </span>
    </div>
  )
}
