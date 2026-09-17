import type { InputHTMLAttributes, ReactNode, FocusEvent } from 'react'
import { cn } from '@/shared/lib/utils'

type FieldProps = {
  id: string
  label: string
  lead?: ReactNode
  trail?: ReactNode
  className?: string
  inputClassName?: string
} & Omit<InputHTMLAttributes<HTMLInputElement>, 'id' | 'className'>

/** Labeled control with optional lead/trail icons — redesign Field. */
export function Field({
  id,
  label,
  lead,
  trail,
  className,
  inputClassName,
  onFocus,
  onBlur,
  ...inputProps
}: FieldProps) {
  function handleFocus(event: FocusEvent<HTMLInputElement>) {
    event.currentTarget.style.borderColor = 'var(--ps-focus-border)'
    event.currentTarget.style.boxShadow =
      'var(--ps-shadow-md), 0 0 0 3px var(--ps-focus-ring)'
    onFocus?.(event)
  }

  function handleBlur(event: FocusEvent<HTMLInputElement>) {
    event.currentTarget.style.borderColor = 'var(--ps-line-strong)'
    event.currentTarget.style.boxShadow = 'var(--ps-shadow-md)'
    onBlur?.(event)
  }

  return (
    <div className={cn('mb-4', className)}>
      <label
        htmlFor={id}
        className="mb-2 ml-0.5 block text-[10px] font-bold tracking-[0.12em] text-ink-faint uppercase"
      >
        {label}
      </label>
      <div className="relative flex items-center">
        {lead ? (
          <span className="pointer-events-none absolute left-3.5 text-ink-faint">
            {lead}
          </span>
        ) : null}
        <input
          id={id}
          className={cn(
            'w-full rounded-[14px] border border-[color:var(--ps-line-strong)] px-4 py-3.5 text-[14.5px] text-ink outline-none motion-safe:transition-[border-color,box-shadow] motion-safe:duration-[180ms] motion-safe:ease-out',
            'placeholder:text-ink-faint',
            lead ? 'pl-11' : null,
            trail ? 'pr-11' : null,
            inputClassName,
          )}
          style={{
            background: 'linear-gradient(160deg, var(--ps-surf-2), var(--ps-surf-1))',
            boxShadow: 'var(--ps-shadow-md)',
            fontFamily: 'inherit',
          }}
          onFocus={handleFocus}
          onBlur={handleBlur}
          {...inputProps}
        />
        {trail ? (
          <span className="absolute top-1/2 right-2.5 z-10 grid -translate-y-1/2 place-items-center text-ink-dim">
            {trail}
          </span>
        ) : null}
      </div>
    </div>
  )
}
