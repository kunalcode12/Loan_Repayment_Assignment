'use client'

import { useId, type InputHTMLAttributes, type ReactNode } from 'react'

import { cn } from './cn'

interface FieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'id'> {
  label: string
  hint?: ReactNode
  error?: string | null
  prefix?: string
  suffix?: string
}

/**
 * A labelled input.
 *
 * The label is always rendered and always tied to the input by id — no
 * placeholder-as-label — so the form stays readable to a screen reader and to
 * anyone who has already typed into it.
 */
export function Field({
  label,
  hint,
  error,
  prefix,
  suffix,
  className,
  ...props
}: FieldProps) {
  const id = useId()
  const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined

  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="eyebrow">
        {label}
      </label>

      <div
        className={cn(
          'rounded-sharp flex items-center border bg-surface-inset',
          'transition-colors duration-150',
          'focus-within:border-ink',
          error ? 'border-danger' : 'border-border-strong hover:border-border-loud',
        )}
      >
        {prefix ? (
          <span className="pl-3.5 font-mono text-[0.8125rem] text-ink-subtle select-none">
            {prefix}
          </span>
        ) : null}
        <input
          {...props}
          id={id}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          className={cn(
            'tabular h-11 w-full min-w-0 bg-transparent text-[0.875rem] text-ink outline-none',
            'placeholder:text-ink-subtle',
            prefix ? 'pl-2' : 'pl-3.5',
            suffix ? 'pr-2' : 'pr-3.5',
            className,
          )}
        />
        {suffix ? (
          <span className="pr-3.5 font-mono text-[0.8125rem] text-ink-subtle select-none">
            {suffix}
          </span>
        ) : null}
      </div>

      {error ? (
        <p id={`${id}-error`} className="text-[0.75rem] text-danger">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="text-[0.75rem] leading-relaxed text-ink-subtle">
          {hint}
        </p>
      ) : null}
    </div>
  )
}
