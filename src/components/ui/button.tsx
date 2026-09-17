'use client'

import type { ButtonHTMLAttributes, ReactNode } from 'react'

import { cn } from './cn'
import { Spinner } from './spinner'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'
type Size = 'sm' | 'md' | 'lg'

/**
 * `primary` is the inverse of the canvas — white on black in the dark theme,
 * black on white in the light one. That is the highest-contrast action a page
 * can offer, and it means there is never any doubt which control is the
 * primary one.
 */
const VARIANTS: Record<Variant, string> = {
  primary: 'bg-accent text-accent-ink hover:bg-accent/88 active:bg-accent/80 disabled:opacity-35',
  secondary:
    'bg-transparent text-ink border border-border-strong hover:border-border-loud hover:bg-surface-muted active:bg-surface-muted disabled:opacity-35',
  ghost: 'bg-transparent text-ink-muted hover:text-ink hover:bg-surface-muted disabled:opacity-35',
  danger: 'bg-danger text-canvas hover:bg-danger/90 active:bg-danger/85 disabled:opacity-35',
}

const SIZES: Record<Size, string> = {
  sm: 'h-8 px-3 text-[0.75rem] gap-1.5',
  md: 'h-10 px-4 text-[0.8125rem] gap-2',
  lg: 'h-12 px-6 text-[0.875rem] gap-2',
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
  loading?: boolean
  children: ReactNode
}

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled,
  className,
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      {...props}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cn(
        'rounded-sharp inline-flex items-center justify-center',
        'font-medium tracking-[-0.005em] whitespace-nowrap select-none',
        'transition-all duration-150 ease-out',
        'disabled:cursor-not-allowed',
        SIZES[size],
        VARIANTS[variant],
        className,
      )}
    >
      {loading ? <Spinner className="size-3.5" /> : null}
      {children}
    </button>
  )
}
