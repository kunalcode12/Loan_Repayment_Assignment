'use client'

import type { ButtonHTMLAttributes, ReactNode } from 'react'

import { cn } from './cn'
import { Spinner } from './spinner'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'
type Size = 'sm' | 'md' | 'lg'

const VARIANTS: Record<Variant, string> = {
  primary:
    'bg-accent text-accent-ink hover:opacity-88 active:opacity-80 disabled:opacity-40 shadow-[0_1px_2px_rgb(0_0_0/0.08)]',
  secondary:
    'bg-surface text-ink border border-border-strong hover:bg-surface-muted active:bg-surface-muted disabled:opacity-40',
  ghost: 'text-ink-muted hover:text-ink hover:bg-surface-muted disabled:opacity-40',
  danger: 'bg-danger text-white hover:opacity-90 active:opacity-85 disabled:opacity-40',
}

const SIZES: Record<Size, string> = {
  sm: 'h-9 px-3.5 text-[0.8125rem] rounded-lg gap-1.5',
  md: 'h-11 px-5 text-sm rounded-xl gap-2',
  lg: 'h-13 px-7 text-[0.9375rem] rounded-xl gap-2.5',
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
        'inline-flex items-center justify-center font-medium tracking-[-0.01em]',
        'transition-[opacity,background-color,color] duration-150',
        'disabled:cursor-not-allowed select-none whitespace-nowrap',
        SIZES[size],
        VARIANTS[variant],
        className,
      )}
    >
      {loading ? <Spinner className="size-4" /> : null}
      {children}
    </button>
  )
}
