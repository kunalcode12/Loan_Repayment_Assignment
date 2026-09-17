import { cn } from './cn'

export function Spinner({ className }: { className?: string }) {
  return (
    <span
      role="status"
      aria-label="Loading"
      className={cn(
        'inline-block size-4 shrink-0 rounded-full border-2 border-current border-r-transparent',
        'animate-spin-slow opacity-70',
        className,
      )}
    />
  )
}
