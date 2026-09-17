'use client'

import { useId, type InputHTMLAttributes, type ReactNode } from 'react'

import { cn } from './cn'

interface FieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'id'> {
  label: string
  hint?: ReactNode
  error?: string | null
  prefix?: string
}

/**
 * A labelled input.
 *
 * The label is always rendered and always tied to the input by id — no
 * placeholder-as-label — so the form stays readable to a screen reader and to
 * anyone who has already typed into it.
 */
export function Field({ label, hint, error, prefix, className, ...props }: FieldProps) {
  const id = useId()
  const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined

  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="text-[0.8125rem] font-medium text-ink-muted">
        {label}
      </label>

      <div
        className={cn(
          'flex items-center rounded-xl border bg-surface transition-colors',
          'focus-within:border-ink focus-within:ring-[3px] focus-within:ring-ink/8',
          error ? 'border-danger' : 'border-border-strong',
        )}
      >
        {prefix ? (
          <span className="pl-4 pr-1 text-[0.9375rem] text-ink-subtle select-none">{prefix}</span>
        ) : null}
        <input
          {...props}
          id={id}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          className={cn(
            'h-12 w-full min-w-0 bg-transparent text-[0.9375rem] text-ink outline-none',
            'placeholder:text-ink-subtle tabular',
            prefix ? 'pl-1 pr-4' : 'px-4',
            className,
          )}
        />
      </div>

      {error ? (
        <p id={`${id}-error`} className="text-[0.8125rem] text-danger">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="text-[0.8125rem] text-ink-subtle">
          {hint}
        </p>
      ) : null}
    </div>
  )
}
